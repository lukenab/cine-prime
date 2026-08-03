package bookingservice.repository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import bookingservice.entity.Booking;
import bookingservice.entity.BookingStatus;

@Repository
public interface BookingRepository extends JpaRepository<Booking, String> {
    List<Booking> findByAccountIdAndStatus(String accountId, BookingStatus status);
    Page<Booking> findAllByAccountId(String accountId, Pageable pageable);
    Optional<Booking> findBySeatHoldId(String seatHoldId);
    List<Booking> findByStatusAndExpiresAtBefore(String status, LocalDateTime expiresAt);
}
