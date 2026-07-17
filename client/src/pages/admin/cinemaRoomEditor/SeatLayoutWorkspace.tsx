import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { LayoutPosition } from "../../../api/movieApi";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import type { AuditoriumVisualizationConfig, GridConfigForm } from "./cinemaRoomEditor.types";
import type { ValidationIssue } from "./cinemaRoomValidation";
import type { RoomCapacityEnvelope } from "./cinemaRoomCapacity";
import { computeLayoutStats, expandToWholeCoupleGroups, generateInitialGrid, parseRowLabelIndex, renumberLayout, type RowPatternCell } from "./cinemaRoomLayoutGenerator";
import { SeatGrid } from "./SeatGrid";
import { SeatLayoutToolbar } from "./SeatLayoutToolbar";
import { SeatLegend } from "./SeatLegend";
import { SelectionInspector } from "./SelectionInspector";
import { AudioCoverageFrame, ProjectionBeamOverlay, ProjectionScreenVisualization } from "./AuditoriumVisualization";

const HIGHLIGHT_DURATION_MS = 2500;

type Props = {
  positions: LayoutPosition[];
  onChange: (next: LayoutPosition[]) => void;
  gridConfig: GridConfigForm;
  onError: (message: string) => void;
  /** Position-scoped validation issues only (the page filters the full set
   *  down to the ones relevant to the layout itself, e.g. not room-info
   *  fields) — drives the toolbar's issues badge and its expandable panel. */
  layoutIssues: ValidationIssue[];
  capacityEnvelope?: RoomCapacityEnvelope;
  visualizationConfig?: AuditoriumVisualizationConfig;
  readOnly?: boolean;
  previewMode?: boolean;
};

/** Right-column shell: seat overview and history actions → screen bar → seat
 *  grid with a contextual Selection Inspector → legend. Owns undo/redo for
 *  selection-driven edits; Generate/Clear also push onto it, so a slip is one
 *  Undo away) — resize (steppers) and template-apply changes arrive here as
 *  an already-new `positions` prop and simply reset the stack, since those
 *  two are protected by their own confirmation dialogs instead. Also owns
 *  the lifted selection (so the Inspector can read/act on it), the active
 *  copied-row clipboard and validation panel. */
