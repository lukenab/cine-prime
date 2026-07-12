import { useState } from "react";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { UserForm, type UserFormData } from "../../layouts/UserForm"; // Import component vừa tạo

// Issue #161/#162: local toast, matches the pattern already used in SettingsPage.tsx
function Toast({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
      style={{ background: type === "success" ? "#059669" : "#ef4444", color: "#fff", minWidth: "280px" }}>
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{message}</span>
      <button onClick={onClose} className="ml-auto opacity-75 hover:opacity-100" style={{ fontSize: "18px", lineHeight: 1 }}>×</button>
    </div>
  );
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
    gender: "MALE",
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
