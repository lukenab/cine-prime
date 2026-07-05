package authservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "auth_token")
@AllArgsConstructor @NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter @Setter @Builder
public class AuthToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "token_id")
    Long tokenId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    Account account;

    @Column(name = "jwt_id", nullable = false, unique = true, length = 100)
    String jwtId;

    @Column(name = "token_type", length = 20)
    @Builder.Default
    String tokenType = "BEARER";

    @Column(name = "expires_at", nullable = false)
    OffsetDateTime expiresAt;

    @Column(name = "issued_at", nullable = false)
    OffsetDateTime issuedAt;

    @Column(name = "is_revoked", nullable = false)
    @Builder.Default
    Boolean isRevoked = false;

    @Column(name = "revoked_at")
    OffsetDateTime revokedAt;

    @Column(name = "created_ip", columnDefinition = "inet")
    @ColumnTransformer(write = "?::inet")
    String createdIp;

    @Column(name = "user_agent", length = 255)
    String userAgent;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;


}
