package analyticsservice.repository;

import analyticsservice.entity.BookingRevenueFact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface BookingRevenueFactRepository extends JpaRepository<BookingRevenueFact, String> {
    List<BookingRevenueFact> findAllByClusterIdAndBusinessDateBetweenAndCurrencyIgnoreCase(
            Long clusterId, LocalDate from, LocalDate to, String currency);

    List<BookingRevenueFact> findAllByBusinessDateBetweenAndCurrencyIgnoreCase(
            LocalDate from, LocalDate to, String currency);
}
