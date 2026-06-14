import { X, User } from "lucide-react";
import { useState, useEffect } from "react";

export type UserData = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  department: string;
  avatar: string;
  joined: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (user: Omit<UserData, "id" | "joined" | "avatar">) => void;
  editUser?: UserData | null;
};

const roles = ["Admin", "Editor", "Viewer", "Manager", "Developer"];
const departments = ["Engineering", "Marketing", "Design", "Sales", "Support", "HR"];

export function UserModal({ open, onClose, onSave, editUser }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Viewer",
    status: "Active" as "Active" | "Inactive",
    department: "Engineering",
  });

  useEffect(() => {
    if (editUser) {
      setForm({
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        status: editUser.status,
        department: editUser.department,
      });
    } else {
      setForm({ name: "", email: "", role: "Viewer", status: "Active", department: "Engineering" });
    }
  }, [editUser, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <User size={16} className="text-blue-600" />
            </div>
            <h2 className="text-gray-900" style={{ fontSize: "16px" }}>
              {editUser ? "Edit User" : "Add New User"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-gray-600 mb-1.5" style={{ fontSize: "13px" }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Jane Doe"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:bg-white transition-colors"
              style={{ fontSize: "14px" }}
            />
          </div>

          <div>
            <label className="block text-gray-600 mb-1.5" style={{ fontSize: "13px" }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. jane@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:bg-white transition-colors"
              style={{ fontSize: "14px" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 mb-1.5" style={{ fontSize: "13px" }}>
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:border-blue-400 focus:bg-white transition-colors appearance-none cursor-pointer"
                style={{ fontSize: "14px" }}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-600 mb-1.5" style={{ fontSize: "13px" }}>
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "Active" | "Inactive" })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:border-blue-400 focus:bg-white transition-colors appearance-none cursor-pointer"
                style={{ fontSize: "14px" }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-600 mb-1.5" style={{ fontSize: "13px" }}>
              Department
            </label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:border-blue-400 focus:bg-white transition-colors appearance-none cursor-pointer"
              style={{ fontSize: "14px" }}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontSize: "14px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {editUser ? "Save Changes" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
