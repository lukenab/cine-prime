package movieservice.repository;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.transaction.Transactional;
import movieservice.entity.ScheduleSeat;

@Repository
public interface ScheduleSeatRepository extends JpaRepository<ScheduleSeat, Integer> {
    @Modifying
    @Transactional
    @Query("UPDATE ScheduleSeat s SET s.seatStatus = :status, s.updateAt = :updateAt WHERE s.seatCode = :id AND s.showTime.showTimeId = :showTimeId")
    Integer updateStatusSeat(
            @Param("id") Integer seatCode,
            @Param("status") String status,
            @Param("updateAt") LocalDateTime updateAt,
            @Param("showTimeId") Long id);

    List<ScheduleSeat> findBySeatStatus(String seatStatus);

    @Modifying
    @Query("DELETE FROM ScheduleSeat s WHERE s.showTime.showTimeId IN :showTimeIds")
    int deleteSeatsByShowTimeIds(@Param("showTimeIds") List<Long> showTimeIds);
}
