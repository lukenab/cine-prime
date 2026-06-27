import { useState, useEffect } from "react";
import { Search, Plus, SlidersHorizontal, Download } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";

import { StatsCards } from "../../layouts/StatsCards";
import { UserTable } from "../../layouts/UserTable";

import { userApi } from "../../api/userApi";
import { authApi } from "../../api/authApi";

// 🟢 Đưa Interface UserData vào đây vì chúng ta không còn dùng UserModal nữa
export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phoneNumber: string;
  avatar: string;
  joined: string;
}

const avatarGradients = [
  "linear-gradient(135deg, #3b82f6, #6366f1)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #f97316, #f59e0b)",
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #14b8a6, #10b981)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #84cc16, #22c55e)",
  "linear-gradient(135deg, #ef4444, #f97316)",
  "linear-gradient(135deg, #a855f7, #6366f1)",
];

const roles = ["Admin", "Editor", "Viewer", "Manager", "Developer"];

export default function ManageUserPage() {
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);

      const [userResponse, authResponse] = await Promise.all([
        userApi.getAllUsers(1, 100).catch(() => ({ result: { data: [] } })),
        authApi.getAllAccounts().catch(() => ({ result: [] })),
      ]);

      const profiles = userResponse?.result?.data || [];
      const accounts = authResponse?.result || [];

      const mappedUsers: UserData[] = accounts
        .filter((acc: any) => {
          const roleName: string = acc.roles?.[0]?.roleName ?? "";
          // Exclude employees — managed separately in ManageEmployeePage
          return roleName !== "EMPLOYEE" && roleName !== "ROLE_EMPLOYEE";
        })
        .map((acc: any) => {
          const profile = profiles.find((p: any) => p.accountId === acc.accountId) || {};

          let rawRole = "USER";
          if (acc.roles && acc.roles.length > 0) {
            rawRole = acc.roles[0].roleName || "USER";
          }

          const userRole = String(rawRole).charAt(0).toUpperCase() + String(rawRole).slice(1).toLowerCase();

          return {
            id: acc.accountId,
            name: profile.fullName || acc.username || "Unknown",
            email: acc.email || "No Email",
            role: userRole,
            status: profile.isActive === false ? "Inactive" : "Active",
            phoneNumber: profile.phoneNumber || "No Phone",
            avatar: profile.avatarUrl || avatarGradients[acc.accountId.charCodeAt(0) % avatarGradients.length],
            joined: new Date(acc.createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          };
        });

      setUsers(mappedUsers);
    } catch (error) {
      console.error("Lỗi khi tải và ghép danh sách User:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = () => {
    navigate("/admin/users/create");
  };

  // 🟢 CẬP NHẬT: Điều hướng thẳng sang trang Edit, truyền theo ID của User
  const handleViewUser = (id: string) => {
    navigate(`/admin/users/${id}`);
  };

  const handleEditUser = (user: UserData) => {
    navigate(`/admin/users/edit/${user.id}`);
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await userApi.deleteUser(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "Inactive" } : u)));
    } catch (error: any) {
      const code = error?.response?.data?.code;
      if (error?.response?.status === 404 || code === 2003) {
        alert("Không tìm thấy hồ sơ người dùng này trong hệ thống.\nTài khoản có thể chưa hoàn tất đăng ký (profile chưa được tạo).");
      } else if (error?.response?.status === 400 || code === 2008) {
        alert("Người dùng này đã bị vô hiệu hóa trước đó.");
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "Inactive" } : u)));
      } else {
        alert("Có lỗi xảy ra khi vô hiệu hóa người dùng. Vui lòng thử lại.");
      }
      console.error("Lỗi khi xóa User:", error);
    }
  };

  return (
    <>
      <div style={{ marginBottom: "28px" }}>
        <h1
          style={{
            color: "var(--text-main)",
            fontWeight: 600,
            fontSize: "22px",
            letterSpacing: "-0.01em",
            marginBottom: "5px",
            transition: "color 0.2s ease",
          }}
        >
          Customer Management
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px", transition: "color 0.2s ease" }}>Manage customer accounts and membership status</p>
      </div>

      {/* KPI Cards */}
      <StatsCards />

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text"
            placeholder="Search users by name, email, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500"
              style={{ fontSize: "16px", lineHeight: 1, color: "var(--text-sub)" }}
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <SlidersHorizontal size={15} />
          Filters
          {(roleFilter || statusFilter) && <span className="w-2 h-2 bg-blue-600 rounded-full ml-0.5" />}
        </button>

        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <Download size={15} />
          Export
        </button>

        <button
          onClick={handleAddUser}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
        >
          <Plus size={16} />
          Add New Customer
        </button>
      </div>

      {/* Bảng Filters mở rộng */}
      {showFilters && (
        <div
          className="flex items-center gap-3 flex-wrap p-4 rounded-xl border transition-all mb-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Filter by:</p>
          <div className="flex items-center gap-1 flex-wrap filter-btns">
            <button onClick={() => setRoleFilter("")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!roleFilter ? "active" : ""}`}>
              All Roles
            </button>
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(roleFilter === r ? "" : r)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${roleFilter === r ? "active" : ""}`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="w-px h-5 mx-1" style={{ background: "var(--border-color)" }} />

          <div className="flex items-center gap-1 filter-btns">
            <button
              onClick={() => setStatusFilter("")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!statusFilter ? "active" : ""}`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === "Active" ? "" : "Active")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Active" ? "active-green" : ""}`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === "Inactive" ? "" : "Inactive")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Inactive" ? "active-gray" : ""}`}
            >
              Inactive
            </button>
          </div>
        </div>
      )}

      {/* 🟢 Hiển thị Loading Spinner hoặc Bảng Dữ liệu */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <UserTable
          users={users}
          onView={handleViewUser}
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
          searchQuery={searchQuery}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
        />
      )}

      <style>{`
        .theme-dark .hover\\:bg-gray-50\\/50:hover { background-color: rgba(255, 255, 255, 0.03) !important; }

        .filter-btns button {
           background: transparent;
           color: var(--text-muted);
           border-color: var(--border-color);
        }
        .filter-btns button:hover {
           background: rgba(128, 128, 128, 0.1);
           color: var(--text-main);
        }
        .filter-btns button.active {
           background: #2563eb !important;
           color: white !important;
           border-color: #2563eb !important;
        }
        .filter-btns button.active-green {
           background: #059669 !important;
           color: white !important;
           border-color: #059669 !important;
        }
        .filter-btns button.active-gray {
           background: #4b5563 !important;
           color: white !important;
           border-color: #4b5563 !important;
        }

        .theme-dark table thead tr { 
            background-color: rgba(255, 255, 255, 0.04) !important; 
        }
        
        .theme-dark table thead th span {
            color: rgba(255, 255, 255, 0.85) !important;
        }
      `}</style>
    </>
  );
}