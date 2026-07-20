package movieservice.repository;

import jakarta.persistence.LockModeType;
import movieservice.entity.CinemaCluster;
import movieservice.enums.ClusterStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CinemaClusterRepository extends JpaRepository<CinemaCluster, Long> {

    @Override
    @EntityGraph(attributePaths = "operatingHours")
    List<CinemaCluster> findAll();

    @Override
    @EntityGraph(attributePaths = "operatingHours")
    Optional<CinemaCluster> findById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CinemaCluster c WHERE c.clusterId = :clusterId")
    Optional<CinemaCluster> findByIdForUpdate(@Param("clusterId") Long clusterId);

    @EntityGraph(attributePaths = "operatingHours")
    List<CinemaCluster> findByStatus(ClusterStatus status);

    @EntityGraph(attributePaths = "operatingHours")
    List<CinemaCluster> findByClusterNameContainingIgnoreCaseOrProvinceContainingIgnoreCase(
            String name, String province);

    boolean existsByClusterNameIgnoreCase(String clusterName);

    boolean existsByClusterNameIgnoreCaseAndClusterIdNot(String clusterName, Long clusterId);

    boolean existsByClusterCodeIgnoreCase(String clusterCode);

    boolean existsByClusterCodeIgnoreCaseAndClusterIdNot(String clusterCode, Long clusterId);

    @Query("SELECT COUNT(r) FROM CinemaRoom r WHERE r.cluster.clusterId = :clusterId")
    int countRoomsByClusterId(@Param("clusterId") Long clusterId);

    @Query("SELECT COALESCE(SUM(r.totalSeatCapacity), 0) FROM CinemaRoom r WHERE r.cluster.clusterId = :clusterId")
    int countSeatsByClusterId(@Param("clusterId") Long clusterId);
}
