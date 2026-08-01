package authservice.repository;

import authservice.entity.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

@Repository
public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {

    Optional<AuthToken> findByJwtId(String jwtId);

    // Dùng khi logout: đánh dấu token bị thu hồi
    @Modifying
    @Transactional
    @Query("UPDATE AuthToken t SET t.isRevoked = true, t.revokedAt = :revokedAt WHERE t.jwtId = :jwtId")
    void revokeByJwtId(@Param("jwtId") String jwtId, @Param("revokedAt") OffsetDateTime revokedAt);

    @Modifying
    @Transactional
    @Query("UPDATE AuthToken t SET t.isRevoked = true, t.revokedAt = :revokedAt " +
            "WHERE t.account.accountId = :accountId AND t.isRevoked = false")
    int revokeAllByAccountId(@Param("accountId") String accountId,
                             @Param("revokedAt") OffsetDateTime revokedAt);

    // Dùng bởi TokenCleanupScheduler chạy hàng đêm
    @Modifying
    @Transactional
    @Query("DELETE FROM AuthToken t WHERE t.expiresAt < :now")
    void deleteExpiredTokens(@Param("now") OffsetDateTime now);
}
