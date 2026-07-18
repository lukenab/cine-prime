package movieservice.repository;

import movieservice.entity.CinemaClusterDemandProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CinemaClusterDemandProfileRepository extends JpaRepository<CinemaClusterDemandProfile, Long> {

    Optional<CinemaClusterDemandProfile> findByCluster_ClusterId(Long clusterId);
}
