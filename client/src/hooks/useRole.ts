import { useAuth } from "../context/AuthContext";

/**
 * Role-aware permission hook.
 * Mirrors the backend @PreAuthorize annotations so UI hides
 * buttons that would return 403 anyway.
 */
export function useRole() {
  const { user, hasRole, hasPermission } = useAuth();
  // Fallback to localStorage for ProtectedRoute compatibility
  const role = user?.role ?? localStorage.getItem("role") ?? "";

  const isAdmin    = hasRole("ROLE_ADMIN", "ROLE_SUPER_ADMIN");
  const isSystemAdmin = hasRole("ROLE_SYSTEM_ADMIN");
  const isBranchManager = role === "ROLE_BRANCH_MANAGER";
  const isEmployee = role === "ROLE_EMPLOYEE";
  const isProgrammingOperator = role === "ROLE_PROGRAMMING_OPERATOR";
  const isProgrammingApprover = hasRole("ROLE_PROGRAMMING_APPROVER");
  const isFinanceOfficer = hasRole("ROLE_FINANCE_OFFICER");
  const isFinanceApprover = hasRole("ROLE_FINANCE_APPROVER");
  const isCommercialManager = hasRole("ROLE_COMMERCIAL_MANAGER");
  const isCommercialApprover = hasRole("ROLE_COMMERCIAL_APPROVER");
  const isSecurityAuditor = hasRole("ROLE_SECURITY_AUDITOR");
  const isMember   = role === "ROLE_MEMBER";

  return {
    role,
    username: user?.username ?? "",
    isAdmin,
    isSystemAdmin,
    isBranchManager,
    isEmployee,
    isProgrammingOperator,
    isProgrammingApprover,
    isFinanceOfficer,
    isFinanceApprover,
    isCommercialManager,
    isCommercialApprover,
    isSecurityAuditor,
    hasPermission,
    isMember,
    /**
     * Fine-grained permission flags — each matches the backend
     * @PreAuthorize on the corresponding endpoint.
     */
    can: {
      // ADMIN or EMPLOYEE
      submit  : isAdmin || hasPermission("MOVIE_SUBMIT", "RELEASE_PLAN_SUBMIT", "SCHEDULE_PLAN_SUBMIT"),
      startRevision: isAdmin || hasPermission("MOVIE_UPDATE"),
      edit    : isAdmin || hasPermission("MOVIE_UPDATE", "RELEASE_PLAN_EDIT"),
      view    : isAdmin || hasPermission("MOVIE_READ", "RELEASE_PLAN_READ"),
      archive : isAdmin || hasPermission("MOVIE_APPROVE"),

      // ADMIN only
      approve       : isAdmin || hasPermission("MOVIE_APPROVE", "RELEASE_PLAN_APPROVE", "SCHEDULE_PLAN_APPROVE"),
      requestChanges: isAdmin || hasPermission("MOVIE_APPROVE", "RELEASE_PLAN_APPROVE", "SCHEDULE_PLAN_APPROVE"),
      reject        : isAdmin || hasPermission("MOVIE_APPROVE"), // Cinema Cluster still uses reject terminology.
    },
  };
}
