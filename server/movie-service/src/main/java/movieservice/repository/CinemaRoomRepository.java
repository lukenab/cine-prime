package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.CinemaRoom;

public interface CinemaRoomRepository extends JpaRepository<CinemaRoom, Integer> {
    boolean existsByCinemaRoomName(String cinemaRoomName);
}
