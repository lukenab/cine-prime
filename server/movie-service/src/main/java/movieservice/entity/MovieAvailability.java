package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.AvailabilityStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A release/exhibition window for one movie at one cinema cluster. Multiple
 * rows can exist per movie (different clusters, or a re-release at the same
 * cluster with a different showing_start_date). Independent from
 * Movie.status — see docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md.
 */
@Entity
@Table(name = "movie_availability")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieAvailability {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "availability_id")
    Long availabilityId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id", nullable = false)
    CinemaCluster cluster;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    AvailabilityStatus status = AvailabilityStatus.PLANNED;

    @Column(name = "sales_start_at")
    LocalDateTime salesStartAt;

    @Column(name = "showing_start_date", nullable = false)
    LocalDate showingStartDate;

    @Column(name = "showing_end_date")
    LocalDate showingEndDate;

    @Column(name = "suspension_reason", length = 500)
    String suspensionReason;

    @Column(name = "review_note", length = 500)
    String reviewNote;

    @Column(name = "submitted_at")
    LocalDateTime submittedAt;

    @Column(name = "submitted_by", length = 100)
    String submittedBy;

    @Column(name = "approved_at")
    LocalDateTime approvedAt;

    @Column(name = "approved_by", length = 100)
    String approvedBy;

    @Builder.Default
    @Version
    @Column(name = "version", nullable = false)
    Long version = 0L;

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
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = AvailabilityStatus.PLANNED;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
