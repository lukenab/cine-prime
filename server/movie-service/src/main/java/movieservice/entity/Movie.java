package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.MovieStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "movie")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Movie {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "movie_id")
    Long movieId;

    // ── External identifiers ──────────────────────────────────
    @Column(name = "tmdb_id", unique = true)
    Integer tmdbId;

    @Column(name = "imdb_id", unique = true, length = 20)
    String imdbId;

    @Column(name = "original_title", nullable = false, length = 500)
    String originalTitle;

    @Column(name = "original_language", nullable = false, length = 2)
    String originalLanguage = "en";

    // ── Metadata ──────────────────────────────────────────────
    @Column(name = "duration_minutes", nullable = false)
    Integer durationMinutes;

    @Column(name = "release_date")
    LocalDate releaseDate;

    @Column(name = "end_date")
    LocalDate endDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "age_rating_id")
    AgeRating ageRating;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id")
    ProductionCompany company;

    @Column(name = "country", length = 100)
    String country;

    // ── Media ─────────────────────────────────────────────────
    @Column(name = "poster_url", length = 500)
    String posterUrl;

    @Column(name = "thumbnail_url", length = 500)
    String thumbnailUrl;

    @Column(name = "trailer_url", length = 500)
    String trailerUrl;

    // Provenance for trailerUrl - see V5__add_movie_trailer_provenance.sql. Populated when
    // TmdbService selects a trailer from /movie/{id}/videos; trailerSource distinguishes an
    // auto-selected TMDB trailer from a manual admin override so a future re-sync can leave
    // manual overrides alone.
    @Column(name = "trailer_provider", length = 20)
    String trailerProvider;

    @Column(name = "trailer_external_key", length = 50)
    String trailerExternalKey;

    @Column(name = "trailer_language_code", length = 10)
    String trailerLanguageCode;

    @Column(name = "trailer_video_type", length = 20)
    String trailerVideoType;

    @Column(name = "trailer_official")
    Boolean trailerOfficial;

    @Builder.Default
    @Column(name = "trailer_source", nullable = false, length = 20)
    @org.hibernate.annotations.ColumnDefault("'MANUAL'")
    String trailerSource = "MANUAL";

    @Column(name = "synopsis", columnDefinition = "TEXT")
    String synopsis;

    // ── Status / lifecycle ────────────────────────────────────
    // Content-review status only — see MovieAvailability for per-cluster
    // exhibition state. See docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md.
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    MovieStatus status = MovieStatus.DRAFT;

    @Column(name = "rejection_note", columnDefinition = "TEXT")
    String rejectionNote;

    // Optimistic locking for lifecycle commands — a stale concurrent transition
    // throws ObjectOptimisticLockingFailureException, translated to 409 by
    // MovieService's transition methods (which use save(), not @Modifying bulk
    // updates, specifically so this actually engages).
    @Builder.Default
    @Version
    @Column(name = "version", nullable = false)
    Long version = 0L;

    // ── Relationships ─────────────────────────────────────────
    @ManyToMany
    @JoinTable(
            name = "movie_genre",
            joinColumns = @JoinColumn(name = "movie_id"),
            inverseJoinColumns = @JoinColumn(name = "genre_id")
    )
    List<Genre> genres;

    @ManyToMany
    @JoinTable(
            name = "movie_format",
            joinColumns = @JoinColumn(name = "movie_id"),
            inverseJoinColumns = @JoinColumn(name = "format_id")
    )
    List<ScreeningFormat> formats;

    @OneToMany(mappedBy = "movie", cascade = CascadeType.ALL, orphanRemoval = true)
    List<MovieTranslation> translations;

    @OneToMany(mappedBy = "movie", cascade = CascadeType.ALL, orphanRemoval = true)
    List<MovieCast> cast;

    @OneToMany(mappedBy = "movie", cascade = CascadeType.ALL, orphanRemoval = true,
            fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC NULLS LAST, imageId ASC")
    List<MovieImage> images;

    @OneToMany(mappedBy = "movie", fetch = FetchType.LAZY)
    List<ShowTime> showTimes;

    // ── Audit ─────────────────────────────────────────────────
    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    // ── Lifecycle hooks ───────────────────────────────────────
    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = MovieStatus.DRAFT;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
