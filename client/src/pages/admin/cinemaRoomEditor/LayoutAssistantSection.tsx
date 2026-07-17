import { useEffect, useMemo, useState } from "react";
import { Eye, Minus, Plus, X } from "lucide-react";
import type { LayoutPosition } from "../../../api/movieApi";
import type { GridConfigForm, LayoutAssistantForm, SeatZoneRule } from "./cinemaRoomEditor.types";
import {
  computeLayoutDiff, computeLayoutStats, excelRowLabel, generateLayoutFromAssistant, parseRowLabelIndex, suggestVerticalAisleColumns,
} from "./cinemaRoomLayoutGenerator";

type Props = {
  value: LayoutAssistantForm;
  onChange: (next: LayoutAssistantForm) => void;
  gridConfig: GridConfigForm;
  positions: LayoutPosition[];
  onApply: (next: LayoutPosition[]) => void;
  onPreview: (next: LayoutPosition[] | null) => void;
  onWarnings: (warnings: string[]) => void;
  disabled?: boolean;
};

const fieldStyle: React.CSSProperties = {
  fontSize: "12px", background: "var(--bg-card)", color: "var(--text-main)",
  border: "1px solid var(--border-color)",
};

function newZone(fromRow: number, toRow: number, seatType: SeatZoneRule["seatType"]): SeatZoneRule {
  return { id: crypto.randomUUID(), fromRow, toRow, seatType };
}

function rangeLabel(start: number, count: number, firstLabelIndex: number): string {
  if (count <= 0) return "None";
  const first = excelRowLabel(firstLabelIndex + start);
  const last = excelRowLabel(firstLabelIndex + start + count - 1);
  return first === last ? first : `${first}–${last}`;
}

/** Guided authoring flow for operational room creation: preset, simple row
 * allocation and walkways. Per-position exceptions belong in the seat map. */
