package userservice.enums;

public enum EmploymentType {
    FULL_TIME,
    PART_TIME,
    FIXED_TERM,
    SEASONAL,

    // Legacy values retained so existing employee rows remain readable.
    @Deprecated
    PROBATION,
    @Deprecated
    INTERN,
    @Deprecated
    CONTRACT
}
