package movieservice.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum SeatInventoryEventType {
    HELD("seat.held"),
    RELEASED("seat.released"),
    SOLD("seat.sold");

    private final String wireName;

    public static boolean isSupported(String value) {
        for (SeatInventoryEventType type : values()) {
            if (type.wireName.equals(value)) {
                return true;
            }
        }
        return false;
    }
}
