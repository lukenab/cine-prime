package movieservice.entity;

import java.time.LocalDateTime;
import java.util.List;

import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
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
import movieservice.constant.ApiConstants;

import org.hibernate.annotations.SQLRestriction;


@Entity
@Table(name = "movie")
@SQLRestriction("status = true")
@Schema(name = "Movie", description = "Thông tin phim trả về từ movie-service")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Movie {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "movie_id")
        @Schema(description = ApiConstants.MOVIE_ID_DESC, example = ApiConstants.MOVIE_ID_EXAMPLE)
        private Long movieId;

        @Column(name = "actor")
        @Schema(description = ApiConstants.MOVIE_ACTOR_DESC, example = ApiConstants.ACTOR_EXAMPLE)
        private String actor;

        @Column(name = "content")
        @Schema(description = ApiConstants.CONTENT_DESC, example = ApiConstants.CONTENT_EXAMPLE)
        private String content;

        @Column(name = "director")
        @Schema(description = ApiConstants.MOVIE_DIRECTOR_DESC, example = ApiConstants.DIRECTOR_EXAMPLE)
        private String director;
        @Column(name = "accoountId")
        private String accoountId;
        @Column(name = "duration")
        @Schema(description = ApiConstants.DURATION_DESC, example = ApiConstants.DURATION_EXAMPLE)
        private Long duration;

        @Column(name = "movie_production_company")
        @Schema(description = ApiConstants.MOVIE_PRODUCTION_COMPANY_DESC, example = ApiConstants.PRODUCTION_COMPANY_EXAMPLE)
        private String movieProductionCompany;

        @Column(name = "version")
        @Schema(description = ApiConstants.MOVIE_VERSION_DESC, example = ApiConstants.VERSION_EXAMPLE)
        private String version;

        @Column(name = "movie_name_english")
        @Schema(description = ApiConstants.MOVIE_EN_NAME_DESC, example = ApiConstants.MOVIE_NAME_EXAMPLE)
        private String movieNameEnglish;

        @Column(name = "movie_name_vn")
        @Schema(description = ApiConstants.MOVIE_VN_NAME_DESC, example = ApiConstants.MOVIE_NAME_EXAMPLE)
        private String movieNameVn;

        @Column(name = "large_image")
        @Schema(description = ApiConstants.LARGE_IMAGE_DESC, example = ApiConstants.LARGE_IMAGE_EXAMPLE)
        private String largeImage;

        @Column(name = "small_image")
        @Schema(description = ApiConstants.SMALL_IMAGE_DESC, example = ApiConstants.SMALL_IMAGE_EXAMPLE)
        private String smallImage;
        @Schema(description = ApiConstants.STATUS_DESC, example = ApiConstants.STATUS_EXAMPLE)
        private Boolean status;
        @ManyToMany
        @JsonManagedReference
        @Schema(description = ApiConstants.MOVIE_TYPES_DESC)
        private List<MovieType> movieTypes;

        @OneToMany(mappedBy = "movie", fetch = FetchType.EAGER)
        @JsonManagedReference
        @JsonIgnore
        private List<ShowTime> showTimes;

        @CreatedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        @Schema(description = ApiConstants.CREATE_AT_DESC, example = ApiConstants.CREATE_AT_EXAMPLE)
        private LocalDateTime createAt; // Đổi từ LocalTime sang LocalDateTime

        @LastModifiedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        @Schema(description = ApiConstants.UPDATE_AT_DESC, example = ApiConstants.UPDATE_AT_EXAMPLE)
        @Column(name = "updated_at")
        private LocalDateTime updatedAt;
}
