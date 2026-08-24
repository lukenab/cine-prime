import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Building2,
  CalendarCog,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  DoorClosed,
  Film,
  Info,
  Loader2,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings2,
  XCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { movieApi, type ClusterResponse, type MovieApiResponse, type RoomResponse, type MovieAvailabilityResponse, type MovieScreeningVersionCatalogResponse } from "../../api/movieApi";
import {
  assessClusterEligibility,
  type ClusterScheduleEligibility,
} from "../../utils/showtimeEligibility";
import {
  showtimeApi,
  type AutoShowtimeGenerationPolicyResponse,
  type AutoShowtimeGenerationRunResponse,
  type AutoShowtimeIneligibleMovie,
  type GenerationRunStatus,
  type OptimizationScenario,
  type OptimizerMode,
  type SchedulePlanResponse,
  type SchedulePlanSummaryResponse,
} from "../../api/showtimeApi";
import AutoScheduleResultsWorkspace from "./autoSchedule/AutoScheduleResultsWorkspace";
import { subscribeLifecycleEvents } from "../../api/lifecycleSocket";
import AllocationPolicyPanel from "./autoSchedule/AllocationPolicyPanel";
import { RequestState } from "../../components/shared/RequestState";
import { classifyRequestFailure, type RequestFailure } from "../../utils/requestFailure";
import { OPTIMIZER_META, SCENARIO_META } from "./autoSchedule/optimizerMeta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

type StepKey = "scope" | "review" | "running" | "results";
type WorkspaceSection = "create" | "review-plans" | "published" | "policy";
const MAX_AUTO_SCHEDULE_CLUSTERS = 3;
const MAX_AUTO_SCHEDULE_MOVIES = 5;
const STEPS: { key: StepKey; label: string; icon: typeof Calendar }[] = [
  { key: "scope", label: "Scope", icon: Calendar },
  { key: "review", label: "Review", icon: CheckCircle2 },
  { key: "running", label: "Running", icon: Loader2 },
  { key: "results", label: "Results", icon: ClipboardCheck },
];

/** Session-only run tracker (no backend run-history endpoint exists) so a page
 *  refresh doesn't lose track of an in-flight run submitted moments ago. */
export const RECENT_RUNS_KEY = "cp_admin_auto_showtime_runs";
export type RecentAutoScheduleRun = { generationRunId: number; submittedAt: string; startDate: string; endDate: string };

export function loadRecentAutoScheduleRuns(): RecentAutoScheduleRun[] {
  try {
    const raw = localStorage.getItem(RECENT_RUNS_KEY);
    return raw ? (JSON.parse(raw) as RecentAutoScheduleRun[]) : [];
  } catch {
    return [];
  }
}
function saveRecentRun(run: RecentAutoScheduleRun) {
  const existing = loadRecentAutoScheduleRuns().filter((r) => r.generationRunId !== run.generationRunId);
  localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify([run, ...existing].slice(0, 8)));
  window.dispatchEvent(new CustomEvent("auto-schedule-runs-updated"));
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatPlanningDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

type RoomExceptionFilter = "all" | "available" | "excluded";

function RoomCheckbox({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  const selected = checked === true;
  const mixed = checked === "indeterminate";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : selected}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCheckedChange();
      }}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: selected || mixed ? "#2563eb" : "var(--border-color)",
        background: selected || mixed ? "#2563eb" : "var(--bg-main)",
        color: "#fff",
      }}
    >
      {selected ? <Check size={12} strokeWidth={3} /> : mixed ? <span className="h-0.5 w-2 rounded bg-white" /> : null}
    </button>
  );
}

