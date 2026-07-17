import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";

type ConfirmDialogProps = {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the icon/confirm button as destructive and — per accessibility
   *  guidance that destructive actions must never be selected automatically —
   *  moves the initial focus to Cancel instead of Confirm. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Generic confirmation dialog — modeled on ClusterDetailPage.tsx's RejectModal
 *  visual pattern (overlay + centered card), but parameterized so the resize
 *  data-loss and template-overwrite confirmations can both reuse it instead of
 *  each needing a bespoke modal. Adds a focus trap and Escape-to-close. */
export function ConfirmDialog({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (danger ? cancelRef.current : confirmRef.current)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accentColor = danger ? "#dc2626" : "#2563eb";
  // Theme variables live on AdminLayout's root instead of document.body.
  // Portaling to that root keeps the modal outside sticky/overflow panels while
  // preserving an opaque light/dark card background.
  const portalRoot = document.querySelector<HTMLElement>(".theme-dark, .theme-light") ?? document.body;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(2,6,23,0.72)", zIndex: 1000, pointerEvents: "auto", isolation: "isolate" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="rounded-2xl shadow-2xl p-6 w-full max-w-md"
        style={{
          backgroundColor: "var(--bg-card, #ffffff)",
          border: "1px solid var(--border-color, rgba(0,0,0,0.12))",
          position: "relative", zIndex: 1001, opacity: 1,
          boxShadow: "0 24px 80px rgba(0,0,0,0.48)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: accentColor + "18" }}>
          {danger ? <AlertTriangle size={22} style={{ color: accentColor }} /> : <HelpCircle size={22} style={{ color: accentColor }} />}
        </div>
        <h3 id="confirm-dialog-title" style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "10px" }}>
          {title}
        </h3>
        <div style={{ fontSize: "13px", color: "var(--text-sub)", lineHeight: 1.5, marginBottom: "20px" }}>
          {body}
        </div>
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80"
            style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90"
            style={{ background: accentColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
