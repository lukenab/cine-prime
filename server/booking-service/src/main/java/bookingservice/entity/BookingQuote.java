package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "booking_quote", indexes = {
        @Index(name = "idx_quote_owner_expiry", columnList = "account_id,expires_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingQuote {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "quote_id", length = 50)
    String quoteId;

    @Column(name = "account_id", length = 50, nullable = false)
    String accountId;

    @Column(name = "showtime_id", nullable = false)
    Long showtimeId;

    @Column(name = "subtotal", precision = 15, scale = 2, nullable = false)
    BigDecimal subtotal;

    @Column(name = "discount_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal discountAmount;

    @Column(name = "fee_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal feeAmount;

    @Column(name = "final_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal finalAmount;

    @Column(name = "currency", length = 3, nullable = false)
    String currency;

    @Column(name = "quote_status", length = 30, nullable = false)
    String status;

    @Column(name = "request_hash", length = 128, nullable = false)
    String requestHash;

    @Column(name = "expires_at", nullable = false)
    OffsetDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<BookingQuoteItem> items = new ArrayList<>();
}
