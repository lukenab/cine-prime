package movieservice.repository;

import movieservice.entity.CinemaRoomMaintenance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CinemaRoomMaintenanceRepository extends JpaRepository<CinemaRoomMaintenance, Long> {
    List<CinemaRoomMaintenance> findByCinemaRoom_CinemaRoomId(Long cinemaRoomId);
    List<CinemaRoomMaintenance> findByCinemaRoom_CinemaRoomIdAndResolvedFalse(Long cinemaRoomId);
    boolean existsByCinemaRoom_CinemaRoomId(Long cinemaRoomId);
}
