package movieservice.mapper;

import java.util.List;
import java.util.stream.Collectors;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import jakarta.inject.Named;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.MovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieConnect;
import movieservice.entity.TypeMovie;

@Mapper(componentModel = "spring")
public interface MovieMapper {
    Movie toMovie(CreateMovieRequest createMovieRequest);

    @Mapping(target = "movieType", source = "movieConnects")
    MovieResponse toResponse(Movie movie);

    List<MovieResponse> toResponseList(List<Movie> movies);
    CinemaRoom toCinemaRoom(CinemaRoomRequest cinemaRoomRequest);


    TypeMovie toType(TypeRequest typeRequest);
    default String map(MovieConnect movieType) {
        return movieType.getType().getTypeName();
    }
    @Named("mapConnectToGenreNames")
    default List<String> mapConnectToGenreNames(List<MovieConnect> movieConnects) {
        if (movieConnects == null) {
            return null;
        }
        return movieConnects.stream()
                .map(connect -> connect.getType().getTypeName()) 
                .collect(Collectors.toList());
    }
}
