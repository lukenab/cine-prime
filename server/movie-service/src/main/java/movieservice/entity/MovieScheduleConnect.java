package movieservice.entity;


import java.io.Serializable;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class MovieScheduleConnect implements Serializable {
    
    @Column(name = "movie_id", length = 10)
    private Integer movieId;

    @Column(name = "showtime_id")
    private Long showTimeId;
}