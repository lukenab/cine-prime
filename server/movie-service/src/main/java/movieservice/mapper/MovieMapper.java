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
import movieservice.entity.ShowTime;
import movieservice.dto.response.ShowTimeResponse;

@Mapper(componentModel = "spring", unmappedTargetPolicy = org.mapstruct.ReportingPolicy.IGNORE)
public interface MovieMapper {
    Movie toMovie(CreateMovieRequest request);
    
    // TRẢ LỜI: Hàm này MapStruct sẽ tự động ánh xạ các field từ UpdateMovieRequest sang entity Movie đã có sẵn.
    // Nếu trong UpdateMovieRequest có list id của showTimes thì phải xử lý riêng. Bạn không cần thêm chữ 's'. 
    // Tôi đã thêm cấu hình unmappedTargetPolicy = IGNORE ở trên để sửa lỗi cho bạn rồi nhé!
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
    ShowTimeResponse toShowTimeResponse(ShowTime showTime);
    // TRẢ LỜI: Hàm mapTypesToGenreNames dùng để trích xuất tên thể loại phim (typeName) từ Entity MovieType. 
    // Nhờ hàm này, khi convert sang MovieResponse, danh sách thể loại phim sẽ hiển thị dưới dạng List<String> (ví dụ: ["Hành động", "Kinh dị"]) thay vì List<Object> phức tạp.
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