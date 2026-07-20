import { useState } from "react";
import type { LayoutPosition, NumberingDirectionValue, NumberingPolicyValue } from "../../../api/movieApi";
import { Stepper } from "../../../components/shared/Stepper";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import type { GridConfigForm } from "./cinemaRoomEditor.types";
import type { RoomCapacityEnvelope } from "./cinemaRoomCapacity";
import { CapacityPlanningStatus } from "./CapacityPlanningStatus";
import { adjustColumnCount, adjustRowCount, computeResizeImpact, renumberLayout, type ResizeImpact } from "./cinemaRoomLayoutGenerator";
import { getFieldError, type ValidationIssue } from "./cinemaRoomValidation";

const MAX_ROWS = 50;
const MAX_POSITIONS_PER_ROW = 60;

type Props = {
  value: GridConfigForm;
  onChange: (next: GridConfigForm) => void;
  positions: LayoutPosition[];
  onResizePositions: (next: LayoutPosition[]) => void;
  issues: ValidationIssue[];
  capacityEnvelope?: RoomCapacityEnvelope;
  disabled?: boolean;
};

const inputStyle: React.CSSProperties = {
  fontSize: "14px",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
};

type PendingResize = { kind: "row" | "column"; target: number; impact: ResizeImpact };

/** Rows / positions-per-row as steppers that reshape the live seat grid.
 * Growing never asks; shrinking confirms when configured seats would be lost.
 * Direction/policy changes immediately renumber every sellable position. */
