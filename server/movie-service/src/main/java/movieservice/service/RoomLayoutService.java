package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.LayoutPositionRequest;
import movieservice.dto.request.RoomLayoutSaveRequest;
import movieservice.dto.response.LayoutPositionResponse;
import movieservice.dto.response.RoomLayoutResponse;
import movieservice.dto.response.RoomLayoutSummaryResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.RoomLayout;
import movieservice.entity.RoomLayoutAuditLog;
import movieservice.entity.RoomLayoutPosition;
import movieservice.entity.Seat;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.LayoutStatus;
import movieservice.enums.RoomLayoutAction;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.enums.ShowTimeStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.RoomLayoutAuditLogRepository;
import movieservice.repository.RoomLayoutPositionRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class RoomLayoutService {

    // Fallback base price for brand-new Seat rows created by layout activation — the
    // wizard captures no pricing step (out of scope per the spec), so newly synced
    // seats start here and can be edited individually afterward via PUT /api/seats/{id},
    // same as the legacy quick-create flow already documents ("Individual seats can be
    // updated later"). Existing seats keep whatever price they already had.
    static final BigDecimal DEFAULT_BASE_PRICE = BigDecimal.valueOf(90000);
    static final BigDecimal MIN_AREA_PER_PERSON_SQM = new BigDecimal("0.80");
    static final BigDecimal MIN_VOLUME_PER_PERSON_CBM = new BigDecimal("4.00");
    static final BigDecimal MIN_ROW_PITCH_M = new BigDecimal("0.95");
    static final BigDecimal MIN_SEAT_WIDTH_M = new BigDecimal("0.50");
    static final BigDecimal WIDE_SCREEN_FIRST_ROW_FACTOR = new BigDecimal("0.84");

    RoomLayoutRepository roomLayoutRepository;
    RoomLayoutPositionRepository positionRepository;
    RoomLayoutAuditLogRepository auditLogRepository;
    CinemaRoomRepository cinemaRoomRepository;
    SeatRepository seatRepository;
    ShowTimeRepository showTimeRepository;
    Clock clock;

    // ── Create / read ────────────────────────────────────────────────────────

    @Transactional
    public RoomLayout createInitialDraft(CinemaRoom room, String actor) {
        RoomLayout layout = RoomLayout.builder()
                .cinemaRoom(room)
                .version(1)
                .status(LayoutStatus.DRAFT)
                .numberOfRows(0)
                .maxPositionsPerRow(0)
                .firstRowLabel("A")
                .numberingDirection(movieservice.enums.NumberingDirection.LEFT_TO_RIGHT)
                .numberingPolicy(movieservice.enums.NumberingPolicy.CONTIGUOUS_SEATS)
                .personCapacity(0)
                .sellableUnitCount(0)
                .createdBy(actor)
                .updatedBy(actor)
                .build();
        layout = roomLayoutRepository.save(layout);
        logAction(layout.getRoomLayoutId(), RoomLayoutAction.CREATE, actor, null, LayoutStatus.DRAFT, null);
        return layout;
    }

    public RoomLayout getLayoutEntityOrThrow(Long roomId, Long layoutId) {
        RoomLayout layout = roomLayoutRepository.findById(layoutId)
                .orElseThrow(() -> new AppException(MovieErrorCode.ROOM_LAYOUT_NOT_FOUND));
        if (!layout.getCinemaRoom().getCinemaRoomId().equals(roomId)) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_NOT_FOUND);
        }
        return layout;
    }

    public List<RoomLayoutSummaryResponse> listLayouts(Long roomId) {
        return roomLayoutRepository.findByCinemaRoomCinemaRoomIdOrderByVersionDesc(roomId).stream()
                .map(this::toSummary)
                .toList();
    }

    public RoomLayoutResponse getLayout(Long roomId, Long layoutId) {
        RoomLayout layout = getLayoutEntityOrThrow(roomId, layoutId);
        List<RoomLayoutPosition> positions = positionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(layoutId);
        return toResponse(layout, positions);
    }

    // ── Save (PUT) — only while DRAFT ───────────────────────────────────────

    @Transactional
    public RoomLayoutResponse saveLayout(Long roomId, Long layoutId, RoomLayoutSaveRequest request, String actor) {
        RoomLayout layout = getLayoutEntityOrThrow(roomId, layoutId);
        if (layout.getStatus() != LayoutStatus.DRAFT) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_NOT_EDITABLE);
        }

        List<LayoutPositionRequest> incoming = request.getPositions();
        validateIncomingPositions(incoming);

        positionRepository.deleteByRoomLayoutRoomLayoutId(layoutId);
        positionRepository.flush();

        RoomLayout layoutRef = layout;
        List<RoomLayoutPosition> entities = incoming.stream()
                .map(p -> RoomLayoutPosition.builder()
                        .roomLayout(layoutRef)
                        .rowIndex(p.getRowIndex())
                        .columnIndex(p.getColumnIndex())
                        .rowLabel(p.getRowLabel())
                        .positionType(p.getPositionType())
                        .seatNumber(p.getSeatNumber())
                        .seatCode(p.getSeatCode())
                        .seatType(p.getSeatType())
                        .seatGroupId(p.getSeatGroupId())
                        .seatStatus(SeatStatus.ACTIVE)
                        .manualOverride(Boolean.TRUE.equals(p.getManualOverride()))
                        .build())
                .toList();
        if (!entities.isEmpty()) {
            positionRepository.saveAll(entities);
        }

        if (request.getNumberOfRows() != null) layout.setNumberOfRows(request.getNumberOfRows());
        if (request.getMaxPositionsPerRow() != null) layout.setMaxPositionsPerRow(request.getMaxPositionsPerRow());
        if (request.getFirstRowLabel() != null) layout.setFirstRowLabel(request.getFirstRowLabel());
        if (request.getNumberingDirection() != null) layout.setNumberingDirection(request.getNumberingDirection());
        if (request.getNumberingPolicy() != null) layout.setNumberingPolicy(request.getNumberingPolicy());
        layout.setGeneratorTemplateCode(request.getGeneratorTemplateCode());
        layout.setGeneratorTemplateVersion(request.getGeneratorTemplateVersion());
        layout.setGenerationConfig(request.getGenerationConfig());
        layout.setUpdatedBy(actor);
        recomputeCapacity(layout, entities);
        layout = roomLayoutRepository.save(layout);

        logAction(layoutId, RoomLayoutAction.SAVE, actor, layout.getStatus(), layout.getStatus(), null);
        return toResponse(layout, entities);
    }

    /** Duplicate coordinate / duplicate seat code / SEAT-field consistency / Couple-group validity. */
    private void validateIncomingPositions(List<LayoutPositionRequest> positions) {
        Set<String> coords = new HashSet<>();
        Set<String> seatCodes = new HashSet<>();
        Map<String, List<LayoutPositionRequest>> coupleGroups = new HashMap<>();

        for (LayoutPositionRequest p : positions) {
            String coordKey = p.getRowIndex() + ":" + p.getColumnIndex();
            if (!coords.add(coordKey)) {
                throw new AppException(MovieErrorCode.ROOM_LAYOUT_POSITION_DUPLICATE_COORDINATE);
            }

            if (p.getPositionType() == LayoutPositionType.SEAT) {
                if (p.getSeatNumber() == null || p.getSeatCode() == null || p.getSeatType() == null) {
                    throw new AppException(MovieErrorCode.ROOM_LAYOUT_POSITION_FIELDS_INVALID);
                }
                if (!seatCodes.add(p.getSeatCode())) {
                    throw new AppException(MovieErrorCode.ROOM_LAYOUT_POSITION_DUPLICATE_SEAT_CODE);
                }
                if (p.getSeatType() == SeatType.COUPLE) {
                    if (p.getSeatGroupId() == null) {
                        throw new AppException(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID);
                    }
                    coupleGroups.computeIfAbsent(p.getSeatGroupId(), k -> new ArrayList<>()).add(p);
                }
            } else if (p.getSeatNumber() != null || p.getSeatCode() != null || p.getSeatType() != null
                    || p.getSeatGroupId() != null) {
                throw new AppException(MovieErrorCode.ROOM_LAYOUT_POSITION_FIELDS_INVALID);
            }
        }

        for (List<LayoutPositionRequest> group : coupleGroups.values()) {
            if (group.size() != 2) {
                throw new AppException(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID);
            }
            LayoutPositionRequest a = group.get(0);
            LayoutPositionRequest b = group.get(1);
            boolean sameRow = a.getRowIndex().equals(b.getRowIndex());
            boolean adjacent = Math.abs(a.getColumnIndex() - b.getColumnIndex()) == 1;
            if (!sameRow || !adjacent) {
                throw new AppException(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID);
            }
        }
    }

    /** personCapacity/sellableUnitCount are always backend-derived — never trust client-sent values. */
    private void recomputeCapacity(RoomLayout layout, List<RoomLayoutPosition> positions) {
        int personCapacity = 0;
        int sellableUnitCount = 0;
        Set<String> countedGroups = new HashSet<>();

        for (RoomLayoutPosition p : positions) {
            if (p.getPositionType() != LayoutPositionType.SEAT) continue;
            if (p.getSeatType() == SeatType.COUPLE) {
                if (p.getSeatGroupId() != null && countedGroups.add(p.getSeatGroupId())) {
                    personCapacity += 2;
                    sellableUnitCount += 1;
                }
            } else {
                personCapacity += 1;
                sellableUnitCount += 1;
            }
        }
        layout.setPersonCapacity(personCapacity);
        layout.setSellableUnitCount(sellableUnitCount);
    }

    // ── Workflow transitions ─────────────────────────────────────────────────

    @Transactional
    public RoomLayoutResponse submit(Long roomId, Long layoutId, String actor) {
        RoomLayout layout = getLayoutEntityOrThrow(roomId, layoutId);
        CinemaRoom room = lockRoomForTransition(roomId);
        if (layout.getStatus() != LayoutStatus.DRAFT) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION);
        }
        List<RoomLayoutPosition> positions = positionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(layoutId);
        if (positions.isEmpty()) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_EMPTY);
        }
        validateStoredPositions(positions);
        validateRoomCapacityEnvelope(room, positions);

        LayoutStatus old = layout.getStatus();
        layout.setStatus(LayoutStatus.PENDING_APPROVAL);
        layout.setSubmittedAt(LocalDateTime.now(clock));
        layout.setSubmittedBy(actor);
        layout.setRejectionReason(null);
        layout.setUpdatedBy(actor);
        layout = roomLayoutRepository.save(layout);

        transitionRoom(room, CinemaRoomStatus.PENDING_APPROVAL, actor);

        logAction(layoutId, RoomLayoutAction.SUBMIT, actor, old, layout.getStatus(), null);
        return toResponse(layout, positions);
    }

    @Transactional
    public RoomLayoutResponse approve(Long roomId, Long layoutId, String actor) {
        RoomLayout layout = getLayoutEntityOrThrow(roomId, layoutId);
        CinemaRoom room = lockRoomForTransition(roomId);
        if (layout.getStatus() != LayoutStatus.PENDING_APPROVAL) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION);
        }

        LayoutStatus old = layout.getStatus();
        layout.setStatus(LayoutStatus.APPROVED);
        layout.setApprovedAt(LocalDateTime.now(clock));
        layout.setApprovedBy(actor);
        layout.setUpdatedBy(actor);
        layout = roomLayoutRepository.save(layout);

        transitionRoom(room, CinemaRoomStatus.APPROVED, actor);

        logAction(layoutId, RoomLayoutAction.APPROVE, actor, old, layout.getStatus(), null);
        return toResponse(layout, positionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(layoutId));
    }

    @Transactional
    public RoomLayoutResponse reject(Long roomId, Long layoutId, String reason, String actor) {
        RoomLayout layout = getLayoutEntityOrThrow(roomId, layoutId);
        CinemaRoom room = lockRoomForTransition(roomId);
        if (layout.getStatus() != LayoutStatus.PENDING_APPROVAL) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION);
        }

        LayoutStatus old = layout.getStatus();
        layout.setStatus(LayoutStatus.DRAFT);
        layout.setRejectionReason(reason);
        layout.setUpdatedBy(actor);
        layout = roomLayoutRepository.save(layout);

        transitionRoom(room, CinemaRoomStatus.DRAFT, actor);

        logAction(layoutId, RoomLayoutAction.REJECT, actor, old, layout.getStatus(), reason);
        return toResponse(layout, positionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(layoutId));
    }

    @Transactional
    public RoomLayoutResponse activate(Long roomId, Long layoutId, String actor) {
        RoomLayout layout = getLayoutEntityOrThrow(roomId, layoutId);
        CinemaRoom room = lockRoomForTransition(roomId);
        if (layout.getStatus() != LayoutStatus.APPROVED) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION);
        }

        Optional<RoomLayout> currentActive = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdAndStatus(room.getCinemaRoomId(), LayoutStatus.ACTIVE);

        if (currentActive.isPresent()) {
            boolean hasFutureShowtimes = showTimeRepository
                    .existsByCinemaRoomCinemaRoomIdAndStatusInAndShowDateGreaterThanEqual(
                            room.getCinemaRoomId(),
                            List.of(ShowTimeStatus.SCHEDULED, ShowTimeStatus.ON_SALE),
                            LocalDate.now(clock));
            if (hasFutureShowtimes) {
                throw new AppException(MovieErrorCode.ROOM_LAYOUT_HAS_FUTURE_SHOWTIMES);
            }
        }

        List<RoomLayoutPosition> positions = positionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(layoutId);
        syncSeatsFromLayout(room, positions);

        LayoutStatus old = layout.getStatus();
        layout.setStatus(LayoutStatus.ACTIVE);
        layout.setUpdatedBy(actor);
        layout = roomLayoutRepository.save(layout);

        if (currentActive.isPresent() && !currentActive.get().getRoomLayoutId().equals(layout.getRoomLayoutId())) {
            RoomLayout previous = currentActive.get();
            LayoutStatus prevOld = previous.getStatus();
            previous.setStatus(LayoutStatus.SUPERSEDED);
            previous.setUpdatedBy(actor);
            roomLayoutRepository.save(previous);
            logAction(previous.getRoomLayoutId(), RoomLayoutAction.ACTIVATE, actor, prevOld,
                    LayoutStatus.SUPERSEDED, "Superseded by version " + layout.getVersion());
        }

        room.setStatus(CinemaRoomStatus.ACTIVE);
        room.setTotalSeatCapacity(layout.getPersonCapacity());
        // numberOfRows/seatsPerRow are kept in sync for aisle-detection (MovieMapper) and
        // ClusterDetailPage's room-list display; per-seat-type distribution lives on
        // RoomLayoutPosition.seatType, not at the room level.
        room.setNumberOfRows(layout.getNumberOfRows());
        room.setSeatsPerRow(layout.getMaxPositionsPerRow());
        room.setUpdatedBy(actor);
        cinemaRoomRepository.save(room);

        logAction(layoutId, RoomLayoutAction.ACTIVATE, actor, old, layout.getStatus(), null);
        return toResponse(layout, positions);
    }

    @Transactional
    public RoomLayoutResponse clone(Long roomId, Long layoutId, String actor) {
        RoomLayout source = getLayoutEntityOrThrow(roomId, layoutId);
        if (source.getStatus() == LayoutStatus.DRAFT || source.getStatus() == LayoutStatus.PENDING_APPROVAL) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION);
        }

        List<RoomLayoutPosition> sourcePositions = positionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(layoutId);

        int nextVersion = roomLayoutRepository.findByCinemaRoomCinemaRoomIdOrderByVersionDesc(roomId).stream()
                .findFirst().map(RoomLayout::getVersion).orElse(0) + 1;

        RoomLayout clone = RoomLayout.builder()
                .cinemaRoom(source.getCinemaRoom())
                .version(nextVersion)
                .status(LayoutStatus.DRAFT)
                .numberOfRows(source.getNumberOfRows())
                .maxPositionsPerRow(source.getMaxPositionsPerRow())
                .firstRowLabel(source.getFirstRowLabel())
                .numberingDirection(source.getNumberingDirection())
                .numberingPolicy(source.getNumberingPolicy())
                .generatorTemplateCode(source.getGeneratorTemplateCode())
                .generatorTemplateVersion(source.getGeneratorTemplateVersion())
                .generationConfig(source.getGenerationConfig())
                .personCapacity(source.getPersonCapacity())
                .sellableUnitCount(source.getSellableUnitCount())
                .createdBy(actor)
                .updatedBy(actor)
                .build();
        clone = roomLayoutRepository.save(clone);

        RoomLayout finalClone = clone;
        List<RoomLayoutPosition> newPositions = sourcePositions.stream()
                .map(p -> RoomLayoutPosition.builder()
                        .roomLayout(finalClone)
                        .rowIndex(p.getRowIndex())
                        .columnIndex(p.getColumnIndex())
                        .rowLabel(p.getRowLabel())
                        .positionType(p.getPositionType())
                        .seatNumber(p.getSeatNumber())
                        .seatCode(p.getSeatCode())
                        .seatType(p.getSeatType())
                        .seatGroupId(p.getSeatGroupId())
                        .seatStatus(SeatStatus.ACTIVE)
                        .manualOverride(p.getManualOverride())
                        .build())
                .toList();
        if (!newPositions.isEmpty()) {
            positionRepository.saveAll(newPositions);
        }

        logAction(clone.getRoomLayoutId(), RoomLayoutAction.CLONE, actor, null, LayoutStatus.DRAFT,
                "Cloned from version " + source.getVersion());
        return toResponse(clone, newPositions);
    }

    // ── Seat sync on activation ──────────────────────────────────────────────
    // Derives sellable units from the layout (couple pairs collapse to one unit),
    // matches them to existing Seat rows by (rowLabel, colNumber) to preserve
    // Seat.id identity for anything ShowtimeSeat may reference. Seats no longer
    // present in the new layout are soft-retired (INACTIVE), never deleted.
    //
    // colNumber is derived from the position's own physical columnIndex (stable
    // across edits), NOT a re-derived sequential "nth seat in row" count — a
    // sequential count would shift when an earlier position in the row is added
    // or removed, silently reassigning an existing (possibly already-booked)
    // Seat's identity onto a different physical position instead of retiring it.
    private void syncSeatsFromLayout(CinemaRoom room, List<RoomLayoutPosition> positions) {
        record SeatUnit(String rowLabel, int colNumber, SeatType seatType, String seatGroupId) {}

        Map<Integer, List<RoomLayoutPosition>> byRow = positions.stream()
                .filter(p -> p.getPositionType() == LayoutPositionType.SEAT)
                .collect(Collectors.groupingBy(RoomLayoutPosition::getRowIndex));

        List<SeatUnit> units = new ArrayList<>();
        for (List<RoomLayoutPosition> rowPositions : byRow.values()) {
            List<RoomLayoutPosition> sorted = rowPositions.stream()
                    .sorted(Comparator.comparing(RoomLayoutPosition::getColumnIndex))
                    .toList();
            Set<String> seenGroups = new HashSet<>();
            for (RoomLayoutPosition p : sorted) {
                if (p.getSeatType() == SeatType.COUPLE && p.getSeatGroupId() != null
                        && !seenGroups.add(p.getSeatGroupId())) {
                    continue; // second half of an already-counted couple pair
                }
                units.add(new SeatUnit(p.getRowLabel(), p.getColumnIndex() + 1, p.getSeatType(), p.getSeatGroupId()));
            }
        }

        List<Seat> existingSeats = seatRepository.findByCinemaRoomCinemaRoomId(room.getCinemaRoomId());
        Map<String, Seat> existingByCoord = existingSeats.stream()
                .collect(Collectors.toMap(s -> s.getRowLabel() + ":" + s.getColNumber(), s -> s, (a, b) -> a));

        Set<Long> keptSeatIds = new HashSet<>();
        List<Seat> toSave = new ArrayList<>();
        for (SeatUnit unit : units) {
            Seat seat = existingByCoord.get(unit.rowLabel() + ":" + unit.colNumber());
            if (seat == null) {
                seat = Seat.builder()
                        .cinemaRoom(room)
                        .rowLabel(unit.rowLabel())
                        .colNumber(unit.colNumber())
                        .price(DEFAULT_BASE_PRICE.multiply(BigDecimal.valueOf(unit.seatType().getPriceMultiplier())))
                        .build();
            }
            seat.setSeatType(unit.seatType());
            seat.setSeatCode(unit.rowLabel() + unit.colNumber());
            seat.setSeatGroupId(unit.seatGroupId());
            seat.setStatus(SeatStatus.ACTIVE);
            toSave.add(seat);
        }
        toSave = seatRepository.saveAll(toSave);
        for (Seat s : toSave) {
            if (s.getSeatId() != null) keptSeatIds.add(s.getSeatId());
        }

        List<Seat> toRetire = existingSeats.stream()
                .filter(s -> s.getSeatId() != null && !keptSeatIds.contains(s.getSeatId()))
                .filter(s -> s.getStatus() != SeatStatus.INACTIVE)
                .toList();
        for (Seat s : toRetire) {
            s.setStatus(SeatStatus.INACTIVE);
        }
        if (!toRetire.isEmpty()) {
            seatRepository.saveAll(toRetire);
        }
    }

    private void transitionRoom(CinemaRoom room, CinemaRoomStatus newStatus, String actor) {
        room.setStatus(newStatus);
        room.setUpdatedBy(actor);
        cinemaRoomRepository.save(room);
    }

    private CinemaRoom lockRoomForTransition(Long roomId) {
        return cinemaRoomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
    }

    /** Defense-in-depth re-check of persisted positions (mirrors validateIncomingPositions). */
    private void validateStoredPositions(List<RoomLayoutPosition> positions) {
        Map<String, List<RoomLayoutPosition>> coupleGroups = new HashMap<>();
        for (RoomLayoutPosition p : positions) {
            if (p.getPositionType() == LayoutPositionType.SEAT && p.getSeatType() == SeatType.COUPLE
                    && p.getSeatGroupId() != null) {
                coupleGroups.computeIfAbsent(p.getSeatGroupId(), k -> new ArrayList<>()).add(p);
            }
        }
        for (List<RoomLayoutPosition> group : coupleGroups.values()) {
            if (group.size() != 2) {
                throw new AppException(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID);
            }
            RoomLayoutPosition a = group.get(0);
            RoomLayoutPosition b = group.get(1);
            boolean sameRow = a.getRowIndex().equals(b.getRowIndex());
            boolean adjacent = Math.abs(a.getColumnIndex() - b.getColumnIndex()) == 1;
            if (!sameRow || !adjacent) {
                throw new AppException(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID);
            }
        }
    }

    /** QCVN 01:2013/BVHTTDL planning guard. This deliberately runs at Submit,
     * allowing incomplete drafts to be saved while preventing API clients from
     * bypassing the browser-side capacity check. Architectural and fire-safety
     * approval can still impose stricter limits. */
    private void validateRoomCapacityEnvelope(CinemaRoom room, List<RoomLayoutPosition> positions) {
        if (room.getLengthM() == null || room.getWidthM() == null || room.getClearHeightM() == null) {
            return; // Legacy rooms may predate wizard dimensions.
        }

        BigDecimal area = room.getLengthM().multiply(room.getWidthM());
        BigDecimal volume = area.multiply(room.getClearHeightM());
        int capacityByArea = area.divide(MIN_AREA_PER_PERSON_SQM, 0, RoundingMode.FLOOR).intValue();
        int capacityByVolume = volume.divide(MIN_VOLUME_PER_PERSON_CBM, 0, RoundingMode.FLOOR).intValue();
        int permittedCapacity = Math.min(capacityByArea, capacityByVolume);
        int plannedCapacity = positions.stream()
                .filter(position -> position.getPositionType() == LayoutPositionType.SEAT)
                .mapToInt(position -> 1)
                .sum();

        int physicalRows = (int) positions.stream().map(RoomLayoutPosition::getRowIndex).distinct().count();
        int widestPhysicalRow = positions.stream()
                .filter(position -> position.getPositionType() != LayoutPositionType.EMPTY_SPACE
                        && position.getPositionType() != LayoutPositionType.EXIT)
                .collect(Collectors.groupingBy(RoomLayoutPosition::getRowIndex, Collectors.counting()))
                .values().stream().mapToInt(Long::intValue).max().orElse(0);
        BigDecimal minimumWidth = MIN_SEAT_WIDTH_M.multiply(BigDecimal.valueOf(widestPhysicalRow));
        BigDecimal firstRowClearance = BigDecimal.ZERO;
        if (room.getScreenWidthM() != null && room.getScreenWidthM().compareTo(room.getWidthM()) <= 0) {
            firstRowClearance = room.getScreenWidthM().multiply(WIDE_SCREEN_FIRST_ROW_FACTOR);
        }
        BigDecimal minimumDepth = MIN_ROW_PITCH_M.multiply(BigDecimal.valueOf(physicalRows)).add(firstRowClearance);

        if (plannedCapacity > permittedCapacity
                || minimumWidth.compareTo(room.getWidthM()) > 0
                || minimumDepth.compareTo(room.getLengthM()) > 0) {
            throw new AppException(MovieErrorCode.ROOM_LAYOUT_EXCEEDS_ROOM_ENVELOPE);
        }
    }

    // ── Mapping helpers ──────────────────────────────────────────────────────

    private RoomLayoutSummaryResponse toSummary(RoomLayout layout) {
        return RoomLayoutSummaryResponse.builder()
                .roomLayoutId(layout.getRoomLayoutId())
                .version(layout.getVersion())
                .status(layout.getStatus().name())
                .personCapacity(layout.getPersonCapacity())
                .sellableUnitCount(layout.getSellableUnitCount())
                .submittedAt(layout.getSubmittedAt())
                .approvedAt(layout.getApprovedAt())
                .build();
    }

    RoomLayoutResponse toResponse(RoomLayout layout, List<RoomLayoutPosition> positions) {
        return RoomLayoutResponse.builder()
                .roomLayoutId(layout.getRoomLayoutId())
                .cinemaRoomId(layout.getCinemaRoom().getCinemaRoomId())
                .version(layout.getVersion())
                .status(layout.getStatus().name())
                .numberOfRows(layout.getNumberOfRows())
                .maxPositionsPerRow(layout.getMaxPositionsPerRow())
                .firstRowLabel(layout.getFirstRowLabel())
                .numberingDirection(layout.getNumberingDirection().name())
                .numberingPolicy(layout.getNumberingPolicy().name())
                .generatorTemplateCode(layout.getGeneratorTemplateCode())
                .generatorTemplateVersion(layout.getGeneratorTemplateVersion())
                .generationConfig(layout.getGenerationConfig())
                .personCapacity(layout.getPersonCapacity())
                .sellableUnitCount(layout.getSellableUnitCount())
                .submittedAt(layout.getSubmittedAt())
                .submittedBy(layout.getSubmittedBy())
                .approvedAt(layout.getApprovedAt())
                .approvedBy(layout.getApprovedBy())
                .rejectionReason(layout.getRejectionReason())
                .positions(positions.stream().map(this::toPositionResponse).toList())
                .createdAt(layout.getCreatedAt())
                .createdBy(layout.getCreatedBy())
                .updatedAt(layout.getUpdatedAt())
                .updatedBy(layout.getUpdatedBy())
                .build();
    }

    private LayoutPositionResponse toPositionResponse(RoomLayoutPosition p) {
        return LayoutPositionResponse.builder()
                .positionId(p.getPositionId())
                .rowIndex(p.getRowIndex())
                .columnIndex(p.getColumnIndex())
                .rowLabel(p.getRowLabel())
                .positionType(p.getPositionType().name())
                .seatNumber(p.getSeatNumber())
                .seatCode(p.getSeatCode())
                .seatType(p.getSeatType() != null ? p.getSeatType().name() : null)
                .seatGroupId(p.getSeatGroupId())
                .seatStatus(p.getSeatStatus().name())
                .manualOverride(p.getManualOverride())
                .build();
    }

    private void logAction(Long roomLayoutId, RoomLayoutAction action, String performedBy,
            LayoutStatus oldStatus, LayoutStatus newStatus, String note) {
        RoomLayoutAuditLog entry = RoomLayoutAuditLog.builder()
                .roomLayoutId(roomLayoutId)
                .action(action)
                .performedBy(performedBy)
                .oldStatus(oldStatus != null ? oldStatus.name() : null)
                .newStatus(newStatus != null ? newStatus.name() : null)
                .note(note)
                .timestamp(LocalDateTime.now(clock))
                .build();
        auditLogRepository.save(entry);
    }
}
