import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, ArrowLeft, X, Clapperboard, ShieldCheck, Info } from "lucide-react";
import { userApi } from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import { useIdentityCardAutofill } from "../../hooks/useIdentityCardAutofill";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  fullName: string;
  phoneNumber: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  gender: string;
  identityCard: string;
  address: string;
}

interface CompleteProfilePageProps {
  onClose?: () => void;
  onDone?:  () => void;
}

// ── Primitives ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{
      display: "block", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.06em", textTransform: "uppercase" as const,
      color: "rgba(255,255,255,0.4)", marginBottom: 6,
    }}>
      {children}
      {required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
    </label>
  );
}

function FieldHelper({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "flex", alignItems: "flex-start", gap: 5,
      fontSize: 11.5, color: "rgba(255,255,255,0.25)",
      marginTop: 5, lineHeight: 1.45,
    }}>
      <Info size={11} style={{ flexShrink: 0, marginTop: 1.5, opacity: 0.6 }} />
      {children}
    </span>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span style={{ display: "block", color: "#f87171", fontSize: 12, marginTop: 6, fontWeight: 500 }}>
      {msg}
    </span>
  );
}

function TextInput({
  name, value, onChange, placeholder, type = "text", hasError, rightElement, disabled,
}: {
  name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; hasError?: boolean;
  rightElement?: React.ReactNode; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        name={name} type={type} placeholder={placeholder} value={value}
        onChange={onChange} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", boxSizing: "border-box",
          background: focused ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${hasError ? "rgba(239,68,68,0.55)" : focused ? "rgba(59,130,246,0.65)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 12, padding: `12px ${rightElement ? "44px" : "14px"} 12px 14px`,
          color: "#fff", fontSize: 14, outline: "none",
          boxShadow: focused ? `0 0 0 3px ${hasError ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)"}` : "none",
          transition: "all 0.2s",
          opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "text",
        }}
      />
      {rightElement && (
        <div style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
          {rightElement}
        </div>
      )}
    </div>
  );
}

function SelectInput({
  name, value, onChange, options, placeholder, hasError,
}: {
  name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string; hasError?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      name={name} value={value} onChange={onChange}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", boxSizing: "border-box",
        background: focused ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
        border: `1.5px solid ${hasError ? "rgba(239,68,68,0.55)" : focused ? "rgba(59,130,246,0.65)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 12, padding: "12px 32px 12px 14px",
        color: value ? "#fff" : "rgba(255,255,255,0.25)",
        fontSize: 14, outline: "none", cursor: "pointer",
        boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
        appearance: "none" as any,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.25)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
        transition: "all 0.2s",
      }}
    >
      {placeholder && <option value="" disabled style={{ background: "#1c1c1e" }}>{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: "#1c1c1e", color: "#fff" }}>{o.label}</option>
      ))}
    </select>
  );
}

function GenderSelector({ value, onChange, hasError }: { value: string; onChange: (v: string) => void; hasError?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }].map(opt => {
        const active = value === opt.value;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
            flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: active ? 600 : 500,
            cursor: "pointer", transition: "all 0.15s",
            border: `1.5px solid ${active ? "rgba(59,130,246,0.65)" : hasError ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.1)"}`,
            background: active ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.04)",
            color: active ? "#93c5fd" : "rgba(255,255,255,0.4)",
            boxShadow: active ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
          }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Date options ──────────────────────────────────────────────────────────────

const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, "0") }));
const monthOptions = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => ({ value: String(i + 1), label: m }));
const yearOptions = Array.from({ length: new Date().getFullYear() - 1929 }, (_, i) => { const y = String(new Date().getFullYear() - i); return { value: y, label: y }; });

