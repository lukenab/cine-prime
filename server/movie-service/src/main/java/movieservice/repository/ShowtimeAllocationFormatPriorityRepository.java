package movieservice.repository;

import movieservice.entity.ShowtimeAllocationFormatPriority;
import movieservice.entity.ShowtimeAllocationFormatPriorityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeAllocationFormatPriorityRepository
        extends JpaRepository<ShowtimeAllocationFormatPriority, ShowtimeAllocationFormatPriorityId> {
    Optional<ShowtimeAllocationFormatPriority>
    findByPolicy_PolicyIdAndScreeningFormat_FormatId(Long policyId, Integer formatId);

    @Query("""
            SELECT priority
            FROM ShowtimeAllocationFormatPriority priority
            JOIN FETCH priority.screeningFormat
            WHERE priority.policy.policyId = :policyId
            ORDER BY priority.allocationPriority DESC
            """)
    List<ShowtimeAllocationFormatPriority> findAllByPolicyIdWithFormat(
            @Param("policyId") Long policyId
    );

    /** Used by the admin update() flow: full-replace semantics for a policy's format priority list. */
    void deleteByPolicy_PolicyId(Long policyId);
}
