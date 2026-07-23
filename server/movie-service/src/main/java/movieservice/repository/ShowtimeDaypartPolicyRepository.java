package movieservice.repository;

import movieservice.entity.ShowtimeDaypartPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShowtimeDaypartPolicyRepository extends JpaRepository<ShowtimeDaypartPolicy, Long> {
    List<ShowtimeDaypartPolicy> findByPolicy_PolicyIdAndActiveTrueOrderByStartTime(Long policyId);
}
