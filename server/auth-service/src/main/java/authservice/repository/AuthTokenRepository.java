package authservice.repository;

import authservice.entity.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.OffsetDateTime;
import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {

    Optional<AuthToken> findByJwtId(String jwtId);

    @Modifying
    @Query("UPDATE AuthToken t SET t.isRevoked = true, t.revokedAt = :revokedAt WHERE t.jwtId = :jwtId")
    void revokeByJwtId(@Param("jwtId") String jwtId, @Param("revokedAt") OffsetDateTime revokedAt);

    @Modifying
    @Query("DELETE FROM AuthToken t WHERE t.expiresAt < :now")
    void deleteExpiredTokens(@Param("now") OffsetDateTime now);
}
