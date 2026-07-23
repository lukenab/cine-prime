package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.GenerationReason;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "schedule_plan_slot")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SchedulePlanSlot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_plan_slot_id")
    Long schedulePlanSlotId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_plan_id", nullable = false)
    SchedulePlan schedulePlan;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cinema_room_id", nullable = false)
    CinemaRoom cinemaRoom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "screening_version_id", nullable = false)
    MovieScreeningVersion screeningVersion;

    @Column(name = "start_at", nullable = false) OffsetDateTime startAt;
    @Column(name = "end_at", nullable = false) OffsetDateTime endAt;
    @Column(name = "business_date", nullable = false) LocalDate businessDate;
    @Column(name = "base_price", precision = 12, scale = 2) BigDecimal basePrice;
    @Column(name = "total_seats") Integer totalSeats;

    @Column(name = "allocation_score", precision = 10, scale = 4) BigDecimal allocationScore;
    @Column(name = "daypart_code", length = 20) String daypartCode;
    @Column(name = "movie_demand_score", precision = 6, scale = 4) BigDecimal movieDemandScore;
    @Column(name = "cluster_demand_score", precision = 6, scale = 4) BigDecimal clusterDemandScore;
    @Column(name = "time_demand_score", precision = 6, scale = 4) BigDecimal timeDemandScore;
    @Column(name = "format_demand_score", precision = 6, scale = 4) BigDecimal formatDemandScore;
    @Column(name = "capacity_fit_score", precision = 6, scale = 4) BigDecimal capacityFitScore;
    @Column(name = "expected_attendance") Integer expectedAttendance;

    @Enumerated(EnumType.STRING)
    @Column(name = "generation_reason", length = 100)
    GenerationReason generationReason;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_showtime_id")
    ShowTime publishedShowtime;

    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}

