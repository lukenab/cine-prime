package movieservice.entity;


import java.io.Serializable;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieScheduleConnect implements Serializable {
    
    @Column(name = "movie_id", length = 10)
    Integer movieId;

    @Column(name = "showtime_id")
    Long showTimeId;
}