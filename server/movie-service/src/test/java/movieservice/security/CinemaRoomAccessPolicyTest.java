package movieservice.security;

import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CinemaRoomAccessPolicyTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void employeeCanOperateOnlyInsideSignedBranch() {
        CinemaRoomRepository rooms = mock(CinemaRoomRepository.class);
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(10L)
                .cluster(CinemaCluster.builder().clusterId(81L).build())
                .build();
        when(rooms.findById(10L)).thenReturn(Optional.of(room));
        CinemaRoomAccessPolicy policy = new CinemaRoomAccessPolicy(
                rooms, mock(CinemaRoomMaintenanceRepository.class));

        authenticate("EMPLOYEE", 81L);
        assertThatCode(() -> policy.requireRoomAccess(10L)).doesNotThrowAnyException();

        authenticate("EMPLOYEE", 82L);
        assertThatThrownBy(() -> policy.requireRoomAccess(10L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void adminRetainsGlobalRoomAccess() {
        CinemaRoomRepository rooms = mock(CinemaRoomRepository.class);
        when(rooms.findById(10L)).thenReturn(Optional.of(CinemaRoom.builder()
                .cinemaRoomId(10L)
                .cluster(CinemaCluster.builder().clusterId(999L).build())
                .build()));
        CinemaRoomAccessPolicy policy = new CinemaRoomAccessPolicy(
                rooms, mock(CinemaRoomMaintenanceRepository.class));

        authenticate("ADMIN", null);
        assertThatCode(() -> policy.requireRoomAccess(10L)).doesNotThrowAnyException();
    }

    private void authenticate(String role, Long clusterId) {
        Jwt.Builder jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("accountId", "account-1");
        if (clusterId != null) jwt.claim("cinemaClusterId", clusterId);
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt.build(), List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
