import { Ticket, Play, ChevronDown } from "lucide-react";
import trailerVideo from "../../assets/GattoTeaser.mp4";

export function HeroSection() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      {/* Video */}
      <div className="absolute inset-0 w-full h-full z-0 bg-black">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.95 }}
        >
          <source src={trailerVideo} type="video/mp4" />
        </video>
      </div>

      {/* Gradient — chỉ fade ở bottom và left để video giữa nổi bật */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.4) 30%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(5,5,5,0.75) 0%, rgba(5,5,5,0.2) 40%, transparent 65%)",
        }}
      />

      {/* Gold top line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: "linear-gradient(90deg, transparent, #FFD700, transparent)" }} />

      {/* Text — góc dưới trái, không che giữa video */}
      <div
        className="absolute z-20 flex flex-col"
        style={{ bottom: "80px", left: "clamp(24px, 5vw, 80px)", maxWidth: "520px", gap: "20px" }}
      >
        {/* Badge */}
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full w-fit"
          style={{
            border: "1px solid rgba(255,215,0,0.4)",
            backgroundColor: "rgba(255,215,0,0.08)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FFD700" }} />
          <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.15em", fontWeight: 600 }}>NOW SHOWING IN THEATRES</span>
        </div>

        {/* Headline */}
        <h1
          className="text-white"
          style={{
            fontSize: "clamp(2rem, 5vw, 3.75rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            textShadow: "0 4px 30px rgba(0,0,0,0.9)",
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
            color: "rgba(255,255,255,0.75)",
            fontSize: "0.95rem",
            lineHeight: 1.6,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          Premium screens. Dolby Atmos sound. Reclining seats.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            className="flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFA500)",
              color: "#050505",
              fontWeight: 800,
              fontSize: "0.9rem",
              letterSpacing: "0.03em",
              boxShadow: "0 0 24px rgba(255,215,0,0.35)",
            }}
          >
            <Ticket size={16} />
            Book Your Movie
          </button>

          <button
            className="flex items-center gap-2 px-6 py-3 rounded-full border transition-all duration-300 hover:scale-105"
            style={{
              border: "1px solid rgba(255,255,255,0.3)",
              backgroundColor: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
              color: "white",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            <Play size={14} fill="white" />
            Watch Trailer
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-8 flex-wrap" style={{ paddingTop: "8px" }}>
          {[
            { value: "200+", label: "Movies" },
            { value: "50+", label: "Screens" },
            { value: "4K", label: "Ultra HD" },
            { value: "Dolby", label: "Atmos" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span style={{ color: "#FFD700", fontSize: "1.25rem", fontWeight: 800, lineHeight: 1 }}>{value}</span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce z-20">
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "0.15em" }}>SCROLL</span>
        <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
      </div>
    </section>
  );
}
