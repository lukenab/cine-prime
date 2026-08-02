package promotionservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import promotionservice.enums.DiscountType;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "promotion_price_rule")
@Getter
@Setter
@NoArgsConstructor
public class PromotionPriceRule {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "promotion_price_rule_id")
    private UUID promotionPriceRuleId;

    @OneToOne
    @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DiscountType discountType;

    private BigDecimal percentage;
    private BigDecimal fixedAmount;
    private BigDecimal maxDiscountAmount;
    private BigDecimal minimumOrderAmount;
    private String currency;
}
