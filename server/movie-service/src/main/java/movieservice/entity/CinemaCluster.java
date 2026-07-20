package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ClusterStatus;
import movieservice.enums.CinemaVenueType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
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

    @Column(name = "cluster_code", nullable = false, length = 20, unique = true)
    String clusterCode;

    @Column(name = "cluster_name", nullable = false, length = 100)
    String clusterName;

    @Enumerated(EnumType.STRING)
    @Column(name = "venue_type", nullable = false, length = 20)
    CinemaVenueType venueType;

    @Column(name = "opening_date")
    LocalDate openingDate;

    @Column(name = "public_email", length = 150)
    String publicEmail;

    @Column(name = "country_code", nullable = false, length = 2)
    String countryCode;

    @Column(name = "province", nullable = false, length = 100)
    String province;

    @Column(name = "ward", length = 100)
    String ward;

    @Column(name = "postal_code", length = 20)
    String postalCode;

    @Column(name = "building_name", length = 150)
    String buildingName;

    @Column(name = "floor_location", length = 50)
    String floorLocation;

    @Column(name = "address", nullable = false, length = 255)
    String address;

    @Column(name = "phone_number", length = 20)
    String phoneNumber;

    @Column(name = "latitude", precision = 10, scale = 7)
    BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    BigDecimal longitude;

    @Column(name = "timezone", nullable = false, length = 50)
    String timezone;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
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

    @Builder.Default
    @OneToMany(mappedBy = "cluster", cascade = CascadeType.ALL, orphanRemoval = true)
    List<CinemaClusterOperatingHour> operatingHours = new ArrayList<>();

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = ClusterStatus.DRAFT;
        if (venueType == null) venueType = CinemaVenueType.MALL;
        if (countryCode == null) countryCode = "VN";
        if (timezone == null) timezone = "Asia/Ho_Chi_Minh";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
