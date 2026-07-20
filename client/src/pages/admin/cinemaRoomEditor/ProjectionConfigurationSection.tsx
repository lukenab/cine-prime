import type { CinemaRoomMasterData } from "../../../api/movieApi";
import { Check } from "lucide-react";
import { SelectField, InfoTooltip } from "../../../components/shared/SelectField";
import type { TechConfigForm } from "./cinemaRoomEditor.types";
import { getFieldError, getFieldWarning, type ValidationIssue } from "./cinemaRoomValidation";
import type { PresentationSystemValue } from "../../../api/movieApi";

type Props = {
  masterData: CinemaRoomMasterData;
  value: TechConfigForm;
  onChange: (next: TechConfigForm) => void;
  issues: ValidationIssue[];
  roomWidthM?: string;
  roomClearHeightM?: string;
  disabled?: boolean;
};

const inputStyle: React.CSSProperties = {
  fontSize: "14px",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
};

const PRESENTATION_SYSTEM_OPTIONS: Array<{ id: PresentationSystemValue; name: string; description: string }> = [
  { id: "STANDARD", name: "Standard single screen", description: "One front screen. Projection hardware is configured separately below." },
  { id: "IMAX", name: "IMAX", description: "One IMAX screen with an IMAX-certified presentation system." },
  { id: "DOLBY_CINEMA", name: "Dolby Cinema", description: "One front screen with the Dolby Cinema presentation profile." },
  { id: "SCREENX", name: "ScreenX", description: "ScreenX panoramic presentation profile." },
];

function aspectRatioHint(ratio: number): string {
  if (Math.abs(ratio - 1.85) < 0.05) return "≈ 1.85 (Flat)";
  if (Math.abs(ratio - 2.39) < 0.05) return "≈ 2.39 (Scope)";
  return "Doesn't match a standard Flat/Scope ratio — not blocked, just a heads-up.";
}

