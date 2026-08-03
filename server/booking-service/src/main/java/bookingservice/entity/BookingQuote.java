package bookingservice.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Persistable;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Server-side checkout offer. It deliberately has no inventory hold or
 * promotion reservation: both are acquired only when a booking is created.
 */
@Entity
@Table(name = "booking_quote")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BookingQuote implements Persistable<String> {
    @Id
    @Column(name = "quote_id", length = 36)
    private String quoteId;
    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;
    @Column(name = "showtime_id", nullable = false)
    private Long showtimeId;
    @Column(name = "movie_id", nullable = false)
    private Long movieId;
    @Column(name = "cluster_id")
    private Long clusterId;
    @Column(name = "promotion_code", length = 100)
    private String promotionCode;
    @Column(name = "promotion_id", length = 36)
    private String promotionId;
    @Column(name = "subtotal_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotalAmount;
    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountAmount;
    @Column(name = "final_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal finalAmount;
    @Column(name = "currency", nullable = false, length = 10)
    private String currency;
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
    @Column(name = "status", nullable = false, length = 20)
    private String status;
    @Column(name = "consumed_booking_id", length = 50)
    private String consumedBookingId;
    @OneToMany(mappedBy = "bookingQuote", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BookingQuoteItem> items = new ArrayList<>();
    @Transient
    @Builder.Default
    private boolean newQuote = true;

    @Override public String getId() { return quoteId; }
    @Override public boolean isNew() { return newQuote; }
    @jakarta.persistence.PrePersist
    void assignId() { if (quoteId == null) quoteId = UUID.randomUUID().toString(); }
    @jakarta.persistence.PostLoad @jakarta.persistence.PostPersist
    void markNotNew() { newQuote = false; }
}
