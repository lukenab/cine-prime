import { Outlet, Link } from "react-router-dom";
import { Film } from "lucide-react";

// Lớp film grain dựng bằng SVG noise — không phụ thuộc ảnh ngoài
const FILM_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function ClickableLogo({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <Link
      to="/"
      style={{
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "8px" : "10px",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: isMobile ? "32px" : "36px",
          height: isMobile ? "32px" : "36px",
          background: "#3b82f6",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Film size={isMobile ? 16 : 20} color="#ffffff" strokeWidth={2.5} />
      </div>
      <span
        style={{
          color: "#ffffff",
          fontSize: isMobile ? "18px" : "20px",
          fontWeight: 800,
          letterSpacing: "0.06em",
          fontFamily: "Inter, sans-serif",
        }}
      >
        CINE<span style={{ color: "#3b82f6" }}>PRIME</span>
      </span>
    </Link>
  );
}

export default function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex" style={{ fontFamily: "'Inter', sans-serif", background: "#050505" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) brightness(0.6); cursor: pointer; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        .cineprime-scroll::-webkit-scrollbar { width: 4px; }
        .cineprime-scroll::-webkit-scrollbar-track { background: #141414; }
        .cineprime-scroll::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 4px; }
        @keyframes popIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.55; transform: translate(-50%, 0) scale(1); }
          50% { opacity: 0.85; transform: translate(-50%, 0) scale(1.08); }
        }
        @keyframes beamDrift {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
      `}</style>

      {/* LEFT PANEL (Bên trái) — nền điện ảnh dựng bằng CSS */}
      <div
        className="hidden md:flex w-1/2 relative overflow-hidden flex-col"
        style={{
          background:
            "radial-gradient(120% 90% at 25% 15%, #0a1628 0%, #060b16 45%, #050505 75%)",
        }}
      >
        {/* Vầng sáng xanh trung tâm, đập nhẹ */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "8%",
            left: "50%",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.20) 0%, rgba(59,130,246,0.06) 35%, transparent 68%)",
            filter: "blur(8px)",
            animation: "glowPulse 7s ease-in-out infinite",
          }}
        />

        {/* Các vệt sáng spotlight chiếu xiên từ trên xuống */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-15%",
            left: "18%",
            width: "180px",
            height: "150%",
            background: "linear-gradient(180deg, rgba(59,130,246,0.18) 0%, transparent 62%)",
            transform: "rotate(20deg)",
            filter: "blur(34px)",
            animation: "beamDrift 9s ease-in-out infinite",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-20%",
            left: "44%",
            width: "120px",
            height: "150%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 55%)",
            transform: "rotate(-14deg)",
            filter: "blur(30px)",
            animation: "beamDrift 11s ease-in-out infinite 1s",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-10%",
            left: "68%",
            width: "150px",
            height: "150%",
            background: "linear-gradient(180deg, rgba(56,189,248,0.14) 0%, transparent 60%)",
            transform: "rotate(12deg)",
            filter: "blur(36px)",
            animation: "beamDrift 13s ease-in-out infinite 0.5s",
          }}
        />

        {/* Vignette làm tối viền cho chiều sâu */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(110% 110% at 50% 40%, transparent 45%, rgba(5,5,5,0.55) 80%, rgba(5,5,5,0.9) 100%)",
          }}
        />

        {/* Lớp film grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: FILM_GRAIN,
            backgroundRepeat: "repeat",
            opacity: 0.07,
            mixBlendMode: "overlay",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          <div>
            <ClickableLogo />
          </div>
          <div className="mb-4">
            <div className="mb-4 inline-block px-3 py-1 rounded-full" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
              <span style={{ color: "#3b82f6", fontSize: "12px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Premium Screening Experience
              </span>
            </div>
            <h1 className="mb-3" style={{ color: "#ffffff", fontSize: "36px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              Your world of cinema, <span style={{ color: "#3b82f6" }}>unlocked.</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "15px", fontWeight: 400, lineHeight: 1.65, maxWidth: "400px" }}>
              Book seats, explore new releases, and manage your watchlist — all in one place.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 md:w-1/2 flex flex-col items-center justify-center px-6 py-12 relative overflow-y-auto cineprime-scroll" style={{ background: "#050505" }}>
        {/* Vòng sáng nền mờ */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 w-full max-w-[480px]">
          <div className="flex md:hidden mb-10 justify-center">
            <ClickableLogo isMobile={true} />
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
