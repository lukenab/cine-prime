import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Film, RefreshCw, Ticket, Star, Clock } from "lucide-react";
import { movieApi, type MovieApiResponse } from "../../api/movieApi";
import { mockMovies } from "../../data/mockMovies";
import { enrichMovie } from "../../utils/enrichMovie";
import { MoviePreviewModal } from "../../components/shared/MoviePreviewModal";

const GENRES = ["All", "Action", "Drama", "Comedy", "Horror", "Sci-Fi", "Romance", "Thriller", "Animation", "Family", "Adventure", "Crime"];

function formatDuration(minutes?: number): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
}

function ratingOf(movie: MovieApiResponse): string {
  return (7.6 + ((movie.movieId * 37) % 20) / 10).toFixed(1);
}

function PosterCard({ movie, onOpen }: { movie: MovieApiResponse; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-2xl"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="relative" style={{ aspectRatio: "2/3" }}>
        <img
          src={movie.largeImage || movie.smallImage}
          alt={movie.movieNameEnglish || movie.movieNameVn}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.15) 55%, transparent 100%)" }}
        />

        <div
          className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg px-2 py-1"
          style={{ backgroundColor: "rgba(5,5,5,0.75)", backdropFilter: "blur(8px)" }}
        >
          <Star size={10} fill="#FFD700" style={{ color: "#FFD700" }} />
          <span style={{ color: "#FFD700", fontSize: "0.7rem", fontWeight: 700 }}>{ratingOf(movie)}</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {movie.movieType?.[0] || "Cinema"}
          </span>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", marginTop: "3px", lineHeight: 1.3 }}>
            {movie.movieNameEnglish || movie.movieNameVn}
          </h3>
          <div className="mt-1 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}>
            <Clock size={10} /> {formatDuration(movie.duration)}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-extrabold"
            style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#050505", boxShadow: "0 8px 24px rgba(255,215,0,0.4)" }}
          >
            <Ticket size={14} /> View Details
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MoviesPage() {
  const [searchParams] = useSearchParams();
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("search") ?? "");
  const [activeGenre, setActiveGenre] = useState("All");
  const [selectedMovie, setSelectedMovie] = useState<MovieApiResponse | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    movieApi
      .getAllMovies()
      .then((res) => {
        const data = res.result ?? [];
        if (active) setMovies(data.length > 0 ? data : mockMovies);
      })
      .catch(() => {
        if (active) setMovies(mockMovies);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const withPosters = useMemo(
    () => movies.filter((m) => m.status !== false && (m.largeImage || m.smallImage)),
    [movies]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withPosters.filter((m) => {
      const matchesQuery =
        !q ||
        m.movieNameEnglish?.toLowerCase().includes(q) ||
        m.movieNameVn?.toLowerCase().includes(q) ||
        m.movieType?.some((t) => t.toLowerCase().includes(q));
      const matchesGenre = activeGenre === "All" || m.movieType?.includes(activeGenre);
      return matchesQuery && matchesGenre;
    });
  }, [withPosters, query, activeGenre]);

  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: "#050505" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 pb-8 pt-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-1 flex items-center gap-2.5">
            <Film size={20} style={{ color: "#FFD700" }} />
            <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              Full Catalogue
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">All Movies</h1>
          <p className="mt-1.5 text-sm text-white/45">Browse everything currently showing at CinePrime</p>

          {/* Search */}
          <div
            className="mt-6 flex items-center gap-3 rounded-2xl px-4"
            style={{ border: "1px solid rgba(255,215,0,0.2)", backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <Search size={16} style={{ color: "rgba(255,215,0,0.6)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or genre..."
              className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder-white/35"
            />
          </div>

          {/* Genre pills */}
          <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setActiveGenre(genre)}
                className="whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition-all duration-200 hover:scale-105 cursor-pointer"
                style={
                  activeGenre === genre
                    ? { background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#050505", fontWeight: 700 }
                    : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)" }
                }
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-white/60">
            <RefreshCw size={18} className="animate-spin" /> Loading movies...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-white/40">
            No movies found{query ? ` for "${query}"` : ""}.
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-white/40">{filtered.length} movies</p>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((movie) => (
                <PosterCard key={movie.movieId} movie={movie} onOpen={() => setSelectedMovie(enrichMovie(movie))} />
              ))}
            </div>
          </>
        )}
      </div>

      <MoviePreviewModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
    </div>
  );
}
