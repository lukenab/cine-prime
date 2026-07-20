import { RefreshCw } from "lucide-react";

/** Shared loading indicator — extracted from the "spin + text" pattern repeated
 *  across admin pages (ClusterDetailPage, RoomDetailPage, etc.). */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-sub)" }} />
      <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>{label}</p>
    </div>
  );
}
