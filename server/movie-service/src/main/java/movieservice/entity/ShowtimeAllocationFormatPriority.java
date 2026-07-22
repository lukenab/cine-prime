package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@Table(name = "showtime_allocation_format_priority")
public class ShowtimeAllocationFormatPriority {

    @EmbeddedId
    ShowtimeAllocationFormatPriorityId id;

    @MapsId("policyId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "policy_id", nullable = false)
    ShowtimeAllocationPolicy policy;

    @MapsId("formatId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "format_id", nullable = false)
    ScreeningFormat screeningFormat;

    @Column(name = "allocation_priority", nullable = false)
    Integer allocationPriority;

    @Column (name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column (name = "created_by", length = 100)
    String createdBy;

    @Column (name = "updated_by", length = 100)
    String updateBy;

    @PrePersist
    void prePersist()
    {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate()
    {
        updatedAt = LocalDateTime.now();
    }
}
