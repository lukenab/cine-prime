package paymentservice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import paymentservice.entity.PaymentReconciliationCase;
import paymentservice.entity.ReconciliationStatus;

public interface PaymentReconciliationCaseRepository
        extends JpaRepository<PaymentReconciliationCase, Long> {
    Page<PaymentReconciliationCase> findByStatusOrderByCreatedAtDesc(
            ReconciliationStatus status, Pageable pageable);
}
