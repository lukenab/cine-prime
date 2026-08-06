import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Film, RefreshCw, Ticket, Play, Clock, Calendar } from "lucide-react";
import { movieApi, type MovieApiResponse } from "../../api/movieApi";
import { mockMovies } from "../../data/mockMovies";
import { TrailerModal } from "../../components/shared/TrailerModal";

const GENRES = ["All", "Action", "Drama", "Comedy", "Horror", "Sci-Fi", "Romance", "Thriller", "Animation", "Family", "Adventure", "Crime"];

function formatDuration(minutes?: number): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
}

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return "Coming Soon";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Coming Soon";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PosterCard({
  movie,
  onBuy,
  onTrailer,
}: {
  movie: MovieApiResponse;
  onBuy: () => void;
  onTrailer: () => void;
}) {
  const isComingSoon = movie.displayStatus === "COMING_SOON";

  return (
    <div
      onClick={onBuy}
      className="group relative cursor-pointer overflow-hidden rounded-2xl"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="relative" style={{ aspectRatio: "2/3" }}>
        <img
          src={movie.largeImage || movie.smallImage}
          alt={movie.movieNameVn || movie.movieNameEnglish}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.15) 55%, transparent 100%)" }}
        />

        {/* Top-right badge: real (fake, deterministic) rating for now-showing films — doesn't make
            sense for an unreleased film, so coming-soon films show the release date here instead. */}
        <div
          className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg px-2 py-1"
          style={{ backgroundColor: "rgba(5,5,5,0.75)", backdropFilter: "blur(8px)" }}
        >
          {isComingSoon ? (
            <>
              <Calendar size={10} style={{ color: "#FFD700" }} />
              <span style={{ color: "#FFD700", fontSize: "0.65rem", fontWeight: 700 }}>{formatReleaseDate(movie.releaseDate)}</span>
            </>
          ) : (
            <span className="text-[10px] font-bold uppercase text-white/55">Now showing</span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {movie.movieType?.[0] || "Cinema"}
          </span>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", marginTop: "3px", lineHeight: 1.3 }}>
            {movie.movieNameVn || movie.movieNameEnglish}
          </h3>
          <div className="mt-1 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}>
            <Clock size={10} /> {formatDuration(movie.duration)}
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBuy();
            }}
            className="flex w-full max-w-[9rem] items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_22px_rgba(37,99,235,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-400 hover:shadow-[0_10px_26px_rgba(37,99,235,0.4)]"
          >
            <Ticket size={12} /> Buy tickets
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTrailer();
            }}
            className="flex w-full max-w-[9rem] items-center justify-center gap-1.5 rounded-lg border border-blue-400/45 bg-slate-950/80 px-4 py-2.5 text-xs font-bold text-blue-100 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300/80 hover:bg-blue-950/80 hover:text-white"
          >
            <Play size={12} fill="currentColor" /> Watch trailer
          </button>
        </div>
      </div>
    </div>
  );
}

function MovieSection({
  id,
  title,
  movies,
  onBuy,
  onTrailer,
}: {
  id: string;
  title: string;
  movies: MovieApiResponse[];
  onBuy: (movie: MovieApiResponse) => void;
  onTrailer: (movie: MovieApiResponse) => void;
}) {
  if (movies.length === 0) return null;

  return (
    // scroll-mt-24 keeps the section clear of the fixed navbar (h-16) when the navbar
    // dropdown links here via #now-showing / #coming-soon.
    <div id={id} className="mb-12 last:mb-0 scroll-mt-24">
      <h2 className="mb-5 text-xl font-extrabold text-white sm:text-2xl">
        {title} <span className="text-white/40 font-semibold">({movies.length})</span>
      </h2>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {movies.map((movie) => (
          <PosterCard
            key={movie.movieId}
            movie={movie}
            onBuy={() => onBuy(movie)}
            onTrailer={() => onTrailer(movie)}
          />
        ))}
      </div>
    </div>
  );
}

export default function MoviesPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("search") ?? "");
  const [activeGenre, setActiveGenre] = useState("All");
  const [trailerMovie, setTrailerMovie] = useState<MovieApiResponse | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    movieApi
      .getPublicMovies()
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

  // Navbar "Movies" dropdown links here as /movies#now-showing / #coming-soon — scroll to the
  // matching section once it's actually in the DOM (sections don't exist until data has loaded).
  // Re-runs on hash change too, so clicking the dropdown while already on this page still scrolls.
  useEffect(() => {
    if (loading) return;
    const hash = location.hash.replace("#", "");
    if (!hash) return;
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, location.hash]);

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

  // getPublicMovies() already only returns movies with a derived displayStatus of
  // NOW_SHOWING/COMING_SOON (see MovieService.findAllPublic on the backend, MOV-LC-07)
  // — DRAFT/PENDING_REVIEW/CHANGES_REQUESTED/ARCHIVED content never reaches this page,
  // so no extra filtering is needed here beyond splitting into the two sections.
  // mockMovies (offline/error fallback) predates displayStatus and has no such field
  // — treat it as now-showing.
  const nowShowing = useMemo(() => filtered.filter((m) => m.displayStatus !== "COMING_SOON"), [filtered]);
  const comingSoon = useMemo(() => filtered.filter((m) => m.displayStatus === "COMING_SOON"), [filtered]);

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

      {/* Sections: Now Showing / Coming Soon */}
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
            <MovieSection
              id="now-showing"
              title="Now Showing"
              movies={nowShowing}
              onBuy={(movie) => navigate(`/showtime/${movie.movieId}`)}
              onTrailer={setTrailerMovie}
            />
            <MovieSection
              id="coming-soon"
              title="Coming Soon"
              movies={comingSoon}
              onBuy={(movie) => navigate(`/showtime/${movie.movieId}`)}
              onTrailer={setTrailerMovie}
            />
          </>
        )}
      </div>

      <TrailerModal movie={trailerMovie} onClose={() => setTrailerMovie(null)} />
    </div>
  );
}