// ── Step config ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Personal",     desc: "Name, gender & date of birth" },
  { label: "Verification", desc: "Phone & identity card" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompleteProfilePage({ onClose, onDone }: CompleteProfilePageProps = {}) {
  const navigate = useNavigate();
  const { user, setNeedsProfileSetup } = useAuth();

  const [step, setStep] = useState(1);
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState<FormState>({
    fullName: "", phoneNumber: "", dobDay: "", dobMonth: "", dobYear: "",
    gender: "", identityCard: "", address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => (onClose ? onClose() : navigate(-1)), 200);
  };

  const { identityCardHint, parsedIdentityCard } = useIdentityCardAutofill(
    form.identityCard,
    (updater) => setForm(prev => typeof updater === "function" ? updater(prev) : { ...prev, ...updater })
  );

  const birthYearMismatch = parsedIdentityCard && form.dobYear && form.dobYear !== String(parsedIdentityCard.birthYear);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[name];
      if (["dobDay", "dobMonth", "dobYear"].includes(name)) delete next.dob;
      return next;
    });
  };

  const buildDob = () => {
    const y = Number(form.dobYear), m = Number(form.dobMonth), d = Number(form.dobDay);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "";
    return `${form.dobYear}-${form.dobMonth.padStart(2, "0")}-${form.dobDay.padStart(2, "0")}`;
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    else if (form.fullName.trim().length > 50) e.fullName = "Maximum 50 characters";
    if (!form.gender) e.gender = "Please select a gender";
    if (!form.dobDay || !form.dobMonth || !form.dobYear) e.dob = "Date of birth is required";
    else if (!buildDob()) e.dob = "Invalid date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!form.phoneNumber.trim()) e.phoneNumber = "Phone number is required";
    else if (!/^(0|\+84)[0-9]{9,10}$/.test(form.phoneNumber.trim())) e.phoneNumber = "Invalid Vietnamese phone number (e.g. 0901 234 567)";
    if (!form.identityCard.trim()) e.identityCard = "Identity card number is required";
    else if (!/^[0-9]{12}$/.test(form.identityCard.trim())) e.identityCard = "Must be exactly 12 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validateStep2()) return;
    if (!user?.accountId) { setGeneralError("Session expired. Please log in again."); return; }
    setLoading(true);
    try {
      await userApi.updateUser(user.accountId, {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        dateOfBirth: buildDob(),
        gender: form.gender,
        identityCard: form.identityCard.trim(),
        address: form.address.trim() || undefined,
      });
      setNeedsProfileSetup(false);
      if (onDone) onDone(); else navigate(-1);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to save profile. Please try again.";
      const low = msg.toLowerCase();
      if (low.includes("phone")) setErrors(prev => ({ ...prev, phoneNumber: msg }));
      else if (low.includes("identity")) setErrors(prev => ({ ...prev, identityCard: msg }));
      else setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Shared button style ───────────────────────────────────────────────────
  const primaryBtn: React.CSSProperties = {
    width: "100%", padding: "14px 0", borderRadius: 13, border: "none",
    cursor: "pointer", background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
    color: "#fff", fontSize: 15, fontWeight: 700,
    boxShadow: "0 4px 20px rgba(59,130,246,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "transform 0.15s, box-shadow 0.15s",
  };

  return (
    <>
      <style>{`
        @keyframes cpFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cpSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.975) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes spin      { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px 16px",
          animation: "cpFadeIn 0.18s ease both",
        }}
      >
        {/* ── Dialog ── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 500,
            background: "#131316",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 48px 120px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03) inset",
            overflow: "hidden",
            animation: "cpSlideUp 0.24s cubic-bezier(0.16,1,0.3,1) both",
            maxHeight: "calc(100svh - 40px)",
            overflowY: "auto",
            opacity: visible ? 1 : 0,
          }}
        >
          {/* Accent bar */}
          <div style={{ height: 3, background: "linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa)" }} />

          {/* ── Topbar ── */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: "rgba(59,130,246,0.14)",
                border: "1px solid rgba(59,130,246,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Clapperboard size={15} color="#60a5fa" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.01em" }}>
                CinePrime
              </span>
            </div>

            {/* Close */}
            <button
              onClick={handleClose}
              aria-label="Close"
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.4)", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: "24px 24px 28px" }}>

            {/* ── One-time setup notice ── */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 12, padding: "11px 14px", marginBottom: 24,
            }}>
              <ShieldCheck size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#bfdbfe", lineHeight: 1.4 }}>
                  One-time setup — you won't be asked again
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(147,197,253,0.55)", lineHeight: 1.4 }}>
                  Required by law to issue physical tickets at the counter. Your data is encrypted and used only for ticketing purposes.
                </p>
              </div>
            </div>

            {/* ── Step indicator ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
              {STEPS.map((s, i) => {
                const n = i + 1;
                const active = step === n;
                const done   = step > n;
                return (
                  <div key={n} style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      {/* Circle */}
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, transition: "all 0.25s",
                        background: done ? "#2563eb" : active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                        border: `1.5px solid ${done ? "#2563eb" : active ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.12)"}`,
                        color: done ? "#fff" : active ? "#93c5fd" : "rgba(255,255,255,0.3)",
                      }}>
                        {done ? <Check size={12} strokeWidth={3} /> : n}
                      </div>
                      {/* Label */}
                      <span style={{
                        fontSize: 12, fontWeight: active ? 700 : 500, transition: "color 0.25s",
                        color: active ? "#dbeafe" : done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                      }}>
                        {s.label}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 2, borderRadius: 99, background: "rgba(255,255,255,0.07)" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        background: done || active ? "#3b82f6" : "transparent",
                        width: done ? "100%" : active ? "50%" : "0%",
                        transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Step heading ── */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
                {step === 1 ? "Personal information" : "Contact & identity"}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                {step === 1 ? STEPS[0].desc : STEPS[1].desc}
              </p>
            </div>

            {/* ════ STEP 1 ════ */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                <div>
                  <FieldLabel required>Full name</FieldLabel>
                  <TextInput name="fullName" value={form.fullName} onChange={handleChange}
                    placeholder="e.g. Nguyen Van An" hasError={!!errors.fullName} />
                  <FieldHelper>As shown on your government-issued ID</FieldHelper>
                  <FieldError msg={errors.fullName} />
                </div>

                <div>
                  <FieldLabel required>Gender</FieldLabel>
                  <GenderSelector value={form.gender} hasError={!!errors.gender}
                    onChange={v => { setForm(prev => ({ ...prev, gender: v })); setErrors(prev => { const n = { ...prev }; delete n.gender; return n; }); }} />
                  <FieldError msg={errors.gender} />
                </div>

                <div>
                  <FieldLabel required>Date of birth</FieldLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr 1.4fr", gap: 8 }}>
                    <SelectInput name="dobDay"   value={form.dobDay}   onChange={handleChange} placeholder="Day"   hasError={!!errors.dob} options={dayOptions} />
                    <SelectInput name="dobMonth" value={form.dobMonth} onChange={handleChange} placeholder="Month" hasError={!!errors.dob} options={monthOptions} />
                    <SelectInput name="dobYear"  value={form.dobYear}  onChange={handleChange} placeholder="Year"  hasError={!!errors.dob} options={yearOptions} />
                  </div>
                  <FieldError msg={errors.dob} />
                </div>

                <button type="button" onClick={handleNext}
                  style={{ ...primaryBtn, marginTop: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(59,130,246,0.42)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.3)"; }}
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* ════ STEP 2 ════ */}
            {step === 2 && (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {generalError && (
                  <div style={{
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)",
                    borderRadius: 12, padding: "12px 14px", color: "#f87171", fontSize: 13, lineHeight: 1.5,
                  }}>
                    {generalError}
                  </div>
                )}

                <div>
                  <FieldLabel required>Phone number</FieldLabel>
                  <TextInput name="phoneNumber" type="tel" value={form.phoneNumber}
                    onChange={handleChange} placeholder="0901 234 567" hasError={!!errors.phoneNumber} />
                  <FieldHelper>For booking confirmation and ticket pickup notifications</FieldHelper>
                  <FieldError msg={errors.phoneNumber} />
                </div>

                <div>
                  <FieldLabel required>National ID (CCCD)</FieldLabel>
                  <TextInput
                    name="identityCard" value={form.identityCard}
                    onChange={handleChange} placeholder="12-digit number"
                    hasError={!!errors.identityCard}
                    rightElement={
                      parsedIdentityCard ? (
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check size={12} color="#22c55e" strokeWidth={2.5} />
                        </div>
                      ) : undefined
                    }
                  />
                  {parsedIdentityCard
                    ? <span style={{ display: "block", color: "#4ade80", fontSize: 12, marginTop: 6, fontWeight: 500 }}>✓ Valid ID detected</span>
                    : <FieldHelper>Required by law to issue a physical ticket at the cinema counter</FieldHelper>
                  }
                  {identityCardHint && !parsedIdentityCard && <FieldError msg={identityCardHint} />}
                  {birthYearMismatch && (
                    <span style={{ display: "block", color: "#fb923c", fontSize: 12, marginTop: 5, fontWeight: 500 }}>
                      ⚠ Birth year doesn't match ID — please double-check.
                    </span>
                  )}
                  <FieldError msg={errors.identityCard} />
                </div>

                <div>
                  <FieldLabel>
                    Address{" "}
                    <span style={{ fontWeight: 400, textTransform: "none" as const, letterSpacing: 0, color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                      (optional)
                    </span>
                  </FieldLabel>
                  <TextInput name="address" value={form.address} onChange={handleChange} placeholder="City, Province" />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setErrors({}); setGeneralError(null); }}
                    aria-label="Back to step 1"
                    style={{
                      width: 50, height: 50, flexShrink: 0, borderRadius: 13,
                      background: "rgba(255,255,255,0.05)",
                      border: "1.5px solid rgba(255,255,255,0.1)",
                      cursor: "pointer", color: "rgba(255,255,255,0.4)",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <button
                    type="submit" disabled={loading}
                    style={{
                      ...primaryBtn, flex: 1, width: "auto", height: 50, padding: 0,
                      background: loading ? "rgba(59,130,246,0.35)" : "linear-gradient(135deg, #2563eb, #3b82f6)",
                      color: loading ? "rgba(255,255,255,0.45)" : "#fff",
                      boxShadow: loading ? "none" : "0 4px 20px rgba(59,130,246,0.3)",
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(59,130,246,0.42)"; } }}
                    onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.3)"; } }}
                  >
                    {loading ? (
                      <>
                        <svg style={{ animation: "spin 0.75s linear infinite", width: 16, height: 16, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                          <path d="M12 2 A10 10 0 0 1 22 12" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Saving…
                      </>
                    ) : "Save & complete setup"}
                  </button>
                </div>
              </form>
            )}

            {/* ── Dismiss hint ── */}
            <p style={{ textAlign: "center", margin: "18px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.18)", lineHeight: 1.5 }}>
              Press <kbd style={{ padding: "1px 5px", borderRadius: 5, fontSize: 10.5, fontFamily: "monospace", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)" }}>Esc</kbd>
              {" "}or click outside to dismiss
            </p>

          </div>
        </div>
      </div>
    </>
  );
}
