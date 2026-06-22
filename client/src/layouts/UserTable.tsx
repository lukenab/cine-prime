import { useState } from "react";
import { Pencil, Trash2, Eye, ChevronLeft, ChevronRight, Mail, Shield } from "lucide-react";
import type { UserData } from "./UserModal";

type Props = {
  users: UserData[];
  onView: (id: string) => void;
  onEdit: (user: UserData) => void;
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

export function UserTable({ users, onView, onEdit, onDelete, searchQuery, roleFilter, statusFilter }: Props) {
  const [page, setPage] = useState(1);
  const [confirmUser, setConfirmUser] = useState<UserData | null>(null);

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
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

  const handleConfirmDelete = () => {
    if (!confirmUser) return;
    onDelete(confirmUser.id);
    setConfirmUser(null);
  };

  return (
    <>
      {/* Confirmation Modal */}
      {confirmUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setConfirmUser(null)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 mx-auto mb-4">
              <Trash2 size={22} className="text-rose-500" />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "8px" }}>
              Deactivate Account
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-sub)", textAlign: "center", marginBottom: "20px" }}>
              Are you sure you want to deactivate{" "}
              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{confirmUser.name}</span>?
              <br />
              This account will no longer be able to log in.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmUser(null)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ background: "#ef4444" }}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
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

                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-main)" }}>{user.phoneNumber}</span>
                    </td>

                    {/* Status — display only switch */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full ${
                            user.status === "Active" ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                              user.status === "Active" ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </div>
                        <span style={{ fontSize: "12px", color: user.status === "Active" ? "var(--text-main)" : "var(--text-sub)" }}>
                          {user.status}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{user.joined}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView(user.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-50"
                          style={{ color: "var(--text-sub)" }}
                          title="View detail"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => onEdit(user)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
                          style={{ color: "var(--text-sub)" }}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => user.status === "Active" && setConfirmUser(user)}
                          disabled={user.status === "Inactive"}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ color: user.status === "Active" ? "var(--text-sub)" : "var(--text-sub)" }}
                          title={user.status === "Active" ? "Vô hiệu hóa" : "Tài khoản đã bị vô hiệu hóa"}
                        >
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
            Showing{" "}
            <span style={{ color: "var(--text-main)", fontWeight: 500 }}>
              {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
            </span>{" "}
            of <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> users
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: "var(--text-sub)" }}
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - safePage) <= 2)
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ fontSize: "13px", fontWeight: p === safePage ? 600 : 400, background: p === safePage ? "#2563eb" : "transparent", color: p === safePage ? "#fff" : "var(--text-sub)" }}
                >
                  {p}
                </button>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: "var(--text-sub)" }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
