package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "screening_format")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScreeningFormat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "format_id")
    Integer formatId;

    @Column(name = "format_code", nullable = false, unique = true, length = 20)
    String formatCode;         // 2D, 3D, IMAX, 4DX, SCREENX, ATMOS

    @Column(name = "format_name", nullable = false, length = 100)
    String formatName;

    @Column(name = "description", length = 255)
    String description;

    @Column(name = "surcharge", nullable = false, precision = 10, scale = 2)
    BigDecimal surcharge;

    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    String status = "ACTIVE";

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "ACTIVE";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
