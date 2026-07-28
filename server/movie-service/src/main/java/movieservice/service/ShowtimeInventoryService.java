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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
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

    private final ShowTimeRepository showTimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final RoomLayoutRepository roomLayoutRepository;
    private final RoomLayoutPositionRepository roomLayoutPositionRepository;
    private final SeatRepository seatRepository;
    private final PriceBookPricingService priceBookPricingService;

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
}
