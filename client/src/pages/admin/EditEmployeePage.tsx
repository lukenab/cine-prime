import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { employeeApi, type EmployeeDepartment, type EmployeePosition, type EmployeeResponse, type EmploymentType } from "../../api/employeeApi";
import { userApi } from "../../api/userApi";

import type { EmployeeFormData } from "./CreateEmployeePage";

const POSITIONS: { value: EmployeePosition; label: string }[] = [
  { value: "TEAM_MEMBER", label: "Team member" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "ASSISTANT_MANAGER", label: "Assistant manager" },
  { value: "CINEMA_MANAGER", label: "Cinema manager" },
  { value: "PROGRAMMING_OPERATOR", label: "Programming operator" },
  { value: "PROGRAMMING_APPROVER", label: "Programming approver" },
  { value: "FINANCE_OFFICER", label: "Finance officer" },
  { value: "FINANCE_APPROVER", label: "Finance approver" },
  { value: "COMMERCIAL_MANAGER", label: "Commercial manager" },
  { value: "COMMERCIAL_APPROVER", label: "Commercial approver" },
  { value: "SYSTEM_ADMINISTRATOR", label: "System administrator" },
  { value: "SECURITY_AUDITOR", label: "Security auditor" },
  { value: "STAFF", label: "Staff (legacy)" },
  { value: "MANAGER", label: "Manager (legacy)" },
];

const DEPARTMENTS: { value: EmployeeDepartment; label: string }[] = [
  { value: "GENERAL_OPERATIONS", label: "General operations" },
  { value: "BOX_OFFICE", label: "Box office" },
  { value: "FOOD_BEVERAGE", label: "Food & beverage" },
  { value: "FLOOR_GUEST_SERVICES", label: "Floor & guest services" },
  { value: "PROJECTION_TECHNICAL", label: "Projection & technical" },
  { value: "FACILITIES_MAINTENANCE", label: "Facilities & maintenance" },
  { value: "CONTENT_PROGRAMMING", label: "Content programming" },
  { value: "FINANCE", label: "Finance" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "INFORMATION_TECHNOLOGY", label: "Information technology" },
  { value: "RISK_COMPLIANCE", label: "Risk & compliance" },
  { value: "CONCESSION", label: "Concession (legacy)" },
  { value: "FLOOR", label: "Floor (legacy)" },
  { value: "PROJECTION", label: "Projection (legacy)" },
  { value: "MANAGEMENT", label: "Management (legacy)" },
  { value: "CUSTOMER_SERVICE", label: "Customer service (legacy)" },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "FIXED_TERM", label: "Fixed-term" },
  { value: "SEASONAL", label: "Seasonal" },
  { value: "PROBATION", label: "Probation (legacy)" },
  { value: "INTERN", label: "Intern (legacy)" },
  { value: "CONTRACT", label: "Contract (legacy)" },
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

