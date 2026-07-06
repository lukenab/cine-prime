import { Calendar, Clock, MapPin, PartyPopper } from "lucide-react";
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

export default function EventsPage() {
  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: "#050505" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 pb-8 pt-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-1 flex items-center gap-2.5">
            <PartyPopper size={20} style={{ color: "#FFD700" }} />
            <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              At The Cinema
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Events</h1>
          <p className="mt-1.5 text-sm text-white/45">
            Premieres, marathons, and special screenings happening at CinePrime
          </p>
        </div>
      </div>

      {/* List */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-5">
          {mockEvents.map((event) => (
            <div
              key={event.eventId}
              className="group relative flex flex-col overflow-hidden rounded-2xl sm:flex-row"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              {/* Image */}
              <div className="relative h-48 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-72">
                <img
                  src={event.image}
                  alt={event.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to right, transparent 40%, rgba(5,5,5,0.6) 100%)" }}
                />
                <div
                  className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1"
                  style={{
                    backgroundColor: `${event.accentColor}20`,
                    border: `1px solid ${event.accentColor}50`,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: event.accentColor }} />
                  <span style={{ color: event.accentColor, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em" }}>
                    {event.tag.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col justify-center gap-2.5 p-6">
                <div>
                  <h3 className="text-lg font-bold text-white">{event.title}</h3>
                  <p className="mt-0.5 text-sm text-white/50">{event.subtitle}</p>
                </div>
                <p className="text-[13px] leading-relaxed text-white/60">{event.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-white/55">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} style={{ color: event.accentColor }} /> {formatDate(event.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} style={{ color: event.accentColor }} /> {formatTime(event.time)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} style={{ color: event.accentColor }} /> {event.cluster}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
