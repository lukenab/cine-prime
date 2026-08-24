import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { RequestState } from "../components/shared/RequestState";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  allowedPermissions?: string[];
}

function storedAuthorities(key: "roles" | "permissions") {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as string[];
  } catch {
    return [];
  }
}

export default function ProtectedRoute({ allowedRoles, allowedPermissions }: ProtectedRouteProps) {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const roles = storedAuthorities("roles");
  const permissions = storedAuthorities("permissions");
  const context = useOutletContext();
  const location = useLocation();

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          returnTo: `${location.pathname}${location.search}${location.hash}`,
          returnState: location.state,
        }}
      />
    );
  }

  const roleAllowed = !allowedRoles || allowedRoles.some((allowed) => roles.includes(allowed) || role === allowed);
  const permissionAllowed = !allowedPermissions || allowedPermissions.some((allowed) => permissions.includes(allowed));
  if (!roleAllowed || !permissionAllowed) {
    return (
      <RequestState
        kind="forbidden"
        title="This page is outside your assigned workspace"
        description="Your account is active, but it does not have the business capability required for this route. Ask a system administrator to review your role assignment if you need access."
      />
    );
  }

  return <Outlet context={context} />;
}
