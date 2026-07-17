import { useRef } from "react";
import { Save, Send } from "lucide-react";
import type { LayoutStatusValue } from "../../../api/movieApi";

type Props = {
  /** undefined = brand new room, no layout submitted/rejected yet. */
  layoutStatus?: LayoutStatusValue;
  saving: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
};

/** Header workflow actions. Back already owns navigation, so this component
 * only exposes persistence and approval commands. */
export function EditorActionBar({ layoutStatus, saving, onSaveDraft, onSubmit, submitDisabled }: Props) {
  const inFlightRef = useRef(false);

  const guard = (fn: () => void) => () => {
    if (inFlightRef.current || saving) return;
    inFlightRef.current = true;
    fn();
    // The async completion itself is tracked by the `saving` prop; this local
    // guard only needs to survive the synchronous double-click window.
    setTimeout(() => { inFlightRef.current = false; }, 500);
  };

  const isRejected = layoutStatus === "REJECTED";
  const saveLabel = isRejected ? "Save Changes" : "Save Draft";
  const submitLabel = isRejected ? "Resubmit for Approval" : "Submit for Approval";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={guard(onSaveDraft)}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "13px", fontWeight: 650, borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}
        >
          <Save size={15} />
          {saving ? "Saving…" : saveLabel}
        </button>
        <button
          onClick={guard(onSubmit)}
          disabled={saving || submitDisabled}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-white hover:brightness-105 disabled:opacity-50"
          style={{ fontSize: "13px", fontWeight: 700, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 6px 16px rgba(37,99,235,0.24)" }}
        >
          <Send size={15} />
          {saving ? "Submitting…" : submitLabel}
        </button>
    </div>
  );
}
