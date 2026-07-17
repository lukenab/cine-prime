import type { ReactNode } from "react";
import type { AuditoriumVisualizationConfig } from "./cinemaRoomEditor.types";

const SYSTEM_LABELS = {
  STANDARD: "Standard",
  IMAX: "IMAX",
  DOLBY_CINEMA: "Dolby Cinema",
  SCREENX: "ScreenX",
} as const;

type ScreenTone = { core: string; soft: string; glow: string };

/** The screen is lit by the projection light, so its color follows the selected technology. */
const SCREEN_TECH_TONES: Record<string, ScreenTone> = {
  LASER: { core: "#2563eb", soft: "rgba(59,130,246,0.55)", glow: "rgba(37,99,235,0.24)" },
  XENON: { core: "#64748b", soft: "rgba(148,163,184,0.55)", glow: "rgba(100,116,139,0.24)" },
  DIRECT_VIEW_LED: { core: "#0891b2", soft: "rgba(34,211,238,0.55)", glow: "rgba(8,145,178,0.26)" },
};
const DEFAULT_SCREEN_TONE = SCREEN_TECH_TONES.LASER;

function ScreenSurface({ tone }: { tone: ScreenTone }) {
  return (
    <div
      style={{
        height: "7px",
        minWidth: 0,
        borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
        background: `linear-gradient(to right, transparent 0%, ${tone.soft} 14%, ${tone.core} 50%, ${tone.soft} 86%, transparent 100%)`,
        boxShadow: `0 2px 10px ${tone.glow}`,
      }}
    />
  );
}

/**
 * Projection booth behind the audience: a small projector at the rear plus a light throw
 * running up to the screen. The throw is a short demo — it plays for ~4s when a projector
 * technology is picked (keyed on the code so re-picking replays it), then switches off,
 * leaving only the projector visible. Direct-view LED is self-emissive, so it renders nothing.
 */
export function ProjectionBeamOverlay({ technologyCode }: { technologyCode?: string }) {
  const laser = technologyCode === "LASER";
  const xenon = technologyCode === "XENON";
  if (!laser && !xenon) return null;

  const haze = laser ? "rgba(59,130,246,0.10)" : "rgba(148,163,184,0.12)";
  const hazeEdge = laser ? "rgba(34,211,238,0.03)" : "rgba(203,213,225,0.04)";
  const pulse = laser ? "rgba(147,197,253,0.3)" : "rgba(203,213,225,0.35)";
  const lensGlow = laser ? "rgba(96,165,250,0.85)" : "rgba(226,232,240,0.9)";
  const bodyLight = laser ? "#93c5fd" : "#cbd5e1";
  const bodyCore = laser ? "#2563eb" : "#64748b";
  const bodyGlow = laser ? "rgba(37,99,235,0.3)" : "rgba(100,116,139,0.3)";

  return (
    <div
      data-projection-beam={laser ? "LASER" : "XENON"}
      data-equipment="projector"
      role="img"
      aria-label={`${laser ? "Laser" : "Xenon"} projector behind the audience`}
      className="pointer-events-none absolute inset-0 flex flex-col"
    >
      <style>{`
        @keyframes projection-demo {
          0% { opacity: 0; }
          8% { opacity: 1; }
          78% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes projection-throw {
          from { transform: translateY(1250%); opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          to { transform: translateY(-100%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-projection-beam] * { animation-duration: 0.01s !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
      <div key={`throw-${technologyCode}`} className="relative w-full min-h-0" style={{ flex: 1, animation: "projection-demo 4s ease forwards" }}>
        <div
          className="relative mx-auto h-full"
          style={{
            width: "86%",
            maxWidth: "720px",
            clipPath: "polygon(0 0, 100% 0, 52% 100%, 48% 100%)",
            background: `linear-gradient(180deg, ${haze} 0%, ${hazeEdge} 70%, transparent 96%)`,
            filter: xenon ? "blur(1.2px)" : undefined,
          }}
        >
          <span
            className="absolute inset-x-0 top-0"
            style={{
              height: "8%",
              background: `linear-gradient(180deg, transparent, ${pulse}, transparent)`,
              animation: "projection-throw 1.9s linear 2",
            }}
          />
        </div>
      </div>
      <div
        className="relative mx-auto shrink-0"
        title={laser ? "Laser projector in the booth behind the audience" : "Xenon projector in the booth behind the audience"}
        style={{ width: "36px", height: "18px" }}
      >
        <span
          key={`lens-glow-${technologyCode}`}
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: "-4px",
            width: "17px",
            height: "17px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${lensGlow} 0%, transparent 65%)`,
            filter: "blur(1px)",
            animation: "projection-demo 4s ease forwards",
          }}
        />
        <span
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "12px",
            borderRadius: "3px",
            background: `linear-gradient(180deg, ${bodyLight}, ${bodyCore})`,
            boxShadow: `0 1px 2px rgba(15,23,42,0.28), 0 0 4px ${bodyGlow}`,
          }}
        />
        <span
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: "0",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 38% 32%, #ffffff, ${bodyLight} 40%, ${bodyCore} 80%)`,
            boxShadow: `0 0 0 2px rgba(255,255,255,0.4), 0 0 5px ${bodyGlow}`,
          }}
        />
      </div>
    </div>
  );
}

