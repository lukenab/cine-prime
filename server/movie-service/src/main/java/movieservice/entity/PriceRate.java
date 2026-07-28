package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.PriceRateDayType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "price_rate")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PriceRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "price_rate_id")
    Long priceRateId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "price_book_id", nullable = false)
    PriceBook priceBook;

    @Column(nullable = false, length = 120)
    String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_type", nullable = false, length = 20)
    @Builder.Default
    PriceRateDayType dayType = PriceRateDayType.ALL_DAYS;

    @Column(name = "start_time", nullable = false)
    LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    LocalTime endTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "format_id")
    ScreeningFormat format;

    @Column(name = "standard_price", nullable = false, precision = 12, scale = 2)
    BigDecimal standardPrice;

    @Column(name = "vip_multiplier", nullable = false, precision = 6, scale = 3)
    @Builder.Default
    BigDecimal vipMultiplier = new BigDecimal("1.250");

    @Column(name = "couple_multiplier", nullable = false, precision = 6, scale = 3)
    @Builder.Default
    BigDecimal coupleMultiplier = new BigDecimal("1.800");

    @Column(name = "accessible_multiplier", nullable = false, precision = 6, scale = 3)
    @Builder.Default
    BigDecimal accessibleMultiplier = BigDecimal.ONE;

    @Column(nullable = false)
    @Builder.Default
    Integer priority = 0;

    @Column(nullable = false)
    @Builder.Default
    Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (dayType == null) dayType = PriceRateDayType.ALL_DAYS;
        if (vipMultiplier == null) vipMultiplier = new BigDecimal("1.250");
        if (coupleMultiplier == null) coupleMultiplier = new BigDecimal("1.800");
        if (accessibleMultiplier == null) accessibleMultiplier = BigDecimal.ONE;
        if (priority == null) priority = 0;
        if (active == null) active = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