export function LayoutAssistantSection({
  value, onChange, gridConfig, positions, onApply, onPreview, onWarnings,
  disabled,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [manualWalkwaysOpen, setManualWalkwaysOpen] = useState(false);

  const firstLabelIndex = parseRowLabelIndex(gridConfig.firstRowLabel);
  const lastRowIndex = Math.max(0, gridConfig.numberOfRows - 1);
  const coupleLastRow = value.zones.some((zone) => zone.seatType === "COUPLE" && zone.fromRow <= lastRowIndex && zone.toRow >= lastRowIndex);
  const allocatableRows = Math.max(0, gridConfig.numberOfRows - (coupleLastRow ? 1 : 0));
  const standardRows = Math.min(allocatableRows, Array.from({ length: allocatableRows }, (_, row) => row)
    .filter((row) => value.zones.some((zone) => zone.seatType === "STANDARD" && zone.fromRow <= row && zone.toRow >= row)).length);
  const vipRows = Math.max(0, allocatableRows - standardRows);
  const rowPercent = (count: number) => gridConfig.numberOfRows > 0
    ? Math.round((count / gridConfig.numberOfRows) * 100)
    : 0;

  const generated = useMemo(
    () => generateLayoutFromAssistant(positions, gridConfig, value),
    [positions, gridConfig, value],
  );
  const beforeStats = computeLayoutStats(positions);
  const afterStats = computeLayoutStats(generated.positions);
  const diff = computeLayoutDiff(positions, generated.positions);

  useEffect(() => {
    if (previewOpen) onPreview(generated.positions);
  }, [generated.positions, onPreview, previewOpen]);

  const setSimpleAllocation = (nextStandardRows: number, nextCoupleLastRow: boolean) => {
    const available = Math.max(0, gridConfig.numberOfRows - (nextCoupleLastRow ? 1 : 0));
    const standard = Math.max(0, Math.min(available, nextStandardRows));
    const vip = available - standard;
    const zones: SeatZoneRule[] = [];
    if (standard > 0) zones.push(newZone(0, standard - 1, "STANDARD"));
    if (vip > 0) zones.push(newZone(standard, available - 1, "VIP"));
    if (nextCoupleLastRow) zones.push(newZone(gridConfig.numberOfRows - 1, gridConfig.numberOfRows - 1, "COUPLE"));
    onChange({ ...value, templateCode: "CUSTOM", templateVersion: 1, zones });
  };

  const addVerticalAisle = (afterSeat: number) => {
    if (!afterSeat || value.verticalAisleColumns.includes(afterSeat)) return;
    onChange({ ...value, verticalAisleColumns: [...value.verticalAisleColumns, afterSeat].sort((a, b) => a - b) });
  };

  const addCrossAisle = (aisleRowIndex: number) => {
    if (!aisleRowIndex || value.horizontalAisleRows.includes(aisleRowIndex)) return;
    onChange({ ...value, horizontalAisleRows: [...value.horizontalAisleRows, aisleRowIndex].sort((a, b) => a - b) });
  };

  const addWalkway = (selection: string) => {
    const [kind, rawIndex] = selection.split(":");
    const index = Number(rawIndex);
    if (kind === "vertical") addVerticalAisle(index);
    if (kind === "cross") addCrossAisle(index);
  };

  const applyWalkwaySuggestion = () => {
    const centerRow = gridConfig.numberOfRows >= 14
      ? Math.floor(gridConfig.numberOfRows / 2)
      : null;
    onChange({
      ...value,
      verticalAisleColumns: suggestVerticalAisleColumns(gridConfig.maxPositionsPerRow, coupleLastRow),
      horizontalAisleRows: centerRow ? [centerRow] : [],
    });
  };

  const discardPreview = () => {
    setPreviewOpen(false);
    onPreview(null);
  };

  const applyPreview = () => {
    onApply(generated.positions);
    onWarnings(generated.warnings);
    setPreviewOpen(false);
    onPreview(null);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-main)" }}>Seat allocation</span>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5">
            <div><p style={{ fontSize: "12px", fontWeight: 700, color: "#3b82f6" }}>Standard</p><p style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>Rows {rangeLabel(0, standardRows, firstLabelIndex)} · {rowPercent(standardRows)}% of room</p></div>
            <strong style={{ fontSize: "11px", color: "var(--text-main)", whiteSpace: "nowrap" }}>{standardRows} rows</strong>
            <div className="flex gap-1">
              <button type="button" aria-label="Decrease Standard rows" disabled={disabled || standardRows <= 0} onClick={() => setSimpleAllocation(standardRows - 1, coupleLastRow)} className="w-7 h-7 rounded-lg border disabled:opacity-30" style={{ borderColor: "var(--border-color)" }}><Minus size={12} className="mx-auto" /></button>
              <button type="button" aria-label="Increase Standard rows" disabled={disabled || standardRows >= allocatableRows} onClick={() => setSimpleAllocation(standardRows + 1, coupleLastRow)} className="w-7 h-7 rounded-lg border disabled:opacity-30" style={{ borderColor: "var(--border-color)" }}><Plus size={12} className="mx-auto" /></button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div><p style={{ fontSize: "12px", fontWeight: 700, color: "#d97706" }}>VIP</p><p style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>Rows {rangeLabel(standardRows, vipRows, firstLabelIndex)} · {rowPercent(vipRows)}% of room</p></div>
            <strong style={{ fontSize: "11px", color: "var(--text-main)", whiteSpace: "nowrap" }}>{vipRows} rows</strong>
            <div className="flex gap-1">
              <button type="button" aria-label="Decrease VIP rows" disabled={disabled || vipRows <= 0} onClick={() => setSimpleAllocation(standardRows + 1, coupleLastRow)} className="w-7 h-7 rounded-lg border disabled:opacity-30" style={{ borderColor: "var(--border-color)" }}><Minus size={12} className="mx-auto" /></button>
              <button type="button" aria-label="Increase VIP rows" disabled={disabled || vipRows >= allocatableRows} onClick={() => setSimpleAllocation(standardRows - 1, coupleLastRow)} className="w-7 h-7 rounded-lg border disabled:opacity-30" style={{ borderColor: "var(--border-color)" }}><Plus size={12} className="mx-auto" /></button>
            </div>
          </div>
          <button type="button" disabled={disabled || gridConfig.numberOfRows < 2} onClick={() => setSimpleAllocation(standardRows, !coupleLastRow)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left disabled:opacity-40" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div><p style={{ fontSize: "12px", fontWeight: 700, color: "#9333ea" }}>Couple last row</p><p style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>{coupleLastRow ? `Row ${excelRowLabel(firstLabelIndex + lastRowIndex)} · ${rowPercent(1)}% of room` : "Disabled"}</p></div>
            <span className="relative rounded-full" style={{ width: "34px", height: "20px", background: coupleLastRow ? "#9333ea" : "rgba(128,128,128,0.25)" }}>
              <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: "16px", height: "16px", left: coupleLastRow ? "16px" : "2px" }} />
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-main)" }}>Walkways</span>
          <button type="button" disabled={disabled} onClick={() => setManualWalkwaysOpen((open) => !open)}
            style={{ fontSize: "10.5px", fontWeight: 700, color: "#2563eb" }}>
            {manualWalkwaysOpen ? "Hide manual" : "Add manually"}
          </button>
        </div>
        <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <button type="button" disabled={disabled} onClick={applyWalkwaySuggestion}
            className="w-full h-9 rounded-lg border disabled:opacity-40"
            style={{ fontSize: "11.5px", fontWeight: 700, color: "#2563eb", borderColor: "rgba(37,99,235,0.35)", background: "rgba(37,99,235,0.08)" }}>
            Apply recommended walkways
          </button>

          {(value.verticalAisleColumns.length > 0 || value.horizontalAisleRows.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {value.verticalAisleColumns.map((column) => (
                <span key={`vertical-${column}`} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ fontSize: "10.5px", color: "var(--text-main)", background: "rgba(100,116,139,0.14)" }}>
                  After seat {column}
                  <button type="button" aria-label={`Remove vertical aisle after seat ${column}`} onClick={() => onChange({ ...value, verticalAisleColumns: value.verticalAisleColumns.filter((item) => item !== column) })}><X size={11} /></button>
                </span>
              ))}
              {value.horizontalAisleRows.map((row) => (
                <span key={`cross-${row}`} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ fontSize: "10.5px", color: "var(--text-main)", background: "rgba(100,116,139,0.14)" }}>
                  After row {excelRowLabel(firstLabelIndex + row - 1)}
                  <button type="button" aria-label={`Remove cross aisle at row ${row}`} onClick={() => onChange({ ...value, horizontalAisleRows: value.horizontalAisleRows.filter((item) => item !== row) })}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}

          {manualWalkwaysOpen && (
            <label className="block pt-1">
              <span style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>Choose where the walkway begins</span>
              <select value="" disabled={disabled || (gridConfig.maxPositionsPerRow < 2 && gridConfig.numberOfRows < 2)} onChange={(event) => addWalkway(event.target.value)}
                aria-label="Add walkway" className="cinema-select w-full h-9 px-3 rounded-lg mt-1 appearance-none" style={fieldStyle}>
                <option value="">Select seat or row…</option>
                <optgroup label="Vertical aisle">
                  {Array.from({ length: Math.max(0, gridConfig.maxPositionsPerRow - 1) }, (_, index) => index + 1)
                    .filter((afterSeat) => !value.verticalAisleColumns.includes(afterSeat))
                    .map((afterSeat) => <option key={`vertical-${afterSeat}`} value={`vertical:${afterSeat}`}>After seat {afterSeat}</option>)}
                </optgroup>
                <optgroup label="Cross-row aisle">
                  {Array.from({ length: Math.max(0, gridConfig.numberOfRows - 1) }, (_, index) => index + 1)
                    .filter((aisleRow) => !value.horizontalAisleRows.includes(aisleRow))
                    .map((aisleRow) => <option key={`cross-${aisleRow}`} value={`cross:${aisleRow}`}>After row {excelRowLabel(firstLabelIndex + aisleRow - 1)}</option>)}
                </optgroup>
              </select>
            </label>
          )}
        </div>
      </div>

      {!previewOpen ? (
        <button type="button" disabled={disabled} onClick={() => setPreviewOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-white disabled:opacity-40"
          style={{ background: "#2563eb", fontSize: "12px", fontWeight: 700 }}>
          <Eye size={14} /> Preview Layout
        </button>
      ) : (
        <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.28)" }}>
          <p style={{ fontSize: "11px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase" }}>Preview ready</p>
          <p style={{ fontSize: "11px", color: "var(--text-sub)", lineHeight: 1.45 }}>
            {diff.changedPositionCount} changed · {diff.addedPositionCount} added · {diff.removedPositionCount} removed<br />
            Capacity <strong style={{ color: "var(--text-main)" }}>{beforeStats.sellableCapacity} → {afterStats.sellableCapacity}</strong><br />
            Standard {afterStats.standardCount} · VIP {afterStats.vipCount} · Couple {afterStats.coupleCapacity} seats ({afterStats.coupleGroupCount} {afterStats.coupleGroupCount === 1 ? "pair" : "pairs"})
          </p>
          {generated.warnings.map((warning) => <p key={warning} style={{ fontSize: "10.5px", color: "#d97706" }}>Warning: {warning}</p>)}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={discardPreview} className="py-2 rounded-lg border" style={{ fontSize: "12px", fontWeight: 700, borderColor: "var(--border-color)", color: "var(--text-main)" }}>Discard</button>
            <button type="button" onClick={applyPreview} className="py-2 rounded-lg text-white" style={{ fontSize: "12px", fontWeight: 700, background: "#2563eb" }}>Apply Layout</button>
          </div>
        </div>
      )}

    </div>
  );
}
