package movieservice.mapper;

import java.util.List;
import java.util.stream.Collectors;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.mapstruct.MappingTarget;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.response.MovieResponse;
import movieservice.dto.response.SeatResponse;
import movieservice.dto.response.TypeMovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieType;
import movieservice.entity.ShowTime;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.entity.Seat;

@Mapper(componentModel = "spring", unmappedTargetPolicy = org.mapstruct.ReportingPolicy.IGNORE)
public interface MovieMapper {
    Movie toMovie(CreateMovieRequest request);

    void updateMovieFromRequest(UpdateMovieRequest request, @MappingTarget Movie movie);

    @Mapping(target = "movieType", source = "movieTypes", qualifiedByName = "mapTypesToGenreNames")
    MovieResponse toResponse(Movie movie);

    List<MovieResponse> toResponseList(List<Movie> movies);

    CinemaRoom toCinemaRoom(CinemaRoomRequest cinemaRoomRequest);
    CinemaRoomResponse toCinemaResponse(CinemaRoom cinemaRoom);
    List<CinemaRoomResponse> toCinemaResponseList(List<CinemaRoom> cinemaRooms);

    MovieType toType(TypeRequest typeRequest);
    TypeMovieResponse toMovieResponse(MovieType typeMovie);
    List<TypeMovieResponse> toTypeResponseList(List<MovieType> movieTypes);
    @Mapping(source = "cinemaRoom.cinemaRoomId", target = "cinemaRoomId")
    @Mapping(source = "cinemaRoom.cinemaRoomName", target = "cinemaRoomName")
    @Mapping(source = "movie.movieId", target = "movieId")
    @Mapping(source = "movie.movieNameVn", target = "movieName")
    ShowTimeResponse toShowTimeResponse(ShowTime showTime);

    List<ShowTimeResponse> toShowTimeResponseList(List<ShowTime> showTimes);

    @Mapping(target = "cinemaRoomId", source = "cinemaRoom.cinemaRoomId")
    @Mapping(target = "cinemaRoomName", source = "cinemaRoom.cinemaRoomName")
    SeatResponse toSeatResponse(Seat seat);

    List<SeatResponse> toSeatResponseList(List<Seat> seats);
    @Named("mapTypesToGenreNames")
    default List<String> mapTypesToGenreNames(List<MovieType> types) {
        if (types == null) {
            return null;
        }

        return types.stream()
                .map(MovieType::getTypeName)
                .collect(Collectors.toList());
    }
}