export function SeatLayoutWorkspace({ positions, onChange, gridConfig, onError, layoutIssues, capacityEnvelope, visualizationConfig, readOnly, previewMode }: Props) {
  const [history, setHistory] = useState<LayoutPosition[][]>([positions]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const [selected, setSelectedRaw] = useState<Set<string>>(new Set());
  const [copiedRowPattern, setCopiedRowPattern] = useState<RowPatternCell[] | null>(null);
  const [validationPanelOpen, setValidationPanelOpen] = useState(false);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Never leave a Couple group half-selected — any selection change is
  // expanded to include a group's other half before it's stored anywhere.
  const setSelected = (next: Set<string>) => setSelectedRaw(expandToWholeCoupleGroups(positions, next));

  useEffect(() => {
    if (selected.size === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedRaw(new Set());
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected.size]);

  useEffect(() => {
    // An externally-driven positions change (resize steppers, template apply,
    // a freshly-hydrated draft) — reset the undo stack to start fresh from it
    // rather than let Undo rewind past a change this component didn't record.
    if (positions !== history[historyIndex]) {
      setHistory([positions]);
      setHistoryIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  useEffect(() => () => { if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current); }, []);

  const commit = (next: LayoutPosition[]) => {
    const numbered = renumberLayout(next, gridConfig.numberingPolicy, gridConfig.numberingDirection);
    const truncated = history.slice(0, historyIndex + 1);
    const newHistory = [...truncated, numbered];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onChange(numbered);
  };

  const undo = () => {
    if (historyIndex === 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    onChange(history[idx]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    onChange(history[idx]);
  };

  const handleGenerate = () => {
    const firstRowLabelIndex = parseRowLabelIndex(gridConfig.firstRowLabel);
    const grid = generateInitialGrid(gridConfig.numberOfRows, gridConfig.maxPositionsPerRow, firstRowLabelIndex, gridConfig.numberingDirection);
    setSelectedRaw(new Set());
    commit(grid);
  };

  const handleClearConfirmed = () => {
    setSelectedRaw(new Set());
    commit([]);
    setShowClearConfirm(false);
  };

  const handlePanStart = (e: React.MouseEvent) => {
    if (readOnly) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    panState.current = { startX: e.clientX, startY: e.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop };
    setIsPanning(true);
  };
  const handlePanMove = (e: React.MouseEvent) => {
    const viewport = viewportRef.current;
    if (!viewport || !panState.current) return;
    viewport.scrollLeft = panState.current.scrollLeft - (e.clientX - panState.current.startX);
    viewport.scrollTop = panState.current.scrollTop - (e.clientY - panState.current.startY);
  };
  const handlePanEnd = () => { panState.current = null; setIsPanning(false); };

  const jumpToIssue = (issue: ValidationIssue) => {
    const keys = issue.positionKeys ?? [];
    if (keys.length === 0) return;
    setHighlightedKeys(new Set(keys));
    const el = viewportRef.current?.querySelector(`[data-position-key="${keys[0]}"], [data-position-keys~="${keys[0]}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedKeys(new Set()), HIGHLIGHT_DURATION_MS);
  };

  const stats = computeLayoutStats(positions);
  const errorIssues = layoutIssues.filter((i) => i.severity === "error");
  const warningIssues = layoutIssues.filter((i) => i.severity === "warning");
  const seatCanvas = positions.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl w-full" style={{ border: "1px dashed var(--border-color)" }}>
      <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
        {readOnly ? "This layout has no positions yet." : 'Use Layout Assistant or choose "Reset grid" above to begin.'}
      </p>
    </div>
  ) : (
    <div
      ref={viewportRef}
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
      className="w-full min-w-0"
      style={{ overflow: "auto", maxHeight: "70vh", cursor: isPanning ? "grabbing" : "grab", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "16px" }}
    >
      <div style={{ width: "fit-content", margin: "0 auto" }}>
        <SeatGrid
          positions={positions}
          mode="SELECT"
          selected={selected}
          onSelectionChange={setSelected}
          onCommit={commit}
          onError={onError}
          readOnly={readOnly}
          highlightedKeys={highlightedKeys}
        />
      </div>
    </div>
  );

  return (
    <div>
      <SeatLayoutToolbar
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        onGenerate={handleGenerate}
        onClear={() => setShowClearConfirm(true)}
        stats={stats}
        capacityEnvelope={capacityEnvelope}
        issueCount={layoutIssues.length}
        validationPanelOpen={validationPanelOpen}
        onToggleValidationPanel={() => setValidationPanelOpen((v) => !v)}
        readOnly={readOnly}
      />

      {previewMode && (
        <div className="rounded-xl px-3 py-2.5 mb-3" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.28)" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>Layout preview</p>
          <p style={{ fontSize: "10.5px", color: "var(--text-sub)", marginTop: "2px" }}>Review the generated seat map, then choose Apply Layout or Discard in Auto-generate Layout.</p>
        </div>
      )}

      {validationPanelOpen && (
        <div className="rounded-xl p-4 mb-3" style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-sub)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "8px" }}>
            Layout Validation
          </p>
          {layoutIssues.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#059669" }}>No layout issues found.</p>
          ) : (
            <ul className="space-y-1.5">
              {[...errorIssues, ...warningIssues].map((issue, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => jumpToIssue(issue)}
                    disabled={!issue.positionKeys?.length}
                    className="flex items-start gap-2 text-left hover:opacity-80 disabled:cursor-default w-full"
                    style={{ color: issue.severity === "error" ? "#ef4444" : "#d97706" }}
                  >
                    <AlertTriangle size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                    <span style={{ fontSize: "13px" }}>{issue.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Screen indicator — capped so it stays proportional to a typical seat
          grid's width instead of always stretching to 70% of the whole card.
          The relative wrapper also hosts the projection booth overlay: bottom
          padding reserves the strip where the projector sits behind the last row. */}
      <div
        className={`relative${
          visualizationConfig?.projectionTechnologyCode === "LASER" || visualizationConfig?.projectionTechnologyCode === "XENON" ? " pb-7" : ""
        }`}
      >
        {visualizationConfig && <ProjectionScreenVisualization config={visualizationConfig} />}
        {visualizationConfig && <ProjectionBeamOverlay technologyCode={visualizationConfig.projectionTechnologyCode} />}

        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 w-full">
            {visualizationConfig
              ? <AudioCoverageFrame config={visualizationConfig}>{seatCanvas}</AudioCoverageFrame>
              : seatCanvas}
          </div>

          {/* Only reserved once there's something to inspect — in the common
              no-selection case (the default view) the grid gets the full width
              instead of always losing ~260px to an empty "no selection" panel. */}
          {!readOnly && selected.size > 0 && (
            <div className="w-full lg:w-[260px] lg:flex-shrink-0">
              <SelectionInspector
                positions={positions}
                selected={selected}
                onCommit={commit}
                onClearSelection={() => setSelectedRaw(new Set())}
                copiedRowPattern={copiedRowPattern}
                onCopyRow={setCopiedRowPattern}
                onNotice={onError}
                disabled={readOnly}
              />
            </div>
          )}
        </div>
      </div>

      <SeatLegend
        readOnly={readOnly}
        showProjector={visualizationConfig?.projectionTechnologyCode === "LASER" || visualizationConfig?.projectionTechnologyCode === "XENON"}
        showSpeakers={Boolean(visualizationConfig?.audioFormatCode)}
      />

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear Layout?"
          body="This removes every seat, aisle, and exit position from the grid. You can still Undo right after, but the change isn't saved until you undo it explicitly."
          confirmLabel="Clear Layout"
          danger
          onConfirm={handleClearConfirmed}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
