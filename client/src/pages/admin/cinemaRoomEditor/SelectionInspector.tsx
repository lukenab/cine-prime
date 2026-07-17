import { useState } from "react";
import { Accessibility, Armchair, ClipboardCopy, ClipboardPaste, FlipHorizontal2, Heart, MousePointer2, Minus, Square, X } from "lucide-react";
import type { LayoutPosition, SeatTypeValue } from "../../../api/movieApi";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import {
  applyAssignment, convertColumnToAisle, convertRowToCouple, copyRowPattern, mirrorRow, pasteRowPattern,
  positionKey, SEAT_TYPE_LABELS, type RowPatternCell,
} from "./cinemaRoomLayoutGenerator";

type Props = {
  positions: LayoutPosition[];
  selected: Set<string>;
  onCommit: (next: LayoutPosition[]) => void;
  onClearSelection: () => void;
  copiedRowPattern: RowPatternCell[] | null;
  onCopyRow: (pattern: RowPatternCell[] | null) => void;
  onNotice?: (message: string) => void;
  disabled?: boolean;
};

const btnStyle: React.CSSProperties = {
  fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)",
};

function ActionButton({ label, icon: Icon, onClick, color, disabled }: { label: string; icon: React.ElementType; onClick: () => void; color?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border hover:opacity-80 disabled:opacity-40 w-full"
      style={{ ...btnStyle, color: color ?? btnStyle.color }}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{label}</span>
      <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}

function entireRowIndex(positions: LayoutPosition[], selectedPositions: LayoutPosition[]): number | null {
  if (selectedPositions.length === 0) return null;
  const rowIndex = selectedPositions[0].rowIndex;
  if (!selectedPositions.every((p) => p.rowIndex === rowIndex)) return null;
  const totalInRow = positions.filter((p) => p.rowIndex === rowIndex).length;
  return selectedPositions.length === totalInRow ? rowIndex : null;
}

function entireColumnIndex(positions: LayoutPosition[], selectedPositions: LayoutPosition[]): number | null {
  if (selectedPositions.length === 0) return null;
  const columnIndex = selectedPositions[0].columnIndex;
  if (!selectedPositions.every((p) => p.columnIndex === columnIndex)) return null;
  const totalInColumn = positions.filter((p) => p.columnIndex === columnIndex).length;
  return selectedPositions.length === totalInColumn ? columnIndex : null;
}

/** Contextual panel next to the seat grid: shows details for the current
 *  selection and (for 2+ positions) bulk actions, plus row/column-specific
 *  actions when the whole selection is exactly one full row or column (spec
 *  §12's "put it in the Inspector instead of a context menu" option). */
export function SelectionInspector({ positions, selected, onCommit, onClearSelection, copiedRowPattern, onCopyRow, onNotice, disabled }: Props) {
  const [confirmCoupleRow, setConfirmCoupleRow] = useState<number | null>(null);

  const byKey = new Map(positions.map((p) => [positionKey(p.rowIndex, p.columnIndex), p]));
  const selectedPositions = [...selected].map((k) => byKey.get(k)).filter((p): p is LayoutPosition => !!p);

  const bulkAssignSeat = (seatType: SeatTypeValue) => {
    onCommit(applyAssignment(positions, selected, "SEAT", seatType, null));
    onClearSelection();
  };
  const bulkAssignPosition = (positionType: "AISLE" | "EXIT" | "EMPTY_SPACE") => {
    onCommit(applyAssignment(positions, selected, positionType, null, null));
    onClearSelection();
  };

  const assignmentActions = (
    <div className="grid grid-cols-2 gap-1.5 pt-2 mt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
      <ActionButton label="Standard" icon={Armchair} onClick={() => bulkAssignSeat("STANDARD")} disabled={disabled} />
      <ActionButton label="VIP" icon={Armchair} color="#d97706" onClick={() => bulkAssignSeat("VIP")} disabled={disabled} />
      <ActionButton label="Accessible" icon={Accessibility} color="#0d9488" onClick={() => bulkAssignSeat("ACCESSIBLE")} disabled={disabled} />
      <ActionButton label="Aisle" icon={Minus} onClick={() => bulkAssignPosition("AISLE")} disabled={disabled} />
      <ActionButton label="Empty space" icon={Square} onClick={() => bulkAssignPosition("EMPTY_SPACE")} disabled={disabled} />
    </div>
  );

  if (selectedPositions.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <p className="flex items-center gap-1.5" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
          <MousePointer2 size={14} /> No positions selected
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "8px", lineHeight: 1.5 }}>
          In Select mode, click a seat, row, or column to view details and apply bulk changes.
        </p>
        <ul style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "10px", lineHeight: 1.7, paddingLeft: "16px", listStyle: "disc" }}>
          <li>Ctrl/Cmd-click to add or remove one position</li>
          <li>Shift-click to select a range in a row</li>
          <li>Click a row/column number to select it entirely</li>
          <li>Escape clears the selection</li>
        </ul>
      </div>
    );
  }

  if (selectedPositions.length === 1) {
    const p = selectedPositions[0];
    return (
      <div className="rounded-xl p-4 space-y-1" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-sub)", textTransform: "uppercase" }}>Manual adjustments</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>Selected position</p>
          </div>
          <button type="button" onClick={onClearSelection} aria-label="Clear selection" className="p-1 rounded hover:opacity-70">
            <X size={14} style={{ color: "var(--text-sub)" }} />
          </button>
        </div>
        {p.positionType === "SEAT" ? (
          <>
            <Field label="Seat code" value={p.seatCode ?? "—"} />
            <Field label="Row" value={p.rowLabel} />
            <Field label="Column" value={p.columnIndex + 1} />
            <Field label="Position type" value="Seat" />
            <Field label="Seat type" value={p.seatType ? SEAT_TYPE_LABELS[p.seatType] : "—"} />
            <Field label="Seat group" value={p.seatGroupId ? p.seatGroupId.slice(0, 8) : "—"} />
            <Field label="Sellable capacity" value={1} />
          </>
        ) : (
          <>
            <Field label="Row" value={p.rowLabel} />
            <Field label="Column" value={p.columnIndex + 1} />
            <Field label="Position type" value={p.positionType === "EMPTY_SPACE" ? "Empty space" : p.positionType === "AISLE" ? "Aisle" : "Exit"} />
            <Field label="Sellable capacity" value={0} />
          </>
        )}
        {assignmentActions}
      </div>
    );
  }

  const isCoupleGroup =
    selectedPositions.length === 2 &&
    selectedPositions[0].seatType === "COUPLE" && selectedPositions[1].seatType === "COUPLE" &&
    !!selectedPositions[0].seatGroupId && selectedPositions[0].seatGroupId === selectedPositions[1].seatGroupId;

  if (isCoupleGroup) {
    const [a, b] = [...selectedPositions].sort((x, y) => x.columnIndex - y.columnIndex);
    return (
      <div className="rounded-xl p-4 space-y-1" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-sub)", textTransform: "uppercase" }}>Manual adjustments</p>
            <p className="flex items-center gap-1.5" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
              <Heart size={13} style={{ color: "#9333ea" }} /> Selected Couple Group
            </p>
          </div>
          <button type="button" onClick={onClearSelection} aria-label="Clear selection" className="p-1 rounded hover:opacity-70">
            <X size={14} style={{ color: "var(--text-sub)" }} />
          </button>
        </div>
        <Field label="Display code" value={`${a.seatCode}–${b.seatCode}`} />
        <Field label="Positions" value={`${a.seatCode}, ${b.seatCode}`} />
        <Field label="Position type" value="Seat" />
        <Field label="Seat type" value="Couple" />
        <Field label="Sellable capacity" value={2} />
        <details className="mt-2">
          <summary style={{ fontSize: "11px", color: "var(--text-sub)", cursor: "pointer" }}>Technical details</summary>
          <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px", wordBreak: "break-all" }}>
            Seat group: {a.seatGroupId}
          </p>
        </details>
        {assignmentActions}
      </div>
    );
  }

  const counts = { standard: 0, vip: 0, couple: 0, accessible: 0, aisle: 0, exit: 0, emptySpace: 0 };
  let sellableCapacity = 0;
  for (const p of selectedPositions) {
    if (p.positionType === "AISLE") counts.aisle++;
    else if (p.positionType === "EXIT") counts.exit++;
    else if (p.positionType === "EMPTY_SPACE") counts.emptySpace++;
    else if (p.positionType === "SEAT" && p.seatType) {
      if (p.seatType === "STANDARD") { counts.standard++; sellableCapacity += 1; }
      else if (p.seatType === "VIP") { counts.vip++; sellableCapacity += 1; }
      else if (p.seatType === "ACCESSIBLE") { counts.accessible++; sellableCapacity += 1; }
      else if (p.seatType === "COUPLE") { counts.couple++; sellableCapacity += 1; }
    }
  }

  const rowIndex = entireRowIndex(positions, selectedPositions);
  const columnIndex = entireColumnIndex(positions, selectedPositions);
  const rowLabel = rowIndex != null ? (positions.find((p) => p.rowIndex === rowIndex)?.rowLabel ?? "") : "";

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-sub)", textTransform: "uppercase" }}>Manual adjustments</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>{selectedPositions.length} positions selected</p>
        </div>
        <button type="button" onClick={onClearSelection} aria-label="Clear selection" className="p-1 rounded hover:opacity-70">
          <X size={14} style={{ color: "var(--text-sub)" }} />
        </button>
      </div>

      <div className="space-y-1">
        {counts.standard > 0 && <Field label="Standard" value={counts.standard} />}
        {counts.vip > 0 && <Field label="VIP" value={counts.vip} />}
        {counts.couple > 0 && <Field label="Couple (individual seats)" value={counts.couple} />}
        {counts.accessible > 0 && <Field label="Wheelchair / Accessible" value={counts.accessible} />}
        {counts.aisle > 0 && <Field label="Aisle" value={counts.aisle} />}
        {counts.exit > 0 && <Field label="Exit" value={counts.exit} />}
        {counts.emptySpace > 0 && <Field label="Empty Space" value={counts.emptySpace} />}
        <Field label="Sellable capacity" value={sellableCapacity} />
      </div>

      {assignmentActions}

      {rowIndex != null && (
        <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Row {rowLabel} actions
          </p>
          <ActionButton
            label="Convert Row to Couple"
            icon={Heart}
            color="#9333ea"
            onClick={() => setConfirmCoupleRow(rowIndex)}
            disabled={disabled}
          />
          <ActionButton
            label="Copy Row"
            icon={ClipboardCopy}
            onClick={() => onCopyRow(copyRowPattern(positions, rowIndex))}
            disabled={disabled}
          />
          {copiedRowPattern && (
            <ActionButton
              label="Paste Row"
              icon={ClipboardPaste}
              onClick={() => { onCommit(pasteRowPattern(positions, rowIndex, copiedRowPattern)); onClearSelection(); }}
              disabled={disabled}
            />
          )}
          <ActionButton
            label="Mirror Row"
            icon={FlipHorizontal2}
            onClick={() => { onCommit(mirrorRow(positions, rowIndex)); onClearSelection(); }}
            disabled={disabled}
          />
          <ActionButton label="Clear Row" icon={Square} onClick={() => bulkAssignPosition("EMPTY_SPACE")} disabled={disabled} />
        </div>
      )}

      {columnIndex != null && (
        <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Column {columnIndex + 1} actions
          </p>
          <ActionButton
            label="Convert Column to Aisle"
            icon={Minus}
            onClick={() => { onCommit(convertColumnToAisle(positions, columnIndex)); onClearSelection(); }}
            disabled={disabled}
          />
          <ActionButton label="Clear Column" icon={Square} onClick={() => bulkAssignPosition("EMPTY_SPACE")} disabled={disabled} />
        </div>
      )}

      {confirmCoupleRow != null && (
        <ConfirmDialog
          title="Convert row to Couple seats?"
          danger
          confirmLabel="Convert to Couple"
          body="This pairs every seat in this row into Couples, left to right, overwriting any Standard/VIP/Accessible seats currently there. An odd leftover seat becomes empty space."
          onConfirm={() => {
            const { positions: next, warning } = convertRowToCouple(positions, confirmCoupleRow);
            onCommit(next);
            if (warning) onNotice?.(warning);
            setConfirmCoupleRow(null);
            onClearSelection();
          }}
          onCancel={() => setConfirmCoupleRow(null)}
        />
      )}
    </div>
  );
}
