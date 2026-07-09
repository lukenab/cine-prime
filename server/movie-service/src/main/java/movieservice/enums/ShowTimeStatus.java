package movieservice.enums;

public enum ShowTimeStatus {
    /** Suất đã được tạo nhưng chưa mở bán vé */
    SCHEDULED,
    /** Đang mở bán vé */
    ON_SALE,
    /** Suất bị hủy — tất cả showtime_seat chuyển CANCELLED */
    CANCELLED,
    /** Suất đã chiếu xong */
    COMPLETED,
    /** Tạm dừng (phim bị SUSPENDED) — tất cả showtime_seat giữ nguyên */
    SUSPENDED
}
