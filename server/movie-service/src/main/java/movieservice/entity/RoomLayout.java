package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.LayoutStatus;
import movieservice.enums.NumberingDirection;
import movieservice.enums.NumberingPolicy;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "room_layout",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_room_layout_version",
                columnNames = {"cinema_room_id", "version"}
        ))
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_layout_id")
    Long roomLayoutId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cinema_room_id", nullable = false)
    CinemaRoom cinemaRoom;

    @Column(name = "version", nullable = false)
    Integer version;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    LayoutStatus status = LayoutStatus.DRAFT;

    // So hang/vi tri toi da moi hang do wizard sinh layout ban dau — layout thuc te
    // (sau khi admin chinh sua) duoc phan anh boi tap RoomLayoutPosition, hai gia tri
    // nay chi con y nghia lich su/hien thi lai generator form.
    @Column(name = "number_of_rows", nullable = false)
    @Builder.Default
    Integer numberOfRows = 0;

    @Column(name = "max_positions_per_row", nullable = false)
    @Builder.Default
    Integer maxPositionsPerRow = 0;

    @Column(name = "first_row_label", nullable = false, length = 5)
    @Builder.Default
    String firstRowLabel = "A";

    @Enumerated(EnumType.STRING)
    @Column(name = "numbering_direction", nullable = false, length = 20)
    @Builder.Default
    NumberingDirection numberingDirection = NumberingDirection.LEFT_TO_RIGHT;

    @Enumerated(EnumType.STRING)
    @Column(name = "numbering_policy", nullable = false, length = 30)
    @Builder.Default
    NumberingPolicy numberingPolicy = NumberingPolicy.CONTIGUOUS_SEATS;

    @Column(name = "generator_template_code", length = 50)
    String generatorTemplateCode;

    @Column(name = "generator_template_version")
    Integer generatorTemplateVersion;

    /** JSON metadata used only to reopen the authoring assistant. Generated
     * positions remain the authoritative layout and capacity source. */
    @Column(name = "generation_config", columnDefinition = "TEXT")
    String generationConfig;

    // Backend-computed, read-only tu phia client — xem RoomLayoutService.recomputeCapacity()
    @Column(name = "person_capacity", nullable = false)
    @Builder.Default
    Integer personCapacity = 0;

    @Column(name = "sellable_unit_count", nullable = false)
    @Builder.Default
    Integer sellableUnitCount = 0;

    @Column(name = "submitted_at")
    LocalDateTime submittedAt;

    @Column(name = "submitted_by", length = 100)
    String submittedBy;

    @Column(name = "approved_at")
    LocalDateTime approvedAt;

    @Column(name = "approved_by", length = 100)
    String approvedBy;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    String rejectionReason;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @OneToMany(mappedBy = "roomLayout", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    List<RoomLayoutPosition> positions = new java.util.ArrayList<>();

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = LayoutStatus.DRAFT;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
