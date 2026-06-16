package movieservice.entity;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "movie")
@Schema(name = "Movie", description = "Thông tin phim trả về từ movie-service")
@EntityListeners(AuditingEntityListener.class)
public class Movie {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "movie_id")
        @Schema(description = "ID của phim", example = "123")
        private Long movieId;

        @Column(name = "actor")
        @Schema(description = "Danh sách diễn viên (chuỗi)", example = "Luffy, Uta, Shanks")
        private String actor;

        @Column(name = "content")
        @Schema(description = "Nội dung tóm tắt của phim", example = "Câu chuyện về Uta và băng Mũ Rơm...")
        private String content;

        @Column(name = "director")
        @Schema(description = "Đạo diễn", example = "Goro Taniguchi")
        private String director;

        @Column(name = "duration")
        @Schema(description = "Thời lượng phim (phút)", example = "115")
        private Long duration;

        @Column(name = "movie_production_company")
        @Schema(description = "Hãng sản xuất", example = "Toei Animation")
        private String movieProductionCompany;

        @Column(name = "version")
        @Schema(description = "Phiên bản / định dạng phim", example = "2D")
        private String version;

        @Column(name = "movie_name_english")
        @Schema(description = "Tên phim tiếng Anh", example = "One Piece Film Red")
        private String movieNameEnglish;

        @Column(name = "movie_name_vn")
        @Schema(description = "Tên phim tiếng Việt", example = "One Piece Film Red")
        private String movieNameVn;

        @Column(name = "large_image")
        @Schema(description = "URL ảnh banner lớn", example = "https://cloudinary.com/movie-large.jpg")
        private String largeImage;

        @Column(name = "small_image")
        @Schema(description = "URL ảnh poster nhỏ", example = "https://cloudinary.com/movie-small.jpg")
        private String smallImage;
        @Schema(description = "Trạng thái hoạt động", example = "true")
        private Boolean status;
        // movie type
        @ManyToMany
        @JoinTable(name = "movie_type", joinColumns = @JoinColumn(name = "movie_id"), inverseJoinColumns = @JoinColumn(name = "type_id"))
        private List<TypeMovie> types;

        @OneToMany(mappedBy = "movie", fetch = FetchType.LAZY)
        @JsonManagedReference
        @Schema(description = "Danh sách suất chiếu của phim")
        private List<ShowTime> showTimes;

        @CreatedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        @Schema(description = "Thời điểm tạo bản ghi (dd-MM-yyyy HH:mm)", example = "10-06-2026 15:30")
        private LocalDateTime createAt; // Đổi từ LocalTime sang LocalDateTime
}
