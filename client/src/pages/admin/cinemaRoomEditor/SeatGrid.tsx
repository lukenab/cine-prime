import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutPosition, SeatTypeValue } from "../../../api/movieApi";
import { ROW_HEADER_WIDTH, SEAT_CELL_GAP, SEAT_CELL_HEIGHT, SEAT_CELL_WIDTH, applyAssignment, clearOrphanedCoupleHalves, positionKey } from "./cinemaRoomLayoutGenerator";
import type { InteractionMode } from "./LayoutToolsPalette";
import { SeatCell } from "./SeatCell";
import { CoupleSeatGroup } from "./CoupleSeatGroup";

const SEAT_TYPE_MODES = new Set<InteractionMode>(["STANDARD", "VIP", "ACCESSIBLE"]);
const POSITION_TYPE_MODES = new Set<InteractionMode>(["AISLE", "EXIT", "EMPTY_SPACE"]);

/** Applies the active paint tool to one position key. No-op for SELECT/COUPLE
 *  — those modes never call this, they have their own click handling. */
function paintCell(positions: LayoutPosition[], key: string, mode: InteractionMode): LayoutPosition[] {
  const keySet = new Set([key]);
  if (SEAT_TYPE_MODES.has(mode)) {
    return applyAssignment(positions, keySet, "SEAT", mode as SeatTypeValue, null);
  }
  if (POSITION_TYPE_MODES.has(mode)) {
    return applyAssignment(positions, keySet, mode as "AISLE" | "EXIT" | "EMPTY_SPACE", null, null);
  }
  return positions;
}

type Props = {
  positions: LayoutPosition[];
  mode: InteractionMode;
  selected: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  /** Called with the next full positions array whenever an edit is committed —
   *  the caller (SeatLayoutWorkspace) owns undo history. */
  onCommit: (next: LayoutPosition[]) => void;
  onError?: (message: string) => void;
  readOnly?: boolean;
  /** Position keys to draw with a temporary pulsing highlight (jumped to from
   *  the validation panel). Couple groups highlight if either half matches. */
  highlightedKeys?: Set<string>;
};

/** The seat grid itself. A controlled component: selection lives in the
 *  parent (so the sibling Selection Inspector can read/bulk-act on it) and
 *  branches its click/drag behavior entirely on `mode` — Select mode keeps
 *  the classic click/shift/ctrl selection model, a paint mode (any seat type
 *  or layout position) applies immediately on click or drag, and Couple mode
 *  runs its own guided 2-click anchor→neighbor flow with no drag support. */
