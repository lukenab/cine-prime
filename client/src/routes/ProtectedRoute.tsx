import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";

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
    return <Navigate to="/" replace />;
  }

  return <Outlet context={context} />;
}
