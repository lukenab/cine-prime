import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { UserForm, type UserFormData } from "../../layouts/UserForm"; // Import component vừa tạo
import { Toast as SharedToast } from "../../components/shared/Toast";

// Issue #161/#162: local toast, matches the pattern already used in SettingsPage.tsx
function Toast({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  return <SharedToast type={type} message={message} onClose={onClose} />;
}

export default function CreateUserPage() {
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Issue #161/#162: no more username/password on create — the backend
  // auto-generates the username and emails an activation link instead.
  const initialData: UserFormData = {
    role: "MEMBER",
    fullName: "",
    email: "",
    phoneNumber: "",
    gender: "Male",
    dateOfBirth: "",
    identityCard: "",
    address: "",
  };

  const handleSubmit = async (data: UserFormData) => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await authApi.createAccount({
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        phoneNumber: data.phoneNumber,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        identityCard: data.identityCard,
        address: data.address,
      });

      const generatedUsername = res?.data?.result?.username ?? res?.result?.username;
      setToast({
        type: "success",
        message: `Account "${generatedUsername ?? data.email}" created. Activation email sent to ${data.email}.`,
      });

      setTimeout(() => navigate("/admin/users"), 1800);
    } catch (err: any) {
      console.error("Failed to create user:", err);
      setError(err.response?.data?.message || err.message || "Đã xảy ra lỗi khi tạo tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full pb-10" style={{ fontFamily: "Inter, sans-serif" }}>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Header & Breadcrumb */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold mb-1.5 transition-colors" style={{ color: "var(--text-main)" }}>
            Add New User
          </h1>
          <div className="flex items-center gap-2 text-xs transition-colors" style={{ color: "var(--text-sub)" }}>
            <span>Dashboard</span><span>›</span><span>User Management</span><span>›</span>
            <span className="font-semibold transition-colors" style={{ color: "var(--text-main)" }}>Add New User</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/admin/users")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium hover:opacity-80 shadow-sm transition-all"
          style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <ArrowLeft size={16} /> Back to Users
        </button>
      </div>

      <UserForm
        initialData={initialData}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/admin/users")}
        isLoading={loading}
        error={error}
        isDarkMode={isDarkMode}
        isEditMode={false} // Chế độ Thêm mới
      />

      <style>{`.theme-dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
    </div>
  );
}
