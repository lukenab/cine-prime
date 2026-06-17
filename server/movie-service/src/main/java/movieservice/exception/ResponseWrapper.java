package movieservice.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import movieservice.constant.ApiConstants;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "API Response wrapper chứa code, message, status và dữ liệu")
public class ResponseWrapper<T> {
    
    @Schema(description = ApiConstants.RESPONSE_CODE_DESC, example = ApiConstants.RESPONSE_CODE_EXAMPLE)
    private String code;
    
    @Schema(description = ApiConstants.RESPONSE_MESSAGE_DESC, example = ApiConstants.RESPONSE_MESSAGE_EXAMPLE)
    private String message;
    
    @Schema(description = ApiConstants.RESPONSE_STATUS_DESC, example = ApiConstants.RESPONSE_STATUS_EXAMPLE)
    private String status;
    
    @Schema(description = "Dữ liệu trả về")
    private T data;
    
    // Constructor cho thành công (code=200)
    public ResponseWrapper(String message, T data) {
        this.code = "200";
        this.message = message;
        this.status = "OK";
        this.data = data;
    }
    
    // Constructor cho lỗi
    public ResponseWrapper(String code, String message, String status) {
        this.code = code;
        this.message = message;
        this.status = status;
        this.data = null;
    }
}
