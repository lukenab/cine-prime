import { useState } from "react";
import { Eye, EyeOff, Film } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {authApi} from '../../api/authApi'

const CINEMA_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBtb3ZpZSUyMHRoZWF0ZXIlMjBkYXJrJTIwbW9vZHklMjBpbnRlcmlvcnxlbnwxfHx8fDE3ODA5MzEwMDJ8MA&ixlib=rb-4.1.0&q=80&w=1080";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await authApi.login({
        username: username,
        password: password
      });

      console.log("Login successfully:", response);
      
      navigate("/"); 
      
    } catch (error) {
      console.error("Login failed:", error);
      alert("Incorrect username or password!");
    }
  };

  return (
    <div
      className="min-h-screen w-full flex"
      style={{ fontFamily: "'Inter', sans-serif", background: "#050505" }}
    >
      {/* Left panel — cinematic image */}
      <div className="hidden md:flex w-1/2 relative overflow-hidden flex-col">
        <img
          src={CINEMA_IMAGE}
          alt="Cinematic movie theater interior"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(5,5,5,0.72) 0%, rgba(5,5,5,0.40) 60%, rgba(5,5,5,0.82) 100%)",
          }}
        />
        {/* Logo lockup on left panel */}
        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ background: "#FFD700" }}
            >
              <Film size={18} color="#050505" strokeWidth={2.5} />
            </div>
            <span
              className="tracking-widest uppercase"
              style={{
                color: "#FFD700",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.2em",
              }}
            >
              CinePrime
            </span>
          </div>

          <div className="mb-4">
            <div
              className="mb-4 inline-block px-3 py-1 rounded-full"
              style={{
                background: "rgba(255,215,0,0.12)",
                border: "1px solid rgba(255,215,0,0.3)",
              }}
            >
              <span
                style={{
                  color: "#FFD700",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Premium Screening Experience
              </span>
            </div>
            <h1
              className="mb-3"
              style={{
                color: "#ffffff",
                fontSize: "36px",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              Your world of cinema,{" "}
              <span style={{ color: "#FFD700" }}>unlocked.</span>
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: "15px",
                fontWeight: 400,
                lineHeight: 1.65,
              }}
            >
              Book seats, explore new releases, and manage your watchlist — all
              in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        className="flex-1 md:w-1/2 flex flex-col items-center justify-center px-6 py-12 relative overflow-y-auto"
        style={{ background: "#050505" }}
      >
        {/* Subtle radial glow behind form */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-3 mb-10">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: "#FFD700" }}
            >
              <Film size={16} color="#050505" strokeWidth={2.5} />
            </div>
            <span
              style={{
                color: "#FFD700",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              CinePrime
            </span>
          </div>

          {/* Heading */}
          <div className="mb-9">
            <h2
              className="mb-2"
              style={{
                color: "#ffffff",
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Welcome back
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
              Sign in to continue to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Username field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="username"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
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
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,215,0,0.5)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")
                }
              />
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Password
                </label>
                <a
                  href="#"
                  style={{
                    color: "#FFD700",
                    fontSize: "12px",
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
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
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,215,0,0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.1)")
                  }
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
                e.currentTarget.style.boxShadow =
                  "0 6px 40px rgba(255,215,0,0.36)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
                e.currentTarget.style.boxShadow =
                  "0 4px 32px rgba(255,215,0,0.22)";
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

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
              <span
                style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px" }}
              >
                or
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            </div>

            {/* Register link */}
            <p
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.4)",
                fontSize: "14px",
              }}
            >
              Don't have an account?{" "}
              <Link
                to="/register"
                style={{
                  color: "#FFD700",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.textDecoration = "underline")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.textDecoration = "none")
                }
              >
                Register now
              </Link>
            </p>
          </form>

          {/* Footer */}
          <p
            className="mt-12"
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.18)",
              fontSize: "11px",
              lineHeight: 1.6,
            }}
          >
            By signing in, you agree to CinePrime's{" "}
            <Link
              to="/register"
              style={{
                color: "rgba(255,255,255,0.35)",
                textDecoration: "underline",
              }}
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <a
              href="#"
              style={{
                color: "rgba(255,255,255,0.35)",
                textDecoration: "underline",
              }}
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
