import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { MovieCard, Movie } from "../../layouts/MovieCard";
import { movieApi } from "../../api/movieApi";

export function NowShowing() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowShowing, setNowShowing] = useState<Movie[]>([]);

  useEffect(() => {
    movieApi.getAllMovies().then(res => {
      if (res && res.result) {
        const mapped = res.result.map(m => ({
          id: m.movieId,
          title: m.movieNameEnglish,
          genre: m.movieType?.[0] || "Thriller",
          rating: Number((Math.random() * (9.5 - 7.5) + 7.5).toFixed(1)), // Random rating between 7.5 and 9.5
          duration: `${Math.floor(m.duration / 60)}h ${m.duration % 60}m`,
          image: m.smallImage,
          badge: m.movieId % 2 === 0 ? "NEW" : "HOT",
          badgeColor: m.movieId % 2 === 0 ? "#8A2BE2" : "#FF4500"
        }));
        setNowShowing(mapped);
      }
    }).catch(console.error);
  }, []);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -480 : 480, behavior: "smooth" });
  };

  return (
    <section style={{ backgroundColor: "#050505", paddingBottom: "64px" }}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl"
              style={{ backgroundColor: "rgba(255,69,0,0.15)", border: "1px solid rgba(255,69,0,0.25)" }}
            >
              <Flame size={18} style={{ color: "#FF4500" }} />
            </div>
            <div>
              <h2
                style={{
                  color: "white",
                  fontWeight: 800,
                  fontSize: "1.6rem",
                  lineHeight: 1.2,
                }}
              >
                Now Showing
              </h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>{nowShowing.length} movies available this week</p>
            </div>
          </div>

          {/* Scroll controls */}
          <div className="flex gap-2">
            <button
              onClick={() => scroll("left")}
              className="flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 hover:scale-110"
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "white",
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110"
              style={{
                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                color: "#050505",
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Horizontal scroll row */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto pb-4"
          style={{
            gap: "20px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {nowShowing.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>
    </section>
  );
}
