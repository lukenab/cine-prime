import { useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight, Mail, Shield } from "lucide-react";
import type { UserData } from "./UserModal";

type Props = {
  users: UserData[];
  onEdit: (user: UserData) => void;
  // 🟢 Đổi kiểu dữ liệu của ID sang string để khớp với Backend
  onDelete: (id: string) => void; 
  searchQuery: string;
  roleFilter: string;
  statusFilter: string;
};

const ITEMS_PER_PAGE = 8;

const roleColors: Record<string, string> = {
  Admin: "bg-purple-50 text-purple-700 border-purple-100",
  Editor: "bg-blue-50 text-blue-700 border-blue-100",
  Viewer: "bg-gray-100 text-gray-600 border-gray-200",
  Manager: "bg-amber-50 text-amber-700 border-amber-100",
  Developer: "bg-emerald-50 text-emerald-700 border-emerald-100",
  // 🟢 Thêm màu cho Role USER mặc định của hệ thống cậu
  USER: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ADMIN: "bg-purple-50 text-purple-700 border-purple-100",
};

function Avatar({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
      style={{ background: avatar, fontWeight: 600 }}
    >
      {name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
    </div>
  );
}

export function UserTable({ users, onEdit, onDelete, searchQuery, roleFilter, statusFilter }: Props) {
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    // Bỏ tìm kiếm theo department, thay bằng phoneNumber
    const matchSearch = !q || 
                        u.name.toLowerCase().includes(q) || 
                        u.email.toLowerCase().includes(q) || 
                        u.role.toLowerCase().includes(q) || 
                        (u.phoneNumber && u.phoneNumber.includes(q));
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageUsers = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {/* 🟢 Thay thế Department bằng Phone Number */}
              {["User", "Role", "Phone Number", "Status", "Joined"].map((head) => (
                <th key={head} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{head}</span>
                </th>
              ))}
              <th className="px-5 py-3.5 text-right">
                <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Actions</span>
              </th>
            </tr>
          </thead>

          <tbody style={{ borderColor: "var(--border-color)" }}>
            {pageUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              pageUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors" style={{ transition: "background-color 0.2s" }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} avatar={user.avatar} />
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>{user.name}</p>
                        <div className="flex items-center gap-1 mt-0.5" style={{ color: "var(--text-sub)" }}>
                          <Mail size={11} />
                          <p style={{ fontSize: "12px" }}>{user.email}</p>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Shield size={12} style={{ color: "var(--text-sub)" }} />
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-xs font-medium ${roleColors[user.role] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {user.role}
                      </span>
                    </div>
                  </td>

                  {/* 🟢 Hiển thị Số điện thoại thay cho Department */}
                  <td className="px-5 py-3.5">
                    <span style={{ fontSize: "13px", color: "var(--text-main)" }}>{user.phoneNumber}</span>
                  </td>

                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.status === "Active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                      {user.status}
                    </span>
                  </td>

                  <td className="px-5 py-3.5">
                    <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{user.joined}</span>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 relative">
                      <button onClick={() => onEdit(user)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(user.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${deleteConfirm === user.id ? "bg-rose-100 text-rose-600" : ""}`} style={{ color: deleteConfirm === user.id ? "" : "var(--text-sub)" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
          Showing <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</span> of <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> users
        </p>

        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: "var(--text-sub)" }}>
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => Math.abs(p - safePage) <= 2).map((p) => (
            <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ fontSize: "13px", fontWeight: p === safePage ? 600 : 400, background: p === safePage ? "#2563eb" : "transparent", color: p === safePage ? "#fff" : "var(--text-sub)" }}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: "var(--text-sub)" }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}