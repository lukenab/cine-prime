import { useEffect, useState } from "react";
import type { PromotionSummary } from "../../api/promotionApi";
import { ConfirmDialog } from "../shared/ConfirmDialog";

export type PromotionWorkflowAction = "submit" | "approve" | "reject" | "activate" | "pause" | "archive";

type Props = {
  action: PromotionWorkflowAction;
  promotion: Pick<PromotionSummary, "name" | "code" | "activeReservationCount">;
  busy?: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
};

const copy: Record<PromotionWorkflowAction, { title: string; confirm: string; field?: string; required?: boolean; danger?: boolean }> = {
  submit: { title: "Submit promotion for approval?", confirm: "Submit for approval", field: "Note for approver (optional)" },
  approve: { title: "Approve this promotion?", confirm: "Approve", field: "Approval note (optional)" },
  reject: { title: "Return promotion for changes?", confirm: "Return for changes", field: "Reason for return", required: true, danger: true },
  activate: { title: "Activate this promotion?", confirm: "Activate promotion" },
  pause: { title: "Pause this promotion?", confirm: "Pause promotion", field: "Reason for pausing", required: true, danger: true },
  archive: { title: "Archive this promotion?", confirm: "Archive promotion", field: "Reason for archiving", required: true, danger: true },
};

function consequence(action: PromotionWorkflowAction, promotion: Props["promotion"]) {
  switch (action) {
    case "submit": return "The promotion becomes read-only while a commercial approver reviews it.";
    case "approve": return "Approval records your decision. The promotion will still need to be activated before customers can use it.";
    case "reject": return "The promotion returns to its owner for revision. Your reason will be stored in the audit trail.";
    case "activate": return "Eligible customers can use the promotion within its configured validity window and quota.";
    case "pause": return `${promotion.activeReservationCount || 0} active reservation(s) may still complete; new reservations will be blocked.`;
    case "archive": return "The promotion cannot be reactivated. Redemption history and audit evidence will be retained.";
  }
}

export function PromotionWorkflowDialog({ action, promotion, busy = false, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState("");
  const config = copy[action];
  useEffect(() => setNote(""), [action, promotion.code]);

  return (
    <ConfirmDialog
      title={config.title}
      confirmLabel={config.confirm}
      danger={config.danger}
      busy={busy}
      confirmDisabled={config.required && !note.trim()}
      onCancel={onCancel}
      onConfirm={() => onConfirm(note.trim())}
      body={(
        <div className="space-y-4">
          <div>
            <p className="font-semibold" style={{ color: "var(--text-main)" }}>{promotion.name}</p>
            <p className="mt-0.5 text-xs">{promotion.code}</p>
          </div>
          <p>{consequence(action, promotion)}</p>
          {config.field && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-main)" }}>
                {config.field}{config.required ? " *" : ""}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
                placeholder={config.required ? "Provide a clear business reason..." : "Add context for the next reviewer..."}
                className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-page)" }}
              />
              <span className="mt-1 block text-right text-[11px]">{note.length}/500</span>
            </label>
          )}
        </div>
      )}
    />
  );
}
