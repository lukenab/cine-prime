package bookingservice.repository;

import bookingservice.entity.PaymentEventInbox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentEventInboxRepository extends JpaRepository<PaymentEventInbox, String> {
    Optional<PaymentEventInbox> findByEventSourceAndEventId(String eventSource, String eventId);
}
