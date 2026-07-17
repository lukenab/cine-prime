package movieservice.enums;

public enum CinemaRoomStatus {
    // Legacy operational states — unchanged, used by the pre-existing quick-create
    // flow and maintenance workflow (see CinemaRoomMaintenance).
    ACTIVE,
    MAINTENANCE,
    TEMPORARILY_UNAVAILABLE,
    CLOSED,

    // Wizard approval-workflow states, added additively — driven by the room's
    // current/active RoomLayout lifecycle (see RoomLayoutService).
    /** Phòng mới tạo qua wizard, chưa submit layout để duyệt */
    DRAFT,
    /** Layout đã submit, chờ ADMIN duyệt */
    PENDING_APPROVAL,
    /** Layout đã được duyệt nhưng chưa activate */
    APPROVED,
    /** ADMIN tạm ngưng vận hành phòng (khác MAINTENANCE — không có lịch bảo trì cụ thể) */
    SUSPENDED,
    /** Ngừng vận hành vĩnh viễn */
    RETIRED
}
