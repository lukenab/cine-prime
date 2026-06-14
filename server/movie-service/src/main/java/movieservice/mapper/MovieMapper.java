package movieservice.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

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

    @Mapping(target = "movieConnects", source = "movieConnects")
    MovieResponse toResponse(Movie movie);

    List<MovieResponse> toResponseList(List<Movie> movies);
    CinemaRoom toCinemaRoom(CinemaRoomRequest cinemaRoomRequest);


    TypeMovie toType(TypeRequest typeRequest);
    default String map(MovieConnect movieType) {
        return movieType.getType().getTypeName();
    }
}
