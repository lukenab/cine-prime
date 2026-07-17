import { useState } from "react";
import { Accessibility, Armchair, Check, DoorOpen, Eraser, Heart, Minus, MoreHorizontal, MousePointer2 } from "lucide-react";

export type InteractionMode = "SELECT" | "STANDARD" | "VIP" | "COUPLE" | "ACCESSIBLE" | "AISLE" | "EXIT" | "EMPTY_SPACE";

type ToolDef = { mode: InteractionMode; label: string; icon: React.ElementType; color: string };

const PRIMARY_TOOLS: ToolDef[] = [
  { mode: "STANDARD", label: "Standard", icon: Armchair, color: "#3b82f6" },
  { mode: "VIP", label: "VIP", icon: Armchair, color: "#d97706" },
  { mode: "COUPLE", label: "Couple", icon: Heart, color: "#9333ea" },
  { mode: "AISLE", label: "Aisle", icon: Minus, color: "#64748b" },
];

const SECONDARY_TOOLS: ToolDef[] = [
  { mode: "ACCESSIBLE", label: "Accessible", icon: Accessibility, color: "#0d9488" },
  { mode: "EXIT", label: "Exit", icon: DoorOpen, color: "#059669" },
  { mode: "EMPTY_SPACE", label: "Clear position", icon: Eraser, color: "#6b7280" },
];

const ALL_TOOLS = PRIMARY_TOOLS.concat(SECONDARY_TOOLS);
const SELECT_TOOL: ToolDef = { mode: "SELECT", label: "Select / Edit", icon: MousePointer2, color: "#2563eb" };

type Props = {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  disabled?: boolean;
};

function ToolButton({ tool, active, onClick, disabled }: { tool: ToolDef; active: boolean; onClick: () => void; disabled?: boolean }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border transition-colors disabled:opacity-40"
      style={{
        minHeight: "34px", fontSize: "12px", fontWeight: 650,
        color: active ? "#fff" : tool.color,
        borderColor: active ? tool.color : tool.color + "55",
        background: active ? tool.color : tool.color + "10",
      }}
    >
      <Icon size={13} />
      <span>{tool.label}</span>
      {active && <Check size={12} />}
    </button>
  );
}

/** Compact exception editor. The rule-based Layout Assistant handles the base
 * layout; these controls are intentionally limited to day-to-day corrections. */
export function LayoutToolsPalette({ mode, onModeChange, disabled }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const activeTool = mode === "SELECT" ? SELECT_TOOL : ALL_TOOLS.find((tool) => tool.mode === mode);
  const secondaryActive = SECONDARY_TOOLS.some((tool) => tool.mode === mode);
  const instruction = mode === "SELECT"
    ? "Click a seat or row, then edit the selection in the inspector."
    : mode === "COUPLE"
      ? "Click two adjacent positions in the same row."
      : "Click or drag over positions to apply the active tool.";

  const choose = (next: InteractionMode) => {
    onModeChange(next);
    setMoreOpen(false);
  };

  return (
    <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1" style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Manual adjustments
        </span>

        <ToolButton tool={SELECT_TOOL} active={mode === "SELECT"} onClick={() => choose("SELECT")} disabled={disabled} />
        {PRIMARY_TOOLS.map((tool) => (
          <ToolButton key={tool.mode} tool={tool} active={mode === tool.mode} onClick={() => choose(tool.mode)} disabled={disabled} />
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            disabled={disabled}
            aria-expanded={moreOpen}
            aria-label="More manual tools"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border disabled:opacity-40"
            style={{
              minHeight: "34px", fontSize: "12px", fontWeight: 650,
              color: secondaryActive ? "#fff" : "var(--text-sub)",
              borderColor: secondaryActive ? activeTool?.color : "var(--border-color)",
              background: secondaryActive ? activeTool?.color : "var(--bg-card)",
            }}
          >
            <MoreHorizontal size={14} /> {secondaryActive ? activeTool?.label : "More"}
          </button>

          {moreOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 z-30 min-w-[180px] rounded-xl p-1.5 shadow-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
            >
              {SECONDARY_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.mode}
                    type="button"
                    onClick={() => choose(tool.mode)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ fontSize: "12px", fontWeight: 600, color: tool.color }}
                  >
                    <Icon size={14} /> {tool.label}
                    {mode === tool.mode && <Check size={12} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span className="flex-1 min-w-[220px]" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
          <strong style={{ color: activeTool?.color ?? "var(--text-main)" }}>{activeTool?.label}:</strong> {instruction}
        </span>
      </div>
    </div>
  );
}
