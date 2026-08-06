package movieservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.entity.RoomLayout;
import movieservice.entity.RoomLayoutPosition;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.LayoutStatus;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.RoomLayoutPositionRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Creates the immutable per-showtime seat inventory from the room's ACTIVE
 * layout. Reads of seat availability must never create inventory implicitly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ShowtimeInventoryService {

    private static final int INVENTORY_BATCH_SIZE = 500;
    private static final String INSERT_INVENTORY_SQL = """
            INSERT INTO showtime_seat (
                showtime_id, seat_id, seat_code, room_layout_id, layout_version,
                seat_type, seat_group_id, price, status, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 0)
            ON CONFLICT (showtime_id, seat_id) DO NOTHING
            """;

    private final ShowTimeRepository showTimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final RoomLayoutRepository roomLayoutRepository;
    private final RoomLayoutPositionRepository roomLayoutPositionRepository;
    private final SeatRepository seatRepository;
    private final PriceBookPricingService priceBookPricingService;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Materializes inventory exactly once. The showtime row lock serializes
     * concurrent callers; the database unique constraint remains the final
     * duplicate guard.
     */
    @Transactional
    public List<ShowtimeSeat> materialize(Long showtimeId) {
        ShowTime showtime = showTimeRepository.findByIdForUpdate(showtimeId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));

        List<ShowtimeSeat> existing =
                showtimeSeatRepository.findByShowTime_ShowTimeId(showtimeId);
        if (!existing.isEmpty()) {
            return existing;
        }

        Long roomId = showtime.getCinemaRoom().getCinemaRoomId();
        RoomLayout activeLayout = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdAndStatus(roomId, LayoutStatus.ACTIVE)
                .filter(layout -> layout.getSellableUnitCount() != null
                        && layout.getSellableUnitCount() > 0)
                .orElseThrow(() ->
                        new AppException(MovieErrorCode.SHOWTIME_ACTIVE_LAYOUT_NOT_FOUND));

        List<RoomLayoutPosition> positions = roomLayoutPositionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(
                        activeLayout.getRoomLayoutId());
        List<LayoutSeatUnit> layoutUnits = toSellableUnits(positions);

        if (layoutUnits.isEmpty()
                || activeLayout.getSellableUnitCount() == null
                || layoutUnits.size() != activeLayout.getSellableUnitCount()) {
            throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
        }

        List<Seat> activeSeats = seatRepository.findByCinemaRoomCinemaRoomId(roomId)
                .stream()
                .filter(seat -> seat.getStatus() == SeatStatus.ACTIVE)
                .toList();
        if (activeSeats.size() != layoutUnits.size()) {
            throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
        }

        PriceBookPricingService.PricingDecision pricing =
                priceBookPricingService.resolve(showtime);
        priceBookPricingService.applyDecision(showtime, pricing);

        Map<String, Seat> seatsByCoordinate = new HashMap<>();
        for (Seat seat : activeSeats) {
            String coordinate = coordinate(seat.getRowLabel(), seat.getColNumber());
            if (seatsByCoordinate.put(coordinate, seat) != null) {
                throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
            }
        }

        List<ShowtimeSeat> inventory = new ArrayList<>(layoutUnits.size());
        for (LayoutSeatUnit unit : layoutUnits) {
            Seat seat = seatsByCoordinate.get(coordinate(unit.rowLabel(), unit.colNumber()));
            if (!matchesActiveLayout(seat, unit)) {
                throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
            }

            inventory.add(ShowtimeSeat.builder()
                    .showTime(showtime)
                    .seat(seat)
                    .seatCode(unit.seatCode())
                    .roomLayout(activeLayout)
                    .layoutVersion(activeLayout.getVersion())
                    .seatType(unit.seatType())
                    .seatGroupId(unit.seatGroupId())
                    .price(pricing.priceFor(seat))
                    .status(ShowtimeSeatStatus.AVAILABLE)
                    .build());
        }

        List<ShowtimeSeat> saved = showtimeSeatRepository.saveAll(inventory);
        showtime.setTotalSeats(activeLayout.getPersonCapacity());
        log.info(
                "[ShowtimeInventory] materialized showtimeId={} layoutId={} version={} sellableUnits={} personCapacity={}",
                showtimeId,
                activeLayout.getRoomLayoutId(),
                activeLayout.getVersion(),
                saved.size(),
                activeLayout.getPersonCapacity());
        return saved;
    }

    /**
     * Materializes inventory for a published schedule in bounded JDBC batches.
     * Room layouts and master seats are loaded once per room instead of once per
     * showtime. The native insert deliberately remains in the caller transaction,
     * so any failed row rolls back the complete schedule publication.
     */
    @Transactional
    public int materializeBatch(Collection<ShowTime> showtimes) {
        if (showtimes == null || showtimes.isEmpty()) {
            return 0;
        }

        Map<Long, RoomInventoryTemplate> templatesByRoom = new HashMap<>();
        List<InventoryInsert> inserts = new ArrayList<>();

        for (ShowTime showtime : showtimes) {
            if (showtime == null || showtime.getShowTimeId() == null
                    || showtime.getCinemaRoom() == null
                    || showtime.getCinemaRoom().getCinemaRoomId() == null) {
                throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
            }

            Long roomId = showtime.getCinemaRoom().getCinemaRoomId();
            RoomInventoryTemplate template = templatesByRoom.computeIfAbsent(
                    roomId, this::loadRoomInventoryTemplate);
            PriceBookPricingService.PricingDecision pricing =
                    priceBookPricingService.fromSnapshot(showtime);

            for (InventorySeat inventorySeat : template.seats()) {
                inserts.add(new InventoryInsert(
                        showtime.getShowTimeId(),
                        inventorySeat.seat().getSeatId(),
                        inventorySeat.unit().seatCode(),
                        template.layout().getRoomLayoutId(),
                        template.layout().getVersion(),
                        inventorySeat.unit().seatType().name(),
                        inventorySeat.unit().seatGroupId(),
                        pricing.priceFor(inventorySeat.seat())));
            }
            showtime.setTotalSeats(template.layout().getPersonCapacity());
        }

        jdbcTemplate.batchUpdate(
                INSERT_INVENTORY_SQL,
                inserts,
                INVENTORY_BATCH_SIZE,
                (statement, row) -> {
                    statement.setLong(1, row.showtimeId());
                    statement.setLong(2, row.seatId());
                    statement.setString(3, row.seatCode());
                    statement.setLong(4, row.roomLayoutId());
                    statement.setInt(5, row.layoutVersion());
                    statement.setString(6, row.seatType());
                    if (row.seatGroupId() == null) {
                        statement.setNull(7, Types.VARCHAR);
                    } else {
                        statement.setString(7, row.seatGroupId());
                    }
                    statement.setBigDecimal(8, row.price());
                });

        log.info(
                "[ShowtimeInventory] bulk materialized showtimes={} rooms={} inventoryRows={} batchSize={}",
                showtimes.size(), templatesByRoom.size(), inserts.size(), INVENTORY_BATCH_SIZE);
        return inserts.size();
    }

    private RoomInventoryTemplate loadRoomInventoryTemplate(Long roomId) {
        RoomLayout activeLayout = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdAndStatus(roomId, LayoutStatus.ACTIVE)
                .filter(layout -> layout.getSellableUnitCount() != null
                        && layout.getSellableUnitCount() > 0)
                .orElseThrow(() ->
                        new AppException(MovieErrorCode.SHOWTIME_ACTIVE_LAYOUT_NOT_FOUND));
        List<LayoutSeatUnit> layoutUnits = toSellableUnits(roomLayoutPositionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(
                        activeLayout.getRoomLayoutId()));
        if (layoutUnits.isEmpty() || layoutUnits.size() != activeLayout.getSellableUnitCount()) {
            throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
        }

        List<Seat> activeSeats = seatRepository.findByCinemaRoomCinemaRoomId(roomId)
                .stream()
                .filter(seat -> seat.getStatus() == SeatStatus.ACTIVE)
                .toList();
        if (activeSeats.size() != layoutUnits.size()) {
            throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
        }

        Map<String, Seat> seatsByCoordinate = new HashMap<>();
        for (Seat seat : activeSeats) {
            if (seatsByCoordinate.put(
                    coordinate(seat.getRowLabel(), seat.getColNumber()), seat) != null) {
                throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
            }
        }

        List<InventorySeat> inventorySeats = new ArrayList<>(layoutUnits.size());
        for (LayoutSeatUnit unit : layoutUnits) {
            Seat seat = seatsByCoordinate.get(coordinate(unit.rowLabel(), unit.colNumber()));
            if (!matchesActiveLayout(seat, unit)) {
                throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
            }
            inventorySeats.add(new InventorySeat(unit, seat));
        }
        return new RoomInventoryTemplate(activeLayout, inventorySeats);
    }

    private List<LayoutSeatUnit> toSellableUnits(List<RoomLayoutPosition> positions) {
        List<RoomLayoutPosition> sorted = positions.stream()
                .filter(position -> position.getPositionType() == LayoutPositionType.SEAT)
                .filter(position -> position.getSeatStatus() == SeatStatus.ACTIVE)
                .sorted(Comparator
                        .comparing(RoomLayoutPosition::getRowIndex)
                        .thenComparing(RoomLayoutPosition::getColumnIndex))
                .toList();

        Set<String> seenCoupleGroups = new HashSet<>();
        List<LayoutSeatUnit> units = new ArrayList<>();
        for (RoomLayoutPosition position : sorted) {
            SeatType seatType = position.getSeatType();
            if (seatType == null || position.getSeatCode() == null) {
                throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
            }
            if (seatType == SeatType.COUPLE) {
                if (position.getSeatGroupId() == null || position.getSeatGroupId().isBlank()) {
                    throw new AppException(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH);
                }
                if (!seenCoupleGroups.add(position.getSeatGroupId())) {
                    continue;
                }
            }

            units.add(new LayoutSeatUnit(
                    position.getRowLabel(),
                    position.getColumnIndex() + 1,
                    position.getSeatCode(),
                    seatType,
                    position.getSeatGroupId()));
        }
        return units;
    }

    private boolean matchesActiveLayout(Seat seat, LayoutSeatUnit unit) {
        return seat != null
                && seat.getStatus() == SeatStatus.ACTIVE
                && seat.getSeatType() == unit.seatType()
                && Objects.equals(seat.getSeatGroupId(), unit.seatGroupId());
    }

    private String coordinate(String rowLabel, Integer colNumber) {
        return rowLabel + ":" + colNumber;
    }

    private record LayoutSeatUnit(
            String rowLabel,
            int colNumber,
            String seatCode,
            SeatType seatType,
            String seatGroupId) {
    }

    private record InventorySeat(LayoutSeatUnit unit, Seat seat) {
    }

    private record RoomInventoryTemplate(RoomLayout layout, List<InventorySeat> seats) {
    }

    private record InventoryInsert(
            Long showtimeId,
            Long seatId,
            String seatCode,
            Long roomLayoutId,
            Integer layoutVersion,
            String seatType,
            String seatGroupId,
            java.math.BigDecimal price) {
    }
}
