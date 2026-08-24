import { Navigate } from "react-router-dom";
import { defaultPathForRole } from "../utils/roleRoutes";

export default function RootRedirect() {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  if (token && role && role !== "ROLE_MEMBER") {
    return <Navigate to={defaultPathForRole(role)} replace />;
  }

  return <Navigate to="/home" replace />;
}
