import { useState } from "react";
import { X, CheckCircle, XCircle, Loader2, Clock, Calendar, ShieldCheck, Tag } from "lucide-react";
import { toast } from "sonner";
import type { MovieResponse } from "../api/movieApi";
import { useRole } from "../hooks/useRole";

type Props = {
  open: boolean;
  movie: MovieResponse | null;
  loading?: boolean;
  onClose: () => void;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, note: string) => Promise<void>;
};

const MIN_NOTE_LENGTH = 10;

const READINESS_FIELD_LABELS: Record<string, string> = {
  ageRating: "age rating",
  poster: "poster",
  synopsis: "synopsis",
  translations: "localized title",
  genres: "genre",
  formats: "screening format",
  originalTitle: "original title",
  originalLanguage: "original language",
  durationMinutes: "duration",
  releaseDate: "release date",
};

function approvalErrorMessage(err: any) {
  const response = err?.response?.data;
  const violations = response?.result?.violations;
  if (!Array.isArray(violations) || violations.length === 0) {
    return response?.message ?? "Approve failed.";
  }

  const fields = [...new Set(
    violations.map((violation: { field?: string }) =>
      READINESS_FIELD_LABELS[violation.field ?? ""] ?? violation.field
    ).filter(Boolean)
  )];

  return `${response?.message ?? "Movie is not ready for approval."} Check: ${fields.join(", ")}.`;
}

const FL: React.CSSProperties = {
  fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "4px",
};

function formatDuration(minutes?: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Dedicated review panel for a PENDING_REVIEW movie (issue #139): shows enough context to
 * decide (poster, title, genre, duration, release date, age rating, synopsis) and requires a
 * rejection note of at least MIN_NOTE_LENGTH characters before a reject can be confirmed.
 */
export function PendingReviewModal({ open, movie, loading, onClose, onApprove, onReject }: Props) {
  const { can } = useRole();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  if (!open) return null;

  const resetAndClose = () => {
    if (submitting) return;
    setShowRejectForm(false);
    setNote("");
    onClose();
  };

  const handleApprove = async () => {
    if (!movie) return;
    setSubmitting("approve");
    try {
      await onApprove(movie.movieId);
      toast.success(`"${movie.originalTitle}" approved.`);
      setShowRejectForm(false);
      setNote("");
      onClose();
    } catch (err: any) {
      toast.error(approvalErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!movie || note.trim().length < MIN_NOTE_LENGTH) return;
    setSubmitting("reject");
    try {
      await onReject(movie.movieId, note.trim());
      toast.success(`Changes requested for "${movie.originalTitle}".`);
      setShowRejectForm(false);
      setNote("");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Request changes failed.");
    } finally {
      setSubmitting(null);
    }
  };

  const vi = movie?.translations?.find((t) => t.languageCode === "vi");
  const en = movie?.translations?.find((t) => t.languageCode === "en");
  const displayTitle = vi?.title ?? en?.title ?? movie?.originalTitle ?? "";
  const synopsis = vi?.synopsis ?? en?.synopsis ?? movie?.synopsis ?? "";
  const noteTooShort = note.trim().length > 0 && note.trim().length < MIN_NOTE_LENGTH;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={resetAndClose} />

      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-main)", maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock size={15} className="text-amber-600" />
            </div>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)" }}>Review Movie</p>
          </div>
          <button
            type="button" onClick={resetAndClose} disabled={!!submitting}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading || !movie ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10" style={{ color: "var(--text-sub)" }}>
              <Loader2 size={24} className="animate-spin" />
              <p style={{ fontSize: "13px" }}>Loading movie…</p>
            </div>
          ) : (
            <>
              <div className="flex gap-4">
                <div
                  className="rounded-xl overflow-hidden border flex-shrink-0"
                  style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", width: "96px", height: "144px" }}
                >
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt={movie.originalTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Tag size={24} style={{ color: "var(--text-sub)" }} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>{displayTitle}</h3>
                    {movie.originalTitle !== displayTitle && (
                      <p style={{ fontSize: "12px", color: "var(--text-sub)", fontStyle: "italic" }}>{movie.originalTitle}</p>
                    )}
                  </div>

                  {movie.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {movie.genres.map((g) => (
                        <span
                          key={g.genreId}
                          className="px-2 py-0.5 rounded-md border text-xs font-medium"
                          style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                        >
                          {g.genreName}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
                    <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(movie.durationMinutes)}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {movie.releaseDate ?? "—"}</span>
                    {movie.ageRating && (
                      <span className="flex items-center gap-1"><ShieldCheck size={12} /> {movie.ageRating.ratingCode}</span>
                    )}
                  </div>
                </div>
              </div>

              {synopsis && (
                <div className="mt-4">
                  <p style={FL}>Synopsis</p>
                  <p style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: 1.6 }}>{synopsis}</p>
                </div>
              )}

              {/* Rejection note - hidden until Reject is clicked */}
              {showRejectForm && (
                <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: "6px" }}>
                    Rejection note (required, min {MIN_NOTE_LENGTH} characters)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Explain what must be updated before approval…"
                    rows={3}
                    autoFocus
                    disabled={submitting === "reject"}
                    className="w-full px-3 py-2.5 rounded-xl border outline-none focus:ring-2 resize-none disabled:opacity-60"
                    style={{
                      fontSize: "13px", background: "var(--bg-card)", color: "var(--text-main)",
                      borderColor: noteTooShort ? "#dc2626" : "var(--border-color)",
                    }}
                  />
                  <p style={{ fontSize: "11px", color: noteTooShort ? "#dc2626" : "var(--text-sub)", marginTop: "4px" }}>
                    {note.trim().length}/{MIN_NOTE_LENGTH} characters minimum
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center gap-3 flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          {!showRejectForm ? (
            <>
              {can.requestChanges && (
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={!!submitting || loading || !movie}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                  style={{ color: "#dc2626", borderColor: "#dc2626", background: "transparent" }}
                >
                  <XCircle size={15} /> Reject
                </button>
              )}
              {can.approve && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={!!submitting || loading || !movie}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#059669" }}
                >
                  {submitting === "approve" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Approve
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setShowRejectForm(false); setNote(""); }}
                disabled={submitting === "reject"}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 disabled:opacity-40"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting === "reject" || note.trim().length < MIN_NOTE_LENGTH}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
                style={{ background: "#dc2626" }}
              >
                {submitting === "reject" ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                Confirm Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
