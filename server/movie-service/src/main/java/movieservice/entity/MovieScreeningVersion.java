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

