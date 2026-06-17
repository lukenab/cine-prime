import { BrowserRouter, Routes, Route } from "react-router-dom";

// --- Import các Vỏ bọc (Layouts) ---
import CustomerLayout from "./layouts/CustomerLayout.tsx";
import AuthLayout from "./layouts/AuthLayout.tsx";
import AdminLayout from "./layouts/AdminLayout.tsx"; 

// --- Import các Trang (Pages) ---
import HomePage from "./pages/customer/HomePage.tsx"; // Nhớ import cả HomePage
import LoginPage from "./pages/auth/LoginPage.tsx";
import RegisterPage from "./pages/auth/RegisterPage.tsx";
import AdminDashboard from "./pages/admin/Dashboard.tsx"; // Sửa lại tên file import cho đúng
import ManageUserPage from "./pages/admin/ManageUser.tsx"; // Sửa lại tên file import cho đúng
import ManageMoviePage from "./pages/admin/ManageMoviePage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route element={<CustomerLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} /> 
          <Route path="users" element={<ManageUserPage />} /> 
          <Route path="movies" element={<ManageMoviePage />} /> 
        </Route>

      </Routes>
    </BrowserRouter>
  );
}