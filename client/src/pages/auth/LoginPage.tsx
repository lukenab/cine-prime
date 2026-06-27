import { useEffect, useState } from "react";
import { Eye, EyeOff, User, Lock, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const navigate = useNavigate();

  const { user, login } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.role === "ROLE_ADMIN" || user.role === "ROLE_EMPLOYEE") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login({ username, password });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 1008) {
        setError("Incorrect username or password. Please try again.");
      } else if (code === 1020) {
        setError("Your account has been deactivated. Please contact support.");
      } else {
        setError("Something went wrong. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Shared input wrapper styling driven by focus state
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

  return (
    <div style={{ animation: "loginFadeIn 0.5s ease both" }}>
      <style>{`
        @keyframes loginFadeIn {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Heading */}
      <div className="mb-9">
        <h2 className="mb-2" style={{ color: "#ffffff", fontSize: "30px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          Welcome back
        </h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Sign in to continue to your account</p>
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
              animation: "loginFadeIn 0.3s ease both",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7.5" stroke="#FF4B4B" />
              <path d="M8 4.5v4M8 10.5v1" stroke="#FF4B4B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Username field */}
        <div className="flex flex-col gap-2">
          <label htmlFor="username" style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Account / Username
          </label>
          <div style={{ position: "relative" }}>
            <User
              size={17}
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: focusedField === "username" ? "#3b82f6" : "rgba(255,255,255,0.3)",
                transition: "color 0.2s ease",
                pointerEvents: "none",
              }}
            />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username or email"
              autoComplete="username"
              style={{
                ...inputBaseStyle,
                border: `1px solid ${fieldBorder("username")}`,
                boxShadow: fieldShadow("username"),
                padding: "14px 16px 14px 46px",
              }}
              onFocus={() => setFocusedField("username")}
              onBlur={() => setFocusedField(null)}
            />
          </div>
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Password
            </label>
            <a
              href="#"
              style={{ color: "#3b82f6", fontSize: "12px", fontWeight: 500, textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Forgot Password?
            </a>
          </div>
          <div style={{ position: "relative" }}>
            <Lock
              size={17}
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: focusedField === "password" ? "#3b82f6" : "rgba(255,255,255,0.3)",
                transition: "color 0.2s ease",
                pointerEvents: "none",
              }}
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                ...inputBaseStyle,
                border: `1px solid ${fieldBorder("password")}`,
                boxShadow: fieldShadow("password"),
                padding: "14px 48px 14px 46px",
              }}
              onFocus={() => setFocusedField("password")}
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
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer", userSelect: "none", marginTop: "-4px" }}>
          <span
            onClick={() => setRememberMe(!rememberMe)}
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "5px",
              border: `1.5px solid ${rememberMe ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
              background: rememberMe ? "#3b82f6" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.18s ease",
              flexShrink: 0,
            }}
          >
            {rememberMe && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span
            onClick={() => setRememberMe(!rememberMe)}
            style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 500 }}
          >
            Keep me signed in
          </span>
        </label>

        {/* Sign In button */}
        <button
          type="submit"
          disabled={isLoading}
          style={{
            background: "#3b82f6",
            color: "#ffffff",
            borderRadius: "9999px",
            border: "none",
            padding: "15px",
            width: "100%",
            fontSize: "15px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: isLoading ? "not-allowed" : "pointer",
            marginTop: "4px",
            transition: "transform 0.15s, box-shadow 0.15s, filter 0.15s",
            boxShadow: "0 4px 32px rgba(59,130,246,0.22)",
            opacity: isLoading ? 0.75 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
          onMouseEnter={(e) => {
            if (isLoading) return;
            e.currentTarget.style.filter = "brightness(1.08)";
            e.currentTarget.style.boxShadow = "0 6px 40px rgba(59,130,246,0.36)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
            e.currentTarget.style.boxShadow = "0 4px 32px rgba(59,130,246,0.22)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onMouseDown={(e) => {
            if (isLoading) return;
            e.currentTarget.style.transform = "translateY(0px) scale(0.98)";
          }}
          onMouseUp={(e) => {
            if (isLoading) return;
            e.currentTarget.style.transform = "translateY(-1px) scale(1)";
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={17} style={{ animation: "loginSpin 0.7s linear infinite" }} />
              Signing in…
            </>
          ) : (
            "Sign In"
          )}
        </button>

        {/* Divider & Register link */}
        <div className="flex items-center gap-3 my-1">
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
          Don't have an account?{" "}
          <Link
            to="/register"
            style={{ color: "#3b82f6", fontWeight: 600, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Register now
          </Link>
        </p>
      </form>

      <p className="mt-12" style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: "11px", lineHeight: 1.6 }}>
        By signing in, you agree to CinePrime's{" "}
        <Link to="/register" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <a href="#" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}>
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
