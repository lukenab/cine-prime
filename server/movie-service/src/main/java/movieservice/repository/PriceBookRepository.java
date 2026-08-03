package movieservice.repository;

import movieservice.entity.PriceBook;
import movieservice.enums.PriceBookStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PriceBookRepository extends JpaRepository<PriceBook, Long> {

    @EntityGraph(attributePaths = {"cluster", "rates", "rates.format"})
    List<PriceBook> findAllByOrderByUpdatedAtDesc();

    @Override
    @EntityGraph(attributePaths = {"cluster", "rates", "rates.format"})
    Optional<PriceBook> findById(Long id);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndPriceBookIdNot(String code, Long priceBookId);

    @EntityGraph(attributePaths = {"cluster", "rates", "rates.format"})
    @Query("""
            SELECT DISTINCT book
            FROM PriceBook book
            WHERE book.cluster.clusterId = :clusterId
              AND book.status = :status
              AND book.validFrom <= :businessDate
              AND (book.validTo IS NULL OR book.validTo >= :businessDate)
            ORDER BY book.priority DESC, book.validFrom DESC, book.priceBookId DESC
            """)
    List<PriceBook> findEffectiveBooks(
            @Param("clusterId") Long clusterId,
            @Param("status") PriceBookStatus status,
            @Param("businessDate") LocalDate businessDate);
}
