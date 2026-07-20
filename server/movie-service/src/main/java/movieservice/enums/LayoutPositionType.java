package movieservice.enums;

public enum LayoutPositionType {
    /** Vị trí bán được — bắt buộc có seatNumber/seatCode/seatType */
    SEAT,
    /** Lối đi — không có seat fields */
    AISLE,
    /** Lối thoát hiểm — không có seat fields */
    EXIT,
    /** Vùng trống (cột, thiết bị...) — không có seat fields */
    EMPTY_SPACE
}
