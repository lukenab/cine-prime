package movieservice.constant;

public final class ApiConstants {

    private ApiConstants() {
        // Prevent instantiation
    }

    // Descriptions
    public static final String MOVIE_VN_NAME_DESC = "Tên phim tiếng Việt";
    public static final String MOVIE_EN_NAME_DESC = "Tên phim tiếng Anh";
    public static final String DIRECTOR_DESC = "Tên đạo diễn";
    public static final String MOVIE_DIRECTOR_DESC = "Đạo diễn";
    public static final String ACTOR_DESC = "Danh sách diễn viên";
    public static final String MOVIE_ACTOR_DESC = "Danh sách diễn viên (chuỗi)";
    public static final String DURATION_DESC = "Thời lượng phim (phút)";
    public static final String CONTENT_DESC = "Nội dung tóm tắt của phim";
    public static final String VERSION_DESC = "Phiên bản phim";
    public static final String MOVIE_VERSION_DESC = "Phiên bản / định dạng phim";
    public static final String STATUS_DESC = "Trạng thái hoạt động";
    public static final String PRODUCTION_COMPANY_DESC = "Hãng sản xuất phim";
    public static final String MOVIE_PRODUCTION_COMPANY_DESC = "Hãng sản xuất";
    public static final String LARGE_IMAGE_DESC = "URL ảnh banner lớn";
    public static final String SMALL_IMAGE_DESC = "URL ảnh poster nhỏ";
    public static final String TYPE_IDS_DESC = "Danh sách ID thể loại phim";
    public static final String MOVIE_ID_DESC = "ID của phim";
    public static final String MOVIE_TYPES_DESC = "Danh sách thể loại phim";
    public static final String SHOWTIMES_DESC = "Danh sách suất chiếu của phim";
    public static final String CREATE_AT_DESC = "Thời điểm tạo bản ghi (dd-MM-yyyy HH:mm)";
    public static final String UPDATE_AT_DESC = "Thời điểm cập nhật bản ghi (dd-MM-yyyy HH:mm)";

    // Examples
    public static final String MOVIE_NAME_EXAMPLE = "One Piece Film Red";
    public static final String DIRECTOR_EXAMPLE = "Goro Taniguchi";
    public static final String ACTOR_EXAMPLE = "Luffy, Uta, Shanks";
    public static final String DURATION_EXAMPLE = "115";
    public static final String CONTENT_EXAMPLE = "Câu chuyện về Uta và băng Mũ Rơm...";
    public static final String VERSION_EXAMPLE = "2D";
    public static final String STATUS_EXAMPLE = "true";
    public static final String PRODUCTION_COMPANY_EXAMPLE = "Toei Animation";
    public static final String LARGE_IMAGE_EXAMPLE = "https://cloudinary.com/movie-large.jpg";
    public static final String SMALL_IMAGE_EXAMPLE = "https://cloudinary.com/movie-small.jpg";
    public static final String TYPE_IDS_EXAMPLE = "[1,2,3]";
    public static final String MOVIE_ID_EXAMPLE = "123";
    public static final String CREATE_AT_EXAMPLE = "10-06-2026 15:30";
    public static final String UPDATE_AT_EXAMPLE = "10-06-2026 16:30";

    // ResponseWrapper Constants
    public static final String RESPONSE_CODE_DESC = "Mã lỗi/thành công";
    public static final String RESPONSE_CODE_EXAMPLE = "200";
    public static final String RESPONSE_MESSAGE_DESC = "Thông báo";
    public static final String RESPONSE_MESSAGE_EXAMPLE = "Lấy movie thành công";
    public static final String RESPONSE_STATUS_DESC = "Trạng thái HTTP";
    public static final String RESPONSE_STATUS_EXAMPLE = "OK";
}
