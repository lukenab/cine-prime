package movieservice.service.autoshowtime;

import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.MovieScreeningVersion;
import movieservice.entity.RoomLayout;
import movieservice.entity.ScreeningFormat;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.repository.CinemaRoomFormatRepository;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.RoomLayoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SchedulingOperationalConstraintServiceTest {

    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock CinemaRoomFormatRepository roomFormatRepository;
    @Mock CinemaRoomMaintenanceRepository maintenanceRepository;
    @Mock CinemaRoomRepository roomRepository;
    @Mock MovieScreeningVersionRepository screeningVersionRepository;

    private SchedulingOperationalConstraintService service;
    private CinemaRoom room;
    private MovieScreeningVersion version;
    private OffsetDateTime startAt;
    private OffsetDateTime endAt;

    @BeforeEach
    void setUp() {
        service = new SchedulingOperationalConstraintService(
                roomLayoutRepository, roomFormatRepository, maintenanceRepository,
                roomRepository, screeningVersionRepository);

        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(10L)
                .status(ClusterStatus.ACTIVE)
                .timezone("Asia/Ho_Chi_Minh")
                .build();
        room = CinemaRoom.builder()
                .cinemaRoomId(20L)
                .cluster(cluster)
                .status(CinemaRoomStatus.ACTIVE)
                .totalSeatCapacity(100)
                .build();
        ScreeningFormat format = ScreeningFormat.builder().formatId(30).formatCode("2D").build();
        version = MovieScreeningVersion.builder()
                .screeningVersionId(40L)
                .format(format)
                .build();
        startAt = OffsetDateTime.parse("2026-07-24T18:00:00+07:00");
        endAt = OffsetDateTime.parse("2026-07-24T20:00:00+07:00");

        RoomLayout activeLayout = RoomLayout.builder()
                .status(LayoutStatus.ACTIVE)
                .personCapacity(100)
                .sellableUnitCount(95)
                .build();
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdAndStatus(20L, LayoutStatus.ACTIVE))
                .thenReturn(Optional.of(activeLayout));
        when(roomFormatRepository
                .existsByCinemaRoom_CinemaRoomIdAndScreeningFormat_FormatIdAndEnabledTrue(20L, 30))
                .thenReturn(true);
    }

    @Test
    void allowsOnlyOperationallySellableRoom() {
        when(maintenanceRepository.existsBlockingMaintenance(eq(20L), any(), any()))
                .thenReturn(false);

        assertThat(service.evaluate(room, version, startAt, endAt).eligible()).isTrue();
    }

    @Test
    void blocksMaintenanceThatOverlapsTheCandidateWindow() {
        when(maintenanceRepository.existsBlockingMaintenance(eq(20L), any(), any()))
                .thenReturn(true);

        SchedulingEligibilityResult result = service.evaluate(room, version, startAt, endAt);

        assertThat(result.eligible()).isFalse();
        assertThat(result.reasonCodes())
                .contains(SchedulingOperationalConstraintService.ROOM_MAINTENANCE_CONFLICT);
    }

    @Test
    void blocksRoomWithoutAnActiveSellableLayout() {
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdAndStatus(20L, LayoutStatus.ACTIVE))
                .thenReturn(Optional.empty());
        when(maintenanceRepository.existsBlockingMaintenance(eq(20L), any(), any()))
                .thenReturn(false);

        SchedulingEligibilityResult result = service.evaluate(room, version, startAt, endAt);

        assertThat(result.eligible()).isFalse();
        assertThat(result.reasonCodes())
                .contains(SchedulingOperationalConstraintService.ROOM_LAYOUT_NOT_ACTIVE);
    }
}
