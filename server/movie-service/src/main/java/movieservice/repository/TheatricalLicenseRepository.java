package movieservice.repository;

import movieservice.entity.TheatricalLicense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

public interface TheatricalLicenseRepository extends JpaRepository<TheatricalLicense, Long> {
    @Query("""
            SELECT COUNT(license) > 0
            FROM TheatricalLicense license
            JOIN license.screeningVersions version
            WHERE license.movie.movieId = :movieId
              AND version.screeningVersionId = :screeningVersionId
              AND license.status = movieservice.enums.TheatricalLicenseStatus.ACTIVE
              AND license.territoryCode = :territoryCode
              AND (license.cluster IS NULL OR license.cluster.clusterId = :clusterId)
              AND license.validFrom <= :businessDate
              AND license.validUntil >= :businessDate
            """)
    boolean existsEligibleLicense(
            @Param("movieId") Long movieId,
            @Param("screeningVersionId") Long screeningVersionId,
            @Param("clusterId") Long clusterId,
            @Param("territoryCode") String territoryCode,
            @Param("businessDate") LocalDate businessDate
    );
}

