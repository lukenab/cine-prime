package bookingservice.repository;

import bookingservice.entity.TicketCheckIn;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TicketCheckInRepository extends JpaRepository<TicketCheckIn, String> {

    @EntityGraph(attributePaths = {"ticket", "ticket.booking", "ticket.booking.tickets"})
    Optional<TicketCheckIn> findByCallerScopeAndIdempotencyKey(
            String callerScope,
            String idempotencyKey);
}
