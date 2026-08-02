package promotionservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import promotionservice.enums.PromotionReservationStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "promotion_reservation")
@Getter
@Setter
@NoArgsConstructor
public class PromotionReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "promotion_reservation_id")
    private UUID promotionReservationId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;
    private String bookingId;
    private String accountId;
    private String idempotencyKey;
    @Enumerated(EnumType.STRING)
    private PromotionReservationStatus status;
    private BigDecimal subtotalAmount;
    private BigDecimal discountAmount;
    private BigDecimal finalAmount;
    private String currency;
    private OffsetDateTime reservedAt;
    private OffsetDateTime expiresAt;
    private OffsetDateTime committedAt;
    private OffsetDateTime releasedAt;
    private OffsetDateTime expiredAt;
    @Version
    private Long version;
}
