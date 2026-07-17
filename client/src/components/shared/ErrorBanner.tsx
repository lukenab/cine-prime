import { AlertCircle, RefreshCw } from "lucide-react";

/** Shared API-error banner (distinct from an empty state) — extracted from the
 *  pattern repeated across admin pages (ClusterDetailPage, RoomDetailPage, etc.).
 *  Only render this for real fetch/API failures, never for "no data" cases. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
      <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
      <p style={{ fontSize: "14px", color: "#e11d48" }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600"
          style={{ fontSize: "13px" }}
        >
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
