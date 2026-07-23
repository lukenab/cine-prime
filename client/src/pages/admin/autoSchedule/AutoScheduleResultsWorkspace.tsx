import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Film,
  Filter,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

import type {
  AutoShowtimeGenerationRunResponse,
  SchedulePlanResponse,
  SchedulePlanSlot,
} from "../../../api/showtimeApi";

type PlanAction = "submit" | "changes" | "publish";
type ScheduleView = "board" | "timeline";
type ContextDrawer = "issues" | "allocation";

type Props = {
  run: AutoShowtimeGenerationRunResponse;
  plan: SchedulePlanResponse | null;
  busy: boolean;
  error: string | null;
  onNewRun: () => void;
  onTransition: (action: PlanAction, note?: string) => Promise<void>;
};

type Conflict = {
  key: string;
  date: string;
  clusterName: string;
  roomName: string;
  first: SchedulePlanSlot;
  second: SchedulePlanSlot;
};

type ValidationIssue = {
  code: string;
  title: string;
  description: string;
  recommendation: string;
  raw: string;
};

const MOVIE_COLORS = [
  { fill: "rgba(37,99,235,.15)", border: "rgba(59,130,246,.55)", text: "#3b82f6" },
  { fill: "rgba(124,58,237,.15)", border: "rgba(139,92,246,.55)", text: "#8b5cf6" },
  { fill: "rgba(8,145,178,.15)", border: "rgba(6,182,212,.55)", text: "#06b6d4" },
  { fill: "rgba(5,150,105,.15)", border: "rgba(16,185,129,.55)", text: "#10b981" },
  { fill: "rgba(217,119,6,.15)", border: "rgba(245,158,11,.55)", text: "#f59e0b" },
  { fill: "rgba(219,39,119,.15)", border: "rgba(236,72,153,.55)", text: "#ec4899" },
];

const DEMAND_COLOR: Record<string, string> = {
  HIGH: "#dc2626",
  NORMAL: "#2563eb",
  LOW: "#64748b",
};

function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  return Number.isNaN(value.getTime())
    ? date
    : value.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatCompactDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  return Number.isNaN(value.getTime())
    ? date
    : value.toLocaleDateString([], { weekday: "short", day: "numeric" });
}

function formatTime(value: string) {
  // startAt/endAt are offset-aware business timestamps. Keep the wall-clock
  // value carried by the API instead of converting it to the reviewer's
  // browser timezone (which may differ from the cinema's timezone).
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" });
}

function clockMinute(value: string) {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const [hour = 0, minute = 0] = value.slice(11, 16).split(":").map(Number);
    return hour * 60 + minute;
  }
  return date.getHours() * 60 + date.getMinutes();
}

function durationMinutes(slot: SchedulePlanSlot) {
  const start = new Date(slot.startAt).getTime();
  const end = new Date(slot.endAt).getTime();
  if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) return Math.round((end - start) / 60000);
  const startMinute = clockMinute(slot.startAt);
  const endMinute = clockMinute(slot.endAt);
  return endMinute > startMinute ? endMinute - startMinute : endMinute + 1440 - startMinute;
}

function gapMinutes(current: SchedulePlanSlot, next: SchedulePlanSlot) {
  const currentEnd = new Date(current.endAt).getTime();
  const nextStart = new Date(next.startAt).getTime();
  if (Number.isNaN(currentEnd) || Number.isNaN(nextStart)) return null;
  return Math.round((nextStart - currentEnd) / 60000);
}

function formatScore(value?: number) {
  return value == null ? "—" : value.toFixed(2);
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function slotExplanation(slot: SchedulePlanSlot) {
  const score = slot.scoreBreakdown;
  const lines = [
    slot.movieTitle,
    `${formatTime(slot.startAt)}–${formatTime(slot.endAt)} · ${slot.formatCode}`,
  ];
  if (score) {
    lines.push(
      `Forecast: ${score.expectedAttendance ?? "—"}/${score.roomCapacity ?? slot.totalSeats ?? "—"} seats`,
      `Daypart: ${score.daypart ?? "—"} · capacity fit ${formatScore(score.capacityFitScore)}`,
      `Allocation score: ${formatScore(score.allocationScore)}`,
    );
  }
  return lines.join("\n");
}

function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (!Number.isNaN(cursor.getTime()) && cursor <= last && dates.length < 62) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function movieColor(movieId: number) {
  return MOVIE_COLORS[Math.abs(movieId) % MOVIE_COLORS.length];
}

function MoviePoster({ src, title, color, background }: { src?: string; title: string; color: string; background: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <span
      className="flex h-24 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm"
      style={{ borderColor: "var(--border-color)", color, background }}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={`${title} poster`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Film size={22} aria-hidden="true" />
      )}
    </span>
  );
}

function planStatusMeta(status?: SchedulePlanResponse["status"]) {
  if (status === "PUBLISHED") return { label: "Published", color: "#059669", background: "rgba(5,150,105,.12)" };
  if (status === "IN_REVIEW") return { label: "In review", color: "#2563eb", background: "rgba(37,99,235,.12)" };
  if (status === "CHANGES_REQUESTED") return { label: "Changes requested", color: "#d97706", background: "rgba(217,119,6,.12)" };
  return { label: "Draft", color: "#64748b", background: "rgba(100,116,139,.12)" };
}

