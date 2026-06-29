import { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowLeft, Mail, Check, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useRegister } from "../../hooks/useRegister.ts";
import { authApi } from "../../api/authApi.ts";
import { useIdentityCardAutofill } from "../../hooks/useIdentityCardAutofill.ts";

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.5)",
        marginBottom: "6px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {children}
    </label>
  );
}

function FormInput({
  type = "text",
  placeholder,
  name,
  value,
  onChange,
  rightElement,
  error,
}: {
  type?: string;
  placeholder?: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rightElement?: React.ReactNode;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {error && (
        <span style={{ color: "#FF4B4B", fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 500 }}>
          {error}
        </span>
      )}
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: "#141414",
          border: `1px solid ${error ? "#FF4B4B" : focused ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "10px",
          padding: rightElement ? "12px 44px 12px 14px" : "12px 14px",
          color: "#ffffff",
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          boxShadow: focused
            ? error
              ? "0 0 0 3px rgba(255, 75, 75, 0.15)"
              : "0 0 0 3px rgba(59,130,246,0.12)"
            : "none",
        }}
      />
      {rightElement && (
        <div
          style={{
            position: "absolute",
            right: "14px",
            top: error ? "70%" : "50%",
            transform: "translateY(-50%)",
            transition: "top 0.2s ease",
          }}
        >
          {rightElement}
        </div>
      )}
    </div>
  );
}

function FormSelect({
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      {error && (
        <span style={{ color: "#FF4B4B", fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 500 }}>
          {error}
        </span>
      )}
      <select
        name={name}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: "#141414",
          border: `1px solid ${error ? "#FF4B4B" : focused ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "10px",
          padding: "12px 14px",
          color: value ? "#ffffff" : "rgba(255,255,255,0.3)",
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          boxSizing: "border-box",
          cursor: "pointer",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          boxShadow: focused
            ? error
              ? "0 0 0 3px rgba(255, 75, 75, 0.15)"
              : "0 0 0 3px rgba(59,130,246,0.12)"
            : "none",
          appearance: "none",
          WebkitAppearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
          paddingRight: "36px",
        }}
      >
        {placeholder && (
          <option value="" disabled style={{ color: "rgba(255,255,255,0.3)" }}>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: "#141414", color: "#ffffff" }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StepProgress({ current }: { current: 1 | 2 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "28px" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#3b82f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 800,
          color: "#ffffff",
          flexShrink: 0,
        }}
      >
        1
      </div>
      <div
        style={{
          flex: 1,
          height: 2,
          background: current === 2 ? "#3b82f6" : "rgba(255,255,255,0.08)",
          margin: "0 10px",
          transition: "background 0.4s ease",
        }}
      />
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: current === 2 ? "#3b82f6" : "transparent",
          border: `2px solid ${current === 2 ? "#3b82f6" : "rgba(255,255,255,0.15)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 800,
          color: current === 2 ? "#ffffff" : "rgba(255,255,255,0.3)",
          flexShrink: 0,
          transition: "all 0.3s ease",
        }}
      >
        2
      </div>
    </div>
  );
}

const submitButtonBase: React.CSSProperties = {
  width: "100%",
  color: "#ffffff",
  border: "none",
  borderRadius: "9999px",
  padding: "14px",
  fontSize: "15px",
  fontWeight: 700,
  fontFamily: "Inter, sans-serif",
  letterSpacing: "0.02em",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
};

const dayOptions = Array.from({ length: 31 }, (_, index) => {
  const day = String(index + 1);
  return { value: day, label: day.padStart(2, "0") };
});

const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const month = String(index + 1);
  return { value: month, label: month.padStart(2, "0") };
});

const yearOptions = Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) => {
  const year = String(new Date().getFullYear() - index);
  return { value: year, label: year };
});

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formPage, setFormPage] = useState<1 | 2>(1);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const {
    step,
    setStep,
    otp,
    setOtp,
    loading,
    resendLoading,
    resendMessage,
    countdown,
    errors,
    generalError,
    form,
    setForm,
    handleChange,
    handleInitiate,
    handleVerifyOtp,
    handleResendOtp,
  } = useRegister();

  const { identityCardHint, parsedIdentityCard } = useIdentityCardAutofill(form.identityCard, setForm);
  const birthYearWarning =
    parsedIdentityCard && form.dobYear && form.dobYear !== String(parsedIdentityCard.birthYear)
      ? "Birth year does not match the citizen ID. You can continue if your date of birth is correct."
      : null;

  // Backend field errors for account-info fields while on page 2 → go back to page 1
  useEffect(() => {
    if (formPage === 2 && (errors.fullName || errors.username || errors.email || errors.password)) {
      setFormPage(1);
    }
  }, [errors, formPage]);

  const handleChangeWrapped = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    handleChange(e);
    setLocalErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const [nextLoading, setNextLoading] = useState(false);

  const handleNextPage = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required";
    if (!form.username.trim()) errs.username = "Username is required";
    if (!form.email.trim()) errs.email = "Email is required";
    if (!form.password.trim()) errs.password = "Password is required";
    setLocalErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setNextLoading(true);
    try {
      await authApi.checkAvailability({ username: form.username, email: form.email });
      setFormPage(2);
    } catch (error: any) {
      const message = error.response?.data?.message || "";
      const low = message.toLowerCase();
      if (low.includes("username")) {
        setLocalErrors((prev) => ({ ...prev, username: message }));
      } else if (low.includes("email")) {
        setLocalErrors((prev) => ({ ...prev, email: message }));
      }
    } finally {
      setNextLoading(false);
    }
  };

  return (
    <>
      {/* ── Step 1A: Account Info ── */}
      {step === 1 && formPage === 1 && (
        <>
          <h2
            style={{
              color: "#ffffff",
              fontSize: "26px",
              fontWeight: 700,
              marginBottom: "6px",
              letterSpacing: "-0.01em",
            }}
          >
            Create account
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>
            Join CinePrime to book seats and manage your watchlist.
          </p>

          <StepProgress current={1} />

          <form onSubmit={handleNextPage}>
            <div style={{ marginBottom: "16px" }}>
              <FormLabel>Full Name</FormLabel>
              <FormInput
                name="fullName"
                placeholder="e.g. Alex Johnson"
                value={form.fullName}
                onChange={handleChangeWrapped}
                error={localErrors.fullName || errors.fullName}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
              <div>
                <FormLabel>Username</FormLabel>
                <FormInput
                  name="username"
                  placeholder="@yourname"
                  value={form.username}
                  onChange={handleChangeWrapped}
                  error={localErrors.username || errors.username}
                />
              </div>
              <div>
                <FormLabel>Email Address</FormLabel>
                <FormInput
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  value={form.email}
                  onChange={handleChangeWrapped}
                  error={localErrors.email || errors.email}
                />
              </div>
            </div>

            <div style={{ marginBottom: "28px" }}>
              <FormLabel>Password</FormLabel>
              <FormInput
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChangeWrapped}
                error={localErrors.password || errors.password}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: "rgba(255,255,255,0.35)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </div>

            <button
              type="submit"
              disabled={nextLoading}
              style={{
                ...submitButtonBase,
                background: nextLoading ? "rgba(59,130,246,0.5)" : "#3b82f6",
                cursor: nextLoading ? "not-allowed" : "pointer",
                boxShadow: nextLoading ? "none" : "0 4px 24px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2)",
              }}
              onMouseEnter={(e) => {
                if (!nextLoading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 32px rgba(59,130,246,0.45), 0 2px 12px rgba(59,130,246,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!nextLoading) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2)";
                }
              }}
            >
              {nextLoading ? "Checking..." : "Next →"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "22px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", fontWeight: 500, letterSpacing: "0.05em" }}>
                or
              </span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            <p style={{ textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>
              Already have an account?{" "}
              <Link
                to="/login"
                style={{ color: "#3b82f6", fontWeight: 700, textDecoration: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")}
              >
                Sign In
              </Link>
            </p>
          </form>
        </>
      )}

      {/* ── Step 1B: Personal Details ── */}
      {step === 1 && formPage === 2 && (
        <>
          <button
            onClick={() => setFormPage(1)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              marginBottom: "20px",
              padding: 0,
              fontSize: "14px",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>

          <h2
            style={{
              color: "#ffffff",
              fontSize: "26px",
              fontWeight: 700,
              marginBottom: "6px",
              letterSpacing: "-0.01em",
            }}
          >
            Personal details
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "24px" }}>
            Almost there — just a few more details.
          </p>

          <StepProgress current={2} />

          <form onSubmit={handleInitiate}>
            {generalError && (
              <div
                style={{
                  background: "rgba(255, 75, 75, 0.1)",
                  border: "1px solid rgba(255, 75, 75, 0.3)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  color: "#FF4B4B",
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "16px",
                  lineHeight: 1.4,
                }}
              >
                {generalError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
              <div>
                <FormLabel>Phone Number</FormLabel>
                <FormInput
                  type="tel"
                  name="phone"
                  placeholder="0901234567"
                  value={form.phone}
                  onChange={handleChange}
                  error={errors.phone}
                />
              </div>
              <div>
                <FormLabel>Identity Card</FormLabel>
                <FormInput
                  name="identityCard"
                  placeholder="Exactly 12 digits"
                  value={form.identityCard}
                  onChange={handleChange}
                  error={errors.identityCard}
                  rightElement={parsedIdentityCard ? <Check size={16} color="#22c55e" /> : undefined}
                />
                {identityCardHint && !parsedIdentityCard && (
                  <p style={{ color: "#FF4B4B", fontSize: "12px", lineHeight: 1.4, marginTop: "6px" }}>
                    {identityCardHint}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
              <div>
                <FormLabel>Date of Birth</FormLabel>
                {errors.dob && (
                  <span style={{ color: "#FF4B4B", fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 500 }}>
                    {errors.dob}
                  </span>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "0.85fr 0.95fr 1.2fr", gap: "8px" }}>
                  <FormSelect name="dobDay" value={form.dobDay} onChange={handleChange} placeholder="Day" options={dayOptions} />
                  <FormSelect name="dobMonth" value={form.dobMonth} onChange={handleChange} placeholder="Month" options={monthOptions} />
                  <FormSelect name="dobYear" value={form.dobYear} onChange={handleChange} placeholder="Year" options={yearOptions} />
                </div>
                {birthYearWarning && (
                  <p style={{ color: "#f59e0b", fontSize: "12px", lineHeight: 1.4, marginTop: "6px" }}>
                    {birthYearWarning}
                  </p>
                )}
              </div>
              <div>
                <FormLabel>Gender</FormLabel>
                <FormSelect
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  placeholder="Select gender"
                  error={errors.gender}
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                    { value: "Other", label: "Other" },
                  ]}
                />
              </div>
            </div>

            <div style={{ marginBottom: "28px" }}>
              <FormLabel>Address</FormLabel>
              <FormInput
                name="address"
                placeholder="City, Country"
                value={form.address}
                onChange={handleChange}
                error={errors.address}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...submitButtonBase,
                background: loading ? "rgba(59,130,246,0.5)" : "#3b82f6",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 24px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2)",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 32px rgba(59,130,246,0.45), 0 2px 12px rgba(59,130,246,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2)";
                }
              }}
            >
              {loading ? "Sending Code..." : "Continue"}
            </button>
          </form>
        </>
      )}

      {/* ── Step 2: OTP Verification ── */}
      {step === 2 && (
        <div style={{ animation: "popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <button
            onClick={() => setStep(1)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              marginBottom: "24px",
              padding: 0,
              fontSize: "14px",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                background: "rgba(59,130,246,0.1)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mail size={28} color="#3b82f6" />
            </div>
          </div>

          <h2 style={{ color: "#ffffff", fontSize: "28px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>
            Verify your email
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "14px",
              marginBottom: "32px",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            We've sent a 6-digit code to <br />
            <strong style={{ color: "white" }}>{form.email}</strong>
          </p>

          <form onSubmit={handleVerifyOtp}>
            {generalError && (
              <div
                style={{
                  background: "rgba(255, 75, 75, 0.1)",
                  border: "1px solid rgba(255, 75, 75, 0.3)",
                  borderRadius: "10px",
                  padding: "12px",
                  color: "#FF4B4B",
                  fontSize: "13px",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                {generalError}
              </div>
            )}

            <div style={{ marginBottom: "24px" }}>
              <input
                type="text"
                maxLength={6}
                placeholder="• • • • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                style={{
                  width: "100%",
                  background: "#141414",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  padding: "16px",
                  color: "#3b82f6",
                  fontSize: "28px",
                  textAlign: "center",
                  letterSpacing: "0.5em",
                  outline: "none",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...submitButtonBase,
                background: loading ? "rgba(59,130,246,0.5)" : "#3b82f6",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 24px rgba(59,130,246,0.35)",
              }}
            >
              {loading ? "Verifying..." : "Verify & Create Account"}
            </button>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px" }}>Didn't receive the code?</span>
              {countdown > 0 ? (
                <span style={{ color: "rgba(59,130,246,0.5)", fontSize: "14px", fontWeight: 700 }}>
                  Resend in {countdown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#3b82f6",
                    cursor: resendLoading ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    fontSize: "14px",
                    padding: 0,
                  }}
                >
                  {resendLoading ? "Sending..." : "Resend code"}
                </button>
              )}
            </div>

            {resendMessage && (
              <div
                style={{ marginTop: "12px", textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: "13px" }}
              >
                {resendMessage}
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === 3 && (
        <div
          style={{
            animation: "popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "20px 0",
          }}
        >
          <div
            style={{
              marginBottom: "24px",
              padding: "20px",
              background: "rgba(59, 130, 246, 0.08)",
              borderRadius: "50%",
            }}
          >
            <CheckCircle size={72} color="#3b82f6" strokeWidth={1.5} />
          </div>

          <h2
            style={{
              color: "#ffffff",
              fontSize: "32px",
              fontWeight: 800,
              marginBottom: "12px",
              letterSpacing: "-0.02em",
            }}
          >
            Welcome to CinePrime!
          </h2>

          <p
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "15px",
              marginBottom: "40px",
              lineHeight: 1.6,
              maxWidth: "340px",
            }}
          >
            Your account has been successfully created. Get ready to experience cinema like never before.
          </p>

          <button
            onClick={() => navigate("/login")}
            style={{
              width: "100%",
              background: "#3b82f6",
              color: "#ffffff",
              border: "none",
              borderRadius: "9999px",
              padding: "16px",
              fontSize: "16px",
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(59,130,246,0.35)",
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            Sign In to Your Account
          </button>
        </div>
      )}
    </>
  );
}
