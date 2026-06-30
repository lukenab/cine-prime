import { Star, Clock, Ticket } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Movie {
  id: number;
  title: string;
  genre: string;
  rating: number;
  duration: string;
  image: string;
  badge?: string;
  badgeColor?: string;
}

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        width: "220px",
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.07)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,215,0,0.25)";
        (e.currentTarget as HTMLDivElement).style.zIndex = "10";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.zIndex = "1";
      }}
    >
      {/* Poster */}
      <div className="relative" style={{ height: "330px" }}>
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

        {/* Rating */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg"
          style={{ backgroundColor: "rgba(5,5,5,0.75)", backdropFilter: "blur(8px)" }}
        >
          <Star size={10} fill="#FFD700" style={{ color: "#FFD700" }} />
          <span style={{ color: "#FFD700", fontSize: "0.7rem", fontWeight: 700 }}>{movie.rating}</span>
        </div>

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
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ backdropFilter: "blur(0px)" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/showtime/${movie.id}`);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full"
          style={{
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            color: "#050505",
            fontWeight: 800,
            fontSize: "0.8rem",
            transform: "translateY(4px)",
            transition: "transform 0.3s ease",
            boxShadow: "0 8px 24px rgba(255,215,0,0.4)",
          }}
        >
          <Ticket size={13} />
          Book Ticket
        </button>
      </div>
    </div>
  );
}

export type { Movie };
