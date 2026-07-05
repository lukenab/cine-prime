package authservice.entity;

import authservice.enums.AccountStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Table(name = "account")
@AllArgsConstructor @NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter @Setter @Builder
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "account_id", updatable = false, nullable = false, length = 36)
    String accountId;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    String username;

    @Column(name = "email", nullable = false, unique = true, length = 100)
    String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    AccountStatus status = AccountStatus.PENDING;

    @Column(name = "failed_login_attempts", nullable = false)
    @ColumnDefault("0")
    @Builder.Default
    int failedLoginAttempts = 0;

    @Column(name = "locked_until")
    LocalDateTime lockedUntil;

    @Column(name = "email_verified_at")
    LocalDateTime emailVerifiedAt;

    @Column(name = "last_login_at")
    LocalDateTime lastLoginAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "account_role",
            joinColumns = @JoinColumn(name = "account_id"),
            inverseJoinColumns = @JoinColumn(name = "role_name")
    )
    Set<Role> roles;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    LocalDateTime updatedAt;
}
