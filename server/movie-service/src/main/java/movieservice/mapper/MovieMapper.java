package movieservice.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.response.MovieResponse;
import movieservice.entity.Movie;
import movieservice.entity.MovieType;

@Mapper(componentModel = "spring")
public interface MovieMapper {
    Movie toMovie(CreateMovieRequest createMovieRequest);

    @Mapping(target = "movieTypes", source = "movieTypes")
    MovieResponse toResponse(Movie movie);

    List<MovieResponse> toResponseList(List<Movie> movies);

    default String map(MovieType movieType) {
        return movieType.getType().getTypeName();
    }
}
