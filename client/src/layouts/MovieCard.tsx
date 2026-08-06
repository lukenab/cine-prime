import { Clock, Ticket, Calendar, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Movie {
  id: number;
  title: string;
  genre: string;
  rating?: number;
  duration: string;
  image: string;
  badge?: string;
  badgeColor?: string;
  /** When set, the top-right badge shows this release-date label with a calendar icon
   *  instead of the star rating — a numeric rating doesn't make sense for an unreleased film. */
  releaseLabel?: string;
  trailerUrl?: string;
}

interface MovieCardProps {
  movie: Movie;
  onTrailer?: () => void;
}

export function MovieCard({ movie, onTrailer }: MovieCardProps) {
  const navigate = useNavigate();
  const handleBook = () => navigate(`/showtime/${movie.id}`);

  return (
    // The scale/shadow/z-index hover used to be written imperatively onto element.style from JS
    // mouse-hover handlers. Inline styles outrank any stylesheet rule, so nothing coming from a
    // class could ever override them — the hover is now pure CSS via Tailwind utilities.
    // `group` must stay: the CTA overlay below relies on `group-hover:opacity-100`.
    <div
      onClick={handleBook}
      className="group relative flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10 hover:shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
      style={{ width: "240px" }}
    >
      {/* Poster */}
      <div className="relative" style={{ height: "360px" }}>
        <img
          src={movie.image}
          alt={movie.title}
          className="w-full h-full object-cover"
          style={{ transition: "filter 0.3s ease" }}
        />

        {/* Dark gradient over poster */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.1) 60%, transparent 100%)",
          }}
        />

        {/* Badge */}
        {movie.badge && (
          <div
            className="absolute top-3 left-3 px-2 py-0.5 rounded-md"
            style={{
              backgroundColor: movie.badgeColor ?? "#38BDF8",
              color: "#050505",
              fontSize: "0.65rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
            }}
          >
            {movie.badge}
          </div>
        )}

        {/* Rating / release date */}
        {(movie.releaseLabel || movie.rating != null) && <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg"
          style={{ backgroundColor: "rgba(5,5,5,0.75)", backdropFilter: "blur(8px)" }}
        >
          {movie.releaseLabel ? (
            <>
              <Calendar size={10} style={{ color: "#7DD3FC" }} />
              <span style={{ color: "#7DD3FC", fontSize: "0.65rem", fontWeight: 700 }}>{movie.releaseLabel}</span>
            </>
          ) : (
            <span style={{ color: "#7DD3FC", fontSize: "0.7rem", fontWeight: 700 }}>{movie.rating}</span>
          )}
        </div>}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4" style={{ gap: "6px", display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.65rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {movie.genre}
          </span>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.3 }}>
            {movie.title}
          </h3>
          <div className="flex items-center gap-1" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}>
            <Clock size={10} />
            <span>{movie.duration}</span>
          </div>
        </div>
      </div>

      {/* Hover overlay CTA */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backdropFilter: "blur(0px)" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleBook();
          }}
          className="flex w-full max-w-[9rem] items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-white shadow-[0_8px_22px_rgba(37,99,235,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(37,99,235,0.4)]"
          style={{
            background: "linear-gradient(135deg, #2563EB, #38BDF8)",
            fontWeight: 800,
            fontSize: "0.75rem",
          }}
        >
          <Ticket size={12} />
          Buy tickets
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTrailer?.();
          }}
          className="flex w-full max-w-[9rem] items-center justify-center gap-1.5 rounded-lg border bg-slate-950/80 px-4 py-2.5 text-xs font-bold text-blue-100 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-950/80 hover:text-white"
          style={{ borderColor: "rgba(125,211,252,0.4)" }}
        >
          <Play size={12} fill="currentColor" />
          Watch trailer
        </button>
      </div>
    </div>
  );
}

export type { Movie };
