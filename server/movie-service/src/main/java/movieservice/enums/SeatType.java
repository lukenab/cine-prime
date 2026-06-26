package movieservice.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum SeatType {
    STANDARD("Standard"),
    VIP("VIP"),
    COUPLE("Couple");

    private final String displayName;
}
