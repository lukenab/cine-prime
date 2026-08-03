package bookingservice.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;

import bookingservice.entity.BookingQuote;

public interface BookingQuoteRepository extends JpaRepository<BookingQuote, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from BookingQuote q left join fetch q.items where q.quoteId = :quoteId")
    Optional<BookingQuote> findByIdForUpdate(@Param("quoteId") String quoteId);
}
