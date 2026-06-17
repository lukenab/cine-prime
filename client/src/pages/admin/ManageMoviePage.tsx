import { useState } from "react";
import { Search, Plus, SlidersHorizontal, Download } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { MovieStatsCards } from "../../layouts/MovieStatsCards";
import { MovieTable } from "../../layouts/MovieTable";
import { MovieModal, type MovieData } from "../../layouts/MovieModal";

const posterGradients = [
  "linear-gradient(135deg, #1e3a8a, #3b82f6)",
  "linear-gradient(135deg, #831843, #f43f5e)",
  "linear-gradient(135deg, #14532d, #22c55e)",
  "linear-gradient(135deg, #701a75, #d946ef)",
  "linear-gradient(135deg, #78350f, #f59e0b)",
];

const initialMovies: MovieData[] = [
  { id: 1, title: "Dune: Part Two", director: "Denis Villeneuve", genre: "Sci-Fi", status: "Showing", format: "IMAX", posterColor: posterGradients[0], duration: 166, releaseDate: "Mar 1, 2024" },
  { id: 2, title: "Deadpool & Wolverine", director: "Shawn Levy", genre: "Action", status: "Coming Soon", format: "3D", posterColor: posterGradients[1], duration: 127, releaseDate: "Jul 26, 2024" },
  { id: 3, title: "Inside Out 2", director: "Kelsey Mann", genre: "Animation", status: "Showing", format: "2D Standard", posterColor: posterGradients[3], duration: 96, releaseDate: "Jun 14, 2024" },
];

const genres = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Animation"];

export default function ManageMoviePage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [movies, setMovies] = useState<MovieData[]>(initialMovies);
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editMovie, setEditMovie] = useState<MovieData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  let nextId = movies.length > 0 ? Math.max(...movies.map((m) => m.id)) + 1 : 1;

  const handleAddMovie = () => {
    setEditMovie(null);
    setModalOpen(true);
  };

  const handleEditMovie = (movie: MovieData) => {
    setEditMovie(movie);
    setModalOpen(true);
  };

  const handleDeleteMovie = (id: number) => {
    setMovies((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSaveMovie = (data: Omit<MovieData, "id" | "releaseDate" | "posterColor">) => {
    if (editMovie) {
      setMovies((prev) => prev.map((m) => (m.id === editMovie.id ? { ...m, ...data } : m)));
    } else {
      const newMovie: MovieData = {
        ...data,
        id: nextId++,
        posterColor: posterGradients[Math.floor(Math.random() * posterGradients.length)],
        releaseDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };
      setMovies((prev) => [newMovie, ...prev]);
    }
  };

  return (
    <>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px", transition: "color 0.2s ease" }}>
          Movie Management
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px", transition: "color 0.2s ease" }}>
          Manage movie catalog, showtimes, and details
        </p>
      </div>

      <MovieStatsCards />

      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search by title or director..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500" style={{ fontSize: "16px", color: "var(--text-sub)" }}>×</button>
          )}
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <SlidersHorizontal size={15} /> Filters
          {(genreFilter || statusFilter) && <span className="w-2 h-2 bg-blue-600 rounded-full ml-0.5" />}
        </button>

        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <Download size={15} /> Export
        </button>

        <button
          onClick={handleAddMovie}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
        >
          <Plus size={16} /> Add New Movie
        </button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap p-4 rounded-xl border transition-all mb-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Filter by:</p>
          <div className="flex items-center gap-1 flex-wrap filter-btns">
            <button onClick={() => setGenreFilter("")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!genreFilter ? "active" : ""}`}>All Genres</button>
            {genres.map((g) => (
              <button key={g} onClick={() => setGenreFilter(genreFilter === g ? "" : g)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${genreFilter === g ? "active" : ""}`}>{g}</button>
            ))}
          </div>
          <div className="w-px h-5 mx-1" style={{ background: "var(--border-color)" }} />
          <div className="flex items-center gap-1 filter-btns">
            <button onClick={() => setStatusFilter("")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!statusFilter ? "active" : ""}`}>All Status</button>
            <button onClick={() => setStatusFilter(statusFilter === "Showing" ? "" : "Showing")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Showing" ? "active-green" : ""}`}>Showing</button>
            <button onClick={() => setStatusFilter(statusFilter === "Coming Soon" ? "" : "Coming Soon")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Coming Soon" ? "active-blue" : ""}`}>Coming Soon</button>
          </div>
        </div>
      )}

      <MovieTable movies={movies} onEdit={handleEditMovie} onDelete={handleDeleteMovie} searchQuery={searchQuery} genreFilter={genreFilter} statusFilter={statusFilter} />
      <MovieModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveMovie} editMovie={editMovie} />

      <style>{`
        .hover-row:hover { background-color: rgba(128, 128, 128, 0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255, 255, 255, 0.03); }
        
        .action-btn:hover { background-color: rgba(128, 128, 128, 0.1); color: var(--text-main) !important; }

        .filter-btns button { background: transparent; color: var(--text-sub); border-color: var(--border-color); }
        .filter-btns button:hover { background: rgba(128, 128, 128, 0.1); color: var(--text-main); }
        .filter-btns button.active { background: #2563eb !important; color: white !important; border-color: #2563eb !important; }
        .filter-btns button.active-green { background: #059669 !important; color: white !important; border-color: #059669 !important; }
        .filter-btns button.active-blue { background: #3b82f6 !important; color: white !important; border-color: #3b82f6 !important; }
      `}</style>
    </>
  );
}