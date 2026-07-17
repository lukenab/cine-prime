import type { SeatTypeValue } from "../../../api/movieApi";
import { SEAT_TYPE_COLORS, SEAT_TYPE_LABELS } from "./cinemaRoomLayoutGenerator";

function ProjectorLegendMarker() {
  return (
    <span className="relative block h-[17px] w-[28px] shrink-0" aria-hidden="true">
      <span
        className="absolute inset-x-[2px] bottom-[1px] h-[10px] rounded-[3px]"
        style={{ background: "linear-gradient(180deg, #93c5fd, #2563eb)", boxShadow: "0 1px 2px rgba(15,23,42,0.28), 0 0 4px rgba(37,99,235,0.28)" }}
      />
      <span
        className="absolute left-1/2 top-0 h-[9px] w-[9px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle at 38% 32%, #fff, #93c5fd 42%, #2563eb 82%)", boxShadow: "0 0 0 1px rgba(255,255,255,0.5)" }}
      />
    </span>
  );
}

function SpeakerLegendMarker() {
  return (
    <span
      className="block h-[20px] w-[9px] shrink-0 rounded-[3px]"
      aria-hidden="true"
      style={{ background: "radial-gradient(circle at 50% 50%, rgba(15,23,42,0.62) 0 2px, transparent 2.5px), linear-gradient(90deg, #5eead4, #0d9488)", boxShadow: "0 1px 2px rgba(15,23,42,0.28), 0 0 4px rgba(13,148,136,0.28)" }}
    />
  );
}

function LegendSwatches() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {(Object.entries(SEAT_TYPE_COLORS) as [SeatTypeValue, typeof SEAT_TYPE_COLORS[SeatTypeValue]][]).map(([type, c]) => (
        <div key={type} className="flex items-center gap-1.5">
          <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: c.bg, border: `1.5px solid ${c.border}` }} />
          <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{SEAT_TYPE_LABELS[type]}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: "rgba(5,150,105,0.14)", border: "1.5px solid rgba(5,150,105,0.4)" }} />
        <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>Exit</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: "rgba(128,128,128,0.08)", border: "1.5px solid rgba(128,128,128,0.25)" }} />
        <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>Empty space</span>
      </div>
    </div>
  );
}

/** Seat meaning must remain visible while editing and reviewing; hiding it in
 * details adds a needless interaction and makes screenshots harder to read. */
export function SeatLegend({ readOnly: _readOnly, showProjector, showSpeakers }: { readOnly?: boolean; showProjector?: boolean; showSpeakers?: boolean }) {
  return (
    <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
      {(showProjector || showSpeakers) && (
        <div
          className="mb-3 inline-flex flex-wrap items-center gap-4 rounded-lg border px-2.5 py-1.5"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
          aria-label="Room equipment"
        >
          {showProjector && (
            <div className="flex items-center gap-1.5">
              <ProjectorLegendMarker />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-main)" }}>Projector</span>
            </div>
          )}
          {showSpeakers && (
            <div className="flex items-center gap-1.5">
              <SpeakerLegendMarker />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-main)" }}>Speaker</span>
            </div>
          )}
        </div>
      )}
      <LegendSwatches />
    </div>
  );
}
