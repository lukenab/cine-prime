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
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.MovieResponse;
import movieservice.dto.response.TypeMovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieType;

@Mapper(componentModel = "spring")
public interface MovieMapper {
    Movie toMovie(CreateMovieRequest request);
    // cái này nảy tui sửa k đc, có s phía cuối hong, k bt nữa
    void updateMovieFromRequest(UpdateMovieRequest request, @MappingTarget Movie movie);

    @Mapping(target = "movieType", source = "movieTypes", qualifiedByName = "mapTypesToGenreNames")
    MovieResponse toResponse(Movie movie);

    List<MovieResponse> toResponseList(List<Movie> movies);

    CinemaRoom toCinemaRoom(CinemaRoomRequest cinemaRoomRequest);
    CinemaRoomResponse toCinemaResponse(CinemaRoom cinemaRoom);
    MovieType toType(TypeRequest typeRequest);
    TypeMovieResponse toMovieResponse(MovieType typeMovie);
    // ông coi cái hàm dưới đây để gì v
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