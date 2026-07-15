package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ClusterStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "cinema_cluster")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaCluster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cluster_id")
    Long clusterId;

    @Column(name = "cluster_name", nullable = false, length = 100)
    String clusterName;

    @Column(name = "province", nullable = false, length = 100)
    String province;

    @Column(name = "address", nullable = false, length = 255)
    String address;

    @Column(name = "phone_number", length = 20)
    String phoneNumber;

    @Column(name = "latitude", precision = 10, scale = 7)
    BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    BigDecimal longitude;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    ClusterStatus status = ClusterStatus.DRAFT;

    @Column(name = "rejection_note", columnDefinition = "TEXT")
    String rejectionNote;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @OneToMany(mappedBy = "cluster", fetch = FetchType.LAZY)
    List<CinemaRoom> rooms;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = ClusterStatus.DRAFT;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
