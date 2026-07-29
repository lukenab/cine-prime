package bookingservice.repository;

import bookingservice.entity.CounterPayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CounterPaymentRepository extends JpaRepository<CounterPayment, String> {
    Optional<CounterPayment> findByBooking_BookingId(String bookingId);

    boolean existsByReceiptReference(String receiptReference);
}
