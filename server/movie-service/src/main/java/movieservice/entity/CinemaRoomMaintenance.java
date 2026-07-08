package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.MaintenanceSeverity;

import java.time.LocalDateTime;

@Entity
@Table(name = "cinema_room_maintenance")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomMaintenance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maintenance_id")
    Long maintenanceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cinema_room_id", nullable = false)
    CinemaRoom cinemaRoom;

    // Mô tả sự cố / lý do bảo trì
    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 10)
    MaintenanceSeverity severity;

    @Column(name = "started_at", nullable = false)
    LocalDateTime startedAt;

    @Column(name = "resolved_at")
    LocalDateTime resolvedAt;

    @Column(name = "resolved", nullable = false)
    Boolean resolved = false;

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    String resolutionNote;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        if (startedAt == null) startedAt = LocalDateTime.now();
        if (resolved == null) resolved = false;
    }
}
