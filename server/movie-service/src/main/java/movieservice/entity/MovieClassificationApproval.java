package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ClassificationApprovalStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "movie_classification_approval")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieClassificationApproval {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "classification_approval_id")
    Long classificationApprovalId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "age_rating_id", nullable = false)
    AgeRating ageRating;

    @Column(name = "territory_code", nullable = false, length = 2)
    String territoryCode;

    @Column(name = "approval_reference", nullable = false, length = 100)
    String approvalReference;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    ClassificationApprovalStatus status;

    @Column(name = "valid_from")
    LocalDate validFrom;

    @Column(name = "valid_until")
    LocalDate validUntil;

    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;
}

