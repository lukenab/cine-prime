package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.Seat;

public interface SeatRepository extends JpaRepository<Seat, Long> {
    
}