function RoomExceptionsDialog({
  open,
  onOpenChange,
  rooms,
  appliedRoomIds,
  startDate,
  endDate,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomResponse[];
  appliedRoomIds: Set<number>;
  startDate: string;
  endDate: string;
  onApply: (roomIds: Set<number>) => void;
}) {
  const [draftRoomIds, setDraftRoomIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RoomExceptionFilter>("all");

  useEffect(() => {
    if (!open) return;
    setDraftRoomIds(new Set(appliedRoomIds));
    setSearch("");
    setFilter("all");
  }, [appliedRoomIds, open]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rooms.filter((room) => {
      const excluded = draftRoomIds.has(room.cinemaRoomId);
      const matchesFilter = filter === "all"
        || (filter === "excluded" && excluded)
        || (filter === "available" && !excluded);
      const matchesSearch = !query || [room.cinemaRoomName, room.roomCode, room.clusterName]
        .some((value) => value?.toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [draftRoomIds, filter, rooms, search]);

  const groupedRooms = useMemo(() => {
    const groups = new Map<string, RoomResponse[]>();
    filteredRooms.forEach((room) => {
      const key = room.clusterName || "Selected cinema";
      const group = groups.get(key) ?? [];
      group.push(room);
      groups.set(key, group);
    });
    return Array.from(groups.entries());
  }, [filteredRooms]);

  const toggleRoom = (roomId: number) => setDraftRoomIds((current) => {
    const next = new Set(current);
    next.has(roomId) ? next.delete(roomId) : next.add(roomId);
    return next;
  });

  const toggleGroup = (groupRooms: RoomResponse[], exclude: boolean) => setDraftRoomIds((current) => {
    const next = new Set(current);
    groupRooms.forEach((room) => exclude
      ? next.add(room.cinemaRoomId)
      : next.delete(room.cinemaRoomId));
    return next;
  });

  const formattedWindow = startDate && endDate
    ? `${formatPlanningDate(startDate)}–${formatPlanningDate(endDate)}`
    : "the selected planning window";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border p-0"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)" }}
      >
        <DialogHeader className="border-b px-6 py-5 pr-14" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <DoorClosed size={19} />
            </span>
            <div>
              <DialogTitle className="text-lg">Room exceptions</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>
                Excluded rooms will not be used anywhere in this generation run for {formattedWindow}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              <Search size={15} style={{ color: "var(--text-sub)" }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search room or cinema..."
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                style={{ color: "var(--text-main)" }}
              />
            </label>
            <div className="flex rounded-xl border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              {([
                ["all", "All"],
                ["available", "Included"],
                ["excluded", "Excluded"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    color: filter === value ? "#fff" : "var(--text-sub)",
                    background: filter === value ? "#2563eb" : "transparent",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span style={{ color: "var(--text-sub)" }}>
              {draftRoomIds.size === 0
                ? `All ${rooms.length} eligible rooms are included.`
                : `${draftRoomIds.size} of ${rooms.length} rooms excluded.`}
            </span>
            {draftRoomIds.size > 0 && (
              <button type="button" onClick={() => setDraftRoomIds(new Set())} className="font-semibold text-blue-600">
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: "min(480px, 52vh)" }}>
          {groupedRooms.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
              <Search size={21} style={{ color: "var(--text-sub)" }} />
              <p className="text-sm font-semibold">No matching rooms</p>
              <p className="text-xs" style={{ color: "var(--text-sub)" }}>Try another search or room filter.</p>
            </div>
          ) : groupedRooms.map(([clusterName, groupRooms]) => {
            const excludedCount = groupRooms.filter((room) => draftRoomIds.has(room.cinemaRoomId)).length;
            const allExcluded = excludedCount === groupRooms.length;
            const groupState = allExcluded ? true : excludedCount > 0 ? "indeterminate" : false;
            return (
              <section key={clusterName} className="mb-4 overflow-hidden rounded-xl border last:mb-0" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <RoomCheckbox
                      checked={groupState}
                      onCheckedChange={() => toggleGroup(groupRooms, !allExcluded)}
                      label={`Exclude all rooms at ${clusterName}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{clusterName}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>
                        {excludedCount === 0 ? `${groupRooms.length} rooms included` : `${excludedCount} of ${groupRooms.length} excluded`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupRooms, !allExcluded)}
                    className="text-xs font-semibold text-blue-600"
                  >
                    {allExcluded ? "Include all" : "Exclude all"}
                  </button>
                </div>
                <div className="divide-y divide-[var(--border-color)]">
                  {groupRooms.map((room) => {
                    const excluded = draftRoomIds.has(room.cinemaRoomId);
                    const capability = room.presentationSystem
                      || (room.supports3d ? "2D / 3D" : room.supports2d ? "2D" : "Format not set");
                    return (
                      <label
                        key={room.cinemaRoomId}
                        onClick={() => toggleRoom(room.cinemaRoomId)}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
                        style={{ background: excluded ? "rgba(225,29,72,.055)" : "transparent" }}
                      >
                        <RoomCheckbox
                          checked={excluded}
                          onCheckedChange={() => toggleRoom(room.cinemaRoomId)}
                          label={`Exclude ${room.cinemaRoomName}`}
                        />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: excluded ? "rgba(225,29,72,.1)" : "rgba(37,99,235,.09)", color: excluded ? "#e11d48" : "#2563eb" }}>
                          <DoorClosed size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{room.cinemaRoomName}</span>
                          <span className="block truncate text-[11px]" style={{ color: "var(--text-sub)" }}>
                            {[room.roomCode, `${room.seatQuantity ?? 0} seats`, capability].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="text-xs font-semibold" style={{ color: excluded ? "#e11d48" : "#059669" }}>
                          {excluded ? "Excluded" : "Included"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-4 border-t px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <p className="min-w-0 text-xs leading-4" style={{ color: "var(--text-sub)" }}>
            This does not change the operational status of a room.
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold"
              style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-card)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(new Set(draftRoomIds));
                onOpenChange(false);
              }}
              className="whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Apply exceptions{draftRoomIds.size > 0 ? ` (${draftRoomIds.size})` : ""}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScreeningVersionDialog({
  open,
  onOpenChange,
  movie,
  versions,
  appliedVersionIds,
  startDate,
  endDate,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movie?: MovieApiResponse;
  versions: MovieScreeningVersionCatalogResponse[];
  appliedVersionIds?: Set<number>;
  startDate: string;
  endDate: string;
  onApply: (versionIds: Set<number> | null) => void;
}) {
  const [strategy, setStrategy] = useState<"auto" | "custom">("auto");
  const [draftIds, setDraftIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    if (appliedVersionIds?.size) {
      setStrategy("custom");
      setDraftIds(new Set(appliedVersionIds));
    } else {
      setStrategy("auto");
      setDraftIds(new Set());
    }
  }, [appliedVersionIds, open]);

  const chooseCustom = () => {
    setStrategy("custom");
    setDraftIds((current) => current.size > 0
      ? current
      : new Set(versions.map((version) => version.screeningVersionId)));
  };
  const toggleVersion = (id: number) => setDraftIds((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const title = movie?.movieNameEnglish || movie?.movieNameVn || "Selected movie";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] max-w-[720px] flex-col gap-0 overflow-hidden rounded-2xl border p-0"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)" }}
      >
        <DialogHeader className="border-b px-6 py-5 pr-14" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600"><Film size={19} /></span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg">Screening versions</DialogTitle>
              <DialogDescription className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: "var(--text-sub)" }}>
                {title} · {formatPlanningDate(startDate)}–{formatPlanningDate(endDate)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 border-b px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <button type="button" onClick={() => setStrategy("auto")} className="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left"
            style={{ borderColor: strategy === "auto" ? "#2563eb" : "var(--border-color)", background: strategy === "auto" ? "rgba(37,99,235,.07)" : "var(--bg-main)" }}>
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: strategy === "auto" ? "#2563eb" : "var(--border-color)" }}>
              {strategy === "auto" && <span className="h-2 w-2 rounded-full bg-blue-600" />}
            </span>
            <span><span className="block text-sm font-bold">Auto (recommended)</span><span className="mt-0.5 block text-xs leading-5" style={{ color: "var(--text-sub)" }}>Use every active, effective version that is compatible with each cinema room.</span></span>
          </button>
          <button type="button" onClick={chooseCustom} disabled={versions.length === 0} className="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: strategy === "custom" ? "#2563eb" : "var(--border-color)", background: strategy === "custom" ? "rgba(37,99,235,.07)" : "var(--bg-main)" }}>
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: strategy === "custom" ? "#2563eb" : "var(--border-color)" }}>
              {strategy === "custom" && <span className="h-2 w-2 rounded-full bg-blue-600" />}
            </span>
            <span><span className="block text-sm font-bold">Custom versions</span><span className="mt-0.5 block text-xs leading-5" style={{ color: "var(--text-sub)" }}>Restrict this run to selected presentation, audio and subtitle packages.</span></span>
          </button>
        </div>

        {strategy === "custom" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: "min(400px, 45vh)" }}>
            <div className="mb-3 flex items-center justify-between text-xs">
              <span style={{ color: "var(--text-sub)" }}>{draftIds.size} of {versions.length} versions selected</span>
              <button type="button" onClick={() => setDraftIds(new Set(versions.map((version) => version.screeningVersionId)))} className="font-semibold text-blue-600">Select all</button>
            </div>
            <div className="space-y-2">
              {versions.map((version) => {
                const selected = draftIds.has(version.screeningVersionId);
                const language = version.audioLanguageCode || "Original audio";
                const subtitle = version.subtitleLanguageCode ? `${version.subtitleLanguageCode} subtitles` : "No subtitles";
                return (
                  <label key={version.screeningVersionId} onClick={() => toggleVersion(version.screeningVersionId)} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3.5"
                    style={{ borderColor: selected ? "rgba(37,99,235,.55)" : "var(--border-color)", background: selected ? "rgba(37,99,235,.055)" : "var(--bg-main)" }}>
                    <RoomCheckbox checked={selected} onCheckedChange={() => toggleVersion(version.screeningVersionId)} label={`Select ${version.formatName}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold">{version.formatName || version.formatCode}</span>
                        {version.audioFormatName && <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-purple-600">{version.audioFormatName}</span>}
                      </span>
                      <span className="mt-1 block text-xs" style={{ color: "var(--text-sub)" }}>{language} · {subtitle} · {version.compatibleRoomCount} compatible rooms</span>
                    </span>
                  </label>
                );
              })}
              {versions.length === 0 && <p className="py-8 text-center text-sm" style={{ color: "var(--text-sub)" }}>No active version overlaps this planning window.</p>}
            </div>
          </div>
        )}

        <DialogFooter className="border-t px-6 py-4 sm:items-center sm:justify-between" style={{ borderColor: "var(--border-color)" }}>
          <p className="text-xs" style={{ color: "var(--text-sub)" }}>Room compatibility is validated again when the run is submitted.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>Cancel</button>
            <button type="button" disabled={strategy === "custom" && draftIds.size === 0} onClick={() => { onApply(strategy === "auto" ? null : new Set(draftIds)); onOpenChange(false); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Apply strategy</button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovieCatalogAccordionItem({
  movie,
  eligible,
  reason,
  selected,
  expanded,
  versions,
  scopeRoomCount,
  overrideIds,
  onToggleSelected,
  onToggleExpanded,
  onUseAuto,
  onToggleVersion,
}: {
  movie: MovieApiResponse;
  eligible: boolean;
  reason?: string;
  selected: boolean;
  expanded: boolean;
  versions: MovieScreeningVersionCatalogResponse[];
  scopeRoomCount: number;
  overrideIds?: Set<number>;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
  onUseAuto: () => void;
  onToggleVersion: (versionId: number) => void;
}) {
  const title = movie.movieNameEnglish || movie.movieNameVn;
  const alternateTitle = movie.movieNameVn && movie.movieNameVn !== title ? movie.movieNameVn : null;
  const schedulableCount = versions.filter((version) => version.compatibleRoomCount > 0).length;
  const custom = Boolean(overrideIds?.size);

  return (
    <article className="overflow-hidden rounded-xl border" style={{ borderColor: selected ? "rgba(37,99,235,.55)" : !eligible ? "rgba(245,158,11,.3)" : "var(--border-color)", background: "var(--bg-main)", opacity: eligible ? 1 : 0.72 }}>
      <div className="flex items-center gap-3 p-3">
        <RoomCheckbox checked={selected} onCheckedChange={onToggleSelected} label={`Select ${title}`} disabled={!eligible} />
        <button type="button" onClick={onToggleExpanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-purple-500/10">
            {movie.smallImage || movie.largeImage
              ? <img src={movie.smallImage || movie.largeImage} alt="" className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center text-purple-500"><Film size={18} /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{title}</p>
              {movie.ageRatingCode && <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-500">{movie.ageRatingCode}</span>}
              <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500">{movie.duration || "—"} min</span>
            </div>
            {alternateTitle && <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-sub)" }}>{alternateTitle}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--text-sub)" }}>
              <span className={schedulableCount > 0 ? "text-emerald-500" : "text-rose-500"}>
                {schedulableCount > 0
                  ? `${schedulableCount} schedulable version${schedulableCount === 1 ? "" : "s"}`
                  : "No schedulable version"}
              </span>
              {selected && <span className="font-semibold text-blue-600">{custom ? `${overrideIds?.size} manually selected` : "Auto"}</span>}
            </div>
            {!eligible && <p className="mt-1.5 line-clamp-1 text-[10.5px] font-semibold text-amber-600">Unavailable · {reason}</p>}
          </div>
          <span className="shrink-0" style={{ color: "var(--text-sub)" }}>{expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
        </button>
      </div>

      {expanded && (
        <div className="border-t" style={{ borderColor: "var(--border-color)" }}>
          {versions.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Version strategy</p>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-sub)" }}>Use Auto, or select specific versions below.</p>
              </div>
              <button
                type="button"
                disabled={!eligible}
                onClick={onUseAuto}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: selected && !custom ? "#2563eb" : "var(--border-color)", background: selected && !custom ? "rgba(37,99,235,.08)" : "var(--bg-main)", color: selected && !custom ? "#2563eb" : "var(--text-main)" }}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: selected && !custom ? "#2563eb" : "var(--border-color)" }}>
                  {selected && !custom && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                </span>
                Auto (recommended)
              </button>
            </div>
          )}

          {versions.map((version) => {
            const checked = overrideIds?.has(version.screeningVersionId) ?? false;
            const ready = version.compatibleRoomCount > 0;
            const canChooseVersion = eligible && ready;
            const effectiveWindow = version.effectiveFrom || version.effectiveTo
              ? `${version.effectiveFrom ? formatPlanningDate(version.effectiveFrom) : "Any date"}–${version.effectiveTo ? formatPlanningDate(version.effectiveTo) : "No end date"}`
              : null;
            const fullyCompatible = scopeRoomCount > 0 && version.compatibleRoomCount >= scopeRoomCount;
            return (
              <div key={version.screeningVersionId} className="grid gap-3 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(280px,1.35fr)_minmax(220px,1fr)] lg:items-center" style={{ borderColor: "var(--border-color)", background: checked ? "rgba(37,99,235,.055)" : "transparent" }}>
                <div
                  role="button"
                  tabIndex={canChooseVersion ? 0 : -1}
                  aria-disabled={!canChooseVersion}
                  onClick={() => { if (canChooseVersion) onToggleVersion(version.screeningVersionId); }}
                  onKeyDown={(event) => {
                    if (canChooseVersion && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onToggleVersion(version.screeningVersionId);
                    }
                  }}
                  className={`flex min-w-0 items-start gap-3 text-left ${canChooseVersion ? "cursor-pointer" : "cursor-not-allowed"}`}
                >
                  <RoomCheckbox checked={checked} onCheckedChange={() => onToggleVersion(version.screeningVersionId)} label={`Select ${version.formatName}`} disabled={!canChooseVersion} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-500">{version.formatCode}</span>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>{version.audioLanguageCode.toUpperCase()} audio</span>
                      <span className="text-xs" style={{ color: "var(--text-sub)" }}>· {version.subtitleLanguageCode ? `${version.subtitleLanguageCode.toUpperCase()} subtitles` : "No subtitles"}</span>
                    </div>
                    {effectiveWindow && <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--text-sub)" }}><Calendar size={11} className="mr-1 inline" />{effectiveWindow}</p>}
                  </div>
                </div>
                <div>
                  <div className={`flex items-center gap-2 text-xs font-semibold ${ready ? fullyCompatible ? "text-emerald-500" : "text-amber-500" : "text-rose-500"}`}>
                    {ready ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{ready ? "Ready" : "No compatible room"}
                  </div>
                  <p className="mt-1 text-[10.5px]" style={{ color: fullyCompatible ? "var(--text-sub)" : ready ? "#d97706" : "var(--text-sub)" }}>
                    {version.audioFormatName || version.audioFormatCode}
                    {scopeRoomCount > 0
                      ? fullyCompatible
                        ? ` · ${scopeRoomCount} rooms`
                        : ` · Compatible with ${version.compatibleRoomCount}/${scopeRoomCount} rooms`
                      : ` · ${version.compatibleRoomCount} compatible rooms`}
                  </p>
                </div>
              </div>
            );
          })}
          {versions.length === 0 && <p className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-sub)" }}>No active screening version overlaps this planning window and cinema scope.</p>}
        </div>
      )}
    </article>
  );
}

function extractErrorMessage(err: unknown): { message: string; ineligibleMovies?: AutoShowtimeIneligibleMovie[] } {
  const response = (err as { response?: { data?: { message?: string; result?: { ineligibleMovies?: AutoShowtimeIneligibleMovie[] } } } })?.response;
  return {
    message: response?.data?.message ?? "The generation run could not be submitted.",
    ineligibleMovies: response?.data?.result?.ineligibleMovies,
  };
}

// A CP-SAT run can legitimately take up to the policy's max_solve_time_seconds (default 30s)
// plus overhead; Legacy runs normally finish in a couple seconds. Past this, the run is either
// still solving a hard model or has been orphaned (see AutoShowtimeGenerationScheduler's
// reclaimStaleRunningRuns() sweep) - either way the admin should know to expect a delay or retry,
// not just watch an ever-increasing "Elapsed Ns" with no upper bound.
const STUCK_RUN_WARNING_SECONDS = 75;

const STATUS_META: Record<GenerationRunStatus, { label: string; color: string; background: string }> = {
  ACCEPTED: { label: "Queued", color: "#2563eb", background: "rgba(37,99,235,0.1)" },
  RUNNING: { label: "Running", color: "#d97706", background: "rgba(217,119,6,0.1)" },
  COMPLETED: { label: "Completed", color: "#059669", background: "rgba(5,150,105,0.1)" },
  PARTIALLY_COMPLETED: { label: "Partially completed", color: "#d97706", background: "rgba(217,119,6,0.1)" },
  FAILED: { label: "Failed", color: "#dc2626", background: "rgba(220,38,38,0.1)" },
};

const PLAN_STATUS_META: Record<SchedulePlanResponse["status"], { label: string; color: string; background: string }> = {
  DRAFT_GENERATED: { label: "Draft", color: "#64748b", background: "rgba(100,116,139,.12)" },
  IN_REVIEW: { label: "In review", color: "#2563eb", background: "rgba(37,99,235,.12)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#d97706", background: "rgba(217,119,6,.12)" },
  PUBLISHED: { label: "Published", color: "#059669", background: "rgba(5,150,105,.12)" },
};


function SchedulePlanLibrary({
  mode,
  plans,
  loading,
  error,
  onRefresh,
  onOpen,
}: {
  mode: "drafts" | "review" | "published";
  plans: SchedulePlanSummaryResponse[];
  loading: boolean;
  error: RequestFailure | null;
  onRefresh: () => void;
  onOpen: (generationRunId: number) => void;
}) {
  const published = mode === "published";
  const approvalQueue = mode === "review";
  return (
    <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>
            {published ? "Published schedules" : approvalQueue ? "Plans awaiting decision" : "Drafts and returned plans"}
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
            {published
              ? "Open a published plan to inspect the operational schedule."
              : approvalQueue
                ? "Inspect the validated plan before approving it or requesting changes."
                : "Continue generated drafts and resolve changes requested by the approver."}
          </p>
        </div>
        <button type="button" onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm" style={{ color: "var(--text-sub)" }}>
            <Loader2 size={16} className="animate-spin" /> Loading schedule plans…
          </div>
        ) : error ? (
          <RequestState compact kind={error.kind} description={error.description} onRetry={onRefresh} />
        ) : plans.length === 0 ? (
          <RequestState compact kind="empty"
            title={published ? "No published schedules yet" : approvalQueue ? "No plans require review" : "No drafts or returned plans"}
            description={published ? "Published schedule plans will appear here." : approvalQueue ? "Submitted schedule plans will appear here for independent review." : "Generated drafts and plans returned for changes will appear here."}
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {plans.map((item) => {
              const statusMeta = PLAN_STATUS_META[item.status];
              const actionLabel = item.status === "PUBLISHED"
                ? "View schedule"
                : item.status === "DRAFT_GENERATED"
                  ? "Review draft"
                  : "Open plan";
              return (
                <article key={item.schedulePlanId} className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Schedule plan #{item.schedulePlanId}</h3>
                        <span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: statusMeta.color, background: statusMeta.background }}>{statusMeta.label}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-sub)" }}>
                        {formatPlanningDate(item.startDate)} – {formatPlanningDate(item.endDate)}
                      </p>
                    </div>
                    {item.blockerCount > 0 && <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-500">{item.blockerCount} blocker{item.blockerCount === 1 ? "" : "s"}</span>}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      ["Cinemas", item.cinemaCount],
                      ["Rooms", item.roomCount],
                      ["Sessions", item.sessionCount],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>{label}</p>
                        <p className="mt-1 text-base font-bold" style={{ color: "var(--text-main)" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                    <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>
                      {item.requestedBy || "Unknown user"} · Updated {formatUpdatedAt(item.updatedAt)}
                    </p>
                    <button type="button" onClick={() => onOpen(item.generationRunId)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                      {actionLabel} <ArrowRight size={13} />
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function StepIndicator({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  const currentStep = STEPS[currentIdx];
  const Icon = currentStep.icon;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
          <Icon size={15} className={current === "running" ? "animate-spin" : ""} />
        </div>
        <div className="min-w-0">
          <p style={{ color: "var(--text-sub)", fontSize: "10.5px", fontWeight: 650, textTransform: "uppercase", letterSpacing: ".045em" }}>Step {currentIdx + 1} of {STEPS.length}</p>
          <p className="truncate" style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 700 }}>{currentStep.label}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5" aria-label={`Workflow progress: step ${currentIdx + 1} of ${STEPS.length}`}>
        {STEPS.map((item, idx) => (
          <span key={item.key} className="h-1.5 rounded-full transition-all" style={{ width: idx === currentIdx ? 24 : 8, background: idx <= currentIdx ? "#2563eb" : "var(--border-color)" }} />
        ))}
      </div>
    </div>
  );
}

type AutoScheduleShowtimePageProps = {
  embedded?: boolean;
  initialRunId?: number | null;
  onShowtimesChanged?: () => void;
  workspaceMode?: "create" | "review";
};

export default function AutoScheduleShowtimePage({
  embedded = false,
  initialRunId = null,
  onShowtimesChanged,
  workspaceMode = "create",
}: AutoScheduleShowtimePageProps = {}) {
  const { user } = useAuth();
  const [step, setStep] = useState<StepKey>("scope");
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>(workspaceMode === "review" ? "review-plans" : "create");

  // Scope inputs
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsFailure, setOptionsFailure] = useState<RequestFailure | null>(null);
  const [startDate, setStartDate] = useState(todayPlusDays(3));
  const [endDate, setEndDate] = useState(todayPlusDays(9));
  const [optimizerMode, setOptimizerMode] = useState<OptimizerMode>("LEGACY");
  const [scenario, setScenario] = useState<OptimizationScenario>("BALANCED");
  const [generationPolicy, setGenerationPolicy] = useState<AutoShowtimeGenerationPolicyResponse | null>(null);
  const [allClusters, setAllClusters] = useState(false);
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<number>>(new Set());
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [expandedMovieIds, setExpandedMovieIds] = useState<Set<number>>(new Set());
  const [screeningVersions, setScreeningVersions] = useState<MovieScreeningVersionCatalogResponse[]>([]);
  const [screeningVersionOverrides, setScreeningVersionOverrides] = useState<Map<number, Set<number>>>(new Map());
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [excludedRoomIds, setExcludedRoomIds] = useState<Set<number>>(new Set());
  const [roomExceptionsOpen, setRoomExceptionsOpen] = useState(false);
  const [clusterEligibility, setClusterEligibility] = useState<Map<number, ClusterScheduleEligibility>>(new Map());
  const [availabilities, setAvailabilities] = useState<MovieAvailabilityResponse[]>([]);
  const [clusterSearch, setClusterSearch] = useState("");
  const [movieSearch, setMovieSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");

  // Submit / run state
  const [submitting, setSubmitting] = useState(false);
  const [processingNow, setProcessingNow] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ineligibleMovies, setIneligibleMovies] = useState<AutoShowtimeIneligibleMovie[]>([]);
  const [run, setRun] = useState<AutoShowtimeGenerationRunResponse | null>(null);
  const [plan, setPlan] = useState<SchedulePlanResponse | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [resultsPage, setResultsPage] = useState(0);
  const [planLibrary, setPlanLibrary] = useState<SchedulePlanSummaryResponse[]>([]);
  const [loadingPlanLibrary, setLoadingPlanLibrary] = useState(false);
  const [planLibraryError, setPlanLibraryError] = useState<RequestFailure | null>(null);
  const [planLibraryRefresh, setPlanLibraryRefresh] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumedInitialRun = useRef<number | null>(null);
  const notifiedTerminalRun = useRef<number | null>(null);
  const manualProcessingEnvironment = import.meta.env.DEV
    || import.meta.env.VITE_DEMO_MODE === "true"
    || import.meta.env.VITE_ENABLE_AUTO_SHOWTIME_PROCESS_NOW === "true";
  const canProcessNow = user?.role === "ROLE_SUPER_ADMIN"
    || (user?.role === "ROLE_ADMIN" && manualProcessingEnvironment);

  useEffect(() => subscribeLifecycleEvents((event) => {
    if (event.aggregateType === "SCHEDULE_PLAN") {
      setPlanLibraryRefresh((value) => value + 1);
      if (plan?.schedulePlanId === event.aggregateId) {
        showtimeApi.getSchedulePlan(event.aggregateId)
          .then((response) => setPlan(response.result))
          .catch(() => undefined);
      }
    }
    if (event.aggregateType === "RELEASE_PLAN") {
      movieApi.searchAvailabilities({})
        .then((response) => setAvailabilities(response.result ?? []))
        .catch(() => undefined);
    }
    if (event.aggregateType === "MOVIE") {
      movieApi.getAllMovies()
        .then((response) => setMovies((response.result ?? []).filter((movie) => movie.movieStatus === "APPROVED")))
        .catch(() => undefined);
    }
  }), [plan?.schedulePlanId]);

  useEffect(() => {
    if (workspaceMode === "review") {
      setLoadingOptions(false);
      return;
    }
    Promise.all([movieApi.getClusters(), movieApi.getAllMovies(), movieApi.getRooms(), movieApi.searchAvailabilities({})])
      .then(([clusterRes, movieRes, roomRes, availabilityRes]) => {
        const activeClusters = (clusterRes.result ?? []).filter((c) => c.status === "ACTIVE");
        const roomsByCluster = new Map<number, RoomResponse[]>();
        (roomRes.result ?? []).forEach((room) => {
          const group = roomsByCluster.get(room.clusterId) ?? [];
          group.push(room);
          roomsByCluster.set(room.clusterId, group);
        });
        setClusters(activeClusters);
        setClusterEligibility(new Map(activeClusters.map((cluster) => [
          cluster.clusterId,
          assessClusterEligibility(roomsByCluster.get(cluster.clusterId) ?? []),
        ])));
        setMovies((movieRes.result ?? []).filter((m) => m.movieStatus === "APPROVED"));
        setRooms(roomRes.result ?? []);
        setAvailabilities(availabilityRes.result ?? []);
      })
      .catch((error) => {
        setClusters([]); setMovies([]); setRooms([]); setClusterEligibility(new Map()); setAvailabilities([]); setScreeningVersions([]);
        setOptionsFailure(classifyRequestFailure(error, "Scheduling prerequisites could not be loaded."));
      })
      .finally(() => setLoadingOptions(false));
    showtimeApi.getActiveGenerationPolicy()
      .then((res) => setGenerationPolicy(res.result ?? null))
      .catch(() => setGenerationPolicy(null));
  }, [workspaceMode]);

  useEffect(() => {
    if (step !== "scope") return;
    let active = true;
    setLoadingPlanLibrary(true);
    setPlanLibraryError(null);
    showtimeApi.listSchedulePlans(undefined, 0, 50)
      .then((response) => {
        if (active) setPlanLibrary(response.result.content ?? []);
      })
      .catch((error) => {
        if (active) {
          setPlanLibrary([]);
          setPlanLibraryError(classifyRequestFailure(error, "Schedule plans could not be loaded."));
        }
      })
      .finally(() => {
        if (active) setLoadingPlanLibrary(false);
      });
    return () => {
      active = false;
    };
  }, [planLibraryRefresh, step]);

  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.clusterId, c])), [clusters]);
  const movieById = useMemo(() => new Map(movies.map((m) => [m.movieId, m])), [movies]);
  const screeningVersionsByMovie = useMemo(() => {
    const grouped = new Map<number, MovieScreeningVersionCatalogResponse[]>();
    screeningVersions.forEach((version) => {
      const overlapsWindow = (!version.effectiveFrom || !endDate || version.effectiveFrom <= endDate)
        && (!version.effectiveTo || !startDate || version.effectiveTo >= startDate);
      if (!overlapsWindow) return;
      const group = grouped.get(version.movieId) ?? [];
      group.push(version);
      grouped.set(version.movieId, group);
    });
    grouped.forEach((group) => group.sort((a, b) => a.formatName.localeCompare(b.formatName)
      || a.audioLanguageCode.localeCompare(b.audioLanguageCode)));
    return grouped;
  }, [endDate, screeningVersions, startDate]);
  const genreOptions = useMemo(() => Array.from(new Set(movies.flatMap((movie) => movie.movieType ?? []))).sort(), [movies]);
  const visibleClusters = useMemo(() => {
    const query = clusterSearch.trim().toLowerCase();
    return clusters.filter((cluster) => !query || [cluster.clusterName, cluster.province, cluster.address]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [clusterSearch, clusters]);
  const visibleMovies = useMemo(() => {
    const query = movieSearch.trim().toLowerCase();
    return movies.filter((movie) => {
      const matchesQuery = !query || [movie.movieNameEnglish, movie.movieNameVn, ...movie.movieType]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesGenre = !genreFilter || movie.movieType.includes(genreFilter);
      return matchesQuery && matchesGenre;
    });
  }, [genreFilter, movieSearch, movies]);
  const reviewPlans = useMemo(
    () => planLibrary.filter((item) => workspaceMode === "review"
      ? item.status === "IN_REVIEW"
      : item.status === "DRAFT_GENERATED" || item.status === "CHANGES_REQUESTED"),
    [planLibrary, workspaceMode],
  );
  const publishedPlans = useMemo(
    () => planLibrary.filter((item) => item.status === "PUBLISHED"),
    [planLibrary],
  );
  const toggleCluster = (id: number) => setSelectedClusterIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_AUTO_SCHEDULE_CLUSTERS) next.add(id);
    return next;
  });
  const toggleMovie = (id: number) => setSelectedMovieIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
      setScreeningVersionOverrides((current) => {
        if (!current.has(id)) return current;
        const updated = new Map(current);
        updated.delete(id);
        return updated;
      });
    } else if (next.size < MAX_AUTO_SCHEDULE_MOVIES) {
      next.add(id);
    }
    return next;
  });
  const schedulableClusters = useMemo(() => clusters.filter((cluster) => clusterEligibility.get(cluster.clusterId)?.schedulable), [clusterEligibility, clusters]);
  const invalidDateRange = Boolean(startDate && endDate && endDate < startDate);
  // Mirrors AutoShowtimeGenerationService.validateGenerationRange's D+start ~ D+end horizon
  // check so an out-of-horizon date range is flagged here, instead of only surfacing as a
  // 400 INVALID_GENERATION_RANGE after Submit run.
  const horizonViolation = Boolean(
    generationPolicy && startDate && endDate
    && (startDate < generationPolicy.earliestAllowedDate || endDate > generationPolicy.latestAllowedDate)
  );
  const applyAvailablePlanningWindow = () => {
    if (!generationPolicy) return;
    const clampedStart = !startDate || startDate < generationPolicy.earliestAllowedDate
      ? generationPolicy.earliestAllowedDate
      : startDate > generationPolicy.latestAllowedDate
        ? generationPolicy.latestAllowedDate
        : startDate;
    const clampedEnd = !endDate || endDate > generationPolicy.latestAllowedDate
      ? generationPolicy.latestAllowedDate
      : endDate < clampedStart
        ? clampedStart
        : endDate;
    setStartDate(clampedStart);
    setEndDate(clampedEnd);
  };
  const effectiveClusterIds = allClusters
    ? schedulableClusters.slice(0, MAX_AUTO_SCHEDULE_CLUSTERS).map((c) => c.clusterId)
    : Array.from(selectedClusterIds);
  const selectedScopeRoomCount = effectiveClusterIds.reduce(
    (total, clusterId) => total + (clusterEligibility.get(clusterId)?.eligibleRoomCount ?? 0),
    0,
  );
  const effectiveClusterKey = [...effectiveClusterIds].sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (!effectiveClusterKey) {
      setScreeningVersions([]);
      return;
    }
    let active = true;
    movieApi.searchMovieScreeningVersions({
      status: "ACTIVE",
      clusterIds: effectiveClusterKey.split(",").map(Number),
    })
      .then((response) => { if (active) setScreeningVersions(response.result ?? []); })
      .catch(() => { if (active) setScreeningVersions([]); });
    return () => { active = false; };
  }, [effectiveClusterKey]);
  const canProceedFromScope = Boolean(
    startDate && endDate && !invalidDateRange && !horizonViolation
    && effectiveClusterIds.length > 0 && effectiveClusterIds.length <= MAX_AUTO_SCHEDULE_CLUSTERS
    && selectedMovieIds.size > 0 && selectedMovieIds.size <= MAX_AUTO_SCHEDULE_MOVIES
  );

  // Rooms an admin can exclude from this generation run only (e.g. held for a private
  // booking, or under short-notice maintenance not yet reflected in room status). Scoped to
  // the currently-selected cinema clusters so the list stays relevant as scope changes.
  const excludableRooms = useMemo(() => {
    const clusterIdSet = new Set(effectiveClusterIds);
    return rooms
      .filter((room) => clusterIdSet.has(room.clusterId) && room.status !== "INACTIVE")
      .sort((a, b) => (a.clusterName ?? "").localeCompare(b.clusterName ?? "") || a.cinemaRoomName.localeCompare(b.cinemaRoomName));
  }, [effectiveClusterIds, rooms]);
  // Drop exclusions that fall outside the current cluster scope so a stale pick from a
  // previously-selected cinema doesn't silently keep excluding a room the admin can no longer see.
  useEffect(() => {
    const validIds = new Set(excludableRooms.map((room) => room.cinemaRoomId));
    setExcludedRoomIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [excludableRooms]);

  // Mirrors SchedulingEligibilityService's AVAILABILITY_NOT_OPEN gate (movie_availability.status
  // IN (APPROVED, OPEN), showingStartDate <= day <= showingEndDate) so an admin sees which movies
  // will actually be eligible for the chosen clusters/dates *before* submitting, instead of only
  // finding out from the "Prerequisites missing" error at Review. Classification/room-format are
  // checked elsewhere (Cinema scope eligibility, and preflight on submit) - this only covers the
  // release-plan gate, since that's the one driven entirely by admin-entered scheduling data.
  const movieAvailabilityEligibility = useMemo(() => {
    const result = new Map<number, { eligible: boolean; reason?: string }>();
    if (effectiveClusterIds.length === 0 || !startDate || !endDate || invalidDateRange) {
      return result;
    }
    const clusterIdSet = new Set(effectiveClusterIds);
    for (const movie of movies) {
      const hasWindow = availabilities.some((availability) =>
        availability.movieId === movie.movieId
        && clusterIdSet.has(availability.clusterId)
        && (availability.status === "APPROVED" || availability.status === "OPEN")
        && availability.showingStartDate <= endDate
        && (!availability.showingEndDate || availability.showingEndDate >= startDate));
      result.set(movie.movieId, hasWindow
        ? { eligible: true }
        : { eligible: false, reason: "No approved release plan covers the selected cinemas and dates." });
    }
    return result;
  }, [availabilities, effectiveClusterIds, startDate, endDate, invalidDateRange, movies]);

  const stopPolling = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const pollRun = async (id: number, page = 0) => {
    try {
      const res = await showtimeApi.getAutoGenerationRun(id, page);
      const data = res.result;
      setRun(data);
      if (data.status === "COMPLETED" || data.status === "PARTIALLY_COMPLETED" || data.status === "FAILED") {
        stopPolling();
        setStep("results");
        if (data.schedulePlanId) {
          const planResponse = await showtimeApi.getSchedulePlan(data.schedulePlanId);
          setPlan(planResponse.result);
        }
      }
    } catch {
      // transient poll failure — keep the previous state and retry on the next tick
    }
  };

  const startPolling = (id: number) => {
    stopPolling();
    setRunningSince(Date.now());
    void pollRun(id);
    pollTimer.current = setInterval(() => void pollRun(id), 3000);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setIneligibleMovies([]);
    try {
      const res = await showtimeApi.submitAutoGenerationRun({
        startDate,
        endDate,
        cinemaClusterIds: effectiveClusterIds,
        movieIds: Array.from(selectedMovieIds),
        optimizer: optimizerMode,
        scenario: optimizerMode === "LEGACY" ? undefined : scenario,
        excludedRoomIds: excludedRoomIds.size > 0 ? Array.from(excludedRoomIds) : undefined,
        screeningVersionSelections: Array.from(screeningVersionOverrides.entries())
          .filter(([movieId, versionIds]) => selectedMovieIds.has(movieId) && versionIds.size > 0)
          .map(([movieId, versionIds]) => ({ movieId, screeningVersionIds: Array.from(versionIds) })),
      });
      const accepted = res.result;
      saveRecentRun({ generationRunId: accepted.generationRunId, submittedAt: new Date().toISOString(), startDate, endDate });
      setStep("running");
      startPolling(accepted.generationRunId);
    } catch (err) {
      const { message, ineligibleMovies: ineligible } = extractErrorMessage(err);
      setSubmitError(message);
      setIneligibleMovies(ineligible ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessNow = async () => {
    if (!run) return;
    setProcessingNow(true);
    try {
      await showtimeApi.executeAutoGenerationRun(run.generationRunId);
    } catch {
      // executor may have already finished (race with the scheduler) — fall through to poll
    } finally {
      setProcessingNow(false);
    }
    void pollRun(run.generationRunId);
  };

  const resumeRun = (id: number) => {
    setStep("running");
    startPolling(id);
  };

  useEffect(() => {
    if (!initialRunId || resumedInitialRun.current === initialRunId) return;
    resumedInitialRun.current = initialRunId;
    resumeRun(initialRunId);
  }, [initialRunId]);

  const resetWizard = () => {
    stopPolling();
    setRun(null);
    setPlan(null);
    setPlanError(null);
    setRunningSince(null);
    setSubmitError(null);
    setIneligibleMovies([]);
    setSelectedClusterIds(new Set());
    setSelectedMovieIds(new Set());
    setExpandedMovieIds(new Set());
    setScreeningVersionOverrides(new Map());
    setExcludedRoomIds(new Set());
    setAllClusters(false);
    setResultsPage(0);
    setWorkspaceSection("create");
    setPlanLibraryRefresh((value) => value + 1);
    setStep("scope");
  };

  const goToResultsPage = (page: number) => {
    if (!run) return;
    setResultsPage(page);
    void pollRun(run.generationRunId, page);
  };

  const transitionPlan = async (action: "submit" | "changes" | "publish", note?: string) => {
    if (!plan) return;
    setPlanBusy(true);
    setPlanError(null);
    try {
      const response = action === "submit"
        ? await showtimeApi.submitSchedulePlanReview(plan.schedulePlanId, note || undefined)
        : action === "changes"
          ? await showtimeApi.requestSchedulePlanChanges(plan.schedulePlanId, note || undefined)
          : await showtimeApi.publishSchedulePlan(plan.schedulePlanId);
      setPlan(response.result);
      if (action === "publish" && run) {
        notifiedTerminalRun.current = run.generationRunId;
        onShowtimesChanged?.();
        await pollRun(run.generationRunId, resultsPage);
      }
    } catch (error) {
      setPlanError(extractErrorMessage(error).message);
    } finally {
      setPlanBusy(false);
    }
  };

  const revalidatePlan = async () => {
    if (!plan) return;
    setPlanBusy(true);
    setPlanError(null);
    try {
      const response = await showtimeApi.revalidateSchedulePlan(plan.schedulePlanId);
      setPlan(response.result);
      setPlanLibraryRefresh((value) => value + 1);
    } catch (error) {
      setPlanError(extractErrorMessage(error).message);
    } finally {
      setPlanBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!embedded && <div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
            <CalendarCog size={18} />
          </div>
          <div>
            <h1 style={{ color: "var(--text-main)", fontSize: "18px", fontWeight: 750 }}>Auto Schedule Showtimes</h1>
            <p style={{ color: "var(--text-sub)", fontSize: "12px" }}>
              Generate showtimes automatically based on movie/cluster demand — a background job handles the actual scheduling.
            </p>
          </div>
        </div>
      </div>}

      {step !== "scope" && step !== "results" && <StepIndicator current={step} />}

      {/* Nav stays visible on every step (not just "scope") so Policy (and the other
          sections) are always reachable — previously it only rendered during the
          scope step, so resuming an in-flight/completed run (which jumps straight to
          "running"/"results") hid the nav entirely and made Policy unreachable from
          that flow. */}
      <nav className="flex flex-wrap items-center gap-1 rounded-xl border p-1.5" aria-label="Automatic scheduling workspace" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        {(workspaceMode === "review" ? ([
          { id: "review-plans", label: "Awaiting decision", icon: ClipboardCheck, count: reviewPlans.length },
          { id: "published", label: "Published schedules", icon: CheckCircle2, count: publishedPlans.length },
        ] as const) : ([
          { id: "create", label: "Create schedule", icon: CalendarCog, count: null },
          { id: "review-plans", label: "Drafts & returns", icon: ClipboardCheck, count: reviewPlans.length },
          { id: "policy", label: "Allocation policy", icon: Settings2, count: null },
        ] as const)).map(({ id, label, icon: Icon, count }) => {
          const active = workspaceSection === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => { setWorkspaceSection(id); setStep("scope"); }}
              className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors"
              style={{
                color: active ? "#2563eb" : "var(--text-sub)",
                background: active ? "rgba(37,99,235,.11)" : "transparent",
              }}
            >
              <Icon size={14} />
              {label}
              {count != null && count > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ color: active ? "#2563eb" : "var(--text-main)", background: active ? "rgba(37,99,235,.12)" : "var(--bg-main)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {step === "scope" && workspaceSection === "review-plans" && (
        <SchedulePlanLibrary
          mode={workspaceMode === "review" ? "review" : "drafts"}
          plans={reviewPlans}
          loading={loadingPlanLibrary}
          error={planLibraryError}
          onRefresh={() => setPlanLibraryRefresh((value) => value + 1)}
          onOpen={resumeRun}
        />
      )}

      {step === "scope" && workspaceSection === "published" && (
        <SchedulePlanLibrary
          mode="published"
          plans={publishedPlans}
          loading={loadingPlanLibrary}
          error={planLibraryError}
          onRefresh={() => setPlanLibraryRefresh((value) => value + 1)}
          onOpen={resumeRun}
        />
      )}

      {step === "scope" && workspaceSection === "policy" && <AllocationPolicyPanel />}

      {/* ── Step 1: Scope ── */}
      {step === "scope" && workspaceSection === "create" && (
        <div className="space-y-4">
          {optionsFailure ? (
            <RequestState compact kind={optionsFailure.kind} description={optionsFailure.description} onRetry={() => window.location.reload()} />
          ) : loadingOptions ? (
            <div className="flex items-center gap-2 rounded-2xl border p-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)" }}>
              <RefreshCw size={16} className="animate-spin" /> Loading clusters and movies…
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.65fr)]">
                  <div className="flex h-[650px] min-h-0 flex-col gap-4">
                    <section className="flex-shrink-0 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <div className="mb-3 flex items-center gap-2">
                        <Calendar size={15} className="text-blue-600" />
                        <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-main)" }}>Planning window</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Start date</label>
                          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2.5 outline-none"
                            style={{ background: "var(--bg-main)", borderColor: horizonViolation ? "#d97706" : "var(--border-color)", color: "var(--text-main)", fontSize: "13.5px" }} />
                        </div>
                        <div>
                          <label className="mb-1.5 block" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>End date</label>
                          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2.5 outline-none"
                            style={{ background: "var(--bg-main)", borderColor: invalidDateRange ? "#dc2626" : horizonViolation ? "#d97706" : "var(--border-color)", color: "var(--text-main)", fontSize: "13.5px" }} />
                        </div>
                      </div>
                      {invalidDateRange && <p className="mt-2 text-rose-500" style={{ fontSize: "12px" }}>End date cannot be before start date.</p>}
                      {!invalidDateRange && horizonViolation && generationPolicy && (
                        <div className="mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(217,119,6,.28)", background: "rgba(217,119,6,.08)" }}>
                          <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold" style={{ color: "var(--text-main)", fontSize: "12px" }}>Adjust the planning dates</p>
                            <p className="mt-0.5" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
                              Choose a date between {formatPlanningDate(generationPolicy.earliestAllowedDate)} and {formatPlanningDate(generationPolicy.latestAllowedDate)}.
                            </p>
                          </div>
                          <button type="button" onClick={applyAvailablePlanningWindow} className="shrink-0 rounded-lg px-2.5 py-1.5 font-semibold transition-colors hover:bg-amber-500/10" style={{ color: "#d97706", fontSize: "11px" }}>
                            Fix dates
                          </button>
                        </div>
                      )}
                    </section>

                    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={15} className="text-blue-600" />
                          <div>
                            <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-main)" }}>Cinema scope</p>
                            <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                              {effectiveClusterIds.length} selected · max {MAX_AUTO_SCHEDULE_CLUSTERS}
                            </p>
                          </div>
                        </div>
                        {schedulableClusters.length <= MAX_AUTO_SCHEDULE_CLUSTERS ? (
                          <button
                            type="button"
                            disabled={!allClusters && schedulableClusters.length === 0}
                            onClick={() => { setAllClusters(!allClusters); setSelectedClusterIds(new Set()); }}
                            className="rounded-lg px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ background: allClusters ? "rgba(37,99,235,.1)" : "var(--bg-main)", color: allClusters ? "#2563eb" : "var(--text-sub)", fontSize: "12px", fontWeight: 650 }}
                          >
                            {allClusters ? "Clear all" : `Select all (${schedulableClusters.length})`}
                          </button>
                        ) : (
                          <span className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--bg-main)", color: "var(--text-sub)", fontSize: "11px", fontWeight: 650 }}>
                            Choose up to {MAX_AUTO_SCHEDULE_CLUSTERS}
                          </span>
                        )}
                      </div>
                      <div className="relative mb-3">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                        <input value={clusterSearch} onChange={(event) => setClusterSearch(event.target.value)} placeholder="Search cinema or city…"
                          className="w-full rounded-xl border py-2 pl-8 pr-3 outline-none"
                          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }} />
                      </div>
                      <div className="nice-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-2" style={{ scrollbarGutter: "stable" }}>
                        {visibleClusters.map((cluster) => {
                          const eligibility = clusterEligibility.get(cluster.clusterId);
                          const schedulable = eligibility?.schedulable === true;
                          const selected = schedulable && (allClusters || selectedClusterIds.has(cluster.clusterId));
                          const selectionLimitReached = !selected && effectiveClusterIds.length >= MAX_AUTO_SCHEDULE_CLUSTERS;
                          const eligibleRoomCount = eligibility?.eligibleRoomCount ?? 0;
                          const totalRoomCount = eligibility?.totalRoomCount ?? 0;
                          const partiallyEligible = schedulable && totalRoomCount > 0 && eligibleRoomCount < totalRoomCount;
                          return (
                            <label
                              key={cluster.clusterId}
                              className={`relative flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${schedulable && !allClusters && !selectionLimitReached ? "cursor-pointer" : "cursor-not-allowed"}`}
                              style={{ borderColor: selected ? "rgba(37,99,235,.55)" : !schedulable ? "rgba(245,158,11,.28)" : "var(--border-color)", background: selected ? "rgba(37,99,235,.07)" : !schedulable ? "rgba(245,158,11,.045)" : "var(--bg-main)", opacity: !schedulable ? 0.72 : allClusters ? 0.88 : 1 }}
                            >
                              <input className="sr-only" type="checkbox" disabled={allClusters || !schedulable || selectionLimitReached} checked={selected} onChange={() => toggleCluster(cluster.clusterId)} />
                              <div className="h-12 w-14 flex-shrink-0 overflow-hidden rounded-lg" style={{ background: "rgba(37,99,235,.08)" }}>
                                {cluster.coverImageUrl
                                  ? <img src={cluster.coverImageUrl} alt="" className="h-full w-full object-cover" />
                                  : <div className="flex h-full items-center justify-center text-blue-600"><Building2 size={18} /></div>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate" style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 700 }}>{cluster.clusterName}</p>
                                <p className="mt-0.5 flex items-center gap-1 truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}><MapPin size={11} /> {cluster.province || cluster.address}</p>
                                {schedulable ? (
                                  <p className="mt-1" style={{ color: partiallyEligible ? "#d97706" : "#059669", fontSize: "11.5px", fontWeight: 650 }}>
                                    {partiallyEligible ? `${eligibleRoomCount}/${totalRoomCount} rooms ready` : `${totalRoomCount} rooms`} · {(cluster.totalSeats ?? 0).toLocaleString()} seats
                                  </p>
                                ) : (
                                  <p className="mt-1 line-clamp-2" style={{ color: "#d97706", fontSize: "11.5px", fontWeight: 600 }}>
                                    Unavailable · {eligibility?.reason ?? "Room eligibility could not be verified."}
                                  </p>
                                )}
                              </div>
                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? "#2563eb" : !schedulable ? "#d97706" : "var(--border-color)", background: selected ? "#2563eb" : "transparent", color: selected ? "white" : "#d97706" }}>
                                {selected ? <Check size={12} /> : !schedulable ? <XCircle size={11} /> : null}
                              </span>
                            </label>
                          );
                        })}
                        {visibleClusters.length === 0 && <p className="py-8 text-center" style={{ fontSize: "13px", color: "var(--text-sub)" }}>No matching active cinema.</p>}
                      </div>
                    </section>
                  </div>

                  <section className="flex h-[650px] min-h-0 min-w-0 flex-col rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2"><Film size={16} className="text-blue-600" /><p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-main)" }}>Movie catalog</p></div>
                        <p className="mt-1" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                          Approved titles · {selectedMovieIds.size}/{MAX_AUTO_SCHEDULE_MOVIES} selected · eligibility revalidated on submit
                        </p>
                      </div>
                      {selectedMovieIds.size > 0 && <button type="button" onClick={() => { setSelectedMovieIds(new Set()); setScreeningVersionOverrides(new Map()); }} className="text-xs font-semibold text-blue-600">Clear selection</button>}
                    </div>
                    <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                        <input value={movieSearch} onChange={(event) => setMovieSearch(event.target.value)} placeholder="Search title or genre…"
                          className="w-full rounded-xl border py-2.5 pl-9 pr-3 outline-none"
                          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }} />
                      </div>
                      <select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} className="rounded-xl border px-3 py-2.5 outline-none"
                        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}>
                        <option value="">All genres</option>
                        {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                      </select>
                    </div>

                    <div className="nice-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2" style={{ scrollbarGutter: "stable" }}>
                      <div className="space-y-2">
                        {visibleMovies.map((movie) => {
                          const scopeChosen = effectiveClusterIds.length > 0;
                          const availabilityCheck = movieAvailabilityEligibility.get(movie.movieId);
                          const eligible = !scopeChosen || availabilityCheck?.eligible !== false;
                          const selected = eligible && selectedMovieIds.has(movie.movieId);
                          const withinSelectionLimit = selected || selectedMovieIds.size < MAX_AUTO_SCHEDULE_MOVIES;
                          const selectable = eligible && withinSelectionLimit;
                          return (
                            <MovieCatalogAccordionItem
                              key={movie.movieId}
                              movie={movie}
                              eligible={selectable}
                              reason={withinSelectionLimit ? availabilityCheck?.reason : `Select up to ${MAX_AUTO_SCHEDULE_MOVIES} movies per run.`}
                              selected={selected}
                              expanded={expandedMovieIds.has(movie.movieId)}
                              versions={screeningVersionsByMovie.get(movie.movieId) ?? []}
                              scopeRoomCount={selectedScopeRoomCount}
                              overrideIds={screeningVersionOverrides.get(movie.movieId)}
                              onToggleSelected={() => { if (selectable) toggleMovie(movie.movieId); }}
                              onToggleExpanded={() => setExpandedMovieIds((current) => {
                                const next = new Set(current);
                                next.has(movie.movieId) ? next.delete(movie.movieId) : next.add(movie.movieId);
                                return next;
                              })}
                              onUseAuto={() => {
                                if (!selectable) return;
                                setSelectedMovieIds((current) => new Set(current).add(movie.movieId));
                                setScreeningVersionOverrides((current) => {
                                  const next = new Map(current);
                                  next.delete(movie.movieId);
                                  return next;
                                });
                              }}
                              onToggleVersion={(versionId) => {
                                if (!selectable) return;
                                setSelectedMovieIds((current) => new Set(current).add(movie.movieId));
                                setScreeningVersionOverrides((current) => {
                                  const next = new Map(current);
                                  const ids = new Set(next.get(movie.movieId) ?? []);
                                  ids.has(versionId) ? ids.delete(versionId) : ids.add(versionId);
                                  ids.size ? next.set(movie.movieId, ids) : next.delete(movie.movieId);
                                  return next;
                                });
                              }}
                            />
                          );
                        })}
                        {visibleMovies.length === 0 && <div className="py-16 text-center"><Film size={24} className="mx-auto mb-2" style={{ color: "var(--text-sub)" }} /><p style={{ fontSize: "13px", color: "var(--text-sub)" }}>No matching approved movie.</p></div>}
                      </div>
                      <div className="hidden">
                        {visibleMovies.map((movie) => {
                          const scopeChosen = effectiveClusterIds.length > 0;
                          const availabilityCheck = movieAvailabilityEligibility.get(movie.movieId);
                          const eligible = !scopeChosen || availabilityCheck?.eligible !== false;
                          const selected = eligible && selectedMovieIds.has(movie.movieId);
                          const title = movie.movieNameEnglish || movie.movieNameVn;
                          const alternateTitle = movie.movieNameVn && movie.movieNameVn !== title ? movie.movieNameVn : "";
                          return (
                            <article
                              key={movie.movieId}
                              role="checkbox"
                              aria-checked={selected}
                              tabIndex={eligible ? 0 : -1}
                              onClick={() => { if (eligible) toggleMovie(movie.movieId); }}
                              onKeyDown={(event) => {
                                if (eligible && (event.key === "Enter" || event.key === " ")) {
                                  event.preventDefault();
                                  toggleMovie(movie.movieId);
                                }
                              }}
                              className={`group relative flex h-full gap-2.5 overflow-hidden rounded-xl border p-2.5 transition-all ${eligible ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-not-allowed"}`}
                              style={{
                                borderColor: selected ? "rgba(37,99,235,.7)" : !eligible ? "rgba(245,158,11,.28)" : "var(--border-color)",
                                background: selected ? "rgba(37,99,235,.08)" : !eligible ? "rgba(245,158,11,.045)" : "var(--bg-main)",
                                opacity: !eligible ? 0.72 : 1,
                              }}
                            >
                              <div className="h-full w-16 flex-shrink-0 overflow-hidden rounded-lg" style={{ background: "rgba(124,58,237,.08)" }}>
                                {movie.smallImage || movie.largeImage
                                  ? <img src={movie.smallImage || movie.largeImage} alt={`${title} poster`} className="h-full w-full object-cover" />
                                  : <div className="flex h-full items-center justify-center text-purple-500"><Film size={22} /></div>}
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden py-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate" title={title} style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 750, lineHeight: 1.3 }}>{title}</p>
                                    {alternateTitle && <p className="mt-0.5 truncate" style={{ color: "var(--text-sub)", fontSize: "11.5px" }}>{alternateTitle}</p>}
                                  </div>
                                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? "#2563eb" : !eligible ? "#d97706" : "var(--border-color)", background: selected ? "#2563eb" : "transparent", color: selected ? "white" : "#d97706" }}>
                                    {selected ? <Check size={12} /> : !eligible ? <XCircle size={11} /> : null}
                                  </span>
                                </div>
                                {!eligible ? (
                                  <p className="mt-1.5 line-clamp-2" style={{ color: "#d97706", fontSize: "10.5px", fontWeight: 600 }} title={availabilityCheck?.reason}>
                                    Unavailable · {availabilityCheck?.reason}
                                  </p>
                                ) : (
                                  <div className="mt-1.5 flex flex-nowrap gap-1 overflow-hidden">
                                    {movie.ageRatingCode && <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-rose-500">{movie.ageRatingCode}</span>}
                                    <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "rgba(37,99,235,.09)", color: "#2563eb" }}>{movie.duration || "—"} min</span>
                                    {movie.version && <span className="max-w-28 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "rgba(5,150,105,.09)", color: "#059669" }}>{movie.version}</span>}
                                  </div>
                                )}
                                <p className="mt-1.5 truncate" style={{ color: "var(--text-sub)", fontSize: "10.5px" }}>{movie.releaseDate || "Release date not set"}{movie.country ? ` · ${movie.country}` : ""}</p>
                                <div className="mt-1.5 flex flex-nowrap gap-1 overflow-hidden">
                                  {movie.movieType.slice(0, 2).map((genre) => <span key={genre} className="max-w-24 flex-shrink-0 truncate rounded-md border px-1.5 py-0.5" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", fontSize: "10px" }}>{genre}</span>)}
                                </div>
                                {selected && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={(event) => event.stopPropagation()}
                                        className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left"
                                        style={{
                                          borderColor: screeningVersionOverrides.get(movie.movieId)?.size ? "rgba(37,99,235,.45)" : "var(--border-color)",
                                          background: "var(--bg-card)",
                                          color: "var(--text-main)",
                                        }}
                                      >
                                        <span className="min-w-0 truncate text-[10.5px] font-bold">
                                          {screeningVersionOverrides.get(movie.movieId)?.size
                                            ? `Custom · ${screeningVersionOverrides.get(movie.movieId)?.size} version${screeningVersionOverrides.get(movie.movieId)?.size === 1 ? "" : "s"}`
                                            : `Auto · ${(screeningVersionsByMovie.get(movie.movieId) ?? []).length} version${(screeningVersionsByMovie.get(movie.movieId) ?? []).length === 1 ? "" : "s"}`}
                                        </span>
                                        <ChevronDown size={12} className="shrink-0 text-blue-600" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-[330px] max-w-[calc(100vw-2rem)] p-2"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <DropdownMenuLabel className="px-2 py-2">
                                        <span className="block text-xs font-bold">Screening versions</span>
                                        <span className="mt-0.5 block text-[10.5px] font-normal" style={{ color: "var(--text-sub)" }}>Compatibility is scoped to the selected cinemas.</span>
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem
                                        onSelect={() => setScreeningVersionOverrides((current) => {
                                          const next = new Map(current);
                                          next.delete(movie.movieId);
                                          return next;
                                        })}
                                        className="justify-between"
                                      >
                                        <span><span className="block text-xs font-semibold">Auto (recommended)</span><span className="block text-[10px]" style={{ color: "var(--text-sub)" }}>Use every compatible active version</span></span>
                                        {!screeningVersionOverrides.get(movie.movieId)?.size && <Check size={14} className="text-blue-600" />}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="px-2 py-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Or select specific versions</DropdownMenuLabel>
                                      {(screeningVersionsByMovie.get(movie.movieId) ?? []).map((version) => (
                                        <DropdownMenuCheckboxItem
                                          key={version.screeningVersionId}
                                          checked={screeningVersionOverrides.get(movie.movieId)?.has(version.screeningVersionId) ?? false}
                                          onSelect={(event) => event.preventDefault()}
                                          onCheckedChange={(checked) => setScreeningVersionOverrides((current) => {
                                            const next = new Map(current);
                                            const ids = new Set(next.get(movie.movieId) ?? []);
                                            checked ? ids.add(version.screeningVersionId) : ids.delete(version.screeningVersionId);
                                            ids.size ? next.set(movie.movieId, ids) : next.delete(movie.movieId);
                                            return next;
                                          })}
                                          className="rounded-lg py-2 pl-8 pr-2"
                                        >
                                          <span className="min-w-0">
                                            <span className="block truncate text-xs font-semibold">{version.formatName} · {version.audioLanguageCode}{version.subtitleLanguageCode ? ` / ${version.subtitleLanguageCode} sub` : ""}</span>
                                            <span className="mt-0.5 block text-[10px]" style={{ color: "var(--text-sub)" }}>{version.compatibleRoomCount} compatible room{version.compatibleRoomCount === 1 ? "" : "s"} in selected cinemas</span>
                                          </span>
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                      {(screeningVersionsByMovie.get(movie.movieId) ?? []).length === 0 && (
                                        <p className="px-2 py-4 text-center text-xs" style={{ color: "var(--text-sub)" }}>No active version is compatible with this cinema scope.</p>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </article>
                          );
                        })}
                        {visibleMovies.length === 0 && <div className="col-span-full py-16 text-center"><Film size={24} className="mx-auto mb-2" style={{ color: "var(--text-sub)" }} /><p style={{ fontSize: "13px", color: "var(--text-sub)" }}>No matching approved movie.</p></div>}
                      </div>
                    </div>
                  </section>
                </div>

                {excludableRooms.length > 0 && (
                  <section className="rounded-2xl border px-4 py-3.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
                          <DoorClosed size={17} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Room exceptions</p>
                            {excludedRoomIds.size > 0 && (
                              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-bold text-rose-500">
                                {excludedRoomIds.size} excluded
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-sub)" }}>
                            {excludedRoomIds.size === 0
                              ? `All ${excludableRooms.length} eligible rooms can be used.`
                              : `Applied to the entire ${formatPlanningDate(startDate)}–${formatPlanningDate(endDate)} planning window.`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {excludedRoomIds.size > 0 && (
                          <button type="button" onClick={() => setExcludedRoomIds(new Set())} className="rounded-lg px-3 py-2 text-xs font-semibold text-blue-600">
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRoomExceptionsOpen(true)}
                          className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold"
                          style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}
                        >
                          <Settings2 size={14} /> Configure
                        </button>
                      </div>
                    </div>
                    {excludedRoomIds.size > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                        {excludableRooms.filter((room) => excludedRoomIds.has(room.cinemaRoomId)).slice(0, 4).map((room) => (
                          <span key={room.cinemaRoomId} className="rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500">
                            {room.cinemaRoomName} · {room.clusterName}
                          </span>
                        ))}
                        {excludedRoomIds.size > 4 && (
                          <span className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: "var(--bg-main)", color: "var(--text-sub)" }}>
                            +{excludedRoomIds.size - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </section>
                )}

                <RoomExceptionsDialog
                  open={roomExceptionsOpen}
                  onOpenChange={setRoomExceptionsOpen}
                  rooms={excludableRooms}
                  appliedRoomIds={excludedRoomIds}
                  startDate={startDate}
                  endDate={endDate}
                  onApply={setExcludedRoomIds}
                />
              </div>

              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                <div className="flex min-w-0 items-center gap-3.5">
                  {selectedMovieIds.size > 0 && (
                    <div className="flex -space-x-2">
                      {Array.from(selectedMovieIds).slice(0, 4).map((movieId) => {
                        const movie = movieById.get(movieId);
                        return (
                          <div key={movieId} title={movie?.movieNameEnglish || movie?.movieNameVn} className="h-9 w-7 overflow-hidden rounded-md border-2" style={{ borderColor: "var(--bg-card)", background: "rgba(124,58,237,.12)" }}>
                            {movie?.smallImage || movie?.largeImage
                              ? <img src={movie.smallImage || movie.largeImage} alt="" className="h-full w-full object-cover" />
                              : <div className="flex h-full items-center justify-center text-purple-500"><Film size={11} /></div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p style={{ color: "var(--text-sub)", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Selection summary</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1.5" style={{ color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                        <Building2 size={12} className="text-blue-600" />{effectiveClusterIds.length} cinema{effectiveClusterIds.length === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1.5" style={{ color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                        <Film size={12} className="text-blue-600" />{selectedMovieIds.size} movie{selectedMovieIds.size === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1.5" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
                        <Calendar size={12} />{startDate} → {endDate}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="hidden items-center gap-1.5 sm:flex" style={{ color: canProceedFromScope ? "#059669" : "#d97706", fontSize: "11.5px", fontWeight: 650 }}>
                    {canProceedFromScope ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {canProceedFromScope ? "Ready to review" : "Complete the required selection"}
                  </span>
                  <button type="button" disabled={!canProceedFromScope} onClick={() => setStep("review")}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                    Review generation scope <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <div className="w-full space-y-4">
          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <p style={{ fontSize: "15px", fontWeight: 750, color: "var(--text-main)" }}>Confirm generation scope</p>
                <p className="mt-0.5" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Review the operating window and selected content before the eligibility check.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                  <Calendar size={12} className="mr-1.5 inline" />{startDate} → {endDate}
                </span>
                <span className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                  {effectiveClusterIds.length} cinema{effectiveClusterIds.length === 1 ? "" : "s"} · {selectedMovieIds.size} movie{selectedMovieIds.size === 1 ? "" : "s"}
                </span>
              </div>
            </header>

            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(290px,0.72fr)_minmax(0,1.8fr)] xl:p-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-blue-600" />
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: ".04em" }}>Cinema scope</p>
                </div>
                {effectiveClusterIds.map((id) => {
                  const cluster = clusterById.get(id);
                  return (
                    <div key={id} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                      <div className="h-10 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-blue-500/10">
                        {cluster?.coverImageUrl
                          ? <img src={cluster.coverImageUrl} alt="" className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center text-blue-600"><Building2 size={16} /></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 700 }}>{cluster?.clusterName ?? `Cinema #${id}`}</p>
                        <p className="mt-0.5 truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}>{cluster?.province || cluster?.address || "Eligible cinema"}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(37,99,235,.2)", background: "rgba(37,99,235,.05)" }}>
                  <Info size={13} className="mt-0.5 flex-shrink-0 text-blue-600" />
                  <p style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--text-sub)" }}>
                    Active default policy controls demand weights, peak hours and minimum coverage.
                  </p>
                </div>

                {excludedRoomIds.size > 0 && (
                  <div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(225,29,72,.28)", background: "rgba(225,29,72,.045)" }}>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <XCircle size={12} className="text-rose-500" />
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "#e11d48", textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {excludedRoomIds.size} room{excludedRoomIds.size === 1 ? "" : "s"} excluded from this run
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {excludableRooms.filter((room) => excludedRoomIds.has(room.cinemaRoomId)).map((room) => (
                        <span key={room.cinemaRoomId} className="rounded-md bg-rose-500/10 px-2 py-1" style={{ fontSize: "10.5px", color: "#e11d48", fontWeight: 650 }}>
                          {room.cinemaRoomName}{room.clusterName ? ` · ${room.clusterName}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <Film size={14} className="text-purple-600" />
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: ".04em" }}>Selected movies</p>
                </div>
                <div className="space-y-3">
                  {Array.from(selectedMovieIds).map((id) => {
                    const movie = movieById.get(id);
                    const title = movie?.movieNameEnglish ?? movie?.movieNameVn ?? `Movie #${id}`;
                    const secondaryTitle = movie?.movieNameVn && movie.movieNameVn !== title ? movie.movieNameVn : null;
                    const isIneligible = ineligibleMovies.some((item) => item.movieId === id);
                    return (
                      <article key={id} className="flex min-w-0 gap-3.5 rounded-2xl border p-3.5" style={{ borderColor: isIneligible ? "rgba(225,29,72,.4)" : "var(--border-color)", background: isIneligible ? "rgba(225,29,72,.055)" : "var(--bg-main)" }}>
                        <div className="h-[118px] w-20 flex-shrink-0 overflow-hidden rounded-xl bg-purple-500/10 shadow-sm">
                          {movie?.smallImage || movie?.largeImage
                            ? <img src={movie.smallImage || movie.largeImage} alt={`${title} poster`} className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center text-purple-500"><Film size={22} /></div>}
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate" title={title} style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 750 }}>{title}</p>
                              {secondaryTitle && <p className="mt-0.5 truncate" title={secondaryTitle} style={{ color: "var(--text-sub)", fontSize: "12px" }}>{secondaryTitle}</p>}
                            </div>
                            <span className="inline-flex flex-shrink-0 rounded-md px-2 py-1" style={{ background: isIneligible ? "rgba(225,29,72,.12)" : "rgba(37,99,235,.10)", color: isIneligible ? "#e11d48" : "#2563eb", fontSize: "10.5px", fontWeight: 750 }}>
                              {isIneligible ? "Prerequisites missing" : "Ready for validation"}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "11.5px", fontWeight: 650 }}>{movie?.duration || "—"} min</span>
                            {movie?.ageRatingCode && <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "11.5px", fontWeight: 650 }}>{movie.ageRatingCode}</span>}
                            {movie?.version && <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "11.5px", fontWeight: 650 }}>{movie.version}</span>}
                            {(movie?.movieType ?? []).slice(0, 3).map((genre) => <span key={genre} className="rounded-md bg-purple-500/10 px-2 py-1 text-purple-600" style={{ fontSize: "11.5px", fontWeight: 650 }}>{genre}</span>)}
                          </div>

                          <div className="mt-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Screening versions</p>
                              <span className="rounded-md bg-blue-600/10 px-2 py-1 text-[10.5px] font-bold text-blue-600">
                                {screeningVersionOverrides.get(id)?.size ? `Custom · ${screeningVersionOverrides.get(id)?.size}` : "Auto"}
                              </span>
                            </div>
                            {screeningVersionOverrides.get(id)?.size ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(screeningVersionsByMovie.get(id) ?? [])
                                  .filter((version) => screeningVersionOverrides.get(id)?.has(version.screeningVersionId))
                                  .map((version) => (
                                    <span key={version.screeningVersionId} className="rounded-md border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                                      {version.formatCode} · {version.audioLanguageCode}{version.subtitleLanguageCode ? ` / ${version.subtitleLanguageCode} sub` : ""}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-sub)" }}>The scheduler will choose every compatible active version effective on each date.</p>
                            )}
                          </div>

                          <div className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                            <p className="truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}><span style={{ fontWeight: 650 }}>Release:</span> {movie?.releaseDate || "Not scheduled"}</p>
                            <p className="truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}><span style={{ fontWeight: 650 }}>Country:</span> {movie?.country || "Not supplied"}</p>
                            <p className="truncate" title={movie?.director} style={{ color: "var(--text-sub)", fontSize: "12px" }}><span style={{ fontWeight: 650 }}>Director:</span> {movie?.director || "Not supplied"}</p>
                          </div>
                          {movie?.movieProductionCompany && (
                            <p className="mt-1.5 truncate" title={movie.movieProductionCompany} style={{ color: "var(--text-sub)", fontSize: "12px" }}>
                              <span style={{ fontWeight: 650 }}>Production:</span> {movie.movieProductionCompany}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <header className="border-b px-4 py-3.5" style={{ borderColor: "var(--border-color)" }}>
              <p style={{ fontSize: "15px", fontWeight: 750, color: "var(--text-main)" }}>Scheduling engine</p>
              <p className="mt-0.5" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Choose which algorithm allocates showtimes for this run.</p>
            </header>
            <div className="space-y-3.5 p-4">
              <div className="grid gap-2.5 sm:grid-cols-3">
                {(Object.keys(OPTIMIZER_META) as OptimizerMode[]).map((mode) => {
                  const selected = optimizerMode === mode;
                  return (
                    <button key={mode} type="button" onClick={() => setOptimizerMode(mode)}
                      className="rounded-xl border p-3 text-left transition-colors"
                      style={{ borderColor: selected ? "rgba(37,99,235,.6)" : "var(--border-color)", background: selected ? "rgba(37,99,235,.08)" : "var(--bg-main)" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: selected ? "#2563eb" : "var(--text-main)" }}>{OPTIMIZER_META[mode].label}</p>
                      <p className="mt-1" style={{ fontSize: "11px", lineHeight: 1.45, color: "var(--text-sub)" }}>{OPTIMIZER_META[mode].description}</p>
                    </button>
                  );
                })}
              </div>

              {optimizerMode !== "LEGACY" && (
                <div>
                  <p className="mb-1.5" style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: ".04em" }}>Scenario</p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {(Object.keys(SCENARIO_META) as OptimizationScenario[]).map((option) => {
                      const selected = scenario === option;
                      return (
                        <button key={option} type="button" onClick={() => setScenario(option)}
                          className="rounded-xl border p-3 text-left transition-colors"
                          style={{ borderColor: selected ? "rgba(124,58,237,.6)" : "var(--border-color)", background: selected ? "rgba(124,58,237,.08)" : "var(--bg-main)" }}>
                          <p style={{ fontSize: "12.5px", fontWeight: 700, color: selected ? "#7c3aed" : "var(--text-main)" }}>{SCENARIO_META[option].label}</p>
                          <p className="mt-1" style={{ fontSize: "11px", lineHeight: 1.45, color: "var(--text-sub)" }}>{SCENARIO_META[option].description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {optimizerMode === "CP_SAT" && (
                <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(217,119,6,.25)", background: "rgba(217,119,6,.06)" }}>
                  <Info size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
                  <p style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--text-sub)" }}>
                    If the solver can't produce a usable schedule in time, this run automatically falls back to the Legacy algorithm (configurable per policy).
                  </p>
                </div>
              )}
            </div>
          </section>

          {submitError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5 text-rose-600">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p style={{ fontSize: "12.5px", fontWeight: 700 }}>Scheduling prerequisites are incomplete</p>
                    <p className="mt-0.5" style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>{submitError}</p>
                    <p className="mt-1" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>Check availability, classification, theatrical rights, screening version, room capability and operating hours for the selected dates.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setStep("scope")} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10">
                  Fix selection
                </button>
              </div>
              {ineligibleMovies.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {ineligibleMovies.map((m) => (
                    <li key={m.movieId} className="rounded-md bg-rose-500/10 px-2 py-1" style={{ fontSize: "10.5px", color: "#e11d48", fontWeight: 650 }}>{m.originalTitle} · #{m.movieId}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <button type="button" onClick={() => setStep("scope")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold hover:opacity-75"
              style={{ color: "var(--text-sub)" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="button" disabled={submitting || Boolean(submitError)} onClick={handleSubmit}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <>Submit run <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Running ── */}
      {step === "running" && run && (
        <div className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-2xl border p-5 text-left" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="row-span-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: STATUS_META[run.status].background, color: STATUS_META[run.status].color }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
            Run #{run.generationRunId} — {STATUS_META[run.status].label}
          </h3>
          <p className="mt-1" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
            {run.status === "ACCEPTED"
              ? "Run accepted. A worker has been notified and will start automatically."
              : "Scoring candidates and building a reviewable draft schedule…"}
          </p>
          {runningSince && (() => {
            const elapsedSeconds = Math.max(0, Math.round((Date.now() - runningSince) / 1000));
            const isTakingUnusuallyLong = elapsedSeconds > STUCK_RUN_WARNING_SECONDS;
            return (
              <>
                <p className="mt-1" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                   Elapsed {elapsedSeconds}s · You may leave this page while processing continues.
                </p>
                {isTakingUnusuallyLong && (
                  <div className="col-span-2 mt-2 flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(217,119,6,.3)", background: "rgba(217,119,6,.08)" }}>
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
                    <p style={{ fontSize: "11.5px", lineHeight: 1.5, color: "var(--text-sub)" }}>
                      This is taking longer than usual — it may have failed silently (e.g. a server restart interrupted it). Try refreshing this page; if it's still stuck after a few minutes, start a new run instead of waiting indefinitely.
                    </p>
                  </div>
                )}
              </>
            );
          })()}
          {canProcessNow && run.status === "ACCEPTED" && (
            <details className="group relative col-span-2 ml-auto mt-2 w-fit text-left">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", background: "var(--bg-main)" }}>
                <MoreHorizontal size={14} /> Advanced actions
              </summary>
              <div className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-xl border p-2 shadow-xl" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                <button type="button" disabled={processingNow} onClick={handleProcessNow} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-500/10 disabled:opacity-50">
                  {processingNow ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Process now
                </button>
                <p className="px-3 pb-2 pt-1 text-[10px] leading-4" style={{ color: "var(--text-sub)" }}>Recovery action for development, demo, or SUPER_ADMIN operations.</p>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Completed runs leave the creation wizard and become an operations review workspace. */}
      {step === "results" && run && (
        <AutoScheduleResultsWorkspace
          run={run}
          plan={plan}
          busy={planBusy}
          error={planError}
          onNewRun={resetWizard}
          onRevalidate={revalidatePlan}
          onTransition={transitionPlan}
        />
      )}
    </div>
  );
}
