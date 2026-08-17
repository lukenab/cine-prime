import { useState } from "react";
import { ArrowLeft, AlertCircle, X, ShieldCheck, UserRoundPlus } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { employeeApi, type EmployeeDepartment, type EmployeePosition, type EmploymentType } from "../../api/employeeApi";
import { userApi } from "../../api/userApi";
import { Toast as SharedToast } from "../../components/shared/Toast";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface EmployeeFormData {
  // Account fields (for auth-service) — Issue #161/#162: username/password removed.
  // The backend auto-generates the username and emails an activation link instead
  // of an admin-set "temporary password".
  email: string;
  // Profile fields (persisted after the verified employee record is provisioned).
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
  { value: "TEAM_MEMBER", label: "Team member" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "ASSISTANT_MANAGER", label: "Assistant manager" },
  { value: "CINEMA_MANAGER", label: "Cinema manager" },
];

const DEPARTMENTS: { value: EmployeeDepartment; label: string }[] = [
  { value: "GENERAL_OPERATIONS", label: "General operations" },
  { value: "BOX_OFFICE", label: "Box office" },
  { value: "FOOD_BEVERAGE", label: "Food & beverage" },
  { value: "FLOOR_GUEST_SERVICES", label: "Floor & guest services" },
  { value: "PROJECTION_TECHNICAL", label: "Projection & technical" },
  { value: "FACILITIES_MAINTENANCE", label: "Facilities & maintenance" },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "FIXED_TERM", label: "Fixed-term" },
  { value: "SEASONAL", label: "Seasonal" },
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

// Issue #161/#162: local toast, matches the pattern already used in SettingsPage.tsx
function Toast({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  return <SharedToast type={type} message={message} onClose={onClose} />;
}

const inputCls   = "px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all";
const inputStyle = { background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateEmployeePage() {
  const navigate    = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [formData, setFormData] = useState<EmployeeFormData>({
    email:          "",
    fullName:       "",
    phoneNumber:    "",
    gender:         "Male",
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
  const [toast, setToast]         = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [provisionedAccountId, setProvisionedAccountId] = useState<string | null>(null);

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
    if (!formData.email.trim())                                 e.email          = "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))   e.email          = "Invalid email format";
    if (!/^0[35789][0-9]{8}$/.test(formData.phoneNumber))      e.phoneNumber    = "Invalid Vietnamese phone number";
    if (!/^[0-9]{12}$/.test(formData.identityCard))            e.identityCard   = "Identity card must be exactly 12 digits";
    if (!formData.dateOfBirth)                                  e.dateOfBirth    = "Date of birth is required";
    else if (formData.dateOfBirth > today)                      e.dateOfBirth    = "Date of birth cannot be in the future";
    if (!formData.address.trim())                               e.address        = "Address is required";
    if (!formData.position)                                     e.position       = "Position is required";
    if (!formData.department)                                   e.department     = "Primary work area is required";
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

    let currentStep: "account" | "employee" = provisionedAccountId ? "employee" : "account";

    try {
      // Step 1 — Create account (auth-service → Kafka → user-service creates User profile).
      // Issue #161/#162: only fullName/email/role are sent now — no username/password.
      // The account is created PENDING and an activation-link email is sent to the
      // employee so they can set their own password (see /activate-account).
      let accountId = provisionedAccountId;
      if (!accountId) {
        setStep("account");
        const accountRes: any = await authApi.createAccount({
          fullName: formData.fullName,
          email:    formData.email,
          role:     "EMPLOYEE",
          phoneNumber: formData.phoneNumber,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          identityCard: formData.identityCard,
          address: formData.address,
        });

        accountId = accountRes?.data?.result?.accountId ?? accountRes?.result?.accountId;
        if (!accountId) throw new Error("Account created but accountId not returned.");
        setProvisionedAccountId(accountId);
      }

      // Step 2 — Create employee record (user profile exists via Kafka by now)
      currentStep = "employee";
      setStep("employee");
      await employeeApi.create({
        accountId,
        cinemaId:       formData.cinemaId.trim() || undefined,
        position:       formData.position as EmployeePosition,
        department:     formData.department as EmployeeDepartment,
        employmentType: formData.employmentType as EmploymentType,
        hireDate:       formData.hireDate,
      });

      await userApi.updateUser(accountId, {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        identityCard: formData.identityCard,
        address: formData.address,
      });
      setProvisionedAccountId(null);

      setToast({
        type: "success",
        message: `Employee account created. Activation email sent to ${formData.email}.`,
      });

      setTimeout(() => navigate("/admin/employees"), 1800);
    } catch (err: any) {
      setApiError(err.response?.data?.message || err.message || "An unexpected error occurred.");
      setErrorStep(currentStep);
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
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

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
          <div className="flex items-start gap-4 mb-5 pb-4 border-b" style={{ borderColor: "var(--border-color)" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}18`, color: accentColor }}>
              <UserRoundPlus size={21} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Account Information</h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-sub)" }}>
                Create the employee identity before assigning their workplace.
              </p>
            </div>
          </div>

          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm" style={{ color: "var(--text-sub)" }}>
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-500" />
            No password needed here — an activation email will be sent to the employee so
            they can set their own password. Username is generated automatically.
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

            <FormField label="Email" required error={errors.email}>
              <input name="email" type="email" placeholder="an.nguyen@cineprime.vn"
                value={formData.email} onChange={handleChange}
                className={`${inputCls} ${errors.email ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Phone Number" required error={errors.phoneNumber}>
              <input name="phoneNumber" type="text" placeholder="0912 345 678"
                value={formData.phoneNumber} onChange={handleChange}
                className={`${inputCls} ${errors.phoneNumber ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

            <FormField label="Gender" required>
              <select name="gender" value={formData.gender} onChange={handleChange}
                className={inputCls} style={{ ...inputStyle, background: "var(--bg-card)" }}>
                <option value="Male"   style={{ background: "var(--bg-card)" }}>Male</option>
                <option value="Female" style={{ background: "var(--bg-card)" }}>Female</option>
                <option value="Other"  style={{ background: "var(--bg-card)" }}>Other</option>
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

            <FormField label="Primary work area" required error={errors.department}>
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
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {stepLabel}
              </>
            ) : (
              "Create Employee"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
