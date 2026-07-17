import { memo } from "react";
import type { LayoutPosition } from "../../../api/movieApi";
import { SEAT_CELL_HEIGHT, SEAT_CELL_WIDTH, SEAT_TYPE_COLORS, positionKey } from "./cinemaRoomLayoutGenerator";

type Props = {
  position: LayoutPosition;
  isSelected: boolean;
  isPendingAnchor: boolean;
  /** Briefly true when the validation panel jumps here — draws the same pulse
   *  ring as a pending Couple anchor, in a neutral color, and is expected to
   *  self-clear on a timer owned by the caller. */
  isHighlighted?: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  /** Paint-mode drag gesture start/continue — undefined outside paint mode. */
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
};

/** A single grid cell (Seat/Aisle/Exit/Empty space). Memoized with primitive
 *  props (isSelected as a bool, not the parent's whole selection Set) so
 *  selecting one cell doesn't re-render every other cell in a large layout. */
function SeatCellImpl({ position: p, isSelected, isPendingAnchor, isHighlighted, disabled, onClick, onMouseDown, onMouseEnter }: Props) {
  let bg = "rgba(128,128,128,0.08)", border = "rgba(128,128,128,0.25)", text = "#9ca3af", content: React.ReactNode = "";
  if (p.positionType === "SEAT" && p.seatType) {
    const c = SEAT_TYPE_COLORS[p.seatType];
    bg = c.bg; border = c.border; text = c.text;
    content = p.seatCode ?? p.seatNumber ?? "";
  } else if (p.positionType === "EXIT") {
    bg = "rgba(5,150,105,0.14)"; border = "rgba(5,150,105,0.4)"; text = "#059669"; content = "E";
  } else if (p.positionType === "AISLE") {
    bg = "transparent"; border = "transparent"; content = "";
  } else {
    content = "";
  }

  const ring = isPendingAnchor ? "#9333ea" : isHighlighted ? "#f59e0b" : isSelected ? "#2563eb" : null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      data-position-key={positionKey(p.rowIndex, p.columnIndex)}
      title={
        isPendingAnchor
          ? `${p.rowLabel}${p.seatNumber ?? ""} — click the adjacent seat to pair`
          : `${p.rowLabel}${p.seatNumber ?? ""} · ${p.positionType}${p.seatType ? " · " + p.seatType : ""}`
      }
      style={{
        width: `${SEAT_CELL_WIDTH}px`, height: `${SEAT_CELL_HEIGHT}px`, borderRadius: "8px", flexShrink: 0,
        border: `1.5px solid ${ring ?? border}`,
        background: isPendingAnchor ? "rgba(147,51,234,0.3)" : isHighlighted ? "rgba(245,158,11,0.3)" : isSelected ? "rgba(37,99,235,0.25)" : bg,
        color: text, fontSize: "12px", fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        boxShadow: ring ? `0 0 0 2px ${ring}55` : "none",
        animation: isPendingAnchor || isHighlighted ? "seatPulse 1s ease-in-out infinite" : "none",
        transition: "all 0.1s ease",
      }}
    >
      {content}
    </button>
  );
}

export const SeatCell = memo(SeatCellImpl);
