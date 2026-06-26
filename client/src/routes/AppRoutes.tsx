import AuthLayout from "../layouts/AuthLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import LoginPage from "../pages/auth/LoginPage";
import { Route, Routes } from "react-router-dom";
import RootRedirect from "./RootRedirect";
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
import ManageBookingPage from "../pages/admin/ManageBookingPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<RootRedirect />} />
      </Route>

      <Route element={<AuthLayout/>}>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="register" element={<RegisterPage/>}/>
      </Route>

      {/* ADMIN + EMPLOYEE shared */}
      <Route element={<ProtectedRoute allowedRoles={["ROLE_ADMIN", "ROLE_EMPLOYEE"]}/>}>
        <Route path="/admin" element={<AdminLayout/>}>
          <Route index element={<AdminDashboard/>}/>

          {/* Accessible by both ADMIN and EMPLOYEE */}
          <Route path="movies"    element={<ManageMoviePage/>}/>
          <Route path="showtimes" element={<ManageShowTimePage/>}/>
          <Route path="bookings"  element={<ManageBookingPage/>}/>

          {/* ADMIN only */}
          <Route element={<ProtectedRoute allowedRoles={["ROLE_ADMIN"]}/>}>
            <Route path="users"          element={<ManageUserPage/>}/>
            <Route path="users/create"   element={<CreateUserPage/>}/>
            <Route path="users/edit/:id" element={<EditUserPage/>}/>
            <Route path="users/:id"      element={<UserDetailPage/>}/>
            <Route path="rooms"          element={<ManageCinemaRoomsPage/>}/>
            <Route path="rooms/:id"      element={<RoomDetailPage/>}/>
            <Route path="genres"         element={<ManageGenresPage/>}/>
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
