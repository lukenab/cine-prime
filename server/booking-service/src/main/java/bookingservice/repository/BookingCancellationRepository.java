package bookingservice.repository;

import bookingservice.entity.BookingCancellation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BookingCancellationRepository
        extends JpaRepository<BookingCancellation, String> {

    Optional<BookingCancellation> findByIdempotencyKey(String idempotencyKey);
}
