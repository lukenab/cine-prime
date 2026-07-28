package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "counter_payment", indexes = {
        @Index(name = "idx_counter_payment_booking", columnList = "booking_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CounterPayment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "counter_payment_id", length = 50)
    String counterPaymentId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    Booking booking;

    @Column(name = "payment_reference", length = 100, nullable = false, unique = true)
    String paymentReference;

    @Column(name = "receipt_reference", length = 100, nullable = false, unique = true)
    String receiptReference;

    @Column(name = "cashier_id", length = 50, nullable = false)
    String cashierId;

    @Column(name = "terminal_id", length = 50, nullable = false)
    String terminalId;

    @Column(name = "cluster_id", nullable = false)
    Long clusterId;

    @Column(name = "payment_method", length = 50, nullable = false)
    String paymentMethod;

    @Column(name = "amount", precision = 15, scale = 2, nullable = false)
    BigDecimal amount;

    @Column(name = "currency", length = 3, nullable = false)
    String currency;

    @Column(name = "collected_at", nullable = false)
    OffsetDateTime collectedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;
}
