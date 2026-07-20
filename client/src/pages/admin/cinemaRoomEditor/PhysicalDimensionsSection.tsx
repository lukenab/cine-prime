import { CircleHelp } from "lucide-react";
import type { RoomInfoForm } from "./cinemaRoomEditor.types";
import { CINEMA_PLANNING_LIMITS } from "./cinemaRoomCapacity";
import { getFieldError, type ValidationIssue } from "./cinemaRoomValidation";

type Props = {
  value: RoomInfoForm;
  onChange: (next: RoomInfoForm) => void;
  issues: ValidationIssue[];
  disabled?: boolean;
};

const inputStyle: React.CSSProperties = {
  fontSize: "14px",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
};

export function PhysicalDimensionsSection({ value, onChange, issues, disabled }: Props) {
  const set = (patch: Partial<RoomInfoForm>) => onChange({ ...value, ...patch });
  const length = Number(value.lengthM);
  const width = Number(value.widthM);
  const areaSqm = length > 0 && width > 0 ? length * width : null;

  return (
    <div className="space-y-3">
      <div className="absolute right-0 top-[7px] z-20">
        <div className="relative group">
          <button
            type="button"
            aria-label="How room dimensions affect seat capacity"
            aria-describedby="dimension-planning-help"
            className="flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ width: "23px", height: "23px", color: "#2563eb", background: "rgba(37,99,235,0.10)", border: "1px solid rgba(37,99,235,0.20)" }}
          >
            <CircleHelp size={14} />
          </button>
          <div
            id="dimension-planning-help"
            role="tooltip"
            className="pointer-events-none absolute right-0 top-7 z-50 w-64 rounded-xl border p-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all"
            style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", boxShadow: "0 12px 28px rgba(0,0,0,0.22)" }}
          >
            <strong className="block" style={{ fontSize: "12px", color: "var(--text-main)" }}>Room planning envelope</strong>
            <p className="mt-1" style={{ fontSize: "11px", lineHeight: 1.5, color: "var(--text-sub)" }}>
              Dimensions limit the seat layout using at least {CINEMA_PLANNING_LIMITS.areaPerPersonSqm.toFixed(2)} m² and {CINEMA_PLANNING_LIMITS.volumePerPersonCbm.toFixed(1)} m³ per person,
              {` ${CINEMA_PLANNING_LIMITS.rowPitchM.toFixed(2)} m`} row pitch and {CINEMA_PLANNING_LIMITS.seatWidthM.toFixed(2)} m seat width.
            </p>
            <p className="mt-2" style={{ fontSize: "10.5px", lineHeight: 1.45, color: "var(--text-sub)" }}>
              The live capacity indicator is shown beside Seat Grid and above the seat map. Final capacity still requires architectural and fire-safety approval.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
        {([
          ["lengthM", "Length"],
          ["widthM", "Width"],
          ["clearHeightM", "Clear height"],
        ] as const).map(([field, label]) => (
          <div key={field} className="min-w-0">
            <span className="flex items-end h-5 truncate" title={`${label} (m)`} style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>{label}</span>
            <div className="relative mt-1">
              <input
                type="number" min={0.1} step={0.1}
                value={value[field]}
                disabled={disabled}
                aria-label={`${label} in meters`}
                onChange={(event) => set({ [field]: event.target.value } as Partial<RoomInfoForm>)}
                className="w-full h-10 pl-3 pr-7 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={inputStyle}
              />
              <span className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={{ right: "10px", fontSize: "10px", color: "var(--text-sub)" }}>m</span>
            </div>
            {getFieldError(issues, field) && (
              <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{getFieldError(issues, field)}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>Floor area</span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
          {areaSqm != null ? `${areaSqm.toFixed(1)} m²` : "—"}
        </span>
      </div>
    </div>
  );
}
