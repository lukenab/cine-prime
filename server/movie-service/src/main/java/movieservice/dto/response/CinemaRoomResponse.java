package movieservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Data
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CinemaRoomResponse {

    private Long cinemaRoomId;

    private String cinemaRoomName;


    private Integer seatQuantity;
}
