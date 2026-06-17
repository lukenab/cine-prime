package movieservice.exception;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@AllArgsConstructor
public enum MovieErrorCode implements BaseErrorCode {
    MOVIE_NOT_FOUND(1014, "Movie not found!", HttpStatus.NOT_FOUND),
    GENRE_NOT_FOUND(2002, "Không tìm thấy thể loại phim", HttpStatus.NOT_FOUND),
    ACTIVE_SHOWTIMES_EXIST(2003, "Không thể xóa phim vì vẫn còn suất chiếu hoạt động trong tương lai", HttpStatus.CONFLICT)
    ;

    int code;
    String message;
    HttpStatusCode statusCode;
}
