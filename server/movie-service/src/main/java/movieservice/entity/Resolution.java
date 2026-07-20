package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "resolution")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Resolution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "resolution_id")
    Integer resolutionId;

    @Column(name = "resolution_code", nullable = false, unique = true, length = 10)
    String resolutionCode;     // 2K, 4K

    @Column(name = "resolution_name", nullable = false, length = 50)
    String resolutionName;

    @Column(name = "description", length = 255)
    String description;

    @Column(name = "active", nullable = false)
    @Builder.Default
    Boolean active = true;
}
