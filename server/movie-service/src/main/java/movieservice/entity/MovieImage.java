package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

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

    // POSTER | BACKDROP | STILL | PROMOTIONAL
    @Column(name = "image_type", nullable = false, length = 30)
    String imageType;

    @Column(name = "display_order")
    Integer displayOrder;

    @Column(name = "caption", length = 255)
    String caption;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
