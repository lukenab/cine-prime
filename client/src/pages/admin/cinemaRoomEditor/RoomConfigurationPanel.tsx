export type ConfigurationSectionKey = "basic" | "dimensions" | "projection" | "audio" | "grid" | "distribution";

type Props = Record<ConfigurationSectionKey, React.ReactNode> & {
  quickStart?: React.ReactNode;
};

function Subsection({ label, children, divided }: {
  label: string;
  children: React.ReactNode;
  divided?: boolean;
}) {
  return (
    <section className={`relative ${divided ? "pt-3" : ""}`} style={divided ? { borderTop: "1px solid var(--border-color)" } : undefined}>
      <h3 className="mb-2.5" style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.035em" }}>
        {label}
      </h3>
      {children}
    </section>
  );
}

/** Required state is communicated at the field itself after validation. The
 * panel intentionally avoids duplicated section counters and completion badges. */
export function RoomConfigurationPanel({ basic, dimensions, projection, audio, grid, distribution, quickStart }: Props) {
  return (
    <div className="space-y-3">
      {quickStart}

      <div className="rounded-xl border p-3.5 space-y-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
        <h2 style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.035em" }}>Room specifications</h2>
        {basic}
        <Subsection label="Physical dimensions" divided>{dimensions}</Subsection>
        <Subsection label="Projection" divided>{projection}</Subsection>
        <Subsection label="Audio" divided>{audio}</Subsection>
      </div>

      <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
        <Subsection label="Seat grid">{grid}</Subsection>
      </div>

      <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
        <Subsection label="Layout generation">{distribution}</Subsection>
      </div>
    </div>
  );
}
