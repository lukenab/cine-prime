import type { RoomCapacityEnvelope } from "./cinemaRoomCapacity";

type Props = {
  envelope: RoomCapacityEnvelope;
  compact?: boolean;
};

export function CapacityPlanningStatus({ envelope, compact }: Props) {
  if (envelope.maxPersonCapacity == null) {
    return (
      <div className="rounded-lg px-2.5 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <span style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>Enter room dimensions to calculate the seat limit.</span>
      </div>
    );
  }

  const ratio = envelope.maxPersonCapacity > 0
    ? envelope.plannedPersonCapacity / envelope.maxPersonCapacity
    : 1;
  const invalidFootprint = envelope.exceedsCapacity || envelope.exceedsWidth || envelope.exceedsDepth;
  const tone = invalidFootprint ? "#ef4444" : ratio >= 0.85 ? "#d97706" : "#059669";
  const remaining = envelope.maxPersonCapacity - envelope.plannedPersonCapacity;
  const status = invalidFootprint
    ? "Adjust layout"
    : ratio >= 0.85
      ? `${remaining} seats remaining`
      : `${remaining} seats available`;

  return (
    <div
      className={`rounded-lg ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
      style={{ background: "var(--bg-card)", border: `1px solid ${invalidFootprint ? "rgba(239,68,68,0.35)" : "var(--border-color)"}` }}
      aria-label={`Planned capacity ${envelope.plannedPersonCapacity} of ${envelope.maxPersonCapacity} people`}
    >
      <div className="flex items-center justify-between gap-3">
        <span style={{ fontSize: compact ? "10.5px" : "11px", fontWeight: 650, color: "var(--text-sub)" }}>Capacity</span>
        <span className="flex items-baseline gap-1.5">
          <strong style={{ fontSize: compact ? "11.5px" : "12.5px", color: tone }}>
            {envelope.plannedPersonCapacity} / {envelope.maxPersonCapacity}
          </strong>
          <span style={{ fontSize: "10px", color: tone }}>{status}</span>
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden mt-1.5" style={{ background: "var(--border-color)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: tone }}
        />
      </div>
      {invalidFootprint && !compact && (
        <p className="mt-1.5" style={{ fontSize: "10px", color: "#ef4444" }}>
          The current seat count or minimum layout footprint exceeds the room envelope.
        </p>
      )}
    </div>
  );
}
