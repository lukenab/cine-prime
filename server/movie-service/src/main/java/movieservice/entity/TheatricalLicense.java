package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.TheatricalLicenseStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "theatrical_license")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TheatricalLicense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "license_id")
    Long licenseId;

    @Column(name = "license_code", nullable = false, unique = true, length = 100)
    String licenseCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id")
    CinemaCluster cluster;

    @Column(name = "distributor_name", nullable = false, length = 200)
    String distributorName;

    @Column(name = "territory_code", nullable = false, length = 2)
    String territoryCode;

    @Column(name = "valid_from", nullable = false)
    LocalDate validFrom;

    @Column(name = "valid_until", nullable = false)
    LocalDate validUntil;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    TheatricalLicenseStatus status;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "theatrical_license_screening_version",
            joinColumns = @JoinColumn(name = "license_id"),
            inverseJoinColumns = @JoinColumn(name = "screening_version_id")
    )
    Set<MovieScreeningVersion> screeningVersions = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;
}

