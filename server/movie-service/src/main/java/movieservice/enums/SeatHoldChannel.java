package movieservice.enums;

public enum SeatHoldChannel {
    WEB,
    MOBILE,
    COUNTER;

    public static SeatHoldChannel fromHeader(String value) {
        if (value == null || value.isBlank()) {
            return WEB;
        }
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return WEB;
        }
    }
}
