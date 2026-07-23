package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaRoom;
import movieservice.entity.MovieScreeningVersion;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.repository.CinemaRoomFormatRepository;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Operational guards shared by preview, review and publish. CandidateFactory still performs
 * bulk filtering for throughput; this service is the authoritative last-mile recheck so a
 * room cannot become unavailable between generation and publication.
 */
@Service
@RequiredArgsConstructor
public class SchedulingOperationalConstraintService {
    private static final ZoneId DEFAULT_BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    public static final String CLUSTER_NOT_ACTIVE = "CLUSTER_NOT_ACTIVE";
    public static final String ROOM_NOT_ACTIVE = "ROOM_NOT_ACTIVE";
    public static final String ROOM_CAPACITY_NOT_SELLABLE = "ROOM_CAPACITY_NOT_SELLABLE";
    public static final String ROOM_LAYOUT_NOT_ACTIVE = "ROOM_LAYOUT_NOT_ACTIVE";
    public static final String ROOM_FORMAT_NOT_SUPPORTED = "ROOM_FORMAT_NOT_SUPPORTED";
    public static final String ROOM_MAINTENANCE_CONFLICT = "ROOM_MAINTENANCE_CONFLICT";

    private final RoomLayoutRepository roomLayoutRepository;
    private final CinemaRoomFormatRepository roomFormatRepository;
    private final CinemaRoomMaintenanceRepository maintenanceRepository;
    private final CinemaRoomRepository cinemaRoomRepository;
    private final MovieScreeningVersionRepository screeningVersionRepository;

    @Transactional(readOnly = true)
    public SchedulingEligibilityResult evaluate(ShowtimeCandidate candidate) {
        CinemaRoom room = cinemaRoomRepository.findById(candidate.getCinemaRoomId()).orElse(null);
        MovieScreeningVersion version = screeningVersionRepository
                .findById(candidate.getScreeningVersionId()).orElse(null);
        if (room == null || version == null) {
            return SchedulingEligibilityResult.denied(List.of(
                    room == null ? ROOM_NOT_ACTIVE : ROOM_FORMAT_NOT_SUPPORTED));
        }
        return evaluate(room, version, candidate.temporalStartAt(), candidate.temporalEndAt());
    }

    @Transactional(readOnly = true)
    public SchedulingEligibilityResult evaluate(
            CinemaRoom room,
            MovieScreeningVersion screeningVersion,
            OffsetDateTime startAt,
            OffsetDateTime endAt
    ) {
        List<String> reasons = new ArrayList<>();

        if (room.getCluster() == null || room.getCluster().getStatus() != ClusterStatus.ACTIVE) {
            reasons.add(CLUSTER_NOT_ACTIVE);
        }
        if (room.getStatus() != CinemaRoomStatus.ACTIVE) {
            reasons.add(ROOM_NOT_ACTIVE);
        }
        if (room.getTotalSeatCapacity() == null || room.getTotalSeatCapacity() <= 0) {
            reasons.add(ROOM_CAPACITY_NOT_SELLABLE);
        }

        boolean activeSellableLayout = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdAndStatus(room.getCinemaRoomId(), LayoutStatus.ACTIVE)
                .filter(layout -> layout.getPersonCapacity() != null && layout.getPersonCapacity() > 0)
                .filter(layout -> layout.getSellableUnitCount() != null && layout.getSellableUnitCount() > 0)
                .isPresent();
        if (!activeSellableLayout) {
            reasons.add(ROOM_LAYOUT_NOT_ACTIVE);
        }

        Integer formatId = screeningVersion == null || screeningVersion.getFormat() == null
                ? null : screeningVersion.getFormat().getFormatId();
        if (formatId == null || !roomFormatRepository
                .existsByCinemaRoom_CinemaRoomIdAndScreeningFormat_FormatIdAndEnabledTrue(
                        room.getCinemaRoomId(), formatId)) {
            reasons.add(ROOM_FORMAT_NOT_SUPPORTED);
        }

        if (startAt != null && endAt != null && room.getCluster() != null) {
            ZoneId zone = room.getCluster().getTimezone() == null
                    ? DEFAULT_BUSINESS_ZONE
                    : ZoneId.of(room.getCluster().getTimezone());
            if (maintenanceRepository.existsBlockingMaintenance(
                    room.getCinemaRoomId(),
                    startAt.atZoneSameInstant(zone).toLocalDateTime(),
                    endAt.atZoneSameInstant(zone).toLocalDateTime())) {
                reasons.add(ROOM_MAINTENANCE_CONFLICT);
            }
        }

        return reasons.isEmpty()
                ? SchedulingEligibilityResult.allowed()
                : SchedulingEligibilityResult.denied(reasons);
    }
}
