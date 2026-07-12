package movieservice.enums;

public enum ClusterAction {
    /** Cluster được tạo lần đầu (status = DRAFT) */
    CREATE,
    /** ADMIN submit cluster để SUPER_ADMIN review (DRAFT → PENDING_REVIEW) */
    SUBMIT,
    /** SUPER_ADMIN duyệt cluster (PENDING_REVIEW → ACTIVE) */
    APPROVE,
    /** SUPER_ADMIN từ chối cluster (PENDING_REVIEW → DRAFT) */
    REJECT,
    /** ADMIN cập nhật dữ liệu cluster (không đổi status) */
    UPDATE,
    /** ADMIN tắt cluster (ACTIVE → INACTIVE) */
    DEACTIVATE,
    /** ADMIN mở lại cluster (INACTIVE → ACTIVE) */
    REACTIVATE
}
