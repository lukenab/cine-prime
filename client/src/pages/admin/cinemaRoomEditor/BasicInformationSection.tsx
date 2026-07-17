import type { CinemaRoomMasterData } from "../../../api/movieApi";
import { SelectField } from "../../../components/shared/SelectField";
import type { RoomInfoForm } from "./cinemaRoomEditor.types";
import { getFieldError, type ValidationIssue } from "./cinemaRoomValidation";

type Props = {
  masterData: CinemaRoomMasterData;
  value: RoomInfoForm;
  onChange: (next: RoomInfoForm) => void;
  issues: ValidationIssue[];
  disabled?: boolean;
};

const inputStyle: React.CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 600,
  background: "var(--bg-card)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
};

export function BasicInformationSection({ masterData, value, onChange, issues, disabled }: Props) {
  const set = (patch: Partial<RoomInfoForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="flex items-center mb-1.5 min-h-5" style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-sub)" }}>
            Room Code <span className="text-rose-500">*</span>
          </label>
          <input
            value={value.roomCode}
            disabled={disabled}
            onChange={(e) => set({ roomCode: e.target.value })}
            onBlur={(e) => set({ roomCode: e.target.value.trim().toUpperCase() })}
            placeholder="e.g. R01"
            maxLength={20}
            title="Stable identifier used in scheduling, reporting, and integrations"
            className="w-full h-10 px-3 rounded-lg border outline-none focus:border-blue-400 transition-colors"
            style={inputStyle}
          />
          {getFieldError(issues, "roomCode") && (
            <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{getFieldError(issues, "roomCode")}</p>
          )}
        </div>
        <div>
          <label className="flex items-center mb-1.5 min-h-5" style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-sub)" }}>
            Room Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={value.cinemaRoomName}
            disabled={disabled}
            onChange={(e) => set({ cinemaRoomName: e.target.value })}
            placeholder="e.g. Room 1"
            minLength={2}
            maxLength={100}
            className="w-full h-10 px-3 rounded-lg border outline-none focus:border-blue-400 transition-colors"
            style={inputStyle}
          />
          {getFieldError(issues, "cinemaRoomName") && (
            <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{getFieldError(issues, "cinemaRoomName")}</p>
          )}
        </div>
      </div>

      <SelectField
        label="Service Tier"
        required
        value={value.auditoriumClassId}
        onChange={(id) => set({ auditoriumClassId: id })}
        options={masterData.auditoriumClasses}
        disabled={disabled}
        error={getFieldError(issues, "auditoriumClassId")}
        placeholder="Select service tier"
        descriptionDisplay="tooltip"
        helpText="Defines the commercial service level and guest experience for this auditorium."
      />
    </div>
  );
}
