package concessionservice.controller;

import concessionservice.service.ConcessionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ReservationControllerOwnershipTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void customerReadAndReleaseAreCheckedAgainstPersistedOwner() {
        ConcessionService service = mock(ConcessionService.class);
        ReservationController controller = new ReservationController(service);
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("accountId", "ACC-1")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt, List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))));

        controller.get("RES-1");
        controller.release("RES-1");

        verify(service, org.mockito.Mockito.times(2))
                .requireReservationOwner("RES-1", "ACC-1");
        verify(service).reservation("RES-1", false);
        verify(service).release("RES-1", false);
    }
}
