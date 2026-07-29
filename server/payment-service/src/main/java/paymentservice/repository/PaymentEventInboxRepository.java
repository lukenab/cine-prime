package paymentservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import paymentservice.entity.PaymentEventInbox;

import java.util.Optional;

public interface PaymentEventInboxRepository extends JpaRepository<PaymentEventInbox, Long> {
    Optional<PaymentEventInbox> findByProviderAndEventKey(String provider, String eventKey);
}
