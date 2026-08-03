package promotionservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import promotionservice.enums.PromotionTargetType;

import java.util.UUID;

@Entity
@Table(name = "promotion_target")
@Getter
@Setter
@NoArgsConstructor
public class PromotionTarget {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "promotion_target_id")
    private UUID promotionTargetId;

    @ManyToOne
    @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PromotionTargetType targetType;

    private Long movieId;
    private Long showtimeId;
}
