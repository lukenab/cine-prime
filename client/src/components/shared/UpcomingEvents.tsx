import { useNavigate } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { mockEvents } from "../../data/mockEvents";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function UpcomingEvents() {
  const navigate = useNavigate();
  const events = mockEvents.slice(0, 3);

  return (
    <section
      style={{ backgroundColor: "#050505", paddingTop: "80px", paddingBottom: "80px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
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

        {/* Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.eventId}
              onClick={() => navigate("/events")}
              className="group relative cursor-pointer overflow-hidden rounded-2xl"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <div className="relative h-40 w-full overflow-hidden">
                <img
                  src={event.image}
                  alt={event.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,5,5,0.9), transparent 60%)" }} />
                <div
                  className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1"
                  style={{ backgroundColor: `${event.accentColor}20`, border: `1px solid ${event.accentColor}50`, backdropFilter: "blur(8px)" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: event.accentColor }} />
                  <span style={{ color: event.accentColor, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em" }}>
                    {event.tag.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-[15px] font-bold text-white leading-snug">{event.title}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/50">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} style={{ color: event.accentColor }} /> {formatDate(event.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} style={{ color: event.accentColor }} /> {formatTime(event.time)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
