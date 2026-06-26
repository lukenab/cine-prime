import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowLeft, User, Mail, Phone, MapPin, CreditCard,
  Calendar, Shield, Clock, Copy, Check, Briefcase, Building2, Hash,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EmployeeDetail {
  // Account (auth-service)
  accountId: string;
  username: string;
  email: string;
  status: number;
  createdAt: string;
  roles: { roleName: string }[];
  // Profile (user-service)
  fullName: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  identityCard: string;
  address: string;
  // Employee-specific (employee-service)
  employeeCode: string;
  department: string;
  position: string;
  hireDate: string;
}

// ── Mock data — replace with API calls when employee-service is ready ─────────
const MOCK_EMPLOYEE: EmployeeDetail = {
  accountId: "abc-123-def",
  username: "an.nguyen",
  email: "an.nguyen@cineprime.vn",
  status: 1,
  createdAt: "2024-01-15T08:00:00",
  roles: [{ roleName: "EMPLOYEE" }],
  fullName: "Nguyen Van An",
  phoneNumber: "0912 345 678",
  gender: "MALE",
  dateOfBirth: "1998-04-22",
  identityCard: "012345678901",
  address: "123 Nguyen Hue, District 1, HCMC",
  employeeCode: "EMP001",
  department: "Box Office",
  position: "Ticket Agent",
  hireDate: "2024-01-15",
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #3b82f6, #6366f1)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #f97316, #f59e0b)",
];

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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API calls
        // const [authRes, profileRes, empRes] = await Promise.all([
        //   authApi.getAccountById(id),
        //   userApi.getUserById(id),
        //   employeeApi.getEmployeeByAccountId(id),
        // ]);
        await new Promise((r) => setTimeout(r, 400)); // simulate network
        setEmployee({ ...MOCK_EMPLOYEE, accountId: id });
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load employee details.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const accentColor   = isDarkMode ? "#3b82f6" : "#2563eb";
  const initials      = employee?.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "??";
  const avatarGradient = AVATAR_GRADIENTS[(id?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length];
  const isActive      = employee?.status === 1;

  return (
    <div>
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
          <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
            Employee Detail
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Account, profile, and employment information</p>
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
              <p style={{ fontSize: "13px", color: "var(--text-sub)", marginBottom: "4px" }}>
                @{employee.username}
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "12px" }}>
                {employee.position} · {employee.department}
              </p>

              {/* Status */}
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
                style={{
                  background: isActive ? "rgba(16,185,129,0.08)" : "rgba(107,114,128,0.08)",
                  color: isActive ? "#059669" : "#6b7280",
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                {isActive ? "Active" : "Inactive"}
              </span>

              {/* Role badge */}
              <div className="w-full">
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Role</p>
                {employee.roles.map((r) => (
                  <span
                    key={r.roleName}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-xs font-medium"
                    style={{ background: "rgba(59,130,246,0.08)", color: "#2563eb", borderColor: "rgba(59,130,246,0.2)" }}
                  >
                    <Shield size={10} /> {r.roleName}
                  </span>
                ))}
              </div>
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
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "16px" }}>Department, position, and tenure data</p>
              <InfoRow icon={<Hash size={15} />}       label="Employee Code" value={employee.employeeCode} />
              <InfoRow icon={<Building2 size={15} />}  label="Department"    value={employee.department} />
              <InfoRow icon={<Briefcase size={15} />}  label="Position"      value={employee.position} />
              <InfoRow icon={<Calendar size={15} />}   label="Hire Date"     value={employee.hireDate} />
            </div>

            {/* Account Info */}
            <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Account Information</h2>
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "16px" }}>Login credentials from Auth Service</p>
              <CopyableId icon={<User size={15} />}   label="Account ID" value={employee.accountId} />
              <InfoRow icon={<User size={15} />}      label="Username"   value={employee.username} />
              <InfoRow icon={<Mail size={15} />}      label="Email"      value={employee.email} />
              <InfoRow icon={<Clock size={15} />}     label="Created At" value={new Date(employee.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} />
            </div>

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
