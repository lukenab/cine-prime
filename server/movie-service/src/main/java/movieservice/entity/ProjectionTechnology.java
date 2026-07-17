package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "projection_technology")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectionTechnology {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tech_id")
    Integer techId;

    @Column(name = "tech_code", nullable = false, unique = true, length = 30)
    String techCode;           // XENON, LASER, DIRECT_VIEW_LED

    @Column(name = "tech_name", nullable = false, length = 100)
    String techName;

    @Column(name = "description", length = 255)
    String description;

    @Column(name = "active", nullable = false)
    @Builder.Default
    Boolean active = true;
}
