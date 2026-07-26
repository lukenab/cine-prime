import { useState, useEffect, useCallback } from "react";
import { Search, Plus, SlidersHorizontal, RefreshCw, AlertCircle } from "lucide-react";
import { useRole } from "../../hooks/useRole";
import { Outlet, useOutletContext, useNavigate } from "react-router-dom";

import { MovieStatsCards } from "../../layouts/MovieStatsCards";
import { MovieTable } from "../../layouts/MovieTable";
import { MovieDetailModal } from "../../layouts/MovieDetailModal";
import {
  movieApi,
  type MovieApiResponse,
  type GenreResponse,
  type MovieResponse,
} from "../../api/movieApi";
import {
  MOVIE_CONTENT_STATUS_META,
  toMovieContentStatus,
  type MovieContentStatus,
} from "../../utils/movieContentStatus";

export default function ManageMoviePage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const { isAdmin } = useRole();
  const navigate = useNavigate();

  const [movies, setMovies] = useState<MovieApiResponse[]>([]);

  // Genre names for the filter panel (Add/Edit now happens on a dedicated page - see MovieEditorPage).
  const [genres, setGenres] = useState<GenreResponse[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [detailMovie, setDetailMovie] = useState<MovieResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewMovie, setReviewMovie] = useState<MovieResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

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

  // ── Load lookup data + movies on mount ────────────────────────────────────
  useEffect(() => {
    loadMovies();
    movieApi.getGenres().then((r) => setGenres(r.result ?? [])).catch(() => {});
  }, [loadMovies]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddMovie = () => navigate("/admin/movies/new");

  const handleEditMovie = (movie: MovieApiResponse) => navigate(`/admin/movies/${movie.movieId}/edit`);

  const handleManageAvailability = (id: number) => navigate(`/admin/movies/${id}/availability`);

  const handleViewMovie = async (movie: MovieApiResponse) => {
    setDetailLoading(true);
    setDetailMovie(null);
    try {
      const res = await movieApi.getMovieById(movie.movieId);
      setDetailMovie(res.result);
    } catch {
      setDetailMovie(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteMovie = async (id: number) => {
    try {
      await movieApi.archiveMovie(id);
      await loadMovies();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Archive failed.";
      alert(`Error: ${msg}`);
    }
  };

  // ── Workflow handlers (all follow: call API → reload) ─────────────────────

  const makeWorkflowHandler = (fn: () => Promise<unknown>, label: string) => async () => {
    try { await fn(); await loadMovies(); }
    catch (err: any) { alert(`Error: ${err?.response?.data?.message ?? label + " failed."}`); }
  };

  const handleSubmit    = (id: number) => makeWorkflowHandler(() => movieApi.submitForReview(id),   "Submit")();
  const handleRework = (id: number) =>
    makeWorkflowHandler(() => movieApi.startMovieRevision(id), "Start revision")();

  // ── Pending Review panel (issue #139): fetch full movie detail so the modal has
  // enough context (poster/genre/duration/releaseDate/ageRating/synopsis) to decide. ──
  const handleReviewClick = async (movie: MovieApiResponse) => {
    setReviewLoading(true);
    setReviewMovie(null);
    try {
      const res = await movieApi.getMovieById(movie.movieId);
      setReviewMovie(res.result);
    } catch {
      setReviewMovie(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReviewApprove = async (id: number) => {
    await movieApi.approveMovie(id);
    await loadMovies();
  };

  const handleReviewReject = async (id: number, note: string) => {
    await movieApi.requestMovieChanges(id, note);
    await loadMovies();
  };

  // ── Genre names for filter panel (from v2 genres) ─────────────────────────
  const genreNames = genres.map((g) => g.genreName);

  return (
    <>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px", transition: "color 0.2s ease" }}>
          Movie Management
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px", transition: "color 0.2s ease" }}>
          Manage movie catalog content and its approval workflow
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
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search by title or director..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
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
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: genreFilter ? "#2563eb" : "var(--border-color)" }}
        >
          <SlidersHorizontal size={15} /> Genre
          {genreFilter && <span className="w-2 h-2 bg-blue-600 rounded-full ml-0.5" />}
        </button>

        <button
          onClick={loadMovies} disabled={loading}
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

      {/* Genre filter panel */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl border mb-4 filter-btns"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <button onClick={() => setGenreFilter("")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!genreFilter ? "active" : ""}`}>
            All Genres
          </button>
          {genreNames.map((g) => (
            <button key={g} onClick={() => setGenreFilter(genreFilter === g ? "" : g)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${genreFilter === g ? "active" : ""}`}>
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Status tabs */}
      {(() => {
        const counts: Record<string, number> = {};
        movies.forEach(m => {
          const contentStatus = toMovieContentStatus(m.movieStatus);
          counts[contentStatus] = (counts[contentStatus] ?? 0) + 1;
        });
        const pendingCount = counts["PENDING_REVIEW"] ?? 0;

        const contentStatuses: MovieContentStatus[] = [
          "DRAFT",
          "PENDING_REVIEW",
          "APPROVED",
          "CHANGES_REQUESTED",
          "ARCHIVED",
        ];
        const tabs = [
          { value: "", label: "All", color: "var(--text-sub)" },
          ...contentStatuses.map((value) => ({
            value,
            label: MOVIE_CONTENT_STATUS_META[value].label,
            color: MOVIE_CONTENT_STATUS_META[value].text,
          })),
        ];

        return (
          <div className="flex items-center gap-1 mb-5 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0" }}>
            {tabs.map(({ value, label, color }) => {
              const count = value === "" ? movies.length : (counts[value] ?? 0);
              const isActive = statusFilter === value;
              const isPending = value === "PENDING_REVIEW";
              return (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  style={{
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? color : "var(--text-sub)",
                    background: "transparent",
                    border: "none",
                    borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "-1px",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "var(--text-main)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "var(--text-sub)"; }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      minWidth: "18px", height: "18px", padding: "0 5px",
                      borderRadius: "9px", fontSize: "10px", fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: isActive
                        ? color
                        : (isPending && isAdmin && pendingCount > 0 ? "#ef4444" : "rgba(128,128,128,0.15)"),
                      color: (isActive || (isPending && isAdmin && pendingCount > 0)) ? "#fff" : "var(--text-sub)",
                      transition: "all 0.15s ease",
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

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
          onSubmit={handleSubmit}
          onReviewClick={handleReviewClick}
          onRework={handleRework}
          onManageAvailability={handleManageAvailability}
          searchQuery={searchQuery}
          genreFilter={genreFilter}
          statusFilter={statusFilter}
        />
      )}

      <MovieDetailModal
        open={Boolean(detailMovie) || detailLoading}
        movie={detailMovie}
        loading={detailLoading}
        onClose={() => { setDetailMovie(null); setDetailLoading(false); }}
      />

      <MovieDetailModal
        mode="review"
        open={Boolean(reviewMovie) || reviewLoading}
        movie={reviewMovie}
        loading={reviewLoading}
        onClose={() => { setReviewMovie(null); setReviewLoading(false); }}
        onApprove={handleReviewApprove}
        onReject={handleReviewReject}
      />

      {/* Route-aware creation modal. The movie list remains mounted underneath so filters,
          loaded data and scroll context are preserved while /admin/movies/new is active. */}
      <Outlet />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
        .action-btn:hover { background-color: rgba(128,128,128,0.1); color: var(--text-main) !important; }
        .filter-btns button { background: transparent; color: var(--text-sub); border-color: var(--border-color); }
        .filter-btns button:hover { background: rgba(128,128,128,0.1); color: var(--text-main); }
        .filter-btns button.active { background: #2563eb !important; color: white !important; border-color: #2563eb !important; }
      `}</style>
    </>
  );
}
