import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  allowIncompleteProfile?: boolean;
}

export default function ProtectedRoute({ allowedRoles, allowIncompleteProfile = false }: ProtectedRouteProps) {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const context = useOutletContext();
  const location = useLocation();
  const { needsProfileSetup, profileCheckPending } = useAuth();

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

  if (profileCheckPending) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-sm text-white/50">Checking your profile…</div>;
  }

  if (needsProfileSetup && !allowIncompleteProfile) {
    return <Navigate to="/profile-setup" replace state={{ returnTo: `${location.pathname}${location.search}` }} />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet context={context} />;
}
