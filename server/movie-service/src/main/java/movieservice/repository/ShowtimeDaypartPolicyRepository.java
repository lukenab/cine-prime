package movieservice.repository;

import movieservice.entity.ShowtimeDaypartPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShowtimeDaypartPolicyRepository extends JpaRepository<ShowtimeDaypartPolicy, Long> {
    List<ShowtimeDaypartPolicy> findByPolicy_PolicyIdAndActiveTrueOrderByStartTime(Long policyId);

    /** Admin view (edit form) needs every row, including inactive ones - the scheduling engine
     *  only ever reads the active-only method above. */
    List<ShowtimeDaypartPolicy> findAllByPolicy_PolicyIdOrderByStartTime(Long policyId);

    /** Used by the admin update() flow: full-replace semantics for a policy's daypart list,
     *  mirroring ShowtimeAllocationFormatPriorityRepository#deleteByPolicy_PolicyId. */
    void deleteByPolicy_PolicyId(Long policyId);
}
