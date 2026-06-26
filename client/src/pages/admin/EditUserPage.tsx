import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { userApi } from "../../api/userApi";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  role: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  identityCard: string;
  address: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

const INITIAL: FormData = {
  role: "USER", fullName: "", username: "", email: "", password: "",
  phoneNumber: "", gender: "MALE", dateOfBirth: "", identityCard: "", address: "",
};

// ── Validation ────────────────────────────────────────────────────────────────
function validate(data: FormData): FormErrors {
  const e: FormErrors = {};
  if (!data.fullName.trim())                          e.fullName     = "Full name is required.";
  if (data.password && data.password.length < 6)     e.password     = "Password must be at least 6 characters.";
  if (data.phoneNumber && !/^0[35789][0-9]{8}$/.test(data.phoneNumber))
                                                      e.phoneNumber  = "Invalid Vietnamese phone number.";
  if (data.identityCard && !/^[0-9]{12}$/.test(data.identityCard))
                                                      e.identityCard = "CCCD must be exactly 12 digits.";
  return e;
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "20px", paddingBottom: "12px", borderBottom: "1px solid var(--border-color)" }}>
        {title}
      </h2>
      <div style={{ display: "grid", gap: "16px" }}>{children}</div>
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

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 13px", borderRadius: "10px", fontSize: "14px",
  outline: "none", transition: "border-color 0.15s",
  background: "var(--bg-card)", color: "var(--text-main)",
  border: `1px solid ${hasError ? "#ef4444" : "var(--border-color)"}`,
  boxSizing: "border-box",
});

