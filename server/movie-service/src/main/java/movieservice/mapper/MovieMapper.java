package movieservice.mapper;

import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.*;
import movieservice.entity.*;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface MovieMapper {

    // ── Movie ─────────────────────────────────────────────────

    /**
     * Create: only scalar fields. Relationships (genres, formats, cast,
     * translations) are wired in MovieService after entity is saved.
     */
    @Mapping(target = "movieId", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "genres", ignore = true)
    @Mapping(target = "formats", ignore = true)
    @Mapping(target = "cast", ignore = true)
    @Mapping(target = "translations", ignore = true)
    @Mapping(target = "ageRating", ignore = true)
    @Mapping(target = "company", ignore = true)
    Movie toMovie(CreateMovieRequest request);

    @Mapping(target = "movieId", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "genres", ignore = true)
    @Mapping(target = "formats", ignore = true)
    @Mapping(target = "cast", ignore = true)
    @Mapping(target = "translations", ignore = true)
    @Mapping(target = "ageRating", ignore = true)
    @Mapping(target = "company", ignore = true)
    void updateMovieFromRequest(UpdateMovieRequest request, @MappingTarget Movie movie);

    @Mapping(target = "status", expression = "java(movie.getStatus() != null ? movie.getStatus().name() : null)")
    @Mapping(target = "companyName", source = "company.name")
    @Mapping(target = "ageRating", source = "ageRating")
    @Mapping(target = "genres", source = "genres")
    @Mapping(target = "formats", source = "formats")
    @Mapping(target = "translations", source = "translations")
    @Mapping(target = "cast", source = "cast")
    MovieResponse toMovieResponse(Movie movie);

    List<MovieResponse> toMovieResponseList(List<Movie> movies);

    // ── Lookup entities ───────────────────────────────────────

    GenreResponse toGenreResponse(Genre genre);
    List<GenreResponse> toGenreResponseList(List<Genre> genres);

    AgeRatingResponse toAgeRatingResponse(AgeRating ageRating);

    ScreeningFormatResponse toScreeningFormatResponse(ScreeningFormat format);
    List<ScreeningFormatResponse> toScreeningFormatResponseList(List<ScreeningFormat> formats);

    // ── Cast / Translation ────────────────────────────────────

    @Mapping(target = "personId", source = "person.personId")
    @Mapping(target = "fullName", source = "person.fullName")
    @Mapping(target = "photoUrl", source = "person.photoUrl")
    @Mapping(target = "roleType", expression = "java(cast.getRoleType() != null ? cast.getRoleType().name() : null)")
    CastResponse toCastResponse(MovieCast cast);

    List<CastResponse> toCastResponseList(List<MovieCast> castList);

    @Mapping(target = "languageCode", source = "id.languageCode")
    TranslationResponse toTranslationResponse(MovieTranslation translation);

    List<TranslationResponse> toTranslationResponseList(List<MovieTranslation> translations);

    // ── Cinema room ───────────────────────────────────────────

    CinemaRoom toCinemaRoom(CinemaRoomRequest request);
    CinemaRoomResponse toCinemaRoomResponse(CinemaRoom cinemaRoom);
    List<CinemaRoomResponse> toCinemaRoomResponseList(List<CinemaRoom> cinemaRooms);

    // ── ShowTime ──────────────────────────────────────────────

    @Mapping(source = "cinemaRoom.cinemaRoomId", target = "cinemaRoomId")
    @Mapping(source = "cinemaRoom.cinemaRoomName", target = "cinemaRoomName")
    @Mapping(source = "movie.movieId", target = "movieId")
    @Mapping(source = "movie.originalTitle", target = "movieName")
    ShowTimeResponse toShowTimeResponse(ShowTime showTime);

    List<ShowTimeResponse> toShowTimeResponseList(List<ShowTime> showTimes);

    // ── Seat ──────────────────────────────────────────────────

    @Mapping(target = "cinemaRoomId", source = "cinemaRoom.cinemaRoomId")
    @Mapping(target = "cinemaRoomName", source = "cinemaRoom.cinemaRoomName")
    SeatResponse toSeatResponse(Seat seat);

    List<SeatResponse> toSeatResponseList(List<Seat> seats);
}
