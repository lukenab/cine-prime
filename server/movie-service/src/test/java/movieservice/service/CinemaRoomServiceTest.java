package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.entity.AuditoriumClass;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.enums.ClusterStatus;
import movieservice.enums.PresentationSystem;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.AudioFormatRepository;
import movieservice.repository.AuditoriumClassRepository;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.ProjectionTechnologyRepository;
import movieservice.repository.ResolutionRepository;
import movieservice.repository.RoomLayoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import org.mockito.ArgumentCaptor;

@ExtendWith(MockitoExtension.class)
class CinemaRoomServiceTest {

    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock CinemaRoomMaintenanceRepository maintenanceRepository;
    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock movieservice.repository.ShowTimeRepository showTimeRepository;
    @Mock MovieMapper movieMapper;
    @Mock AuditLogService auditLogService;
    @Mock SeatService seatService;
    @Mock AuditoriumClassRepository auditoriumClassRepository;
    @Mock ProjectionTechnologyRepository projectionTechnologyRepository;
    @Mock ResolutionRepository resolutionRepository;
    @Mock AudioFormatRepository audioFormatRepository;
    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock RoomLayoutService roomLayoutService;

    @InjectMocks
    CinemaRoomService cinemaRoomService;

    @BeforeEach
    void setUpActiveCluster() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(1L)
                .status(ClusterStatus.ACTIVE)
                .build();
        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
    }

    private CinemaRoomRequest.CinemaRoomRequestBuilder wizardRequest() {
        return CinemaRoomRequest.builder()
                .cinemaRoomName("Room W1")
                .roomCode("R01")
                .auditoriumClassId(1)
                .lengthM(new BigDecimal("20"))
                .widthM(new BigDecimal("15"))
                .clearHeightM(new BigDecimal("6"))
                .clusterId(1L);
    }

    @Test
    void wizardCreate_rejectsBlankRoomCode() {
        CinemaRoomRequest request = wizardRequest().roomCode("  ").build();

        AppException ex = assertThrows(AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request, "tester"));
        assertEquals(MovieErrorCode.ROOM_CODE_REQUIRED, ex.getErrorCode());
    }

    @Test
    void wizardCreate_rejectsDuplicateRoomCode() {
        when(cinemaRoomRepository.existsByCluster_ClusterIdAndRoomCode(1L, "R01")).thenReturn(true);
        CinemaRoomRequest request = wizardRequest().build();

        AppException ex = assertThrows(AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request, "tester"));
        assertEquals(MovieErrorCode.ROOM_CODE_ALREADY_EXISTS, ex.getErrorCode());
    }

    @Test
    void wizardCreate_rejectsNonPositiveDimension() {
        CinemaRoomRequest request = wizardRequest().lengthM(BigDecimal.ZERO).build();

        AppException ex = assertThrows(AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request, "tester"));
        assertEquals(MovieErrorCode.ROOM_DIMENSION_INVALID, ex.getErrorCode());
    }

    @Test
    void wizardCreate_rejectsScreenWiderThanRoom() {
        CinemaRoomRequest request = wizardRequest()
                .screenWidthM(new BigDecimal("30"))
                .screenHeightM(new BigDecimal("5"))
                .build();

        AppException ex = assertThrows(AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request, "tester"));
        assertEquals(MovieErrorCode.ROOM_SCREEN_EXCEEDS_ROOM_DIMENSIONS, ex.getErrorCode());
    }

    @Test
    void wizardCreate_requiresAtLeastOnePresentationFormat() {
        CinemaRoomRequest request = wizardRequest()
                .supports2d(false)
                .supports3d(false)
                .build();

        AppException ex = assertThrows(AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request, "tester"));
        assertEquals(MovieErrorCode.ROOM_PRESENTATION_FORMAT_REQUIRED, ex.getErrorCode());
    }

    @Test
    void wizardCreate_rejectsUnknownAuditoriumClass() {
        when(auditoriumClassRepository.findById(1)).thenReturn(Optional.empty());
        CinemaRoomRequest request = wizardRequest().build();

        AppException ex = assertThrows(AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request, "tester"));
        assertEquals(MovieErrorCode.AUDITORIUM_CLASS_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void wizardCreate_rejectsInactiveAuditoriumClass() {
        when(auditoriumClassRepository.findById(1))
                .thenReturn(Optional.of(AuditoriumClass.builder().classId(1).active(false).build()));
        CinemaRoomRequest request = wizardRequest().build();

        AppException ex = assertThrows(AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request, "tester"));
        assertEquals(MovieErrorCode.AUDITORIUM_CLASS_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void wizardCreate_persistsPresentationSystemIndependentlyFromProjectionTechnology() {
        when(auditoriumClassRepository.findById(1)).thenReturn(Optional.of(
                AuditoriumClass.builder().classId(1).active(true).build()));
        when(cinemaRoomRepository.save(any(CinemaRoom.class))).thenAnswer(invocation -> {
            CinemaRoom room = invocation.getArgument(0);
            room.setCinemaRoomId(10L);
            return room;
        });
        when(movieMapper.toCinemaRoomResponse(any(CinemaRoom.class)))
                .thenReturn(new CinemaRoomResponse());

        cinemaRoomService.createCinemaRoom(
                wizardRequest().presentationSystem(PresentationSystem.SCREENX).build(), "tester");

        ArgumentCaptor<CinemaRoom> captor = ArgumentCaptor.forClass(CinemaRoom.class);
        verify(cinemaRoomRepository).save(captor.capture());
        assertEquals(PresentationSystem.SCREENX, captor.getValue().getPresentationSystem());
    }

}
