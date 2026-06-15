package movie.theater.common.exception;

import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatusCode;


public interface BaseErrorCode {
    int getCode();
    String getMessage();
    HttpStatusCode getStatusCode();
}
