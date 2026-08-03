package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Server-side checkout offer. It deliberately has no inventory hold or
 * promotion reservation: both are acquired only when a booking is created.
 */
@Entity
@Table(name = "booking_quote", indexes = {
        @Index(name = "idx_quote_owner_expiry", columnList = "account_id,expires_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingQuote implements Persistable<String> {
    @Id
    @Column(name = "quote_id", length = 50)
    String quoteId;

    @Column(name = "account_id", length = 50, nullable = false)
    String accountId;

    @Column(name = "showtime_id", nullable = false)
    Long showtimeId;

    @Column(name = "movie_id", nullable = false)
    Long movieId;

    @Column(name = "cluster_id")
    Long clusterId;

    @Column(name = "promotion_code", length = 100)
    String promotionCode;

    @Column(name = "promotion_id", length = 36)
    String promotionId;

    @Column(name = "subtotal_amount", nullable = false, precision = 12, scale = 2)
    BigDecimal subtotalAmount;

    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    BigDecimal discountAmount;

    @Column(name = "final_amount", nullable = false, precision = 12, scale = 2)
    BigDecimal finalAmount;

    @Column(name = "currency", nullable = false, length = 10)
    String currency;

    @Column(name = "expires_at", nullable = false)
    LocalDateTime expiresAt;

    @Column(name = "quote_status", nullable = false, length = 20)
    String status;

    @Column(name = "consumed_booking_id", length = 50)
    String consumedBookingId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @OneToMany(mappedBy = "bookingQuote", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<BookingQuoteItem> items = new ArrayList<>();

    @Transient
    @Builder.Default
    boolean newQuote = true;

    @Override
    public String getId() {
        return quoteId;
    }

    @Override
    public boolean isNew() {
        return newQuote;
    }

    @PrePersist
    void assignId() {
        if (quoteId == null) quoteId = UUID.randomUUID().toString();
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        newQuote = false;
    }
}
