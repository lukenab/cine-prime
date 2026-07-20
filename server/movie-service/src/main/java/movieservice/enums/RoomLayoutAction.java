package movieservice.enums;

public enum RoomLayoutAction {
    /** Layout version mới được tạo (create hoặc clone) */
    CREATE,
    /** Lưu bản nháp (không đổi status) */
    SAVE,
    /** Submit để ADMIN duyệt (DRAFT → PENDING_APPROVAL) */
    SUBMIT,
    /** ADMIN duyệt (PENDING_APPROVAL → APPROVED) */
    APPROVE,
    /** ADMIN từ chối (PENDING_APPROVAL → DRAFT) */
    REJECT,
    /** ADMIN activate — sync vào Seat, version cũ → SUPERSEDED (APPROVED → ACTIVE) */
    ACTIVATE,
    /** Clone version APPROVED/ACTIVE/REJECTED/SUPERSEDED thành version+1 DRAFT mới */
    CLONE
}
