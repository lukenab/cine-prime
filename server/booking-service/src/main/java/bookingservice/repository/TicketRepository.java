package bookingservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import bookingservice.entity.Ticket;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, String> {
}
