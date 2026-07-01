import { Zap, Volume2, Monitor, Armchair } from "lucide-react";

const FEATURES = [
  {
    icon: Monitor,
    title: "4K Ultra HD",
    description: "Crystal-clear projection on massive screens up to 30 metres wide.",
    color: "#FFD700",
  },
  {
    icon: Volume2,
    title: "Dolby Atmos",
    description: "Immersive 3D sound that fills the entire theatre with breathtaking audio.",
    color: "#8A2BE2",
  },
  {
    icon: Armchair,
    title: "Recliner Seats",
    description: "Fully electric leather recliners with footrests and heated cushions.",
    color: "#00CED1",
  },
  {
    icon: Zap,
    title: "4DX & IMAX",
    description: "Motion seats, wind, rain effects, and the largest screens in the world.",
    color: "#FF4500",
  },
];

export function ExperienceBanner() {
  return (
    <section
      style={{
        background: "linear-gradient(135deg, #07071a 0%, #0d0d2e 50%, #07071a 100%)",
        paddingTop: "80px",
        paddingBottom: "80px",
        borderTop: "1px solid rgba(138,43,226,0.15)",
        borderBottom: "1px solid rgba(138,43,226,0.15)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span
            style={{
              color: "#8A2BE2",
              fontSize: "0.7rem",
              letterSpacing: "0.25em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Why Choose CinePrime
          </span>
          <h2
            style={{
              color: "white",
              fontWeight: 800,
              fontSize: "clamp(1.6rem, 4vw, 2.5rem)",
              marginTop: "12px",
              lineHeight: 1.2,
            }}
          >
            The Ultimate{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #8A2BE2, #FF00FF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Cinema Experience
            </span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", marginTop: "12px" }}>
            State-of-the-art technology meets luxurious comfort for an unparalleled night out.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, color }) => (
            <div
              key={title}
              className="group relative p-6 rounded-2xl cursor-default transition-all duration-300 hover:-translate-y-2"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = `${color}30`;
                el.style.backgroundColor = `${color}08`;
                el.style.boxShadow = `0 20px 50px rgba(0,0,0,0.4), 0 0 0 1px ${color}20`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "rgba(255,255,255,0.06)";
                el.style.backgroundColor = "rgba(255,255,255,0.03)";
                el.style.boxShadow = "none";
              }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                style={{
                  backgroundColor: `${color}15`,
                  border: `1px solid ${color}25`,
                }}
              >
                <Icon size={22} style={{ color }} />
              </div>

              {/* Glow dot */}
              <div
                className="absolute top-5 right-5 w-1.5 h-1.5 rounded-full opacity-60"
                style={{ backgroundColor: color }}
              />

              <h3 style={{ color: "white", fontWeight: 700, fontSize: "1rem", marginBottom: "8px" }}>
                {title}
              </h3>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", lineHeight: 1.65 }}>
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-12 p-8 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(138,43,226,0.15) 0%, rgba(255,215,0,0.08) 100%)",
            border: "1px solid rgba(138,43,226,0.2)",
          }}
        >
          <div>
            <h3 style={{ color: "white", fontWeight: 700, fontSize: "1.2rem" }}>
              Ready for an unforgettable night?
            </h3>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.85rem", marginTop: "4px" }}>
              Join 2 million+ movie lovers who book with CinePrime every month.
            </p>
          </div>
          <button
            className="flex-shrink-0 px-8 py-3.5 rounded-full transition-all duration-200 hover:scale-105 hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFA500)",
              color: "#050505",
              fontWeight: 800,
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
              boxShadow: "0 8px 32px rgba(255,215,0,0.3)",
            }}
          >
            Browse All Movies
          </button>
        </div>
      </div>
    </section>
  );
}
