import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

const GENRES = ["All", "Action", "Drama", "Comedy", "Horror", "Sci-Fi", "Romance", "Thriller", "Animation"];

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");

  return (
    <section
      className="relative z-10 w-full"
      style={{ backgroundColor: "#050505", paddingTop: "0", marginTop: "-2px" }}
    >
      <div className="max-w-5xl mx-auto px-6" style={{ paddingBottom: "48px" }}>
        {/* Search input */}
        <div
          className="relative flex items-center rounded-2xl overflow-hidden mb-6"
          style={{
            border: "1px solid rgba(255,215,0,0.2)",
            backgroundColor: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
          }}
        >
          <Search
            size={20}
            className="absolute left-5"
            style={{ color: "rgba(255,215,0,0.6)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies by name or genre..."
            className="w-full bg-transparent outline-none"
            style={{
              padding: "18px 56px",
              color: "white",
              fontSize: "1rem",
            }}
          />
          <button
            className="absolute right-4 flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFA500)",
              color: "#050505",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Genre pills */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setActiveGenre(genre)}
              className="whitespace-nowrap px-5 py-2 rounded-full transition-all duration-200 hover:scale-105"
              style={
                activeGenre === genre
                  ? {
                      background: "linear-gradient(135deg, #FFD700, #FFA500)",
                      color: "#050505",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      letterSpacing: "0.05em",
                    }
                  : {
                      border: "1px solid rgba(255,255,255,0.12)",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.55)",
                      fontSize: "0.8rem",
                      letterSpacing: "0.05em",
                    }
              }
            >
              {genre}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
