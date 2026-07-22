package movieservice.repository;

import movieservice.entity.ProgrammingSharePolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface ProgrammingSharePolicyRepository extends JpaRepository<ProgrammingSharePolicy, Long> {
    @Query("""
            SELECT policy FROM ProgrammingSharePolicy policy
            WHERE policy.marketCode = :marketCode AND policy.active = true
              AND policy.effectiveFrom <= :startDate AND policy.effectiveTo >= :endDate
            ORDER BY policy.effectiveFrom DESC
            """)
    Optional<ProgrammingSharePolicy> findApplicable(
            @Param("marketCode") String marketCode,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
