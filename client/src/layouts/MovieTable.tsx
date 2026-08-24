import { useState } from "react";
import {
  Eye, Pencil, Archive, ChevronLeft, ChevronRight, Clapperboard, Clock,
  SendHorizonal, ClipboardCheck, RotateCcw, AlertCircle, CalendarClock,
} from "lucide-react";
import { RowActions, type RowAction } from "../components/admin/RowActions";
import type { MovieApiResponse } from "../api/movieApi";
import { formatDisplayDate } from "../api/movieApi";
import { useRole } from "../hooks/useRole";
import {
  MOVIE_CONTENT_STATUS_META,
  toMovieContentStatus,
} from "../utils/movieContentStatus";

type Props = {
  movies: MovieApiResponse[];
  onView: (movie: MovieApiResponse) => void;
  onEdit: (movie: MovieApiResponse) => void;
  onDelete: (id: number) => void;
  onSubmit: (id: number) => void;
  /** Opens MovieDetailModal in mode="review" (approve/reject with rejection note) - see #139. */
  onReviewClick: (movie: MovieApiResponse) => void;
  onRework: (id: number) => void;
  /** Navigates to the standalone availability page (/admin/movies/:id/availability) — the
   *  release-plan CRUD workflow used to be a tab inside the detail modal; it now has its
   *  own route since it's a management action, not a detail view - see #139. */
  onManageAvailability: (id: number) => void;
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

/* ── Inline confirmation modal ──────────────────────────────────────────── */
function ConfirmModal({
  title, body, confirmLabel, confirmColor, onConfirm, onCancel, icon: Icon,
}: {
  title: string; body: React.ReactNode; confirmLabel: string;
  confirmColor: string; onConfirm: () => void; onCancel: () => void;
  icon: React.ElementType;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: `${confirmColor}18` }}>
          <Icon size={22} style={{ color: confirmColor }} />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "8px" }}>{title}</h3>
        <div style={{ fontSize: "13px", color: "var(--text-sub)", textAlign: "center", marginBottom: "20px" }}>{body}</div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90" style={{ background: confirmColor }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Icon action button ─────────────────────────────────────────────────── */
