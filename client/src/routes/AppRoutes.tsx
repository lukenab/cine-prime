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
import ManageCinemaRoomsPage from "../pages/admin/ManageCinemaRoomsPage";
import RoomDetailPage from "../pages/admin/RoomDetailPage";
import ManageGenresPage from "../pages/admin/ManageGenresPage";
import ManageShowTimePage from "../pages/admin/ManageShowTimePage";
import CreateUserPage from "../pages/admin/CreateUserPage";
import EditUserPage from "../pages/admin/EditUserPage";
import UserDetailPage from "../pages/admin/UserDetailPage";

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
            <Route path="users/edit/:id" element={<EditUserPage/>}/>
            <Route path="users/:id" element={<UserDetailPage/>}/>

            <Route path="movies" element={<ManageMoviePage/>}/>
            <Route path="rooms" element={<ManageCinemaRoomsPage/>}/>
            <Route path="rooms/:id" element={<RoomDetailPage/>}/>
            <Route path="genres" element={<ManageGenresPage/>}/>
            <Route path="showtimes" element={<ManageShowTimePage/>}/>
        </Route>
      </Route>
    </Routes>
  );
}
