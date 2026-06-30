package movieservice.dto.request;

import jakarta.validation.constraints.*;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateMovieRequest {

    @NotBlank(message = "Tên phim tiếng Việt không được để trống")
    @Size(max = 255)
    String movieNameVn;

    @NotBlank(message = "Tên phim tiếng Anh không được để trống")
    @Size(max = 255)
    String movieNameEnglish;

    @NotBlank(message = "Đạo diễn không được để trống")
    String director;

    @NotBlank(message = "Diễn viên không được để trống")
    String actor;

    @NotNull(message = "Thời lượng không được để trống")
    @Min(value = 1, message = "Thời lượng phải lớn hơn 0")
    Integer duration;

    @NotBlank(message = "Nội dung không được để trống")
    String content;

    @NotBlank(message = "Phiên bản không được để trống")
    String version;

    @NotNull(message = "Trạng thái không được để trống")
    Boolean status;

    @NotBlank(message = "Hãng sản xuất không được để trống")
    String movieProductionCompany;

    String largeImage;
    String smallImage;
    List<Long> typeIds;
}
