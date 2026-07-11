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

  const isAdmin    = role === "ROLE_ADMIN";
  const isEmployee = role === "ROLE_EMPLOYEE";
  const isMember   = role === "ROLE_MEMBER";

  return {
    role,
    isAdmin,
    isEmployee,
    isMember,
    /**
     * Fine-grained permission flags — each matches the backend
     * @PreAuthorize on the corresponding endpoint.
     */
    can: {
      // ADMIN or EMPLOYEE
      submit  : isEmployee,              // DRAFT → PENDING_REVIEW (admin dùng approve thẳng)
      rework  : isAdmin || isEmployee,   // REJECTED → DRAFT
      edit    : isAdmin || isEmployee,
      view    : isAdmin || isEmployee,
      archive : isAdmin || isEmployee,   // → ENDED via DELETE endpoint

      // ADMIN only
      approve  : isAdmin,  // PENDING_REVIEW → COMING_SOON
      reject   : isAdmin,  // PENDING_REVIEW → REJECTED
      release  : isAdmin,  // COMING_SOON → NOW_SHOWING
      suspend  : isAdmin,  // NOW_SHOWING / COMING_SOON → SUSPENDED
      end      : isAdmin,  // → ENDED
      reinstate: isAdmin,  // SUSPENDED → NOW_SHOWING
    },
  };
}
