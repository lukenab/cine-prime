package movieservice.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResponseWrapper<T> {

    private String code;
    private String message;
    private String status;
    private T data;

    public ResponseWrapper(String message, T data) {
        this.code = "200";
        this.message = message;
        this.status = "OK";
        this.data = data;
    }

    public ResponseWrapper(String code, String message, String status) {
        this.code = code;
        this.message = message;
        this.status = status;
        this.data = null;
    }
}
