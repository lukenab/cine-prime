package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ProgrammingShareMeasurementBasis;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "programming_share_policy")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProgrammingSharePolicy {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_id") Long policyId;
    @Column(name = "policy_code", nullable = false, unique = true, length = 80) String policyCode;
    @Column(name = "market_code", nullable = false, length = 10) String marketCode;
    @Column(name = "effective_from", nullable = false) LocalDate effectiveFrom;
    @Column(name = "effective_to", nullable = false) LocalDate effectiveTo;
    @Enumerated(EnumType.STRING)
    @Column(name = "measurement_basis", nullable = false, length = 30)
    ProgrammingShareMeasurementBasis measurementBasis;
    @Column(name = "required_share", nullable = false, precision = 5, scale = 4) BigDecimal requiredShare;
    @Column(name = "source_reference", nullable = false, length = 500) String sourceReference;
    @Builder.Default @Column(name = "hard_enforcement", nullable = false) Boolean hardEnforcement = true;
    @Builder.Default @Column(nullable = false) Boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false) LocalDateTime createdAt;

    @PrePersist void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (active == null) active = true;
        if (hardEnforcement == null) hardEnforcement = true;
    }
}
