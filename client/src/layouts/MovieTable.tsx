import { useState } from "react";
import {
  Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Clapperboard, Clock,
  SendHorizonal, CheckCircle, XCircle, PauseCircle, StopCircle,
  PlayCircle, RotateCcw, AlertCircle,
} from "lucide-react";
import type { MovieApiResponse, MovieStatus } from "../api/movieApi";
import { formatDisplayDate, toDateStr } from "../api/movieApi";
import { useRole } from "../hooks/useRole";

type Props = {
  movies: MovieApiResponse[];
  onView: (movie: MovieApiResponse) => void;
  onEdit: (movie: MovieApiResponse) => void;
  onDelete: (id: number) => void;
  onSubmit: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number, note: string) => void;
  onSuspend: (id: number, reason: string) => void;
  onEnd: (id: number) => void;
  onRework: (id: number) => void;
  onRelease: (id: number) => void;
  onReinstate: (id: number) => void;
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

/* ── Status badge config ────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<MovieStatus, { label: string; dot: string; bg: string; text: string }> = {
  DRAFT:          { label: "Draft",          dot: "#9ca3af", bg: "rgba(156,163,175,0.12)", text: "#6b7280" },
  PENDING_REVIEW: { label: "Pending Review", dot: "#f59e0b", bg: "rgba(245,158,11,0.12)",  text: "#d97706" },
  COMING_SOON:    { label: "Coming Soon",    dot: "#3b82f6", bg: "rgba(59,130,246,0.12)",  text: "#2563eb" },
  NOW_SHOWING:    { label: "Now Showing",    dot: "#10b981", bg: "rgba(16,185,129,0.12)",  text: "#059669" },
  SUSPENDED:      { label: "Suspended",      dot: "#f97316", bg: "rgba(249,115,22,0.12)",  text: "#ea580c" },
  ENDED:          { label: "Ended",          dot: "#9ca3af", bg: "rgba(156,163,175,0.08)", text: "#9ca3af" },
  REJECTED:       { label: "Rejected",       dot: "#ef4444", bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
};

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

/* ── Text-input modal (Reject / Suspend) ────────────────────────────────── */
function InputModal({
  title, label, placeholder, confirmLabel, confirmColor, onConfirm, onCancel, icon: Icon, required = true,
}: {
  title: string; label: string; placeholder: string; confirmLabel: string;
  confirmColor: string; onConfirm: (value: string) => void; onCancel: () => void;
  icon: React.ElementType; required?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: `${confirmColor}18` }}>
          <Icon size={22} style={{ color: confirmColor }} />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "16px" }}>{title}</h3>
        <div className="mb-4">
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: "6px" }}>{label}</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={3}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border outline-none focus:ring-2 resize-none"
            style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button onClick={() => value.trim() || !required ? onConfirm(value.trim()) : null} disabled={required && !value.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: confirmColor }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Icon action button ─────────────────────────────────────────────────── */
function ActionBtn({ icon: Icon, title, onClick, color = "var(--text-sub)" }: {
  icon: React.ElementType; title: string; onClick: () => void; color?: string;
}) {
  return (
    <button onClick={onClick} title={title} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors action-btn flex-shrink-0" style={{ color }}>
      <Icon size={13} />
    </button>
  );
}

