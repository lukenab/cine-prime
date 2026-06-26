import { useState, useEffect } from "react";
import { ArrowLeft, Save, Camera, User } from "lucide-react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";

import type { EmployeeFormData } from "./CreateEmployeePage";

const DEPARTMENTS = ["Box Office", "Operations", "Concessions", "IT", "Security", "Housekeeping"];

const POSITIONS: Record<string, string[]> = {
  "Box Office":   ["Ticket Agent", "Senior Ticket Agent", "Box Office Supervisor"],
  "Operations":   ["Shift Supervisor", "Operations Manager", "Floor Staff"],
  "Concessions":  ["F&B Staff", "F&B Supervisor", "Concessions Manager"],
  "IT":           ["System Admin", "IT Support", "IT Manager"],
  "Security":     ["Security Guard", "Security Supervisor"],
  "Housekeeping": ["Housekeeping Staff", "Housekeeping Supervisor"],
};

// ── Mock fetch — replace with API when employee-service is ready ──────────────
async function fetchEmployeeById(id: string): Promise<EmployeeFormData> {
  await new Promise((r) => setTimeout(r, 400));
  return {
    username:     "an.nguyen",
    email:        "an.nguyen@cineprime.vn",
    password:     "",
    fullName:     "Nguyen Van An",
    phoneNumber:  "0912345678",
    gender:       "MALE",
    dateOfBirth:  "1998-04-22",
    identityCard: "012345678901",
    address:      "123 Nguyen Hue, District 1, HCMC",
    employeeCode: "EMP001",
    department:   "Box Office",
    position:     "Ticket Agent",
    hireDate:     "2024-01-15",
  };
}

