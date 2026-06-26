// File: src/components/UserForm.tsx (Hoặc đường dẫn tương ứng của cậu)
import { useState, useEffect } from "react";
import { Camera, User, Save } from "lucide-react";

export interface UserFormData {
  role: string;
  fullName: string;
  username: string;
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
      <h2 className="text-base font-bold mb-5 transition-colors" style={{ color: "var(--text-main)" }}>
        Customer Information
      </h2>

      {/* Avatar Placeholder */}
      <div className="mb-6">
        <div className="relative w-20 h-20 rounded-full bg-slate-500 flex items-center justify-center shadow-inner">
          <User size={36} color="#cbd5e1" className="mt-1" />
          <button
            type="button"
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors hover:opacity-90"
            style={{
              background: isDarkMode ? "#3b82f6" : "#2563eb",
              borderColor: "var(--bg-card)",
            }}
          >
            <Camera size={12} color="white" />
          </button>
        </div>
      </div>

      {error && <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">{error}</div>}

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
              <option value="USER"   style={{ background: "var(--bg-card)" }}>User</option>
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

        {/* Row 2: Username & Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Username <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              name="username"
              minLength={5}
              maxLength={50}
              disabled={isEditMode} // Không cho phép đổi Username khi Update
              placeholder="johndoe123"
              value={formData.username}
              onChange={handleChange}
              className={`px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
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

        {/* Row 3: Password & Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold transition-colors" style={{ color: "var(--text-main)" }}>
              Password {!isEditMode && <span className="text-red-500">*</span>}
            </label>
            <input
              required={!isEditMode} // Khi update thì password có thể để trống
              type="password"
              name="password"
              minLength={6}
              autoComplete={isEditMode ? "new-password" : "current-password"}
              placeholder={isEditMode ? "Leave blank to keep current password" : "Min 6 characters"}
              value={formData.password}
              onChange={handleChange}
              className="px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>
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
              <option value="MALE" style={{ background: "var(--bg-card)" }}>Male</option>
              <option value="FEMALE" style={{ background: "var(--bg-card)" }}>Female</option>
              <option value="OTHER" style={{ background: "var(--bg-card)" }}>Other</option>
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
            {isLoading ? "Saving..." : (
              <>
                <Save size={16} />
                {isEditMode ? "Update Customer" : "Add New Customer"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}