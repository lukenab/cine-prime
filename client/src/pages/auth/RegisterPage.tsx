import { useState } from "react";
import { Eye, EyeOff, ArrowLeft, Mail, CheckCircle, Check } from "lucide-react";

import { Link, useNavigate } from "react-router-dom";
import { useRegister } from "../../hooks/useRegister.ts";
import GoogleSignInButton from "../../components/auth/GoogleSignInButton";
import { useAuth } from "../../context/AuthContext";
import { defaultPathForRole } from "../../utils/roleRoutes";

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
        <span
          style={{
            color: "#FF4B4B",
            fontSize: "12px",
            display: "block",
            marginBottom: "6px",
            fontWeight: 500,
          }}
        >
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
          }}
        >
          {rightElement}
        </div>
      )}
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

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();

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
    handleChange,
    handleInitiate,
    handleVerifyOtp,
    handleResendOtp,
  } = useRegister();

  const handleGoogleCredential = async (credential: string) => {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const { role } = await loginWithGoogle(credential);
      navigate(defaultPathForRole(role), { replace: true });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      setGoogleError(code === 1038
        ? "An account already uses this email. Sign in with your password first."
        : "Google registration could not be completed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      {/* ── Step 1: Account Info ── */}
      {step === 1 && (
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
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "14px",
              marginBottom: "28px",
              lineHeight: 1.5,
            }}
          >
            Join CinePrime to book seats and manage your watchlist.
          </p>

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

            <div style={{ marginBottom: "16px" }}>
              <FormLabel>Username</FormLabel>
              <FormInput
                name="username"
                placeholder="@yourname"
                value={form.username}
                onChange={handleChange}
                error={errors.username}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <FormLabel>Email Address</FormLabel>
              <FormInput
                type="email"
                name="email"
                placeholder="you@email.com"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <FormLabel>Password</FormLabel>
              <FormInput
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
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

            <div style={{ marginBottom: "24px" }}>
              <FormLabel>Confirm Password</FormLabel>
              <FormInput
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                rightElement={
                  form.confirmPassword && form.password === form.confirmPassword
                    ? (
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: "rgba(34,197,94,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Check size={11} color="#22c55e" strokeWidth={2.5} />
                      </div>
                    )
                    : undefined
                }
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...submitButtonBase,
                background: loading ? "rgba(59,130,246,0.5)" : "#3b82f6",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading
                  ? "none"
                  : "0 4px 24px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2)",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 32px rgba(59,130,246,0.45), 0 2px 12px rgba(59,130,246,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 24px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2)";
                }
              }}
            >
              {loading ? "Sending OTP..." : "Continue"}
            </button>

            <div className="flex items-center gap-3" style={{ margin: "22px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            {googleError && (
              <div style={{ color: "#ff6b6b", fontSize: 12, lineHeight: 1.5, marginBottom: 12, textAlign: "center" }}>
                {googleError}
              </div>
            )}
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              iconOnly
              disabled={loading || googleLoading}
            />

            <p style={{ textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.4)", marginTop: 20 }}>
              Already have an account?{" "}
              <Link
                to="/login"
                style={{ color: "#3b82f6", fontWeight: 700, textDecoration: "none" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")
                }
              >
                Sign In
              </Link>
            </p>
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

          <h2
            style={{
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: 700,
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
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
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px" }}>
                Didn't receive the code?
              </span>
              {countdown > 0 ? (
                <span
                  style={{ color: "rgba(59,130,246,0.5)", fontSize: "14px", fontWeight: 700 }}
                >
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
                style={{
                  marginTop: "12px",
                  textAlign: "center",
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "13px",
                }}
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
            Your account has been successfully created. Get ready to experience
            cinema like never before.
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
