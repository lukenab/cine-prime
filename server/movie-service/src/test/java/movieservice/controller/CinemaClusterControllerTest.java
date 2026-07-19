package movieservice.controller;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.RejectRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.entity.CinemaCluster;
import movieservice.enums.ClusterStatus;
import movieservice.exception.MovieErrorCode;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
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

    // ── `[Backend] Enforce movie-service endpoint authorization matrix` ──────
    // getById() must apply the same ACTIVE-only visibility non-staff callers get from
    // getAll() - a DRAFT/PENDING_REVIEW/REJECTED cluster's ID must not be enumerable.

    @Test
    void getByIdHidesNonActiveClusterFromAnonymousCaller() {
        CinemaCluster draft = CinemaCluster.builder().clusterId(1L).status(ClusterStatus.DRAFT).build();
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(draft));

        AppException ex = assertThrows(AppException.class, () -> controller.getById(1L, null));
        assertEquals(MovieErrorCode.CLUSTER_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getByIdHidesNonActiveClusterFromCustomerCaller() {
        CinemaCluster pendingReview = CinemaCluster.builder().clusterId(1L).status(ClusterStatus.PENDING_REVIEW).build();
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(pendingReview));
        Authentication customer = new TestingAuthenticationToken("customer.a", null, "ROLE_MEMBER");

        AppException ex = assertThrows(AppException.class, () -> controller.getById(1L, customer));
        assertEquals(MovieErrorCode.CLUSTER_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getByIdAllowsStaffToSeeANonActiveCluster() {
        CinemaCluster draft = CinemaCluster.builder().clusterId(1L).status(ClusterStatus.DRAFT).build();
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(draft));
        when(movieMapper.toCinemaClusterResponse(draft)).thenReturn(new CinemaClusterResponse());

        assertEquals(200, controller.getById(1L, employee("employee.a")).getCode());
    }

    @Test
    void getByIdAllowsAnyoneToSeeAnActiveCluster() {
        CinemaCluster active = CinemaCluster.builder().clusterId(1L).status(ClusterStatus.ACTIVE).build();
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(active));
        when(movieMapper.toCinemaClusterResponse(active)).thenReturn(new CinemaClusterResponse());

        assertEquals(200, controller.getById(1L, null).getCode());
    }

    private Authentication employee(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_EMPLOYEE");
    }

    private Authentication admin(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_ADMIN");
    }
}
