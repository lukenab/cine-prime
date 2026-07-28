package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ScreeningVersionStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "movie_screening_version")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieScreeningVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "screening_version_id")
    Long screeningVersionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "format_id", nullable = false)
    ScreeningFormat format;

    /**
     * Audio mix delivered with this version. V49 backfills the unresolved
     * legacy rows to the conservative Dolby 5.1 baseline, so every version
     * now has an explicit content-audio capability.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audio_format_id", nullable = false)
    AudioFormat audioFormat;

    @Column(name = "audio_language_code", nullable = false, length = 10)
    String audioLanguageCode;

    @Column(name = "subtitle_language_code", length = 10)
    String subtitleLanguageCode;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    ScreeningVersionStatus status = ScreeningVersionStatus.ACTIVE;

    @Column(name = "effective_from")
    LocalDate effectiveFrom;

    @Column(name = "effective_to")
    LocalDate effectiveTo;

    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;

    public boolean isEffectiveOn(LocalDate businessDate) {
        return status == ScreeningVersionStatus.ACTIVE
                && (effectiveFrom == null || !businessDate.isBefore(effectiveFrom))
                && (effectiveTo == null || !businessDate.isAfter(effectiveTo));
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (status == null) status = ScreeningVersionStatus.ACTIVE;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

