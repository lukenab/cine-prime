package bookingservice.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import bookingservice.entity.BookingItem;

@Repository
public interface BookingItemRepository extends JpaRepository<BookingItem, String> {
    List<BookingItem> findByBooking_BookingId(String bookingId);

    @Query("SELECT COUNT(bi) > 0 FROM BookingItem bi JOIN bi.booking b WHERE b.showtimeId = :showtimeId AND bi.seatCode IN :seatCodes AND b.status = 'CONFIRMED'")
    boolean existsByShowtimeIdAndSeatCodeInAndStatusConfirmed(@Param("showtimeId") Long showtimeId, @Param("seatCodes") List<String> seatCodes);
}
