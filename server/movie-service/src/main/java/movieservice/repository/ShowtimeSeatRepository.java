package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import movieservice.entity.ShowtimeSeat;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeSeatRepository extends JpaRepository<ShowtimeSeat, Long> {
    List<ShowtimeSeat> findByShowTime_ShowTimeId(Long showtimeId);
    
    Optional<ShowtimeSeat> findByShowTime_ShowTimeIdAndSeat_SeatId(Long showtimeId, Long seatId);
}
