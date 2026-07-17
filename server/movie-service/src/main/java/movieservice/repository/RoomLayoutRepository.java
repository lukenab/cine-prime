package movieservice.repository;

import movieservice.entity.RoomLayout;
import movieservice.enums.LayoutStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomLayoutRepository extends JpaRepository<RoomLayout, Long> {

    List<RoomLayout> findByCinemaRoomCinemaRoomIdOrderByVersionDesc(Long cinemaRoomId);

    Optional<RoomLayout> findByCinemaRoomCinemaRoomIdAndVersion(Long cinemaRoomId, Integer version);

    Optional<RoomLayout> findByCinemaRoomCinemaRoomIdAndStatus(Long cinemaRoomId, LayoutStatus status);

    int countByCinemaRoomCinemaRoomId(Long cinemaRoomId);
}
