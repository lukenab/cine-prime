package movieservice.repository;

import movieservice.entity.CinemaCluster;
import movieservice.enums.ClusterStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CinemaClusterRepository extends JpaRepository<CinemaCluster, Long> {

    List<CinemaCluster> findByStatus(ClusterStatus status);

    List<CinemaCluster> findByClusterNameContainingIgnoreCaseOrProvinceContainingIgnoreCase(
            String name, String province);

    @Query("SELECT COUNT(r) FROM CinemaRoom r WHERE r.cluster.clusterId = :clusterId")
    int countRoomsByClusterId(@Param("clusterId") Long clusterId);

    @Query("SELECT COALESCE(SUM(r.totalSeatCapacity), 0) FROM CinemaRoom r WHERE r.cluster.clusterId = :clusterId")
    int sumSeatsByClusterId(@Param("clusterId") Long clusterId);
}
