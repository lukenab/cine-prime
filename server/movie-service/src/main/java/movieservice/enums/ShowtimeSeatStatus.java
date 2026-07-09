package movieservice.enums;

public enum ShowtimeSeatStatus {
    /** Ghế còn trống, có thể đặt */
    AVAILABLE,
    /** Đang giữ tạm — tự giải phóng sau reserved_expires_at */
    RESERVED,
    /** Đã bán thành công (booking confirmed) */
    SOLD,
    /** Bị chặn (ghế hỏng hoặc admin block) */
    BLOCKED,
    /** Suất chiếu bị hủy → tất cả ghế chuyển trạng thái này */
    CANCELLED
}
