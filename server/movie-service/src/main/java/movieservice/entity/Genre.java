package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.GenreStatus;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "genre")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Genre {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "genre_id")
    Long genreId;

    @Column(name = "genre_name", nullable = false, unique = true, length = 100)
    String genreName;

    @Column(name = "genre_code", nullable = false, unique = true, length = 50)
    String genreCode;

    /** Stable TMDB genre identity (source=TMDB) - primary matching key for resolveGenres(); nullable, unique (Postgres allows multiple NULLs). */
    @Column(name = "tmdb_genre_id", unique = true)
    Integer tmdbGenreId;

    /** ACTIVE = usable/curated taxonomy; PENDING_REVIEW = auto-created from an unmapped TMDB genre, not yet promoted by a genre admin. */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    GenreStatus status = GenreStatus.ACTIVE;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @ManyToMany(mappedBy = "genres")
    List<Movie> movies;
}
