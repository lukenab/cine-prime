package movieservice.controller;

import movieservice.dto.request.RejectRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.entity.CinemaCluster;
import movieservice.enums.ClusterStatus;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.ClusterAuditLogRepository;
import movieservice.service.CinemaClusterService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CinemaClusterControllerTest {

    @Mock CinemaClusterRepository clusterRepository;
    @Mock ClusterAuditLogRepository auditLogRepository;
    @Mock CinemaClusterService cinemaClusterService;
    @Mock MovieMapper movieMapper;

    @InjectMocks CinemaClusterController controller;

    @Test
    void submitDelegatesToTransactionalService() {
        Authentication authentication = employee("employee.a");
        CinemaClusterResponse response = new CinemaClusterResponse();
        when(cinemaClusterService.submitCluster(1L, authentication)).thenReturn(response);

        assertEquals(response, controller.submit(1L, authentication).getResult());
        verify(cinemaClusterService).submitCluster(1L, authentication);
    }

    @Test
    void approveDelegatesToTransactionalService() {
        Authentication authentication = admin("admin.x");
        CinemaClusterResponse response = new CinemaClusterResponse();
        when(cinemaClusterService.approveCluster(1L, authentication)).thenReturn(response);

        assertEquals(response, controller.approve(1L, authentication).getResult());
        verify(cinemaClusterService).approveCluster(1L, authentication);
    }

    @Test
    void rejectDelegatesValidatedNoteToTransactionalService() {
        Authentication authentication = admin("admin.x");
        RejectRequest request = new RejectRequest();
        ReflectionTestUtils.setField(request, "note", "Address looks wrong");
        CinemaClusterResponse response = new CinemaClusterResponse();
        when(cinemaClusterService.rejectCluster(1L, "Address looks wrong", authentication)).thenReturn(response);

        assertEquals(response, controller.reject(1L, request, authentication).getResult());
        verify(cinemaClusterService).rejectCluster(1L, "Address looks wrong", authentication);
    }

    @Test
    void deleteReturnsNoContentAndDelegatesVerifiedAuthentication() {
        Authentication authentication = admin("admin.x");

        assertEquals(HttpStatus.NO_CONTENT, controller.delete(1L, authentication).getStatusCode());
        verify(cinemaClusterService).deleteUnusedDraft(1L, authentication);
    }

    private Authentication employee(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_EMPLOYEE");
    }

    private Authentication admin(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_ADMIN");
    }
}
