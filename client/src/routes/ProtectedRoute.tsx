import { Navigate, Outlet, useOutletContext } from "react-router-dom";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const context = useOutletContext();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet context={context} />;
}
