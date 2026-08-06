package promotionservice.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import promotionservice.enums.PromotionStatus;
import promotionservice.enums.PromotionBenefitScope;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "promotion")
@Getter
@Setter
@NoArgsConstructor
public class Promotion {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "promotion_id")
    private UUID promotionId;

    @Column(nullable = false, unique = true, length = 64)
    private String code;

    @Column(nullable = false, length = 160)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "benefit_scope", nullable = false, length = 20)
    private PromotionBenefitScope benefitScope = PromotionBenefitScope.TICKETS;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PromotionStatus status;

    private OffsetDateTime validFrom;
    private OffsetDateTime validUntil;
    private Integer globalUsageLimit;
    private Integer perAccountUsageLimit;
    private int activeReservationCount;
    private int committedUsageCount;

    @Version
    @Column(nullable = false)
    private Long version;

    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    private OffsetDateTime updatedAt;

    @OneToOne(mappedBy = "promotion", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private PromotionPriceRule priceRule;

    @OneToMany(mappedBy = "promotion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PromotionTarget> targets = new ArrayList<>();

    public void replacePriceRule(PromotionPriceRule rule) {
        this.priceRule = rule;
        rule.setPromotion(this);
    }

    public void replaceTargets(List<PromotionTarget> newTargets) {
        targets.clear();
        newTargets.forEach(target -> {
            target.setPromotion(this);
            targets.add(target);
        });
    }
}
