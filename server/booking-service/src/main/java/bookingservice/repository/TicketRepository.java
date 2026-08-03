package bookingservice.repository;

import bookingservice.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketRepository extends JpaRepository<Ticket, String> {
    boolean existsByBookingDetail_DetailId(String bookingItemId);

    List<Ticket> findAllByBooking_BookingIdOrderBySeatCodeAsc(String bookingId);
}
