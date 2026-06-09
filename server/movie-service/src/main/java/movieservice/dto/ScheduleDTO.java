package movieservice.dto;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import movieservice.entity.Movie;
import movieservice.entity.ShowTime;
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ScheduleDTO {
    @JoinColumn(name = "movie_id")
    @JsonIgnore
    private Movie movie;
    @JoinColumn(name = "showtime_id")
    private ShowTime showTime;
}
