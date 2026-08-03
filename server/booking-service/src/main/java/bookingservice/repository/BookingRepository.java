package bookingservice.repository;

import bookingservice.entity.Booking;
import bookingservice.entity.BookingStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, String> {

    @EntityGraph(attributePaths = {"bookingDetails", "inventoryReservation"})
    Optional<Booking> findDetailedByBookingId(String bookingId);

    Page<Booking> findByAccountIdOrderByCreatedAtDesc(String accountId, Pageable pageable);

    Page<Booking> findByClusterIdOrderByCreatedAtDesc(Long clusterId, Pageable pageable);

    List<Booking> findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(
            BookingStatus status,
            OffsetDateTime cutoff);

    long countByAccountIdAndStatusAndExpiresAtAfter(
            String accountId,
            BookingStatus status,
            OffsetDateTime cutoff);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.bookingId = :bookingId")
    Optional<Booking> findByIdForUpdate(@Param("bookingId") String bookingId);
    
    // Legacy methods from HEAD (promotion integration) - kept for compatibility
    Optional<Booking> findBySeatHoldId(String seatHoldId);
    List<Booking> findByAccountIdAndStatus(String accountId, BookingStatus status);
    Page<Booking> findAllByAccountId(String accountId, Pageable pageable);
}
