import { useState } from "react";
import { ArrowLeft, Save, User, Camera } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface EmployeeFormData {
  // Account fields (auth-service)
  username: string;
  email: string;
  password: string;
  // Employee profile fields (employee-service / user-service)
  fullName: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  identityCard: string;
  address: string;
  // Employee-specific fields
  employeeCode: string;
  department: string;
  position: string;
  hireDate: string;
}

const DEPARTMENTS = ["Box Office", "Operations", "Concessions", "IT", "Security", "Housekeeping"];

const POSITIONS: Record<string, string[]> = {
  "Box Office":    ["Ticket Agent", "Senior Ticket Agent", "Box Office Supervisor"],
  "Operations":    ["Shift Supervisor", "Operations Manager", "Floor Staff"],
  "Concessions":   ["F&B Staff", "F&B Supervisor", "Concessions Manager"],
  "IT":            ["System Admin", "IT Support", "IT Manager"],
  "Security":      ["Security Guard", "Security Supervisor"],
  "Housekeeping":  ["Housekeeping Staff", "Housekeeping Supervisor"],
};

// ── Field helpers ─────────────────────────────────────────────────────────────
function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

const inputCls = "px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all";
const inputStyle = { background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateEmployeePage() {
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [formData, setFormData] = useState<EmployeeFormData>({
    username: "",
    email: "",
    password: "",
    fullName: "",
    phoneNumber: "",
    gender: "MALE",
    dateOfBirth: "",
    identityCard: "",
    address: "",
    employeeCode: "",
    department: "",
    position: "",
    hireDate: new Date().toISOString().slice(0, 10),
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      // Reset position when department changes
      if (name === "department") return { ...prev, department: value, position: "" };
      return { ...prev, [name]: value };
    });
    if (errors[name as keyof EmployeeFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof EmployeeFormData, string>> = {};

    if (!formData.fullName.trim())                              newErrors.fullName     = "Full name is required";
    if (!formData.username.trim())                              newErrors.username     = "Username is required";
    if (formData.username.length < 5)                          newErrors.username     = "Username must be at least 5 characters";
    if (!formData.email.trim())                                 newErrors.email        = "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))   newErrors.email        = "Invalid email format";
    if (!formData.password)                                     newErrors.password     = "Password is required";
    if (formData.password.length < 8)                          newErrors.password     = "Password must be at least 8 characters";
    if (!/^0[35789][0-9]{8}$/.test(formData.phoneNumber))      newErrors.phoneNumber  = "Invalid Vietnamese phone number";
    if (!/^[0-9]{12}$/.test(formData.identityCard))            newErrors.identityCard = "Identity card must be exactly 12 digits";
    if (!formData.dateOfBirth)                                  newErrors.dateOfBirth  = "Date of birth is required";
    if (!formData.address.trim())                               newErrors.address      = "Address is required";
    if (!formData.employeeCode.trim())                          newErrors.employeeCode = "Employee code is required";
    if (!formData.department)                                   newErrors.department   = "Department is required";
    if (!formData.position)                                     newErrors.position     = "Position is required";
    if (!formData.hireDate)                                     newErrors.hireDate     = "Hire date is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);
    try {
      // TODO: Replace with actual API call to employee-service / auth-service
      // await employeeApi.createEmployee(formData);
      console.log("Create employee payload:", formData);
      await new Promise((r) => setTimeout(r, 800)); // simulate network
      navigate("/admin/employees");
    } catch (err: any) {
      setApiError(err.response?.data?.message || err.message || "Failed to create employee.");
    } finally {
      setLoading(false);
    }
  };

  const positions = formData.department ? (POSITIONS[formData.department] ?? []) : [];

  return (
    <div className="w-full pb-10" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1.5" style={{ color: "var(--text-main)" }}>
            Add New Employee
          </h1>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-sub)" }}>
            <span>Dashboard</span><span>›</span>
            <span>Employee Management</span><span>›</span>
            <span className="font-semibold" style={{ color: "var(--text-main)" }}>Add New Employee</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/admin/employees")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium hover:opacity-80 transition-all"
          style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <ArrowLeft size={16} /> Back to Employees
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Section 1: Account Info ─────────────────────────────────────── */}
        <div
          className="p-6 rounded-2xl border mb-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Account Information
          </h2>

          {/* Avatar */}
          <div className="mb-6">
            <div className="relative w-20 h-20 rounded-full bg-slate-500 flex items-center justify-center shadow-inner">
              <User size={36} color="#cbd5e1" className="mt-1" />
              <button
                type="button"
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 hover:opacity-90 transition-all"
                style={{ background: accentColor, borderColor: "var(--bg-card)" }}
              >
                <Camera size={12} color="white" />
              </button>
            </div>
          </div>

          {apiError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">
              {apiError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Full Name" required error={errors.fullName}>
              <input
                name="fullName" type="text" placeholder="e.g. Nguyen Van An"
                value={formData.fullName} onChange={handleChange}
                className={`${inputCls} ${errors.fullName ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Username" required error={errors.username}>
              <input
                name="username" type="text" placeholder="e.g. an.nguyen" minLength={5}
                value={formData.username} onChange={handleChange}
                className={`${inputCls} ${errors.username ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Email" required error={errors.email}>
              <input
                name="email" type="email" placeholder="an.nguyen@cineprime.vn"
                value={formData.email} onChange={handleChange}
                className={`${inputCls} ${errors.email ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Temporary Password" required error={errors.password}>
              <input
                name="password" type="password" placeholder="Min 8 characters"
                minLength={8} autoComplete="new-password"
                value={formData.password} onChange={handleChange}
                className={`${inputCls} ${errors.password ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Phone Number" required error={errors.phoneNumber}>
              <input
                name="phoneNumber" type="text" placeholder="0912 345 678"
                value={formData.phoneNumber} onChange={handleChange}
                className={`${inputCls} ${errors.phoneNumber ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Gender" required>
              <select
                name="gender" value={formData.gender} onChange={handleChange}
                className={inputCls} style={{ ...inputStyle, background: "var(--bg-card)" }}
              >
                <option value="MALE"   style={{ background: "var(--bg-card)" }}>Male</option>
                <option value="FEMALE" style={{ background: "var(--bg-card)" }}>Female</option>
                <option value="OTHER"  style={{ background: "var(--bg-card)" }}>Other</option>
              </select>
            </FormField>

            <FormField label="Date of Birth" required error={errors.dateOfBirth}>
              <input
                name="dateOfBirth" type="date"
                value={formData.dateOfBirth} onChange={handleChange}
                className={`${inputCls} ${errors.dateOfBirth ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Identity Card (CCCD)" required error={errors.identityCard}>
              <input
                name="identityCard" type="text" placeholder="12-digit CCCD number"
                value={formData.identityCard} onChange={handleChange}
                className={`${inputCls} ${errors.identityCard ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Address" required error={errors.address}>
              <input
                name="address" type="text" placeholder="Full address"
                value={formData.address} onChange={handleChange}
                className={`${inputCls} ${errors.address ? "border-red-400" : ""} md:col-span-2`} style={inputStyle}
              />
            </FormField>
          </div>
        </div>

        {/* ── Section 2: Employee Info ────────────────────────────────────── */}
        <div
          className="p-6 rounded-2xl border mb-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Employee Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Employee Code" required error={errors.employeeCode}>
              <input
                name="employeeCode" type="text" placeholder="e.g. EMP007"
                value={formData.employeeCode} onChange={handleChange}
                className={`${inputCls} ${errors.employeeCode ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Hire Date" required error={errors.hireDate}>
              <input
                name="hireDate" type="date"
                value={formData.hireDate} onChange={handleChange}
                className={`${inputCls} ${errors.hireDate ? "border-red-400" : ""}`} style={inputStyle}
              />
            </FormField>

            <FormField label="Department" required error={errors.department}>
              <select
                name="department" value={formData.department} onChange={handleChange}
                className={`${inputCls} ${errors.department ? "border-red-400" : ""}`}
                style={{ ...inputStyle, background: "var(--bg-card)" }}
              >
                <option value="" style={{ background: "var(--bg-card)" }}>Select department...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} style={{ background: "var(--bg-card)" }}>{d}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Position" required error={errors.position}>
              <select
                name="position" value={formData.position} onChange={handleChange}
                disabled={!formData.department}
                className={`${inputCls} ${errors.position ? "border-red-400" : ""} ${!formData.department ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{ ...inputStyle, background: "var(--bg-card)" }}
              >
                <option value="" style={{ background: "var(--bg-card)" }}>
                  {formData.department ? "Select position..." : "Select department first"}
                </option>
                {positions.map((p) => (
                  <option key={p} value={p} style={{ background: "var(--bg-card)" }}>{p}</option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/employees")}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border hover:opacity-80 transition-all"
            style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all shadow-sm ${
              loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
            }`}
            style={{ background: accentColor }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save size={16} />
                Create Employee
              </>
            )}
          </button>
        </div>
      </form>

      <style>{`.theme-dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
    </div>
  );
}
