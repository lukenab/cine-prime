package authservice.entity;

import authservice.enums.PasswordResetPurpose;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "password_reset")
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@Builder
public class PasswordReset {
   @Id
   @GeneratedValue(strategy = GenerationType.IDENTITY)
   @Column(name = "reset_id")
   Long resetId;

   @ManyToOne(fetch = FetchType.LAZY)
   @JoinColumn(name = "account_id", nullable = false)
   Account account;

   @Column(name = "token", nullable = false, unique = true, length = 255)
   String token;

   @Enumerated(EnumType.STRING)
   @Column(name = "purpose", length = 30)
   PasswordResetPurpose purpose;

   @Column(name = "expires_at", nullable = false)
   OffsetDateTime expiresAt;

   @Column(name = "used_at")
   OffsetDateTime usedAt;

   @Column(name = "is_used", nullable = false)
   @Builder.Default
    Boolean isUsed = false;

   @Column(name = "created_ip", columnDefinition = "inet")
   @ColumnTransformer(write = "?::inet")
   String createdIp;

   @CreationTimestamp
   @Column(name = "created_at", updatable = false)
   LocalDateTime createdAt;
}
