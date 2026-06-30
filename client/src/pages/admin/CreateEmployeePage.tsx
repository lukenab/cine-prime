import { useState } from "react";
import { ArrowLeft, Save, User, Camera, AlertCircle, X } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { employeeApi, type EmployeeDepartment, type EmployeePosition, type EmploymentType } from "../../api/employeeApi";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface EmployeeFormData {
  // Account fields (for auth-service)
  username: string;
  email: string;
  password: string;
  // Profile fields (for user-service via Kafka)
  fullName: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  identityCard: string;
  address: string;
  // Employee fields
  cinemaId: string;
  position: string;
  department: string;
  employmentType: string;
  hireDate: string;
}

const POSITIONS: { value: EmployeePosition; label: string }[] = [
  { value: "STAFF",      label: "Staff" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "MANAGER",    label: "Manager" },
];

const DEPARTMENTS: { value: EmployeeDepartment; label: string }[] = [
  { value: "BOX_OFFICE",       label: "Box Office" },
  { value: "CONCESSION",       label: "Concession" },
  { value: "FLOOR",            label: "Floor" },
  { value: "PROJECTION",       label: "Projection" },
  { value: "MANAGEMENT",       label: "Management" },
  { value: "CUSTOMER_SERVICE", label: "Customer Service" },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "PROBATION", label: "Probation" },
  { value: "INTERN",    label: "Intern" },
  { value: "CONTRACT",  label: "Contract" },
];

const today = new Date().toISOString().slice(0, 10);

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

