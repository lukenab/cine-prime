package movieservice.entity;

import java.io.Serializable;

import jakarta.persistence.Column;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MovieTypeId implements Serializable {
    @Column(name = "movie_id", length = 10)
    private Integer movieId;

    @Column(name = "type_id")
    private Long typeId;
}
