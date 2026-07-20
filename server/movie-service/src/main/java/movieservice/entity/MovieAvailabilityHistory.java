package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.AvailabilityStatus;

import java.time.LocalDateTime;

/** One row per MovieAvailability status transition — audit trail for MOV-LC-06. */
@Entity
@Table(name = "movie_availability_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieAvailabilityHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    Long historyId;

    @Column(name = "availability_id", nullable = false)
    Long availabilityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    AvailabilityStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    AvailabilityStatus toStatus;

    @Column(name = "actor", nullable = false, length = 100)
    String actor;

    @Column(name = "reason", length = 500)
    String reason;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
