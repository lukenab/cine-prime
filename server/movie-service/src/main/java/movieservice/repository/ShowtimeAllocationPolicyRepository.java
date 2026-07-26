package movieservice.repository;

import movieservice.entity.ShowtimeAllocationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeAllocationPolicyRepository extends JpaRepository<ShowtimeAllocationPolicy, Long> {

    Optional<ShowtimeAllocationPolicy> findByPolicyCodeAndActiveTrue(String policyCode);

    Optional<ShowtimeAllocationPolicy> findByPolicyCode(String policyCode);

    List<ShowtimeAllocationPolicy> findAllByOrderByUpdatedAtDesc();

    /** Used by activate() to deactivate every other active row sharing the same policy_code
     *  before flipping this one on - findByPolicyCodeAndActiveTrue assumes at most one. */
    List<ShowtimeAllocationPolicy> findAllByPolicyCodeAndActiveTrueAndPolicyIdNot(String policyCode, Long policyId);
}