/* ── Status-based action buttons ────────────────────────────────────────── */
function MovieActions({
  movie, onView, onEdit, onDelete, onSubmit,
  onReviewClick, onRework, onManageAvailability,
}: {
  movie: MovieApiResponse;
  onView: () => void; onEdit: () => void; onDelete: () => void;
  onSubmit: () => void;
  onReviewClick: () => void; onRework: () => void; onManageAvailability: () => void;
}) {
  const { can } = useRole();
  const status = toMovieContentStatus(movie.movieStatus);
  const actions: RowAction[] = [
    { key: "view", label: "View details", icon: Eye, onSelect: onView },
    { key: "submit", label: "Submit for review", icon: SendHorizonal, onSelect: onSubmit, hidden: status !== "DRAFT" || !can.submit, separatorBefore: true },
    { key: "edit", label: "Edit movie", icon: Pencil, onSelect: onEdit, hidden: status !== "DRAFT" || !can.edit },
    { key: "review", label: "Review submission", icon: ClipboardCheck, onSelect: onReviewClick, hidden: status !== "PENDING_REVIEW" || (!can.approve && !can.requestChanges), separatorBefore: true },
    { key: "availability", label: "Manage availability", icon: CalendarClock, onSelect: onManageAvailability, hidden: status !== "APPROVED", separatorBefore: true },
    { key: "revise", label: "Start revision", icon: RotateCcw, onSelect: onRework, hidden: status !== "CHANGES_REQUESTED" || !can.startRevision, separatorBefore: true },
    { key: "archive", label: "Archive movie", icon: Archive, onSelect: onDelete, hidden: status !== "APPROVED" || !can.archive, destructive: true, separatorBefore: true },
  ];

  return (
    <RowActions ariaLabel={`Actions for ${movie.movieNameEnglish}`} actions={actions} />
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function MovieTable({
  movies, onView, onEdit, onDelete, onSubmit, onReviewClick,
  onRework, onManageAvailability, searchQuery, genreFilter, statusFilter,
}: Props) {
  const [page, setPage] = useState(1);
  const [deleteTarget,  setDeleteTarget]  = useState<MovieApiResponse | null>(null);

  const filtered = movies
    .filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        m.movieNameEnglish?.toLowerCase().includes(q) ||
        m.movieNameVn?.toLowerCase().includes(q) ||
        m.director?.toLowerCase().includes(q);
      const matchGenre = !genreFilter || m.movieType?.includes(genreFilter);
      const matchStatus = !statusFilter || toMovieContentStatus(m.movieStatus) === statusFilter;
      return matchSearch && matchGenre && matchStatus;
    })
    // Most recently updated first — this is what makes a movie that was just approved (or any
    // other status change) surface at the top of its tab instead of staying wherever it landed
    // by insertion/ID order.
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageMovies = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <>
      {/* ── Archive confirmation ── */}
      {deleteTarget && (
        <ConfirmModal
          icon={Archive}
          title="Archive movie"
          body={
            <>
              <strong style={{ color: "var(--text-main)" }}>{deleteTarget.movieNameEnglish}</strong>
              <br />
              Movie will be removed from the active catalog but retained for audit and reporting.
            </>
          }
          confirmLabel="Archive movie"
          confirmColor="#d97706"
          onConfirm={() => { onDelete(deleteTarget.movieId); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Table ── */}
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
                  const contentStatus = toMovieContentStatus(movie.movieStatus);
                  const cfg = MOVIE_CONTENT_STATUS_META[contentStatus];
                  const isArchived = contentStatus === "ARCHIVED";
                  return (
                    <tr
                      key={movie.movieId}
                      className="hover-row transition-colors border-b"
                      style={{ borderColor: "var(--border-color)", opacity: isArchived ? 0.55 : 1 }}
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
                            <div className="w-10 h-12 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: getPosterColor(movie.movieId) }}>
                              <Clapperboard size={16} color="rgba(255,255,255,0.8)" />
                            </div>
                          )}
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{movie.movieNameEnglish}</p>
                            <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "1px" }}>{movie.movieNameVn}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {movie.director && (
                                <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>Dir: {movie.director}</p>
                              )}
                              {movie.duration > 0 && <>
                                <span style={{ color: "var(--border-color)" }}>•</span>
                                <div className="flex items-center gap-1" style={{ color: "var(--text-sub)" }}>
                                  <Clock size={10} />
                                  <span style={{ fontSize: "11px" }}>{movie.duration}m</span>
                                </div>
                              </>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Genre */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(movie.movieType ?? []).slice(0, 2).map((g) => (
                            <span key={g} className="inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium" style={{ background: "var(--bg-main)", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                              {g}
                            </span>
                          ))}
                          {(movie.movieType?.length ?? 0) > 2 && (
                            <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>+{(movie.movieType?.length ?? 0) - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Format */}
                      <td className="px-5 py-3.5">
                        <span style={{ fontSize: "13px", color: "var(--text-sub)", fontWeight: 500 }}>{movie.version}</span>
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: cfg.bg, color: cfg.text }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                        {/* Review note hint */}
                        {contentStatus === "CHANGES_REQUESTED" && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertCircle size={10} style={{ color: "#dc2626" }} />
                            <span style={{ fontSize: "10.5px", color: "#dc2626" }}>Revision required</span>
                          </div>
                        )}
                      </td>

                      {/* Added date */}
                      <td className="px-5 py-3.5">
                        <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{formatDisplayDate(movie.createAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="w-[72px] px-5 py-3.5 text-right">
                        <MovieActions
                          movie={movie}
                          onView={() => onView(movie)}
                          onEdit={() => onEdit(movie)}
                          onDelete={() => setDeleteTarget(movie)}
                          onSubmit={() => onSubmit(movie.movieId)}
                          onReviewClick={() => onReviewClick(movie)}
                          onRework={() => onRework(movie.movieId)}
                          onManageAvailability={() => onManageAvailability(movie.movieId)}
                        />
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
            of <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> movies
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - safePage) <= 2)
              .map((p) => (
                <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ fontSize: "13px", fontWeight: p === safePage ? 600 : 400, background: p === safePage ? "#2563eb" : "transparent", color: p === safePage ? "#fff" : "var(--text-sub)" }}>

                {p}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
        .action-btn:hover { background-color: rgba(128,128,128,0.08); }
      `}</style>
    </>
  );
}
