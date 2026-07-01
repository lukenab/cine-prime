import { useState, useEffect, useCallback } from "react";
import { Search, Plus, SlidersHorizontal, RefreshCw, AlertCircle } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { MovieStatsCards } from "../../layouts/MovieStatsCards";
import { MovieTable } from "../../layouts/MovieTable";
import { MovieModal } from "../../layouts/MovieModal";
import { MovieDetailModal } from "../../layouts/MovieDetailModal";
import {
  movieApi,
  type MovieApiResponse,
  type TypeResponse,
  type RoomResponse,
  type CreateMoviePayload,
  type UpdateMoviePayload,
} from "../../api/movieApi";

export default function ManageMoviePage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [types, setTypes] = useState<TypeResponse[]>([]);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMovie, setEditMovie] = useState<MovieApiResponse | null>(null);
  const [detailMovie, setDetailMovie] = useState<MovieApiResponse | null>(null);

  // ── Load movies from API ──────────────────────────────────────────────────
  const loadMovies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await movieApi.getAllMovies();
      setMovies(res.result ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Failed to load movies. Is movie-service running?";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load types + rooms once on mount ─────────────────────────────────────
  useEffect(() => {
    loadMovies();
    movieApi.getTypes().then((res) => setTypes(res.result ?? [])).catch(() => {});
    movieApi.getRooms().then((res) => setRooms(res.result ?? [])).catch(() => {});
  }, [loadMovies]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddMovie = () => {
    setEditMovie(null);
    setModalOpen(true);
  };

  const handleEditMovie = (movie: MovieApiResponse) => {
    setEditMovie(movie);
    setModalOpen(true);
  };

  const handleViewMovie = (movie: MovieApiResponse) => {
    setDetailMovie(movie);
  };

  const handleDeleteMovie = async (id: number) => {
    try {
      await movieApi.deleteMovie(id);
      setMovies((prev) => prev.filter((m) => m.movieId !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Delete failed.";
      alert(`Error: ${msg}`);
    }
  };

  const handleCreate = async (data: CreateMoviePayload) => {
    try {
      const res = await movieApi.createMovie(data);
      setMovies((prev) => [res.result, ...prev]);
    } catch (err) {
      // Let MovieModal surface the error in its inline banner
      throw err;
    }
  };

  const handleUpdate = async (id: number, data: UpdateMoviePayload) => {
    try {
      const res = await movieApi.updateMovie(id, data);
      setMovies((prev) => prev.map((m) => (m.movieId === id ? res.result : m)));
    } catch (err) {
      // Let MovieModal surface the error in its inline banner
      throw err;
    }
  };

  // ── Genre filter list derived from loaded types ───────────────────────────
  const genreNames = types.map((t) => t.typeName);

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

      <MovieStatsCards movies={movies} loading={loading} />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button
            onClick={loadMovies}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600"
            style={{ fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search by title or director..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500"
              style={{ fontSize: "16px", color: "var(--text-sub)" }}
            >×</button>
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
          onClick={loadMovies}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>

        <button
          onClick={handleAddMovie}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
        >
          <Plus size={16} /> Add New Movie
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div
          className="flex items-center gap-3 flex-wrap p-4 rounded-xl border transition-all mb-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Filter by:</p>

          <div className="flex items-center gap-1 flex-wrap filter-btns">
            <button onClick={() => setGenreFilter("")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!genreFilter ? "active" : ""}`}>
              All Genres
            </button>
            {genreNames.map((g) => (
              <button
                key={g}
                onClick={() => setGenreFilter(genreFilter === g ? "" : g)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${genreFilter === g ? "active" : ""}`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="w-px h-5 mx-1" style={{ background: "var(--border-color)" }} />

          <div className="flex items-center gap-1 filter-btns">
            <button onClick={() => setStatusFilter("")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!statusFilter ? "active" : ""}`}>
              All Status
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === "Showing" ? "" : "Showing")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Showing" ? "active-green" : ""}`}
            >
              Showing
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === "No Upcoming" ? "" : "No Upcoming")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "No Upcoming" ? "active-rose" : ""}`}
            >
              No Upcoming
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && movies.length === 0 && (
        <div className="rounded-2xl border p-8 text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <RefreshCw size={20} className="animate-spin mx-auto mb-3" style={{ color: "var(--text-sub)" }} />
          <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading movies…</p>
        </div>
      )}

      {!loading && (
        <MovieTable
          movies={movies}
          onView={handleViewMovie}
          onEdit={handleEditMovie}
          onDelete={handleDeleteMovie}
          searchQuery={searchQuery}
          genreFilter={genreFilter}
          statusFilter={statusFilter}
        />
      )}

      <MovieModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        editMovie={editMovie}
        types={types}
        rooms={rooms}
      />

      <MovieDetailModal
        open={Boolean(detailMovie)}
        movie={detailMovie}
        onClose={() => setDetailMovie(null)}
      />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
        .action-btn:hover { background-color: rgba(128,128,128,0.1); color: var(--text-main) !important; }

        .filter-btns button { background: transparent; color: var(--text-sub); border-color: var(--border-color); }
        .filter-btns button:hover { background: rgba(128,128,128,0.1); color: var(--text-main); }
        .filter-btns button.active      { background: #2563eb !important; color: white !important; border-color: #2563eb !important; }
        .filter-btns button.active-green{ background: #059669 !important; color: white !important; border-color: #059669 !important; }
        .filter-btns button.active-rose { background: #e11d48 !important; color: white !important; border-color: #e11d48 !important; }
      `}</style>
    </>
  );
}
