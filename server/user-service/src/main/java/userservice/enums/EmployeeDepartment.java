package userservice.enums;

public enum EmployeeDepartment {
    GENERAL_OPERATIONS,
    BOX_OFFICE,
    FOOD_BEVERAGE,
    FLOOR_GUEST_SERVICES,
    PROJECTION_TECHNICAL,
    FACILITIES_MAINTENANCE,
    CONTENT_PROGRAMMING,
    FINANCE,
    COMMERCIAL,
    INFORMATION_TECHNOLOGY,
    RISK_COMPLIANCE,

    // Legacy values retained so existing employee rows remain readable.
    @Deprecated
    CONCESSION,
    @Deprecated
    FLOOR,
    @Deprecated
    PROJECTION,
    @Deprecated
    CUSTOMER_SERVICE,
    @Deprecated
    MANAGEMENT
}
