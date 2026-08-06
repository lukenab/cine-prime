import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Calendar, RefreshCw } from "lucide-react";
import { MovieCard, Movie } from "../../layouts/MovieCard";
import type { MovieApiResponse } from "../../api/movieApi";
import { TrailerModal } from "./TrailerModal";

type Props = {
  movies: MovieApiResponse[];
  loading?: boolean;
  error?: string;
};

type TabKey = "now-showing" | "coming-soon";

function formatDuration(minutes?: number): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
}

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return "TBA";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toCardMovie(movie: MovieApiResponse, comingSoon: boolean): Movie {
  return {
    id: movie.movieId,
    title: movie.movieNameEnglish || movie.movieNameVn || "Untitled Movie",
    genre: movie.movieType?.[0] || "Cinema",
    duration: formatDuration(movie.duration),
    image: movie.largeImage || movie.smallImage,
    badge: comingSoon ? undefined : (movie.movieId % 2 === 0 ? "NEW" : "HOT"),
    badgeColor: movie.movieId % 2 === 0 ? "#8A2BE2" : "#FF4500",
    releaseLabel: comingSoon ? formatReleaseDate(movie.releaseDate) : undefined,
    trailerUrl: movie.trailerUrl,
  };
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "now-showing", label: "Now Showing" },
  { key: "coming-soon", label: "Coming Soon" },
];

export function MovieShowcase({ movies, loading = false, error = "" }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabKey>("now-showing");
  const [trailerMovie, setTrailerMovie] = useState<MovieApiResponse | null>(null);

  const nowShowing = useMemo(() => movies.filter((m) => m.displayStatus === "NOW_SHOWING"), [movies]);
  const comingSoon = useMemo(() => movies.filter((m) => m.displayStatus === "COMING_SOON"), [movies]);

  const visibleMovies = tab === "now-showing" ? nowShowing : comingSoon;
  const cardMovies = useMemo(
    () => visibleMovies.map((m) => toCardMovie(m, tab === "coming-soon")),
    [visibleMovies, tab]
  );

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -480 : 480, behavior: "smooth" });
  };

  return (
    <section style={{ paddingBottom: "64px" }}>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl"
              style={{ backgroundColor: "rgba(37,99,235,0.16)", border: "1px solid rgba(96,165,250,0.3)" }}
            >
              {tab === "now-showing" ? (
                <Flame size={18} style={{ color: "#60A5FA" }} />
              ) : (
                <Calendar size={18} style={{ color: "#60A5FA" }} />
              )}
            </div>
            <div>
              <h2 style={{ color: "white", fontWeight: 800, fontSize: "1.6rem", lineHeight: 1.2 }}>
                {tab === "now-showing" ? "Now Showing" : "Coming Soon"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                {loading
                  ? "Loading movies..."
                  : tab === "now-showing"
                    ? `${cardMovies.length} movies available this week`
                    : "Get notified before tickets sell out"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex gap-1.5 rounded-full p-1" style={{ border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.03)" }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all duration-200 cursor-pointer"
                  style={
                    tab === t.key
                      ? { background: "linear-gradient(135deg, #2563EB, #3B82F6)", color: "#FFFFFF" }
                      : { color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => scroll("left")}
                className="flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 hover:scale-110"
                style={{ border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)", color: "white" }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scroll("right")}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110"
                style={{ background: "linear-gradient(135deg, #2563EB, #3B82F6)", color: "#FFFFFF" }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.6)", minHeight: "360px" }}>
            <RefreshCw size={18} className="animate-spin" />
            <span>Loading movies...</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ color: "rgba(255,255,255,0.65)", minHeight: "120px" }}>{error}</div>
        )}

        {!loading && !error && cardMovies.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.65)", minHeight: "120px" }}>
            {tab === "now-showing" ? "No movies are available yet." : "No upcoming movies yet."}
          </div>
        )}

        {!loading && !error && cardMovies.length > 0 && (
          <div
            ref={scrollRef}
            className="flex overflow-x-auto pb-4"
            style={{ gap: "20px", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {cardMovies.map((movie, index) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onTrailer={() => setTrailerMovie(visibleMovies[index])}
              />
            ))}
          </div>
        )}
      </div>

      <TrailerModal movie={trailerMovie} onClose={() => setTrailerMovie(null)} />
    </section>
  );
}