/* ── Status-based action buttons ────────────────────────────────────────── */
function MovieActions({
  movie, onView, onEdit, onDelete, onSubmit, onApprove,
  onRejectClick, onSuspendClick, onEnd, onRework, onRelease, onReinstate,
}: {
  movie: MovieApiResponse;
  onView: () => void; onEdit: () => void; onDelete: () => void;
  onSubmit: () => void; onApprove: () => void;
  onRejectClick: () => void; onSuspendClick: () => void;
  onEnd: () => void; onRework: () => void;
  onRelease: () => void; onReinstate: () => void;
}) {
  const { can } = useRole();
  const s = movie.movieStatus;

  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* Always: View */}
      <ActionBtn icon={Eye} title="View details" onClick={onView} />

      {s === "DRAFT" && <>
        {can.submit  && <ActionBtn icon={SendHorizonal} title="Submit for review" onClick={onSubmit} color="#2563eb" />}
        {can.edit    && <ActionBtn icon={Pencil}        title="Edit"              onClick={onEdit} />}
        {can.archive && <ActionBtn icon={Trash2}        title="Archive (→ Ended)" onClick={onDelete} color="#ef4444" />}
      </>}

      {s === "PENDING_REVIEW" && <>
        {can.approve && <ActionBtn icon={CheckCircle} title="Approve → Coming Soon" onClick={onApprove}    color="#059669" />}
        {can.reject  && <ActionBtn icon={XCircle}     title="Reject"                onClick={onRejectClick} color="#dc2626" />}
        {/* Employee sees only View while waiting for admin review */}
      </>}

      {s === "COMING_SOON" && <>
        {can.release && <ActionBtn icon={PlayCircle}  title="Release → Now Showing" onClick={onRelease}     color="#059669" />}
        {can.suspend && <ActionBtn icon={PauseCircle} title="Suspend"               onClick={onSuspendClick} color="#ea580c" />}
        {can.end     && <ActionBtn icon={StopCircle}  title="End"                   onClick={onEnd}          color="#6b7280" />}
        {can.edit    && <ActionBtn icon={Pencil}      title="Edit"                  onClick={onEdit} />}
      </>}

      {s === "NOW_SHOWING" && <>
        {can.suspend && <ActionBtn icon={PauseCircle} title="Suspend" onClick={onSuspendClick} color="#ea580c" />}
        {can.end     && <ActionBtn icon={StopCircle}  title="End"     onClick={onEnd}          color="#6b7280" />}
        {can.edit    && <ActionBtn icon={Pencil}      title="Edit"    onClick={onEdit} />}
      </>}

      {s === "SUSPENDED" && <>
        {can.reinstate && <ActionBtn icon={RotateCcw}  title="Reinstate → Now Showing" onClick={onReinstate} color="#059669" />}
        {can.end       && <ActionBtn icon={StopCircle} title="End"                     onClick={onEnd}       color="#6b7280" />}
        {can.edit      && <ActionBtn icon={Pencil}     title="Edit"                    onClick={onEdit} />}
      </>}

      {s === "REJECTED" && <>
        {can.rework && <ActionBtn icon={RotateCcw} title="Rework → Draft" onClick={onRework} color="#2563eb" />}
        {can.edit   && <ActionBtn icon={Pencil}    title="Edit"            onClick={onEdit} />}
      </>}

      {/* ENDED: only View (already rendered above) */}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function MovieTable({
  movies, onView, onEdit, onDelete, onSubmit, onApprove, onReject, onSuspend,
  onEnd, onRework, onRelease, onReinstate, searchQuery, genreFilter, statusFilter,
}: Props) {
  const [page, setPage] = useState(1);
  const [deleteTarget,  setDeleteTarget]  = useState<MovieApiResponse | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<MovieApiResponse | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<MovieApiResponse | null>(null);
  const [endTarget,     setEndTarget]     = useState<MovieApiResponse | null>(null);

  const filtered = movies.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      m.movieNameEnglish?.toLowerCase().includes(q) ||
      m.movieNameVn?.toLowerCase().includes(q) ||
      m.director?.toLowerCase().includes(q);
    const matchGenre = !genreFilter || m.movieType?.includes(genreFilter);
    const matchStatus = !statusFilter || m.movieStatus === statusFilter;
    return matchSearch && matchGenre && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageMovies = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <>
      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <ConfirmModal
          icon={Trash2}
          title="Archive Movie"
          body={<>Move <strong style={{ color: "var(--text-main)" }}>{deleteTarget.movieNameEnglish}</strong> to Ended?<br />The record is kept for reporting.</>}
          confirmLabel="Archive"
          confirmColor="#ef4444"
          onConfirm={() => { onDelete(deleteTarget.movieId); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── End confirmation ── */}
      {endTarget && (
        <ConfirmModal
          icon={StopCircle}
          title="End Movie"
          body={<>Mark <strong style={{ color: "var(--text-main)" }}>{endTarget.movieNameEnglish}</strong> as Ended?</>}
          confirmLabel="End"
          confirmColor="#6b7280"
          onConfirm={() => { onEnd(endTarget.movieId); setEndTarget(null); }}
          onCancel={() => setEndTarget(null)}
        />
      )}

      {/* ── Reject modal (with note) ── */}
      {rejectTarget && (
        <InputModal
          icon={XCircle}
          title="Reject Movie"
          label="Rejection note (required)"
          placeholder="Explain why this movie is being rejected…"
          confirmLabel="Reject"
          confirmColor="#dc2626"
          onConfirm={(note) => { onReject(rejectTarget.movieId, note); setRejectTarget(null); }}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* ── Suspend modal (with reason) ── */}
      {suspendTarget && (
        <InputModal
          icon={PauseCircle}
          title="Suspend Movie"
          label="Reason (required)"
          placeholder="Explain why showings are being suspended…"
          confirmLabel="Suspend"
          confirmColor="#ea580c"
          onConfirm={(reason) => { onSuspend(suspendTarget.movieId, reason); setSuspendTarget(null); }}
          onCancel={() => setSuspendTarget(null)}
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
                  const cfg = STATUS_CONFIG[movie.movieStatus ?? "DRAFT"] ?? STATUS_CONFIG.DRAFT;
                  const isEnded = movie.movieStatus === "ENDED";
                  return (
                    <tr
                      key={movie.movieId}
                      className="hover-row transition-colors border-b"
                      style={{ borderColor: "var(--border-color)", opacity: isEnded ? 0.55 : 1 }}
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
                        {/* Rejection note hint */}
                        {movie.movieStatus === "REJECTED" && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertCircle size={10} style={{ color: "#dc2626" }} />
                            <span style={{ fontSize: "10.5px", color: "#dc2626" }}>Needs rework</span>
                          </div>
                        )}
                      </td>

                      {/* Added date */}
                      <td className="px-5 py-3.5">
                        <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{formatDisplayDate(movie.createAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <MovieActions
                          movie={movie}
                          onView={() => onView(movie)}
                          onEdit={() => onEdit(movie)}
                          onDelete={() => setDeleteTarget(movie)}
                          onSubmit={() => onSubmit(movie.movieId)}
                          onApprove={() => onApprove(movie.movieId)}
                          onRejectClick={() => setRejectTarget(movie)}
                          onSuspendClick={() => setSuspendTarget(movie)}
                          onEnd={() => setEndTarget(movie)}
                          onRework={() => onRework(movie.movieId)}
                          onRelease={() => onRelease(movie.movieId)}
                          onReinstate={() => onReinstate(movie.movieId)}
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
