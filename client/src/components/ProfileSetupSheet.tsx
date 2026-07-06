import { useState, useEffect } from "react";
import { X, ArrowRight, ArrowLeft, Check, Ticket, User, CreditCard } from "lucide-react";
import { userApi } from "../api/userApi";
import { useIdentityCardAutofill } from "../hooks/useIdentityCardAutofill";

// ── Primitives ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold tracking-[0.08em] uppercase text-white/40 mb-1.5 font-['Inter',sans-serif]">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="block text-red-400 text-[11.5px] mt-1.5 font-['Inter',sans-serif]">{msg}</span>;
}

function TextInput({
  name, value, onChange, placeholder, type = "text", hasError, rightElement, disabled
}: {
  name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; hasError?: boolean;
  rightElement?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        name={name} type={type} placeholder={placeholder} value={value}
        onChange={onChange} disabled={disabled}
        className={`w-full bg-white/5 border ${hasError ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ paddingRight: rightElement ? "40px" : "16px" }}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
  return (
    <div className="relative">
      <select
        name={name} value={value} onChange={onChange}
        className={`w-full bg-white/5 border ${hasError ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-3 py-3 text-[14px] ${value ? 'text-white' : 'text-white/20'} focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all appearance-none cursor-pointer`}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-[#121212] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 8L1 3h10z" />
        </svg>
      </div>
    </div>
  );
}

function GenderSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { value: "Male", label: "Male" },
    { value: "Female", label: "Female" },
    { value: "Other", label: "Other" },
  ];
  return (
    <div className="flex gap-2">
      {opts.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
              active 
                ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 border' 
                : 'bg-white/5 border-transparent text-white/40 border hover:bg-white/10 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Date options ──────────────────────────────────────────────────────────────

const DAY_OPTS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1), label: String(i + 1).padStart(2, "0"),
}));
const MONTH_OPTS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  .map((m, i) => ({ value: String(i + 1), label: m }));
const YEAR_OPTS = Array.from({ length: new Date().getFullYear() - 1929 }, (_, i) => {
  const y = String(new Date().getFullYear() - i);
  return { value: y, label: y };
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProfileSetupSheetProps {
  accountId: string;
  movieTitle: string;
  showtimeInfo: string;
  onClose: () => void;
  onComplete: () => void;
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

export default function ProfileSetupSheet({
  accountId, movieTitle, showtimeInfo, onClose, onComplete,
}: ProfileSetupSheetProps) {
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    fullName: "", phoneNumber: "",
    dobDay: "", dobMonth: "", dobYear: "",
    gender: "", identityCard: "", address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { identityCardHint, parsedIdentityCard } = useIdentityCardAutofill(
    form.identityCard,
    (updater) => setForm(prev => typeof updater === "function" ? updater(prev) : { ...prev, ...updater })
  );

  const birthYearMismatch =
    parsedIdentityCard && form.dobYear && form.dobYear !== String(parsedIdentityCard.birthYear);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[name];
      if (["dobDay","dobMonth","dobYear"].includes(name)) delete next.dob;
      return next;
    });
  };

  const buildDob = () => {
    const y = Number(form.dobYear), m = Number(form.dobMonth), d = Number(form.dobDay);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "";
    return `${form.dobYear}-${form.dobMonth.padStart(2,"0")}-${form.dobDay.padStart(2,"0")}`;
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
    else if (!/^(0|\+84)[0-9]{9,10}$/.test(form.phoneNumber.trim())) e.phoneNumber = "Invalid (e.g. 0901234567)";
    if (!form.identityCard.trim()) e.identityCard = "Identity card is required";
    else if (!/^[0-9]{12}$/.test(form.identityCard.trim())) e.identityCard = "Must be 12 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validateStep2()) return;

    setLoading(true);
    try {
      await userApi.updateUser(accountId, {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        dateOfBirth: buildDob(),
        gender: form.gender,
        identityCard: form.identityCard.trim(),
        address: form.address.trim() || undefined,
      });
      onComplete();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to save. Please try again.";
      const low = msg.toLowerCase();
      if (low.includes("phone")) setErrors(p => ({ ...p, phoneNumber: msg }));
      else if (low.includes("identity")) setErrors(p => ({ ...p, identityCard: msg }));
      else setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-md transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Sheet panel */}
      <div className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-[440px] bg-[#070b16] border-l border-blue-500/10 flex flex-col shadow-2xl transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}>

        {/* ── Header ──────────────────────────────────── */}
        <div className="pt-8 px-7 pb-6 shrink-0 relative overflow-hidden border-b border-blue-500/10 bg-gradient-to-b from-blue-500/[0.06] to-transparent">
          {/* Top row: title + close */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-blue-500 mb-1 font-['Inter',sans-serif]">
                Action Required
              </p>
              <h2 className="text-white text-2xl font-bold tracking-tight font-['Inter',sans-serif]">
                Complete Profile
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Movie context pill */}
          <div className="mt-6 flex items-center gap-3 bg-[#0c1220] border border-blue-500/10 rounded-2xl p-3.5 shadow-inner relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
               <Ticket size={20} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90 truncate font-['Inter',sans-serif]">
                {movieTitle}
              </p>
              <p className="text-[12px] text-white/40 mt-0.5 font-['Inter',sans-serif]">
                {showtimeInfo}
              </p>
            </div>
          </div>
          
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        </div>

        {/* ── Form area ───────────────────────────────────────── */}
        <div className="px-7 py-6 flex-1 flex flex-col">

          {/* Minimalist Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-white/10'} transition-colors duration-500`} />
            <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-white/10'} transition-colors duration-500`} />
          </div>

          <div className="flex items-center gap-3 mb-6">
             <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                {step === 1 ? <User size={14} /> : <CreditCard size={14} />}
             </div>
             <h3 className="text-[15px] font-medium text-white/90 font-['Inter',sans-serif]">
                {step === 1 ? "Personal Information" : "Contact & Identity"}
             </h3>
          </div>

          {/* ── Step 1 ── */}
          <div className={`transition-all duration-300 ${step === 1 ? 'opacity-100 translate-x-0 block' : 'opacity-0 -translate-x-4 hidden'}`}>
            <div className="flex flex-col gap-5">
              <div>
                <FieldLabel required>Full Name</FieldLabel>
                <TextInput
                  name="fullName" value={form.fullName} onChange={handleChange}
                  placeholder="e.g. Nguyen Van An" hasError={!!errors.fullName}
                />
                <FieldError msg={errors.fullName} />
              </div>

              <div>
                <FieldLabel required>Gender</FieldLabel>
                <GenderSelector
                  value={form.gender}
                  onChange={(v) => {
                    setForm(p => ({ ...p, gender: v }));
                    setErrors(p => { const n = { ...p }; delete n.gender; return n; });
                  }}
                />
                <FieldError msg={errors.gender} />
              </div>

              <div>
                <FieldLabel required>Date of Birth</FieldLabel>
                <div className="grid grid-cols-[1fr_1.2fr_1.3fr] gap-2.5">
                  <SelectInput name="dobDay" value={form.dobDay} onChange={handleChange}
                    placeholder="Day" hasError={!!errors.dob} options={DAY_OPTS} />
                  <SelectInput name="dobMonth" value={form.dobMonth} onChange={handleChange}
                    placeholder="Month" hasError={!!errors.dob} options={MONTH_OPTS} />
                  <SelectInput name="dobYear" value={form.dobYear} onChange={handleChange}
                    placeholder="Year" hasError={!!errors.dob} options={YEAR_OPTS} />
                </div>
                <FieldError msg={errors.dob} />
              </div>

              <div className="mt-4">
                <button
                  type="button" onClick={() => { if (validateStep1()) setStep(2); }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Step 2 ── */}
          <div className={`transition-all duration-300 ${step === 2 ? 'opacity-100 translate-x-0 block' : 'opacity-0 translate-x-4 hidden'}`}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {generalError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-[13px] leading-snug">
                  {generalError}
                </div>
              )}

              <div>
                <FieldLabel required>Phone Number</FieldLabel>
                <TextInput
                  name="phoneNumber" type="tel" value={form.phoneNumber}
                  onChange={handleChange} placeholder="0901 234 567"
                  hasError={!!errors.phoneNumber}
                />
                <FieldError msg={errors.phoneNumber} />
              </div>

              <div>
                <FieldLabel required>Identity Card (CCCD)</FieldLabel>
                <TextInput
                  name="identityCard" value={form.identityCard}
                  onChange={handleChange} placeholder="12-digit number"
                  hasError={!!errors.identityCard}
                  rightElement={
                    parsedIdentityCard ? (
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check size={12} className="text-green-500" strokeWidth={3} />
                      </div>
                    ) : undefined
                  }
                />
                {identityCardHint && !parsedIdentityCard && <FieldError msg={identityCardHint} />}
                {parsedIdentityCard && (
                  <span className="block text-green-400 text-[11.5px] mt-1.5 font-['Inter',sans-serif]">
                    ✓ Valid ID detected
                  </span>
                )}
                {birthYearMismatch && (
                  <span className="block text-orange-400 text-[11.5px] mt-1.5 font-['Inter',sans-serif]">
                    ⚠ Birth year doesn't match ID
                  </span>
                )}
                <FieldError msg={errors.identityCard} />
              </div>

              <div>
                <FieldLabel>
                  Address <span className="font-normal normal-case tracking-normal text-white/30 text-[10px] ml-1">(optional)</span>
                </FieldLabel>
                <TextInput
                  name="address" value={form.address} onChange={handleChange}
                  placeholder="City, Province"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => { setStep(1); setErrors({}); }}
                  className="w-12 h-12 shrink-0 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 text-blue-400/60 hover:text-blue-400 flex items-center justify-center transition-colors border border-blue-500/10"
                >
                  <ArrowLeft size={16} />
                </button>

                <button
                  type="submit" disabled={loading}
                  className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl transition-all ${
                    loading 
                      ? 'bg-blue-500/50 text-white/70 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-[0.98]'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : "Save & Continue"}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Footer note */}
        <div className="p-5 border-t border-blue-500/10 bg-[#070b16]">
          <p className="m-0 text-[11.5px] text-white/30 text-center leading-relaxed font-['Inter',sans-serif]">
            Your personal information is securely stored and <br/> used only for official ticket issuance.
          </p>
        </div>
      </div>
    </>
  );
}
