package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Entity
@Table(name = "movie_translation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieTranslation {

    @EmbeddedId
    MovieTranslationId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("movieId")
    @JoinColumn(name = "movie_id")
    Movie movie;

    @Column(name = "title", nullable = false, length = 500)
    String title;

    @Column(name = "synopsis", columnDefinition = "TEXT")
    String synopsis;

    // [Backend] Add tagline field to Movie and MovieTranslation entities - localized tagline.
    @Column(name = "tagline", length = 500)
    String tagline;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