function findConflicts(slots: SchedulePlanSlot[]): Conflict[] {
  const byRoomDate = new Map<string, SchedulePlanSlot[]>();
  for (const slot of slots) {
    const key = `${slot.businessDate}|${slot.clusterId}|${slot.cinemaRoomId}`;
    const items = byRoomDate.get(key) ?? [];
    items.push(slot);
    byRoomDate.set(key, items);
  }
  const conflicts: Conflict[] = [];
  for (const items of byRoomDate.values()) {
    items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];
      if (new Date(current.startAt).getTime() < new Date(previous.endAt).getTime()) {
        conflicts.push({
          key: `${previous.schedulePlanSlotId}-${current.schedulePlanSlotId}`,
          date: current.businessDate,
          clusterName: current.clusterName,
          roomName: current.cinemaRoomName,
          first: previous,
          second: current,
        });
      }
    }
  }
  return conflicts;
}

function buildValidationIssues(summary: string | undefined, slots: SchedulePlanSlot[]): ValidationIssue[] {
  if (!summary?.trim()) return [];

  return summary
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((raw) => {
      const concurrentRoomShare = raw.match(
        /^MAXIMUM_CONCURRENT_ROOM_SHARE:\s*movie=(\d+)\s+cluster=(\d+)\s+date=(\d{4}-\d{2}-\d{2})\s+max=(\d+)\s+actual=(\d+)$/i,
      );
      if (concurrentRoomShare) {
        const [, movieId, clusterId, date, maximum, actual] = concurrentRoomShare;
        const matchingSlot = slots.find((slot) => slot.movieId === Number(movieId) && slot.clusterId === Number(clusterId));
        const movieName = matchingSlot?.movieTitle ?? `Movie #${movieId}`;
        const cinemaName = matchingSlot?.clusterName ?? `Cinema #${clusterId}`;
        const excess = Math.max(1, Number(actual) - Number(maximum));
        return {
          code: "MAXIMUM_CONCURRENT_ROOM_SHARE",
          title: `Too many rooms assigned to ${movieName}`,
          description: `${movieName} is scheduled in ${actual} rooms at the same time at ${cinemaName} on ${formatDate(date)}. The configured limit is ${maximum}.`,
          recommendation: `Move or remove at least ${excess} overlapping session${excess === 1 ? "" : "s"} before publishing.`,
          raw,
        };
      }

      const codeMatch = raw.match(/^([A-Z][A-Z0-9_]+):/);
      return {
        code: codeMatch?.[1] ?? "SCHEDULE_VALIDATION",
        title: "The generated schedule requires review",
        description: "A backend scheduling rule was not satisfied. Review the affected scope before publishing this plan.",
        recommendation: "Open the technical details and adjust the affected sessions, then validate the plan again.",
        raw,
      };
    });
}

