import { useRef } from "react";
import { AlertCircle, CheckCircle2, Circle, Loader2, Save, Send } from "lucide-react";

export type MovieEditorActionStatus =
  | "pristine"
  | "dirty"
  | "saved"
  | "save-error"
  | "submit-error"
  | "submitted";

export type MovieEditorOperation = "idle" | "saving-draft" | "saving-before-submit" | "submitting";

type Props = {
  status: MovieEditorActionStatus;
  operation: MovieEditorOperation;
  canSave: boolean;
  canSubmit: boolean;
  showSubmit?: boolean;
  saveDisabled?: boolean;
  submitDisabled?: boolean;
  onSaveDraft: () => void;
  onSubmitForReview: () => void;
};

const STATUS_META: Record<
  MovieEditorActionStatus,
  { label: string; color: string; icon: typeof Circle }
> = {
  pristine: { label: "No unsaved changes", color: "var(--text-sub)", icon: Circle },
  dirty: { label: "Unsaved changes", color: "#d97706", icon: Circle },
  saved: { label: "All changes saved", color: "#059669", icon: CheckCircle2 },
  "save-error": { label: "Save failed", color: "#dc2626", icon: AlertCircle },
  "submit-error": { label: "Submission failed — draft saved", color: "#dc2626", icon: AlertCircle },
  submitted: { label: "Submitted for review", color: "#059669", icon: CheckCircle2 },
};

/**
 * Persistent Movie Editor commands. Persistence and lifecycle transition remain
 * separate actions; the component only guards duplicate clicks and communicates state.
 */
export function MovieEditorActionBar({
  status,
  operation,
  canSave,
  canSubmit,
  showSubmit = true,
  saveDisabled = false,
  submitDisabled = false,
  onSaveDraft,
  onSubmitForReview,
}: Props) {
  const clickGuard = useRef(false);
  const busy = operation !== "idle";
  const statusMeta = STATUS_META[status];
  const StatusIcon = busy ? Loader2 : statusMeta.icon;

  const guard = (action: () => void) => () => {
    if (clickGuard.current || busy) return;
    clickGuard.current = true;
    action();
    window.setTimeout(() => {
      clickGuard.current = false;
    }, 500);
  };

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
      aria-label="Movie draft and review actions"
    >
      <div
        className="flex min-w-0 items-center gap-2"
        aria-live="polite"
        style={{ color: busy ? "#2563eb" : statusMeta.color, fontSize: "12.5px", fontWeight: 650 }}
      >
        <StatusIcon size={15} className={busy ? "animate-spin" : undefined} aria-hidden="true" />
        <span>
          {operation === "saving-draft" || operation === "saving-before-submit"
            ? "Saving draft…"
            : operation === "submitting"
              ? "Submitting for review…"
              : statusMeta.label}
        </span>
      </div>

      {(canSave || (canSubmit && showSubmit)) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canSave && (
            <button
              type="button"
              onClick={guard(onSaveDraft)}
              disabled={busy || saveDisabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: "var(--bg-main)",
                borderColor: "var(--border-color)",
                color: "var(--text-main)",
                fontSize: "13px",
                fontWeight: 650,
              }}
            >
              {operation === "saving-draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {operation === "saving-draft" ? "Saving…" : "Save Draft"}
            </button>
          )}

          {canSubmit && showSubmit && (
            <button
              type="button"
              onClick={guard(onSubmitForReview)}
              disabled={busy || submitDisabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                boxShadow: "0 6px 16px rgba(37,99,235,0.24)",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {operation === "saving-before-submit" || operation === "submitting"
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />}
              {operation === "saving-before-submit"
                ? "Saving…"
                : operation === "submitting"
                  ? "Submitting…"
                  : "Submit for Review"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
