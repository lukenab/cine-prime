package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.SchedulePlanStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule_plan")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SchedulePlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_plan_id")
    Long schedulePlanId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "generation_run_id", nullable = false, unique = true)
    ShowtimeGenerationRun generationRun;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    SchedulePlanStatus status;

    @Builder.Default
    @OneToMany(mappedBy = "schedulePlan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("businessDate ASC, startAt ASC")
    List<SchedulePlanSlot> slots = new ArrayList<>();

    @Column(name = "submitted_at") LocalDateTime submittedAt;
    @Column(name = "submitted_by", length = 100) String submittedBy;
    @Column(name = "published_at") LocalDateTime publishedAt;
    @Column(name = "published_by", length = 100) String publishedBy;
    @Column(name = "review_note", columnDefinition = "TEXT") String reviewNote;

    @Builder.Default
    @Column(name = "blocker_count", nullable = false) Integer blockerCount = 0;
    @Column(name = "validation_summary", columnDefinition = "TEXT") String validationSummary;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @Column(name = "created_at", nullable = false, updatable = false) LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) LocalDateTime updatedAt;

    public void addSlot(SchedulePlanSlot slot) {
        slots.add(slot);
        slot.setSchedulePlan(this);
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (status == null) status = SchedulePlanStatus.DRAFT_GENERATED;
        if (version == null) version = 0L;
    }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }
}
