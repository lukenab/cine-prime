package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import movieservice.constant.ApiConstants;

@Data
@Schema(description = "Thông tin tạo mới phim và lịch chiếu")
public class CreateMovieRequest {

    @Schema(
        description = ApiConstants.MOVIE_VN_NAME_DESC,
        example = ApiConstants.MOVIE_NAME_EXAMPLE
    )
    @NotBlank(message = "Tên phim tiếng Việt không được để trống")
    @Size(max = 255)
    private String movieNameVn;

    @Schema(
        description = ApiConstants.MOVIE_EN_NAME_DESC,
        example = ApiConstants.MOVIE_NAME_EXAMPLE
    )
    @NotBlank(message = "Tên phim tiếng Anh không được để trống")
    @Size(max = 255)
    private String movieNameEnglish;

    @Schema(
        description = ApiConstants.DIRECTOR_DESC,
        example = ApiConstants.DIRECTOR_EXAMPLE
    )
    @NotBlank(message = "Đạo diễn không được để trống")
    private String director;

    @Schema(
        description = ApiConstants.ACTOR_DESC,
        example = ApiConstants.ACTOR_EXAMPLE
    )
    @NotBlank(message = "Diễn viên không được để trống")
    private String actor;

    @Schema(
        description = ApiConstants.DURATION_DESC,
        example = ApiConstants.DURATION_EXAMPLE
    )
    @NotNull
    private Integer duration;

    @Schema(
        description = ApiConstants.CONTENT_DESC,
        example = ApiConstants.CONTENT_EXAMPLE
    )
    @NotBlank
    private String content;

    @Schema(
        description = ApiConstants.VERSION_DESC,
        example = ApiConstants.VERSION_EXAMPLE
    )
    @NotBlank
    private String version;

    @Schema(
        description = ApiConstants.STATUS_DESC,
        example = ApiConstants.STATUS_EXAMPLE
    )
    @NotNull
    private Boolean status;

    @Schema(
        description = ApiConstants.PRODUCTION_COMPANY_DESC,
        example = ApiConstants.PRODUCTION_COMPANY_EXAMPLE
    )
    @NotBlank
    private String movieProductionCompany;

    @Schema(
        description = ApiConstants.LARGE_IMAGE_DESC,
        example = ApiConstants.LARGE_IMAGE_EXAMPLE
    )
    private String largeImage;

    @Schema(
        description = ApiConstants.SMALL_IMAGE_DESC,
        example = ApiConstants.SMALL_IMAGE_EXAMPLE
    )
    private String smallImage;

    @Schema(
        description = ApiConstants.TYPE_IDS_DESC,
        example = ApiConstants.TYPE_IDS_EXAMPLE
    )
    private List<Long> typeIds;

    @Schema(
        description = ApiConstants.SHOWTIMES_DESC
    )
    @Valid
    private List<ShowTimeRequest> showTimes;
}