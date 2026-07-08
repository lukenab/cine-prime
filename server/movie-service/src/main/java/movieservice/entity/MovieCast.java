package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "movie_cast",
        uniqueConstraints = @UniqueConstraint(columnNames = {"movie_id", "person_id", "role_type"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieCast {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cast_id")
    Long castId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "person_id", nullable = false)
    Person person;

    // ACTOR | DIRECTOR | WRITER | PRODUCER | COMPOSER
    @Column(name = "role_type", nullable = false, length = 20)
    String roleType;

    // Tên nhân vật — chỉ điền cho ACTOR
    @Column(name = "character_name", length = 255)
    String characterName;

    // Thứ tự xuất hiện trong credit (1 = top billing)
    @Column(name = "billing_order")
    Integer billingOrder;
}
