import { X, User } from "lucide-react";
import { useState, useEffect } from "react";

export type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  department: string;
  phoneNumber: string;
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
  const [form, setForm] = useState({ name: "", email: "", role: "Viewer", status: "Active" as "Active" | "Inactive", department: "Engineering" });

  useEffect(() => {
    if (editUser) {
      setForm({ name: editUser.name, email: editUser.email, role: editUser.role, status: editUser.status, department: editUser.department });
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" style={{ background: "var(--bg-main)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <User size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editUser ? "Edit User" : "Add New User"}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Full Name</label>
            <input
              type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Jane Doe"
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Email Address</label>
            <input
              type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. jane@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Role</label>
              <select
                value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Status</label>
              <select
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "Active" | "Inactive" })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Department</label>
            <select
              value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
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