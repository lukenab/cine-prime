package movieservice.repository;

import movieservice.entity.CinemaRoom;
import movieservice.entity.CinemaRoomFormat;
import movieservice.entity.CinemaRoomFormatId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CinemaRoomFormatRepository extends JpaRepository<CinemaRoomFormat, CinemaRoomFormatId> {

    Optional<CinemaRoomFormat> findByCinemaRoom_CinemaRoomIdAndScreeningFormat_FormatId(
            Long cinemaRoomId, Integer formatId);

    /**
     * The reusable eligibility query for auto allocation. A candidate must have
     * an enabled capability, an active room and an active cluster.
     */
    @Query("""
            SELECT roomFormat.cinemaRoom
            FROM CinemaRoomFormat roomFormat
            JOIN roomFormat.cinemaRoom room
            JOIN room.cluster cluster
            WHERE roomFormat.enabled = TRUE
              AND roomFormat.screeningFormat.formatId = :formatId
              AND room.status = movieservice.enums.CinemaRoomStatus.ACTIVE
              AND cluster.status = movieservice.enums.ClusterStatus.ACTIVE
            ORDER BY cluster.clusterId, room.cinemaRoomId
            """)
    List<CinemaRoom> findEligibleActiveRoomsByFormatId(@Param("formatId") Integer formatId);

    /**
     * Full candidate guard used when a movie and a concrete format are already
     * selected. The EXISTS clause keeps movie_format as the sole source of a
     * movie's supported formats.
     */
    @Query("""
            SELECT roomFormat.cinemaRoom
            FROM CinemaRoomFormat roomFormat
            JOIN roomFormat.cinemaRoom room
            JOIN room.cluster cluster
            WHERE roomFormat.enabled = TRUE
              AND roomFormat.screeningFormat.formatId = :formatId
              AND room.status = movieservice.enums.CinemaRoomStatus.ACTIVE
              AND cluster.status = movieservice.enums.ClusterStatus.ACTIVE
              AND EXISTS (
                    SELECT 1
                    FROM Movie movie
                    JOIN movie.formats movieFormat
                    WHERE movie.movieId = :movieId
                      AND movieFormat.formatId = roomFormat.screeningFormat.formatId
              )
            ORDER BY cluster.clusterId, room.cinemaRoomId
            """)
    List<CinemaRoom> findEligibleActiveRoomsByMovieIdAndFormatId(
            @Param("movieId") Long movieId,
            @Param("formatId") Integer formatId);
}
