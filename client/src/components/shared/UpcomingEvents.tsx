import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function UpcomingEvents() {
  const navigate = useNavigate();

  return (
    <section
      style={{ paddingTop: "80px", paddingBottom: "80px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              At The Cinema
            </span>
            <h2 style={{ color: "white", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", marginTop: "10px", lineHeight: 1.15 }}>
              Upcoming{" "}
              <span
                style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                Events
              </span>
            </h2>
          </div>
          <button
            onClick={() => navigate("/events")}
            className="group flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={{ color: "#FFD700", background: "none", border: "none" }}
          >
            View all events
            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>

        {/* Loading placeholders. Replace with API-backed events when the events service is connected. */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-2xl animate-pulse"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <div className="h-40 w-full bg-white/[0.08]" />

              <div className="p-5">
                <div className="h-4 w-2/3 rounded bg-white/[0.10]" />
                <div className="mt-4 flex gap-4">
                  <div className="h-3 w-24 rounded bg-white/[0.08]" />
                  <div className="h-3 w-16 rounded bg-white/[0.08]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
