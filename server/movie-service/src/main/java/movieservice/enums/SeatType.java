package movieservice.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum SeatType {
    // displayName, priceMultiplier (ap dung len defaultPrice cua phong khi sinh ghe tu dong),
    // colSpan (so cot vat ly ghe nay chiem trong hang - Couple/Sweetbox la ghe doi lien khoi nen = 2)
    STANDARD("Standard", 1.0, 1),
    VIP("VIP", 1.25, 1),
    COUPLE("Couple", 1.8, 2),
    SWEETBOX("Sweetbox", 1.8, 2);

    private final String displayName;
    private final double priceMultiplier;
    private final int colSpan;
}
