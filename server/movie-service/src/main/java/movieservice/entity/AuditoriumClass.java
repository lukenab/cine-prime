package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "auditorium_class")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AuditoriumClass {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "class_id")
    Integer classId;

    @Column(name = "class_code", nullable = false, unique = true, length = 20)
    // Commercial service tier only. Presentation/seat capabilities such as PLF
    // and MOTION belong to separate technical dimensions.
    String classCode;          // STANDARD, PREMIUM, LUXURY, PRIVATE

    @Column(name = "class_name", nullable = false, length = 100)
    String className;

    @Column(name = "description", length = 255)
    String description;

    @Column(name = "active", nullable = false)
    @Builder.Default
    Boolean active = true;
}
