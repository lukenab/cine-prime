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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(name = "movie")
@SQLRestriction("status = true")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Movie {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "movie_id")
        Long movieId;

        @Column(name = "actor")
        String actor;

        @Column(name = "content")
        String content;

        @Column(name = "director")
        String director;

        @Column(name = "duration")
        Long duration;

        @Column(name = "movie_production_company")
        String movieProductionCompany;

        @Column(name = "version")
        String version;

        @Column(name = "movie_name_english")
        String movieNameEnglish;

        @Column(name = "movie_name_vn")
        String movieNameVn;

        @Column(name = "large_image")
        String largeImage;

        @Column(name = "small_image")
        String smallImage;

        Boolean status;

        @ManyToMany
        @JsonManagedReference
        List<MovieType> movieTypes;

        @OneToMany(mappedBy = "movie", fetch = FetchType.EAGER)
        @JsonManagedReference
        @JsonIgnore
        List<ShowTime> showTimes;

        @CreatedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        LocalDateTime createAt;

        @LastModifiedDate
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy HH:mm", timezone = "Asia/Ho_Chi_Minh")
        @Column(name = "updated_at")
        LocalDateTime updatedAt;
}
