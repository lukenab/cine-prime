import { Navigate, Route, Routes } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import AdminLayout from "../layouts/AdminLayout";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ProfileSetupPage from "../pages/auth/ProfileSetupPage";
import ActivateAccountPage from "../pages/auth/ActivateAccountPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";

import HomePage from "../pages/customer/HomePage";
import MoviesPage from "../pages/customer/MoviesPage";
import CinemasPage from "../pages/customer/CinemasPage";
import CinemaShowtimesPage from "../pages/customer/CinemaShowtimesPage";
import EventsPage from "../pages/customer/EventsPage";
import OffersPage from "../pages/customer/OffersPage";
import ShowtimePage from "../pages/customer/ShowtimePage";
import SeatBookingPage from "../pages/customer/SeatBookingPage";
import ProfilePage from "../pages/customer/ProfilePage";
import BookingCheckoutPage from "../pages/customer/BookingCheckoutPage";
import MyBookingsPage from "../pages/customer/MyBookingsPage";
import ConcessionSelectionPage from "../pages/customer/ConcessionSelectionPage";

import AdminDashboard from "../pages/admin/AdminDashboardPage";
import PeopleAccessPage from "../pages/admin/PeopleAccessPage";
import ManageMoviePage from "../pages/admin/ManageMoviePage";
import MovieEditorPage from "../pages/admin/MovieEditorPage";
import MovieCreationStartPage from "../pages/admin/MovieCreationStartPage";
import MovieAvailabilityPage from "../pages/admin/MovieAvailabilityPage";
import TmdbCatalogPage from "../pages/admin/TmdbCatalogPage";
import ManageCinemaClusterPage from "../pages/admin/ManageCinemaClusterPage";
import AllRoomsPage from "../pages/admin/AllRoomsPage";
import RoomDetailPage from "../pages/admin/RoomDetailPage";
import ClusterDetailPage from "../pages/admin/ClusterDetailPage";
import CinemaRoomEditorPage from "../pages/admin/CinemaRoomEditorPage";
import ManageGenresPage from "../pages/admin/ManageGenresPage";
import EditUserPage from "../pages/admin/EditUserPage";
import UserDetailPage from "../pages/admin/UserDetailPage";
import ManageShowtimePage from "../pages/admin/ManageShowTimePage";
import AutoScheduleWorkspacePage from "../pages/admin/AutoScheduleWorkspacePage";
import ManageBookingPage from "../pages/admin/ManageBookingPage";
import EmployeeDetailPage from "../pages/admin/EmployeeDetailPage";
import EditEmployeePage from "../pages/admin/EditEmployeePage";
import ManagePersonsPage from "../pages/admin/ManagePersonsPage";
import ManageAgeRatingsPage from "../pages/admin/ManageAgeRatingsPage";
import ManageFormatsPage from "../pages/admin/ManageFormatsPage";
import ManageScreeningVersionsPage from "../pages/admin/ManageScreeningVersionsPage";
import ManagePriceBooksPage from "../pages/admin/ManagePriceBooksPage";
import ManageCompaniesPage from "../pages/admin/ManageCompaniesPage";
import ManagePromotionPage from "../pages/admin/ManagePromotionPage";
import CreatePromotionPage from "../pages/admin/CreatePromotionPage";
import EditPromotionPage from "../pages/admin/EditPromotionPage";
import PromotionDetailPage from "../pages/admin/PromotionDetailPage";
import ReportPage from "../pages/admin/ReportPage";
import RefundReconciliationPage from "../pages/admin/RefundReconciliationPage";
import AuditTrailPage from "../pages/admin/AuditTrailPage";
import RolePermissionMatrixPage from "../pages/admin/RolePermissionMatrixPage";
import RolePermissionComparisonPage from "../pages/admin/RolePermissionComparisonPage";
import SettingsPage from "../pages/admin/SettingsPage";
import AdminProfilePage from "../pages/admin/AdminProfilePage";
import TicketSalePage from "../pages/admin/TicketSalePage";
import ConcessionFulfillmentPage from "../pages/admin/ConcessionFulfillmentPage";
import ConcessionCatalogPage from "../pages/admin/ConcessionCatalogPage";
import EmployeeDashboardPage from "../pages/employee/EmployeeDashboardPage";
import ProgrammingOperatorDashboardPage from "../pages/operator/ProgrammingOperatorDashboardPage";
import ReleasePlanningQueuePage from "../pages/operator/ReleasePlanningQueuePage";
import MyWorkforcePage from "../pages/workforce/MyWorkforcePage";
import WorkforceOperationsPage from "../pages/workforce/WorkforceOperationsPage";

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
        <Route path="/cinemas/:clusterId/showtimes" element={<CinemaShowtimesPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/showtime/:movieId" element={<ShowtimePage />} />
        <Route path="/booking/:showtimeId" element={<SeatBookingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route element={<ProtectedRoute allowedRoles={["ROLE_MEMBER"]} />}>
          <Route path="/checkout/:bookingId" element={<BookingCheckoutPage />} />
          <Route path="/checkout/:bookingId/concessions" element={<ConcessionSelectionPage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
        </Route>
      </Route>

      {/* Auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/activate-account" element={<ActivateAccountPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Profile setup — standalone page, no layout wrapper */}
      <Route element={<ProtectedRoute
        allowedRoles={["ROLE_MEMBER", "ROLE_EMPLOYEE", "ROLE_BRANCH_MANAGER", "ROLE_PROGRAMMING_OPERATOR",
          "ROLE_PROGRAMMING_APPROVER", "ROLE_FINANCE_OFFICER", "ROLE_FINANCE_APPROVER",
          "ROLE_COMMERCIAL_MANAGER", "ROLE_COMMERCIAL_APPROVER", "ROLE_SECURITY_AUDITOR", "ROLE_SYSTEM_ADMIN"]}
      />}>
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
      </Route>

      {/* Administrative workspace */}
      <Route element={<ProtectedRoute allowedRoles={["ROLE_SUPER_ADMIN", "ROLE_ADMIN", "ROLE_BRANCH_MANAGER", "ROLE_PROGRAMMING_OPERATOR",
        "ROLE_PROGRAMMING_APPROVER", "ROLE_FINANCE_OFFICER", "ROLE_FINANCE_APPROVER",
        "ROLE_COMMERCIAL_MANAGER", "ROLE_COMMERCIAL_APPROVER", "ROLE_SECURITY_AUDITOR", "ROLE_SYSTEM_ADMIN"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="profile" element={<AdminProfilePage />} />
          <Route element={<ProtectedRoute allowedPermissions={["RELEASE_PLAN_READ"]} />}>
            <Route path="programming" element={<ProgrammingOperatorDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["RELEASE_PLAN_READ"]} />}>
            <Route path="release-plans" element={<ReleasePlanningQueuePage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["MOVIE_READ"]} />}>
            <Route path="movies" element={<ManageMoviePage />}>
              <Route path="new" element={<MovieCreationStartPage />} />
            </Route>
            <Route path="movies/new/catalog" element={<TmdbCatalogPage />} />
            <Route path="movies/new/manual" element={<MovieEditorPage />} />
            <Route path="movies/:movieId/edit" element={<MovieEditorPage />} />
            <Route path="movies/:movieId/availability" element={<MovieAvailabilityPage />} />
            <Route path="persons" element={<ManagePersonsPage />} />
            <Route path="screening-versions" element={<ManageScreeningVersionsPage />} />
            <Route path="formats" element={<ManageFormatsPage />} />
            <Route path="genres" element={<ManageGenresPage />} />
            <Route path="age-ratings" element={<ManageAgeRatingsPage />} />
            <Route path="companies" element={<ManageCompaniesPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["SCHEDULE_PLAN_SUBMIT", "SCHEDULE_PLAN_APPROVE"]} />}>
            <Route path="showtimes/auto" element={<AutoScheduleWorkspacePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["REPORT_READ"]} />}>
            <Route index element={<AdminDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["ROOM_READ", "ROOM_UPDATE"]} />}>
            <Route path="clusters" element={<ManageCinemaClusterPage />} />
            <Route path="rooms" element={<AllRoomsPage />} />
            <Route path="clusters/:id" element={<ClusterDetailPage />} />
            <Route path="clusters/:clusterId/rooms/new" element={<CinemaRoomEditorPage />} />
            <Route path="clusters/:clusterId/rooms/:roomId/edit" element={<CinemaRoomEditorPage />} />
            <Route path="rooms/:id" element={<RoomDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["SHOWTIME_READ"]} />}>
            <Route path="showtimes" element={<ManageShowtimePage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["BOOKING_READ"]} />}>
            <Route path="bookings" element={<ManageBookingPage />} />
            <Route path="concessions/fulfillment" element={<ConcessionFulfillmentPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["TICKET_SELL"]} />}>
            <Route path="sell" element={<TicketSalePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["CONCESSION_CATALOG_DRAFT", "CONCESSION_CATALOG_APPROVE"]} />}>
            <Route path="concessions/catalog" element={<ConcessionCatalogPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["PRICE_BOOK_READ"]} />}>
            <Route path="price-books"        element={<ManagePriceBooksPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["PROMOTION_READ"]} />}>
            <Route path="promotions"          element={<ManagePromotionPage />} />
            <Route path="promotions/:id"      element={<PromotionDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["PROMOTION_CREATE"]} />}>
            <Route path="promotions/create"   element={<CreatePromotionPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["PROMOTION_UPDATE"]} />}>
            <Route path="promotions/edit/:id" element={<EditPromotionPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["EMPLOYEE_READ", "USER_READ"]} />}>
            <Route path="people"             element={<PeopleAccessPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["EMPLOYEE_READ"]} />}>
            <Route path="employees"          element={<Navigate to="/admin/people?tab=staff" replace />} />
            <Route path="employees/create"   element={<Navigate to="/admin/people?tab=staff&invite=1" replace />} />
            <Route path="employees/:id"      element={<EmployeeDetailPage />} />
            <Route path="employees/edit/:id" element={<EditEmployeePage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["USER_READ"]} />}>
            <Route path="users"              element={<Navigate to="/admin/people?tab=customers" replace />} />
            <Route path="users/create"       element={<Navigate to="/admin/people?tab=customers" replace />} />
            <Route path="users/edit/:id"     element={<EditUserPage />} />
            <Route path="users/:id"          element={<UserDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["SYSTEM_CONFIG_MANAGE"]} />}>
            <Route path="settings"  element={<SettingsPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["ROLE_MANAGE"]} />}>
            <Route path="access-matrix" element={<RolePermissionMatrixPage />} />
            <Route path="access-matrix/compare" element={<RolePermissionComparisonPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["REFUND_READ", "RECONCILIATION_READ"]} />}>
            <Route path="refunds-reconciliation" element={<RefundReconciliationPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["WORKFORCE_PLAN", "TIMESHEET_REVIEW"]} />}>
            <Route path="workforce" element={<WorkforceOperationsPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["WORKFORCE_SELF_READ"]} />}>
            <Route path="my-workforce" element={<MyWorkforcePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedPermissions={["REPORT_READ"]} />}>
            <Route path="reports"   element={<ReportPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedPermissions={["AUDIT_READ"]} />}>
            <Route path="audit" element={<AuditTrailPage />} />
          </Route>
        </Route>
      </Route>

      {/* Employee operations are intentionally separated from administration. */}
      <Route element={<ProtectedRoute allowedRoles={["ROLE_EMPLOYEE"]} />}>
        <Route path="/employee" element={<AdminLayout />}>
          <Route index element={<EmployeeDashboardPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="sell" element={<TicketSalePage />} />
          <Route path="bookings" element={<ManageBookingPage />} />
          <Route path="concessions/fulfillment" element={<ConcessionFulfillmentPage />} />
          <Route path="workforce" element={<MyWorkforcePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
