package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.entity.AuditoriumClass;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.enums.ClusterStatus;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.PresentationSystem;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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
    @Mock CinemaRoomFormatRepository cinemaRoomFormatRepository;
    @Mock ScreeningFormatRepository screeningFormatRepository;

    @InjectMocks
    CinemaRoomService cinemaRoomService;

    @BeforeEach
    void setUpActiveCluster() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(1L)
                .status(ClusterStatus.ACTIVE)
                .build();
        // lenient(): the new visibility tests below don't touch cluster lookup at all -
        // without lenient() Mockito's strict stubbing would flag this shared fixture as
        // unnecessary for those specific tests.
        org.mockito.Mockito.lenient().when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
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

    // ── cinema_room_format sync ──────────────────────────────────────────────
    // The auto-showtime engine reads cinema_room_format exclusively, never
    // supports2d/supports3d/presentationSystem directly - regression coverage
    // for the wizard-to-capability sync (previously nothing wrote this table,
    // so every wizard-created room was structurally invisible to Auto Schedule).

    @Test
    void wizardCreate_derivesCinemaRoomFormatFromWizardFields() {
        when(auditoriumClassRepository.findById(1)).thenReturn(Optional.of(
                AuditoriumClass.builder().classId(1).active(true).build()));
        when(cinemaRoomRepository.save(any(CinemaRoom.class))).thenAnswer(invocation -> {
            CinemaRoom room = invocation.getArgument(0);
            room.setCinemaRoomId(10L);
            return room;
        });
        when(movieMapper.toCinemaRoomResponse(any(CinemaRoom.class)))
                .thenReturn(new CinemaRoomResponse());
        when(cinemaRoomFormatRepository.findByCinemaRoom_CinemaRoomId(10L)).thenReturn(List.of());
        when(screeningFormatRepository.findByFormatCode("2D"))
                .thenReturn(Optional.of(movieservice.entity.ScreeningFormat.builder().formatId(1).formatCode("2D").build()));
        when(screeningFormatRepository.findByFormatCode("3D"))
                .thenReturn(Optional.of(movieservice.entity.ScreeningFormat.builder().formatId(2).formatCode("3D").build()));
        when(screeningFormatRepository.findByFormatCode("IMAX"))
                .thenReturn(Optional.of(movieservice.entity.ScreeningFormat.builder().formatId(3).formatCode("IMAX").build()));

        cinemaRoomService.createCinemaRoom(
                wizardRequest().supports3d(true).presentationSystem(PresentationSystem.IMAX).build(), "tester");

        ArgumentCaptor<movieservice.entity.CinemaRoomFormat> captor =
                ArgumentCaptor.forClass(movieservice.entity.CinemaRoomFormat.class);
        verify(cinemaRoomFormatRepository, org.mockito.Mockito.times(3)).save(captor.capture());
        List<String> savedFormatCodes = captor.getAllValues().stream()
                .map(crf -> crf.getScreeningFormat().getFormatCode()).toList();
        assertEquals(List.of("2D", "3D", "IMAX"), savedFormatCodes);
    }

    @Test
    void wizardUpdate_disablesCapabilityNoLongerDerived() {
        CinemaRoom existingRoom = CinemaRoom.builder()
                .cinemaRoomId(20L)
                .status(CinemaRoomStatus.DRAFT)
                .cluster(CinemaCluster.builder().clusterId(1L).build())
                .supports2d(true)
                .supports3d(true)
                .presentationSystem(PresentationSystem.STANDARD)
                .build();
        when(cinemaRoomRepository.findById(20L)).thenReturn(Optional.of(existingRoom));
        when(cinemaRoomRepository.save(any(CinemaRoom.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(movieMapper.toCinemaRoomResponse(any(CinemaRoom.class))).thenReturn(new CinemaRoomResponse());

        movieservice.entity.ScreeningFormat format2d =
                movieservice.entity.ScreeningFormat.builder().formatId(1).formatCode("2D").build();
        movieservice.entity.ScreeningFormat format3d =
                movieservice.entity.ScreeningFormat.builder().formatId(2).formatCode("3D").build();
        movieservice.entity.CinemaRoomFormat existing3dCapability = movieservice.entity.CinemaRoomFormat.builder()
                .id(new movieservice.entity.CinemaRoomFormatId(20L, 2))
                .cinemaRoom(existingRoom)
                .screeningFormat(format3d)
                .enabled(true)
                .build();
        when(cinemaRoomFormatRepository.findByCinemaRoom_CinemaRoomId(20L))
                .thenReturn(List.of(existing3dCapability));
        when(screeningFormatRepository.findByFormatCode("2D")).thenReturn(Optional.of(format2d));

        movieservice.dto.request.CinemaRoomUpdateRequest request =
                movieservice.dto.request.CinemaRoomUpdateRequest.builder().supports3d(false).build();
        cinemaRoomService.updateRoom(20L, request, "tester");

        assertEquals(false, existing3dCapability.getEnabled());
        verify(cinemaRoomFormatRepository).save(existing3dCapability);
    }

    // ── `[Backend] Enforce movie-service endpoint authorization matrix` ──────
    // DRAFT/PENDING_APPROVAL rooms are an in-progress wizard workflow with nothing bookable
    // yet - must be hidden from non-staff callers, same as getRoomDetail()/getAllRooms().

    private Authentication customer() {
        return new TestingAuthenticationToken("customer.a", null, "ROLE_MEMBER");
    }

    private Authentication employee() {
        return new TestingAuthenticationToken("employee.a", null, "ROLE_EMPLOYEE");
    }

    @Test
    void getRoomDetail_hidesDraftRoomFromAnonymousCaller() {
        CinemaRoom draft = CinemaRoom.builder().cinemaRoomId(5L).status(CinemaRoomStatus.DRAFT).build();
        when(cinemaRoomRepository.findById(5L)).thenReturn(Optional.of(draft));

        AppException ex = assertThrows(AppException.class, () -> cinemaRoomService.getRoomDetail(5L, null));
        assertEquals(MovieErrorCode.CINEMA_ROOM_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getRoomDetail_hidesPendingApprovalRoomFromCustomer() {
        CinemaRoom pending = CinemaRoom.builder().cinemaRoomId(5L).status(CinemaRoomStatus.PENDING_APPROVAL).build();
        when(cinemaRoomRepository.findById(5L)).thenReturn(Optional.of(pending));

        AppException ex = assertThrows(AppException.class, () -> cinemaRoomService.getRoomDetail(5L, customer()));
        assertEquals(MovieErrorCode.CINEMA_ROOM_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getRoomDetail_allowsStaffToSeeADraftRoom() {
        CinemaRoom draft = CinemaRoom.builder().cinemaRoomId(5L).status(CinemaRoomStatus.DRAFT).build();
        when(cinemaRoomRepository.findById(5L)).thenReturn(Optional.of(draft));
        when(movieMapper.toCinemaRoomResponse(draft)).thenReturn(new CinemaRoomResponse());

        assertDoesNotThrow(() -> cinemaRoomService.getRoomDetail(5L, employee()));
    }

    @Test
    void getRoomDetail_allowsAnyoneToSeeAnApprovedRoom() {
        CinemaRoom approved = CinemaRoom.builder().cinemaRoomId(5L).status(CinemaRoomStatus.APPROVED).build();
        when(cinemaRoomRepository.findById(5L)).thenReturn(Optional.of(approved));
        when(movieMapper.toCinemaRoomResponse(approved)).thenReturn(new CinemaRoomResponse());

        assertDoesNotThrow(() -> cinemaRoomService.getRoomDetail(5L, null));
    }

    @Test
    void getAllRooms_filtersOutDraftAndPendingApprovalForNonStaff() {
        CinemaRoom draft = CinemaRoom.builder().cinemaRoomId(1L).status(CinemaRoomStatus.DRAFT).build();
        CinemaRoom pending = CinemaRoom.builder().cinemaRoomId(2L).status(CinemaRoomStatus.PENDING_APPROVAL).build();
        CinemaRoom approved = CinemaRoom.builder().cinemaRoomId(3L).status(CinemaRoomStatus.APPROVED).build();
        when(cinemaRoomRepository.findAll()).thenReturn(List.of(draft, pending, approved));
        when(movieMapper.toCinemaRoomResponse(approved)).thenReturn(new CinemaRoomResponse());

        var result = cinemaRoomService.getAllRooms(null, customer());

        assertEquals(1, result.size());
    }

    @Test
    void getAllRooms_returnsEverythingForStaff() {
        CinemaRoom draft = CinemaRoom.builder().cinemaRoomId(1L).status(CinemaRoomStatus.DRAFT).build();
        CinemaRoom approved = CinemaRoom.builder().cinemaRoomId(3L).status(CinemaRoomStatus.APPROVED).build();
        when(cinemaRoomRepository.findAll()).thenReturn(List.of(draft, approved));
        when(movieMapper.toCinemaRoomResponse(any(CinemaRoom.class))).thenReturn(new CinemaRoomResponse());

        var result = cinemaRoomService.getAllRooms(null, employee());

        assertEquals(2, result.size());
    }
}
