import { useState } from "react";
import { Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Clapperboard, Clock } from "lucide-react";
import type { MovieApiResponse } from "../api/movieApi";
import { formatDisplayDate, toDateStr } from "../api/movieApi";

type Props = {
  movies: MovieApiResponse[];
  onView: (movie: MovieApiResponse) => void;
  onEdit: (movie: MovieApiResponse) => void;
  onDelete: (id: number) => void;
  searchQuery: string;
  genreFilter: string;
  statusFilter: string;
};

const ITEMS_PER_PAGE = 8;

const posterGradients = [
  "linear-gradient(135deg, #1e3a8a, #3b82f6)",
  "linear-gradient(135deg, #831843, #f43f5e)",
  "linear-gradient(135deg, #14532d, #22c55e)",
  "linear-gradient(135deg, #701a75, #d946ef)",
  "linear-gradient(135deg, #78350f, #f59e0b)",
];

const getPosterColor = (id: number) => posterGradients[id % posterGradients.length];

function hasFutureShowtime(movie: MovieApiResponse): boolean {
  if (!movie.showTimes?.length) return false;
  const today = new Date().toISOString().split("T")[0];
  return movie.showTimes.some((st) => toDateStr(st.showDate) >= today);
}

export function MovieTable({ movies, onView, onEdit, onDelete, searchQuery, genreFilter, statusFilter }: Props) {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<MovieApiResponse | null>(null);

  const filtered = movies.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      m.movieNameEnglish?.toLowerCase().includes(q) ||
      m.movieNameVn?.toLowerCase().includes(q) ||
      m.director?.toLowerCase().includes(q);
    const matchGenre = !genreFilter || m.movieType?.includes(genreFilter);
    const matchStatus =
      !statusFilter ||
      (statusFilter === "Showing" && hasFutureShowtime(m)) ||
      (statusFilter === "No Upcoming" && !hasFutureShowtime(m));
    return matchSearch && matchGenre && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageMovies = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget.movieId);
    setDeleteTarget(null);
  };

  return (
    <>
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 mx-auto mb-4">
              <Trash2 size={22} className="text-rose-500" />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "8px" }}>
              Delete Movie
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-sub)", textAlign: "center", marginBottom: "20px" }}>
              Are you sure you want to delete{" "}
              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{deleteTarget.movieNameEnglish}</span>?
              <br />
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ background: "#ef4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["Movie Info", "Genre", "Format", "Status", "Added", "Actions"].map((h) => (
                <th key={h} className={`px-5 py-3.5 ${h === "Actions" ? "text-right" : "text-left"}`}>
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {h}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pageMovies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  No movies found matching your filters.
                </td>
              </tr>
            ) : (
              pageMovies.map((movie) => {
                const isShowing = hasFutureShowtime(movie);
                return (
                  <tr
                    key={movie.movieId}
                    className="hover-row transition-colors border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    {/* Movie Info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {movie.smallImage ? (
                          <img
                            src={movie.smallImage}
                            alt={movie.movieNameEnglish}
                            className="w-10 h-12 rounded-md object-cover flex-shrink-0"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div
                            className="w-10 h-12 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: getPosterColor(movie.movieId) }}
                          >
                            <Clapperboard size={16} color="rgba(255,255,255,0.8)" />
                          </div>
                        )}
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
                            {movie.movieNameEnglish}
                          </p>
                          <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "1px" }}>
                            {movie.movieNameVn}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>Dir: {movie.director}</p>
                            <span style={{ color: "var(--border-color)" }}>•</span>
                            <div className="flex items-center gap-1" style={{ color: "var(--text-sub)" }}>
                              <Clock size={10} />
                              <span style={{ fontSize: "11px" }}>{movie.duration}m</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Genre */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(movie.movieType ?? []).slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium"
                            style={{ background: "var(--bg-main)", color: "var(--text-sub)", borderColor: "var(--border-color)" }}
                          >
                            {g}
                          </span>
                        ))}
                        {(movie.movieType?.length ?? 0) > 2 && (
                          <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                            +{(movie.movieType?.length ?? 0) - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Format */}
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)", fontWeight: 500 }}>
                        {movie.version}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          isShowing ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isShowing ? "bg-emerald-500" : "bg-gray-400"}`} />
                        {isShowing ? "Showing" : "No Upcoming"}
                      </span>
                    </td>

                    {/* Added date */}
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                        {formatDisplayDate(movie.createAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView(movie)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn"
                          style={{ color: "var(--text-sub)" }}
                          title="View detail"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => onEdit(movie)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn"
                          style={{ color: "var(--text-sub)" }}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(movie)}
                          title="Delete"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn text-rose-400 hover:text-rose-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
          Showing{" "}
          <span style={{ color: "var(--text-main)", fontWeight: 500 }}>
            {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
          </span>{" "}
          of{" "}
          <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> movies
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn"
            style={{ color: "var(--text-sub)" }}
          >
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - safePage) <= 2)
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  fontSize: "13px",
                  fontWeight: p === safePage ? 600 : 400,
                  background: p === safePage ? "#2563eb" : "transparent",
                  color: p === safePage ? "#fff" : "var(--text-sub)",
                }}
              >
                {p}
              </button>
            ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn"
            style={{ color: "var(--text-sub)" }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
