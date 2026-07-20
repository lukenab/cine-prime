package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.MovieSchedulingScoreSource;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "movie_scheduling_profile")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class MovieSchedulingProfile {

    @Id
    @Column(name = "movie_id")
    Long movieId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @Column(name = "priority_override", precision = 5, scale = 2)
    BigDecimal priorityOverride;

    @Builder.Default
    @Column(name = "popularity_score", nullable = false, precision = 5, scale = 2)
    BigDecimal popularityScore = BigDecimal.ZERO;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column (name = "score_source", nullable = false, length = 20)
    MovieSchedulingScoreSource scoreSource = MovieSchedulingScoreSource.MANUAL;

    @Column(name = "created_at")
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @PrePersist
    void prePersist()
    {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;

        if (scoreSource == null){
            scoreSource = MovieSchedulingScoreSource.MANUAL;
        }
    }

    @PreUpdate
    void preUpdate()
    {
        updatedAt = LocalDateTime.now();
    }
}
