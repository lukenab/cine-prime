package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ShowtimeDaypart;

import java.math.BigDecimal;
import java.time.LocalTime;

@Entity
@Table(name = "showtime_daypart_policy",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_showtime_daypart_policy",
                columnNames = {"policy_id", "daypart_code"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowtimeDaypartPolicy {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "daypart_policy_id")
    Long daypartPolicyId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "policy_id", nullable = false)
    ShowtimeAllocationPolicy policy;

    @Enumerated(EnumType.STRING)
    @Column(name = "daypart_code", nullable = false, length = 20)
    ShowtimeDaypart daypartCode;

    @Column(name = "start_time", nullable = false)
    LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    LocalTime endTime;

    @Column(name = "weekday_demand_multiplier", nullable = false, precision = 5, scale = 4)
    BigDecimal weekdayDemandMultiplier;

    @Column(name = "weekend_demand_multiplier", nullable = false, precision = 5, scale = 4)
    BigDecimal weekendDemandMultiplier;

    @Builder.Default
    @Column(nullable = false)
    Boolean active = true;
}
