import { memo } from "react";
import type { LayoutPosition } from "../../../api/movieApi";
import { SEAT_CELL_GAP, SEAT_CELL_HEIGHT, SEAT_CELL_WIDTH, SEAT_TYPE_COLORS, positionKey } from "./cinemaRoomLayoutGenerator";

const COUPLE_WIDTH = SEAT_CELL_WIDTH * 2 + SEAT_CELL_GAP;

type Props = {
  first: LayoutPosition;
  second: LayoutPosition;
  isSelected: boolean;
  isHighlighted?: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
};

/** A Couple pair rendered as one double-width seat spanning both column slots.
 *  Its width matches the two physical positions it represents, while the same
 *  corner radius as a single seat keeps the visual language consistent. */
function CoupleSeatGroupImpl({ first, second, isSelected, isHighlighted, disabled, onClick, onMouseDown, onMouseEnter }: Props) {
  const c = SEAT_TYPE_COLORS.COUPLE;
  const key1 = positionKey(first.rowIndex, first.columnIndex);
  const key2 = positionKey(second.rowIndex, second.columnIndex);
  const ring = isHighlighted ? "#f59e0b" : isSelected ? "#2563eb" : null;
  const firstCode = first.seatCode ?? `${first.rowLabel}${first.seatNumber ?? ""}`;
  const secondCode = second.seatCode ?? `${second.rowLabel}${second.seatNumber ?? ""}`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      data-position-keys={`${key1} ${key2}`}
      aria-label={`Couple seats ${firstCode} and ${secondCode}`}
      title={`Couple ${firstCode} + ${secondCode} · 2 positions`}
      style={{
        width: `${COUPLE_WIDTH}px`, height: `${SEAT_CELL_HEIGHT}px`, borderRadius: "8px", flexShrink: 0,
        border: `1.5px solid ${ring ?? c.border}`,
        background: isHighlighted ? "rgba(245,158,11,0.3)" : isSelected ? "rgba(37,99,235,0.25)" : c.bg,
        color: c.text, fontSize: "14px", fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", justifyContent: "center",
        boxShadow: ring ? `0 0 0 2px ${ring}55` : "none",
        animation: isHighlighted ? "seatPulse 1s ease-in-out infinite" : "none",
        transition: "all 0.1s ease",
      }}
    >
      <span style={{ borderRight: `1px solid ${c.border}`, lineHeight: "18px" }}>{firstCode}</span>
      <span style={{ lineHeight: "18px" }}>{secondCode}</span>
    </button>
  );
}

export const CoupleSeatGroup = memo(CoupleSeatGroupImpl);
