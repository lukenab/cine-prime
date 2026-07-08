package movieservice.repository;


import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.CinemaRoom;

public interface CinemaRoomRepository extends JpaRepository<CinemaRoom, Long> {
    CinemaRoom findByCinemaRoomId(Long cinemaId);
    boolean existsByCinemaRoomName(String cinemaRoomName);
}
