package movieservice.dto.request;

import jakarta.validation.constraints.*;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import movieservice.constant.ApiConstants;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(description = "Thông tin cập nhật phim")
public class UpdateMovieRequest {

    @Schema(
        description = ApiConstants.MOVIE_VN_NAME_DESC,
        example = ApiConstants.MOVIE_NAME_EXAMPLE
    )
    @NotBlank(message = "Tên phim tiếng Việt không được để trống")
    @Size(max = 255)
    String movieNameVn;

    @Schema(
        description = ApiConstants.MOVIE_EN_NAME_DESC,
        example = ApiConstants.MOVIE_NAME_EXAMPLE
    )
    @NotBlank(message = "Tên phim tiếng Anh không được để trống")
    @Size(max = 255)
    String movieNameEnglish;

    @Schema(
        description = ApiConstants.DIRECTOR_DESC,
        example = ApiConstants.DIRECTOR_EXAMPLE
    )
    @NotBlank(message = "Đạo diễn không được để trống")
    String director;

    @Schema(
        description = ApiConstants.ACTOR_DESC,
        example = ApiConstants.ACTOR_EXAMPLE
    )
    @NotBlank(message = "Diễn viên không được để trống")
    String actor;

    @Schema(
        description = ApiConstants.DURATION_DESC,
        example = ApiConstants.DURATION_EXAMPLE
    )
    @NotNull(message = "Thời lượng không được để trống")
    @Min(value = 1, message = "Thời lượng phải lớn hơn 0")
    Integer duration;

    @Schema(
        description = ApiConstants.CONTENT_DESC,
        example = ApiConstants.CONTENT_EXAMPLE
    )
    @NotBlank(message = "Nội dung không được để trống")
    String content;

    @Schema(
        description = ApiConstants.VERSION_DESC,
        example = ApiConstants.VERSION_EXAMPLE
    )
    @NotBlank(message = "Phiên bản không được để trống")
    String version;

    @Schema(
        description = ApiConstants.STATUS_DESC,
        example = ApiConstants.STATUS_EXAMPLE
    )
    @NotNull(message = "Trạng thái không được để trống")
    Boolean status;

    @Schema(
        description = ApiConstants.PRODUCTION_COMPANY_DESC,
        example = ApiConstants.PRODUCTION_COMPANY_EXAMPLE
    )
    @NotBlank(message = "Hãng sản xuất không được để trống")
    String movieProductionCompany;

    @Schema(
        description = ApiConstants.LARGE_IMAGE_DESC,
        example = ApiConstants.LARGE_IMAGE_EXAMPLE
    )
    String largeImage;

    @Schema(
        description = ApiConstants.SMALL_IMAGE_DESC,
        example = ApiConstants.SMALL_IMAGE_EXAMPLE
    )
    String smallImage;

    @Schema(
        description = ApiConstants.TYPE_IDS_DESC,
        example = ApiConstants.TYPE_IDS_EXAMPLE
    )
    List<Long> typeIds;
}
