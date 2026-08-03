package userservice.enums;

public enum EmployeePosition {
    TEAM_MEMBER,
    SUPERVISOR,
    ASSISTANT_MANAGER,
    CINEMA_MANAGER,
    PROGRAMMING_OPERATOR,

    // Legacy values retained so existing employee rows remain readable.
    @Deprecated
    STAFF,
    @Deprecated
    MANAGER
}
