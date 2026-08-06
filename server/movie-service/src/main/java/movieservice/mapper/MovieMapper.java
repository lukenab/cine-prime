package movieservice.mapper;

import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.*;
import movieservice.entity.*;
import movieservice.util.SeatLayoutUtil;
import movieservice.util.MovieTitleResolver;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE,
        imports = {SeatLayoutUtil.class, MovieTitleResolver.class})
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
    @Mapping(target = "companies", ignore = true)
    Movie toMovie(CreateMovieRequest request);

    // NullValuePropertyMappingStrategy.IGNORE: field khong xuat hien hoac gui null trong
    // UpdateMovieRequest se KHONG ghi de gia tri hien co tren entity (xem issue #143 - truoc day
    // MapStruct mac dinh se set null len entity cho moi field null trong request, gay mat du lieu
    // khi client chi gui partial payload). FK/collection van duoc xu ly rieng trong MovieService
    // (ignore o day) vi can validate ID ton tai / reconcile chu khong the map thang 1-doi-1.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "movieId", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "genres", ignore = true)
    @Mapping(target = "formats", ignore = true)
    @Mapping(target = "cast", ignore = true)
    @Mapping(target = "translations", ignore = true)
    @Mapping(target = "ageRating", ignore = true)
    @Mapping(target = "companies", ignore = true)
    void updateMovieFromRequest(UpdateMovieRequest request, @MappingTarget Movie movie);

    @Mapping(target = "status", expression = "java(movie.getStatus() != null ? movie.getStatus().name() : null)")
    @Mapping(target = "companies", source = "companies")
    @Mapping(target = "ageRating", source = "ageRating")
    @Mapping(target = "genres", source = "genres")
    @Mapping(target = "formats", source = "formats")
    @Mapping(target = "translations", source = "translations")
    @Mapping(target = "cast", source = "cast")
    @Mapping(target = "images", source = "images")
    MovieResponse toMovieResponse(Movie movie);

    List<MovieResponse> toMovieResponseList(List<Movie> movies);

    // ── Lookup entities ───────────────────────────────────────

    GenreResponse toGenreResponse(Genre genre);
    List<GenreResponse> toGenreResponseList(List<Genre> genres);

    AgeRatingResponse toAgeRatingResponse(AgeRating ageRating);
    List<AgeRatingResponse> toAgeRatingResponseList(List<AgeRating> ageRatings);

    ScreeningFormatResponse toScreeningFormatResponse(ScreeningFormat format);
    List<ScreeningFormatResponse> toScreeningFormatResponseList(List<ScreeningFormat> formats);

    PersonResponse toPersonResponse(Person person);
    List<PersonResponse> toPersonResponseList(List<Person> persons);

    ProductionCompanyResponse toProductionCompanyResponse(ProductionCompany company);
    List<ProductionCompanyResponse> toProductionCompanyResponseList(List<ProductionCompany> companies);

    // ── Cast / Translation ────────────────────────────────────

    @Mapping(target = "personId", source = "person.personId")
    @Mapping(target = "fullName", source = "person.fullName")
    @Mapping(target = "photoUrl", source = "person.photoUrl")
    @Mapping(target = "roleType", source = "roleType")
    CastResponse toCastResponse(MovieCast cast);

    List<CastResponse> toCastResponseList(List<MovieCast> castList);

    @Mapping(target = "languageCode", source = "id.languageCode")
    TranslationResponse toTranslationResponse(MovieTranslation translation);

    List<TranslationResponse> toTranslationResponseList(List<MovieTranslation> translations);

    MovieImageResponse toMovieImageResponse(MovieImage image);
    List<MovieImageResponse> toMovieImageResponseList(List<MovieImage> images);

    // ── Cinema cluster ────────────────────────────────────────

    @Mapping(target = "clusterId", ignore = true)
    @Mapping(target = "rooms", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    @Mapping(target = "operatingHours", ignore = true)
    CinemaCluster toCinemaCluster(CinemaClusterRequest request);

    @Mapping(target = "status", expression = "java(cluster.getStatus() != null ? cluster.getStatus().name() : null)")
    @Mapping(target = "venueType", expression = "java(cluster.getVenueType() != null ? cluster.getVenueType().name() : null)")
    @Mapping(target = "totalRooms", ignore = true)
    @Mapping(target = "totalSeats", ignore = true)
    CinemaClusterResponse toCinemaClusterResponse(CinemaCluster cluster);

    ClusterOperatingHourResponse toClusterOperatingHourResponse(CinemaClusterOperatingHour operatingHour);

    // ── Cinema room ───────────────────────────────────────────

    @Mapping(target = "clusterId", expression = "java(cinemaRoom.getCluster() != null ? cinemaRoom.getCluster().getClusterId() : null)")
    @Mapping(target = "clusterName", expression = "java(cinemaRoom.getCluster() != null ? cinemaRoom.getCluster().getClusterName() : null)")
    CinemaRoomResponse toCinemaRoomResponse(CinemaRoom cinemaRoom);
    List<CinemaRoomResponse> toCinemaRoomResponseList(List<CinemaRoom> cinemaRooms);

    // ── Movie availability (MOV-LC-06) ────────────────────────

    @Mapping(target = "status", expression = "java(availability.getStatus() != null ? availability.getStatus().name() : null)")
    @Mapping(target = "movieId", expression = "java(availability.getMovie() != null ? availability.getMovie().getMovieId() : null)")
    @Mapping(target = "movieTitle", expression = "java(availability.getMovie() != null ? availability.getMovie().getOriginalTitle() : null)")
    @Mapping(target = "clusterId", expression = "java(availability.getCluster() != null ? availability.getCluster().getClusterId() : null)")
    @Mapping(target = "clusterName", expression = "java(availability.getCluster() != null ? availability.getCluster().getClusterName() : null)")
    MovieAvailabilityResponse toMovieAvailabilityResponse(MovieAvailability availability);
    List<MovieAvailabilityResponse> toMovieAvailabilityResponseList(List<MovieAvailability> availabilities);

    // ── ShowTime ──────────────────────────────────────────────

    @Mapping(source = "cinemaRoom.cinemaRoomId", target = "cinemaRoomId")
    @Mapping(source = "cinemaRoom.cinemaRoomName", target = "cinemaRoomName")
    @Mapping(source = "movie.movieId", target = "movieId")
    @Mapping(target = "movieName", expression = "java(MovieTitleResolver.preferredVietnameseTitle(showTime.getMovie()))")
    @Mapping(source = "movie.posterUrl", target = "moviePosterUrl")
    @Mapping(source = "format.formatCode", target = "formatCode")
    @Mapping(target = "status", expression = "java(showTime.getStatus() != null ? showTime.getStatus().name() : null)")
      @Mapping(target = "source", expression = "java(showTime.getSource() != null ? showTime.getSource().name() : null)")
      @Mapping(target = "priceSource", expression = "java(showTime.getPriceSource() != null ? showTime.getPriceSource().name() : null)")
      @Mapping(target = "priceBookId", expression = "java(showTime.getPriceBook() != null ? showTime.getPriceBook().getPriceBookId() : null)")
      @Mapping(target = "priceRateId", expression = "java(showTime.getPriceRate() != null ? showTime.getPriceRate().getPriceRateId() : null)")
    @Mapping(target = "clusterId", expression = "java(showTime.getCinemaRoom() != null && showTime.getCinemaRoom().getCluster() != null ? showTime.getCinemaRoom().getCluster().getClusterId() : null)")
    @Mapping(target = "clusterName", expression = "java(showTime.getCinemaRoom() != null && showTime.getCinemaRoom().getCluster() != null ? showTime.getCinemaRoom().getCluster().getClusterName() : null)")
    @Mapping(target = "availableSeats", expression = "java(Math.max(0, (showTime.getTotalSeats() != null ? showTime.getTotalSeats() : 0) - (showTime.getSoldSeats() != null ? showTime.getSoldSeats() : 0)))")
    // price khong map o day — SeatRepository can duoc goi tu service (xem ShowTimeService.enrichPrice),
    // MapStruct expression khong the inject repository ma khong dung @Context/default method.
    ShowTimeResponse toShowTimeResponse(ShowTime showTime);

    List<ShowTimeResponse> toShowTimeResponseList(List<ShowTime> showTimes);

    // ── Seat ──────────────────────────────────────────────────

    @Mapping(target = "cinemaRoomId", source = "cinemaRoom.cinemaRoomId")
    @Mapping(target = "cinemaRoomName", source = "cinemaRoom.cinemaRoomName")
    @Mapping(target = "seatType", expression = "java(seat.getSeatType() != null ? seat.getSeatType().name() : null)")
    @Mapping(target = "colSpan", expression = "java(seat.getSeatType() != null ? seat.getSeatType().getColSpan() : 1)")
    @Mapping(target = "aisleAfter", expression = "java(seat.getCinemaRoom() != null ? SeatLayoutUtil.hasAisleAfter(seat.getColNumber(), seat.getSeatType().getColSpan(), seat.getCinemaRoom().getSeatsPerRow()) : null)")
    @Mapping(target = "status", expression = "java(seat.getStatus() != null ? seat.getStatus().name() : null)")
    SeatResponse toSeatResponse(Seat seat);

    List<SeatResponse> toSeatResponseList(List<Seat> seats);
}
