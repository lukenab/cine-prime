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
    <div
      onClick={handleBook}
      className="relative flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        width: "240px",
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.05)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(59,130,246,0.35)";
        (e.currentTarget as HTMLDivElement).style.zIndex = "10";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.zIndex = "1";
      }}
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
              backgroundColor: movie.badgeColor ?? "#FFD700",
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
              <Calendar size={10} style={{ color: "#FFD700" }} />
              <span style={{ color: "#FFD700", fontSize: "0.65rem", fontWeight: 700 }}>{movie.releaseLabel}</span>
            </>
          ) : (
            <span style={{ color: "#FFD700", fontSize: "0.7rem", fontWeight: 700 }}>{movie.rating}</span>
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
          className="flex w-full max-w-[9rem] items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-white shadow-[0_8px_22px_rgba(37,99,235,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-400 hover:shadow-[0_10px_26px_rgba(37,99,235,0.4)]"
          style={{
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
          className="flex w-full max-w-[9rem] items-center justify-center gap-1.5 rounded-lg border border-blue-400/45 bg-slate-950/80 px-4 py-2.5 text-xs font-bold text-blue-100 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300/80 hover:bg-blue-950/80 hover:text-white"
        >
          <Play size={12} fill="currentColor" />
          Watch trailer
        </button>
      </div>
    </div>
  );
}

export type { Movie };
