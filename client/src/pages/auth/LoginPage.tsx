import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const { user, login } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.role === "ROLE_ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ username, password });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 400) {
        setError("Incorrect username or password. Please try again.");
      } else {
        setError("Something went wrong. Please try again later.");
      }
    }
  };

  return (
    <>
      {/* Heading */}
      <div className="mb-9">
        <h2 className="mb-2" style={{ color: "#ffffff", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
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
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username or email"
            autoComplete="username"
            style={{
              background: "#141414",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              color: "#ffffff",
              fontSize: "14px",
              padding: "14px 16px",
              outline: "none",
              transition: "border-color 0.2s",
              width: "100%",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,215,0,0.5)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Password
            </label>
            <a
              href="#"
              style={{ color: "#FFD700", fontSize: "12px", fontWeight: 500, textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Forgot Password?
            </a>
          </div>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                background: "#141414",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                color: "#ffffff",
                fontSize: "14px",
                padding: "14px 48px 14px 16px",
                outline: "none",
                transition: "border-color 0.2s",
                width: "100%",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,215,0,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
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
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Sign In button */}
        <button
          type="submit"
          style={{
            background: "#FFD700",
            color: "#050505",
            borderRadius: "9999px",
            border: "none",
            padding: "15px",
            width: "100%",
            fontSize: "15px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            marginTop: "4px",
            transition: "transform 0.15s, box-shadow 0.15s, filter 0.15s",
            boxShadow: "0 4px 32px rgba(255,215,0,0.22)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(1.08)";
            e.currentTarget.style.boxShadow = "0 6px 40px rgba(255,215,0,0.36)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
            e.currentTarget.style.boxShadow = "0 4px 32px rgba(255,215,0,0.22)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "translateY(0px) scale(0.98)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translateY(-1px) scale(1)";
          }}
        >
          Sign In
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
            style={{ color: "#FFD700", fontWeight: 600, textDecoration: "none" }}
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
    </>
  );
}
