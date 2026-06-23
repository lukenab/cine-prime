package movieservice.entity;

import java.time.LocalDateTime;
import java.util.List;
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
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import movieservice.constant.ApiConstants;

import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(name = "movie")
@SQLRestriction("status = true")
@Schema(name = "Movie")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Movie {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "movie_id")
        @Schema(description = ApiConstants.MOVIE_ID_DESC, example = ApiConstants.MOVIE_ID_EXAMPLE)
        Long movieId;

        @Column(name = "actor")
        @Schema(description = ApiConstants.MOVIE_ACTOR_DESC, example = ApiConstants.ACTOR_EXAMPLE)
        String actor;

        @Column(name = "content")
        @Schema(description = ApiConstants.CONTENT_DESC, example = ApiConstants.CONTENT_EXAMPLE)
        String content;

        @Column(name = "director")
        @Schema(description = ApiConstants.MOVIE_DIRECTOR_DESC, example = ApiConstants.DIRECTOR_EXAMPLE)
        String director;
        @Column(name = "duration")
        @Schema(description = ApiConstants.DURATION_DESC, example = ApiConstants.DURATION_EXAMPLE)
        Long duration;

        @Column(name = "movie_production_company")
        @Schema(description = ApiConstants.MOVIE_PRODUCTION_COMPANY_DESC, example = ApiConstants.PRODUCTION_COMPANY_EXAMPLE)
        String movieProductionCompany;

        @Column(name = "version")
        @Schema(description = ApiConstants.MOVIE_VERSION_DESC, example = ApiConstants.VERSION_EXAMPLE)
        String version;

        @Column(name = "movie_name_english")
        @Schema(description = ApiConstants.MOVIE_EN_NAME_DESC, example = ApiConstants.MOVIE_NAME_EXAMPLE)
        String movieNameEnglish;

        @Column(name = "movie_name_vn")
        @Schema(description = ApiConstants.MOVIE_VN_NAME_DESC, example = ApiConstants.MOVIE_NAME_EXAMPLE)
        String movieNameVn;

        @Column(name = "large_image")
        @Schema(description = ApiConstants.LARGE_IMAGE_DESC, example = ApiConstants.LARGE_IMAGE_EXAMPLE)
        String largeImage;

        @Column(name = "small_image")
        @Schema(description = ApiConstants.SMALL_IMAGE_DESC, example = ApiConstants.SMALL_IMAGE_EXAMPLE)
        String smallImage;
        @Schema(description = ApiConstants.STATUS_DESC, example = ApiConstants.STATUS_EXAMPLE)
        Boolean status;
        @ManyToMany
        @JsonManagedReference
        @Schema(description = ApiConstants.MOVIE_TYPES_DESC)
        List<MovieType> movieTypes; // chỗ này tui để movieTypes bên ông để gì á, dô folder nén lúc nảy coi thử

        @OneToMany(mappedBy = "movie", fetch = FetchType.EAGER)
        @JsonManagedReference
        @JsonIgnore
        List<ShowTime> showTimes;

        @CreatedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        @Schema(description = ApiConstants.CREATE_AT_DESC, example = ApiConstants.CREATE_AT_EXAMPLE)
        LocalDateTime createAt;

        @LastModifiedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        @Schema(description = ApiConstants.UPDATE_AT_DESC, example = ApiConstants.UPDATE_AT_EXAMPLE)
        @Column(name = "updated_at")
        LocalDateTime updatedAt;
}