export function ProjectionConfigurationSection({ masterData, value, onChange, issues, roomWidthM, roomClearHeightM, disabled }: Props) {
  const set = (patch: Partial<TechConfigForm>) => onChange({ ...value, ...patch });
  const togglePresentationFormat = (field: "supports2d" | "supports3d") => {
    const other = field === "supports2d" ? "supports3d" : "supports2d";
    if (value[field] && !value[other]) return;
    set({ [field]: !value[field] });
  };
  const w = Number(value.screenWidthM), h = Number(value.screenHeightM);
  const ratio = w > 0 && h > 0 ? w / h : null;
  const screenError = getFieldError(issues, "screen");
  const screenWarning = getFieldWarning(issues, "screen");
  const presentationFormatError = getFieldError(issues, "presentationFormats");
  const useResolutionQuickSelect = masterData.resolutions.length === 2;
  const roomWidth = Number(roomWidthM);
  const roomClearHeight = Number(roomClearHeightM);
  const canSuggestScreen = roomWidth > 0 && roomClearHeight > 0;
  const suggestedScreen = (aspectRatio: number) => {
    const usableWidth = roomWidth * 0.8;
    const usableHeight = roomClearHeight * 0.8;
    const width = Math.min(usableWidth, usableHeight * aspectRatio);
    return { width: Math.round(width * 10) / 10, height: Math.round((width / aspectRatio) * 10) / 10 };
  };
  const applyScreenSuggestion = (aspectRatio: number) => {
    const suggestion = suggestedScreen(aspectRatio);
    set({ screenWidthM: suggestion.width.toFixed(1), screenHeightM: suggestion.height.toFixed(1) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <SelectField
          label="Presentation System"
          required
          value={value.presentationSystem ?? "STANDARD"}
          onChange={(presentationSystem) => {
            if (!presentationSystem) return;
            set({ presentationSystem });
          }}
          options={PRESENTATION_SYSTEM_OPTIONS.filter((option) =>
            !masterData.presentationSystems?.length || masterData.presentationSystems.includes(option.id))}
          disabled={disabled}
          descriptionDisplay="tooltip"
          helpText="Defines the auditorium presentation format independently from projection hardware."
        />
        <SelectField
          label="Projection Technology"
          required
          value={value.projectionTechnologyId}
          onChange={(id) => set({ projectionTechnologyId: id })}
          options={masterData.projectionTechnologies}
          disabled={disabled}
          error={getFieldError(issues, "projectionTechnologyId")}
          descriptionDisplay="tooltip"
          helpText="Defines how the image is produced: Xenon, Laser, or Direct View LED."
        />
        {useResolutionQuickSelect ? (
          <div>
            <label className="flex items-center mb-1.5 min-h-5" style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-sub)" }}>
              Resolution <span className="text-rose-500">*</span>
            </label>
            <div role="radiogroup" aria-label="Resolution" className="grid grid-cols-2 gap-2">
              {masterData.resolutions.map((resolution) => {
                const active = value.resolutionId === resolution.id;
                return (
                  <button
                    key={resolution.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => set({ resolutionId: resolution.id })}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors disabled:opacity-50"
                    style={{
                      borderColor: active ? "#2563eb" : getFieldError(issues, "resolutionId") ? "#ef4444" : "var(--border-color)",
                      background: active ? "rgba(37,99,235,0.10)" : "var(--bg-card)",
                    }}
                  >
                    <span className="flex items-center justify-center rounded-full flex-shrink-0"
                      style={{ width: "20px", height: "20px", background: active ? "#2563eb" : "transparent", border: `1.5px solid ${active ? "#2563eb" : "var(--border-color)"}`, color: "white" }}>
                      {active && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex items-center gap-1">
                      <strong style={{ fontSize: "12px", color: active ? "#2563eb" : "var(--text-main)" }}>{resolution.name}</strong>
                      {resolution.description && (
                        <span onClick={(e) => e.stopPropagation()}>
                          <InfoTooltip label={resolution.name} text={resolution.description} />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {getFieldError(issues, "resolutionId") && (
              <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{getFieldError(issues, "resolutionId")}</p>
            )}
          </div>
        ) : (
          <SelectField
            label="Resolution"
            required
            value={value.resolutionId}
            onChange={(id) => set({ resolutionId: id })}
            options={masterData.resolutions}
            disabled={disabled}
            error={getFieldError(issues, "resolutionId")}
            descriptionDisplay="tooltip"
          />
        )}
      </div>

      <div>
        <label className="flex items-center mb-1.5 min-h-5" style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-sub)", lineHeight: 1.3 }}>
          Screen Dimensions (meters) <span className="text-rose-500">*</span>
        </label>
        {canSuggestScreen && (
          <div className="rounded-xl border p-2.5 mb-2.5" style={{ borderColor: "rgba(37,99,235,0.22)", background: "rgba(37,99,235,0.05)" }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-main)" }}>Suggested from room dimensions</p>
                <p style={{ fontSize: "9.5px", lineHeight: 1.35, color: "var(--text-sub)" }}>Uses an 80% planning envelope. Confirm against the final architectural design.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {([1.85, 2.39] as const).map((aspectRatio) => {
                const suggestion = suggestedScreen(aspectRatio);
                return (
                  <button key={aspectRatio} type="button" disabled={disabled} onClick={() => applyScreenSuggestion(aspectRatio)}
                    className="rounded-lg border px-2 py-1.5 text-left disabled:opacity-50"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <strong className="block" style={{ fontSize: "10.5px", color: "#2563eb" }}>{aspectRatio === 1.85 ? "Flat 1.85" : "Scope 2.39"}</strong>
                    <span style={{ fontSize: "9.5px", color: "var(--text-sub)" }}>{suggestion.width.toFixed(1)} × {suggestion.height.toFixed(1)} m</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>Width (m)</span>
            <input
              type="number" min={0.1} step={0.1}
              value={value.screenWidthM}
              disabled={disabled}
              onChange={(e) => set({ screenWidthM: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border outline-none focus:border-blue-400 transition-colors mt-1"
              style={inputStyle}
            />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>Height (m)</span>
            <input
              type="number" min={0.1} step={0.1}
              value={value.screenHeightM}
              disabled={disabled}
              onChange={(e) => set({ screenHeightM: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border outline-none focus:border-blue-400 transition-colors mt-1"
              style={inputStyle}
            />
          </div>
        </div>
        {screenError && <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>{screenError}</p>}
        {screenWarning && <p style={{ fontSize: "11px", color: "#d97706", marginTop: "6px" }}>{screenWarning}</p>}
        {ratio && (
          <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5 mt-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>Aspect ratio</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{ratio.toFixed(2)} · {aspectRatioHint(ratio)}</span>
          </div>
        )}
      </div>

      <div>
        <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", marginBottom: "6px" }}>
          Supported presentation formats <span className="text-rose-500">*</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          {([
            { field: "supports2d" as const, label: "2D", description: "Standard playback" },
            { field: "supports3d" as const, label: "3D", description: "Stereoscopic playback" },
          ]).map(({ field, label, description }) => {
            const active = value[field];
            return (
              <button key={field} type="button" aria-pressed={active} disabled={disabled}
                onClick={() => togglePresentationFormat(field)}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border text-left disabled:opacity-45"
                style={{ borderColor: active ? "#2563eb" : "var(--border-color)", background: active ? "rgba(37,99,235,0.10)" : "var(--bg-card)" }}>
                <span className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: "20px", height: "20px", background: active ? "#2563eb" : "transparent", border: `1.5px solid ${active ? "#2563eb" : "var(--border-color)"}`, color: "white" }}>
                  {active && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <strong style={{ display: "block", fontSize: "12px", color: active ? "#2563eb" : "var(--text-main)" }}>{label}</strong>
                  <span style={{ display: "block", fontSize: "9.5px", lineHeight: 1.25, color: "var(--text-sub)" }}>{description}</span>
                </span>
              </button>
            );
          })}
        </div>
        {presentationFormatError && (
          <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>{presentationFormatError}</p>
        )}
      </div>
    </div>
  );
}
