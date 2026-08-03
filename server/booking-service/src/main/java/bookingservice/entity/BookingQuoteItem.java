package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/**
 * Line items in a booking quote, supporting both seat and non-seat items.
 * Promotion integration stores SEAT items only with pricing snapshot.
 */
@Entity
@Table(name = "booking_quote_item", indexes = {
        @Index(name = "idx_quote_item_quote", columnList = "quote_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingQuoteItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "quote_item_id", length = 50)
    String quoteItemId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "quote_id", nullable = false)
    BookingQuote quote;

    @Column(name = "item_type", length = 30, nullable = false)
    String itemType;

    @Column(name = "external_item_id", length = 100, nullable = false)
    String externalItemId;

    @Column(name = "item_name", length = 255, nullable = false)
    String itemName;

    @Column(name = "quantity", nullable = false)
    Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false)
    BigDecimal unitPrice;

    @Column(name = "discount_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal discountAmount;

    @Column(name = "final_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal finalAmount;

    // Fields from HEAD (promotion integration) for SEAT items
    @Column(name = "showtime_seat_id")
    Long showtimeSeatId;

    @Column(name = "seat_code", length = 20)
    String seatCode;
}
