package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import movieservice.enums.MovieImageType;

@Entity
@Table(name = "movie_image")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    Long imageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @Column(name = "image_url", nullable = false, length = 500)
    String imageUrl;

    // POSTER | BACKDROP | STILL | PROMOTIONAL | LOGO
    @Enumerated(EnumType.STRING)
    @Column(name = "image_type", nullable = false, length = 30)
    MovieImageType imageType;

    @Column(name = "display_order")
    Integer displayOrder;

    @Column(name = "caption", length = 255)
    String caption;

    // TMDB | MANUAL | CLOUDINARY - where this asset came from
    @Column(name = "source", length = 30)
    String source;

    // Upstream provider's own path/id (e.g. TMDB file_path) - combined with source +
    // movie_id, prevents duplicate re-import (see uq_movie_image_source_path).
    @Column(name = "external_path", length = 500)
    String externalPath;

    @Column(name = "language_code", length = 10)
    String languageCode;

    @Column(name = "width")
    Integer width;

    @Column(name = "height")
    Integer height;

    @Column(name = "aspect_ratio", precision = 6, scale = 3)
    BigDecimal aspectRatio;

    // The recommended/primary pick for this image_type at import time.
    @Column(name = "is_default", nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    Boolean isDefault = false;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
