package movieservice.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import movieservice.entity.CinemaRoom;

import jakarta.persistence.LockModeType;

import java.util.List;

public interface CinemaRoomRepository extends JpaRepository<CinemaRoom, Long> {
    CinemaRoom findByCinemaRoomId(Long cinemaId);

    /** Locks rooms in a stable order so concurrent bulk requests cannot interleave. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM CinemaRoom r WHERE r.cinemaRoomId IN :roomIds ORDER BY r.cinemaRoomId")
    List<CinemaRoom> findAllByIdForUpdate(@Param("roomIds") List<Long> roomIds);

    boolean existsByCluster_ClusterIdAndCinemaRoomName(Long clusterId, String cinemaRoomName);
    List<CinemaRoom> findByCluster_ClusterId(Long clusterId);
}
