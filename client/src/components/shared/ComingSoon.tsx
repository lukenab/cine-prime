import { Calendar, Bell } from "lucide-react";

interface ComingMovie {
  id: number;
  title: string;
  genre: string;
  releaseDate: string;
  image: string;
  description: string;
  accentColor: string;
}

const COMING_SOON: ComingMovie[] = [
  {
    id: 1,
    title: "Phantom Circuit",
    genre: "Sci-Fi · Thriller",
    releaseDate: "July 11, 2026",
    image:
      "https://images.unsplash.com/photo-1748194257139-1feac0b719d1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHxhZHZlbnR1cmUlMjBhY3Rpb24lMjBoZXJvJTIwZHJhbWF0aWMlMjBzY2VuZXxlbnwxfHx8fDE3ODA5MTk1Njd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    description:
      "In a world where memories can be extracted and sold, one rogue detective uncovers a conspiracy that threatens humanity's consciousness.",
    accentColor: "#8A2BE2",
  },
  {
    id: 2,
    title: "The Obsidian Crown",
    genre: "Fantasy · Drama",
    releaseDate: "August 4, 2026",
    image:
      "https://images.unsplash.com/photo-1759354192456-71975b190c51?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHxkcmFtYXRpYyUyMHBvcnRyYWl0JTIwY2luZW1hdGljJTIwbGlnaHRpbmclMjBkYXJrfGVufDF8fHx8MTc4MDkxOTU2Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    description:
      "A reluctant queen must forge an unlikely alliance to reclaim her kingdom from the forces of an ancient and malevolent sorcerer.",
    accentColor: "#FFD700",
  },
  {
    id: 3,
    title: "Storm Protocol",
    genre: "Action · Adventure",
    releaseDate: "September 19, 2026",
    image:
      "https://images.unsplash.com/photo-1771620868886-8c4b033e31b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxhZHZlbnR1cmUlMjBhY3Rpb24lMjBoZXJvJTIwZHJhbWF0aWMlMjBzY2VuZXxlbnwxfHx8fDE3ODA5MTk1Njd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    description:
      "A covert rescue mission in the world's most unforgiving terrain becomes a desperate fight for survival when the team is compromised.",
    accentColor: "#00CED1",
  },
];

export function ComingSoon() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, #050505 0%, #080818 50%, #050505 100%)",
        paddingBottom: "80px",
        paddingTop: "16px",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ backgroundColor: "rgba(138,43,226,0.15)", border: "1px solid rgba(138,43,226,0.3)" }}
          >
            <Calendar size={18} style={{ color: "#8A2BE2" }} />
          </div>
          <div>
            <h2 style={{ color: "white", fontWeight: 800, fontSize: "1.6rem", lineHeight: 1.2 }}>
              Coming Soon
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
              Get notified before tickets sell out
            </p>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COMING_SOON.map((movie) => (
            <div
              key={movie.id}
              className="group relative rounded-2xl overflow-hidden cursor-pointer"
              style={{
                border: "1px solid rgba(255,255,255,0.07)",
                backgroundColor: "rgba(255,255,255,0.03)",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(-6px)";
                el.style.boxShadow = `0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px ${movie.accentColor}40`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(0)";
                el.style.boxShadow = "none";
              }}
            >
              {/* Image */}
              <div className="relative overflow-hidden" style={{ height: "240px" }}>
                <img
                  src={movie.image}
                  alt={movie.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to bottom, transparent 40%, rgba(5,5,5,0.95) 100%)`,
                  }}
                />

                {/* Coming soon badge */}
                <div
                  className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: `${movie.accentColor}20`,
                    border: `1px solid ${movie.accentColor}50`,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: movie.accentColor }}
                  />
                  <span style={{ color: movie.accentColor, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em" }}>
                    COMING SOON
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {movie.genre}
                  </span>
                  <h3 style={{ color: "white", fontWeight: 700, fontSize: "1.1rem", marginTop: "4px", lineHeight: 1.3 }}>
                    {movie.title}
                  </h3>
                </div>

                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                  {movie.description}
                </p>

                <div className="flex items-center justify-between" style={{ marginTop: "4px" }}>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} style={{ color: movie.accentColor }} />
                    <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.78rem" }}>{movie.releaseDate}</span>
                  </div>

                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105"
                    style={{
                      border: `1px solid ${movie.accentColor}40`,
                      backgroundColor: `${movie.accentColor}12`,
                      color: movie.accentColor,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    <Bell size={11} />
                    Notify Me
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
