package movieservice.repository;


import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.CinemaRoom;

import java.util.List;

public interface CinemaRoomRepository extends JpaRepository<CinemaRoom, Long> {
    CinemaRoom findByCinemaRoomId(Long cinemaId);
    boolean existsByCluster_ClusterIdAndCinemaRoomName(Long clusterId, String cinemaRoomName);
    List<CinemaRoom> findByCluster_ClusterId(Long clusterId);
}
