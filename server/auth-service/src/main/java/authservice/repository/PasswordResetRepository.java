package authservice.repository;

import authservice.entity.Account;
import authservice.entity.PasswordReset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {

    Optional<PasswordReset> findByToken(String token);

    Optional<PasswordReset> findByAccountAndIsUsedFalse(Account account);
    @Modifying
    @Transactional
    @Query("DELETE FROM PasswordReset pr WHERE pr.expiresAt < :now")
    void deleteExpiredResets(@Param("now") java.time.OffsetDateTime now);

    @Modifying
    @Transactional
    @Query("UPDATE PasswordReset pr SET pr.isUsed = true WHERE pr.account = :account AND pr.isUsed = false")
    void invalidatePendingResets(@Param("account") Account account);
}
