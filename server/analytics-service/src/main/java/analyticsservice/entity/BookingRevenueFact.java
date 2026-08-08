package analyticsservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_revenue_fact",
        uniqueConstraints = @UniqueConstraint(name = "uk_booking_revenue_source_event", columnNames = "source_event_id"),
        indexes = {
                @Index(name = "idx_booking_revenue_cluster_date", columnList = "cluster_id,business_date"),
                @Index(name = "idx_booking_revenue_booking", columnList = "booking_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingRevenueFact {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "fact_id", length = 100)
    String factId;

    @Column(name = "source_event_id", nullable = false, length = 100)
    String sourceEventId;

    @Column(name = "event_version", nullable = false, length = 30)
    String eventVersion;

    @Column(name = "booking_id", nullable = false, length = 100)
    String bookingId;

    @Column(name = "cluster_id", nullable = false)
    Long clusterId;

    @Column(name = "showtime_id", nullable = false)
    Long showtimeId;

    @Column(name = "business_date", nullable = false)
    LocalDate businessDate;

    @Column(name = "occurred_at", nullable = false)
    OffsetDateTime occurredAt;

    @Column(name = "projected_at", nullable = false)
    OffsetDateTime projectedAt;

    @Column(name = "ticket_count", nullable = false)
    Integer ticketCount;

    @Column(name = "ticket_amount", nullable = false, precision = 19, scale = 2)
    BigDecimal ticketAmount;

    @Column(name = "concession_amount", nullable = false, precision = 19, scale = 2)
    BigDecimal concessionAmount;

    @Column(name = "discount_amount", nullable = false, precision = 19, scale = 2)
    BigDecimal discountAmount;

    @Column(name = "final_amount", nullable = false, precision = 19, scale = 2)
    BigDecimal finalAmount;

    @Column(name = "refund_amount", nullable = false, precision = 19, scale = 2)
    BigDecimal refundAmount;

    @Column(name = "currency", nullable = false, length = 3)
    String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome_status", nullable = false, length = 30)
    BookingOutcomeStatus outcomeStatus;
}
