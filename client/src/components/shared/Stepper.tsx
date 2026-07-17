import { Minus, Plus } from "lucide-react";

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

/** Generic `[-] N [+]` numeric stepper — used for row/positions-per-row counts
 *  (spec §5.5). No existing pattern in the codebase used plain number inputs
 *  for this; this is the first reusable stepper. */
export function Stepper({ label, value, min, max, step = 1, onChange, disabled }: StepperProps) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <div>
      <span className="flex items-end min-h-8" style={{ fontSize: "11px", color: "var(--text-sub)", lineHeight: 1.35 }}>{label}</span>
      <div
        className="grid items-center gap-1.5 mt-1"
        style={{ gridTemplateColumns: "32px minmax(44px, 1fr) 32px" }}
      >
        <button
          type="button"
          onClick={dec}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="number-stepper-input w-full min-w-0 text-center px-1 py-1.5 rounded-lg border outline-none focus:border-blue-400 transition-colors"
          style={{ fontSize: "14px", color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-main)" }}
        />
        <button
          type="button"
          onClick={inc}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
