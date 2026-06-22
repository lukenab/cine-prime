import AuthLayout from "../layouts/AuthLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import LoginPage from "../pages/auth/LoginPage";
import HomePage from "../pages/customer/HomePage";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import AdminDashboard from "../pages/admin/AdminDashboardPage";
import ManageUserPage from "../pages/admin/ManageUserPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ManageMoviePage from "../pages/admin/ManageMoviePage";
import CreateUserPage from "../pages/admin/CreateUserPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      <Route element={<AuthLayout/>}>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="register" element={<RegisterPage/>}/>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["ROLE_ADMIN"]}/>}>
        <Route path="/admin" element={<AdminLayout/>}>
            <Route index element={<AdminDashboard/>}/>

            <Route path="users" element={<ManageUserPage/>}/>
            <Route path="users/create" element={<CreateUserPage/>}/>

            <Route path="movies" element={<ManageMoviePage/>}/>
        </Route>
      </Route>
    </Routes>
  );
}
