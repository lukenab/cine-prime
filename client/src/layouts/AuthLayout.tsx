import { Outlet, Link } from "react-router-dom";
import { Film } from "lucide-react";

const CINEMA_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBtb3ZpZSUyMHRoZWF0ZXIlMjBkYXJrJTIwbW9vZHklMjBpbnRlcmlvcnxlbnwxfHx8fDE3ODA5MzEwMDJ8MA&ixlib=rb-4.1.0&q=80&w=1080";

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
          background: "#FFD700",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Film size={isMobile ? 16 : 20} color="#050505" strokeWidth={2.5} />
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
        CINE<span style={{ color: "#FFD700" }}>PRIME</span>
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
        .cineprime-scroll::-webkit-scrollbar-thumb { background: #FFD700; border-radius: 4px; }
        @keyframes popIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* LEFT PANEL (Bên trái) */}
      <div className="hidden md:flex w-1/2 relative overflow-hidden flex-col">
        <img src={CINEMA_IMAGE} alt="Cinematic movie theater interior" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgba(5,5,5,0.72) 0%, rgba(5,5,5,0.40) 60%, rgba(5,5,5,0.82) 100%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          <div>
            <ClickableLogo />
          </div>
          <div className="mb-4">
            <div className="mb-4 inline-block px-3 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)" }}>
              <span style={{ color: "#FFD700", fontSize: "12px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Premium Screening Experience
              </span>
            </div>
            <h1 className="mb-3" style={{ color: "#ffffff", fontSize: "36px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              Your world of cinema, <span style={{ color: "#FFD700" }}>unlocked.</span>
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
            background: "radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 70%)",
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
