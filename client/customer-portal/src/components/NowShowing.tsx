import { useRef } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { MovieCard, Movie } from "./MovieCard";

const NOW_SHOWING: Movie[] = [
  {
    id: 1,
    title: "Crimson Veil",
    genre: "Thriller",
    rating: 8.4,
    duration: "2h 18m",
    image:
      "https://images.unsplash.com/photo-1675726205553-4e348f24da2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcmFtYXRpYyUyMHBvcnRyYWl0JTIwY2luZW1hdGljJTIwbGlnaHRpbmclMjBkYXJrfGVufDF8fHx8MTc4MDkxOTU2Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    badge: "HOT",
    badgeColor: "#FF4500",
  },
  {
    id: 2,
    title: "Eclipse Protocol",
    genre: "Sci-Fi",
    rating: 9.1,
    duration: "2h 42m",
    image:
      "https://images.unsplash.com/photo-1748194257310-284797669bbd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZHZlbnR1cmUlMjBhY3Rpb24lMjBoZXJvJTIwZHJhbWF0aWMlMjBzY2VuZXxlbnwxfHx8fDE3ODA5MTk1Njd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    badge: "#1",
    badgeColor: "#FFD700",
  },
  {
    id: 3,
    title: "Shadow Requiem",
    genre: "Drama",
    rating: 7.8,
    duration: "1h 56m",
    image:
      "https://images.unsplash.com/photo-1776197739075-e492fcd2cb46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw4fHxkcmFtYXRpYyUyMHBvcnRyYWl0JTIwY2luZW1hdGljJTIwbGlnaHRpbmclMjBkYXJrfGVufDF8fHx8MTc4MDkxOTU2Nnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: 4,
    title: "Neon Horizon",
    genre: "Action",
    rating: 8.7,
    duration: "2h 05m",
    image:
      "https://images.unsplash.com/photo-1777927519939-671cd6a68a61?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw2fHxkcmFtYXRpYyUyMHBvcnRyYWl0JTIwY2luZW1hdGljJTIwbGlnaHRpbmclMjBkYXJrfGVufDF8fHx8MTc4MDkxOTU2Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    badge: "NEW",
    badgeColor: "#8A2BE2",
  },
  {
    id: 5,
    title: "The Last Signal",
    genre: "Thriller",
    rating: 8.2,
    duration: "2h 12m",
    image:
      "https://images.unsplash.com/photo-1532171875345-9712d9d4f65a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxkcmFtYXRpYyUyMHBvcnRyYWl0JTIwY2luZW1hdGljJTIwbGlnaHRpbmclMjBkYXJrfGVufDF8fHx8MTc4MDkxOTU2Nnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: 6,
    title: "Desert Storm",
    genre: "Adventure",
    rating: 7.5,
    duration: "1h 49m",
    image:
      "https://images.unsplash.com/photo-1772541585835-d2273aebbf8b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxhZHZlbnR1cmUlMjBhY3Rpb24lMjBoZXJvJTIwZHJhbWF0aWMlMjBzY2VuZXxlbnwxfHx8fDE3ODA5MTk1Njd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: 7,
    title: "Midnight Blade",
    genre: "Action",
    rating: 8.9,
    duration: "2h 28m",
    image:
      "https://images.unsplash.com/photo-1764762173441-2fb3c0c8181e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw1fHxhZHZlbnR1cmUlMjBhY3Rpb24lMjBoZXJvJTIwZHJhbWF0aWMlMjBzY2VuZXxlbnwxfHx8fDE3ODA5MTk1Njd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    badge: "4DX",
    badgeColor: "#00CED1",
  },
];

export function NowShowing() {
  const scrollRef = useRef<HTMLDivElement>(null);

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
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>{NOW_SHOWING.length} movies available this week</p>
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
          {NOW_SHOWING.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>
    </section>
  );
}
