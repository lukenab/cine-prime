package movieservice.controller;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.RejectRequest;
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

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CinemaClusterControllerTest {

    @Mock CinemaClusterRepository clusterRepository;
    @Mock ClusterAuditLogRepository auditLogRepository;
    @Mock CinemaClusterService cinemaClusterService;
    @Mock MovieMapper movieMapper;

    @InjectMocks CinemaClusterController controller;

    @Test
    void submitRejectsWhenActorIsNeitherCreatorNorAdmin() {
        CinemaCluster cluster = draftCluster("employee.a");
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(cluster));

        AppException ex = assertThrows(AppException.class,
                () -> controller.submit(1L, employee("employee.b")));

        assertEquals(MovieErrorCode.CLUSTER_NOT_OWNER, ex.getErrorCode());
    }

    @Test
    void submitAllowsTheCreatingEmployee() {
        CinemaCluster cluster = draftCluster("employee.a");
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
        when(clusterRepository.save(cluster)).thenReturn(cluster);
        stubResponseMapping(cluster);

        controller.submit(1L, employee("employee.a"));

        assertEquals(ClusterStatus.PENDING_REVIEW, cluster.getStatus());
    }

    @Test
    void submitAllowsAdminEvenWhenNotTheCreator() {
        CinemaCluster cluster = draftCluster("employee.a");
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
        when(clusterRepository.save(cluster)).thenReturn(cluster);
        stubResponseMapping(cluster);

        controller.submit(1L, admin("admin.x"));

        assertEquals(ClusterStatus.PENDING_REVIEW, cluster.getStatus());
    }

    @Test
    void approveRejectsSelfApprovalByTheCreatingAdmin() {
        CinemaCluster cluster = pendingReviewCluster("admin.x");
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(cluster));

        AppException ex = assertThrows(AppException.class,
                () -> controller.approve(1L, admin("admin.x")));

        assertEquals(MovieErrorCode.CLUSTER_SELF_APPROVAL_FORBIDDEN, ex.getErrorCode());
    }

    @Test
    void approveAllowsADifferentAdminThanTheCreator() {
        CinemaCluster cluster = pendingReviewCluster("employee.a");
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
        when(clusterRepository.save(cluster)).thenReturn(cluster);
        stubResponseMapping(cluster);

        controller.approve(1L, admin("admin.x"));

        assertEquals(ClusterStatus.ACTIVE, cluster.getStatus());
    }

    @Test
    void rejectRejectsSelfReviewByTheCreatingAdmin() {
        CinemaCluster cluster = pendingReviewCluster("admin.x");
        when(clusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
        RejectRequest req = new RejectRequest();
        ReflectionTestUtils.setField(req, "note", "Address looks wrong");

        AppException ex = assertThrows(AppException.class,
                () -> controller.reject(1L, req, admin("admin.x")));

        assertEquals(MovieErrorCode.CLUSTER_SELF_APPROVAL_FORBIDDEN, ex.getErrorCode());
    }

    private CinemaCluster draftCluster(String createdBy) {
        return CinemaCluster.builder().clusterId(1L).status(ClusterStatus.DRAFT).createdBy(createdBy).build();
    }

    private CinemaCluster pendingReviewCluster(String createdBy) {
        return CinemaCluster.builder().clusterId(1L).status(ClusterStatus.PENDING_REVIEW).createdBy(createdBy).build();
    }

    private void stubResponseMapping(CinemaCluster cluster) {
        when(movieMapper.toCinemaClusterResponse(cluster))
                .thenReturn(movieservice.dto.response.CinemaClusterResponse.builder().build());
        when(clusterRepository.countRoomsByClusterId(any())).thenReturn(0);
        when(clusterRepository.countSeatsByClusterId(any())).thenReturn(0);
    }

    private Authentication employee(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_EMPLOYEE");
    }

    private Authentication admin(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_ADMIN");
    }
}
