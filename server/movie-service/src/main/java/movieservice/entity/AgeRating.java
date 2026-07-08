package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "age_rating")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AgeRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rating_id")
    Integer ratingId;

    @Column(name = "rating_code", nullable = false, unique = true, length = 5)
    String ratingCode;         // P, K, T13, T16, T18, C

    @Column(name = "min_age", nullable = false)
    Integer minAge;

    @Column(name = "description", nullable = false, length = 255)
    String description;
}
