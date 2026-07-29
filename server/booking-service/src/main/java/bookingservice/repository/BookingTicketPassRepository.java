package bookingservice.repository;

import bookingservice.entity.BookingTicketPass;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BookingTicketPassRepository extends JpaRepository<BookingTicketPass, String> {

    @EntityGraph(attributePaths = {"booking", "booking.tickets"})
    Optional<BookingTicketPass> findByBooking_BookingId(String bookingId);

    @EntityGraph(attributePaths = {"booking", "booking.tickets"})
    Optional<BookingTicketPass> findByTokenHash(String tokenHash);
}
