import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw, ServerCrash, ShieldX } from "lucide-react";

export type RequestStateKind = "forbidden" | "unavailable" | "error" | "empty";

type RequestStateProps = {
  kind: RequestStateKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

const PRESETS: Record<RequestStateKind, { title: string; description: string; icon: typeof Inbox; color: string; background: string }> = {
  forbidden: {
    title: "You do not have access to this workspace",
    description: "Your current role does not include the capability required for this page. Contact a system administrator if your responsibilities have changed.",
    icon: ShieldX,
    color: "#b45309",
    background: "rgba(245,158,11,.09)",
  },
  unavailable: {
    title: "This workspace is temporarily unavailable",
    description: "The service could not complete the request. Try again in a moment; your existing data has not been changed.",
    icon: ServerCrash,
    color: "#e11d48",
    background: "rgba(244,63,94,.08)",
  },
  error: {
    title: "The request could not be completed",
    description: "Review the request and try again. If the problem continues, contact support.",
    icon: AlertTriangle,
    color: "#e11d48",
    background: "rgba(244,63,94,.08)",
  },
  empty: {
    title: "Nothing to show yet",
    description: "Items that match this view will appear here.",
    icon: Inbox,
    color: "#64748b",
    background: "rgba(100,116,139,.08)",
  },
};

export function RequestState({ kind, title, description, onRetry, action, compact = false, className = "" }: RequestStateProps) {
  const preset = PRESETS[kind];
  const Icon = preset.icon;

  return (
    <section
      role={kind === "empty" ? "status" : "alert"}
      className={`flex flex-col items-center justify-center rounded-2xl border text-center ${compact ? "min-h-40 px-6 py-8" : "min-h-[320px] px-8 py-14"} ${className}`}
      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
    >
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl" style={{ color: preset.color, background: preset.background }}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <h2 style={{ color: "var(--text-main)", fontSize: compact ? 16 : 19, fontWeight: 700 }}>{title ?? preset.title}</h2>
      <p className="mt-2 max-w-xl leading-6" style={{ color: "var(--text-sub)", fontSize: 13.5 }}>{description ?? preset.description}</p>
      {(onRetry || action) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors hover:bg-blue-500/5"
              style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-card)" }}
            >
              <RefreshCw size={15} /> Try again
            </button>
          )}
          {action}
        </div>
      )}
    </section>
  );
}