export function SeatGrid({ positions, mode, selected, onSelectionChange, onCommit, onError, readOnly, highlightedKeys }: Props) {
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  // Guided 2-click Couple flow: click one position to arm it as the pending
  // anchor, then a plain click on its same-row neighbor completes the pair.
  const [pendingCoupleAnchor, setPendingCoupleAnchor] = useState<string | null>(null);

  // Live preview for an in-progress paint drag — overrides `positions` for
  // rendering only; nothing commits until the gesture ends (one undo entry).
  const [draftPositions, setDraftPositions] = useState<LayoutPosition[] | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  const paintGesture = useRef<{ mode: InteractionMode; touchedKeys: Set<string>; positions: LayoutPosition[] } | null>(null);
  const suppressNextClick = useRef(false);

  useEffect(() => {
    if (!pendingCoupleAnchor) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingCoupleAnchor(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pendingCoupleAnchor]);

  const endPaint = useCallback(() => {
    const gesture = paintGesture.current;
    paintGesture.current = null;
    setDraftPositions(null);
    setIsPainting(false);
    if (gesture) onCommit(clearOrphanedCoupleHalves(gesture.positions));
  }, [onCommit]);

  useEffect(() => {
    if (!isPainting) return;
    window.addEventListener("mouseup", endPaint);
    return () => window.removeEventListener("mouseup", endPaint);
  }, [isPainting, endPaint]);

  const startPaint = (keys: string[]) => {
    if (readOnly || mode === "SELECT" || mode === "COUPLE") return;
    suppressNextClick.current = true;
    let next = positions;
    for (const k of keys) next = paintCell(next, k, mode);
    paintGesture.current = { mode, touchedKeys: new Set(keys), positions: next };
    setDraftPositions(next);
    setIsPainting(true);
  };

  const continuePaint = (keys: string[]) => {
    const gesture = paintGesture.current;
    if (!gesture) return;
    const newKeys = keys.filter((k) => !gesture.touchedKeys.has(k));
    if (newKeys.length === 0) return;
    newKeys.forEach((k) => gesture.touchedKeys.add(k));
    let next = gesture.positions;
    for (const k of newKeys) next = paintCell(next, k, gesture.mode);
    gesture.positions = next;
    setDraftPositions(next);
  };

  /** Keyboard-activated (Enter/Space) paint — mouse clicks are already fully
   *  handled by the mousedown→mouseup drag gesture and skip this. */
  const handlePaintClick = (keys: string[]) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    let next = positions;
    for (const k of keys) next = paintCell(next, k, mode);
    onCommit(clearOrphanedCoupleHalves(next));
  };

  const effectivePositions = draftPositions ?? positions;
  const byKey = new Map(effectivePositions.map((p) => [positionKey(p.rowIndex, p.columnIndex), p]));
  const rows = [...new Set(effectivePositions.map((p) => p.rowIndex))].sort((a, b) => a - b);
  const maxCol = Math.max(0, ...effectivePositions.map((p) => p.columnIndex));

  const handleSelectClick = (clickPositions: LayoutPosition[], e: React.MouseEvent) => {
    const keys = clickPositions.map((cp) => positionKey(cp.rowIndex, cp.columnIndex));
    const p = clickPositions[0];
    const key = keys[0];

    if (e.shiftKey && anchorKey) {
      const [arStr, acStr] = anchorKey.split(":");
      const ar = Number(arStr), ac = Number(acStr);
      if (ar === p.rowIndex) {
        const lo = Math.min(ac, p.columnIndex), hi = Math.max(ac, p.columnIndex);
        const range = new Set<string>();
        for (let c = lo; c <= hi; c++) range.add(positionKey(p.rowIndex, c));
        onSelectionChange(range);
      } else {
        onSelectionChange(new Set(keys));
        setAnchorKey(key);
      }
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selected);
      const allSelected = keys.every((k) => next.has(k));
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      onSelectionChange(next);
      setAnchorKey(key);
    } else {
      onSelectionChange(new Set(keys));
      setAnchorKey(key);
    }
  };

  const handleCoupleClick = (clickPositions: LayoutPosition[]) => {
    const p = clickPositions[0];
    const key = positionKey(p.rowIndex, p.columnIndex);

    if (!pendingCoupleAnchor) {
      setPendingCoupleAnchor(key);
      return;
    }
    if (clickPositions.some((cp) => positionKey(cp.rowIndex, cp.columnIndex) === pendingCoupleAnchor)) {
      setPendingCoupleAnchor(null);
      return;
    }
    const [arStr, acStr] = pendingCoupleAnchor.split(":");
    const ar = Number(arStr), ac = Number(acStr);
    if (clickPositions.length === 1 && ar === p.rowIndex && Math.abs(ac - p.columnIndex) === 1) {
      const pair = new Set([pendingCoupleAnchor, key]);
      const groupId = crypto.randomUUID();
      onCommit(clearOrphanedCoupleHalves(applyAssignment(positions, pair, "SEAT", "COUPLE", groupId)));
      setPendingCoupleAnchor(null);
    } else {
      onError?.("That seat isn't adjacent to the first one — pick a seat right next to it in the same row, or press Esc to cancel.");
    }
  };

  const handleCellClick = (clickPositions: LayoutPosition[], e: React.MouseEvent) => {
    if (readOnly) return;
    if (mode === "SELECT") { handleSelectClick(clickPositions, e); return; }
    if (mode === "COUPLE") { handleCoupleClick(clickPositions); return; }
    handlePaintClick(clickPositions.map((cp) => positionKey(cp.rowIndex, cp.columnIndex)));
  };

  const handleCellMouseDown = (clickPositions: LayoutPosition[]) => {
    if (readOnly || mode === "SELECT" || mode === "COUPLE") return;
    startPaint(clickPositions.map((cp) => positionKey(cp.rowIndex, cp.columnIndex)));
  };

  const handleCellMouseEnter = (clickPositions: LayoutPosition[]) => {
    if (readOnly || mode === "SELECT" || mode === "COUPLE") return;
    continuePaint(clickPositions.map((cp) => positionKey(cp.rowIndex, cp.columnIndex)));
  };

  const selectRow = (rowIndex: number) => {
    setPendingCoupleAnchor(null);
    const keys = effectivePositions.filter((p) => p.rowIndex === rowIndex).map((p) => positionKey(p.rowIndex, p.columnIndex));
    onSelectionChange(new Set(keys));
  };

  const selectColumn = (columnIndex: number) => {
    setPendingCoupleAnchor(null);
    const keys = effectivePositions.filter((p) => p.columnIndex === columnIndex).map((p) => positionKey(p.rowIndex, p.columnIndex));
    onSelectionChange(new Set(keys));
  };

  /** Renders a regular position or one double-width Couple group. The second
   *  underlying position is skipped visually, while both positions retain
   *  their physical seat codes and are selected as one atomic group. */
  const renderCell = (rowIndex: number, col: number) => {
    const p = byKey.get(positionKey(rowIndex, col));
    if (!p) return <div key={col} style={{ width: `${SEAT_CELL_WIDTH}px`, height: `${SEAT_CELL_HEIGHT}px` }} />;

    const prev = col > 0 ? byKey.get(positionKey(rowIndex, col - 1)) : undefined;
    const isCoupleSecondHalf =
      p.positionType === "SEAT" && p.seatType === "COUPLE" && p.seatGroupId != null &&
      prev?.positionType === "SEAT" && prev.seatType === "COUPLE" && prev.seatGroupId === p.seatGroupId;
    if (isCoupleSecondHalf) return null;

    const next = byKey.get(positionKey(rowIndex, col + 1));
    const isCoupleFirstHalf =
      p.positionType === "SEAT" && p.seatType === "COUPLE" && p.seatGroupId != null &&
      next?.positionType === "SEAT" && next.seatType === "COUPLE" && next.seatGroupId === p.seatGroupId;

    if (isCoupleFirstHalf && next) {
      const key1 = positionKey(p.rowIndex, p.columnIndex);
      const key2 = positionKey(next.rowIndex, next.columnIndex);
      return (
        <CoupleSeatGroup
          key={col}
          first={p}
          second={next}
          isSelected={selected.has(key1) && selected.has(key2)}
          isHighlighted={highlightedKeys?.has(key1) || highlightedKeys?.has(key2)}
          disabled={readOnly}
          onClick={(e) => handleCellClick([p, next], e)}
          onMouseDown={() => handleCellMouseDown([p, next])}
          onMouseEnter={() => handleCellMouseEnter([p, next])}
        />
      );
    }

    const key = positionKey(rowIndex, col);
    return (
      <SeatCell
        key={col}
        position={p}
        isSelected={selected.has(key)}
        isPendingAnchor={pendingCoupleAnchor === key}
        isHighlighted={highlightedKeys?.has(key)}
        disabled={readOnly}
        onClick={(e) => handleCellClick([p], e)}
        onMouseDown={() => handleCellMouseDown([p])}
        onMouseEnter={() => handleCellMouseEnter([p])}
      />
    );
  };

  return (
    <div>
      <style>{`
        @keyframes seatPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      {!readOnly && pendingCoupleAnchor && (
        <p className="mb-3 flex items-center gap-1.5" style={{ fontSize: "12px", color: "#9333ea", fontWeight: 600 }}>
          Now click the seat right next to it (same row) to complete the Couple pair — or press Esc to cancel.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: `${SEAT_CELL_GAP}px`, minWidth: "fit-content", margin: "0 auto", width: "fit-content" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: `${ROW_HEADER_WIDTH}px`, flexShrink: 0 }} />
          <div style={{ display: "flex", gap: `${SEAT_CELL_GAP}px` }}>
            {Array.from({ length: maxCol + 1 }, (_, col) => (
              <button
                key={col}
                type="button"
                disabled={readOnly || mode !== "SELECT"}
                onClick={() => selectColumn(col)}
                title={`Select column ${col + 1}`}
                style={{ width: `${SEAT_CELL_WIDTH}px`, flexShrink: 0, fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", textAlign: "center", cursor: readOnly || mode !== "SELECT" ? "default" : "pointer", background: "transparent", border: "none" }}
              >
                {col + 1}
              </button>
            ))}
          </div>
        </div>
        {rows.map((rowIndex) => {
          const rowLabel = byKey.get(positionKey(rowIndex, 0))?.rowLabel ?? "";
          return (
            <div key={rowIndex} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                disabled={readOnly || mode !== "SELECT"}
                onClick={() => selectRow(rowIndex)}
                title={`Select row ${rowLabel}`}
                style={{ width: `${ROW_HEADER_WIDTH}px`, flexShrink: 0, fontSize: "12px", fontWeight: 700, color: "var(--text-sub)", textAlign: "center", cursor: readOnly || mode !== "SELECT" ? "default" : "pointer", background: "transparent", border: "none" }}
              >
                {rowLabel}
              </button>
              <div style={{ display: "flex", gap: `${SEAT_CELL_GAP}px` }}>
                {Array.from({ length: maxCol + 1 }, (_, col) => renderCell(rowIndex, col))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
