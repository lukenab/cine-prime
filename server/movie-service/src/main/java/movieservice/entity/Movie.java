package movieservice.entity;

import java.time.LocalDateTime;
import java.util.List;

import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.annotation.CreatedDate;
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
        private Long movieId;

        @Column(name = "actor")
        private String actor;

        @Column(name = "content")
        private String content;

        @Column(name = "director")
        private String director;
        @Column(name = "accoountId")
        private String accoountId;
        @Column(name = "duration")
        private Long duration;

        @Column(name = "movie_production_company")
        private String movieProductionCompany;

        @Column(name = "version")
        private String version;

        @Column(name = "movie_name_english")
        private String movieNameEnglish;

        @Column(name = "movie_name_vn")
        private String movieNameVn;

        @Column(name = "large_image")
        private String largeImage;

        @Column(name = "small_image")
        private String smallImage;
        private Boolean status = false;
        @ManyToMany
        @JoinTable(name = "movie_type", joinColumns = @JoinColumn(name = "movie_id"), inverseJoinColumns = @JoinColumn(name = "type_id"))
        private List<TypeMovie> types;

        @OneToMany(mappedBy = "movie", fetch = FetchType.EAGER)
        @JsonManagedReference
        @JsonIgnore
        private List<ShowTime> showTimes;

        @CreatedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        private LocalDateTime createAt;  

        @UpdateTimestamp
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        private LocalDateTime updateAt;
}
