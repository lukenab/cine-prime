package movieservice.controller;

import movieservice.dto.request.MaintenanceRequest;
import movieservice.enums.CinemaRoomStatus;
import movieservice.service.CinemaRoomService;
import movieservice.service.SeatService;
import movieservice.security.CinemaRoomAccessPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CinemaRoomControllerTest {

    @Mock CinemaRoomService cinemaRoomService;
    @Mock SeatService seatService;
    @Mock CinemaRoomAccessPolicy cinemaRoomAccessPolicy;
    @InjectMocks CinemaRoomController controller;

    private Authentication admin(String username) {
        return new UsernamePasswordAuthenticationToken(
                username, "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    @Test
    void deleteRoom_returns204AndPassesVerifiedAuthenticationToService() {
        Authentication authentication = admin("admin.one");

        var response = controller.deleteRoom(10L, authentication);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(cinemaRoomService).deleteCinemaRoom(10L, authentication);
    }

    // ── `[Backend] Enforce movie-service endpoint authorization matrix` ──────
    // reportMaintenance/resolveMaintenance/setRoomStatus used to trust a client-supplied
    // X-User-Name header (default "unknown") as the actor - now they must derive it from the
    // verified Authentication, same as deleteRoom/createRoom/updateRoom already did.

    @Test
    void reportMaintenance_usesVerifiedAuthenticationNameAsActor_notAClientHeader() {
        Authentication authentication = admin("employee.reporter");
        MaintenanceRequest request = new MaintenanceRequest();

        controller.reportMaintenance(10L, request, authentication);

        verify(cinemaRoomService).reportMaintenance(eq(10L), any(MaintenanceRequest.class), eq("employee.reporter"));
    }

    @Test
    void resolveMaintenance_usesVerifiedAuthenticationNameAsActor_notAClientHeader() {
        Authentication authentication = admin("employee.resolver");

        controller.resolveMaintenance(20L, "Fixed the projector", authentication);

        verify(cinemaRoomService).resolveMaintenance(20L, "Fixed the projector", "employee.resolver");
    }

    @Test
    void setRoomStatus_forwardsVerifiedAuthenticationForActorAndRoleDerivation() {
        Authentication authentication = admin("admin.updater");

        controller.setRoomStatus(10L, CinemaRoomStatus.CLOSED, authentication);

        verify(cinemaRoomService).setRoomStatus(10L, CinemaRoomStatus.CLOSED, authentication);
    }

    @Test
    void retireRoom_forwardsVerifiedAuthenticationAndOptionalNote() {
        Authentication authentication = admin("admin.retirer");

        controller.retireRoom(10L, "Water damage, beyond repair", authentication);

        verify(cinemaRoomService).retireCinemaRoom(10L, "Water damage, beyond repair", authentication);
    }

    @Test
    void getAllRooms_forwardsVerifiedAuthenticationForVisibilityFiltering() {
        Authentication authentication = admin("admin.one");

        controller.getAllRooms(7L, authentication);

        verify(cinemaRoomService).getAllRooms(7L, authentication);
    }

    @Test
    void getRoomDetail_forwardsVerifiedAuthenticationForVisibilityFiltering() {
        Authentication authentication = admin("admin.one");

        controller.getRoomDetail(10L, authentication);

        verify(cinemaRoomService).getRoomDetail(10L, authentication);
    }
}