const inputCls   = "px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all";
const inputStyle = { background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateEmployeePage() {
  const navigate    = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [formData, setFormData] = useState<EmployeeFormData>({
    username:       "",
    email:          "",
    password:       "",
    fullName:       "",
    phoneNumber:    "",
    gender:         "MALE",
    dateOfBirth:    "",
    identityCard:   "",
    address:        "",
    cinemaId:       "",
    position:       "",
    department:     "",
    employmentType: "",
    hireDate:       today,
  });

  const [errors, setErrors]       = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<"account" | "employee" | null>(null);
  const [step, setStep]           = useState<"idle" | "account" | "employee">("idle");

  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof EmployeeFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof EmployeeFormData, string>> = {};
    if (!formData.fullName.trim())                              e.fullName       = "Full name is required";
    if (!formData.username.trim())                              e.username       = "Username is required";
    if (formData.username.length < 5)                          e.username       = "Username must be at least 5 characters";
    if (!formData.email.trim())                                 e.email          = "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))   e.email          = "Invalid email format";
    if (!formData.password)                                     e.password       = "Password is required";
    if (formData.password.length < 6)                          e.password       = "Password must be at least 6 characters";
    if (!/^0[35789][0-9]{8}$/.test(formData.phoneNumber))      e.phoneNumber    = "Invalid Vietnamese phone number";
    if (!/^[0-9]{12}$/.test(formData.identityCard))            e.identityCard   = "Identity card must be exactly 12 digits";
    if (!formData.dateOfBirth)                                  e.dateOfBirth    = "Date of birth is required";
    else if (formData.dateOfBirth > today)                      e.dateOfBirth    = "Date of birth cannot be in the future";
    if (!formData.address.trim())                               e.address        = "Address is required";
    if (!formData.position)                                     e.position       = "Position is required";
    if (!formData.department)                                   e.department     = "Department is required";
    if (!formData.employmentType)                               e.employmentType = "Employment type is required";
    if (!formData.hireDate)                                     e.hireDate       = "Hire date is required";
    else if (formData.hireDate > today)                         e.hireDate       = "Hire date cannot be in the future";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);
    setErrorStep(null);

    try {
      // Step 1 — Create account (auth-service → Kafka → user-service creates User profile)
      // Kafka sendAndWait (5s timeout) ensures profile exists before we proceed.
      setStep("account");
      const accountRes = await authApi.createAccount({
        username:     formData.username,
        password:     formData.password,
        email:        formData.email,
        fullName:     formData.fullName,
        phoneNumber:  formData.phoneNumber,
        dateOfBirth:  formData.dateOfBirth,
        gender:       formData.gender,
        address:      formData.address,
        identityCard: formData.identityCard,
        role:         "EMPLOYEE",
      });

      const accountId: string = (accountRes as any)?.result?.accountId;
      if (!accountId) throw new Error("Account created but accountId not returned.");

      // Step 2 — Create employee record (user profile exists via Kafka by now)
      setStep("employee");
      await employeeApi.create({
        accountId,
        cinemaId:       formData.cinemaId.trim() || undefined,
        position:       formData.position as EmployeePosition,
        department:     formData.department as EmployeeDepartment,
        employmentType: formData.employmentType as EmploymentType,
        hireDate:       formData.hireDate,
      });

      navigate("/admin/employees");
    } catch (err: any) {
      setApiError(err.response?.data?.message || err.message || "An unexpected error occurred.");
      setErrorStep(step === "idle" ? null : step as "account" | "employee");
    } finally {
      setLoading(false);
      setStep("idle");
    }
  };

  const stepLabel = {
    idle:     "",
    account:  "Creating account...",
    employee: "Registering employee...",
  }[step];

  return (
    <div className="w-full pb-10" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1.5" style={{ color: "var(--text-main)" }}>Add New Employee</h1>
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
        {/* ── Section 1: Account Info ──────────────────────────────────────── */}
        <div className="p-6 rounded-2xl border mb-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Account Information
          </h2>

          {/* Avatar placeholder */}
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
            <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/8 overflow-hidden">
              {/* colour bar */}
              <div className="h-1 w-full bg-red-500" />
              <div className="flex items-start gap-3 p-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center mt-0.5">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-500 mb-0.5">
                    {errorStep === "account" ? "Failed to create account" : errorStep === "employee" ? "Account created — failed to register employee" : "Something went wrong"}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-sub)" }}>
                    {apiError}
                  </p>
                  {errorStep === "employee" && (
                    <p className="text-xs mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                      The account was successfully created. You can try registering the employee record again from the employee list.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setApiError(null); setErrorStep(null); }}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
                  style={{ color: "var(--text-sub)" }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Full Name" required error={errors.fullName}>
              <input name="fullName" type="text" placeholder="e.g. Nguyen Van An"
                value={formData.fullName} onChange={handleChange}
                className={`${inputCls} ${errors.fullName ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Username" required error={errors.username}>
              <input name="username" type="text" placeholder="e.g. an.nguyen" minLength={5}
                value={formData.username} onChange={handleChange}
                className={`${inputCls} ${errors.username ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Email" required error={errors.email}>
              <input name="email" type="email" placeholder="an.nguyen@cineprime.vn"
                value={formData.email} onChange={handleChange}
                className={`${inputCls} ${errors.email ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Temporary Password" required error={errors.password}>
              <input name="password" type="password" placeholder="Min 6 characters"
                minLength={6} autoComplete="new-password"
                value={formData.password} onChange={handleChange}
                className={`${inputCls} ${errors.password ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Phone Number" required error={errors.phoneNumber}>
              <input name="phoneNumber" type="text" placeholder="0912 345 678"
                value={formData.phoneNumber} onChange={handleChange}
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
              <input name="dateOfBirth" type="date" max={today}
                value={formData.dateOfBirth} onChange={handleChange}
                className={`${inputCls} ${errors.dateOfBirth ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Identity Card (CCCD)" required error={errors.identityCard}>
              <input name="identityCard" type="text" placeholder="12-digit CCCD number"
                value={formData.identityCard} onChange={handleChange}
                className={`${inputCls} ${errors.identityCard ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Address" required error={errors.address}>
                <input name="address" type="text" placeholder="Full address"
                  value={formData.address} onChange={handleChange}
                  className={`${inputCls} w-full ${errors.address ? "border-red-400" : ""}`} style={inputStyle} />
              </FormField>
            </div>
          </div>
        </div>

        {/* ── Section 2: Employment Info ───────────────────────────────────── */}
        <div className="p-6 rounded-2xl border mb-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Employment Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Position" required error={errors.position}>
              <select name="position" value={formData.position} onChange={handleChange}
                className={`${inputCls} ${errors.position ? "border-red-400" : ""}`}
                style={{ ...inputStyle, background: "var(--bg-card)" }}>
                <option value="" style={{ background: "var(--bg-card)" }}>Select position...</option>
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value} style={{ background: "var(--bg-card)" }}>{p.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Department" required error={errors.department}>
              <select name="department" value={formData.department} onChange={handleChange}
                className={`${inputCls} ${errors.department ? "border-red-400" : ""}`}
                style={{ ...inputStyle, background: "var(--bg-card)" }}>
                <option value="" style={{ background: "var(--bg-card)" }}>Select department...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value} style={{ background: "var(--bg-card)" }}>{d.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Employment Type" required error={errors.employmentType}>
              <select name="employmentType" value={formData.employmentType} onChange={handleChange}
                className={`${inputCls} ${errors.employmentType ? "border-red-400" : ""}`}
                style={{ ...inputStyle, background: "var(--bg-card)" }}>
                <option value="" style={{ background: "var(--bg-card)" }}>Select type...</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value} style={{ background: "var(--bg-card)" }}>{t.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Hire Date" required error={errors.hireDate}>
              <input name="hireDate" type="date" max={today}
                value={formData.hireDate} onChange={handleChange}
                className={`${inputCls} ${errors.hireDate ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Cinema ID" error={errors.cinemaId}>
              <input name="cinemaId" type="text" placeholder="Optional — assign to a cinema branch"
                value={formData.cinemaId} onChange={handleChange}
                className={inputCls} style={inputStyle} />
            </FormField>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
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
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all shadow-sm ${loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            style={{ background: accentColor }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {stepLabel}
              </>
            ) : (
              <><Save size={16} /> Create Employee</>
            )}
          </button>
        </div>
      </form>

      <style>{`.theme-dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
    </div>
  );
}
