import { AlertCircle, RefreshCw } from "lucide-react";

/** Shared API-error banner (distinct from an empty state) — extracted from the
 *  pattern repeated across admin pages (ClusterDetailPage, RoomDetailPage, etc.).
 *  Only render this for real fetch/API failures, never for "no data" cases. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300">
      <AlertCircle size={16} className="flex-shrink-0" aria-hidden="true" />
      <p className="text-sm leading-5">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/15 transition-colors text-xs font-semibold"
        >
          <RefreshCw size={13} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}
