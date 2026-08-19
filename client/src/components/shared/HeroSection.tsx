import { Ticket, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import trailerVideo from "../../assets/GattoTeaser.mp4";

export function HeroSection() {
  const navigate = useNavigate();

  // The primary CTA used to hard-navigate to /booking/1 — a showtime id that is
  // only valid on a freshly seeded database. Scrolling to the booking bar sitting
  // just below the hero always works, and it is the step the customer needs next
  // anyway: pick a cinema and a showtime before there is anything to book.
  const goToBooking = () => {
    const el = document.getElementById("quick-booking");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      navigate("/movies");
    }
  };

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
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

      {/* A cool wash over the footage so the warm trailer grade does not fight
          the blue brand palette everywhere below it. */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 90% at 78% 18%, rgba(37,99,235,0.22) 0%, rgba(56,189,248,0.08) 40%, transparent 70%)",
          mixBlendMode: "screen",
        }}
      />

      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-10"
        style={{ background: "linear-gradient(90deg, transparent, var(--cp-accent), transparent)" }}
      />

      <div
        className="absolute z-20 flex flex-col"
        style={{ bottom: "80px", left: "clamp(24px, 5vw, 80px)", maxWidth: "520px", gap: "20px" }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full w-fit"
          style={{
            border: "1px solid rgba(125,211,252,0.4)",
            backgroundColor: "rgba(56,189,248,0.1)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--cp-accent)" }}
          />
          <span style={{ color: "var(--cp-accent-soft)", fontSize: "0.7rem", letterSpacing: "0.15em", fontWeight: 600 }}>
            NOW SHOWING IN THEATRES
          </span>
        </div>

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
          <span className="cp-grad-text">Like Never</span>{" "}
          Before
        </h1>

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

        <div className="flex flex-wrap gap-3">
          <button
            onClick={goToBooking}
            className="cp-btn px-8 py-4"
            style={{ fontSize: "0.9rem", letterSpacing: "0.03em" }}
          >
            <Ticket size={16} />
            Book Your Movie
          </button>

          <button
            onClick={() => navigate("/movies")}
            className="cp-btn-ghost px-6 py-3"
            style={{ fontSize: "0.9rem" }}
          >
            <Play size={14} fill="currentColor" />
            Browse Films
          </button>
        </div>

        {/* These were "200+ Movies" and "50+ Screens" — invented counts that read
            as a lie the moment the catalogue is empty, which the demo-readiness
            audit flagged. Venue capabilities make the same impression without
            claiming a number the API can contradict. */}
        <div className="flex gap-8 flex-wrap" style={{ paddingTop: "8px" }}>
          {[
            { value: "4K", label: "Laser" },
            { value: "Dolby", label: "Atmos" },
            { value: "IMAX", label: "& 4DX" },
            { value: "Recliner", label: "Seating" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span style={{ color: "var(--cp-accent-soft)", fontSize: "1.25rem", fontWeight: 800, lineHeight: 1 }}>
                {value}
              </span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* The SCROLL chevron that used to sit here is gone: the booking card now
          overlaps the hero's bottom edge, and a card visibly cut off by the fold
          is a stronger "keep going" signal than a bouncing arrow. */}
    </section>
  );
}