export function ProjectionScreenVisualization({ config }: { config: AuditoriumVisualizationConfig }) {
  const screenX = config.presentationSystem === "SCREENX";
  const directView = config.projectionTechnologyCode === "DIRECT_VIEW_LED";
  const systemLabel = SYSTEM_LABELS[config.presentationSystem];
  const techCode = config.projectionTechnologyCode;
  const tone = (techCode && SCREEN_TECH_TONES[techCode]) || DEFAULT_SCREEN_TONE;
  const techTitle = directView
    ? "Self-emissive direct-view LED screen"
    : techCode === "XENON"
      ? "Screen lit by the xenon lamp in the booth behind the audience"
      : techCode === "LASER"
        ? "Screen lit by the laser projector in the booth behind the audience"
        : undefined;

  return (
    <section
      className="mb-3"
      aria-label={`${systemLabel} screen visualization`}
      data-screen-surface-count={screenX ? 3 : 1}
      data-display-mode={directView ? "DIRECT_VIEW" : "PROJECTED"}
    >
      <div
        className="mx-auto"
        data-projection-effect={techCode && SCREEN_TECH_TONES[techCode] ? techCode : undefined}
        title={techTitle}
        style={{ width: screenX ? "98%" : "86%", maxWidth: screenX ? "920px" : "720px" }}
      >
        {screenX ? (
          <div className="grid items-end gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <ScreenSurface tone={tone} />
            <ScreenSurface tone={tone} />
            <ScreenSurface tone={tone} />
          </div>
        ) : (
          <ScreenSurface tone={tone} />
        )}
        {directView && (
          <div className="h-4" style={{ background: `radial-gradient(ellipse at 50% 0%, ${tone.glow}, transparent 72%)` }} />
        )}
      </div>
      <div className="mt-2 text-center">
        <strong style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-sub)" }}>
          {systemLabel}
        </strong>
      </div>
    </section>
  );
}

type SpeakerKind = "screen" | "surround" | "ceiling";
type FireDirection = "up" | "down" | "left" | "right";
type SpeakerTone = { light: string; core: string; wave: string; glow: string };

const SPEAKER_TONES: Record<SpeakerKind, SpeakerTone> = {
  screen: { light: "#93c5fd", core: "#2563eb", wave: "rgba(59,130,246,0.5)", glow: "rgba(37,99,235,0.3)" },
  surround: { light: "#5eead4", core: "#0d9488", wave: "rgba(45,212,191,0.5)", glow: "rgba(13,148,136,0.28)" },
  ceiling: { light: "#c4b5fd", core: "#7c3aed", wave: "rgba(167,139,250,0.55)", glow: "rgba(124,58,237,0.3)" },
};

/** [length, thickness] of the cabinet bar and the sound fan, per speaker role, so the three zones stay visually proportioned. */
const MARKER_SIZES: Record<SpeakerKind, { body: [number, number]; wave: [number, number] }> = {
  screen: { body: [26, 9], wave: [32, 16] },
  surround: { body: [22, 8], wave: [28, 14] },
  ceiling: { body: [20, 7], wave: [24, 12] },
};

/** Crisp speaker cabinet: rounded bar with a top-lit gradient and a small dark driver dot in the middle. */
function SpeakerBody({ tone, horizontal, size }: { tone: SpeakerTone; horizontal: boolean; size: [number, number] }) {
  const [long, short] = size;
  return (
    <span
      data-equipment="speaker"
      className="block shrink-0"
      style={{
        width: horizontal ? `${long}px` : `${short}px`,
        height: horizontal ? `${short}px` : `${long}px`,
        borderRadius: "3px",
        background: `radial-gradient(circle at 50% 50%, rgba(15,23,42,0.5) 0 2.2px, transparent 2.7px), linear-gradient(${horizontal ? "180deg" : "90deg"}, ${tone.light}, ${tone.core})`,
        boxShadow: `0 1px 2px rgba(15,23,42,0.28), 0 0 4px ${tone.glow}`,
      }}
    />
  );
}

