package paymentservice.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import paymentservice.entity.PaymentAttempt;
import paymentservice.entity.PaymentStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, String> {
    Optional<PaymentAttempt> findByAccountIdAndIdempotencyKey(String accountId, String idempotencyKey);

    Optional<PaymentAttempt> findFirstByBookingIdAndAccountIdOrderByCreatedAtDesc(
            String bookingId, String accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentAttempt p where p.providerTxnRef = :txnRef")
    Optional<PaymentAttempt> findByProviderTxnRefForUpdate(@Param("txnRef") String txnRef);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PaymentAttempt> findFirstByBookingIdOrderByCreatedAtDesc(String bookingId);

    long countByAccountIdAndCreatedAtAfter(String accountId, OffsetDateTime after);

    @Query("""
            select p from PaymentAttempt p
            where p.outcomeDelivered = false
              and p.outcomePayload is not null
              and (p.nextDeliveryAt is null or p.nextDeliveryAt <= :now)
            order by p.createdAt
            """)
    List<PaymentAttempt> findDeliveryDue(@Param("now") OffsetDateTime now, Pageable pageable);

    List<PaymentAttempt> findByStatusAndExpiresAtBefore(
            PaymentStatus status, OffsetDateTime now, Pageable pageable);

    Page<PaymentAttempt> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
