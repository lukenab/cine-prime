import { useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight, MoreHorizontal, Mail, Shield } from "lucide-react";
import type { UserData } from "./UserModal";

type Props = {
  users: UserData[];
  onEdit: (user: UserData) => void;
  onDelete: (id: number) => void;
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
};

function Avatar({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
      style={{ background: avatar, fontWeight: 600 }}
    >
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)}
    </div>
  );
}

export function UserTable({ users, onEdit, onDelete, searchQuery, roleFilter, statusFilter }: Props) {
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageUsers = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleDelete = (id: number) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left">
                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em" }}>
                  User
                </span>
              </th>
              <th className="px-5 py-3.5 text-left">
                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em" }}>
                  Role
                </span>
              </th>
              <th className="px-5 py-3.5 text-left">
                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em" }}>
                  Department
                </span>
              </th>
              <th className="px-5 py-3.5 text-left">
                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em" }}>
                  Status
                </span>
              </th>
              <th className="px-5 py-3.5 text-left">
                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em" }}>
                  Joined
                </span>
              </th>
              <th className="px-5 py-3.5 text-right">
                <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em" }}>
                  Actions
                </span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {pageUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-gray-400" style={{ fontSize: "14px" }}>
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              pageUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  {/* User cell */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} avatar={user.avatar} />
                      <div>
                        <p className="text-gray-900" style={{ fontSize: "14px", fontWeight: 500 }}>
                          {user.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Mail size={11} className="text-gray-400" />
                          <p className="text-gray-400" style={{ fontSize: "12px" }}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Shield size={12} className="text-gray-400" />
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-xs font-medium ${roleColors[user.role] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                      >
                        {user.role}
                      </span>
                    </div>
                  </td>

                  {/* Department */}
                  <td className="px-5 py-3.5">
                    <span className="text-gray-600" style={{ fontSize: "13px" }}>
                      {user.department}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.status === "Active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.status === "Active" ? "bg-emerald-500" : "bg-gray-400"
                        }`}
                      />
                      {user.status}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-3.5">
                    <span className="text-gray-500" style={{ fontSize: "13px" }}>
                      {user.joined}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 relative">
                      <button
                        onClick={() => onEdit(user)}
                        title="Edit user"
                        className="w-8 h-8 rounded-lg hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        title={deleteConfirm === user.id ? "Click again to confirm" : "Delete user"}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          deleteConfirm === user.id
                            ? "bg-rose-100 text-rose-600"
                            : "hover:bg-rose-50 text-gray-400 hover:text-rose-500"
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                        className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {openMenu === user.id && (
                        <div
                          className="absolute right-0 top-9 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-10 py-1"
                          onMouseLeave={() => setOpenMenu(null)}
                        >
                          <button className="w-full text-left px-4 py-2.5 text-gray-600 hover:bg-gray-50 transition-colors" style={{ fontSize: "13px" }}>
                            View Profile
                          </button>
                          <button className="w-full text-left px-4 py-2.5 text-gray-600 hover:bg-gray-50 transition-colors" style={{ fontSize: "13px" }}>
                            Send Email
                          </button>
                          <button className="w-full text-left px-4 py-2.5 text-gray-600 hover:bg-gray-50 transition-colors" style={{ fontSize: "13px" }}>
                            Reset Password
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button className="w-full text-left px-4 py-2.5 text-rose-500 hover:bg-rose-50 transition-colors" style={{ fontSize: "13px" }}>
                            Suspend Account
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-gray-400" style={{ fontSize: "13px" }}>
          Showing{" "}
          <span className="text-gray-700 font-medium">
            {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
          </span>{" "}
          of <span className="text-gray-700 font-medium">{filtered.length}</span> users
        </p>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - safePage) <= 2)
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  p === safePage
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
                style={{ fontSize: "13px", fontWeight: p === safePage ? 600 : 400 }}
              >
                {p}
              </button>
            ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
