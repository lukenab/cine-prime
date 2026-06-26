import { Navigate } from "react-router-dom";
import HomePage from "../pages/customer/HomePage";

export default function RootRedirect() {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  if (token && (role === "ROLE_ADMIN" || role === "ROLE_EMPLOYEE")) {
    return <Navigate to="/admin" replace />;
  }

  return <HomePage />;
}
