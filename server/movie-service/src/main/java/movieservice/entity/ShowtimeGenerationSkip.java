package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.GenerationSkipReason;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowtimeGenerationSkip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "skip_id")
    Long skipId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "generation_run_id", nullable = false)
    ShowtimeGenerationRun generationRun;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id")
    Movie movies;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id")
    CinemaCluster cluster;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cinema_room_id")
    CinemaRoom cinemaRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "format_id")
    ScreeningFormat  screeningFormat;

    @Column(name = "show_date")
    LocalDate showDate;

    @Column(name = "start_time")
    LocalTime startTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 100)
    GenerationSkipReason reason;

    @Column(columnDefinition = "TEXT")
    String detail;

    /// Số candidate cùng movie + cluster + reason được gộp vào một dòng audit này.
    @Builder.Default
    @Column(name = "occurrence_count", nullable = false)
    Integer occurrenceCount = 1;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;

    @PrePersist
    void prePersist(){
        if(createdAt == null){
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (occurrenceCount == null || occurrenceCount < 1) {
            occurrenceCount = 1;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

}
