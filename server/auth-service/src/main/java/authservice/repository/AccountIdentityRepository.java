package authservice.repository;

import authservice.entity.AccountIdentity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AccountIdentityRepository extends JpaRepository<AccountIdentity, String> {
    Optional<AccountIdentity> findByProviderAndProviderSubject(String provider, String providerSubject);
}