// ── Field helpers ─────────────────────────────────────────────────────────────
function FormField({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
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

const inputCls  = "px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all";
const inputStyle = { background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [formData, setFormData] = useState<EmployeeFormData>({
    username: "", email: "", password: "", fullName: "", phoneNumber: "",
    gender: "MALE", dateOfBirth: "", identityCard: "", address: "",
    employeeCode: "", department: "", position: "", hireDate: "",
  });

  const [errors, setErrors]   = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  // ── Fetch existing data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    fetchEmployeeById(id)
      .then((data) => setFormData(data))
      .catch(() => setApiError("Failed to load employee data."))
      .finally(() => setFetching(false));
  }, [id]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === "department") return { ...prev, department: value, position: "" };
      return { ...prev, [name]: value };
    });
    if (errors[name as keyof EmployeeFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof EmployeeFormData, string>> = {};
    if (!formData.fullName.trim())                             e.fullName     = "Full name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))  e.email        = "Invalid email format";
    if (formData.password && formData.password.length < 8)    e.password     = "Password must be at least 8 characters";
    if (!/^0[35789][0-9]{8}$/.test(formData.phoneNumber))     e.phoneNumber  = "Invalid Vietnamese phone number";
    if (!/^[0-9]{12}$/.test(formData.identityCard))           e.identityCard = "Identity card must be exactly 12 digits";
    if (!formData.dateOfBirth)                                 e.dateOfBirth  = "Date of birth is required";
    if (!formData.address.trim())                              e.address      = "Address is required";
    if (!formData.employeeCode.trim())                         e.employeeCode = "Employee code is required";
    if (!formData.department)                                  e.department   = "Department is required";
    if (!formData.position)                                    e.position     = "Position is required";
    if (!formData.hireDate)                                    e.hireDate     = "Hire date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError(null);
    try {
      // TODO: Replace with actual API call
      // const payload = { ...formData };
      // if (!payload.password) delete payload.password;
      // await employeeApi.updateEmployee(id, payload);
      await new Promise((r) => setTimeout(r, 800));
      navigate(`/admin/employees/${id}`);
    } catch (err: any) {
      setApiError(err.response?.data?.message || err.message || "Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

  const positions = formData.department ? (POSITIONS[formData.department] ?? []) : [];

  // ── Loading state ──────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full pb-10" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1.5" style={{ color: "var(--text-main)" }}>Edit Employee</h1>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-sub)" }}>
            <span>Dashboard</span><span>›</span>
            <span>Employee Management</span><span>›</span>
            <span className="font-semibold" style={{ color: "var(--text-main)" }}>Edit Employee</span>
          </div>
        </div>
        <button
          onClick={() => navigate(`/admin/employees/${id}`)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium hover:opacity-80 transition-all"
          style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <ArrowLeft size={16} /> Back to Detail
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Section 1: Account Info ──────────────────────────────────────── */}
        <div className="p-6 rounded-2xl border mb-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
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
              <input name="fullName" type="text" value={formData.fullName} onChange={handleChange}
                className={`${inputCls} ${errors.fullName ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            {/* Username: disabled — không cho đổi */}
            <FormField label="Username">
              <input name="username" type="text" value={formData.username} disabled
                className={`${inputCls} opacity-50 cursor-not-allowed`} style={inputStyle} />
            </FormField>

            {/* Email: disabled — không cho đổi */}
            <FormField label="Email">
              <input name="email" type="email" value={formData.email} disabled
                className={`${inputCls} opacity-50 cursor-not-allowed`} style={inputStyle} />
            </FormField>

            <FormField label="New Password" error={errors.password}>
              <input name="password" type="password" placeholder="Leave blank to keep current password"
                autoComplete="new-password" value={formData.password} onChange={handleChange}
                className={`${inputCls} ${errors.password ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Phone Number" required error={errors.phoneNumber}>
              <input name="phoneNumber" type="text" value={formData.phoneNumber} onChange={handleChange}
                className={`${inputCls} ${errors.phoneNumber ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Gender" required>
              <select name="gender" value={formData.gender} onChange={handleChange}
                className={inputCls} style={{ ...inputStyle, background: "var(--bg-card)" }}>
                <option value="MALE"   style={{ background: "var(--bg-card)" }}>Male</option>
                <option value="FEMALE" style={{ background: "var(--bg-card)" }}>Female</option>
                <option value="OTHER"  style={{ background: "var(--bg-card)" }}>Other</option>
              </select>
            </FormField>

            <FormField label="Date of Birth" required error={errors.dateOfBirth}>
              <input name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange}
                className={`${inputCls} ${errors.dateOfBirth ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Identity Card (CCCD)" required error={errors.identityCard}>
              <input name="identityCard" type="text" value={formData.identityCard} onChange={handleChange}
                className={`${inputCls} ${errors.identityCard ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Address" required error={errors.address}>
              <input name="address" type="text" value={formData.address} onChange={handleChange}
                className={`${inputCls} ${errors.address ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>
          </div>
        </div>

        {/* ── Section 2: Employee Info ─────────────────────────────────────── */}
        <div className="p-6 rounded-2xl border mb-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Employee Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Employee Code" required error={errors.employeeCode}>
              <input name="employeeCode" type="text" value={formData.employeeCode} onChange={handleChange}
                className={`${inputCls} ${errors.employeeCode ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Hire Date" required error={errors.hireDate}>
              <input name="hireDate" type="date" value={formData.hireDate} onChange={handleChange}
                className={`${inputCls} ${errors.hireDate ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Department" required error={errors.department}>
              <select name="department" value={formData.department} onChange={handleChange}
                className={`${inputCls} ${errors.department ? "border-red-400" : ""}`}
                style={{ ...inputStyle, background: "var(--bg-card)" }}>
                <option value="" style={{ background: "var(--bg-card)" }}>Select department...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} style={{ background: "var(--bg-card)" }}>{d}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Position" required error={errors.position}>
              <select name="position" value={formData.position} onChange={handleChange}
                disabled={!formData.department}
                className={`${inputCls} ${errors.position ? "border-red-400" : ""} ${!formData.department ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{ ...inputStyle, background: "var(--bg-card)" }}>
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

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(`/admin/employees/${id}`)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border hover:opacity-80 transition-all"
            style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all shadow-sm ${loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            style={{ background: accentColor }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
        </div>
      </form>

      <style>{`.theme-dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
    </div>
  );
}
