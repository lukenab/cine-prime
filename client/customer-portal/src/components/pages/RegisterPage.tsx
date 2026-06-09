import { useState } from "react";
import { Eye, EyeOff, Film, Star } from "lucide-react";
import { Link } from "react-router-dom";

const THEATER_IMAGE =
  "https://images.unsplash.com/photo-1778654959480-9531f93501fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHRoZWF0ZXIlMjBpbnRlcmlvciUyMGNpbmVtYXRpYyUyMGRhcmslMjBsdXh1cnl8ZW58MXx8fHwxNzgwOTY5OTE0fDA&ixlib=rb-4.1.0&q=80&w=1080";

function CinePrimeLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          width: "36px",
          height: "36px",
          background: "#FFD700",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Film size={20} color="#050505" strokeWidth={2.5} />
      </div>
      <span
        style={{
          color: "#ffffff",
          fontSize: "20px",
          fontWeight: 800,
          letterSpacing: "0.06em",
          fontFamily: "Inter, sans-serif",
        }}
      >
        CINE<span style={{ color: "#FFD700" }}>PRIME</span>
      </span>
    </div>
  );
}

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
}: {
  type?: string;
  placeholder?: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ position: "relative" }}>
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
          border: `1px solid ${focused ? "#FFD700" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "10px",
          padding: rightElement ? "12px 44px 12px 14px" : "12px 14px",
          color: "#ffffff",
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          boxShadow: focused
            ? "0 0 0 3px rgba(255,215,0,0.12)"
            : "none",
        }}
      />
      {rightElement && (
        <div
          style={{
            position: "absolute",
            right: "14px",
            top: "50%",
            transform: "translateY(-50%)",
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
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <select
      name={name}
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        background: "#141414",
        border: `1px solid ${focused ? "#FFD700" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "10px",
        padding: "12px 14px",
        color: value ? "#ffffff" : "rgba(255,255,255,0.3)",
        fontSize: "14px",
        fontFamily: "Inter, sans-serif",
        outline: "none",
        boxSizing: "border-box",
        cursor: "pointer",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        boxShadow: focused ? "0 0 0 3px rgba(255,215,0,0.12)" : "none",
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
        <option
          key={opt.value}
          value={opt.value}
          style={{ background: "#141414", color: "#ffffff" }}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function RegisterPage(){
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    phone: "",
    dob: "",
    gender: "",
    identityCard: "",
    address: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#050505",
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1) brightness(0.6);
          cursor: pointer;
        }
        input::placeholder { color: rgba(255,255,255,0.25); }
        .cineprime-scroll::-webkit-scrollbar { width: 4px; }
        .cineprime-scroll::-webkit-scrollbar-track { background: #141414; }
        .cineprime-scroll::-webkit-scrollbar-thumb { background: #FFD700; border-radius: 4px; }
        @media (max-width: 768px) {
          .split-layout { flex-direction: column !important; }
          .left-panel { min-height: 320px !important; width: 100% !important; }
          .right-panel { width: 100% !important; }
        }
      `}</style>

      {/* LEFT PANEL */}
      <div
        className="left-panel"
        style={{
          width: "50%",
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Background image */}
        <img
          src={THEATER_IMAGE}
          alt="Cinematic movie theater"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        {/* Dark gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(5,5,5,0.55) 0%, rgba(5,5,5,0.3) 40%, rgba(5,5,5,0.75) 75%, rgba(5,5,5,0.97) 100%)",
          }}
        />
        {/* Side vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(5,5,5,0.3) 0%, transparent 40%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            height: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "36px 40px",
          }}
        >
          {/* Logo */}
          <CinePrimeLogo />

          {/* Bottom content */}
          <div>
            {/* Premium badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255,215,0,0.12)",
                border: "1px solid rgba(255,215,0,0.35)",
                borderRadius: "999px",
                padding: "5px 14px",
                marginBottom: "20px",
              }}
            >
              <Star size={11} fill="#FFD700" color="#FFD700" />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#FFD700",
                }}
              >
                Premium Screening Experience
              </span>
            </div>

            {/* Heading */}
            <h1
              style={{
                color: "#ffffff",
                fontSize: "clamp(28px, 3.5vw, 44px)",
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: "14px",
                letterSpacing: "-0.02em",
              }}
            >
              Your world of cinema,{" "}
              <span style={{ color: "#FFD700" }}>unlocked.</span>
            </h1>

            {/* Subtext */}
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: "14px",
                lineHeight: 1.6,
                maxWidth: "360px",
              }}
            >
              Exclusive access to premium screenings, priority bookings, and a
              personalized watchlist — crafted for true cinema lovers.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        className="right-panel cineprime-scroll"
        style={{
          width: "50%",
          minHeight: "100vh",
          overflowY: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          padding: "48px 32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "480px" }}>
          {/* Form heading */}
          <h2
            style={{
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: 700,
              marginBottom: "6px",
              letterSpacing: "-0.01em",
            }}
          >
            Create an account
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "14px",
              marginBottom: "32px",
              lineHeight: 1.5,
            }}
          >
            Join CinePrime to book seats and manage your watchlist.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Row 1: Full Name */}
            <div style={{ marginBottom: "18px" }}>
              <FormLabel>Full Name</FormLabel>
              <FormInput
                name="fullName"
                placeholder="e.g. Alex Johnson"
                value={form.fullName}
                onChange={handleChange}
              />
            </div>

            {/* Row 2: Username | Email */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                marginBottom: "18px",
              }}
            >
              <div>
                <FormLabel>Username</FormLabel>
                <FormInput
                  name="username"
                  placeholder="@yourname"
                  value={form.username}
                  onChange={handleChange}
                />
              </div>
              <div>
                <FormLabel>Email Address</FormLabel>
                <FormInput
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Row 3: Password | Phone */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                marginBottom: "18px",
              }}
            >
              <div>
                <FormLabel>Password</FormLabel>
                <FormInput
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
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
              <div>
                <FormLabel>Phone Number</FormLabel>
                <FormInput
                  type="tel"
                  name="phone"
                  placeholder="+1 000 000 0000"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Row 4: Date of Birth | Gender */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                marginBottom: "18px",
              }}
            >
              <div>
                <FormLabel>Date of Birth</FormLabel>
                <FormInput
                  type="date"
                  name="dob"
                  placeholder=""
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>
              <div>
                <FormLabel>Gender</FormLabel>
                <FormSelect
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  placeholder="Select gender"
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "non-binary", label: "Non-binary" },
                    { value: "prefer-not", label: "Prefer not to say" },
                  ]}
                />
              </div>
            </div>

            {/* Row 5: Identity Card | Address */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                marginBottom: "28px",
              }}
            >
              <div>
                <FormLabel>Identity Card</FormLabel>
                <FormInput
                  name="identityCard"
                  placeholder="ID / Passport No."
                  value={form.identityCard}
                  onChange={handleChange}
                />
              </div>
              <div>
                <FormLabel>Address</FormLabel>
                <FormInput
                  name="address"
                  placeholder="City, Country"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              style={{
                width: "100%",
                background: "#FFD700",
                color: "#050505",
                border: "none",
                borderRadius: "9999px",
                padding: "14px",
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.02em",
                cursor: "pointer",
                boxShadow:
                  "0 4px 24px rgba(255,215,0,0.35), 0 2px 8px rgba(255,215,0,0.2)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-1px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 6px 32px rgba(255,215,0,0.45), 0 2px 12px rgba(255,215,0,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 4px 24px rgba(255,215,0,0.35), 0 2px 8px rgba(255,215,0,0.2)";
              }}
            >
              Create Account
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                margin: "22px 0",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
              <span
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "12px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                }}
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

            {/* Footer link */}
            <p
              style={{
                textAlign: "center",
                fontSize: "14px",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Already have an account?{" "}
              <Link
                to="/login"
                style={{
                  color: "#FFD700",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
                    "underline")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
                    "none")
                }
              >
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
