package movieservice.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "movie_schedule")
public class MovieSchedule {

    @EmbeddedId
    private MovieScheduleConnect id = new MovieScheduleConnect();

    @ManyToOne
    @MapsId("movieId") // Phải khớp chính xác với tên biến 'movieId' trong MovieScheduleId
    @JoinColumn(name = "movie_id")
    @JsonIgnore
    private Movie movie;

    @ManyToOne
    @MapsId("showTimeId") // Phải khớp chính xác với tên biến 'scheduleId' trong MovieScheduleId
    @JoinColumn(name = "showtime_id")
    @JsonBackReference
    private ShowTime showTime;
}