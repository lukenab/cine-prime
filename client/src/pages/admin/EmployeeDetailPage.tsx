import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowLeft, User, Phone, MapPin, CreditCard,
  Calendar, Shield, Clock, Copy, Check, Briefcase, Hash,
  Send, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { employeeApi, type EmployeeResponse } from "../../api/employeeApi";
import { authApi } from "../../api/authApi";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AccountInfo {
  accountId: string;
  username: string;
  email: string;
  status: string;
  createdAt: string;
  roles: { roleName: string }[];
}

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-sub)" }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
          {label}
        </p>
        <p style={{ fontSize: "14px", color: "var(--text-main)", wordBreak: "break-word" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

function CopyableId({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const truncated = value.length > 20 ? `${value.slice(0, 8)}...${value.slice(-5)}` : value;
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-sub)" }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</p>
        <div className="flex items-center gap-2">
          <code style={{ fontSize: "13px", color: "var(--text-main)", fontFamily: "monospace" }}>{truncated}</code>
          <button
            onClick={handleCopy}
            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors"
            style={{ color: copied ? "#10b981" : "var(--text-sub)" }}
            title="Copy full ID"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #3b82f6, #6366f1)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #f97316, #f59e0b)",
];
function gradientFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

const DEPARTMENT_LABELS: Record<string, string> = {
  BOX_OFFICE: "Box Office",
  CONCESSION: "Concession",
  FLOOR: "Floor",
  PROJECTION: "Projection",
  MANAGEMENT: "Management",
  CUSTOMER_SERVICE: "Customer Service",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  PROBATION: "Probation",
  INTERN: "Intern",
  CONTRACT: "Contract",
};

const POSITION_LABELS: Record<string, string> = {
  STAFF: "Staff",
  SUPERVISOR: "Supervisor",
  MANAGER: "Manager",
};

// Issue #162 Part C: local toast, matches the pattern used in SettingsPage.tsx / CreateUserPage.tsx
function Toast({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
      style={{ background: type === "success" ? "#059669" : "#ef4444", color: "#fff", minWidth: "280px" }}>
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{message}</span>
      <button onClick={onClose} className="ml-auto opacity-75 hover:opacity-100" style={{ fontSize: "18px", lineHeight: 1 }}>×</button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [employee, setEmployee] = useState<EmployeeResponse | null>(null);
  const [account, setAccount]   = useState<AccountInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [toast, setToast]       = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch employee (includes user profile fields)
        const empRes = await employeeApi.getById(id);
        const emp: EmployeeResponse = (empRes as any)?.result;
        setEmployee(emp);

        // Fetch account info from auth-service
        try {
          const accRes = await authApi.getAccountById(emp.accountId);
          setAccount((accRes as any)?.result ?? null);
        } catch {
          // auth-service unreachable — show what we have
          setAccount(null);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load employee details.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Issue #162 Part C: admin resends the activation email when the 24h link
  // expired before the employee used it. Only relevant while account is PENDING.
  const handleResendActivation = async () => {
    if (!account?.accountId) return;
    setResending(true);
    try {
      await authApi.resendActivation(account.accountId);
      setToast({ type: "success", message: `Activation email resent to ${account.email}.` });
    } catch (err: any) {
      setToast({ type: "error", message: err?.response?.data?.message || "Failed to resend activation email." });
    } finally {
      setResending(false);
    }
  };

  const accentColor    = isDarkMode ? "#3b82f6" : "#2563eb";
  const initials       = employee?.fullName?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "??";
  const avatarGradient = id ? gradientFromId(id) : AVATAR_GRADIENTS[0];
  const isActive       = employee?.status === "ACTIVE";

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/admin/employees")}
          className="w-9 h-9 rounded-xl flex items-center justify-center border transition-colors hover:opacity-80"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-main)", letterSpacing: "-0.01em" }}>Employee Detail</h1>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Profile and employment information</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border p-8 text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <p style={{ color: "#ef4444", fontSize: "14px" }}>{error}</p>
          <button onClick={() => navigate("/admin/employees")} className="mt-4 text-sm underline" style={{ color: "var(--text-sub)" }}>
            Back to Employees
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && employee && (
        <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr" }}>

          {/* Left — Avatar & status */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-2xl border p-6 flex flex-col items-center text-center"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl mb-4"
                style={{ background: avatarGradient, fontWeight: 700 }}
              >
                {initials}
              </div>

              <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginBottom: "2px" }}>
                {employee.fullName}
              </p>
              {account && (
                <p style={{ fontSize: "13px", color: "var(--text-sub)", marginBottom: "4px" }}>
                  @{account.username}
                </p>
              )}
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "12px" }}>
                {POSITION_LABELS[employee.position] ?? employee.position}
              </p>

              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
                style={{
                  background: isActive ? "rgba(16,185,129,0.08)" : "rgba(107,114,128,0.08)",
                  color: isActive ? "#059669" : "#6b7280",
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                {isActive ? "Active" : "Disabled"}
              </span>

              {account?.status === "PENDING" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
                  style={{ background: "rgba(245,158,11,0.1)", color: "#d97706" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Pending Activation
                </span>
              )}

              {account && (
                <div className="w-full">
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Role</p>
                  {(account.roles ?? []).map((r) => (
                    <span
                      key={r.roleName}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-xs font-medium"
                      style={{ background: "rgba(59,130,246,0.08)", color: "#2563eb", borderColor: "rgba(59,130,246,0.2)" }}
                    >
                      <Shield size={10} /> {r.roleName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate(`/admin/employees/edit/${id}`)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all"
                style={{ background: accentColor }}
              >
                Edit Employee
              </button>
              {account?.status === "PENDING" && (
                <button
                  onClick={handleResendActivation}
                  disabled={resending}
                  className="w-full py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80 flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ color: "#d97706", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.05)" }}
                >
                  {resending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {resending ? "Sending..." : "Resend Activation Email"}
                </button>
              )}
              <button
                onClick={() => navigate("/admin/employees")}
                className="w-full py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
              >
                Back to List
              </button>
            </div>
          </div>

          {/* Right — Info sections */}
          <div className="flex flex-col gap-5">

            {/* Employment Info */}
            <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Employment Information</h2>
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "16px" }}>Position and tenure data</p>
              <CopyableId icon={<Hash size={15} />}      label="Employee ID" value={employee.employeeId} />
              <InfoRow icon={<Hash size={15} />}         label="Employee Code" value={employee.employeeCode ?? "—"} />
              <InfoRow icon={<Briefcase size={15} />}    label="Cinema ID" value={employee.cinemaId ?? "—"} />
              <InfoRow icon={<Briefcase size={15} />}    label="Position"    value={POSITION_LABELS[employee.position] ?? employee.position} />
              <InfoRow icon={<Briefcase size={15} />}    label="Department"  value={employee.department ? DEPARTMENT_LABELS[employee.department] ?? employee.department : "—"} />
              <InfoRow icon={<Briefcase size={15} />}    label="Employment Type" value={employee.employmentType ? EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType : "—"} />
              <InfoRow icon={<Calendar size={15} />}     label="Hire Date"   value={employee.hireDate} />
              <InfoRow icon={<Clock size={15} />}        label="Created At"  value={employee.createdAt ? new Date(employee.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"} />
            </div>

            {/* Account Info */}
            {account && (
              <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Account Information</h2>
                <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "16px" }}>Login credentials from Auth Service</p>
                <CopyableId icon={<User size={15} />}   label="Account ID" value={account.accountId} />
                <InfoRow icon={<User size={15} />}      label="Username"   value={account.username} />
                <InfoRow icon={<Hash size={15} />}      label="Email"      value={account.email} />
                <InfoRow icon={<Clock size={15} />}     label="Registered" value={account.createdAt ? new Date(account.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"} />
              </div>
            )}

            {/* Personal Info */}
            <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Personal Information</h2>
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "16px" }}>Profile data from User Service</p>
              <InfoRow icon={<Phone size={15} />}      label="Phone Number"   value={employee.phoneNumber} />
              <InfoRow icon={<Calendar size={15} />}   label="Date of Birth"  value={employee.dateOfBirth} />
              <InfoRow icon={<User size={15} />}       label="Gender"         value={employee.gender} />
              <InfoRow icon={<CreditCard size={15} />} label="Identity Card"  value={employee.identityCard} />
              <InfoRow icon={<MapPin size={15} />}     label="Address"        value={employee.address} />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
