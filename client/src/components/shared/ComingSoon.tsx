import { Bell, Calendar } from "lucide-react";
import type { MovieApiResponse } from "../../api/movieApi";
import { toDateStr } from "../../api/movieApi";

type Props = {
  movies: MovieApiResponse[];
};

const ACCENT_COLORS = ["#8A2BE2", "#FFD700", "#00CED1"];

function firstShowDate(movie: MovieApiResponse): string {
  const date = movie.showTimes?.[0]?.showDate;
  return date ? toDateStr(date) : "Coming soon";
}

export function ComingSoon({ movies }: Props) {
  const comingMovies = movies.filter((movie) => movie.status !== false).slice(0, 3);

  if (comingMovies.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        background: "linear-gradient(180deg, #050505 0%, #080818 50%, #050505 100%)",
        paddingBottom: "80px",
        paddingTop: "16px",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {comingMovies.map((movie, index) => {
            const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];
            return (
              <div
                key={movie.movieId}
                className="group relative rounded-2xl overflow-hidden cursor-pointer"
                style={{
                  border: "1px solid rgba(255,255,255,0.07)",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(-6px)";
                  el.style.boxShadow = `0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}40`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "none";
                }}
              >
                <div className="relative overflow-hidden" style={{ height: "240px" }}>
                  <img
                    src={movie.largeImage || movie.smallImage}
                    alt={movie.movieNameEnglish || movie.movieNameVn}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to bottom, transparent 40%, rgba(5,5,5,0.95) 100%)",
                    }}
                  />

                  <div
                    className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: `${accentColor}20`,
                      border: `1px solid ${accentColor}50`,
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span
                      style={{
                        color: accentColor,
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                      }}
                    >
                      COMING SOON
                    </span>
                  </div>
                </div>

                <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "0.7rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      {movie.movieType?.join(" · ") || "Cinema"}
                    </span>
                    <h3 style={{ color: "white", fontWeight: 700, fontSize: "1.1rem", marginTop: "4px", lineHeight: 1.3 }}>
                      {movie.movieNameEnglish || movie.movieNameVn}
                    </h3>
                  </div>

                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                    {movie.content || "Movie details will be updated soon."}
                  </p>

                  <div className="flex items-center justify-between" style={{ marginTop: "4px" }}>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} style={{ color: accentColor }} />
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.78rem" }}>
                        {firstShowDate(movie)}
                      </span>
                    </div>

                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105"
                      style={{
                        border: `1px solid ${accentColor}40`,
                        backgroundColor: `${accentColor}12`,
                        color: accentColor,
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
