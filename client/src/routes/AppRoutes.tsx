import AuthLayout from "../layouts/AuthLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import LoginPage from "../pages/auth/LoginPage";
import HomePage from "../pages/customer/HomePage";
import ShowtimePage from "../pages/customer/ShowtimePage";
import SeatBookingPage from "../pages/customer/SeatBookingPage";
import { Route, Routes } from "react-router-dom";
import RootRedirect from "./RootRedirect";
import ProtectedRoute from "./ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import AdminDashboard from "../pages/admin/AdminDashboardPage";
import ManageUserPage from "../pages/admin/ManageUserPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ManageMoviePage from "../pages/admin/ManageMoviePage";
import ManageCinemaRoomsPage from "../pages/admin/ManageCinemaRoomsPage";
import ManageCinemaClusterPage from "../pages/admin/ManageCinemaClusterPage";
import RoomDetailPage from "../pages/admin/RoomDetailPage";
import ManageGenresPage from "../pages/admin/ManageGenresPage";
import CreateUserPage from "../pages/admin/CreateUserPage";
import EditUserPage from "../pages/admin/EditUserPage";
import UserDetailPage from "../pages/admin/UserDetailPage";
import ManageShowtimePage from "../pages/admin/ManageShowTimePage";
import ManageBookingPage from "../pages/admin/ManageBookingPage";
import ManageEmployeePage from "../pages/admin/ManageEmployeePage";
import CreateEmployeePage from "../pages/admin/CreateEmployeePage";
import EmployeeDetailPage from "../pages/admin/EmployeeDetailPage";
import EditEmployeePage from "../pages/admin/EditEmployeePage";
import ManagePromotionPage from "../pages/admin/ManagePromotionPage";
import CreatePromotionPage from "../pages/admin/CreatePromotionPage";
import EditPromotionPage from "../pages/admin/EditPromotionPage";
import PromotionDetailPage from "../pages/admin/PromotionDetailPage";
import ReportPage from "../pages/admin/ReportPage";
import SettingsPage from "../pages/admin/SettingsPage";
import TicketSalePage from "../pages/admin/TicketSalePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/showtime/:movieId" element={<ShowtimePage />} />
        <Route path="/booking/:showtimeId" element={<SeatBookingPage />} />
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
          <Route path="showtimes" element={<ManageShowtimePage/>}/>
          <Route path="bookings"  element={<ManageBookingPage/>}/>
          <Route path="sell"      element={<TicketSalePage/>}/>

          {/* ADMIN only */}
          <Route element={<ProtectedRoute allowedRoles={["ROLE_ADMIN"]}/>}>
            <Route path="employees"              element={<ManageEmployeePage/>}/>
            <Route path="employees/create"       element={<CreateEmployeePage/>}/>
            <Route path="employees/:id"          element={<EmployeeDetailPage/>}/>
            <Route path="employees/edit/:id"     element={<EditEmployeePage/>}/>
            <Route path="users"          element={<ManageUserPage/>}/>
            <Route path="users/create"   element={<CreateUserPage/>}/>
            <Route path="users/edit/:id" element={<EditUserPage/>}/>
            <Route path="users/:id"      element={<UserDetailPage/>}/>
            <Route path="clusters"       element={<ManageCinemaClusterPage/>}/>
            <Route path="rooms"          element={<ManageCinemaRoomsPage/>}/>
            <Route path="rooms/:id"      element={<RoomDetailPage/>}/>
            <Route path="genres"         element={<ManageGenresPage/>}/>
            <Route path="promotions"              element={<ManagePromotionPage/>}/>
            <Route path="promotions/create"       element={<CreatePromotionPage/>}/>
            <Route path="promotions/:id"          element={<PromotionDetailPage/>}/>
            <Route path="promotions/edit/:id"     element={<EditPromotionPage/>}/>
            <Route path="reports"   element={<ReportPage/>}/>
            <Route path="settings" element={<SettingsPage/>}/>
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

