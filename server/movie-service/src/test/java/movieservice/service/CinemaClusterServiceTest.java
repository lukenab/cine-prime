package movieservice.service;

import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.ClusterAuditLog;
import movieservice.enums.ClusterStatus;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.ClusterAuditLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CinemaClusterServiceTest {

    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock ClusterAuditLogRepository clusterAuditLogRepository;
    @Mock MovieMapper movieMapper;

    @InjectMocks CinemaClusterService cinemaClusterService;

    @Test
    void createClusterUsesAuthenticatedPrincipalForClusterAndAuditLog() {
        CinemaCluster cluster = CinemaCluster.builder().build();
        when(cinemaClusterRepository.existsByClusterNameIgnoreCase("Audit Cluster")).thenReturn(false);
        when(movieMapper.toCinemaCluster(any(CinemaClusterRequest.class))).thenReturn(cluster);
        when(cinemaClusterRepository.save(cluster)).thenAnswer(invocation -> {
            cluster.setClusterId(1L);
            return cluster;
        });
        when(movieMapper.toCinemaClusterResponse(cluster)).thenReturn(new CinemaClusterResponse());

        cinemaClusterService.createCluster(validRequest("Audit Cluster"), authentication("jwt.admin"));

        assertEquals("jwt.admin", cluster.getCreatedBy());

        ArgumentCaptor<ClusterAuditLog> auditCaptor = ArgumentCaptor.forClass(ClusterAuditLog.class);
        verify(clusterAuditLogRepository).save(auditCaptor.capture());
        assertEquals("jwt.admin", auditCaptor.getValue().getPerformedBy());
    }

    @Test
    void updateClusterPreservesCreatedByAndUsesAuthenticatedPrincipalForAuditLog() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(1L)
                .clusterName("Original Cluster")
                .province("TP. Hồ Chí Minh")
                .address("123 Nguyen Hue Street")
                .status(ClusterStatus.ACTIVE)
                .createdBy("original.creator")
                .build();
        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
        when(cinemaClusterRepository.existsByClusterNameIgnoreCaseAndClusterIdNot("Updated Cluster", 1L))
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

    private CinemaClusterRequest validRequest(String clusterName) {
        return CinemaClusterRequest.builder()
                .clusterName(clusterName)
                .province("TP. Hồ Chí Minh")
                .address("123 Nguyen Hue Street")
                .latitude(new BigDecimal("10.7769"))
                .longitude(new BigDecimal("106.7009"))
                .build();
    }

    private Authentication authentication(String username) {
        return new TestingAuthenticationToken(username, null, "ROLE_ADMIN");
    }
}
