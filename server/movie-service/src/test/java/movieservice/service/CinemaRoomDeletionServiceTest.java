package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.CinemaRoom;
import movieservice.entity.RoomLayout;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.LayoutStatus;
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
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CinemaRoomDeletionServiceTest {

    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock CinemaRoomMaintenanceRepository maintenanceRepository;
    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock ShowTimeRepository showTimeRepository;
    @Mock MovieMapper movieMapper;
    @Mock AuditLogService auditLogService;
    @Mock SeatRepository seatRepository;
    @Mock AuditoriumClassRepository auditoriumClassRepository;
    @Mock ProjectionTechnologyRepository projectionTechnologyRepository;
    @Mock ResolutionRepository resolutionRepository;
    @Mock AudioFormatRepository audioFormatRepository;
    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock RoomLayoutService roomLayoutService;

    @InjectMocks CinemaRoomService cinemaRoomService;

    @Test
    void delete_allowsAdminToDeleteUnusedDraftAndItsDraftLayouts() {
        CinemaRoom room = draftRoom("employee.one");
        RoomLayout layout = draftLayout(room);
        stubRoomAndLayouts(room, List.of(layout));

        cinemaRoomService.deleteCinemaRoom(10L, authentication("admin.one", "ROLE_ADMIN"));

        verify(roomLayoutRepository).deleteAll(List.of(layout));
        verify(cinemaRoomRepository).delete(room);
        verify(auditLogService).logAction(
                "admin.one", "ADMIN", "cinema_room:10",
                "Permanently deleted unused draft cinema room: Room 10");
    }

    @Test
    void delete_allowsEmployeeWhoCreatedTheDraft() {
        CinemaRoom room = draftRoom("employee.one");
        stubRoomAndLayouts(room, List.of());

        cinemaRoomService.deleteCinemaRoom(10L, authentication("employee.one", "ROLE_EMPLOYEE"));

        verify(cinemaRoomRepository).delete(room);
        verify(auditLogService).logAction(
                "employee.one", "EMPLOYEE", "cinema_room:10",
                "Permanently deleted unused draft cinema room: Room 10");
    }

    @Test
    void delete_rejectsEmployeeWhoDidNotCreateTheDraft() {
        CinemaRoom room = draftRoom("employee.one");
        when(cinemaRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));

        AppException exception = assertThrows(AppException.class,
                () -> cinemaRoomService.deleteCinemaRoom(
                        10L, authentication("employee.two", "ROLE_EMPLOYEE")));

        assertEquals(MovieErrorCode.CINEMA_ROOM_DELETE_FORBIDDEN, exception.getErrorCode());
        verify(cinemaRoomRepository, never()).delete(room);
    }

    @Test
    void delete_rejectsCreatorWithoutAdminOrEmployeeRole() {
        CinemaRoom room = draftRoom("employee.one");
        when(cinemaRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));

        AppException exception = assertThrows(AppException.class,
                () -> cinemaRoomService.deleteCinemaRoom(
                        10L, authentication("employee.one", "ROLE_CUSTOMER")));

        assertEquals(MovieErrorCode.CINEMA_ROOM_DELETE_FORBIDDEN, exception.getErrorCode());
        verify(cinemaRoomRepository, never()).delete(room);
    }

    @Test
    void delete_rejectsRoomThatIsNoLongerDraft() {
        CinemaRoom room = draftRoom("employee.one");
        room.setStatus(CinemaRoomStatus.ACTIVE);
        when(cinemaRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));

        AppException exception = assertThrows(AppException.class,
                () -> cinemaRoomService.deleteCinemaRoom(10L, authentication("admin.one", "ROLE_ADMIN")));

        assertEquals(MovieErrorCode.CINEMA_ROOM_DELETE_NOT_ALLOWED, exception.getErrorCode());
        verify(cinemaRoomRepository, never()).delete(room);
    }

    @Test
    void delete_rejectsAnyHistoricalShowtimeIncludingCompletedOrCancelled() {
        CinemaRoom room = draftRoom("employee.one");
        when(cinemaRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));
        when(showTimeRepository.existsByCinemaRoomCinemaRoomId(10L)).thenReturn(true);

        AppException exception = assertThrows(AppException.class,
                () -> cinemaRoomService.deleteCinemaRoom(10L, authentication("admin.one", "ROLE_ADMIN")));

        assertEquals(MovieErrorCode.CINEMA_ROOM_HAS_SHOWTIMES, exception.getErrorCode());
        verify(cinemaRoomRepository, never()).delete(room);
    }

    @Test
    void delete_rejectsLayoutThatWasPreviouslySubmittedEvenIfItReturnedToDraft() {
        CinemaRoom room = draftRoom("employee.one");
        RoomLayout layout = draftLayout(room);
        layout.setSubmittedAt(LocalDateTime.of(2026, 7, 18, 10, 0));
        stubRoomAndLayouts(room, List.of(layout));

        AppException exception = assertThrows(AppException.class,
                () -> cinemaRoomService.deleteCinemaRoom(10L, authentication("admin.one", "ROLE_ADMIN")));

        assertEquals(MovieErrorCode.CINEMA_ROOM_DELETE_NOT_ALLOWED, exception.getErrorCode());
        verify(cinemaRoomRepository, never()).delete(room);
    }

    @Test
    void delete_rejectsMaterializedOperationalSeats() {
        CinemaRoom room = draftRoom("employee.one");
        stubRoomAndLayouts(room, List.of(draftLayout(room)));
        when(seatRepository.existsByCinemaRoomCinemaRoomId(10L)).thenReturn(true);

        AppException exception = assertThrows(AppException.class,
                () -> cinemaRoomService.deleteCinemaRoom(10L, authentication("admin.one", "ROLE_ADMIN")));

        assertEquals(MovieErrorCode.CINEMA_ROOM_DELETE_NOT_ALLOWED, exception.getErrorCode());
        verify(cinemaRoomRepository, never()).delete(room);
    }

    @Test
    void delete_rejectsMaintenanceHistory() {
        CinemaRoom room = draftRoom("employee.one");
        stubRoomAndLayouts(room, List.of(draftLayout(room)));
        when(maintenanceRepository.existsByCinemaRoom_CinemaRoomId(10L)).thenReturn(true);

        AppException exception = assertThrows(AppException.class,
                () -> cinemaRoomService.deleteCinemaRoom(10L, authentication("admin.one", "ROLE_ADMIN")));

        assertEquals(MovieErrorCode.CINEMA_ROOM_DELETE_NOT_ALLOWED, exception.getErrorCode());
        verify(cinemaRoomRepository, never()).delete(room);
    }

    @Test
    void delete_auditUsesVerifiedPrincipalRatherThanClientSuppliedIdentity() {
        CinemaRoom room = draftRoom("employee.one");
        stubRoomAndLayouts(room, List.of());

        cinemaRoomService.deleteCinemaRoom(10L, authentication("verified.admin", "ROLE_ADMIN"));

        ArgumentCaptor<String> actor = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).logAction(actor.capture(), contains("ADMIN"),
                contains("cinema_room:10"), contains("Permanently deleted"));
        assertTrue(actor.getValue().equals("verified.admin"));
    }

    private void stubRoomAndLayouts(CinemaRoom room, List<RoomLayout> layouts) {
        when(cinemaRoomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdOrderByVersionDesc(10L))
                .thenReturn(layouts);
    }

    private CinemaRoom draftRoom(String creator) {
        return CinemaRoom.builder()
                .cinemaRoomId(10L)
                .cinemaRoomName("Room 10")
                .status(CinemaRoomStatus.DRAFT)
                .createdBy(creator)
                .build();
    }

    private RoomLayout draftLayout(CinemaRoom room) {
        return RoomLayout.builder()
                .roomLayoutId(100L)
                .cinemaRoom(room)
                .version(1)
                .status(LayoutStatus.DRAFT)
                .build();
    }

    private Authentication authentication(String name, String role) {
        return new UsernamePasswordAuthenticationToken(
                name, "n/a", List.of(new SimpleGrantedAuthority(role)));
    }
}
