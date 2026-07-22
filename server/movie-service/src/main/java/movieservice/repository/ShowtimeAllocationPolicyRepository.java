package movieservice.repository;

import movieservice.entity.ShowtimeAllocationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShowtimeAllocationPolicyRepository extends JpaRepository<ShowtimeAllocationPolicy, Long> {

    Optional<ShowtimeAllocationPolicy> findByPolicyCodeAndActiveTrue(String policyCode);
}
