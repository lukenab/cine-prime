import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Building2, Lock, ShieldAlert, Info, Save, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CinemaInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxCode: string;
  openTime: string;
  closeTime: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type PasswordErrors = Partial<Record<keyof PasswordForm, string>>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function validatePassword(form: PasswordForm): PasswordErrors {
  const e: PasswordErrors = {};
  if (!form.currentPassword)            e.currentPassword = "Current password is required.";
  if (!form.newPassword)                e.newPassword     = "New password is required.";
  else if (form.newPassword.length < 8) e.newPassword     = "Password must be at least 8 characters.";
  else if (!/[A-Z]/.test(form.newPassword)) e.newPassword = "Must contain at least one uppercase letter.";
  else if (!/[0-9]/.test(form.newPassword)) e.newPassword = "Must contain at least one number.";
  if (form.newPassword && form.confirmPassword && form.newPassword !== form.confirmPassword)
    e.confirmPassword = "Passwords do not match.";
  if (!form.confirmPassword) e.confirmPassword = "Please confirm your new password.";
  return e;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description: string;
}) {
  return (
    <div className="flex items-start gap-3" style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--border-color)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(59,130,246,0.1)" }}>
        <Icon size={16} style={{ color: "#3b82f6" }} />
      </div>
      <div>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)", marginBottom: "3px" }}>{title}</p>
        <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{description}</p>
      </div>
    </div>
  );
}

function FormField({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-sub)", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
      </label>
      {children}
      {hint  && !error && <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "5px" }}>{hint}</p>}
      {error && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "5px" }}>{error}</p>}
    </div>
  );
}

