import { Ticket, Play, ChevronDown } from "lucide-react";
import trailerVideo from "../../assets/GattoTeaser.mp4";

export function HeroSection() {
  return (
    <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* 1. Lớp chứa Video MP4 Native */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-black pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.9 }}
        >
          <source src={trailerVideo} type="video/mp4" />
        </video>
      </div>

      {/* 2. Gradient overlays (Giảm mờ để video vẫn nổi bật) */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: "linear-gradient(to bottom, rgba(5,5,5,0.2) 0%, rgba(5,5,5,0.05) 40%, rgba(5,5,5,0.45) 80%, rgba(5,5,5,0.8) 100%)",
        }}
      />
      <div
        className="absolute inset-0 z-10"
        style={{
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(5,5,5,0.45) 100%)",
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: "linear-gradient(90deg, transparent, #FFD700, transparent)" }} />

      {/* 3. Nội dung chữ bên trên (z-20 để luôn đè lên video) */}
      <div className="relative z-20 flex flex-col items-center text-center px-6 max-w-5xl mx-auto" style={{ gap: "24px" }}>
        {/* Badge */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full border"
          style={{
            border: "1px solid rgba(255,215,0,0.4)",
            backgroundColor: "rgba(255,215,0,0.08)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#FFD700" }} />
          <span style={{ color: "#FFD700", fontSize: "0.75rem", letterSpacing: "0.15em", fontWeight: 600 }}>NOW SHOWING IN THEATRES</span>
        </div>

        {/* Main headline */}
        <h1
          className="text-white"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            textShadow: "0 4px 40px rgba(0,0,0,0.8)",
          }}
        >
          Experience Cinema{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFA500)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Like Never
          </span>{" "}
          Before
        </h1>

        {/* Subheading */}
        <p
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            maxWidth: "600px",
            lineHeight: 1.7,
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}
        >
          Premium screens. Dolby Atmos sound. Reclining seats. Your next cinematic adventure starts here.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-4 justify-center" style={{ marginTop: "8px" }}>
          <button
            className="flex items-center gap-3 px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFA500)",
              color: "#050505",
              fontWeight: 800,
              fontSize: "1rem",
              letterSpacing: "0.04em",
              boxShadow: "0 0 30px rgba(255,215,0,0.35)",
            }}
          >
            <Ticket size={18} />
            Book Your Movie
          </button>

          <button
            className="flex items-center gap-3 px-8 py-4 rounded-full border transition-all duration-300 hover:scale-105"
            style={{
              border: "1px solid rgba(255,255,255,0.25)",
              backgroundColor: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(8px)",
              color: "white",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            <Play size={16} fill="white" />
            Watch Trailer
          </button>
        </div>

        {/* Stats row */}
        <div
          className="flex gap-10 flex-wrap justify-center"
          style={{
            marginTop: "16px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {[
            { value: "200+", label: "Movies" },
            { value: "50+", label: "Screens" },
            { value: "4K", label: "Ultra HD" },
            { value: "Dolby", label: "Atmos Sound" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span style={{ color: "#FFD700", fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>{value}</span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce z-10">
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", letterSpacing: "0.15em" }}>SCROLL</span>
        <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
      </div>
    </section>
  );
}
