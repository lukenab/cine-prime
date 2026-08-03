package paymentservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import paymentservice.entity.PaymentRefund;

import java.util.Optional;

public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, String> {
    Optional<PaymentRefund> findByIdempotencyKey(String idempotencyKey);
}
