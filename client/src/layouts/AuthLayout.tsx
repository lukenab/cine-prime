import { Outlet, Link } from "react-router-dom";
import { OrbitaLogo } from "../components/shared/OrbitaLogo";

// Lớp film grain dựng bằng SVG noise — không phụ thuộc ảnh ngoài
const FILM_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function ClickableLogo({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <Link
      to="/"
      className="group"
      style={{
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "8px" : "10px",
        cursor: "pointer",
      }}
    >
      {/* The solid blue tile is gone: the planet mark carries its own silhouette
          and halo, so boxing it in would only fight that shape. Size is tuned
          against the wordmark's cap height (20px desktop / 18px mobile), not
          against the 36px box the old lucide glyph used to sit in. */}
      <OrbitaLogo
        size={isMobile ? 20 : 22}
        className="transition-transform duration-200 group-hover:scale-105"
      />
      <span
        style={{
          color: "#ffffff",
          fontSize: isMobile ? "18px" : "20px",
          fontWeight: 800,
          letterSpacing: "0.06em",
          fontFamily: "Inter, sans-serif",
        }}
      >
        CINE<span className="cp-grad-text">PRIME</span>
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
        @keyframes authOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes authOrbitReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes authFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes authTwinkle {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.85; }
        }
        .auth-cosmic-scene {
          position: absolute;
          left: 50%;
          top: 44%;
          width: min(43vw, 590px);
          aspect-ratio: 1;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .auth-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          border: 1px solid rgba(96, 165, 250, 0.19);
          border-radius: 50%;
        }
        .auth-orbit::after {
          content: "";
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 18px 4px rgba(59, 130, 246, 0.65);
        }
        .auth-orbit-one {
          width: 66%;
          height: 66%;
          margin: -33% 0 0 -33%;
          transform: rotate(-18deg);
          animation: authOrbit 22s linear infinite;
        }
        .auth-orbit-one::after { top: 8%; left: 23%; }
        .auth-orbit-two {
          width: 91%;
          height: 43%;
          margin: -21.5% 0 0 -45.5%;
          transform: rotate(24deg);
          animation: authOrbitReverse 29s linear infinite;
        }
        .auth-orbit-two::after { right: 5%; top: 45%; width: 5px; height: 5px; }
        .auth-orbit-three {
          width: 105%;
          height: 72%;
          margin: -36% 0 0 -52.5%;
          transform: rotate(-32deg);
          border-color: rgba(255,255,255,0.08);
        }
        .auth-orbit-three::after { left: 11%; bottom: 17%; width: 4px; height: 4px; }
        .auth-planet-system {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 176px;
          height: 176px;
          margin: -88px 0 0 -88px;
          animation: authFloat 7s ease-in-out infinite;
        }
        .auth-planet {
          position: absolute;
          inset: 0;
          z-index: 2;
          border-radius: 50%;
          background:
            radial-gradient(circle at 31% 24%, rgba(255,255,255,0.9) 0 2%, rgba(147,197,253,0.75) 4%, transparent 17%),
            radial-gradient(circle at 36% 31%, #2563eb 0%, #123b9b 34%, #071b4f 68%, #020817 100%);
          box-shadow: inset -34px -26px 52px rgba(0,0,0,0.62), 0 0 80px rgba(37,99,235,0.35), 0 0 150px rgba(37,99,235,0.12);
        }
        .auth-planet-ring {
          position: absolute;
          left: -45px;
          top: 70px;
          width: 266px;
          height: 34px;
          border: 8px solid rgba(96,165,250,0.46);
          border-left-color: rgba(191,219,254,0.75);
          border-right-color: rgba(29,78,216,0.22);
          border-radius: 50%;
          transform: rotate(-13deg);
          box-shadow: 0 0 24px rgba(59,130,246,0.25);
        }
        .auth-planet-ring-back { z-index: 1; }
        .auth-planet-ring-front {
          z-index: 3;
          clip-path: inset(50% -24px -24px -24px);
          border-left-color: rgba(191,219,254,0.88);
          border-bottom-color: rgba(96,165,250,0.62);
        }
        .auth-system-label {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid rgba(96,165,250,0.18);
          border-radius: 999px;
          background: rgba(3,10,24,0.58);
          color: rgba(219,234,254,0.72);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 0.05em;
          backdrop-filter: blur(12px);
        }
        .auth-system-label::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 10px rgba(59,130,246,0.8);
        }
        .auth-label-one { top: 16%; right: 3%; }
        .auth-label-two { left: 1%; bottom: 23%; }
        .auth-star-field {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 12% 17%, rgba(147,197,253,.8) 0 1px, transparent 1.5px),
            radial-gradient(circle at 72% 14%, rgba(255,255,255,.65) 0 1px, transparent 1.5px),
            radial-gradient(circle at 83% 36%, rgba(96,165,250,.75) 0 1px, transparent 1.5px),
            radial-gradient(circle at 22% 67%, rgba(255,255,255,.55) 0 1px, transparent 1.5px),
            radial-gradient(circle at 67% 78%, rgba(147,197,253,.65) 0 1px, transparent 1.5px);
          background-size: 210px 190px, 270px 230px, 330px 280px, 240px 260px, 300px 220px;
          animation: authTwinkle 6s ease-in-out infinite;
        }
        .cosmic-login-card {
          position: relative;
          padding: 28px 32px;
          border: 1px solid rgba(96,165,250,0.16);
          border-radius: 24px;
          background: linear-gradient(145deg, rgba(13,25,48,0.82), rgba(5,10,22,0.92));
          box-shadow: 0 26px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.035);
          backdrop-filter: blur(24px);
          overflow: hidden;
        }
        .cosmic-login-card::before {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          right: -130px;
          top: -155px;
          border: 1px solid rgba(96,165,250,0.15);
          border-radius: 50%;
          box-shadow: 0 0 55px rgba(37,99,235,0.12);
          pointer-events: none;
        }
        @media (max-width: 767px) {
          .cosmic-login-card { padding: 24px 22px; border-radius: 20px; }
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

        <div className="auth-star-field pointer-events-none" />

        <div className="auth-cosmic-scene" aria-hidden="true">
          <div className="auth-orbit auth-orbit-three" />
          <div className="auth-orbit auth-orbit-two" />
          <div className="auth-orbit auth-orbit-one" />
          <div className="auth-planet-system">
            <div className="auth-planet-ring auth-planet-ring-back" />
            <div className="auth-planet" />
            <div className="auth-planet-ring auth-planet-ring-front" />
          </div>
          <div className="auth-system-label auth-label-one">Now showing</div>
          <div className="auth-system-label auth-label-two">One account. Every cinema.</div>
        </div>

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

      <div
        className="flex-1 md:w-1/2 flex flex-col items-center justify-center px-6 py-12 relative overflow-y-auto cineprime-scroll"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(37,99,235,0.12), transparent 28%), radial-gradient(circle at 85% 78%, rgba(30,64,175,0.09), transparent 34%), #03050a",
        }}
      >
        <div className="auth-star-field pointer-events-none" style={{ opacity: 0.36 }} />
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
