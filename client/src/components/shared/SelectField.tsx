import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Info } from "lucide-react";

type Option<T extends string | number> = { id: T; name: string; description?: string };

type Props<T extends string | number> = {
  label: string;
  required?: boolean;
  value: T | null;
  onChange: (value: T | null) => void;
  options: Option<T>[];
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  descriptionDisplay?: "caption" | "tooltip" | "none";
  helpText?: string;
  onFocus?: () => void;
};

export function InfoTooltip({ label, text }: { label: string; text: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tooltipWidth = 260;
    const gap = 8;
    const opensRight = rect.right + gap + tooltipWidth <= window.innerWidth - 12;
    setPosition({
      left: opensRight ? rect.right + gap : Math.max(12, rect.left - tooltipWidth - gap),
      top: Math.max(8, Math.min(rect.top - 4, window.innerHeight - 120)),
    });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : show())}
        className="flex flex-shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-blue-500/15 focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ width: "17px", height: "17px", color: "#2563eb", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.16)" }}
      >
        <Info size={11} />
      </button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[100] w-[260px] rounded-lg px-3 py-2 text-left font-normal text-white shadow-xl"
          style={{ left: position.left, top: position.top, background: "#1e3a5f", fontSize: "11px", lineHeight: 1.45 }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}

/** Master-data-driven dropdown with an optional caption or on-demand tooltip. */
export function SelectField<T extends string | number>({
  label, required, value, onChange, options, disabled, error, placeholder = "Select an option",
  descriptionDisplay = "caption", helpText, onFocus,
}: Props<T>) {
  const selected = options.find((o) => o.id === value);
  const tooltipText = selected?.description ?? helpText;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 min-h-5">
        <label style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-sub)", lineHeight: 1.3 }}>
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {descriptionDisplay === "tooltip" && tooltipText && (
          <InfoTooltip label={label} text={tooltipText} />
        )}
      </div>
      <div className="relative group">
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => {
            const selectedOption = options.find((option) => String(option.id) === e.target.value);
            onChange(selectedOption?.id ?? null);
          }}
          aria-label={label}
          className="cinema-select w-full h-10 pl-3 pr-10 rounded-lg border outline-none transition-all appearance-none disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500/15"
          style={{
            fontSize: "12.5px", fontWeight: 600,
            background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)", color: "var(--text-main)",
            borderColor: error ? "#ef4444" : "var(--border-color)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#60a5fa";
            onFocus?.();
          }}
          onBlur={(e) => (e.currentTarget.style.borderColor = error ? "#ef4444" : "var(--border-color)")}
        >
          <option value="" style={{ background: "var(--bg-card)", color: "var(--text-sub)" }}>{placeholder}</option>
          {options.map((o) => <option key={o.id} value={o.id} style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>{o.name}</option>)}
        </select>
        <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-lg"
          style={{ right: "6px", width: "28px", height: "28px", background: "rgba(128,128,128,0.08)", color: "var(--text-sub)" }}>
          <ChevronDown size={14} />
        </span>
      </div>
      {descriptionDisplay === "caption" && selected?.description && (
        <p className="flex items-start gap-1.5 mt-1.5" style={{ fontSize: "11px", color: "var(--text-sub)", lineHeight: 1.4 }}>
          <Info size={12} style={{ marginTop: "1.5px", flexShrink: 0 }} />
          <span>{selected.description}</span>
        </p>
      )}
      {error && <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{error}</p>}
    </div>
  );
}
