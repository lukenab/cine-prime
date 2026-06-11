package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Data
@Schema(description = "Thông tin tạo mới phim và lịch chiếu")
public class CreateMovieRequest {

    @Schema(
        description = "Tên phim tiếng Việt",
        example = "One Piece Film Red"
    )
    @NotBlank(message = "Tên phim tiếng Việt không được để trống")
    @Size(max = 255)
    private String movieNameVn;

    @Schema(
        description = "Tên phim tiếng Anh",
        example = "One Piece Film Red"
    )
    @NotBlank(message = "Tên phim tiếng Anh không được để trống")
    @Size(max = 255)
    private String movieNameEnglish;

    @Schema(
        description = "Tên đạo diễn",
        example = "Goro Taniguchi"
    )
    @NotBlank(message = "Đạo diễn không được để trống")
    private String director;

    @Schema(
        description = "Danh sách diễn viên",
        example = "Luffy, Uta, Shanks"
    )
    @NotBlank(message = "Diễn viên không được để trống")
    private String actor;

    @Schema(
        description = "Thời lượng phim (phút)",
        example = "115"
    )
    @NotNull
    private Integer duration;

    @Schema(
        description = "Nội dung tóm tắt của phim",
        example = "Câu chuyện về Uta và băng Mũ Rơm..."
    )
    @NotBlank
    private String content;

    @Schema(
        description = "Phiên bản phim",
        example = "2D"
    )
    @NotBlank
    private String version;

    @Schema(
        description = "Trạng thái hoạt động",
        example = "true"
    )
    @NotNull
    private Boolean status;

    @Schema(
        description = "Hãng sản xuất phim",
        example = "Toei Animation"
    )
    @NotBlank
    private String movieProductionCompany;

    @Schema(
        description = "URL ảnh banner lớn",
        example = "https://cloudinary.com/movie-large.jpg"
    )
    private String largeImage;

    @Schema(
        description = "URL ảnh poster nhỏ",
        example = "https://cloudinary.com/movie-small.jpg"
    )
    private String smallImage;

    @Schema(
        description = "Danh sách ID thể loại phim",
        example = "[1,2,3]"
    )
    private List<Long> typeIds;

    @Schema(
        description = "Danh sách suất chiếu của phim"
    )
    @Valid
    private List<ShowTimeRequest> showTimes;
}