package movieservice.entity;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "movie")
public class Movie {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "movie_id")
        private Integer movieId;

        @Column(name = "actor")
        private String actor;

        @Column(name = "content")
        private String content;

        @Column(name = "director")
        private String director;

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
        private Integer roomId;
        private Boolean isDeleted = false;
        // movie type
        @OneToMany(mappedBy = "movie", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
        private List<MovieType> movieTypes;

        // showtimes
        @OneToMany(mappedBy = "movie", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
        private List<MovieSchedule> movieSchedules;

        
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        private LocalDateTime createAt; // Đổi từ LocalTime sang LocalDateTime
}
