package userservice.enums;

public enum EmployeePosition {
    TEAM_MEMBER,
    SUPERVISOR,
    ASSISTANT_MANAGER,
    CINEMA_MANAGER,
    PROGRAMMING_OPERATOR,
    PROGRAMMING_APPROVER,
    FINANCE_OFFICER,
    FINANCE_APPROVER,
    COMMERCIAL_MANAGER,
    COMMERCIAL_APPROVER,
    SYSTEM_ADMINISTRATOR,
    SECURITY_AUDITOR,

    // Legacy values retained so existing employee rows remain readable.
    @Deprecated
    STAFF,
    @Deprecated
    MANAGER
}
