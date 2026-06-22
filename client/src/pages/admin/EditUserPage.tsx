import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { userApi } from "../../api/userApi";
import { UserForm, type UserFormData } from "../../layouts/UserForm"; // Đảm bảo đúng đường dẫn

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>(); // Lấy ID trên thanh URL
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true); // Trạng thái đang tải dữ liệu ban đầu
  const [error, setError] = useState<string | null>(null);
  
  // Khởi tạo state mặc định
  const [initialData, setInitialData] = useState<UserFormData>({
    role: "USER", fullName: "", username: "", email: "", password: "", phoneNumber: "", gender: "MALE", dateOfBirth: "", identityCard: "", address: "",
  });

  // 🟢 Lấy thông tin User để hiển thị lên Form
  useEffect(() => {
    const fetchUserData = async () => {
      if (!id) return;
      
      try {
        setFetching(true);
        
        const [userResponse, authResponse] = await Promise.all([
          userApi.getAllUsers(1, 1000).catch(() => ({ result: { data: [] } })),
          authApi.getAllAccounts().catch(() => ({ result: [] })),
        ]);

        const profiles = userResponse?.result?.data || [];
        const accounts = authResponse?.result || [];

        const profile = profiles.find((p: any) => p.accountId === id) || {};
        const account = accounts.find((a: any) => a.accountId === id);

        if (!account) {
          setError("User not found in system!");
          return;
        }

        // 🟢 FIX LỖI Ở ĐÂY: Dùng Optional Chaining (?.) và ép kiểu chuỗi (String) an toàn tuyệt đối
        let rawRole = account?.roles?.[0]?.name || "USER";
        let cleanRole = String(rawRole).toUpperCase();

        setInitialData({
          role: cleanRole,
          fullName: profile.fullName || "",
          username: account.username || "",
          email: account.email || "",
          password: "", // Để trống khi Edit
          phoneNumber: profile.phoneNumber || "",
          gender: profile.gender || "MALE",
          dateOfBirth: profile.dateOfBirth || "",
          identityCard: profile.identityCard || "",
          address: profile.address || "",
        });

      } catch (err) {
        console.error("Lỗi tải dữ liệu user:", err);
        setError("Failed to load user data");
      } finally {
        setFetching(false);
      }
    };

    fetchUserData();
  }, [id]);

  const handleSubmit = async (data: UserFormData) => {
    setLoading(true);
    setError(null);
    try {
      const payload = { ...data };
      if (!payload.password || payload.password.trim() === "") {
        delete payload.password; 
      }

      await authApi.updateAccount(id, payload); 
      
      alert("Update user successfully!");
      navigate("/admin/users");
    } catch (err: any) {
      console.error("Lỗi khi update user:", err);
      setError(err.response?.data?.message || err.message || "Lỗi cập nhật.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center py-20 h-full w-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full pb-10" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold mb-1.5 transition-colors" style={{ color: "var(--text-main)" }}>
            Edit User
          </h1>
          <div className="flex items-center gap-2 text-xs transition-colors" style={{ color: "var(--text-sub)" }}>
            <span>Dashboard</span><span>›</span><span>User Management</span><span>›</span>
            <span className="font-semibold transition-colors" style={{ color: "var(--text-main)" }}>Edit User</span>
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
      
      {/* 🟢 FIX LỖI DẤU ĐÓNG THẺ Ở ĐÂY */}
      <UserForm
        initialData={initialData}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/admin/users")}
        isLoading={loading}
        error={error}
        isDarkMode={isDarkMode}
        isEditMode={true} 
      />

      <style>{`.theme-dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
    </div>
  );
}