const inputBase = (hasError?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 13px", borderRadius: "10px", fontSize: "14px",
  outline: "none", transition: "border-color 0.15s",
  background: "var(--bg-card)", color: "var(--text-main)",
  border: `1px solid ${hasError ? "#ef4444" : "var(--border-color)"}`,
  boxSizing: "border-box",
});

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
export default function SettingsPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  // ── Cinema Info state ──────────────────────────────────────────────────────
  const [cinema, setCinema] = useState<CinemaInfo>({
    name:      "CinePrime",
    address:   "123 Nguyen Hue, Quan 1, TP. Ho Chi Minh",
    phone:     "028 3822 1234",
    email:     "contact@cineprime.vn",
    website:   "https://cineprime.vn",
    taxCode:   "0312345678",
    openTime:  "08:00",
    closeTime: "23:30",
  });
  const [savingCinema, setSavingCinema] = useState(false);

  // ── Password state ─────────────────────────────────────────────────────────
  const [pwForm, setPwForm]     = useState<PasswordForm>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwErrors, setPwErrors] = useState<PasswordErrors>({});
  const [showPw, setShowPw]     = useState({ current: false, new: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  // ── Security Policy state ──────────────────────────────────────────────────
  const [maxAttempts, setMaxAttempts]       = useState(5);
  const [lockoutDuration, setLockoutDuration] = useState(15);
  const [savingPolicy, setSavingPolicy]     = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const updateCinema = (field: keyof CinemaInfo, value: string) =>
    setCinema((prev) => ({ ...prev, [field]: value }));

  const handleSaveCinema = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCinema(true);
    try {
      // TODO: await api.put("/settings/cinema", cinema);
      await new Promise((res) => setTimeout(res, 700));
      showToast("success", "Cinema information saved successfully.");
    } catch {
      showToast("error", "Failed to save cinema information.");
    } finally {
      setSavingCinema(false);
    }
  };

  const updatePw = (field: keyof PasswordForm, value: string) => {
    setPwForm((prev) => ({ ...prev, [field]: value }));
    if (pwErrors[field]) setPwErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validatePassword(pwForm);
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }
    setSavingPw(true);
    try {
      // TODO: await authApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      await new Promise((res) => setTimeout(res, 700));
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("success", "Password changed successfully.");
    } catch {
      showToast("error", "Current password is incorrect.");
    } finally {
      setSavingPw(false);
    }
  };

  const PasswordInput = ({
    field, placeholder,
  }: { field: keyof typeof showPw; placeholder: string }) => (
    <div className="relative">
      <input
        type={showPw[field] ? "text" : "password"}
        placeholder={placeholder}
        value={pwForm[field === "current" ? "currentPassword" : field === "new" ? "newPassword" : "confirmPassword"]}
        onChange={(e) => updatePw(
          field === "current" ? "currentPassword" : field === "new" ? "newPassword" : "confirmPassword",
          e.target.value,
        )}
        autoComplete="new-password"
        style={{ ...inputBase(!!pwErrors[field === "current" ? "currentPassword" : field === "new" ? "newPassword" : "confirmPassword"]), paddingRight: "44px" }}
      />
      <button type="button" onClick={() => setShowPw((p) => ({ ...p, [field]: !p[field] }))}
        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
        style={{ color: "var(--text-sub)" }}>
        {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );

  return (
    <>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* ── Page header ── */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Settings
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>Manage cinema information and account security.</p>
      </div>

      <div style={{ display: "grid", gap: "20px", paddingBottom: "40px" }}>

        {/* ── Cinema Information ── */}
        <form onSubmit={handleSaveCinema}
          className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <SectionHeader icon={Building2} title="Cinema Information"
            description="Basic details about your cinema displayed to customers and on tickets." />

          <div style={{ display: "grid", gap: "16px" }}>
            {/* Row 1: Name (full width) */}
            <FormField label="Cinema Name" required>
              <input type="text" value={cinema.name} onChange={(e) => updateCinema("name", e.target.value)}
                placeholder="e.g. CinePrime" style={inputBase()} />
            </FormField>

            {/* Row 2: Address (full width) */}
            <FormField label="Address" required>
              <input type="text" value={cinema.address} onChange={(e) => updateCinema("address", e.target.value)}
                placeholder="Full address" style={inputBase()} />
            </FormField>

            {/* Row 3: Phone + Email */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <FormField label="Phone Number" required>
                <input type="tel" value={cinema.phone} onChange={(e) => updateCinema("phone", e.target.value)}
                  placeholder="028 xxxx xxxx" style={inputBase()} />
              </FormField>
              <FormField label="Email" required>
                <input type="email" value={cinema.email} onChange={(e) => updateCinema("email", e.target.value)}
                  placeholder="contact@cinema.vn" style={inputBase()} />
              </FormField>
            </div>

            {/* Row 4: Website + Tax Code */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <FormField label="Website">
                <input type="url" value={cinema.website} onChange={(e) => updateCinema("website", e.target.value)}
                  placeholder="https://cinema.vn" style={inputBase()} />
              </FormField>
              <FormField label="Tax Code (Mã số thuế)">
                <input type="text" value={cinema.taxCode} onChange={(e) => updateCinema("taxCode", e.target.value)}
                  placeholder="10-digit tax code" style={inputBase()} />
              </FormField>
            </div>

            {/* Row 5: Open + Close time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <FormField label="Opening Time" hint="First showtime of the day">
                <input type="time" value={cinema.openTime} onChange={(e) => updateCinema("openTime", e.target.value)}
                  style={inputBase()} />
              </FormField>
              <FormField label="Closing Time" hint="Last entry allowed">
                <input type="time" value={cinema.closeTime} onChange={(e) => updateCinema("closeTime", e.target.value)}
                  style={inputBase()} />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
            <button type="submit" disabled={savingCinema}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: accentColor }}>
              <Save size={15} />
              {savingCinema ? "Saving..." : "Save Cinema Info"}
            </button>
          </div>
        </form>

        {/* ── Security ── */}
        <form onSubmit={handleSavePassword}
          className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <SectionHeader icon={Lock} title="Security"
            description="Change your admin account password. Use a strong password with uppercase, lowercase, and numbers." />

          <div style={{ display: "grid", gap: "16px", maxWidth: "480px" }}>
            <FormField label="Current Password" required error={pwErrors.currentPassword}>
              <PasswordInput field="current" placeholder="Enter current password" />
            </FormField>
            <FormField label="New Password" required error={pwErrors.newPassword}
              hint="At least 8 characters, 1 uppercase letter, 1 number.">
              <PasswordInput field="new" placeholder="Enter new password" />
            </FormField>
            <FormField label="Confirm New Password" required error={pwErrors.confirmPassword}>
              <PasswordInput field="confirm" placeholder="Re-enter new password" />
            </FormField>
          </div>

          <div className="flex justify-end" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
            <button type="submit" disabled={savingPw}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: accentColor }}>
              <Lock size={15} />
              {savingPw ? "Saving..." : "Change Password"}
            </button>
          </div>
        </form>

        {/* ── Security Policy ── */}
        <form onSubmit={async (e) => {
          e.preventDefault();
          setSavingPolicy(true);
          // TODO: await api.put("/settings/security-policy", { maxAttempts, lockoutDuration });
          await new Promise((res) => setTimeout(res, 600));
          setSavingPolicy(false);
          showToast("success", "Security policy saved.");
        }}
          className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <SectionHeader icon={ShieldAlert} title="Security Policy"
            description="Configure login attempt limits and account lockout behaviour." />

          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl mb-6"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertCircle size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontSize: "13px", color: "#d97706", lineHeight: 1.6 }}>
              These settings require corresponding backend configuration (Spring Security + Redis) to take effect.
              Saving here records the intended policy — a backend engineer must wire it up before it is enforced.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", maxWidth: "560px" }}>
            {/* Max failed attempts */}
            <FormField label="Max Failed Login Attempts"
              hint="Account is locked after this many consecutive wrong passwords.">
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setMaxAttempts((v) => Math.max(1, v - 1))}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center text-lg font-medium hover:opacity-80 transition-all flex-shrink-0"
                  style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
                  −
                </button>
                <div className="flex-1 text-center py-2.5 rounded-xl border"
                  style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
                  {maxAttempts}
                  <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-sub)", display: "block", marginTop: "-2px" }}>
                    attempts
                  </span>
                </div>
                <button type="button"
                  onClick={() => setMaxAttempts((v) => Math.min(20, v + 1))}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center text-lg font-medium hover:opacity-80 transition-all flex-shrink-0"
                  style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
                  +
                </button>
              </div>
            </FormField>

            {/* Lockout duration */}
            <FormField label="Lockout Duration"
              hint="How long the account stays locked before automatically unlocking.">
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setLockoutDuration((v) => Math.max(1, v - 5))}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center text-lg font-medium hover:opacity-80 transition-all flex-shrink-0"
                  style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
                  −
                </button>
                <div className="flex-1 text-center py-2.5 rounded-xl border"
                  style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
                  {lockoutDuration}
                  <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-sub)", display: "block", marginTop: "-2px" }}>
                    minutes
                  </span>
                </div>
                <button type="button"
                  onClick={() => setLockoutDuration((v) => Math.min(1440, v + 5))}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center text-lg font-medium hover:opacity-80 transition-all flex-shrink-0"
                  style={{ background: "transparent", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
                  +
                </button>
              </div>
            </FormField>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-2 mt-5 p-3.5 rounded-xl"
            style={{ background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-color)" }}>
            <ShieldAlert size={14} style={{ color: "var(--text-sub)", flexShrink: 0 }} />
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Account will be locked for{" "}
              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{lockoutDuration} minutes</span>
              {" "}after{" "}
              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{maxAttempts} consecutive</span>
              {" "}failed login attempts.
            </p>
          </div>

          <div className="flex justify-end" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
            <button type="submit" disabled={savingPolicy}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: accentColor }}>
              <Save size={15} />
              {savingPolicy ? "Saving..." : "Save Policy"}
            </button>
          </div>
        </form>

        {/* ── About ── */}
        <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <SectionHeader icon={Info} title="About"
            description="System information and version details." />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
            {[
              ["Application",    "CinePrime Management System"],
              ["Version",        "1.0.0-beta"],
              ["Build",          "2026.06 · Sprint 2"],
              ["Frontend",       "React 18 + TypeScript + Vite"],
              ["Backend",        "Spring Boot 3 · Microservices"],
              ["Database",       "PostgreSQL 16"],
              ["Auth",           "JWT · Spring Security"],
              ["Deployed on",    "On-premise / Docker"],
            ].map(([label, value], i) => (
              <div key={label}
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderBottom: i < 6 ? "1px solid var(--border-color)" : "none",
                  borderRight: i % 2 === 0 ? "1px solid var(--border-color)" : "none",
                }}>
                <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
