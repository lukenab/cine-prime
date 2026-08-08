package loyaltyservice.repository;

import loyaltyservice.entity.MembershipAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MembershipAccountRepository extends JpaRepository<MembershipAccount, UUID> {
    Optional<MembershipAccount> findByAccountId(String accountId);
}
