package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

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

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @ManyToMany(mappedBy = "genres")
    List<Movie> movies;
}
