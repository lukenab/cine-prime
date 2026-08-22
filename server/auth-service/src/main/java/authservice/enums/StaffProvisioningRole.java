package authservice.enums;

/**
 * Staff roles accepted only through the trusted user-service invitation flow.
 *
 * Keeping this separate from {@link AccountProvisioningRole} prevents callers of
 * the public admin account endpoint from creating a staff credential without the
 * matching employment assignment/projection owned by user-service.
 */
public enum StaffProvisioningRole {
    EMPLOYEE,
    BRANCH_MANAGER,
    PROGRAMMING_OPERATOR,
    PROGRAMMING_APPROVER,
    FINANCE_OFFICER,
    FINANCE_APPROVER,
    COMMERCIAL_MANAGER,
    SECURITY_AUDITOR,
    SYSTEM_ADMIN
}
