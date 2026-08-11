package authservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "account_identity",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_account_identity_provider_subject", columnNames = {"provider", "provider_subject"}),
                @UniqueConstraint(name = "uk_account_identity_account_provider", columnNames = {"account_id", "provider"})
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AccountIdentity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "identity_id", nullable = false, updatable = false, length = 36)
    String identityId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    Account account;

    @Column(name = "provider", nullable = false, length = 30)
    String provider;

    @Column(name = "provider_subject", nullable = false, length = 255)
    String providerSubject;

    @Column(name = "provider_email", nullable = false, length = 100)
    String providerEmail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    LocalDateTime updatedAt;
}
