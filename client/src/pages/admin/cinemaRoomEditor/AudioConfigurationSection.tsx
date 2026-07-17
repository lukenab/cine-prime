import type { CinemaRoomMasterData } from "../../../api/movieApi";
import { SelectField } from "../../../components/shared/SelectField";
import type { TechConfigForm } from "./cinemaRoomEditor.types";
import { getFieldError, type ValidationIssue } from "./cinemaRoomValidation";

type Props = {
  masterData: CinemaRoomMasterData;
  value: TechConfigForm;
  onChange: (next: TechConfigForm) => void;
  issues: ValidationIssue[];
  disabled?: boolean;
};

export function AudioConfigurationSection({ masterData, value, onChange, issues, disabled }: Props) {
  const set = (patch: Partial<TechConfigForm>) => onChange({ ...value, ...patch });

  return (
    <SelectField
      label="Audio Format"
      required
      value={value.audioFormatId}
      onChange={(id) => set({ audioFormatId: id })}
      options={masterData.audioFormats}
      disabled={disabled}
      error={getFieldError(issues, "audioFormatId")}
    />
  );
}
