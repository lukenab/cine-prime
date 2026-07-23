import { Route, Routes } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import AdminLayout from "../layouts/AdminLayout";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import CompleteProfilePage from "../pages/auth/CompleteProfilePage";
import ActivateAccountPage from "../pages/auth/ActivateAccountPage";

import HomePage from "../pages/customer/HomePage";
import MoviesPage from "../pages/customer/MoviesPage";
import CinemasPage from "../pages/customer/CinemasPage";
import EventsPage from "../pages/customer/EventsPage";
import OffersPage from "../pages/customer/OffersPage";
import ShowtimePage from "../pages/customer/ShowtimePage";
import SeatBookingPage from "../pages/customer/SeatBookingPage";
import ProfilePage from "../pages/customer/ProfilePage";

import AdminDashboard from "../pages/admin/AdminDashboardPage";
import ManageUserPage from "../pages/admin/ManageUserPage";
import ManageMoviePage from "../pages/admin/ManageMoviePage";
import MovieEditorPage from "../pages/admin/MovieEditorPage";
import MovieCreationStartPage from "../pages/admin/MovieCreationStartPage";
import TmdbCatalogPage from "../pages/admin/TmdbCatalogPage";
import ManageCinemaClusterPage from "../pages/admin/ManageCinemaClusterPage";
import RoomDetailPage from "../pages/admin/RoomDetailPage";
import ClusterDetailPage from "../pages/admin/ClusterDetailPage";
import CinemaRoomEditorPage from "../pages/admin/CinemaRoomEditorPage";
import ManageGenresPage from "../pages/admin/ManageGenresPage";
import CreateUserPage from "../pages/admin/CreateUserPage";
import EditUserPage from "../pages/admin/EditUserPage";
import UserDetailPage from "../pages/admin/UserDetailPage";
import ManageShowtimePage from "../pages/admin/ManageShowTimePage";
import AutoScheduleWorkspacePage from "../pages/admin/AutoScheduleWorkspacePage";
import ManageBookingPage from "../pages/admin/ManageBookingPage";
import ManageEmployeePage from "../pages/admin/ManageEmployeePage";
import CreateEmployeePage from "../pages/admin/CreateEmployeePage";
import EmployeeDetailPage from "../pages/admin/EmployeeDetailPage";
import EditEmployeePage from "../pages/admin/EditEmployeePage";
import ManagePersonsPage from "../pages/admin/ManagePersonsPage";
import ManageAgeRatingsPage from "../pages/admin/ManageAgeRatingsPage";
import ManageFormatsPage from "../pages/admin/ManageFormatsPage";
import ManageCompaniesPage from "../pages/admin/ManageCompaniesPage";
import ManagePromotionPage from "../pages/admin/ManagePromotionPage";
import CreatePromotionPage from "../pages/admin/CreatePromotionPage";
import EditPromotionPage from "../pages/admin/EditPromotionPage";
import PromotionDetailPage from "../pages/admin/PromotionDetailPage";
import ReportPage from "../pages/admin/ReportPage";
import SettingsPage from "../pages/admin/SettingsPage";
import TicketSalePage from "../pages/admin/TicketSalePage";

import RootRedirect from "./RootRedirect";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Customer routes — open to browse; profile gate is inside SeatBookingPage */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/cinemas" element={<CinemasPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/showtime/:movieId" element={<ShowtimePage />} />
        <Route path="/booking/:showtimeId" element={<SeatBookingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/activate-account" element={<ActivateAccountPage />} />
      </Route>

      {/* Profile setup — standalone page, no layout wrapper */}
      <Route path="/profile-setup" element={<CompleteProfilePage />} />

      {/* Admin + Employee */}
      <Route element={<ProtectedRoute allowedRoles={["ROLE_SUPER_ADMIN", "ROLE_ADMIN", "ROLE_EMPLOYEE"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />

          {/* ADMIN + EMPLOYEE */}
          <Route path="movies" element={<ManageMoviePage />}>
            <Route path="new" element={<MovieCreationStartPage />} />
          </Route>
          <Route path="movies/new/catalog" element={<TmdbCatalogPage />} />
          <Route path="movies/new/manual" element={<MovieEditorPage />} />
          <Route path="movies/:movieId/edit" element={<MovieEditorPage />} />
          <Route path="clusters"  element={<ManageCinemaClusterPage />} />
          <Route path="clusters/:id" element={<ClusterDetailPage />} />
          <Route path="clusters/:clusterId/rooms/new" element={<CinemaRoomEditorPage />} />
          <Route path="clusters/:clusterId/rooms/:roomId/edit" element={<CinemaRoomEditorPage />} />
          <Route path="rooms/:id"    element={<RoomDetailPage />} />
          <Route path="showtimes" element={<ManageShowtimePage />} />
          <Route path="bookings"  element={<ManageBookingPage />} />
          <Route path="sell"      element={<TicketSalePage />} />

          <Route element={<ProtectedRoute allowedRoles={["ROLE_SUPER_ADMIN", "ROLE_ADMIN"]} />}>
            <Route path="showtimes/auto"     element={<AutoScheduleWorkspacePage />} />
            <Route path="employees"          element={<ManageEmployeePage />} />
            <Route path="employees/create"   element={<CreateEmployeePage />} />
            <Route path="employees/:id"      element={<EmployeeDetailPage />} />
            <Route path="employees/edit/:id" element={<EditEmployeePage />} />
            <Route path="users"              element={<ManageUserPage />} />
            <Route path="users/create"       element={<CreateUserPage />} />
            <Route path="users/edit/:id"     element={<EditUserPage />} />
            <Route path="users/:id"          element={<UserDetailPage />} />
            <Route path="genres"             element={<ManageGenresPage />} />
            <Route path="persons"            element={<ManagePersonsPage />} />
            <Route path="age-ratings"        element={<ManageAgeRatingsPage />} />
            <Route path="formats"            element={<ManageFormatsPage />} />
            <Route path="companies"          element={<ManageCompaniesPage />} />
            <Route path="promotions"          element={<ManagePromotionPage />} />
            <Route path="promotions/create"   element={<CreatePromotionPage />} />
            <Route path="promotions/:id"      element={<PromotionDetailPage />} />
            <Route path="promotions/edit/:id" element={<EditPromotionPage />} />
            <Route path="reports"   element={<ReportPage />} />
            <Route path="settings"  element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
