import { useAuth } from "../context/AuthContext";

/**
 * Role-aware permission hook.
 * Mirrors the backend @PreAuthorize annotations so UI hides
 * buttons that would return 403 anyway.
 */
export function useRole() {
  const { user } = useAuth();
  // Fallback to localStorage for ProtectedRoute compatibility
  const role = user?.role ?? localStorage.getItem("role") ?? "";

  const isAdmin    = role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN";
  const isBranchManager = role === "ROLE_BRANCH_MANAGER";
  const isEmployee = role === "ROLE_EMPLOYEE";
  const isProgrammingOperator = role === "ROLE_PROGRAMMING_OPERATOR";
  const isMember   = role === "ROLE_MEMBER";

  return {
    role,
    username: user?.username ?? "",
    isAdmin,
    isBranchManager,
    isEmployee,
    isProgrammingOperator,
    isMember,
    /**
     * Fine-grained permission flags — each matches the backend
     * @PreAuthorize on the corresponding endpoint.
     */
    can: {
      // ADMIN or EMPLOYEE
      submit  : isAdmin || isProgrammingOperator,
      startRevision: isAdmin || isProgrammingOperator,
      edit    : isAdmin || isProgrammingOperator,
      view    : isAdmin || isProgrammingOperator,
      archive : isAdmin,

      // ADMIN only
      approve       : isAdmin,
      requestChanges: isAdmin,
      reject        : isAdmin, // Cinema Cluster still uses reject terminology.
    },
  };
}
