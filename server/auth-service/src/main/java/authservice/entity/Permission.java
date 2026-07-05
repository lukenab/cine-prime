package authservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import lombok.experimental.FieldDefaults;


@Entity
@Table(name = "permission")
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@Builder
public class Permission {
    @Id
    @Column(name = "name", length = 100)
    String name;

    @Column(name = "description", length = 255)
    String description;
}
