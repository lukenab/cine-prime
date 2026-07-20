import { ArrowLeft, Building2, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { LayoutStatusValue } from "../../../api/movieApi";
import { LAYOUT_STATUS_CONFIG } from "../RoomDetailPage";

type Props = {
  mode: "create" | "edit" | "view";
  roomName: string;
  clusterName?: string;
  layoutStatus?: LayoutStatusValue;
  layoutVersion?: number;
  onBack: () => void;
  actions?: ReactNode;
  /** Extra badges rendered next to the title, after the layout-status badge
   *  (e.g. the room-type chip on the view page — the create/edit flow has
   *  no equivalent since room type isn't known until the room is saved). */
  badges?: ReactNode;
  /** Overrides the default clusterName-only line below the title. Falls back
   *  to a plain clusterName paragraph when omitted. */
  subtitle?: ReactNode;
};

function StatusBadge({ status }: { status: LayoutStatusValue }) {
  const cfg = LAYOUT_STATUS_CONFIG[status] ?? { label: status, color: "#6b7280", bg: "rgba(107,114,128,0.10)" };
  return (
    <span
      className="px-2.5 py-1 rounded-full"
      style={{ fontSize: "11px", fontWeight: 700, color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

const BREADCRUMB_LABEL: Record<Props["mode"], (roomName: string) => string> = {
  create: () => "Create Room",
  edit: () => "Edit Room",
  view: (roomName) => roomName || "Room",
};

const TITLE_TEXT: Record<Props["mode"], (roomName: string) => string> = {
  create: () => "Create Cinema Room",
  edit: (roomName) => roomName || "Edit Cinema Room",
  view: (roomName) => roomName || "Cinema Room",
};

export function CinemaRoomHeader({ mode, roomName, clusterName, layoutStatus, layoutVersion, onBack, actions, badges, subtitle }: Props) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
        <span>Cinemas</span>
        <ChevronRight size={12} />
        <span>{clusterName ?? "Cinema Cluster"}</span>
        <ChevronRight size={12} />
        <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{BREADCRUMB_LABEL[mode](roomName)}</span>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:opacity-80 flex-shrink-0"
          style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Building2 size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 style={{ color: "var(--text-main)", fontWeight: 700, fontSize: "20px", lineHeight: 1.2 }}>
              {TITLE_TEXT[mode](roomName)}
            </h1>
            {layoutStatus && <StatusBadge status={layoutStatus} />}
            {layoutVersion != null && (
              <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>v{layoutVersion}</span>
            )}
            {badges}
          </div>
          {subtitle ?? (clusterName && <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>{clusterName}</p>)}
        </div>
        {actions && <div className="w-full sm:w-auto sm:ml-auto">{actions}</div>}
      </div>
    </div>
  );
}
