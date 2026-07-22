package movieservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import movieservice.enums.DemandTier;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cinema_cluster_demand_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaClusterDemandProfile {

    @Id
    @Column(name = "cluster_id")
    Long clusterId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cluster_id", nullable = false)
    CinemaCluster cluster;

    @Enumerated(EnumType.STRING)
    @Column(name = "demand_tier", nullable = false, length = 10)
    DemandTier demandTier;

    @Column(name = "demand_score", nullable = false, precision = 5, scale = 2)
    BigDecimal demandScore;

    @Column(name = "min_daily_shows", nullable = false)
    Integer minDailyShows;

    @Column(name = "max_daily_shows_per_movie", nullable = false)
    Integer maxDailyShowsPerMovie;

    @Column(name = "unique_customer_count")
    Long uniqueCustomerCount;

    @Column(name = "booking_count")
    Long bookingCount;

    @Column(precision = 14, scale = 2)
    BigDecimal revenue;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
