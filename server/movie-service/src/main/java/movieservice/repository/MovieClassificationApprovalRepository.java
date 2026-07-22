package movieservice.repository;

import movieservice.entity.MovieClassificationApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

public interface MovieClassificationApprovalRepository
        extends JpaRepository<MovieClassificationApproval, Long> {

    @Query("""
            SELECT COUNT(approval) > 0
            FROM MovieClassificationApproval approval
            WHERE approval.movie.movieId = :movieId
              AND approval.status = movieservice.enums.ClassificationApprovalStatus.APPROVED
              AND approval.territoryCode = :territoryCode
              AND (approval.validFrom IS NULL OR approval.validFrom <= :businessDate)
              AND (approval.validUntil IS NULL OR approval.validUntil >= :businessDate)
            """)
    boolean existsApprovedClassification(
            @Param("movieId") Long movieId,
            @Param("territoryCode") String territoryCode,
            @Param("businessDate") LocalDate businessDate
    );
}

