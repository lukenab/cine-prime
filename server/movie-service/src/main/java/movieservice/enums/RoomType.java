package movieservice.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum RoomType {

    STANDARD(100, 10, "Standard"),
    LARGE(200, 10, "Large"),
    IMAX(300, 15, "IMAX");

    private final int maxSeats;
    private final int seatsPerRow;
    private final String displayName;
}
