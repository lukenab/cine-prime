import { useState } from "react";
import { Percent } from "lucide-react";
import type { LayoutPosition } from "../../../api/movieApi";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import type { DistributionTemplateForm } from "./cinemaRoomEditor.types";
import { applySeatDistributionTemplate, computeTemplateAllocation } from "./cinemaRoomLayoutGenerator";

type Props = {
  value: DistributionTemplateForm;
  onChange: (next: DistributionTemplateForm) => void;
  positions: LayoutPosition[];
  onApply: (next: LayoutPosition[]) => void;
  onWarnings: (warnings: string[]) => void;
  disabled?: boolean;
};

const inputStyle: React.CSSProperties = {
  fontSize: "14px",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
};

function clampPct(raw: string): number {
  const n = Math.round(Number(raw));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** "Seat Distribution Template" quick-fill (spec §7) — a one-shot generator,
 *  not persisted form state: front rows become Standard, the middle VIP, and
 *  the trailing rows Couple, split by these three percentages. The three
 *  numbers must not add up to more than 100%; Apply is blocked until fixed. */
export function SeatDistributionSection({ value, onChange, positions, onApply, onWarnings, disabled }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totalRows = new Set(positions.map((p) => p.rowIndex)).size;
  const allocation = computeTemplateAllocation(totalRows, value.standardPct, value.vipPct, value.couplePct);
  const hasCustomization = positions.some((p) => p.positionType !== "SEAT" || p.seatType !== "STANDARD");

  const totalPct = value.standardPct + value.vipPct + value.couplePct;
  const totalExceeds100 = totalPct > 100;

  const doApply = () => {
    const result = applySeatDistributionTemplate(positions, value.standardPct, value.vipPct, value.couplePct);
    onApply(result.positions);
    onWarnings(result.warnings);
    setConfirmOpen(false);
  };

  const handleApplyClick = () => {
    if (positions.length === 0 || totalExceeds100) return;
    if (hasCustomization) setConfirmOpen(true);
    else doApply();
  };

  const pctField = (label: string, field: keyof Pick<DistributionTemplateForm, "standardPct" | "vipPct" | "couplePct">, accent: string) => (
    <div>
      <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>{label} %</span>
      <div className="relative mt-1">
        <input
          type="number" min={0} max={100} step={1}
          value={value[field]}
          disabled={disabled}
          aria-label={`${label} percentage`}
          onChange={(e) => onChange({ ...value, [field]: clampPct(e.target.value) })}
          className="w-full pl-3.5 pr-8 py-2 rounded-xl border outline-none focus:border-blue-400 transition-colors"
          style={{ ...inputStyle, borderColor: totalExceeds100 ? "#ef4444" : "var(--border-color)" }}
        />
        <span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ right: "12px", fontSize: "12px", color: accent, fontWeight: 700 }}
        >
          %
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {pctField("Standard", "standardPct", "#3b82f6")}
        {pctField("VIP", "vipPct", "#d97706")}
        {pctField("Couple", "couplePct", "#9333ea")}
      </div>

      {totalExceeds100 ? (
        <p style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>
          Total is {totalPct}% — Standard + VIP + Couple can't add up to more than 100%.
        </p>
      ) : (
        <p style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>
          Total: {totalPct}%. Couple rows are always the trailing rows.
        </p>
      )}

      {totalRows > 0 && (
        <div className="rounded-xl px-3.5 py-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>
            This template will generate:
          </p>
          <ul style={{ fontSize: "12px", color: "var(--text-sub)", lineHeight: 1.6, paddingLeft: "16px" }}>
            <li>{allocation.standardRowCount} Standard row(s)</li>
            <li>{allocation.vipRowCount} VIP row(s)</li>
            <li>{allocation.coupleRowCount} Couple row(s)</li>
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleApplyClick}
        disabled={disabled || positions.length === 0 || totalExceeds100}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white hover:opacity-90 disabled:opacity-40 w-full"
        style={{ fontSize: "12px", fontWeight: 600, background: "#2563eb" }}
      >
        <Percent size={12} /> Apply Template
      </button>

      {confirmOpen && (
        <ConfirmDialog
          title="Overwrite the current layout?"
          danger
          confirmLabel="Apply Template"
          body="You've already customized this layout by hand. Applying the template reassigns seat types row-by-row and will overwrite those manual edits."
          onConfirm={doApply}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