export function GridConfigurationSection({ value, onChange, positions, onResizePositions, issues, capacityEnvelope, disabled }: Props) {
  const [pendingResize, setPendingResize] = useState<PendingResize | null>(null);
  const maxRows = Math.max(1, Math.min(MAX_ROWS, capacityEnvelope?.maxRowsByDepth ?? MAX_ROWS));
  const maxPositionsPerRow = Math.max(1, Math.min(
    MAX_POSITIONS_PER_ROW,
    capacityEnvelope?.maxPositionsPerRowByWidth ?? MAX_POSITIONS_PER_ROW,
  ));

  const applyRowChange = (target: number) => {
    onResizePositions(renumberLayout(adjustRowCount(positions, target, value.numberingDirection), value.numberingPolicy, value.numberingDirection));
    onChange({ ...value, numberOfRows: target });
  };
  const applyColumnChange = (target: number) => {
    onResizePositions(renumberLayout(adjustColumnCount(positions, target, value.numberingDirection), value.numberingPolicy, value.numberingDirection));
    onChange({ ...value, maxPositionsPerRow: target });
  };

  const updateNumbering = (patch: Partial<Pick<GridConfigForm, "numberingDirection" | "numberingPolicy">>) => {
    const next = { ...value, ...patch };
    onChange(next);
    if (positions.length > 0) onResizePositions(renumberLayout(positions, next.numberingPolicy, next.numberingDirection));
  };

  const requestRowChange = (target: number) => {
    if (positions.length === 0) { onChange({ ...value, numberOfRows: target }); return; }
    const impact = computeResizeImpact(positions, "row", target);
    if (impact.removedSeatCount > 0) setPendingResize({ kind: "row", target, impact });
    else applyRowChange(target);
  };
  const requestColumnChange = (target: number) => {
    if (positions.length === 0) { onChange({ ...value, maxPositionsPerRow: target }); return; }
    const impact = computeResizeImpact(positions, "column", target);
    if (impact.removedSeatCount > 0) setPendingResize({ kind: "column", target, impact });
    else applyColumnChange(target);
  };

  const confirmPendingResize = () => {
    if (!pendingResize) return;
    if (pendingResize.kind === "row") applyRowChange(pendingResize.target);
    else applyColumnChange(pendingResize.target);
    setPendingResize(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stepper
          label="Number of rows"
          value={value.numberOfRows}
          min={1}
          max={maxRows}
          disabled={disabled}
          onChange={requestRowChange}
        />
        <Stepper
          label="Max positions per row"
          value={value.maxPositionsPerRow}
          min={1}
          max={maxPositionsPerRow}
          disabled={disabled}
          onChange={requestColumnChange}
        />
      </div>
      {capacityEnvelope?.maxPersonCapacity != null && (
        <CapacityPlanningStatus envelope={capacityEnvelope} />
      )}
      {getFieldError(issues, "numberOfRows") && (
        <p style={{ fontSize: "11px", color: "#ef4444" }}>{getFieldError(issues, "numberOfRows")}</p>
      )}
      {getFieldError(issues, "maxPositionsPerRow") && (
        <p style={{ fontSize: "11px", color: "#ef4444" }}>{getFieldError(issues, "maxPositionsPerRow")}</p>
      )}

      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
        <div className="min-w-0">
          <span className="flex items-end h-5" style={{ fontSize: "11px", color: "var(--text-sub)" }}>First row label</span>
          <input
            value={value.firstRowLabel}
            disabled={disabled}
            maxLength={2}
            onChange={(e) => onChange({ ...value, firstRowLabel: e.target.value.toUpperCase() })}
            className="w-full h-10 px-3.5 rounded-xl border outline-none focus:border-blue-400 transition-colors mt-1"
            style={{ ...inputStyle, fontSize: "12.5px", fontWeight: 600, background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
          />
        </div>
        <div className="min-w-0">
          <span className="flex items-end h-5" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Numbering direction</span>
          <div className="grid grid-cols-2 gap-1 p-1 h-10 rounded-lg border mt-1"
            role="group" aria-label="Numbering direction"
            style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            {([
              ["LEFT_TO_RIGHT", "L → R"],
              ["RIGHT_TO_LEFT", "R → L"],
            ] as [NumberingDirectionValue, string][]).map(([direction, label]) => {
              const active = value.numberingDirection === direction;
              return (
                <button key={direction} type="button" disabled={disabled}
                  aria-pressed={active} aria-label={direction === "LEFT_TO_RIGHT" ? "Number seats left to right" : "Number seats right to left"}
                  onClick={() => updateNumbering({ numberingDirection: direction })}
                  className="min-w-0 rounded-md disabled:opacity-50"
                  style={{ fontSize: "11.5px", fontWeight: 700, color: active ? "#fff" : "var(--text-sub)", background: active ? "#2563eb" : "transparent" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <span className="flex items-end h-5" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Seat numbering policy</span>
        <div className="grid gap-1.5 mt-1" role="radiogroup" aria-label="Seat numbering policy">
          {([
            ["CONTIGUOUS_SEATS", "Continuous", "A1, A2, A3 — aisles are skipped"],
            ["PHYSICAL_POSITION", "Physical position", "Numbers preserve gaps at aisles"],
          ] as [NumberingPolicyValue, string, string][]).map(([policy, label, description]) => {
            const active = value.numberingPolicy === policy;
            return (
              <button key={policy} type="button" role="radio" aria-checked={active} disabled={disabled}
                onClick={() => updateNumbering({ numberingPolicy: policy })}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left disabled:opacity-50"
                style={{ borderColor: active ? "#2563eb" : "var(--border-color)", background: active ? "rgba(37,99,235,0.08)" : "var(--bg-card)" }}>
                <span className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: "14px", height: "14px", border: `1.5px solid ${active ? "#2563eb" : "var(--text-sub)"}` }}>
                  {active && <span className="rounded-full" style={{ width: "7px", height: "7px", background: "#2563eb" }} />}
                </span>
                <span className="min-w-0">
                  <strong className="block" style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-main)" }}>{label}</strong>
                  <span className="block truncate" style={{ fontSize: "10px", color: "var(--text-sub)" }}>{description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {pendingResize && (
        <ConfirmDialog
          title={pendingResize.kind === "row" ? "Remove rows with configured seats?" : "Remove positions with configured seats?"}
          danger
          confirmLabel="Remove anyway"
          body={
            <div className="space-y-1">
              <p>
                Shrinking to {pendingResize.target} {pendingResize.kind === "row" ? "rows" : "positions per row"} removes{" "}
                {pendingResize.impact.removedCount} {pendingResize.kind === "row" ? "row(s)" : "column(s)"}, taking{" "}
                {pendingResize.impact.removedSeatCount} configured seat(s) with {pendingResize.impact.removedSeatCount === 1 ? "it" : "them"}.
              </p>
              {pendingResize.impact.affectedCoupleGroupIds.length > 0 && (
                <p>
                  {pendingResize.impact.affectedCoupleGroupIds.length} Couple group(s) will lose a seat and be converted to empty space.
                </p>
              )}
              <p>This can't be undone from this dialog.</p>
            </div>
          }
          onConfirm={confirmPendingResize}
          onCancel={() => setPendingResize(null)}
        />
      )}
    </div>
  );
}
