package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "person")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Person {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "person_id")
    Long personId;

    @Column(name = "full_name", nullable = false, length = 255)
    String fullName;

    @Column(name = "birth_date")
    LocalDate birthDate;

    @Column(name = "nationality", length = 100)
    String nationality;

    @Column(name = "photo_url", length = 500)
    String photoUrl;

    @Column(name = "biography", columnDefinition = "TEXT")
    String biography;

    @Column(name = "tmdb_id", unique = true)
    Integer tmdbId;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;
}
