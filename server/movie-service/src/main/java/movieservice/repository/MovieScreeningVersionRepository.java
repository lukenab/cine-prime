package movieservice.repository;

import movieservice.entity.MovieScreeningVersion;
import movieservice.enums.ScreeningVersionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MovieScreeningVersionRepository extends JpaRepository<MovieScreeningVersion, Long> {

    @Query("""
            SELECT version
            FROM MovieScreeningVersion version
            JOIN FETCH version.format
            LEFT JOIN FETCH version.audioFormat
            WHERE version.movie.movieId = :movieId
              AND version.status = :status
              AND version.audioFormat IS NOT NULL
              AND (version.effectiveFrom IS NULL OR version.effectiveFrom <= :businessDate)
              AND (version.effectiveTo IS NULL OR version.effectiveTo >= :businessDate)
            ORDER BY version.screeningVersionId
            """)
    List<MovieScreeningVersion> findEffectiveVersions(
            @Param("movieId") Long movieId,
            @Param("businessDate") LocalDate businessDate,
            @Param("status") ScreeningVersionStatus status
    );

    List<MovieScreeningVersion> findByMovie_MovieId(Long movieId);

    boolean existsByMovie_MovieIdAndStatusAndAudioFormatIsNotNull(
            Long movieId, ScreeningVersionStatus status);

    @Query("""
            SELECT version
            FROM MovieScreeningVersion version
            JOIN FETCH version.format
            LEFT JOIN FETCH version.audioFormat
            WHERE version.movie.movieId = :movieId
            ORDER BY version.status, version.format.formatCode,
                     version.audioLanguageCode, version.subtitleLanguageCode
            """)
    List<MovieScreeningVersion> findByMovieIdWithFormat(@Param("movieId") Long movieId);

    @Query("""
            SELECT version
            FROM MovieScreeningVersion version
            JOIN FETCH version.format format
            LEFT JOIN FETCH version.audioFormat audioFormat
            JOIN FETCH version.movie movie
            WHERE (:query IS NULL
                   OR LOWER(movie.originalTitle) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%'))
                   OR LOWER(format.formatCode) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%'))
                   OR LOWER(COALESCE(audioFormat.formatCode, '')) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%'))
                   OR LOWER(version.audioLanguageCode) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%'))
                   OR LOWER(COALESCE(version.subtitleLanguageCode, '')) LIKE LOWER(CONCAT('%', CAST(:query AS string), '%')))
              AND (:status IS NULL OR version.status = :status)
              AND (:formatId IS NULL OR format.formatId = :formatId)
            ORDER BY movie.originalTitle, format.formatCode,
                     version.audioLanguageCode, version.subtitleLanguageCode,
                     version.screeningVersionId
            """)
    List<MovieScreeningVersion> searchCatalog(
            @Param("query") String query,
            @Param("status") ScreeningVersionStatus status,
            @Param("formatId") Integer formatId
    );

    @Query("""
            SELECT version
            FROM MovieScreeningVersion version
            JOIN FETCH version.format
            LEFT JOIN FETCH version.audioFormat
            JOIN FETCH version.movie
            WHERE version.screeningVersionId = :versionId
              AND version.movie.movieId = :movieId
            """)
    Optional<MovieScreeningVersion> findByScreeningVersionIdAndMovie_MovieId(
            @Param("versionId") Long versionId,
            @Param("movieId") Long movieId
    );

    @Query(value = """
            SELECT COUNT(DISTINCT room.cinema_room_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability
              ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout
              ON layout.cinema_room_id = room.cinema_room_id
            WHERE capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
            """, nativeQuery = true)
    long countCompatibleRooms(@Param("formatId") Integer formatId);

    @Query(value = """
            SELECT COUNT(DISTINCT cluster.cluster_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability
              ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout
              ON layout.cinema_room_id = room.cinema_room_id
            WHERE capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
            """, nativeQuery = true)
    long countCompatibleClusters(@Param("formatId") Integer formatId);

    @Query(value = """
            SELECT COUNT(DISTINCT room.cinema_room_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability
              ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout
              ON layout.cinema_room_id = room.cinema_room_id
            JOIN audio_format installed
              ON installed.audio_format_id = room.audio_format_id
            JOIN audio_format content
              ON content.audio_format_id = :audioFormatId
            WHERE capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
              AND installed.active = TRUE
              AND (
                    installed.format_code = content.format_code
                    OR (installed.format_code = 'DOLBY_ATMOS'
                        AND content.format_code IN ('DOLBY_7_1', 'DOLBY_5_1'))
                    OR (installed.format_code = 'DOLBY_7_1'
                        AND content.format_code = 'DOLBY_5_1')
              )
            """, nativeQuery = true)
    long countAudioCompatibleRooms(
            @Param("formatId") Integer formatId,
            @Param("audioFormatId") Integer audioFormatId);

    @Query(value = """
            SELECT COUNT(DISTINCT cluster.cluster_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability
              ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout
              ON layout.cinema_room_id = room.cinema_room_id
            JOIN audio_format installed
              ON installed.audio_format_id = room.audio_format_id
            JOIN audio_format content
              ON content.audio_format_id = :audioFormatId
            WHERE capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
              AND installed.active = TRUE
              AND (
                    installed.format_code = content.format_code
                    OR (installed.format_code = 'DOLBY_ATMOS'
                        AND content.format_code IN ('DOLBY_7_1', 'DOLBY_5_1'))
                    OR (installed.format_code = 'DOLBY_7_1'
                        AND content.format_code = 'DOLBY_5_1')
              )
            """, nativeQuery = true)
    long countAudioCompatibleClusters(
            @Param("formatId") Integer formatId,
            @Param("audioFormatId") Integer audioFormatId);

    @Query(value = """
            SELECT COUNT(DISTINCT room.cinema_room_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout ON layout.cinema_room_id = room.cinema_room_id
            WHERE room.cluster_id IN (:clusterIds)
              AND capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
            """, nativeQuery = true)
    long countCompatibleRoomsInClusters(
            @Param("formatId") Integer formatId,
            @Param("clusterIds") List<Long> clusterIds);

    @Query(value = """
            SELECT COUNT(DISTINCT room.cinema_room_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout ON layout.cinema_room_id = room.cinema_room_id
            JOIN audio_format installed ON installed.audio_format_id = room.audio_format_id
            JOIN audio_format content ON content.audio_format_id = :audioFormatId
            WHERE room.cluster_id IN (:clusterIds)
              AND capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
              AND installed.active = TRUE
              AND (
                    installed.format_code = content.format_code
                    OR (installed.format_code = 'DOLBY_ATMOS' AND content.format_code IN ('DOLBY_7_1', 'DOLBY_5_1'))
                    OR (installed.format_code = 'DOLBY_7_1' AND content.format_code = 'DOLBY_5_1')
              )
            """, nativeQuery = true)
    long countAudioCompatibleRoomsInClusters(
            @Param("formatId") Integer formatId,
            @Param("audioFormatId") Integer audioFormatId,
            @Param("clusterIds") List<Long> clusterIds);

    @Query(value = """
            SELECT COUNT(DISTINCT room.cluster_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout ON layout.cinema_room_id = room.cinema_room_id
            WHERE room.cluster_id IN (:clusterIds)
              AND capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
            """, nativeQuery = true)
    long countCompatibleClustersInScope(
            @Param("formatId") Integer formatId,
            @Param("clusterIds") List<Long> clusterIds);

    @Query(value = """
            SELECT COUNT(DISTINCT room.cluster_id)
            FROM cinema_room room
            JOIN cinema_cluster cluster ON cluster.cluster_id = room.cluster_id
            JOIN cinema_room_format capability ON capability.cinema_room_id = room.cinema_room_id
            JOIN room_layout layout ON layout.cinema_room_id = room.cinema_room_id
            JOIN audio_format installed ON installed.audio_format_id = room.audio_format_id
            JOIN audio_format content ON content.audio_format_id = :audioFormatId
            WHERE room.cluster_id IN (:clusterIds)
              AND capability.format_id = :formatId
              AND capability.enabled = TRUE
              AND room.status = 'ACTIVE'
              AND cluster.status = 'ACTIVE'
              AND layout.status = 'ACTIVE'
              AND layout.person_capacity > 0
              AND installed.active = TRUE
              AND (
                    installed.format_code = content.format_code
                    OR (installed.format_code = 'DOLBY_ATMOS' AND content.format_code IN ('DOLBY_7_1', 'DOLBY_5_1'))
                    OR (installed.format_code = 'DOLBY_7_1' AND content.format_code = 'DOLBY_5_1')
              )
            """, nativeQuery = true)
    long countAudioCompatibleClustersInScope(
            @Param("formatId") Integer formatId,
            @Param("audioFormatId") Integer audioFormatId,
            @Param("clusterIds") List<Long> clusterIds);

    @Query(value = "SELECT COUNT(*) FROM show_time WHERE screening_version_id = :versionId", nativeQuery = true)
    long countShowtimeReferences(@Param("versionId") Long versionId);

    @Query(value = "SELECT COUNT(*) FROM schedule_plan_slot WHERE screening_version_id = :versionId", nativeQuery = true)
    long countSchedulePlanReferences(@Param("versionId") Long versionId);
}
