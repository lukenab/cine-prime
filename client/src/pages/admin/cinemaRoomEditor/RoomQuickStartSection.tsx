import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import type { RoomConfigurationTemplate } from "../../../api/movieApi";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";

type Props = {
  templates: RoomConfigurationTemplate[];
  hasExistingWork: boolean;
  onApply: (template: RoomConfigurationTemplate) => void;
  disabled?: boolean;
};

export function RoomQuickStartSection({ templates, hasExistingWork, onApply, disabled }: Props) {
  const defaultTemplate = templates.find((template) => template.code === "STANDARD_DIGITAL") ?? templates[0];
  const [selectedId, setSelectedId] = useState(() => defaultTemplate ? String(defaultTemplate.id) : "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selected = templates.find((template) => template.id === Number(selectedId));

  useEffect(() => {
    if (!selectedId && defaultTemplate) setSelectedId(String(defaultTemplate.id));
  }, [defaultTemplate, selectedId]);

  const apply = () => {
    if (!selected) return;
    onApply(selected);
    setConfirmOpen(false);
  };

  if (templates.length === 0) return null;

  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: "rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.06)" }}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p style={{ fontSize: "12.5px", fontWeight: 750, color: "var(--text-main)" }}>Quick start template</p>
        <div className="relative group">
          <button
            type="button"
            aria-label="About the selected room template"
            aria-describedby="room-template-help"
            className="flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ width: "24px", height: "24px", color: "#2563eb", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.22)" }}
          >
            <CircleHelp size={15} />
          </button>
          <div
            id="room-template-help"
            role="tooltip"
            className="pointer-events-none absolute right-0 top-7 z-50 w-64 rounded-xl border p-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all"
            style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", boxShadow: "0 12px 28px rgba(0,0,0,0.22)" }}
          >
            <strong className="block" style={{ fontSize: "12px", color: "var(--text-main)" }}>
              {selected?.name ?? "Quick start templates"}
            </strong>
            <p className="mt-1" style={{ fontSize: "11px", lineHeight: 1.5, color: "var(--text-sub)" }}>
              {selected?.description ?? "Choose a template to fill technical defaults and generate a starting seat layout."}
            </p>
            {selected && (
              <p className="mt-2" style={{ fontSize: "11px", lineHeight: 1.45, color: "var(--text-main)", fontWeight: 600 }}>
                {selected.numberOfRows} rows × {selected.maxPositionsPerRow} positions · {selected.layoutTemplateCode.replaceAll("_", " ")}
              </p>
            )}
            <p className="mt-2" style={{ fontSize: "10.5px", lineHeight: 1.45, color: "var(--text-sub)" }}>
              Room identity, physical dimensions and screen measurements are preserved.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5">
        <select
          value={selectedId}
          disabled={disabled}
          onChange={(event) => setSelectedId(event.target.value)}
          aria-label="Room configuration template"
          className="cinema-select min-w-0 flex-1 h-9 px-2.5 rounded-lg border"
          style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-main)", background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <option value="">Choose template…</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <button
          type="button"
          disabled={disabled || !selected}
          onClick={() => hasExistingWork ? setConfirmOpen(true) : apply()}
          className="px-3 h-9 rounded-lg text-white disabled:opacity-40"
          style={{ fontSize: "11.5px", fontWeight: 700, background: "#2563eb" }}
        >
          Apply
        </button>
      </div>

      {confirmOpen && selected && (
        <ConfirmDialog
          title={`Apply ${selected.name}?`}
          confirmLabel="Apply Template"
          body="This replaces the current service tier, projection, resolution, audio, seat grid and local layout. Room Code, Room Name, physical dimensions and screen measurements are not changed."
          onConfirm={apply}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