/** Soft, fading fan of sound spreading out in the direction the speaker fires. */
function SpeakerWave({ tone, direction, size }: { tone: SpeakerTone; direction: FireDirection; size: [number, number] }) {
  const [long, short] = size;
  const sideways = direction === "left" || direction === "right";
  const gradient =
    direction === "down"
      ? "ellipse 60% 105% at 50% 0%"
      : direction === "up"
        ? "ellipse 60% 105% at 50% 100%"
        : direction === "right"
          ? "ellipse 105% 60% at 0% 50%"
          : "ellipse 105% 60% at 100% 50%";
  const fan =
    direction === "down"
      ? "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)"
      : direction === "up"
        ? "polygon(0% 0%, 100% 0%, 70% 100%, 30% 100%)"
        : direction === "right"
          ? "polygon(0% 30%, 100% 0%, 100% 100%, 0% 70%)"
          : "polygon(0% 0%, 100% 30%, 100% 70%, 0% 100%)";

  return (
    <span
      className="block shrink-0"
      style={{
        width: sideways ? `${short}px` : `${long}px`,
        height: sideways ? `${long}px` : `${short}px`,
        background: `radial-gradient(${gradient}, ${tone.wave} 0%, transparent 78%)`,
        clipPath: fan,
        filter: "blur(0.6px)",
      }}
    />
  );
}

function SpeakerMarker({ kind, direction }: { kind: SpeakerKind; direction: FireDirection }) {
  const tone = SPEAKER_TONES[kind];
  const sizes = MARKER_SIZES[kind];
  const flow =
    direction === "down" ? "flex-col" : direction === "up" ? "flex-col-reverse" : direction === "right" ? "flex-row" : "flex-row-reverse";
  return (
    <span className={`flex ${flow} items-center`} style={{ gap: "1px" }}>
      <SpeakerBody tone={tone} horizontal={direction === "up" || direction === "down"} size={sizes.body} />
      <SpeakerWave tone={tone} direction={direction} size={sizes.wave} />
    </span>
  );
}

function SpeakerRow({ kind, count, direction }: { kind: SpeakerKind; count: number; direction: FireDirection }) {
  const stacked = direction === "left" || direction === "right";
  return (
    <div className={`flex ${stacked ? "flex-col gap-2" : "flex-row gap-3"} items-center justify-center`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <SpeakerMarker key={index} kind={kind} direction={direction} />
      ))}
    </div>
  );
}

export function AudioCoverageFrame({ config, children }: { config: AuditoriumVisualizationConfig; children: ReactNode }) {
  const code = config.audioFormatCode ?? "";
  if (!code) return <>{children}</>;
  const atmos = code.includes("ATMOS");
  const sevenOne = atmos || code.includes("7_1") || code.includes("7.1");
  const sideCount = atmos ? 4 : sevenOne ? 3 : 2;
  const audioLabel = config.audioFormatName ?? (code.replaceAll("_", " ") || "Audio system");

  return (
    <section aria-label={`${audioLabel} conceptual speaker coverage`}>
      <div className="flex items-center justify-center mb-2" title="Front left, center and right screen-channel zones">
        <SpeakerRow kind="screen" count={3} direction="down" />
      </div>
      {atmos && (
        <div className="flex items-center justify-center mb-2" title="Conceptual overhead speaker layer">
          <SpeakerRow kind="ceiling" count={5} direction="down" />
        </div>
      )}
      <div className="grid items-stretch gap-2" style={{ gridTemplateColumns: "26px minmax(0, 1fr) 26px" }}>
        <div className="flex flex-col items-center justify-center gap-2" title="Left surround zone"><SpeakerRow kind="surround" count={sideCount} direction="right" /></div>
        <div className="min-w-0">{children}</div>
        <div className="flex flex-col items-center justify-center gap-2" title="Right surround zone"><SpeakerRow kind="surround" count={sideCount} direction="left" /></div>
      </div>
      {sevenOne && (
        <div className="flex items-center justify-center mt-2" title="Rear surround zone">
          <SpeakerRow kind="surround" count={atmos ? 4 : 2} direction="up" />
        </div>
      )}
    </section>
  );
}
