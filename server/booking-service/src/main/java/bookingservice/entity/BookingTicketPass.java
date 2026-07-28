package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_ticket_pass", indexes = {
        @Index(name = "idx_ticket_pass_token_hash", columnList = "token_hash")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingTicketPass {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "ticket_pass_id", length = 50)
    String ticketPassId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    Booking booking;

    @Column(name = "token_hash", length = 128, nullable = false, unique = true)
    String tokenHash;

    @Column(name = "token_ciphertext", columnDefinition = "text", nullable = false)
    String tokenCiphertext;

    @Column(name = "key_version", length = 50, nullable = false)
    String keyVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "pass_status", length = 20, nullable = false)
    TicketPassStatus status;

    @Column(name = "revoked_at")
    OffsetDateTime revokedAt;

    @Column(name = "revoked_reason", length = 255)
    String revokedReason;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @CreationTimestamp
    @Column(name = "issued_at", nullable = false, updatable = false)
    OffsetDateTime issuedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}
