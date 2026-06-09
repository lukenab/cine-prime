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
@Table(name = "movie_type")
public class MovieType {

    @EmbeddedId
    private MovieTypeId id = new MovieTypeId();

    @ManyToOne
    @MapsId("movieId") // Khớp với 'movieId' trong MovieTypeId
    @JoinColumn(name = "movie_id")
    @JsonIgnore
    private Movie movie;

    @ManyToOne // 🌟 ĐÃ SỬA: Không để thuộc tính cascade ở đây nữa!
    @MapsId("typeId")
    @JoinColumn(name = "type_id")
    @JsonBackReference
    private Type type;
}