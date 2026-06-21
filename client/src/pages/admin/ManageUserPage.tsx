import { useState } from "react";
import { Search, Plus, SlidersHorizontal, Download } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";

import { StatsCards } from "../../layouts/StatsCards";
import { UserTable } from "../../layouts/UserTable";
import { UserModal, type UserData } from "../../layouts/UserModal";

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

const initialUsers: UserData[] = [
  {
    id: 1,
    name: "Sophia Anderson",
    email: "sophia.a@company.com",
    role: "Admin",
    status: "Active",
    department: "Engineering",
    avatar: avatarGradients[0],
    joined: "Jan 15, 2024",
  },
  {
    id: 2,
    name: "Marcus Chen",
    email: "marcus.c@company.com",
    role: "Developer",
    status: "Active",
    department: "Engineering",
    avatar: avatarGradients[1],
    joined: "Feb 3, 2024",
  },
  {
    id: 3,
    name: "Isabelle Moreau",
    email: "isabelle.m@company.com",
    role: "Manager",
    status: "Active",
    department: "Marketing",
    avatar: avatarGradients[2],
    joined: "Mar 22, 2023",
  },
  // ... Cậu có thể paste lại mảng dữ liệu mẫu đầy đủ của cậu vào đây
];

const roles = ["Admin", "Editor", "Viewer", "Manager", "Developer"];

export default function ManageUserPage() {
  const navigate = useNavigate();

  // 🌟 ĐIỂM QUAN TRỌNG: Nhận isDarkMode từ AdminLayout truyền xuống
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  let nextId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;

  const handleAddUser = () => {
    navigate("/admin/users/create");
  };

  const handleEditUser = (user: UserData) => {
    setEditUser(user);
    setModalOpen(true);
  };

  const handleDeleteUser = (id: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSaveUser = async (data: Omit<UserData, "id" | "joined" | "avatar">) => {
    if (editUser) {
      // Logic xử lý Update User (Sẽ làm sau)
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...data } : u)));
    } else {
      // LOGIC TẠO USER MỚI DÀNH CHO ADMIN
      try {
        const payload = {
          email: data.email,
          username: data.email.split("@")[0], // Tự gen username từ email nếu modal không có ô nhập
          password: "DefaultPassword123!", // Đặt pass mặc định hoặc lấy từ modal
          fullName: data.name,
          role: data.role,
          // Bổ sung các trường khác (phone, dob, cccd...) nếu UserModal của cậu có
        };

        // 2. Gọi API lên Backend (Thay bằng hàm fetch/axios thực tế của dự án cậu)
        // const response = await fetch('/api/admin/accounts', { method: 'POST', body: JSON.stringify(payload) });
        // const result = await response.json();

        // --- ĐOẠN NÀY LÀ MÔ PHỎNG NẾU GỌI API THÀNH CÔNG ---
        const newUser: UserData = {
          ...data,
          id: nextId++, // Thực tế sẽ lấy result.id từ backend trả về
          avatar: avatarGradients[Math.floor(Math.random() * avatarGradients.length)],
          joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        };

        // 3. Cập nhật lại UI bảng
        setUsers((prev) => [newUser, ...prev]);

        // 4. Đóng Modal và báo thành công
        setModalOpen(false);
        // toast.success("User created successfully!");
      } catch (error) {
        console.error("Failed to create user:", error);
        // toast.error("Failed to create user. Email might already exist.");
      }
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
          User Management
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px", transition: "color 0.2s ease" }}>Manage accounts, roles, and permissions</p>
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
          Add New User
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

      {/* User Table Component */}
      <UserTable users={users} onEdit={handleEditUser} onDelete={handleDeleteUser} searchQuery={searchQuery} roleFilter={roleFilter} statusFilter={statusFilter} />

      {/* Edit/Add Modal */}
      <UserModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveUser} editUser={editUser} />

      {/* CSS đặc thù cho riêng trang này (Các biến màu --bg-main đã được chuyển ra AdminLayout) */}
      <style>{`
        /* Hover effect cho bảng trong Dark Mode */
        .theme-dark .hover\\:bg-gray-50\\/50:hover { background-color: rgba(255, 255, 255, 0.03) !important; }

        /* Style cho nút Filters */
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
