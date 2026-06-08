package authservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "auth_token")
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@Builder
public class AuthToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "token_id")
    private Long tokenId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", referencedColumnName = "account_id", nullable = false)
    private Account account;

    @Column(name = "token_type", length = 20)
    private String tokenType = "BEARER";

    @Column(name = "jwt_id", nullable = false, unique = true, length = 100)
    private String jwtId;

    @Column(name = "token", nullable = false, length = 500)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "issued_at", nullable = false)
    private OffsetDateTime issuedAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "is_revoked", columnDefinition = "boolean default false")
    private Boolean isRevoked;

    @Column(name = "created_ip", columnDefinition = "inet")
    private String createdIp;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
