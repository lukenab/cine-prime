import { useState } from "react";
import { Eye, EyeOff, Film, Star, ArrowLeft, Mail, CheckCircle } from "lucide-react"; // Import thêm CheckCircle
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../api/authApi.ts";

const THEATER_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBtb3ZpZSUyMHRoZWF0ZXIlMjBkYXJrJTIwbW9vZHklMjBpbnRlcmlvcnxlbnwxfHx8fDE3ODA5MzEwMDJ8MA&ixlib=rb-4.1.0&q=80&w=1080";

// ... (Giữ nguyên các component CinePrimeLogo, FormLabel, FormInput, FormSelect) ...
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
          border: `1px solid ${error ? "#FF4B4B" : focused ? "#FFD700" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "10px",
          padding: rightElement ? "12px 44px 12px 14px" : "12px 14px",
          color: "#ffffff",
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          boxShadow: focused ? (error ? "0 0 0 3px rgba(255, 75, 75, 0.15)" : "0 0 0 3px rgba(255,215,0,0.12)") : "none",
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
      <select
        name={name}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: "#141414",
          border: `1px solid ${error ? "#FF4B4B" : focused ? "#FFD700" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "10px",
          padding: "12px 14px",
          color: value ? "#ffffff" : "rgba(255,255,255,0.3)",
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          boxSizing: "border-box",
          cursor: "pointer",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          boxShadow: focused ? (error ? "0 0 0 3px rgba(255, 75, 75, 0.15)" : "0 0 0 3px rgba(255,215,0,0.12)") : "none",
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

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Nâng cấp step để có màn hình Success (Step 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    }
  };

  const validateClientForm = () => {
    const clientErrors: Record<string, string> = {};

    if (!form.fullName.trim()) clientErrors.fullName = "Full name must not be blank";
    if (!form.username.trim()) clientErrors.username = "Username must not be blank";
    if (!form.email.trim()) clientErrors.email = "Email address must not be blank";
    if (!form.password.trim()) clientErrors.password = "Password must not be blank";
    if (!form.phone.trim()) clientErrors.phone = "Phone number must not be blank";
    if (!form.dob) clientErrors.dob = "Date of birth must not be null";
    if (!form.gender) clientErrors.gender = "Gender must not be blank";
    if (!form.identityCard.trim()) clientErrors.identityCard = "Identity card must not be blank";
    if (!form.address.trim()) clientErrors.address = "Address must not be blank";

    setErrors(clientErrors);
    return Object.keys(clientErrors).length === 0;
  };

  const getPayload = () => ({
    username: form.username,
    password: form.password,
    email: form.email,
    fullName: form.fullName,
    phoneNumber: form.phone,
    dateOfBirth: form.dob,
    gender: form.gender,
    address: form.address,
    identityCard: form.identityCard,
  });

  // BƯỚC 1: Gửi yêu cầu lấy OTP
  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    if (!validateClientForm()) return;
    setLoading(true);

    try {
      const res: any = await authApi.initiateRegister(getPayload());

      const responseData = res?.data || res;
      if (responseData && responseData.code && responseData.code !== 1000) {
        throw { response: { data: responseData } };
      }

      setStep(2);
    } catch (error: any) {
      console.error("Initiate failed:", error);

      const backendMessage = error.response?.data?.message || error.message || "Registration failed.";
      const lowMessage = backendMessage.toLowerCase();

      if (lowMessage.includes("username") || lowMessage.includes("tồn tại")) {
        setErrors((prev) => ({ ...prev, username: backendMessage }));
      } else if (lowMessage.includes("email")) {
        setErrors((prev) => ({ ...prev, email: backendMessage }));
      } else if (lowMessage.includes("identity card") || lowMessage.includes("cccd")) {
        setErrors((prev) => ({ ...prev, identityCard: backendMessage }));
      } else if (lowMessage.includes("phone") || lowMessage.includes("điện thoại")) {
        setErrors((prev) => ({ ...prev, phone: backendMessage }));
      } else {
        setGeneralError(backendMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2: Xác nhận OTP và lưu tài khoản
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!otp || otp.length < 6) {
      setGeneralError("Please enter a valid 6-digit OTP.");
      return;
    }
    setLoading(true);

    try {
      const res: any = await authApi.verifyRegister({
        otp: otp,
        registerRequest: getPayload(),
      });

      const responseData = res?.data || res;
      if (responseData && responseData.code && responseData.code !== 1000) {
        throw { response: { data: responseData } };
      }

      // Không dùng alert nữa, chuyển sang Step 3 (Màn hình thành công)
      setStep(3);
    } catch (error: any) {
      setGeneralError(error.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
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
        
        /* Hiệu ứng Pop-up cho Màn hình Thành công */
        @keyframes popIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(5,5,5,0.55) 0%, rgba(5,5,5,0.3) 40%, rgba(5,5,5,0.75) 75%, rgba(5,5,5,0.97) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(5,5,5,0.3) 0%, transparent 40%)",
          }}
        />

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
          <CinePrimeLogo />

          <div>
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
              Your world of cinema, <span style={{ color: "#FFD700" }}>unlocked.</span>
            </h1>

            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: "14px",
                lineHeight: 1.6,
                maxWidth: "360px",
              }}
            >
              Exclusive access to premium screenings, priority bookings, and a personalized watchlist — crafted for true cinema lovers.
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
          {/* ========================= BƯỚC 1: ĐIỀN THÔNG TIN ========================= */}
          {step === 1 && (
            <>
              <h2 style={{ color: "#ffffff", fontSize: "28px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.01em" }}>Create an account</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "32px", lineHeight: 1.5 }}>
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
                      marginBottom: "20px",
                      lineHeight: 1.4,
                    }}
                  >
                    {generalError}
                  </div>
                )}
                <div style={{ marginBottom: "18px" }}>
                  <FormLabel>Full Name</FormLabel>
                  <FormInput name="fullName" placeholder="e.g. Alex Johnson" value={form.fullName} onChange={handleChange} error={errors.fullName} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                  <div>
                    <FormLabel>Username</FormLabel>
                    <FormInput name="username" placeholder="@yourname" value={form.username} onChange={handleChange} error={errors.username} />
                  </div>
                  <div>
                    <FormLabel>Email Address</FormLabel>
                    <FormInput type="email" name="email" placeholder="you@email.com" value={form.email} onChange={handleChange} error={errors.email} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                  <div>
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
                  <div>
                    <FormLabel>Phone Number</FormLabel>
                    <FormInput type="tel" name="phone" placeholder="0901234567" value={form.phone} onChange={handleChange} error={errors.phone} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                  <div>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormInput type="date" name="dob" placeholder="" value={form.dob} onChange={handleChange} error={errors.dob} />
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "28px" }}>
                  <div>
                    <FormLabel>Identity Card</FormLabel>
                    <FormInput name="identityCard" placeholder="Exactly 12 digits" value={form.identityCard} onChange={handleChange} error={errors.identityCard} />
                  </div>
                  <div>
                    <FormLabel>Address</FormLabel>
                    <FormInput name="address" placeholder="City, Country" value={form.address} onChange={handleChange} error={errors.address} />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: loading ? "rgba(255,215,0,0.5)" : "#FFD700",
                    color: "#050505",
                    border: "none",
                    borderRadius: "9999px",
                    padding: "14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.02em",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : "0 4px 24px rgba(255,215,0,0.35), 0 2px 8px rgba(255,215,0,0.2)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 32px rgba(255,215,0,0.45), 0 2px 12px rgba(255,215,0,0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(255,215,0,0.35), 0 2px 8px rgba(255,215,0,0.2)";
                    }
                  }}
                >
                  {loading ? "Sending Code..." : "Continue"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "22px 0" }}>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", fontWeight: 500, letterSpacing: "0.05em" }}>or</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
                </div>

                <p style={{ textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    style={{ color: "#FFD700", fontWeight: 700, textDecoration: "none" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")}
                  >
                    Sign In
                  </Link>
                </p>
              </form>
            </>
          )}

          {/* ========================= BƯỚC 2: XÁC THỰC OTP ========================= */}
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
                    background: "rgba(255,215,0,0.1)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Mail size={28} color="#FFD700" />
                </div>
              </div>

              <h2 style={{ color: "#ffffff", fontSize: "28px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>Verify your email</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "32px", textAlign: "center", lineHeight: 1.5 }}>
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
                      color: "#FFD700",
                      fontSize: "28px",
                      textAlign: "center",
                      letterSpacing: "0.5em",
                      outline: "none",
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 600,
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#FFD700")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: loading ? "rgba(255,215,0,0.5)" : "#FFD700",
                    color: "#050505",
                    border: "none",
                    borderRadius: "9999px",
                    padding: "14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    fontFamily: "Inter, sans-serif",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : "0 4px 24px rgba(255,215,0,0.35)",
                  }}
                >
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </button>
              </form>
            </div>
          )}

          {/* ========================= BƯỚC 3: MÀN HÌNH THÀNH CÔNG ========================= */}
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
              <div style={{ marginBottom: "24px", padding: "20px", background: "rgba(255, 215, 0, 0.08)", borderRadius: "50%" }}>
                <CheckCircle size={72} color="#FFD700" strokeWidth={1.5} />
              </div>

              <h2 style={{ color: "#ffffff", fontSize: "32px", fontWeight: 800, marginBottom: "12px", letterSpacing: "-0.02em" }}>Welcome to CinePrime!</h2>

              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "15px", marginBottom: "40px", lineHeight: 1.6, maxWidth: "340px" }}>
                Your account has been successfully created. Get ready to experience cinema like never before.
              </p>

              <button
                onClick={() => navigate("/login")}
                style={{
                  width: "100%",
                  background: "#FFD700",
                  color: "#050505",
                  border: "none",
                  borderRadius: "9999px",
                  padding: "16px",
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(255,215,0,0.35)",
                  transition: "transform 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                Sign In to Your Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
