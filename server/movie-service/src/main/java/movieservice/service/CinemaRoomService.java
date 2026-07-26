package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CinemaRoomUpdateRequest;
import movieservice.dto.request.MaintenanceRequest;
import movieservice.dto.response.CinemaRoomFormatResponse;
import movieservice.dto.response.CinemaRoomMaintenanceResponse;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.entity.AudioFormat;
import movieservice.entity.AuditoriumClass;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.CinemaRoomFormat;
import movieservice.entity.CinemaRoomFormatId;
import movieservice.entity.CinemaRoomMaintenance;
import movieservice.entity.ProjectionTechnology;
import movieservice.entity.Resolution;
import movieservice.entity.RoomLayout;
import movieservice.entity.ScreeningFormat;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.enums.PresentationSystem;
import movieservice.enums.ShowTimeStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.AudioFormatRepository;
import movieservice.repository.AuditoriumClassRepository;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomFormatRepository;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.ProjectionTechnologyRepository;
import movieservice.repository.ResolutionRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.ScreeningFormatRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class CinemaRoomService {

    CinemaRoomRepository cinemaRoomRepository;
    CinemaRoomMaintenanceRepository maintenanceRepository;
    CinemaClusterRepository cinemaClusterRepository;
    ShowTimeRepository showTimeRepository;
    MovieMapper movieMapper;
    AuditLogService auditLogService;
    SeatRepository seatRepository;

    AuditoriumClassRepository auditoriumClassRepository;
    ProjectionTechnologyRepository projectionTechnologyRepository;
    ResolutionRepository resolutionRepository;
    AudioFormatRepository audioFormatRepository;
    RoomLayoutRepository roomLayoutRepository;
    RoomLayoutService roomLayoutService;
    CinemaRoomFormatRepository cinemaRoomFormatRepository;
    ScreeningFormatRepository screeningFormatRepository;

    // Room creation always goes through the wizard: a DRAFT room is created here, then the
    // real seat layout is authored via RoomLayoutController and only becomes bookable once a
    // layout version is submitted, approved by an admin, and activated. There used to be a
    // second "quick create" path (flat row/seat counts, straight to ACTIVE, no review) but it
    // let anyone bypass the same approval flow that cinema clusters already enforce — removed
    // so every room, like every cluster, is governed by one consistent maker-checker process.
    @Transactional
    public CinemaRoomResponse createCinemaRoom(CinemaRoomRequest request, String actor) {
        CinemaCluster cluster = cinemaClusterRepository.findById(request.getClusterId())
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        if (cluster.getStatus() != ClusterStatus.ACTIVE) {
            throw new AppException(MovieErrorCode.CLUSTER_NOT_ACTIVE);
        }

        if (cinemaRoomRepository.existsByCluster_ClusterIdAndCinemaRoomName(
                request.getClusterId(), request.getCinemaRoomName())) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NAME_EXISTED);
        }

        return createWizardRoom(request, cluster, actor);
    }

    // ── Wizard creation (Step 1 of the room wizard) ─────────────────────────
    // Creates a DRAFT room with no flat Seat generation — the real layout is
    // authored afterwards through RoomLayoutController and only synced into
    // Seat when a layout version is ACTIVATEd (see RoomLayoutService).
    private CinemaRoomResponse createWizardRoom(CinemaRoomRequest request, CinemaCluster cluster, String actor) {
        String roomCode = normalizeRoomCode(request.getRoomCode());
        if (cinemaRoomRepository.existsByCluster_ClusterIdAndRoomCode(request.getClusterId(), roomCode)) {
            throw new AppException(MovieErrorCode.ROOM_CODE_ALREADY_EXISTS);
        }

        validatePositiveDimension(request.getLengthM());
        validatePositiveDimension(request.getWidthM());
        validatePositiveDimension(request.getClearHeightM());
        validateScreenFitsRoom(request.getScreenWidthM(), request.getScreenHeightM(),
                request.getWidthM(), request.getClearHeightM());
        boolean supports2d = request.getSupports2d() == null || request.getSupports2d();
        boolean supports3d = request.getSupports3d() != null && request.getSupports3d();
        validatePresentationFormats(supports2d, supports3d);

        AuditoriumClass auditoriumClass = findActiveAuditoriumClass(request.getAuditoriumClassId());
        ProjectionTechnology projectionTechnology = request.getProjectionTechnologyId() != null
                ? findActiveProjectionTechnology(request.getProjectionTechnologyId()) : null;
        Resolution resolution = request.getResolutionId() != null
                ? findActiveResolution(request.getResolutionId()) : null;
        AudioFormat audioFormat = request.getAudioFormatId() != null
                ? findActiveAudioFormat(request.getAudioFormatId()) : null;

        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomName(request.getCinemaRoomName())
                .roomCode(roomCode)
                .totalSeatCapacity(0)
                // Placeholder until a RoomLayout is authored and activated (RoomLayoutService
                // .activate() overwrites both with the real values from the approved layout).
                .numberOfRows(1)
                .seatsPerRow(1)
                .status(CinemaRoomStatus.DRAFT)
                .lengthM(request.getLengthM())
                .widthM(request.getWidthM())
                .clearHeightM(request.getClearHeightM())
                .auditoriumClass(auditoriumClass)
                .projectionTechnology(projectionTechnology)
                .presentationSystem(request.getPresentationSystem() != null
                        ? request.getPresentationSystem() : PresentationSystem.STANDARD)
                .resolution(resolution)
                .screenWidthM(request.getScreenWidthM())
                .screenHeightM(request.getScreenHeightM())
                .supports2d(supports2d)
                .supports3d(supports3d)
                .audioFormat(audioFormat)
                .cluster(cluster)
                .createdBy(actor)
                .updatedBy(actor)
                .build();
        room = cinemaRoomRepository.save(room);
        syncRoomFormatCapabilities(room, actor);

        roomLayoutService.createInitialDraft(room, actor);

        auditLogService.logAction("SYSTEM", "Admin",
                "cinema_room:" + room.getCinemaRoomId(),
                "Created draft cinema room via wizard: " + room.getCinemaRoomName());

        return toDetailResponse(room);
    }

    // ── Read / update (wizard step 1/2) ─────────────────────────────────────

    /** Same DRAFT/PENDING_APPROVAL visibility split as getAllRooms() - a non-staff caller
     *  guessing a room ID gets the same CINEMA_ROOM_NOT_FOUND a nonexistent one would. */
    public CinemaRoomResponse getRoomDetail(Long roomId, Authentication authentication) {
        CinemaRoom room = cinemaRoomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        if (!isStaff(authentication) && !isPubliclyVisible(room.getStatus())) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
        }
        return toDetailResponse(room);
    }

    @Transactional
    public CinemaRoomResponse updateRoom(Long roomId, CinemaRoomUpdateRequest request, String actor) {
        CinemaRoom room = cinemaRoomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        if (room.getStatus() != CinemaRoomStatus.DRAFT) {
            throw new AppException(MovieErrorCode.ROOM_NOT_DRAFT);
        }

        if (request.getRoomCode() != null) {
            String roomCode = normalizeRoomCode(request.getRoomCode());
            if (cinemaRoomRepository.existsByCluster_ClusterIdAndRoomCodeAndCinemaRoomIdNot(
                    room.getCluster().getClusterId(), roomCode, roomId)) {
                throw new AppException(MovieErrorCode.ROOM_CODE_ALREADY_EXISTS);
            }
            room.setRoomCode(roomCode);
        }
        if (request.getCinemaRoomName() != null) {
            if (cinemaRoomRepository.existsByCluster_ClusterIdAndCinemaRoomNameAndCinemaRoomIdNot(
                    room.getCluster().getClusterId(), request.getCinemaRoomName(), roomId)) {
                throw new AppException(MovieErrorCode.CINEMA_ROOM_NAME_EXISTED);
            }
            room.setCinemaRoomName(request.getCinemaRoomName());
        }
        if (request.getAuditoriumClassId() != null) {
            room.setAuditoriumClass(findActiveAuditoriumClass(request.getAuditoriumClassId()));
        }
        if (request.getLengthM() != null) {
            validatePositiveDimension(request.getLengthM());
            room.setLengthM(request.getLengthM());
        }
        if (request.getWidthM() != null) {
            validatePositiveDimension(request.getWidthM());
            room.setWidthM(request.getWidthM());
        }
        if (request.getClearHeightM() != null) {
            validatePositiveDimension(request.getClearHeightM());
            room.setClearHeightM(request.getClearHeightM());
        }
        if (request.getProjectionTechnologyId() != null) {
            room.setProjectionTechnology(findActiveProjectionTechnology(request.getProjectionTechnologyId()));
        }
        if (request.getPresentationSystem() != null) {
            room.setPresentationSystem(request.getPresentationSystem());
        }
        if (request.getResolutionId() != null) {
            room.setResolution(findActiveResolution(request.getResolutionId()));
        }
        if (request.getScreenWidthM() != null) room.setScreenWidthM(request.getScreenWidthM());
        if (request.getScreenHeightM() != null) room.setScreenHeightM(request.getScreenHeightM());
        if (request.getSupports2d() != null) room.setSupports2d(request.getSupports2d());
        if (request.getSupports3d() != null) room.setSupports3d(request.getSupports3d());
        if (request.getAudioFormatId() != null) {
            room.setAudioFormat(findActiveAudioFormat(request.getAudioFormatId()));
        }

        validateScreenFitsRoom(room.getScreenWidthM(), room.getScreenHeightM(),
                room.getWidthM(), room.getClearHeightM());
        validatePresentationFormats(Boolean.TRUE.equals(room.getSupports2d()), Boolean.TRUE.equals(room.getSupports3d()));

        room.setUpdatedBy(actor);
        room = cinemaRoomRepository.save(room);
        syncRoomFormatCapabilities(room, actor);
        return toDetailResponse(room);
    }

    // ── Hard delete: only an unused DRAFT that never entered operations ────

    @Transactional
    public void deleteCinemaRoom(Long roomId, Authentication authentication) {
        CinemaRoom room = cinemaRoomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));

        String actor = authenticatedActor(authentication);
        boolean admin = hasRole(authentication, "ROLE_ADMIN");
        boolean draftCreator = hasRole(authentication, "ROLE_EMPLOYEE")
                && actor.equals(room.getCreatedBy());
        if (!admin && !draftCreator) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_DELETE_FORBIDDEN);
        }

        if (room.getStatus() != CinemaRoomStatus.DRAFT) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_DELETE_NOT_ALLOWED);
        }

        if (showTimeRepository.existsByCinemaRoomCinemaRoomId(roomId)) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_HAS_SHOWTIMES);
        }

        List<RoomLayout> layouts = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdOrderByVersionDesc(roomId);
        boolean hasWorkflowHistory = layouts.stream().anyMatch(layout ->
                layout.getStatus() != LayoutStatus.DRAFT
                        || layout.getSubmittedAt() != null
                        || layout.getApprovedAt() != null);
        if (hasWorkflowHistory
                || seatRepository.existsByCinemaRoomCinemaRoomId(roomId)
                || maintenanceRepository.existsByCinemaRoom_CinemaRoomId(roomId)) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_DELETE_NOT_ALLOWED);
        }

        // Draft positions are owned by their layout and cascade from RoomLayout.
        // Layout audit rows intentionally keep their scalar layout id as tombstone history.
        auditLogService.logAction(actor, primaryRole(authentication),
                "cinema_room:" + roomId,
                "Permanently deleted unused draft cinema room: " + room.getCinemaRoomName());
        roomLayoutRepository.deleteAll(layouts);
        cinemaRoomRepository.delete(room);
    }

    private String authenticatedActor(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_DELETE_FORBIDDEN);
        }
        return authentication.getName();
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication != null && authentication.getAuthorities() != null
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> role.equals(authority.getAuthority()));
    }

    private String primaryRole(Authentication authentication) {
        if (hasRole(authentication, "ROLE_ADMIN")) return "ADMIN";
        if (hasRole(authentication, "ROLE_EMPLOYEE")) return "EMPLOYEE";
        return "AUTHENTICATED_USER";
    }

    public CinemaRoom findByCinemaRoom(Long cinemaId) {
        return cinemaRoomRepository.findByCinemaRoomId(cinemaId);
    }

    /**
     * `[Backend] Enforce movie-service endpoint authorization matrix`: DRAFT/PENDING_APPROVAL
     * rooms are an in-progress wizard workflow with nothing bookable yet - hidden from
     * non-staff callers, same visibility split already used for cinema clusters. Every other
     * status (APPROVED onward) is legitimate operational info a customer may reasonably see.
     */
    public List<CinemaRoomResponse> getAllRooms(Long clusterId, Authentication authentication) {
        List<CinemaRoom> rooms = (clusterId != null)
                ? cinemaRoomRepository.findByCluster_ClusterId(clusterId)
                : cinemaRoomRepository.findAll();
        if (!isStaff(authentication)) {
            rooms = rooms.stream().filter(r -> isPubliclyVisible(r.getStatus())).toList();
        }
        return rooms.stream().map(this::toDetailResponse).toList();
    }

    private boolean isStaff(Authentication authentication) {
        return hasRole(authentication, "ROLE_ADMIN") || hasRole(authentication, "ROLE_EMPLOYEE");
    }

    private boolean isPubliclyVisible(CinemaRoomStatus status) {
        return status != CinemaRoomStatus.DRAFT && status != CinemaRoomStatus.PENDING_APPROVAL;
    }

    // ── Maintenance ───────────────────────────────────────────

    @Transactional
    public CinemaRoomMaintenanceResponse reportMaintenance(Long roomId,
                                                    MaintenanceRequest request,
                                                    String createdBy) {
        CinemaRoom room = cinemaRoomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));

        CinemaRoomMaintenance maintenance = CinemaRoomMaintenance.builder()
                .cinemaRoom(room)
                .reason(request.getReason())
                .severity(request.getSeverity())
                .startedAt(request.getStartedAt() != null ? request.getStartedAt() : LocalDateTime.now())
                .resolved(false)
                .createdBy(createdBy)
                .build();

        maintenanceRepository.save(maintenance);

        room.setStatus(CinemaRoomStatus.TEMPORARILY_UNAVAILABLE);
        room.setMaintenanceNote(request.getReason());
        cinemaRoomRepository.save(room);

        log.info("Room {} set to TEMPORARILY_UNAVAILABLE — reason: {}", roomId, request.getReason());
        return toMaintenanceResponse(maintenance);
    }

    @Transactional
    public CinemaRoomMaintenanceResponse resolveMaintenance(Long maintenanceId, String resolutionNote, String resolvedBy) {
        CinemaRoomMaintenance maintenance = maintenanceRepository.findById(maintenanceId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));

        maintenance.setResolved(true);
        maintenance.setResolvedAt(LocalDateTime.now());
        maintenance.setResolutionNote(resolutionNote);
        maintenanceRepository.save(maintenance);

        CinemaRoom room = maintenance.getCinemaRoom();
        boolean noOpenMaintenanceRemains = maintenanceRepository
                .findByCinemaRoom_CinemaRoomIdAndResolvedFalse(room.getCinemaRoomId())
                .isEmpty();

        if (noOpenMaintenanceRemains) {
            room.setStatus(CinemaRoomStatus.ACTIVE);
            room.setMaintenanceNote(null);
            cinemaRoomRepository.save(room);
            log.info("Room {} restored to ACTIVE", room.getCinemaRoomId());
        }

        return toMaintenanceResponse(maintenance);
    }

    /// Lịch sử đầy đủ (đã xử lý lẫn còn mở) - trước đây CinemaRoomMaintenanceRepository đã có
    /// sẵn query này nhưng không có endpoint/service method nào expose ra ngoài, nên UI không
    /// bao giờ biết được phòng có sự cố nào đã/đang xảy ra ngoài dòng maintenanceNote hiện tại.
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<CinemaRoomMaintenanceResponse> listMaintenance(Long roomId) {
        return maintenanceRepository.findByCinemaRoom_CinemaRoomId(roomId).stream()
                .sorted(java.util.Comparator.comparing(CinemaRoomMaintenance::getStartedAt).reversed())
                .map(this::toMaintenanceResponse)
                .toList();
    }

    private CinemaRoomMaintenanceResponse toMaintenanceResponse(CinemaRoomMaintenance maintenance) {
        return CinemaRoomMaintenanceResponse.builder()
                .maintenanceId(maintenance.getMaintenanceId())
                .cinemaRoomId(maintenance.getCinemaRoom().getCinemaRoomId())
                .reason(maintenance.getReason())
                .severity(maintenance.getSeverity())
                .startedAt(maintenance.getStartedAt())
                .resolvedAt(maintenance.getResolvedAt())
                .resolved(maintenance.getResolved())
                .resolutionNote(maintenance.getResolutionNote())
                .createdBy(maintenance.getCreatedBy())
                .createdAt(maintenance.getCreatedAt())
                .build();
    }

    /**
     * The only manual transitions this endpoint is allowed to make - ACTIVE / SUSPENDED / CLOSED
     * cycling among each other. Everything else has its own dedicated flow that enforces real
     * preconditions and its own audit trail, and would be silently bypassed if this generic PATCH
     * could also reach it:
     *   - DRAFT / PENDING_APPROVAL / APPROVED / ACTIVE (as a wizard target) are owned exclusively
     *     by RoomLayoutService.submit()/approve()/reject()/activate() - jumping straight to ACTIVE
     *     from here would skip layout review entirely (the gap this fixes).
     *   - MAINTENANCE / TEMPORARILY_UNAVAILABLE are owned by reportMaintenance(), which captures a
     *     reason/severity; resolveMaintenance() is the only way back out.
     *   - RETIRED is permanent and one-way - see retireCinemaRoom() below, which has its own
     *     no-future-showtimes precondition that doesn't belong on every other status change.
     */
    private static final Map<CinemaRoomStatus, Set<CinemaRoomStatus>> ALLOWED_MANUAL_STATUS_TRANSITIONS = Map.of(
            CinemaRoomStatus.ACTIVE, Set.of(CinemaRoomStatus.SUSPENDED, CinemaRoomStatus.CLOSED),
            CinemaRoomStatus.SUSPENDED, Set.of(CinemaRoomStatus.ACTIVE, CinemaRoomStatus.CLOSED),
            CinemaRoomStatus.CLOSED, Set.of(CinemaRoomStatus.ACTIVE, CinemaRoomStatus.SUSPENDED));

    @Transactional
    public CinemaRoomResponse setRoomStatus(Long roomId, CinemaRoomStatus newStatus, Authentication authentication) {
        CinemaRoom room = cinemaRoomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        CinemaRoomStatus oldStatus = room.getStatus();

        Set<CinemaRoomStatus> allowedTargets = ALLOWED_MANUAL_STATUS_TRANSITIONS.get(oldStatus);
        if (allowedTargets == null || !allowedTargets.contains(newStatus)) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_STATUS_TRANSITION_INVALID);
        }

        String actor = authenticatedActor(authentication);
        room.setStatus(newStatus);
        room.setUpdatedBy(actor);
        room = cinemaRoomRepository.save(room);

        auditLogService.logAction(actor, primaryRole(authentication),
                "cinema_room:" + roomId,
                "Status changed: " + oldStatus + " -> " + newStatus);

        return movieMapper.toCinemaRoomResponse(room);
    }

    /**
     * Permanent decommission - terminal and one-way, so it gets its own method rather than
     * being just another target of setRoomStatus(). Only reachable from an operational status
     * that has already left the wizard workflow (ACTIVE/SUSPENDED/CLOSED); a room still under
     * an open maintenance incident must be resolved first (see resolveMaintenance()), and a room
     * still mid-wizard (DRAFT/PENDING_APPROVAL/APPROVED) should go through deleteCinemaRoom()
     * instead if it was never actually put into service. Blocked while any future scheduled/
     * on-sale showtime exists - the same guard RoomLayoutService.activate() applies before
     * superseding a layout - so a room can never disappear out from under a sold ticket.
     */
    @Transactional
    public CinemaRoomResponse retireCinemaRoom(Long roomId, String note, Authentication authentication) {
        CinemaRoom room = cinemaRoomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        CinemaRoomStatus oldStatus = room.getStatus();

        boolean retirable = oldStatus == CinemaRoomStatus.ACTIVE
                || oldStatus == CinemaRoomStatus.SUSPENDED
                || oldStatus == CinemaRoomStatus.CLOSED;
        if (!retirable) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_STATUS_TRANSITION_INVALID);
        }

        boolean hasFutureShowtimes = showTimeRepository
                .existsByCinemaRoomCinemaRoomIdAndStatusInAndShowDateGreaterThanEqual(
                        roomId, List.of(ShowTimeStatus.SCHEDULED, ShowTimeStatus.ON_SALE), LocalDate.now());
        if (hasFutureShowtimes) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_HAS_FUTURE_SHOWTIMES);
        }

        String actor = authenticatedActor(authentication);
        room.setStatus(CinemaRoomStatus.RETIRED);
        room.setUpdatedBy(actor);
        room = cinemaRoomRepository.save(room);

        auditLogService.logAction(actor, primaryRole(authentication),
                "cinema_room:" + roomId,
                "Retired (permanent): " + oldStatus + " -> RETIRED"
                        + (note != null && !note.isBlank() ? " — " + note : ""));

        return movieMapper.toCinemaRoomResponse(room);
    }

    // ── Validation helpers ───────────────────────────────────────────────────

    private String normalizeRoomCode(String rawRoomCode) {
        if (rawRoomCode == null || rawRoomCode.isBlank()) {
            throw new AppException(MovieErrorCode.ROOM_CODE_REQUIRED);
        }
        return rawRoomCode.trim().toUpperCase();
    }

    private void validatePositiveDimension(BigDecimal value) {
        if (value == null || value.signum() <= 0) {
            throw new AppException(MovieErrorCode.ROOM_DIMENSION_INVALID);
        }
    }

    private void validateScreenFitsRoom(BigDecimal screenWidthM, BigDecimal screenHeightM,
            BigDecimal roomWidthM, BigDecimal roomClearHeightM) {
        if (screenWidthM != null && roomWidthM != null && screenWidthM.compareTo(roomWidthM) > 0) {
            throw new AppException(MovieErrorCode.ROOM_SCREEN_EXCEEDS_ROOM_DIMENSIONS);
        }
        if (screenHeightM != null && roomClearHeightM != null && screenHeightM.compareTo(roomClearHeightM) > 0) {
            throw new AppException(MovieErrorCode.ROOM_SCREEN_EXCEEDS_ROOM_DIMENSIONS);
        }
    }

    private void validatePresentationFormats(boolean supports2d, boolean supports3d) {
        if (!supports2d && !supports3d) {
            throw new AppException(MovieErrorCode.ROOM_PRESENTATION_FORMAT_REQUIRED);
        }
    }

    /**
     * Format codes the wizard fields (supports2d/supports3d/presentationSystem) can ever
     * derive. Anything else in the screening_format catalog (e.g. a format an admin added
     * later through Manage Formats with no matching wizard field) is out of scope for
     * syncRoomFormatCapabilities() and is instead controlled directly via
     * setManualRoomFormat()/listRoomFormats() below - the sync loop must never disable
     * those rows just because they weren't in this run's derivedCodes.
     */
    private static final Set<String> AUTO_MANAGED_FORMAT_CODES = Set.of("2D", "3D", "IMAX", "SCREENX", "ATMOS", "4DX");

    /**
     * The auto-showtime engine reads cinema_room_format exclusively - never
     * supports2d/supports3d/presentationSystem directly - so without this sync
     * every room the wizard creates or edits would have zero capability rows
     * and could never be picked for automatic scheduling. Keeps existing rows
     * (audit trail) and only flips `enabled` rather than deleting when a format
     * is no longer derived (e.g. 3D unchecked on an edit).
     */
    private void syncRoomFormatCapabilities(CinemaRoom room, String actor) {
        Set<String> derivedCodes = new LinkedHashSet<>();
        if (Boolean.TRUE.equals(room.getSupports2d())) derivedCodes.add("2D");
        if (Boolean.TRUE.equals(room.getSupports3d())) derivedCodes.add("3D");
        if (room.getPresentationSystem() != null) {
            switch (room.getPresentationSystem()) {
                case IMAX -> derivedCodes.add("IMAX");
                case SCREENX -> derivedCodes.add("SCREENX");
                case DOLBY_CINEMA -> derivedCodes.add("ATMOS");
                case FOUR_DX -> derivedCodes.add("4DX");
                case STANDARD -> { /* contributes nothing beyond supports2d/3d */ }
            }
        }

        Map<Integer, CinemaRoomFormat> existingByFormatId = cinemaRoomFormatRepository
                .findByCinemaRoom_CinemaRoomId(room.getCinemaRoomId()).stream()
                .collect(Collectors.toMap(crf -> crf.getScreeningFormat().getFormatId(), Function.identity()));

        for (String code : derivedCodes) {
            Optional<ScreeningFormat> format = screeningFormatRepository.findByFormatCode(code);
            if (format.isEmpty()) continue;
            CinemaRoomFormat existing = existingByFormatId.remove(format.get().getFormatId());
            if (existing != null) {
                if (!Boolean.TRUE.equals(existing.getEnabled())) {
                    existing.setEnabled(true);
                    existing.setUpdatedBy(actor);
                    cinemaRoomFormatRepository.save(existing);
                }
            } else {
                cinemaRoomFormatRepository.save(CinemaRoomFormat.builder()
                        .id(new CinemaRoomFormatId(room.getCinemaRoomId(), format.get().getFormatId()))
                        .cinemaRoom(room)
                        .screeningFormat(format.get())
                        .enabled(true)
                        .createdBy(actor)
                        .updatedBy(actor)
                        .build());
            }
        }

        // Anything left is either (a) a capability the current wizard fields no longer derive
        // (e.g. 3D was unchecked) - disable rather than delete to keep history - or (b) a
        // manually-managed format (not in AUTO_MANAGED_FORMAT_CODES) that this sync has no
        // opinion on and must leave untouched.
        for (CinemaRoomFormat stale : existingByFormatId.values()) {
            if (!AUTO_MANAGED_FORMAT_CODES.contains(stale.getScreeningFormat().getFormatCode())) continue;
            if (Boolean.TRUE.equals(stale.getEnabled())) {
                stale.setEnabled(false);
                stale.setUpdatedBy(actor);
                cinemaRoomFormatRepository.save(stale);
            }
        }
    }

    // ── Per-room format capabilities (cinema_room_format) ───────────────────

    /** Every active catalog format, merged with this room's current cinema_room_format rows -
     *  the view the maintenance-UI-style panel needs to show "what this room actually supports"
     *  without the caller reasoning through supports2d/supports3d/presentationSystem themselves. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<CinemaRoomFormatResponse> listRoomFormats(Long roomId) {
        if (!cinemaRoomRepository.existsById(roomId)) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
        }
        Map<Integer, CinemaRoomFormat> existingByFormatId = cinemaRoomFormatRepository
                .findByCinemaRoom_CinemaRoomId(roomId).stream()
                .collect(Collectors.toMap(crf -> crf.getScreeningFormat().getFormatId(), Function.identity()));

        return screeningFormatRepository.findAll().stream()
                .filter(format -> "ACTIVE".equals(format.getStatus()))
                .map(format -> {
                    CinemaRoomFormat existing = existingByFormatId.get(format.getFormatId());
                    return CinemaRoomFormatResponse.builder()
                            .formatId(format.getFormatId())
                            .formatCode(format.getFormatCode())
                            .formatName(format.getFormatName())
                            .surcharge(format.getSurcharge())
                            .enabled(existing != null && Boolean.TRUE.equals(existing.getEnabled()))
                            .managedAutomatically(AUTO_MANAGED_FORMAT_CODES.contains(format.getFormatCode()))
                            .build();
                })
                .sorted(java.util.Comparator.comparing(CinemaRoomFormatResponse::getFormatCode))
                .toList();
    }

    /** Manual override for a format cinema_room_format has no wizard field for (anything outside
     *  AUTO_MANAGED_FORMAT_CODES - e.g. a new format an admin just added via Manage Formats).
     *  Rejects the 2D/3D/IMAX/SCREENX/ATMOS/4DX codes: those must stay single-source-of-truth
     *  from supports2d/supports3d/presentationSystem, otherwise the next room save would silently
     *  flip them back via syncRoomFormatCapabilities() and the toggle would look broken. */
    @Transactional
    public CinemaRoomFormatResponse setManualRoomFormat(Long roomId, Integer formatId, boolean enabled, String actor) {
        CinemaRoom room = cinemaRoomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        ScreeningFormat format = screeningFormatRepository.findById(formatId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        if (AUTO_MANAGED_FORMAT_CODES.contains(format.getFormatCode())) {
            throw new AppException(MovieErrorCode.ROOM_FORMAT_MANAGED_AUTOMATICALLY);
        }

        CinemaRoomFormat existing = cinemaRoomFormatRepository
                .findByCinemaRoom_CinemaRoomIdAndScreeningFormat_FormatId(roomId, formatId)
                .orElse(null);
        if (existing != null) {
            existing.setEnabled(enabled);
            existing.setUpdatedBy(actor);
            existing = cinemaRoomFormatRepository.save(existing);
        } else {
            existing = cinemaRoomFormatRepository.save(CinemaRoomFormat.builder()
                    .id(new CinemaRoomFormatId(roomId, formatId))
                    .cinemaRoom(room)
                    .screeningFormat(format)
                    .enabled(enabled)
                    .createdBy(actor)
                    .updatedBy(actor)
                    .build());
        }

        return CinemaRoomFormatResponse.builder()
                .formatId(format.getFormatId())
                .formatCode(format.getFormatCode())
                .formatName(format.getFormatName())
                .surcharge(format.getSurcharge())
                .enabled(existing.getEnabled())
                .managedAutomatically(false)
                .build();
    }

    private AuditoriumClass findActiveAuditoriumClass(Integer id) {
        AuditoriumClass entity = auditoriumClassRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.AUDITORIUM_CLASS_NOT_FOUND));
        if (!Boolean.TRUE.equals(entity.getActive())) {
            throw new AppException(MovieErrorCode.AUDITORIUM_CLASS_NOT_FOUND);
        }
        return entity;
    }

    private ProjectionTechnology findActiveProjectionTechnology(Integer id) {
        ProjectionTechnology entity = projectionTechnologyRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.PROJECTION_TECHNOLOGY_NOT_FOUND));
        if (!Boolean.TRUE.equals(entity.getActive())) {
            throw new AppException(MovieErrorCode.PROJECTION_TECHNOLOGY_NOT_FOUND);
        }
        return entity;
    }

    private Resolution findActiveResolution(Integer id) {
        Resolution entity = resolutionRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.RESOLUTION_NOT_FOUND));
        if (!Boolean.TRUE.equals(entity.getActive())) {
            throw new AppException(MovieErrorCode.RESOLUTION_NOT_FOUND);
        }
        return entity;
    }

    private AudioFormat findActiveAudioFormat(Integer id) {
        AudioFormat entity = audioFormatRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.AUDIO_FORMAT_NOT_FOUND));
        if (!Boolean.TRUE.equals(entity.getActive())) {
            throw new AppException(MovieErrorCode.AUDIO_FORMAT_NOT_FOUND);
        }
        return entity;
    }

    // ── Response enrichment ──────────────────────────────────────────────────

    CinemaRoomResponse toDetailResponse(CinemaRoom room) {
        CinemaRoomResponse res = movieMapper.toCinemaRoomResponse(room);

        if (room.getLengthM() != null && room.getWidthM() != null) {
            res.setAreaSqm(room.getLengthM().multiply(room.getWidthM()));
        }
        if (room.getScreenWidthM() != null && room.getScreenHeightM() != null
                && room.getScreenHeightM().signum() != 0) {
            res.setScreenAspectRatio(room.getScreenWidthM()
                    .divide(room.getScreenHeightM(), 4, java.math.RoundingMode.HALF_UP));
        }

        AuditoriumClass ac = room.getAuditoriumClass();
        if (ac != null) {
            res.setAuditoriumClassId(ac.getClassId());
            res.setAuditoriumClassCode(ac.getClassCode());
            res.setAuditoriumClassName(ac.getClassName());
        }
        ProjectionTechnology pt = room.getProjectionTechnology();
        if (pt != null) {
            res.setProjectionTechnologyId(pt.getTechId());
            res.setProjectionTechnologyCode(pt.getTechCode());
            res.setProjectionTechnologyName(pt.getTechName());
        }
        Resolution r = room.getResolution();
        if (r != null) {
            res.setResolutionId(r.getResolutionId());
            res.setResolutionCode(r.getResolutionCode());
        }
        AudioFormat af = room.getAudioFormat();
        if (af != null) {
            res.setAudioFormatId(af.getAudioFormatId());
            res.setAudioFormatCode(af.getFormatCode());
        }

        Optional<RoomLayout> activeLayout = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdAndStatus(room.getCinemaRoomId(), LayoutStatus.ACTIVE);
        RoomLayout latest = activeLayout.orElseGet(() ->
                roomLayoutRepository.findByCinemaRoomCinemaRoomIdOrderByVersionDesc(room.getCinemaRoomId())
                        .stream().findFirst().orElse(null));
        if (latest != null) {
            res.setActiveLayout(movieservice.dto.response.RoomLayoutSummaryResponse.builder()
                    .roomLayoutId(latest.getRoomLayoutId())
                    .version(latest.getVersion())
                    .status(latest.getStatus().name())
                    .personCapacity(latest.getPersonCapacity())
                    .sellableUnitCount(latest.getSellableUnitCount())
                    .submittedAt(latest.getSubmittedAt())
                    .approvedAt(latest.getApprovedAt())
                    .build());
        }

        return res;
    }
}
