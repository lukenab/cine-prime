package promotionservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import promotionservice.enums.PromotionUsageEventType;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "promotion_usage_ledger")
@Getter
@Setter
@NoArgsConstructor
public class PromotionUsageLedger {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "promotion_usage_ledger_id")
    private UUID promotionUsageLedgerId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promotion_reservation_id", nullable = false)
    private PromotionReservation reservation;
    private String accountId;
    private String bookingId;
    @Enumerated(EnumType.STRING)
    private PromotionUsageEventType eventType;
    private short usageDelta;
    private OffsetDateTime occurredAt;
}
