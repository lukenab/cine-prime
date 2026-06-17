package movieservice.mapper;

import java.util.List;
import java.util.stream.Collectors;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.response.MovieResponse;
import movieservice.dto.response.TypeMovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.TypeMovie;

@Mapper(componentModel = "spring")
public interface MovieMapper {
    Movie toMovie(CreateMovieRequest request);

    @Mapping(target = "movieType", source = "types", qualifiedByName = "mapTypesToGenreNames")
    MovieResponse toResponse(Movie movie);

    List<MovieResponse> toResponseList(List<Movie> movies);

    CinemaRoom toCinemaRoom(CinemaRoomRequest cinemaRoomRequest);
    CinemaRoomResponse toCinemaResponse(CinemaRoom cinemaRoom);
    TypeMovie toType(TypeRequest typeRequest);
    TypeMovieResponse toMovieResponse(TypeMovie typeMovie);
    @Named("mapTypesToGenreNames")
    default List<String> mapTypesToGenreNames(List<TypeMovie> types) {
        if (types == null) {
            return null;
        }

        return types.stream()
                .map(TypeMovie::getTypeName)
                .collect(Collectors.toList());
    }
}