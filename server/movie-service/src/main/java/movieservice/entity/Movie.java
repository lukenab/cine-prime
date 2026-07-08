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

    @Column(name = "synopsis", columnDefinition = "TEXT")
    String synopsis;

    // ── Status / lifecycle ────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    MovieStatus status = MovieStatus.DRAFT;

    @Column(name = "suspended_reason", columnDefinition = "TEXT")
    String suspendedReason;

    @Column(name = "rejection_note", columnDefinition = "TEXT")
    String rejectionNote;

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
