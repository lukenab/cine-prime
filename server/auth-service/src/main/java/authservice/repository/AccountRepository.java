package authservice.repository;

import authservice.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.time.LocalDateTime;
import authservice.enums.AccountStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface AccountRepository extends JpaRepository<Account, String>, JpaSpecificationExecutor<Account> {
    Optional<Account> findByUsername(String username);
    Optional<Account> findByEmail(String email);
    Optional<Account> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    long countByStatus(AccountStatus status);

    long countByCreatedAtGreaterThanEqual(LocalDateTime createdAt);

    @Query("select count(distinct a) from Account a join a.roles r where r.roleName = :role")
    long countByRole(@Param("role") String role);
}

