import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { employeeApi, type EmployeeResponse } from "../../api/employeeApi";
import { userApi } from "../../api/userApi";

import type { EmployeeFormData } from "./CreateEmployeePage";

const POSITIONS = [
  "Ticket Agent",
  "Senior Ticket Agent",
  "Box Office Supervisor",
  "Shift Supervisor",
  "Operations Manager",
  "Floor Staff",
  "F&B Staff",
  "F&B Supervisor",
  "Concessions Manager",
  "System Admin",
  "IT Support",
  "Security Guard",
  "Housekeeping Staff",
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [formData, setFormData] = useState<EmployeeFormData>({
    username: "", email: "", password: "", fullName: "", phoneNumber: "",
    gender: "MALE", dateOfBirth: "", identityCard: "", address: "",
    position: "", hireDate: "",
  });

  // Store accountId separately (needed for user profile update)
  const [accountId, setAccountId]   = useState<string>("");
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
        setFormData({
          username:     "",           // fetched from auth-service; read-only in form
          email:        "",
          password:     "",
          fullName:     emp.fullName     ?? "",
          phoneNumber:  emp.phoneNumber  ?? "",
          gender:       emp.gender       ?? "MALE",
          dateOfBirth:  emp.dateOfBirth  ?? "",
          identityCard: emp.identityCard ?? "",
          address:      emp.address      ?? "",
          position:     emp.position     ?? "",
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
    if (!formData.address.trim())                              e.address      = "Address is required";
    if (!formData.position)                                    e.position     = "Position is required";
    if (!formData.hireDate)                                    e.hireDate     = "Hire date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || !id) return;
    setLoading(true);
    setApiError(null);
    try {
      // Update employee fields (position + hireDate)
      await employeeApi.update(id, {
        position: formData.position,
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

        {/* ── Section 2: Employment Info ──────────────────────────────────── */}
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
                  <option key={p} value={p} style={{ background: "var(--bg-card)" }}>{p}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Hire Date" required error={errors.hireDate}>
              <input name="hireDate" type="date" value={formData.hireDate} onChange={handleChange}
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
