package movieservice.enums;

public enum LayoutStatus {
    /** Đang soạn — chỉnh sửa tự do, không tăng version */
    DRAFT,
    /** Đã submit, chờ ADMIN duyệt */
    PENDING_APPROVAL,
    /** ADMIN đã duyệt nhưng chưa activate (chưa sync vào Seat) */
    APPROVED,
    /** Đang là layout vận hành của phòng — bất biến, sync vào Seat */
    ACTIVE,
    /** ADMIN từ chối — quay lại DRAFT kèm rejectionReason */
    REJECTED,
    /** Đã bị 1 version mới hơn thay thế sau khi activate version đó */
    SUPERSEDED
}
