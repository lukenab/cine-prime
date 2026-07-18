package movieservice.controller;

import movieservice.service.CinemaRoomService;
import movieservice.service.SeatService;
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
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CinemaRoomControllerTest {

    @Mock CinemaRoomService cinemaRoomService;
    @Mock SeatService seatService;
    @InjectMocks CinemaRoomController controller;

    @Test
    void deleteRoom_returns204AndPassesVerifiedAuthenticationToService() {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                "admin.one", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        var response = controller.deleteRoom(10L, authentication);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(cinemaRoomService).deleteCinemaRoom(10L, authentication);
    }
}
