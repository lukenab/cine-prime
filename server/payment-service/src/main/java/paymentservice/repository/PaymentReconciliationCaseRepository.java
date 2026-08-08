package paymentservice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import paymentservice.entity.PaymentReconciliationCase;
import paymentservice.entity.ReconciliationStatus;

public interface PaymentReconciliationCaseRepository
        extends JpaRepository<PaymentReconciliationCase, Long> {
    Page<PaymentReconciliationCase> findByStatusOrderByCreatedAtDesc(
            ReconciliationStatus status, Pageable pageable);

    @Query("""
            select c from PaymentReconciliationCase c
            where (:status is null or c.status = :status)
              and (:severity is null or c.severity = :severity)
              and (:bookingId is null or lower(c.bookingId) like lower(concat('%', cast(:bookingId as string), '%')))
            order by c.createdAt desc
            """)
    Page<PaymentReconciliationCase> search(
            @Param("status") ReconciliationStatus status,
            @Param("severity") String severity,
            @Param("bookingId") String bookingId,
            Pageable pageable);

    java.util.List<PaymentReconciliationCase> findByPaymentIdAndStatus(
            String paymentId, ReconciliationStatus status);
}
