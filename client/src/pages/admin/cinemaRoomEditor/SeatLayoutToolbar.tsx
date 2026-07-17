import { AlertTriangle, Grid2X2, Redo2, Ticket, Trash2, Undo2 } from "lucide-react";
import type { LayoutStats } from "./cinemaRoomLayoutGenerator";
import type { RoomCapacityEnvelope } from "./cinemaRoomCapacity";
import { CapacityPlanningStatus } from "./CapacityPlanningStatus";

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onGenerate: () => void;
  onClear: () => void;
  stats: LayoutStats;
  capacityEnvelope?: RoomCapacityEnvelope;
  issueCount: number;
  validationPanelOpen: boolean;
  onToggleValidationPanel: () => void;
  readOnly?: boolean;
};

const btnStyle: React.CSSProperties = {
  fontSize: "12px", color: "var(--text-main)", borderColor: "var(--border-color)",
};

function IconButton({ icon: Icon, label, onClick, disabled }: { icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className="flex items-center justify-center w-8 h-8 rounded-lg border hover:opacity-80 disabled:opacity-30" style={btnStyle}>
      <Icon size={14} />
    </button>
  );
}

function Kpi({ icon: Icon, label, value, color, title }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  color: string;
  title?: string;
}) {
  return (
    <span className="flex items-center gap-1.5" title={title} style={{ fontSize: "12px", color: "var(--text-main)" }}>
      <Icon size={13} style={{ color, flexShrink: 0 }} />
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ color: "var(--text-sub)", fontWeight: 500 }}>{label}</span>
    </span>
  );
}

/** Compact operational summary. Internal grid counters are intentionally left
 * out: the operator needs ticket capacity, seat mix, and actionable validation. */
export function SeatLayoutToolbar({
  canUndo, canRedo, onUndo, onRedo, onGenerate, onClear,
  stats, capacityEnvelope, issueCount, validationPanelOpen, onToggleValidationPanel, readOnly,
}: Props) {
  const seatTypes = [
    { label: "Standard", value: stats.standardCount, color: "#3b82f6" },
    { label: "VIP", value: stats.vipCount, color: "#d97706" },
    {
      label: "Couple",
      value: stats.coupleGroupCount > 0
        ? `${stats.coupleCapacity} seats (${stats.coupleGroupCount} ${stats.coupleGroupCount === 1 ? "pair" : "pairs"})`
        : "0 seats",
      color: "#9333ea",
    },
    { label: "Accessible", value: stats.accessibleCount, color: "#0d9488" },
  ];

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "7px" }}>
            Seat layout overview
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Kpi
              icon={Ticket}
              label="Sellable seats"
              value={stats.sellableCapacity}
              color="#2563eb"
              title="Total ticket capacity. A complete Couple group counts as two seats; aisles, exits and empty spaces are excluded."
            />
            <button type="button" onClick={onToggleValidationPanel} aria-expanded={validationPanelOpen}
              aria-label={`${issueCount} validation issue${issueCount === 1 ? "" : "s"}`}
              className="flex items-center gap-1.5 hover:opacity-80"
              style={{ fontSize: "12px", fontWeight: 700, color: issueCount > 0 ? "#ef4444" : "#059669" }}>
              <AlertTriangle size={13} /> {issueCount}
              <span style={{ color: "var(--text-sub)", fontWeight: 500 }}>Validation issues</span>
            </button>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1">
            <IconButton icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
            <IconButton icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo} />
            <button type="button" onClick={onGenerate}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border hover:opacity-80 ml-1"
              style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-main)", borderColor: "var(--border-color)" }}>
              <Grid2X2 size={13} /> Reset grid
            </button>
            <button type="button" onClick={onClear}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border hover:bg-red-500/5"
              style={{ fontSize: "11.5px", fontWeight: 600, color: "#ef4444", borderColor: "rgba(239,68,68,0.28)" }}>
              <Trash2 size={13} /> Clear
            </button>
          </div>
        )}
      </div>

      {capacityEnvelope?.maxPersonCapacity != null && (
        <div className="mt-2.5">
          <CapacityPlanningStatus envelope={capacityEnvelope} compact />
        </div>
      )}

      <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {seatTypes.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "var(--text-main)" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: item.color }} />
              <span style={{ color: "var(--text-sub)", fontWeight: 500 }}>{item.label}</span>
              <strong style={{ fontWeight: 700 }}>{item.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
