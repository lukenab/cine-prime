import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/authApi";

// Issue #161/#162 — employee sets their own password using the single-use token
// from the activation email sent when an admin created their account.
export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to /login a moment after a successful activation
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => navigate("/login", { replace: true }), 1800);
    return () => clearTimeout(t);
  }, [success, navigate]);

  const fieldBorder = (field: string) =>
    focusedField === field ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.1)";
  const fieldShadow = (field: string) =>
    focusedField === field ? "0 0 0 3px rgba(59,130,246,0.12)" : "0 0 0 0 rgba(59,130,246,0)";

  const inputBaseStyle: React.CSSProperties = {
    background: "#141414",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    width: "100%",
    boxSizing: "border-box",
  };

  // No token in the URL at all — nothing to call the API with.
  if (!token) {
    return (
      <div style={{ animation: "activateFadeIn 0.5s ease both" }}>
        <style>{`@keyframes activateFadeIn { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
        <div className="mb-6">
          <h2 className="mb-2" style={{ color: "#ffffff", fontSize: "30px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Invalid activation link
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", lineHeight: 1.6 }}>
            This link is missing its activation token. Please use the link from your
            activation email, or ask your admin to resend it.
          </p>
        </div>
        <Link to="/login" style={{ color: "#3b82f6", fontSize: "14px", fontWeight: 500, textDecoration: "none" }}>
          ← Back to login
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ animation: "activateFadeIn 0.5s ease both" }}>
        <style>{`@keyframes activateFadeIn { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(5,150,105,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={28} color="#059669" />
          </div>
          <h2 style={{ color: "#ffffff", fontSize: "24px", fontWeight: 700 }}>Account activated</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
            Redirecting you to the login page...
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await authApi.activateAccount({ token, newPassword });
      setSuccess(true);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 1026) {
        setError("This activation link is invalid.");
      } else if (code === 1027) {
        setError("This activation link has expired. Please ask your admin to resend it.");
      } else if (code === 1028) {
        setError("This activation link has already been used. Try logging in, or contact your admin if you forgot your password.");
      } else {
        setError("Something went wrong. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ animation: "activateFadeIn 0.5s ease both" }}>
      <style>{`
        @keyframes activateFadeIn {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes activateSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="mb-9">
        <h2 className="mb-2" style={{ color: "#ffffff", fontSize: "30px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          Activate your account
        </h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
          Set a password to finish setting up your CinePrime account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div
            style={{
              background: "rgba(255, 75, 75, 0.1)",
              border: "1px solid rgba(255, 75, 75, 0.3)",
              borderRadius: "10px",
              padding: "12px 16px",
              color: "#FF4B4B",
              fontSize: "13px",
              fontWeight: 500,
              lineHeight: 1.4,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              animation: "activateFadeIn 0.3s ease both",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7.5" stroke="#FF4B4B" />
              <path d="M8 4.5v4M8 10.5v1" stroke="#FF4B4B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* New password field */}
        <div className="flex flex-col gap-2">
          <label htmlFor="newPassword" style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            New Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock
              size={17}
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: focusedField === "newPassword" ? "#3b82f6" : "rgba(255,255,255,0.3)",
                transition: "color 0.2s ease",
                pointerEvents: "none",
              }}
            />
            <input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              style={{
                ...inputBaseStyle,
                border: `1px solid ${fieldBorder("newPassword")}`,
                boxShadow: fieldShadow("newPassword"),
                padding: "14px 48px 14px 46px",
              }}
              onFocus={() => setFocusedField("newPassword")}
              onBlur={() => setFocusedField(null)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                display: "flex",
                alignItems: "center",
                color: "rgba(255,255,255,0.35)",
                transition: "color 0.2s ease",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm password field */}
        <div className="flex flex-col gap-2">
          <label htmlFor="confirmPassword" style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Confirm Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock
              size={17}
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: focusedField === "confirmPassword" ? "#3b82f6" : "rgba(255,255,255,0.3)",
                transition: "color 0.2s ease",
                pointerEvents: "none",
              }}
            />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              style={{
                ...inputBaseStyle,
                border: `1px solid ${fieldBorder("confirmPassword")}`,
                boxShadow: fieldShadow("confirmPassword"),
                padding: "14px 48px 14px 46px",
              }}
              onFocus={() => setFocusedField("confirmPassword")}
              onBlur={() => setFocusedField(null)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                display: "flex",
                alignItems: "center",
                color: "rgba(255,255,255,0.35)",
                transition: "color 0.2s ease",
              }}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            background: "#3b82f6",
            border: "none",
            borderRadius: "12px",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            padding: "14px",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "opacity 0.2s ease",
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} style={{ animation: "activateSpin 0.8s linear infinite" }} />
              Activating...
            </>
          ) : (
            "Activate Account"
          )}
        </button>

        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", textAlign: "center" }}>
          Already activated?{" "}
          <Link to="/login" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
