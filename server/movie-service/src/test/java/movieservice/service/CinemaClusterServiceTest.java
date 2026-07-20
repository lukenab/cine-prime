package movieservice.service;

import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.dto.request.ClusterOperatingHourRequest;
import movieservice.entity.CinemaCluster;
import movieservice.entity.ClusterAuditLog;
import movieservice.enums.ClusterStatus;
import movieservice.enums.ClusterAction;
import movieservice.enums.CinemaVenueType;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movie.theater.common.exception.AppException;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.ClusterAuditLogRepository;
import movieservice.repository.MovieAvailabilityRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CinemaClusterServiceTest {

    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock ClusterAuditLogRepository clusterAuditLogRepository;
    @Mock MovieAvailabilityRepository movieAvailabilityRepository;
    @Mock MovieMapper movieMapper;

    @InjectMocks CinemaClusterService cinemaClusterService;

    @Test
    void submitUsesTheSameLockedAggregateAsDeleteAndAllowsCreator() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(7L)
                .status(ClusterStatus.DRAFT)
                .createdBy("employee.one")
                .build();
        when(cinemaClusterRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(cluster));
        when(cinemaClusterRepository.save(cluster)).thenReturn(cluster);
        when(movieMapper.toCinemaClusterResponse(cluster)).thenReturn(new CinemaClusterResponse());

        cinemaClusterService.submitCluster(7L, employeeAuthentication("employee.one"));

        assertEquals(ClusterStatus.PENDING_REVIEW, cluster.getStatus());
        verify(cinemaClusterRepository).findByIdForUpdate(7L);
    }

    @Test
    void submitRejectsEmployeeWhoDoesNotOwnDraft() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(7L)
                .status(ClusterStatus.DRAFT)
                .createdBy("employee.one")
                .build();
        when(cinemaClusterRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(cluster));

        AppException exception = assertThrows(AppException.class,
                () -> cinemaClusterService.submitCluster(7L, employeeAuthentication("employee.two")));

        assertEquals(MovieErrorCode.CLUSTER_NOT_OWNER, exception.getErrorCode());
    }

    @Test
    void approveRejectsSelfReview() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(7L)
                .status(ClusterStatus.PENDING_REVIEW)
                .createdBy("admin.one")
                .build();
        when(cinemaClusterRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(cluster));

        AppException exception = assertThrows(AppException.class,
                () -> cinemaClusterService.approveCluster(7L, adminAuthentication("admin.one")));

        assertEquals(MovieErrorCode.CLUSTER_SELF_APPROVAL_FORBIDDEN, exception.getErrorCode());
    }

    @Test
    void deleteUnusedDraftPersistsTombstoneAndDeletesCluster() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(7L)
                .clusterCode("CP-007")
                .status(ClusterStatus.DRAFT)
                .build();
        when(cinemaClusterRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(cluster));

        cinemaClusterService.deleteUnusedDraft(7L, adminAuthentication("admin.one"));

        ArgumentCaptor<ClusterAuditLog> auditCaptor = ArgumentCaptor.forClass(ClusterAuditLog.class);
        verify(clusterAuditLogRepository).save(auditCaptor.capture());
        assertEquals(ClusterAction.DELETE, auditCaptor.getValue().getAction());
        assertEquals("admin.one", auditCaptor.getValue().getPerformedBy());
        assertEquals(true, auditCaptor.getValue().getNote().contains("CP-007"));
        verify(cinemaClusterRepository).delete(cluster);
    }

    @Test
    void deleteUnusedDraftRejectsNonAdminAtServiceBoundary() {
        AppException exception = assertThrows(AppException.class,
                () -> cinemaClusterService.deleteUnusedDraft(7L, employeeAuthentication("employee.one")));

        assertEquals(MovieErrorCode.CLUSTER_DELETE_FORBIDDEN, exception.getErrorCode());
        verify(cinemaClusterRepository, never()).findByIdForUpdate(7L);
    }

    @Test
    void deleteUnusedDraftRejectsNonDraftClusterEvenWithoutRooms() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(7L)
                .status(ClusterStatus.ACTIVE)
                .build();
        when(cinemaClusterRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(cluster));

        AppException exception = assertThrows(AppException.class,
                () -> cinemaClusterService.deleteUnusedDraft(7L, adminAuthentication("admin.one")));

        assertEquals(MovieErrorCode.CLUSTER_DELETE_NOT_ALLOWED, exception.getErrorCode());
        verify(cinemaClusterRepository, never()).delete(cluster);
    }

    @Test
    void deleteUnusedDraftRejectsDraftThatPreviouslyEnteredReview() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(7L)
                .status(ClusterStatus.DRAFT)
                .build();
        when(cinemaClusterRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(cluster));
        when(clusterAuditLogRepository.existsByClusterIdAndActionIn(7L, List.of(
                ClusterAction.SUBMIT,
                ClusterAction.APPROVE,
                ClusterAction.DEACTIVATE,
                ClusterAction.REACTIVATE))).thenReturn(true);

        AppException exception = assertThrows(AppException.class,
                () -> cinemaClusterService.deleteUnusedDraft(7L, adminAuthentication("admin.one")));

        assertEquals(MovieErrorCode.CLUSTER_DELETE_NOT_ALLOWED, exception.getErrorCode());
        verify(cinemaClusterRepository, never()).delete(cluster);
    }

    @Test
    void deleteUnusedDraftRejectsRoomAndAvailabilityDependencies() {
        CinemaCluster withRoom = CinemaCluster.builder().clusterId(7L).status(ClusterStatus.DRAFT).build();
        when(cinemaClusterRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(withRoom));
        when(cinemaClusterRepository.countRoomsByClusterId(7L)).thenReturn(1);

        AppException roomException = assertThrows(AppException.class,
                () -> cinemaClusterService.deleteUnusedDraft(7L, adminAuthentication("admin.one")));
        assertEquals(MovieErrorCode.CLUSTER_HAS_ROOMS, roomException.getErrorCode());

        CinemaCluster withAvailability = CinemaCluster.builder().clusterId(8L).status(ClusterStatus.DRAFT).build();
        when(cinemaClusterRepository.findByIdForUpdate(8L)).thenReturn(Optional.of(withAvailability));
        when(movieAvailabilityRepository.existsByCluster_ClusterId(8L)).thenReturn(true);

        AppException availabilityException = assertThrows(AppException.class,
                () -> cinemaClusterService.deleteUnusedDraft(8L, adminAuthentication("admin.one")));
        assertEquals(MovieErrorCode.CLUSTER_HAS_MOVIE_AVAILABILITY, availabilityException.getErrorCode());
    }

    @Test
    void createClusterUsesAuthenticatedPrincipalForClusterAndAuditLog() {
        CinemaCluster cluster = CinemaCluster.builder().build();
        when(cinemaClusterRepository.existsByClusterNameIgnoreCase("Audit Cluster")).thenReturn(false);
        when(cinemaClusterRepository.existsByClusterCodeIgnoreCase("CP-TEST")).thenReturn(false);
        when(movieMapper.toCinemaCluster(any(CinemaClusterRequest.class))).thenReturn(cluster);
        when(cinemaClusterRepository.save(cluster)).thenAnswer(invocation -> {
            cluster.setClusterId(1L);
            return cluster;
        });
        when(movieMapper.toCinemaClusterResponse(cluster)).thenReturn(new CinemaClusterResponse());

        cinemaClusterService.createCluster(validRequest("Audit Cluster"), authentication("jwt.admin"));

        assertEquals("jwt.admin", cluster.getCreatedBy());
        assertEquals(ClusterStatus.DRAFT, cluster.getStatus());

        ArgumentCaptor<ClusterAuditLog> auditCaptor = ArgumentCaptor.forClass(ClusterAuditLog.class);
        verify(clusterAuditLogRepository).save(auditCaptor.capture());
        assertEquals("jwt.admin", auditCaptor.getValue().getPerformedBy());
    }

    @Test
    void updateClusterPreservesCreatedByAndUsesAuthenticatedPrincipalForAuditLog() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(1L)
                .clusterCode("CP-TEST")
                .clusterName("Original Cluster")
                .province("TP. Hồ Chí Minh")
                .address("123 Nguyen Hue Street")
                .status(ClusterStatus.ACTIVE)
                .createdBy("original.creator")
                .build();
        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
        when(cinemaClusterRepository.existsByClusterNameIgnoreCaseAndClusterIdNot("Updated Cluster", 1L))
                .thenReturn(false);
        when(cinemaClusterRepository.existsByClusterCodeIgnoreCaseAndClusterIdNot("CP-TEST", 1L))
                .thenReturn(false);
        when(cinemaClusterRepository.save(cluster)).thenReturn(cluster);
        when(movieMapper.toCinemaClusterResponse(cluster)).thenReturn(new CinemaClusterResponse());

        cinemaClusterService.updateCluster(1L, validRequest("Updated Cluster"), authentication("jwt.editor"));

        assertEquals("original.creator", cluster.getCreatedBy());
        assertEquals("jwt.editor", cluster.getUpdatedBy());

        ArgumentCaptor<ClusterAuditLog> auditCaptor = ArgumentCaptor.forClass(ClusterAuditLog.class);
        verify(clusterAuditLogRepository).save(auditCaptor.capture());
        assertEquals("jwt.editor", auditCaptor.getValue().getPerformedBy());
    }

    @Test
    void createClusterRejectsDuplicateStableCode() {
        CinemaClusterRequest request = validRequest("Another Cluster");
        when(cinemaClusterRepository.existsByClusterNameIgnoreCase("Another Cluster")).thenReturn(false);
        when(cinemaClusterRepository.existsByClusterCodeIgnoreCase("CP-TEST")).thenReturn(true);

        assertThrows(AppException.class,
                () -> cinemaClusterService.createCluster(request, authentication("jwt.admin")));
    }

    @Test
    void createClusterRejectsDuplicateOperatingDay() {
        CinemaClusterRequest request = validRequest("Invalid Schedule Cluster");
        request.getOperatingHours().get(6).setDayOfWeek(DayOfWeek.MONDAY);
        when(cinemaClusterRepository.existsByClusterNameIgnoreCase("Invalid Schedule Cluster")).thenReturn(false);
        when(cinemaClusterRepository.existsByClusterCodeIgnoreCase("CP-TEST")).thenReturn(false);

        assertThrows(AppException.class,
                () -> cinemaClusterService.createCluster(request, authentication("jwt.admin")));
    }

    private CinemaClusterRequest validRequest(String clusterName) {
        return CinemaClusterRequest.builder()
                .clusterName(clusterName)
                .clusterCode("CP-TEST")
                .venueType(CinemaVenueType.MALL)
                .countryCode("VN")
                .province("TP. Hồ Chí Minh")
                .address("123 Nguyen Hue Street")
                .latitude(new BigDecimal("10.7769"))
                .longitude(new BigDecimal("106.7009"))
                .timezone("Asia/Ho_Chi_Minh")
                .operatingHours(Arrays.stream(DayOfWeek.values())
                        .map(day -> ClusterOperatingHourRequest.builder()
                                .dayOfWeek(day)
                                .opensAt(LocalTime.of(8, 0))
                                .closesAt(LocalTime.of(23, 0))
                                .build())
                        .toList())
                .build();
    }

    private Authentication authentication(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_ADMIN");
    }

    private Authentication adminAuthentication(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_ADMIN");
    }

    private Authentication employeeAuthentication(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_EMPLOYEE");
    }
}