export default function AutoScheduleResultsWorkspace({ run, plan, busy, error, onNewRun, onTransition }: Props) {
  const slots = plan?.slots ?? [];
  const scopeDates = useMemo(() => enumerateDates(run.startDate, run.endDate), [run.endDate, run.startDate]);
  const availableDates = useMemo(() => Array.from(new Set([...scopeDates, ...slots.map((slot) => slot.businessDate)])).sort(), [scopeDates, slots]);
  const sessionCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    slots.forEach((slot) => counts.set(slot.businessDate, (counts.get(slot.businessDate) ?? 0) + 1));
    return counts;
  }, [slots]);
  const clusterOptions = useMemo(() => Array.from(new Map(slots.map((slot) => [slot.clusterId, slot.clusterName])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [slots]);
  const movieOptions = useMemo(() => Array.from(new Map(slots.map((slot) => [slot.movieId, slot.movieTitle])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [slots]);
  const formatOptions = useMemo(() => Array.from(new Set(slots.map((slot) => slot.formatCode))).sort(), [slots]);
  const conflicts = useMemo(() => findConflicts(slots), [slots]);
  const validationIssues = useMemo(() => buildValidationIssues(plan?.validationSummary, slots), [plan?.validationSummary, slots]);
  const conflictSlotIds = useMemo(() => new Set(conflicts.flatMap((item) => [item.first.schedulePlanSlotId, item.second.schedulePlanSlotId])), [conflicts]);

  const [selectedDate, setSelectedDate] = useState(availableDates[0] ?? run.startDate);
  const [clusterId, setClusterId] = useState("all");
  const [movieId, setMovieId] = useState("all");
  const [format, setFormat] = useState("all");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("board");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [contextDrawer, setContextDrawer] = useState<ContextDrawer | null>(null);
  const [expandedClusterIds, setExpandedClusterIds] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<PlanAction | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!availableDates.includes(selectedDate)) setSelectedDate(availableDates[0] ?? run.startDate);
  }, [availableDates, run.startDate, selectedDate]);

  useEffect(() => {
    if (clusterId !== "all" && !clusterOptions.some(([id]) => id === Number(clusterId))) setClusterId("all");
    if (movieId !== "all" && !movieOptions.some(([id]) => id === Number(movieId))) setMovieId("all");
    if (format !== "all" && !formatOptions.includes(format)) setFormat("all");
    if (conflicts.length === 0 && onlyIssues) setOnlyIssues(false);
  }, [clusterId, clusterOptions, conflicts.length, format, formatOptions, movieId, movieOptions, onlyIssues]);

  useEffect(() => {
    if (!contextDrawer) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextDrawer(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextDrawer]);

  const filteredDaySlots = useMemo(() => slots.filter((slot) =>
    slot.businessDate === selectedDate
    && (clusterId === "all" || slot.clusterId === Number(clusterId))
    && (movieId === "all" || slot.movieId === Number(movieId))
    && (format === "all" || slot.formatCode === format)
    && (!onlyIssues || conflictSlotIds.has(slot.schedulePlanSlotId))),
  [clusterId, conflictSlotIds, format, movieId, onlyIssues, selectedDate, slots]);

  const roomGroups = useMemo(() => {
    const groups = new Map<string, { key: string; clusterId: number; clusterName: string; roomName: string; slots: SchedulePlanSlot[] }>();
    for (const slot of filteredDaySlots) {
      const key = `${slot.clusterId}|${slot.cinemaRoomId}`;
      const group = groups.get(key) ?? { key, clusterId: slot.clusterId, clusterName: slot.clusterName, roomName: slot.cinemaRoomName, slots: [] };
      group.slots.push(slot);
      groups.set(key, group);
    }
    return Array.from(groups.values())
      .map((group) => ({ ...group, slots: group.slots.sort((a, b) => a.startAt.localeCompare(b.startAt)) }))
      .sort((a, b) => a.clusterName.localeCompare(b.clusterName) || a.roomName.localeCompare(b.roomName));
  }, [filteredDaySlots]);

  const boardClusters = useMemo(() => {
    const groups = new Map<number, { clusterId: number; clusterName: string; rooms: typeof roomGroups }>();
    for (const room of roomGroups) {
      const cluster = groups.get(room.clusterId) ?? {
        clusterId: room.clusterId,
        clusterName: room.clusterName,
        rooms: [],
      };
      cluster.rooms.push(room);
      groups.set(room.clusterId, cluster);
    }
    return Array.from(groups.values()).sort((a, b) => a.clusterName.localeCompare(b.clusterName));
  }, [roomGroups]);

  const conflictClusterIds = useMemo(
    () => new Set(conflicts.flatMap((conflict) => [conflict.first.clusterId, conflict.second.clusterId])),
    [conflicts],
  );

  useEffect(() => {
    setExpandedClusterIds((current) => {
      const visibleIds = new Set(boardClusters.map((cluster) => cluster.clusterId));
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));

      if (boardClusters.length === 1) {
        next.add(boardClusters[0].clusterId);
      } else {
        conflictClusterIds.forEach((id) => {
          if (visibleIds.has(id)) next.add(id);
        });
        if (next.size === 0 && boardClusters.length > 0) next.add(boardClusters[0].clusterId);
      }

      const unchanged = next.size === current.size && Array.from(next).every((id) => current.has(id));
      return unchanged ? current : next;
    });
  }, [boardClusters, conflictClusterIds]);

  const timeline = useMemo(() => {
    if (filteredDaySlots.length === 0) return { start: 8 * 60, end: 24 * 60 };
    const first = Math.min(...filteredDaySlots.map((slot) => clockMinute(slot.startAt)));
    const last = Math.max(...filteredDaySlots.map((slot) => clockMinute(slot.startAt) + durationMinutes(slot)));
    return {
      start: Math.min(8 * 60, Math.floor(first / 60) * 60),
      end: Math.max(24 * 60, Math.ceil(last / 60) * 60),
    };
  }, [filteredDaySlots]);

  const totalRooms = new Set(slots.map((slot) => `${slot.clusterId}|${slot.cinemaRoomId}`)).size;
  const backendBlockers = plan?.blockerCount ?? 0;
  const warningCount = (run.status === "PARTIALLY_COMPLETED" ? 1 : 0) + (run.summary.failedPartitionCount > 0 ? 1 : 0);
  const issueCount = backendBlockers + conflicts.length + warningCount;
  const planHealth = issueCount > 0
    ? {
        label: `${issueCount} ${issueCount === 1 ? "issue requires" : "issues require"} review`,
        color: "#dc2626",
        background: "rgba(220,38,38,.09)",
        border: "rgba(220,38,38,.25)",
      }
    : {
        label: "No scheduling conflicts",
        color: "#059669",
        background: "rgba(5,150,105,.09)",
        border: "rgba(5,150,105,.22)",
      };
  const status = run.status === "FAILED" && !plan
    ? { label: "Failed", color: "#dc2626", background: "rgba(220,38,38,.12)" }
    : planStatusMeta(plan?.status);
  const isPublished = plan?.status === "PUBLISHED";

  const movieRows = useMemo(() => run.movieResults.map((result) => {
    const movieSlots = slots.filter((slot) => slot.movieId === result.movieId);
    const expectedAttendance = movieSlots.reduce((total, slot) => total + (slot.scoreBreakdown?.expectedAttendance ?? 0), 0);
    const roomCapacity = movieSlots.reduce((total, slot) => total + (slot.scoreBreakdown?.roomCapacity ?? slot.totalSeats ?? 0), 0);
    return {
      ...result,
      sessions: movieSlots.length,
      days: new Set(movieSlots.map((slot) => slot.businessDate)).size,
      cinemas: new Set(movieSlots.map((slot) => slot.clusterId)).size,
      formats: Array.from(new Set(movieSlots.map((slot) => slot.formatCode))).join(", ") || "—",
      conflicts: movieSlots.filter((slot) => conflictSlotIds.has(slot.schedulePlanSlotId)).length,
      expectedAttendance,
      roomCapacity,
    };
  }), [conflictSlotIds, run.movieResults, slots]);

  const confirmAction = async () => {
    if (!action || (action === "changes" && !note.trim())) return;
    await onTransition(action, note.trim() || undefined);
    setAction(null);
    setNote("");
  };

  const toggleCluster = (clusterIdToToggle: number) => {
    setExpandedClusterIds((current) => {
      const next = new Set(current);
      if (next.has(clusterIdToToggle)) next.delete(clusterIdToToggle);
      else next.add(clusterIdToToggle);
      return next;
    });
  };

  const allClustersExpanded = boardClusters.length > 0
    && boardClusters.every((cluster) => expandedClusterIds.has(cluster.clusterId));

  const toggleAllClusters = () => {
    setExpandedClusterIds(
      allClustersExpanded
        ? new Set()
        : new Set(boardClusters.map((cluster) => cluster.clusterId)),
    );
  };

  const timelineWidth = Math.max(960, ((timeline.end - timeline.start) / 60) * 78);
  const hourTicks = Array.from({ length: Math.floor((timeline.end - timeline.start) / 60) + 1 }, (_, index) => timeline.start + index * 60);

  return (
    <div className="space-y-4">
      <section className="sticky top-3 z-30 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl" style={{ borderColor: "var(--border-color)", background: "color-mix(in srgb, var(--bg-card) 92%, transparent)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate" style={{ color: "var(--text-main)", fontSize: "18px", fontWeight: 760 }}>Plan #{plan?.schedulePlanId ?? run.generationRunId}</h2>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: status.color, background: status.background }}>{status.label}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--text-sub)" }}>
              <span>{formatDate(run.startDate)} – {formatDate(run.endDate)}</span>
              <span aria-hidden="true">·</span>
              <span>{countLabel(slots.length, "session")}</span>
              <span aria-hidden="true">·</span>
              <span>{countLabel(clusterOptions.length, "cinema")}</span>
              <span aria-hidden="true">·</span>
              <span>{countLabel(totalRooms, "room")}</span>
              {isPublished && plan?.publishedBy && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Published by {plan.publishedBy}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => issueCount > 0 && setContextDrawer("issues")}
              disabled={issueCount === 0}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:cursor-default"
              style={{ color: planHealth.color, background: planHealth.background, borderColor: planHealth.border }}
            >
              {issueCount > 0 ? <CircleAlert size={12} /> : <ShieldCheck size={12} />}
              {planHealth.label}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onNewRun} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
              <RefreshCw size={13} /> New run
            </button>
            {plan && (plan.status === "DRAFT_GENERATED" || plan.status === "CHANGES_REQUESTED") && (
              <button type="button" disabled={busy} onClick={() => setAction("submit")} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">
                <Send size={13} /> Submit for review
              </button>
            )}
            {plan?.status === "IN_REVIEW" && (
              <>
                <button type="button" disabled={busy} onClick={() => setAction("changes")} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Request changes</button>
                <button type="button" disabled={busy || backendBlockers > 0 || conflicts.length > 0} onClick={() => setAction("publish")} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <ShieldCheck size={13} /> Publish schedule
                </button>
              </>
            )}
            {isPublished && (
              <a href="/admin/showtimes" className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white">
                <CalendarDays size={13} /> View live schedule
              </a>
            )}
          </div>
        </div>
      </section>

      {run.failureDetail && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5 text-rose-500">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /><p className="text-xs">{run.failureDetail}</p>
        </div>
      )}
      {error && <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-500">{error}</p>}

      <div>
        <main className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <button type="button" aria-pressed={scheduleView === "board"} onClick={() => setScheduleView("board")} className="rounded-md px-2.5 py-1.5 text-xs font-semibold" style={{ color: scheduleView === "board" ? "#2563eb" : "var(--text-sub)", background: scheduleView === "board" ? "rgba(37,99,235,.12)" : "transparent" }}>Schedule board</button>
                <button type="button" aria-pressed={scheduleView === "timeline"} onClick={() => setScheduleView("timeline")} className="rounded-md px-2.5 py-1.5 text-xs font-semibold" style={{ color: scheduleView === "timeline" ? "#2563eb" : "var(--text-sub)", background: scheduleView === "timeline" ? "rgba(37,99,235,.12)" : "transparent" }}>Room utilization</button>
              </div>

              <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: "var(--border-color)" }} />

              {clusterOptions.length > 1 ? (
                <label className="relative min-w-[170px] flex-1 sm:flex-none">
                  <Building2 size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                  <select value={clusterId} onChange={(event) => setClusterId(event.target.value)} className="w-full appearance-none rounded-lg border py-2 pl-8 pr-8 text-xs outline-none" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)" }}>
                    <option value="all">All cinemas</option>{clusterOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                </label>
              ) : clusterOptions.length === 1 ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
                  <Building2 size={13} style={{ color: "var(--text-sub)" }} /> {clusterOptions[0][1]}
                </span>
              ) : null}

              {movieOptions.length > 1 ? (
                <label className="relative min-w-[200px] flex-1 sm:flex-none">
                  <Film size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                  <select value={movieId} onChange={(event) => setMovieId(event.target.value)} className="w-full appearance-none rounded-lg border py-2 pl-8 pr-8 text-xs outline-none" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)" }}>
                    <option value="all">All movies</option>{movieOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                </label>
              ) : movieOptions.length === 1 ? (
                <span className="inline-flex min-w-0 max-w-[280px] items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
                  <Film size={13} className="flex-shrink-0" style={{ color: "var(--text-sub)" }} />
                  <span className="truncate">{movieOptions[0][1]}</span>
                </span>
              ) : null}

              {formatOptions.length > 1 ? (
                <label className="relative min-w-[125px]">
                  <Filter size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                  <select value={format} onChange={(event) => setFormat(event.target.value)} className="w-full appearance-none rounded-lg border py-2 pl-8 pr-8 text-xs outline-none" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)" }}>
                    <option value="all">All formats</option>{formatOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                </label>
              ) : formatOptions.length === 1 ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
                  <Filter size={13} style={{ color: "var(--text-sub)" }} /> {formatOptions[0]}
                </span>
              ) : null}

              {conflicts.length > 0 && (
                <button
                  type="button"
                  aria-pressed={onlyIssues}
                  onClick={() => setOnlyIssues((current) => !current)}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold"
                  style={{ borderColor: onlyIssues ? "rgba(220,38,38,.35)" : "var(--border-color)", color: onlyIssues ? "#dc2626" : "var(--text-sub)", background: onlyIssues ? "rgba(220,38,38,.08)" : "var(--bg-main)" }}
                >
                  <CircleAlert size={13} /> {onlyIssues ? "Showing conflicts" : "Show conflicts"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 border-t px-3 py-2" style={{ borderColor: "var(--border-color)" }}>
              <CalendarDays size={14} className="flex-shrink-0" style={{ color: "var(--text-sub)" }} />
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                {availableDates.map((date) => {
                  const sessionCount = sessionCountByDate.get(date) ?? 0;
                  return (
                    <button key={date} type="button" onClick={() => setSelectedDate(date)} className="flex min-w-[76px] flex-shrink-0 flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors" style={{ borderColor: selectedDate === date ? "#2563eb" : "transparent", background: selectedDate === date ? "rgba(37,99,235,.12)" : "var(--bg-main)", color: selectedDate === date ? "#2563eb" : "var(--text-sub)" }}>
                      <span className="text-xs font-bold">{formatCompactDate(date)}</span>
                      <span className="mt-0.5 text-[9px] font-semibold opacity-75">{countLabel(sessionCount, "session")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-main)" }}>{scheduleView === "board" ? "Cinema schedule" : "Room utilization"}</h3>
                <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                  {countLabel(boardClusters.length, "cinema")} · {countLabel(roomGroups.length, "room")} · {countLabel(filteredDaySlots.length, "session")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {scheduleView === "board" && boardClusters.length >= 3 && (
                  <button type="button" onClick={toggleAllClusters} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", background: "var(--bg-main)" }}>
                    {allClustersExpanded ? "Collapse all" : "Expand all"}
                  </button>
                )}
                <button aria-label={`Review ${issueCount}`} type="button" onClick={() => setContextDrawer("issues")} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: issueCount ? "rgba(220,38,38,.35)" : "var(--border-color)", color: issueCount ? "#dc2626" : "#059669", background: issueCount ? "rgba(220,38,38,.07)" : "rgba(5,150,105,.07)" }}>
                  {issueCount ? <CircleAlert size={14} /> : <ShieldCheck size={14} />} Review
                  <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "var(--bg-card)" }}>{issueCount}</span>
                </button>
                <button aria-label={`Allocation ${movieRows.length}`} type="button" onClick={() => setContextDrawer("allocation")} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
                  <Film size={14} /> Allocation
                  <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ color: "var(--text-sub)", background: "var(--bg-card)" }}>{movieRows.length}</span>
                </button>
              </div>
            </header>

            {roomGroups.length > 0 ? (
            scheduleView === "board" ? (
              <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                {boardClusters.map((cluster) => {
                  const clusterSessions = cluster.rooms.reduce((total, room) => total + room.slots.length, 0);
                  const clusterConflicts = conflicts.filter(
                    (conflict) => conflict.first.clusterId === cluster.clusterId,
                  ).length;
                  const expanded = expandedClusterIds.has(cluster.clusterId);
                  const panelId = `cinema-schedule-${cluster.clusterId}`;
                  return (
                    <section key={cluster.clusterId}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => toggleCluster(cluster.clusterId)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-blue-500/[0.04]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Building2 size={15} /></span>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{cluster.clusterName}</h4>
                            <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-sub)" }}>
                              {countLabel(cluster.rooms.length, "room")} · {countLabel(clusterSessions, "session")}
                            </p>
                          </div>
                        </div>
                        <span className="flex items-center gap-2">
                          <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                            style={{
                              color: clusterConflicts ? "#dc2626" : "#059669",
                              background: clusterConflicts ? "rgba(220,38,38,.10)" : "rgba(5,150,105,.10)",
                            }}
                          >
                            {clusterConflicts ? countLabel(clusterConflicts, "conflict") : "No conflicts"}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                            style={{ color: "var(--text-sub)" }}
                          />
                        </span>
                      </button>

                      {expanded && (
                      <div id={panelId} className="space-y-3 px-4 pb-4">
                        {cluster.rooms.map((room) => (
                          <article key={room.key} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                              <div><h5 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{room.roomName}</h5><p className="mt-0.5 text-[11px]" style={{ color: "var(--text-sub)" }}>{room.slots.length} scheduled sessions</p></div>
                              <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-sub)" }}>{formatTime(room.slots[0].startAt)}{" \u2013 "}{formatTime(room.slots[room.slots.length - 1].endAt)}</p>
                            </header>

                            <div className="overflow-x-auto">
                              <div className="flex min-w-max items-stretch gap-2 p-4">
                              {room.slots.map((slot, index) => {
                                const next = room.slots[index + 1];
                                const gap = next ? gapMinutes(slot, next) : null;
                                const conflict = conflictSlotIds.has(slot.schedulePlanSlotId);
                                const palette = movieColor(slot.movieId);
                                const attendance = slot.scoreBreakdown?.expectedAttendance;
                                const capacity = slot.scoreBreakdown?.roomCapacity ?? slot.totalSeats;
                                return (
                                  <div key={slot.schedulePlanSlotId} className="flex items-stretch gap-2">
                                    <article
                                      className="flex w-[340px] flex-col overflow-hidden rounded-xl border shadow-sm"
                                      style={{
                                        borderColor: conflict ? "rgba(220,38,38,.6)" : palette.border,
                                        background: "var(--bg-card)",
                                      }}
                                    >
                                      <header className="flex items-start justify-between gap-3 px-4 py-3" style={{ background: conflict ? "rgba(220,38,38,.10)" : palette.fill }}>
                                        <div>
                                          <p className="text-base font-extrabold tabular-nums" style={{ color: conflict ? "#dc2626" : "var(--text-main)" }}>
                                            {formatTime(slot.startAt)}{" \u2013 "}{formatTime(slot.endAt)}
                                          </p>
                                          <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--text-sub)" }}>{durationMinutes(slot)} minutes</p>
                                        </div>
                                        {conflict ? (
                                          <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[9px] font-bold uppercase text-rose-500">Conflict</span>
                                        ) : (
                                          <span className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ color: palette.text, background: "var(--bg-card)" }}>{slot.formatCode}</span>
                                        )}
                                      </header>

                                      <div className="flex flex-1 gap-3.5 px-4 py-4">
                                        <MoviePoster
                                          src={slot.moviePosterUrl}
                                          title={slot.movieTitle}
                                          color={palette.text}
                                          background={palette.fill}
                                        />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                          <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-sub)" }}>Movie</p>
                                          <h6 className="mt-1 line-clamp-3 text-sm font-bold leading-5" style={{ color: "var(--text-main)" }}>{slot.movieTitle}</h6>
                                          <div className="mt-auto flex flex-wrap gap-1.5 pt-2 text-[10px]" style={{ color: "var(--text-sub)" }}>
                                            {conflict && <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)" }}>{slot.formatCode}</span>}
                                            <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)" }}>Audio {slot.audioLanguageCode?.toUpperCase() || "\u2014"}</span>
                                            {slot.subtitleLanguageCode && <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)" }}>Sub {slot.subtitleLanguageCode.toUpperCase()}</span>}
                                          </div>
                                        </div>
                                      </div>

                                      <footer className="border-t px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                                        <details>
                                          <summary className="flex cursor-pointer list-none items-end justify-between gap-3">
                                            <span>
                                              <span className="block text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Forecast occupancy</span>
                                              <span className="mt-0.5 block text-sm font-bold" style={{ color: "var(--text-main)" }}>{attendance != null && capacity ? `${attendance}/${capacity} seats` : "Not available"}</span>
                                            </span>
                                            <span className="text-[11px] font-semibold text-blue-600">Slot details</span>
                                          </summary>
                                          <p className="mt-3 whitespace-pre-line rounded-lg border p-2.5 text-left text-[11px] leading-5" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", background: "var(--bg-main)" }}>{slotExplanation(slot)}</p>
                                        </details>
                                      </footer>
                                    </article>
                                    {next && gap != null && (
                                      <div className="flex w-20 flex-shrink-0 flex-col items-center justify-center gap-2 text-center">
                                        <span className="h-px w-full" style={{ background: gap < 0 ? "#dc2626" : "var(--border-color)" }} />
                                        <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: gap < 0 ? "#dc2626" : "var(--text-sub)", background: gap < 0 ? "rgba(220,38,38,.10)" : "var(--bg-main)" }}>
                                          {gap < 0 ? `${Math.abs(gap)}m overlap` : `${gap}m gap`}
                                        </span>
                                        <span className="h-px w-full" style={{ background: gap < 0 ? "#dc2626" : "var(--border-color)" }} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: timelineWidth + 176 }}>
                <div className="sticky top-0 z-10 flex h-10 border-b" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                  <div className="sticky left-0 z-20 flex w-44 flex-shrink-0 items-center border-r px-3 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)" }}>Room</div>
                  <div className="relative" style={{ width: timelineWidth }}>
                    {hourTicks.map((minute) => <span key={minute} className="absolute top-3 -translate-x-1/2 text-[9px]" style={{ left: `${((minute - timeline.start) / (timeline.end - timeline.start)) * 100}%`, color: "var(--text-sub)" }}>{String(Math.floor(minute / 60) % 24).padStart(2, "0")}:00</span>)}
                  </div>
                </div>
                {roomGroups.map((room, index) => (
                  <div key={room.key} className="flex min-h-[76px] border-b last:border-b-0" style={{ borderColor: "var(--border-color)", background: index % 2 ? "color-mix(in srgb, var(--bg-main) 35%, transparent)" : "transparent" }}>
                    <div className="sticky left-0 z-10 flex w-44 flex-shrink-0 flex-col justify-center border-r px-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <span className="truncate text-xs font-bold" style={{ color: "var(--text-main)" }}>{room.roomName}</span><span className="truncate text-[9px]" style={{ color: "var(--text-sub)" }}>{room.clusterName}</span>
                    </div>
                    <div className="relative my-2.5 h-14 overflow-hidden" style={{ width: timelineWidth, backgroundImage: "linear-gradient(to right, var(--border-color) 1px, transparent 1px)", backgroundSize: `${timelineWidth / ((timeline.end - timeline.start) / 60)}px 100%` }}>
                      {room.slots.map((slot) => {
                        const start = clockMinute(slot.startAt);
                        const left = ((start - timeline.start) / (timeline.end - timeline.start)) * 100;
                        const width = (durationMinutes(slot) / (timeline.end - timeline.start)) * 100;
                        const palette = movieColor(slot.movieId);
                        const conflict = conflictSlotIds.has(slot.schedulePlanSlotId);
                        return (
                          <div key={slot.schedulePlanSlotId} title={slotExplanation(slot)} className="absolute top-1 h-12 overflow-hidden rounded-lg border px-2 py-1 shadow-sm" style={{ left: `${left}%`, width: `${Math.max(width, 3.2)}%`, minWidth: 58, color: conflict ? "#dc2626" : palette.text, borderColor: conflict ? "#dc2626" : palette.border, background: conflict ? "rgba(220,38,38,.13)" : palette.fill }}>
                            <p className="truncate text-[10px] font-extrabold">{formatTime(slot.startAt)} · {slot.formatCode}</p><p className="truncate text-[9px] font-semibold" style={{ color: "var(--text-main)" }}>{slot.movieTitle}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-4 text-center"><CalendarDays size={24} style={{ color: "var(--text-sub)" }} /><p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>No sessions match these filters</p><p className="text-xs" style={{ color: "var(--text-sub)" }}>Choose another date or clear the issue-only filter.</p></div>
            )}
          </section>
        </main>

      </div>

      {contextDrawer && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContextDrawer(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-context-panel-title"
            className={`relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-2xl border shadow-2xl ${contextDrawer === "allocation" ? "max-w-4xl" : "max-w-2xl"}`}
            style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)" }}
          >
            <header className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    color: contextDrawer === "allocation" ? "#2563eb" : issueCount ? "#dc2626" : "#059669",
                    background: contextDrawer === "allocation" ? "rgba(37,99,235,.10)" : issueCount ? "rgba(220,38,38,.10)" : "rgba(5,150,105,.10)",
                  }}
                >
                  {contextDrawer === "allocation" ? <Film size={18} /> : issueCount ? <CircleAlert size={18} /> : <ShieldCheck size={18} />}
                </span>
                <div className="min-w-0">
                  <h2 id="schedule-context-panel-title" className="text-base font-bold">
                    {contextDrawer === "issues" ? "Schedule review" : "Movie allocation"}
                  </h2>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>
                    {contextDrawer === "issues"
                      ? "Review publishing readiness, blockers, warnings and affected sessions."
                      : "Compare how generated sessions are distributed across movies."}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setContextDrawer(null)} className="rounded-lg border p-2" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }} aria-label={`Close ${contextDrawer} modal`}>
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {contextDrawer === "issues" && (
                <div className="space-y-4">
                  <section className="rounded-xl border p-4" style={{ borderColor: issueCount ? "rgba(220,38,38,.3)" : "rgba(5,150,105,.28)", background: issueCount ? "rgba(220,38,38,.05)" : "rgba(5,150,105,.05)" }}>
                    <div className="flex items-start gap-3">
                      {issueCount ? <CircleAlert size={20} className="mt-0.5 flex-shrink-0 text-rose-500" /> : <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-emerald-600" />}
                      <div>
                        <p className="text-sm font-bold">{issueCount ? "Review required before publishing" : "Plan is ready to publish"}</p>
                        <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>{issueCount ? `${issueCount} item${issueCount === 1 ? "" : "s"} still require attention.` : "No blocker, warning or room overlap was detected."}</p>
                      </div>
                    </div>
                  </section>

                  <section className="grid overflow-hidden rounded-xl border sm:grid-cols-3" style={{ borderColor: "var(--border-color)" }}>
                    {[
                      ["Backend blockers", backendBlockers, backendBlockers ? "#dc2626" : "#059669"],
                      ["Room overlaps", conflicts.length, conflicts.length ? "#dc2626" : "#059669"],
                      ["Warnings", warningCount, warningCount ? "#d97706" : "#059669"],
                    ].map(([label, value, color]) => (
                      <div key={String(label)} className="border-b px-4 py-3.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" style={{ borderColor: "var(--border-color)" }}>
                        <span className="block text-[11px] font-semibold" style={{ color: "var(--text-sub)" }}>{label as string}</span>
                        <strong className="mt-1 block text-lg" style={{ color: String(color) }}>{value as number}</strong>
                      </div>
                    ))}
                  </section>

                  {validationIssues.length === 0 && backendBlockers === 0 && conflicts.length === 0 && warningCount === 0 ? (
                    <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
                      <CheckCircle2 size={28} className="text-emerald-600" />
                      <p className="text-sm font-bold">Nothing else to review</p>
                      <p className="max-w-xs text-xs leading-5" style={{ color: "var(--text-sub)" }}>This schedule can proceed to the next workflow action.</p>
                    </div>
                  ) : (
                    <>
                      {validationIssues.map((issue, index) => (
                        <section key={`${issue.code}-${index}`} className="rounded-xl border border-rose-500/25 bg-rose-500/6 p-4">
                          <div className="flex items-start gap-3">
                            <CircleAlert size={18} className="mt-0.5 flex-shrink-0 text-rose-500" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{issue.title}</p>
                              <p className="mt-1.5 text-sm leading-6" style={{ color: "var(--text-sub)" }}>{issue.description}</p>
                              <div className="mt-3 rounded-lg bg-blue-500/8 px-3 py-2.5">
                                <p className="text-xs font-semibold text-blue-600">Recommended action</p>
                                <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>{issue.recommendation}</p>
                              </div>
                              <details className="mt-3">
                                <summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--text-sub)" }}>Technical details</summary>
                                <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>{issue.code}</p>
                                  <code className="mt-1.5 block break-all text-[11px] leading-5 text-rose-500">{issue.raw}</code>
                                </div>
                              </details>
                            </div>
                          </div>
                        </section>
                      ))}
                      {backendBlockers > 0 && validationIssues.length === 0 && (
                        <section className="rounded-xl border border-rose-500/25 bg-rose-500/6 p-4">
                          <p className="text-sm font-bold">The generated schedule has {backendBlockers} backend blocker{backendBlockers === 1 ? "" : "s"}</p>
                          <p className="mt-1.5 text-sm leading-6" style={{ color: "var(--text-sub)" }}>Run plan validation again or inspect the movie-service logs for the affected scheduling rule.</p>
                        </section>
                      )}
                      {warningCount > 0 && (
                        <section className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
                          <p className="text-sm font-bold text-amber-600">{warningCount} generation warning{warningCount === 1 ? "" : "s"}</p>
                          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>Review failed or partially completed generation partitions before publishing.</p>
                        </section>
                      )}
                      {conflicts.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setSelectedDate(item.date);
                            setClusterId(String(item.second.clusterId));
                            setOnlyIssues(true);
                            setContextDrawer(null);
                          }}
                          className="w-full rounded-xl border p-4 text-left"
                          style={{ borderColor: "rgba(220,38,38,.25)", background: "rgba(220,38,38,.05)" }}
                        >
                          <span className="block text-sm font-bold text-rose-500">Room overlap · {formatDate(item.date)}</span>
                          <span className="mt-1.5 block text-xs leading-5" style={{ color: "var(--text-sub)" }}>
                            {item.clusterName} · {item.roomName}<br />
                            {formatTime(item.first.startAt)}–{formatTime(item.first.endAt)} overlaps {formatTime(item.second.startAt)}–{formatTime(item.second.endAt)}
                          </span>
                          <span className="mt-3 block text-xs font-semibold text-blue-600">Show affected sessions</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {contextDrawer === "allocation" && (
                <div className="grid gap-3 md:grid-cols-2">
                  {movieRows.length === 0 ? (
                    <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
                      <Film size={28} style={{ color: "var(--text-sub)" }} />
                      <p className="text-sm font-bold">No movie allocation</p>
                      <p className="text-xs" style={{ color: "var(--text-sub)" }}>This schedule does not contain any generated session.</p>
                    </div>
                  ) : movieRows.map((movie) => (
                    <article key={movie.movieId} className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Film size={17} /></span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold leading-5">{movie.movieTitle}</h3>
                            <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>{movie.sessions} sessions · {movie.days}/{scopeDates.length} days · {movie.cinemas} cinemas</p>
                          </div>
                        </div>
                        <span className="rounded px-2 py-1 text-[10px] font-bold" style={{ color: DEMAND_COLOR[movie.demandTier] ?? "#64748b", background: `${DEMAND_COLOR[movie.demandTier] ?? "#64748b"}18` }}>{movie.demandTier}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs" style={{ borderColor: "var(--border-color)" }}>
                        <div><span className="block" style={{ color: "var(--text-sub)" }}>Formats</span><strong className="mt-1 block">{movie.formats}</strong></div>
                        <div><span className="block" style={{ color: "var(--text-sub)" }}>Forecast occupancy</span><strong className="mt-1 block">{movie.roomCapacity > 0 ? `${movie.expectedAttendance}/${movie.roomCapacity}` : "Not available"}</strong></div>
                      </div>
                      {movie.conflicts > 0 && <p className="mt-3 text-xs font-semibold text-rose-500">{movie.conflicts} conflicted sessions</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <details open={diagnosticsOpen} onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)} className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3"><div><p className="text-xs font-bold" style={{ color: "var(--text-main)" }}>Generation diagnostics</p><p className="mt-0.5 text-[10px]" style={{ color: "var(--text-sub)" }}>Technical search-space metrics for troubleshooting, not customer-facing showtimes.</p></div><ChevronDown size={15} className={`transition-transform ${diagnosticsOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-sub)" }} /></summary>
        <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-4" style={{ borderColor: "var(--border-color)" }}>
          {[["Candidate slots evaluated", run.summary.candidateCount], ["Alternatives rejected", run.summary.skippedCount], ["Draft slots accepted", run.summary.createdCount], ["Partitions completed", `${run.summary.successfulPartitionCount}/${run.summary.successfulPartitionCount + run.summary.failedPartitionCount}`]].map(([label, value]) => <div key={String(label)}><p className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-1 text-base font-bold" style={{ color: "var(--text-main)" }}>{value}</p></div>)}
        </div>
      </details>

      {action && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setAction(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="plan-action-title" className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)" }}>
            <div className="flex items-start justify-between gap-3"><div><h3 id="plan-action-title" className="text-base font-bold">{action === "publish" ? "Publish this schedule?" : action === "changes" ? "Request schedule changes" : "Submit schedule for review"}</h3><p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>{action === "publish" ? `${slots.length} customer-facing showtimes will be materialized.` : action === "changes" ? "Explain what must be corrected before another review." : "The draft will be locked for operational review."}</p></div><button type="button" disabled={busy} onClick={() => setAction(null)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Close"><X size={16} /></button></div>
            {action === "publish" ? <div className="mt-4 space-y-2 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border-color)" }}><p className="flex items-center justify-between"><span>No backend blockers</span><strong className={backendBlockers ? "text-rose-500" : "text-emerald-600"}>{backendBlockers ? "Failed" : "Passed"}</strong></p><p className="flex items-center justify-between"><span>No room overlaps</span><strong className={conflicts.length ? "text-rose-500" : "text-emerald-600"}>{conflicts.length ? "Failed" : "Passed"}</strong></p><p className="flex items-center justify-between"><span>Planned sessions</span><strong>{slots.length}</strong></p></div> : <textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder={action === "changes" ? "Required: describe the expected corrections…" : "Optional review note…"} className="mt-4 w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 text-xs outline-none" style={{ borderColor: action === "changes" && !note.trim() ? "rgba(220,38,38,.35)" : "var(--border-color)", color: "var(--text-main)" }} />}
            <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setAction(null)} className="rounded-xl border px-3.5 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)" }}>Cancel</button><button type="button" disabled={busy || (action === "changes" && !note.trim()) || (action === "publish" && (backendBlockers > 0 || conflicts.length > 0))} onClick={() => void confirmAction()} className={`rounded-xl px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40 ${action === "publish" ? "bg-emerald-600" : action === "changes" ? "bg-amber-600" : "bg-blue-600"}`}>{busy ? "Working…" : action === "publish" ? "Publish schedule" : action === "changes" ? "Request changes" : "Submit for review"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
