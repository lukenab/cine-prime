// File: src/components/UserForm.tsx (Hoặc đường dẫn tương ứng của cậu)
import { useState, useEffect } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";

export interface UserFormData {
  role: string;
  fullName: string;
  // Issue #161/#162: username/password are only relevant in Edit mode now.
  // Create mode no longer collects them — the backend auto-generates username
  // and sends an activation-link email instead of an admin-set password.
  username?: string;
  email: string;
  password?: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  identityCard: string;
  address: string;
}

interface UserFormProps {
  initialData: UserFormData;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  isDarkMode: boolean;
  isEditMode?: boolean; // Xác định xem đây là form Sửa hay Thêm mới
}

export function UserForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  error,
  isDarkMode,
  isEditMode = false,
}: UserFormProps) {
  const [formData, setFormData] = useState<UserFormData>(initialData);

  // Cập nhật lại form nếu initialData từ API trả về chậm (Dành cho Edit)
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div
      className="p-6 rounded-2xl border shadow-sm transition-colors"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-color)",
      }}
    >
      <div className="flex items-start gap-4 mb-6 pb-5 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: isDarkMode ? "rgba(59,130,246,.14)" : "rgba(37,99,235,.1)", color: isDarkMode ? "#60a5fa" : "#2563eb" }}>
          <UserPlus size={21} />
        </div>
        <div>
          <h2 className="text-base font-bold transition-colors" style={{ color: "var(--text-main)" }}>
            Customer account
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-sub)" }}>
            Create a member profile and send a secure activation invitation.
          </p>
        </div>
      </div>

      {error && <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">{error}</div>}

      {!isEditMode && (
        <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm" style={{ color: "var(--text-sub)" }}>
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-500" />
          No password needed here — an activation email will be sent so the new user can set
          their own password.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Row 1: Role & Full Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Role <span className="text-red-500">*</span>
            </label>
            <select
              required
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              <option value="MEMBER" style={{ background: "var(--bg-card)" }}>Member</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              name="fullName"
              placeholder="e.g. John Doe"
              value={formData.fullName}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
        </div>

        {/* Row 2: Username (Edit only) & Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {isEditMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                disabled // Không cho phép đổi Username khi Update — do backend tự sinh khi Tạo mới
                placeholder="johndoe123"
                value={formData.username ?? ""}
                onChange={handleChange}
                className="px-3.5 py-2.5 text-sm rounded-xl border outline-none opacity-50 cursor-not-allowed transition-all"
                style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              />
            </div>
          )}
          <div className={`flex flex-col gap-1.5 ${isEditMode ? "" : "md:col-span-2"}`}>
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="email"
              name="email"
              disabled={isEditMode} // Tùy nghiệp vụ, thường email không cho đổi dễ dàng
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
              className={`px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
        </div>

        {/* Row 3: Phone */}
        <div className="grid grid-cols-1 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              name="phoneNumber"
              pattern="^0[35789][0-9]{8}$"
              title="Phone number must start with a valid prefix (e.g., 03, 09) and contain exactly 10 digits"
              placeholder="0912345678"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
        </div>

        {/* Row 4: Gender & Date of Birth */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Gender <span className="text-red-500">*</span>
            </label>
            <select
              required
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              <option value="Male" style={{ background: "var(--bg-card)" }}>Male</option>
              <option value="Female" style={{ background: "var(--bg-card)" }}>Female</option>
              <option value="Other" style={{ background: "var(--bg-card)" }}>Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
        </div>

        {/* Row 5: Identity Card & Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Identity Card (CCCD) <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              name="identityCard"
              pattern="^[0-9]{12}$"
              title="Identity card must contain exactly 12 digits"
              placeholder="12 digits CCCD"
              value={formData.identityCard}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Address <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              name="address"
              placeholder="Full Address"
              value={formData.address}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-3 pt-5 border-t transition-colors" style={{ borderColor: "var(--border-color)" }}>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-xl text-sm font-medium border hover:opacity-80 transition-all shadow-sm"
            style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-medium transition-all shadow-sm ${
              isLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
            }`}
            style={{ background: isDarkMode ? "#3b82f6" : "#2563eb" }}
          >
            {isLoading ? "Saving..." : isEditMode ? "Save Changes" : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
