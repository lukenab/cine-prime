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

    // MALE | FEMALE | NON_BINARY | UNKNOWN (kept as String per issue #153 to avoid enum migration)
    @Column(name = "gender", length = 10)
    String gender;

    // TMDB known_for_department: Acting | Directing | Writing | Production | ...
    @Column(name = "known_for_department", length = 50)
    String knownForDepartment;

    @Column(name = "death_date")
    LocalDate deathDate;

    @Column(name = "place_of_birth", length = 255)
    String placeOfBirth;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;
}
