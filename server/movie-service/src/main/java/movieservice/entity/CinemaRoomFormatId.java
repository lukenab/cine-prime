package movieservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CinemaRoomFormatId implements Serializable {

    @Column(name = "cinema_room_id")
    private Long cinemaRoomId;

    @Column(name = "format_id")
    private Integer formatId;
}
