package paymentservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import paymentservice.entity.PaymentRefund;
import paymentservice.entity.PaymentRefundStatus;

import java.util.List;
import java.util.Optional;

public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, String> {
    Optional<PaymentRefund> findByIdempotencyKey(String idempotencyKey);

    @Query("""
            select r from PaymentRefund r
            where (:status is null or r.status = :status)
              and (:bookingId is null or lower(r.bookingId) like lower(concat('%', cast(:bookingId as string), '%')))
            order by r.createdAt desc
            """)
    Page<PaymentRefund> search(
            @Param("status") PaymentRefundStatus status,
            @Param("bookingId") String bookingId,
            Pageable pageable);

    Optional<PaymentRefund> findFirstByPayment_PaymentIdOrderByCreatedAtDesc(String paymentId);

    List<PaymentRefund> findByPayment_PaymentIdAndStatus(
            String paymentId, PaymentRefundStatus status);
}