const inputCls   = "px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all";
const inputStyle = { background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" };
const today = new Date().toISOString().slice(0, 10);

function normalizeGender(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  if (normalized === "other") return "Other";
  return "Male";
}

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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [formData, setFormData] = useState<EmployeeFormData>({
    email: "", fullName: "", phoneNumber: "",
    gender: "Male", dateOfBirth: "", identityCard: "", address: "",
    cinemaId: "", position: "", department: "", employmentType: "", hireDate: "",
  });

  // Store accountId separately (needed for user profile update)
  const [accountId, setAccountId]   = useState<string>("");
  const [accessRole, setAccessRole] = useState<EmployeeResponse["accessRole"]>("EMPLOYEE");
  const [errors, setErrors]         = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [fetching, setFetching]     = useState(true);
  const [loading, setLoading]       = useState(false);
  const [apiError, setApiError]     = useState<string | null>(null);

  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  // ── Fetch existing data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const res = await employeeApi.getById(id);
        const emp: EmployeeResponse = (res as any)?.result;
        setAccountId(emp.accountId);
        setAccessRole(emp.accessRole ?? "EMPLOYEE");
        setFormData({
          email:        "",
          fullName:     emp.fullName     ?? "",
          phoneNumber:  emp.phoneNumber  ?? "",
          gender:       normalizeGender(emp.gender),
          dateOfBirth:  emp.dateOfBirth  ?? "",
          identityCard: emp.identityCard ?? "",
          address:      emp.address      ?? "",
          cinemaId:     emp.cinemaId     ?? "",
          position:     emp.position     ?? "",
          department:   emp.department   ?? "",
          employmentType: emp.employmentType ?? "",
          hireDate:     emp.hireDate     ?? "",
        });
      } catch (err: any) {
        setApiError(err?.response?.data?.message || "Failed to load employee data.");
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [id]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof EmployeeFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof EmployeeFormData, string>> = {};
    if (!formData.fullName.trim())                             e.fullName     = "Full name is required";
    if (!/^0[35789][0-9]{8}$/.test(formData.phoneNumber))     e.phoneNumber  = "Invalid Vietnamese phone number";
    if (!/^[0-9]{12}$/.test(formData.identityCard))           e.identityCard = "Identity card must be exactly 12 digits";
    if (!formData.dateOfBirth)                                 e.dateOfBirth  = "Date of birth is required";
    else if (formData.dateOfBirth > today)                     e.dateOfBirth  = "Date of birth cannot be in the future";
    else if (!isAtLeastAge(formData.dateOfBirth, 18))           e.dateOfBirth  = "Employee must be at least 18 years old";
    if (!formData.address.trim())                              e.address      = "Address is required";
    if (formData.cinemaId.length > 36)                          e.cinemaId     = "Cinema ID must be at most 36 characters";
    if (!formData.position)                                    e.position     = "Position is required";
    if (!formData.department)                                   e.department   = "Primary work area is required";
    if (!formData.employmentType)                               e.employmentType = "Employment type is required";
    if (!formData.hireDate)                                    e.hireDate     = "Hire date is required";
    else if (formData.hireDate > today)                        e.hireDate     = "Hire date cannot be in the future";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || !id) return;
    setLoading(true);
    setApiError(null);
    try {
      // Authorization-relevant fields are one user-service command. It updates
      // Auth through the internal provisioning boundary and emits projection v+1.
      await employeeApi.changeAccessAssignment(id, {
        cinemaId: formData.cinemaId.trim() || undefined,
        position: formData.position as EmployeePosition,
        department: formData.department as EmployeeDepartment,
        accessRole,
      });
      await employeeApi.update(id, {
        employmentType: (formData.employmentType as EmploymentType) || undefined,
        hireDate: formData.hireDate,
      });

      // Update user profile fields via user-service
      if (accountId) {
        await userApi.updateUser(accountId, {
          fullName:     formData.fullName,
          phoneNumber:  formData.phoneNumber,
          gender:       formData.gender,
          dateOfBirth:  formData.dateOfBirth,
          identityCard: formData.identityCard,
          address:      formData.address,
        });
      }

      navigate(`/admin/employees/${id}`);
    } catch (err: any) {
      setApiError(err.response?.data?.message || err.message || "Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

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
        {/* ── Section 1: Personal Info ─────────────────────────────────────── */}
        <div className="p-6 rounded-2xl border mb-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Personal Information
          </h2>

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

            <FormField label="Phone Number" required error={errors.phoneNumber}>
              <input name="phoneNumber" type="text" value={formData.phoneNumber} onChange={handleChange}
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
              <input name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} max={today}
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

        {/* ── Section 2: Employment Info ──────────────────────────────────── */}
        <div className="p-6 rounded-2xl border mb-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold mb-5 pb-3 border-b" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Employment Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="System access role" required>
              <select value={accessRole} onChange={(event) => setAccessRole(event.target.value as EmployeeResponse["accessRole"])} className={inputCls} style={{ ...inputStyle, background: "var(--bg-card)" }}>
                {["EMPLOYEE", "BRANCH_MANAGER", "PROGRAMMING_OPERATOR", "PROGRAMMING_APPROVER", "FINANCE_OFFICER", "FINANCE_APPROVER", "COMMERCIAL_MANAGER", "COMMERCIAL_APPROVER", "SECURITY_AUDITOR", "SYSTEM_ADMIN"].map(role => <option key={role} value={role} style={{ background: "var(--bg-card)" }}>{role.replaceAll("_", " ")}</option>)}
              </select>
            </FormField>
            <FormField label="Cinema ID" error={errors.cinemaId}>
              <input name="cinemaId" type="text" value={formData.cinemaId} onChange={handleChange}
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
              <input name="hireDate" type="date" value={formData.hireDate} onChange={handleChange} max={today}
                className={`${inputCls} ${errors.hireDate ? "border-red-400" : ""}`} style={inputStyle} />
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
