import { useState } from "react";
import { ArrowLeft, Save, User, Camera } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { employeeApi, type EmployeeDepartment, type EmployeePosition, type EmploymentType } from "../../api/employeeApi";
import { userApi } from "../../api/userApi";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface EmployeeFormData {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  identityCard: string;
  address: string;
  cinemaId: string;
  position: EmployeePosition | "";
  department: EmployeeDepartment | "";
  employmentType: EmploymentType | "";
  hireDate: string;
}

const POSITIONS: { value: EmployeePosition; label: string }[] = [
  { value: "STAFF", label: "Staff" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "MANAGER", label: "Manager" },
];

const DEPARTMENTS: { value: EmployeeDepartment; label: string }[] = [
  { value: "BOX_OFFICE", label: "Box Office" },
  { value: "CONCESSION", label: "Concession" },
  { value: "FLOOR", label: "Floor" },
  { value: "PROJECTION", label: "Projection" },
  { value: "MANAGEMENT", label: "Management" },
  { value: "CUSTOMER_SERVICE", label: "Customer Service" },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "PROBATION", label: "Probation" },
  { value: "INTERN", label: "Intern" },
  { value: "CONTRACT", label: "Contract" },
];

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

const inputCls = "px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all";
const inputStyle = { background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" };
const today = new Date().toISOString().slice(0, 10);

function isAtLeastAge(dateValue: string, age: number) {
  const dob = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  let currentAge = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    currentAge -= 1;
  }

  return currentAge >= age;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForUserProfile(accountId: string) {
  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await userApi.getUserById(accountId);
      return;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error("Account created, but user profile is not ready yet. Please wait a moment and create the employee record again.");
      }
      await sleep(1000);
    }
  }
}

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
    gender: "Male",
    dateOfBirth: "",
    identityCard: "",
    address: "",
    cinemaId: "",
    position: "",
    department: "",
    employmentType: "",
    hireDate: today,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [step, setStep]         = useState<"idle" | "account" | "employee">("idle");
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

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
    if (!formData.fullName.trim())                              e.fullName     = "Full name is required";
    if (!formData.username.trim())                              e.username     = "Username is required";
    if (formData.username.length < 5)                          e.username     = "Username must be at least 5 characters";
    if (!formData.email.trim())                                 e.email        = "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))   e.email        = "Invalid email format";
    if (!formData.password)                                     e.password     = "Password is required";
    if (formData.password.length < 6)                          e.password     = "Password must be at least 6 characters";
    if (!/^0[35789][0-9]{8}$/.test(formData.phoneNumber))      e.phoneNumber  = "Invalid Vietnamese phone number";
    if (!/^[0-9]{12}$/.test(formData.identityCard))            e.identityCard = "Identity card must be exactly 12 digits";
    if (!formData.dateOfBirth)                                  e.dateOfBirth  = "Date of birth is required";
    else if (formData.dateOfBirth > today)                      e.dateOfBirth  = "Date of birth cannot be in the future";
    else if (!isAtLeastAge(formData.dateOfBirth, 18))            e.dateOfBirth  = "Employee must be at least 18 years old";
    if (!formData.address.trim())                               e.address      = "Address is required";
    if (formData.cinemaId.length > 36)                           e.cinemaId     = "Cinema ID must be at most 36 characters";
    if (!formData.position)                                     e.position     = "Position is required";
    if (!formData.department)                                    e.department   = "Department is required";
    if (!formData.employmentType)                                e.employmentType = "Employment type is required";
    if (!formData.hireDate)                                     e.hireDate     = "Hire date is required";
    else if (formData.hireDate > today)                         e.hireDate     = "Hire date cannot be in the future";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    try {
      let accountId = createdAccountId;

      if (!accountId) {
        // Step 1 — Create account (auth-service publishes Kafka event → user-service creates profile)
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

        accountId = (accountRes as any)?.result?.accountId;
        if (!accountId) throw new Error("Account created but accountId not returned.");
        setCreatedAccountId(accountId);
      }

      await waitForUserProfile(accountId);

      // Step 2 — Create employee record.
      setStep("employee");
      await employeeApi.create({
        accountId,
        cinemaId:     formData.cinemaId.trim() || undefined,
        position:     formData.position || "STAFF",
        department:   formData.department || undefined,
        employmentType: formData.employmentType || undefined,
        hireDate:     formData.hireDate,
      });

      setCreatedAccountId(null);
      navigate("/admin/employees");
    } catch (err: any) {
      setApiError(err.response?.data?.message || err.message || "Failed to create employee.");
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
        {/* ── Section 1: Account Info ─────────────────────────────────────── */}
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
            <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">
              {apiError}
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
                <option value="Male"   style={{ background: "var(--bg-card)" }}>Male</option>
                <option value="Female" style={{ background: "var(--bg-card)" }}>Female</option>
                <option value="Other"  style={{ background: "var(--bg-card)" }}>Other</option>
              </select>
            </FormField>

            <FormField label="Date of Birth" required error={errors.dateOfBirth}>
              <input name="dateOfBirth" type="date"
                value={formData.dateOfBirth} onChange={handleChange} max={today}
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

        {/* ── Section 2: Employee Info ────────────────────────────────────── */}
        <div className="p-6 rounded-2xl border mb-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Employment Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Cinema ID" error={errors.cinemaId}>
              <input name="cinemaId" type="text" placeholder="Optional cinema/branch ID"
                value={formData.cinemaId} onChange={handleChange}
                className={`${inputCls} ${errors.cinemaId ? "border-red-400" : ""}`} style={inputStyle} />
            </FormField>

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
              <input name="hireDate" type="date"
                value={formData.hireDate} onChange={handleChange} max={today}
                className={`${inputCls} ${errors.hireDate ? "border-red-400" : ""}`} style={inputStyle} />
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
