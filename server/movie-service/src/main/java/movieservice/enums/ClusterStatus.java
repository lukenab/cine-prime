package movieservice.enums;

public enum ClusterStatus {
    /** Cluster mới tạo, chưa submit — chưa hiển thị cho khách hàng */
    DRAFT,
    /** Đã submit, chờ SUPER_ADMIN duyệt */
    PENDING_REVIEW,
    /** Đã duyệt — hiển thị công khai */
    ACTIVE,
    /** Đã tắt tạm thời bởi ADMIN */
    INACTIVE
}