const disabledInputStyle: React.CSSProperties = {
  ...inputStyle(),
  opacity: 0.5,
  cursor: "not-allowed",
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  const [form, setForm]                 = useState<FormData>(INITIAL);
  const [errors, setErrors]             = useState<FormErrors>({});
  const [fetching, setFetching]         = useState(true);
  const [fetchError, setFetchError]     = useState("");
  const [submitError, setSubmitError]   = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Load existing data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setFetching(true);
    Promise.all([
      userApi.getAllUsers(1, 1000).catch(() => ({ result: { data: [] } })),
      authApi.getAllAccounts().catch(() => ({ result: [] })),
    ])
      .then(([userRes, authRes]) => {
        const profiles = userRes?.result?.data || [];
        const accounts = authRes?.result || [];
        const profile  = profiles.find((p: any) => p.accountId === id) || {};
        const account  = accounts.find((a: any) => a.accountId === id);
        if (!account) { setFetchError("User not found."); return; }

        const rawRole = account?.roles?.[0]?.name || "USER";
        setForm({
          role:          String(rawRole).toUpperCase(),
          fullName:      profile.fullName     || "",
          username:      account.username     || "",
          email:         account.email        || "",
          password:      "",
          phoneNumber:   profile.phoneNumber  || "",
          gender:        profile.gender       || "MALE",
          dateOfBirth:   profile.dateOfBirth  || "",
          identityCard:  profile.identityCard || "",
          address:       profile.address      || "",
        });
      })
      .catch(() => setFetchError("Failed to load user data."))
      .finally(() => setFetching(false));
  }, [id]);

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      const payload: any = { ...form };
      if (!payload.password || payload.password.trim() === "") delete payload.password;
      await authApi.updateAccount(id, payload);
      navigate(`/admin/users/${id}`);
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || err.message || "Update failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="flex items-center justify-center" style={{ height: "220px" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: `${accentColor} transparent transparent transparent` }} />
      </div>
    );
  }
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ height: "220px", color: "var(--text-sub)" }}>
        <p style={{ fontSize: "14px" }}>{fetchError}</p>
        <button onClick={() => navigate("/admin/users")}
          className="px-4 py-2 rounded-xl border text-sm hover:opacity-80"
          style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
          Back to Users
        </button>
      </div>
    );
  }

  const initials = form.fullName
    ? form.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : form.username.slice(0, 2).toUpperCase();

  return (
    <form onSubmit={handleSubmit} style={{ fontFamily: "Inter, sans-serif" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4" style={{ marginBottom: "28px" }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(`/admin/users/${id}`)}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:opacity-80 transition-all"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "3px" }}>
              Edit Customer
            </h1>
            <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
              Editing: <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{form.fullName || form.username}</span>
            </p>
          </div>
        </div>

        <div />
      </div>

      {/* Global submit error */}
      {submitError && (
        <div className="mb-5 p-3.5 rounded-xl border text-sm font-medium"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
          {submitError}
        </div>
      )}

      {/* ── Single card ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>

        {/* Profile banner */}
        <div className="flex items-center gap-5 px-8 py-6"
          style={{ background: isDarkMode ? "rgba(59,130,246,0.06)" : "rgba(37,99,235,0.04)", borderBottom: "1px solid var(--border-color)" }}>
          <div className="w-[72px] h-[72px] rounded-full flex-shrink-0 flex items-center justify-center text-white text-2xl font-bold"
            style={{ background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-main)", marginBottom: "3px" }}>
              {form.fullName || form.username || "—"}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{form.email}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: accentColor + "18", color: accentColor }}>
            {form.role === "MEMBER" ? "Member" : "User"}
          </span>
        </div>

        <div style={{ padding: "28px 32px", display: "grid", gap: "28px" }}>

          {/* ── Account Information ── */}
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: "18px" }}>
              <span className="w-1 h-4 rounded-full" style={{ background: accentColor }} />
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Account Information
              </p>
            </div>
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <FormField label="Role" required>
                  <select value={form.role} onChange={(e) => update("role", e.target.value)}
                    style={{ ...inputStyle(), appearance: "none" }}>
                    <option value="USER"   style={{ background: "var(--bg-card)" }}>User</option>
                    <option value="MEMBER" style={{ background: "var(--bg-card)" }}>Member</option>
                  </select>
                </FormField>
                <FormField label="Username" hint="Cannot be changed.">
                  <input type="text" value={form.username} disabled style={disabledInputStyle} />
                </FormField>
                <FormField label="Password" error={errors.password} hint="Blank = keep current.">
                  <input type="password" placeholder="Leave blank to keep current"
                    value={form.password} onChange={(e) => update("password", e.target.value)}
                    autoComplete="new-password" style={inputStyle(!!errors.password)} />
                </FormField>
              </div>
              <FormField label="Email" hint="Cannot be changed here — requires a dedicated OTP verification flow.">
                <input type="email" value={form.email} disabled style={disabledInputStyle} />
              </FormField>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--border-color)" }} />

          {/* ── Personal Information ── */}
          <div style={{ paddingBottom: "4px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: "18px" }}>
              <span className="w-1 h-4 rounded-full" style={{ background: "#10b981" }} />
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Personal Information
              </p>
            </div>
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <FormField label="Full Name" required error={errors.fullName}>
                  <input type="text" placeholder="e.g. Nguyen Van An"
                    value={form.fullName} onChange={(e) => update("fullName", e.target.value)}
                    style={inputStyle(!!errors.fullName)} />
                </FormField>
                <FormField label="Phone Number" error={errors.phoneNumber}>
                  <input type="text" placeholder="0912345678"
                    value={form.phoneNumber} onChange={(e) => update("phoneNumber", e.target.value)}
                    style={inputStyle(!!errors.phoneNumber)} />
                </FormField>
                <FormField label="Gender">
                  <select value={form.gender} onChange={(e) => update("gender", e.target.value)}
                    style={{ ...inputStyle(), appearance: "none" }}>
                    <option value="MALE"   style={{ background: "var(--bg-card)" }}>Male</option>
                    <option value="FEMALE" style={{ background: "var(--bg-card)" }}>Female</option>
                    <option value="OTHER"  style={{ background: "var(--bg-card)" }}>Other</option>
                  </select>
                </FormField>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <FormField label="Date of Birth">
                  <input type="date" value={form.dateOfBirth}
                    onChange={(e) => update("dateOfBirth", e.target.value)}
                    style={inputStyle()} />
                </FormField>
                <FormField label="Identity Card (CCCD)" error={errors.identityCard}>
                  <input type="text" placeholder="12-digit CCCD"
                    value={form.identityCard} onChange={(e) => update("identityCard", e.target.value)}
                    style={inputStyle(!!errors.identityCard)} />
                </FormField>
                <FormField label="Address">
                  <input type="text" placeholder="Full address"
                    value={form.address} onChange={(e) => update("address", e.target.value)}
                    style={inputStyle()} />
                </FormField>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3" style={{ marginTop: "20px", paddingBottom: "32px" }}>
        <button type="button" onClick={() => navigate("/admin/users")}
          className="px-6 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
          style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-60"
          style={{ background: accentColor }}>
          <Save size={15} />
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <style>{`.theme-dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
    </form>
  );
}
