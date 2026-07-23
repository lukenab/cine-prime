import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  Armchair,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Film,
  Gauge,
  Monitor,
  PauseCircle,
  Pencil,
  PlayCircle,
  ShieldCheck,
  Ticket,
  X,
  XCircle,
} from "lucide-react";

import type { SchedulePlanResponse, ShowtimeResponse, ShowtimeStatus } from "../../../api/showtimeApi";

type BoardMode = "schedule" | "timeline" | "utilization";

type Props = {
  showtimes: ShowtimeResponse[];
  busy?: boolean;
  onEdit: (showtime: ShowtimeResponse) => void;
  onMove: (showtime: ShowtimeResponse, roomId: number, showDate: string, startTime: string) => Promise<void>;
  onStatusChange: (showtime: ShowtimeResponse, status: ShowtimeStatus, reason?: string) => Promise<void>;
  draftPlan?: SchedulePlanResponse | null;
};

type RoomGroup = {
  roomId: number;
  roomName: string;
  clusterId?: number;
  clusterName: string;
  items: ShowtimeResponse[];
};

const DAY_START = 8 * 60;
const DAY_END = 24 * 60;
const SNAP_MINUTES = 5;

const STATUS_META: Record<ShowtimeStatus, { label: string; color: string; background: string; border: string }> = {
  SCHEDULED: { label: "Scheduled", color: "#2563eb", background: "rgba(37,99,235,.12)", border: "rgba(37,99,235,.34)" },
  ON_SALE: { label: "On sale", color: "#059669", background: "rgba(5,150,105,.12)", border: "rgba(5,150,105,.34)" },
  SUSPENDED: { label: "Suspended", color: "#d97706", background: "rgba(217,119,6,.12)", border: "rgba(217,119,6,.36)" },
  CANCELLED: { label: "Cancelled", color: "#dc2626", background: "rgba(220,38,38,.08)", border: "rgba(220,38,38,.30)" },
  COMPLETED: { label: "Completed", color: "#64748b", background: "rgba(100,116,139,.10)", border: "rgba(100,116,139,.26)" },
};

function minutes(value: string) {
  const [hour = 0, minute = 0] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function formatTime(value: string) {
  return value?.slice(0, 5) || "--:--";
}

function formatDate(value: string, compact = false) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", compact
    ? { weekday: "short", month: "short", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric" });
}

function toTimeValue(totalMinutes: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 55, totalMinutes));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function formatMinuteValue(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function duration(showtime: ShowtimeResponse) {
  const start = minutes(showtime.startTime);
  const end = minutes(showtime.endTime);
  return end > start ? end - start : end + 24 * 60 - start;
}

function gapMinutes(current: ShowtimeResponse, next: ShowtimeResponse) {
  return minutes(next.startTime) - (minutes(current.startTime) + duration(current));
}

function findConflictIds(showtimes: ShowtimeResponse[]) {
  const conflicts = new Set<number>();
  const groups = new Map<string, ShowtimeResponse[]>();
  showtimes
    .filter((item) => item.status !== "CANCELLED")
    .forEach((item) => {
      const key = `${item.showDate}|${item.cinemaRoomId}`;
      const values = groups.get(key) ?? [];
      values.push(item);
      groups.set(key, values);
    });
  groups.forEach((items) => {
    items.sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
    items.forEach((item, index) => {
      const previous = items[index - 1];
      if (previous && minutes(item.startTime) < minutes(previous.endTime)) {
        conflicts.add(previous.showTimeId);
        conflicts.add(item.showTimeId);
      }
    });
  });
  return conflicts;
}

function Poster({ src, title, large = false }: { src?: string; title: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-blue-500/10 text-blue-600 ${large ? "h-24 w-16" : "h-16 w-11"}`} style={{ borderColor: "var(--border-color)" }}>
      {src && !failed
        ? <img src={src} alt={`${title} poster`} className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : <Film size={17} />}
    </div>
  );
}

function CustomerPreview({
  open,
  showtimes,
  date,
  clusterId,
  onClose,
}: {
  open: boolean;
  showtimes: ShowtimeResponse[];
  date: string;
  clusterId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [onClose, open]);

  const scoped = showtimes.filter((item) =>
    item.showDate === date
    && (clusterId === "all" || item.clusterId === Number(clusterId)));
  const bookable = scoped.filter((item) => item.status === "ON_SALE");
  const hidden = scoped.length - bookable.length;
  const movieGroups = Array.from(new Map(bookable.map((item) => [item.movieId, {
    movieId: item.movieId,
    movieName: item.movieName,
    posterUrl: item.moviePosterUrl,
    items: bookable.filter((candidate) => candidate.movieId === item.movieId),
  }])).values());

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Customer schedule preview" className="max-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-hidden rounded-3xl border shadow-2xl" style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}>
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-blue-600" />
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Customer preview</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-600">Read only</span>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
              {formatDate(date)} · Only showtimes currently open for sale are visible.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><X size={17} /></button>
        </header>
        {hidden > 0 && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-600">
            <AlertTriangle size={15} /> {hidden} internal showtime{hidden === 1 ? " is" : "s are"} hidden until sales open.
          </div>
        )}
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-6">
          {movieGroups.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <Ticket size={28} style={{ color: "var(--text-sub)" }} />
              <p className="mt-3 text-sm font-bold" style={{ color: "var(--text-main)" }}>No customer-visible showtimes</p>
              <p className="mt-1 max-w-md text-xs" style={{ color: "var(--text-sub)" }}>Open sales for at least one scheduled session to make it visible here.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {movieGroups.map((movie) => (
                <article key={movie.movieId} className="flex gap-4 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                  <div className="h-36 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-blue-500/10">
                    {movie.posterUrl ? <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-blue-600"><Film size={24} /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-base font-bold" style={{ color: "var(--text-main)" }}>{movie.movieName}</h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>{movie.items[0]?.clusterName ?? "Cinema"}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {movie.items.map((item) => (
                        <span key={item.showTimeId} className="rounded-lg border px-3 py-2 text-xs font-bold text-blue-600" style={{ borderColor: "rgba(37,99,235,.28)", background: "rgba(37,99,235,.08)" }}>
                          {formatTime(item.startTime)}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DraftComparison({
  plan,
  showtimes,
  onClose,
}: {
  plan: SchedulePlanResponse;
  showtimes: ShowtimeResponse[];
  onClose: () => void;
}) {
  const publishedIds = new Set(showtimes.map((showtime) => showtime.showTimeId));
  const materialized = plan.slots.filter((slot) => slot.publishedShowtimeId && publishedIds.has(slot.publishedShowtimeId));
  const proposed = plan.slots.filter((slot) => !slot.publishedShowtimeId || !publishedIds.has(slot.publishedShowtimeId));
  const cinemaCount = new Set(plan.slots.map((slot) => slot.clusterId)).size;
  const roomCount = new Set(plan.slots.map((slot) => slot.cinemaRoomId)).size;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Draft and published schedule comparison" className="w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-2"><CalendarDays size={18} className="text-blue-600" /><h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Draft versus published</h2></div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Schedule plan #{plan.schedulePlanId} · {plan.status.replace(/_/g, " ")}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><X size={17} /></button>
        </header>
        <div className="grid gap-3 p-6 sm:grid-cols-4">
          {[
            ["Draft slots", plan.slots.length, "#2563eb"],
            ["Not published", proposed.length, "#d97706"],
            ["Already materialized", materialized.length, "#059669"],
            ["Scope", `${cinemaCount} cinema · ${roomCount} rooms`, "#7c3aed"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-sub)" }}>{label}</p>
              <p className="mt-2 text-lg font-bold" style={{ color: String(color) }}>{value}</p>
            </div>
          ))}
        </div>
        <div className="border-t px-6 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
          <p className="text-xs" style={{ color: "var(--text-sub)" }}>
            Draft slots remain internal until the schedule plan is published. The Operations board above represents materialized showtimes only.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function ShowtimeOperationsBoard({ showtimes, busy = false, onEdit, onMove, onStatusChange, draftPlan }: Props) {
  const availableDates = useMemo(() => Array.from(new Set(showtimes.map((item) => item.showDate))).sort(), [showtimes]);
  const [selectedDate, setSelectedDate] = useState(availableDates[0] ?? new Date().toISOString().slice(0, 10));
  const [clusterId, setClusterId] = useState("all");
  const [mode, setMode] = useState<BoardMode>("schedule");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [selected, setSelected] = useState<ShowtimeResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [collapsedCinemaIds, setCollapsedCinemaIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) setSelectedDate(availableDates[0]);
  }, [availableDates, selectedDate]);

  const clusterOptions = useMemo(() => Array.from(new Map(showtimes
    .filter((item) => item.clusterId != null)
    .map((item) => [item.clusterId!, item.clusterName ?? `Cinema #${item.clusterId}`])).entries()), [showtimes]);
  useEffect(() => {
    if (clusterId !== "all" && !clusterOptions.some(([id]) => id === Number(clusterId))) setClusterId("all");
  }, [clusterId, clusterOptions]);

  const conflictIds = useMemo(() => findConflictIds(showtimes), [showtimes]);
  useEffect(() => {
    if (conflictIds.size === 0 && onlyIssues) setOnlyIssues(false);
  }, [conflictIds.size, onlyIssues]);

  const dateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    showtimes.forEach((item) => counts.set(item.showDate, (counts.get(item.showDate) ?? 0) + 1));
    return counts;
  }, [showtimes]);

  const scoped = useMemo(() => showtimes.filter((item) =>
    item.showDate === selectedDate
    && (clusterId === "all" || item.clusterId === Number(clusterId))
    && (!onlyIssues || conflictIds.has(item.showTimeId))),
  [clusterId, conflictIds, onlyIssues, selectedDate, showtimes]);

  const rooms = useMemo(() => {
    const groups = new Map<number, RoomGroup>();
    scoped.forEach((item) => {
      const group = groups.get(item.cinemaRoomId) ?? {
        roomId: item.cinemaRoomId,
        roomName: item.cinemaRoomName,
        clusterId: item.clusterId,
        clusterName: item.clusterName ?? "Cinema",
        items: [],
      };
      group.items.push(item);
      groups.set(item.cinemaRoomId, group);
    });
    return Array.from(groups.values())
      .map((room) => ({ ...room, items: room.items.sort((a, b) => a.startTime.localeCompare(b.startTime)) }))
      .sort((a, b) => a.clusterName.localeCompare(b.clusterName) || a.roomName.localeCompare(b.roomName));
  }, [scoped]);

  const boardCinemas = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; rooms: RoomGroup[] }>();
    rooms.forEach((room) => {
      const key = String(room.clusterId ?? room.clusterName);
      const cinema = groups.get(key) ?? { key, name: room.clusterName, rooms: [] };
      cinema.rooms.push(room);
      groups.set(key, cinema);
    });
    return Array.from(groups.values());
  }, [rooms]);

  const toggleCinema = (key: string) => {
    setCollapsedCinemaIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const timelineWindow = useMemo(() => {
    const active = scoped.filter((item) => item.status !== "CANCELLED");
    if (active.length === 0) return { start: DAY_START, end: DAY_END };

    const earliest = Math.min(...active.map((item) => minutes(item.startTime)));
    const latest = Math.max(...active.map((item) => minutes(item.startTime) + duration(item)));
    let start = Math.max(6 * 60, Math.floor((earliest - 60) / 60) * 60);
    let end = Math.min(26 * 60, Math.ceil((latest + 60) / 60) * 60);
    if (end - start < 6 * 60) {
      const padding = 6 * 60 - (end - start);
      start = Math.max(6 * 60, start - Math.ceil(padding / 120) * 60);
      end = Math.min(26 * 60, start + 6 * 60);
    }
    return { start, end };
  }, [scoped]);
  const timelineSpan = timelineWindow.end - timelineWindow.start;
  const timelineWidth = Math.max(1180, Math.round((timelineSpan / 60) * 170));
  const hourTicks = Array.from(
    { length: Math.floor(timelineSpan / 60) + 1 },
    (_, index) => timelineWindow.start / 60 + index,
  );

  const handleDrop = async (event: DragEvent<HTMLDivElement>, roomId: number) => {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/showtime-id"));
    const showtime = showtimes.find((item) => item.showTimeId === id);
    if (!showtime || showtime.status === "CANCELLED" || showtime.status === "COMPLETED") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawMinute = timelineWindow.start + ((event.clientX - rect.left) / rect.width) * timelineSpan;
    const snapped = Math.round(rawMinute / SNAP_MINUTES) * SNAP_MINUTES;
    const latestStart = timelineWindow.end - duration(showtime);
    await onMove(showtime, roomId, selectedDate, toTimeValue(Math.min(snapped, latestStart)));
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <header className="border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>Daily schedule</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                {formatDate(selectedDate)} · {rooms.length} rooms · {scoped.length} sessions · {formatMinuteValue(timelineWindow.start)}–{formatMinuteValue(timelineWindow.end)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <button type="button" onClick={() => setMode("schedule")} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ color: mode === "schedule" ? "#2563eb" : "var(--text-sub)", background: mode === "schedule" ? "rgba(37,99,235,.12)" : "transparent" }}>Schedule board</button>
                <button type="button" onClick={() => setMode("utilization")} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ color: mode === "utilization" ? "#2563eb" : "var(--text-sub)", background: mode === "utilization" ? "rgba(37,99,235,.12)" : "transparent" }}>Room utilization</button>
              </div>
              <button type="button" onClick={() => setPreviewOpen(true)} title="Customer preview" aria-label="Customer preview" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}><Eye size={14} /> Preview</button>
              {draftPlan && <button type="button" onClick={() => setComparisonOpen(true)} title="Compare with draft schedule" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}><CalendarDays size={14} /> Draft</button>}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto border-y py-2" style={{ borderColor: "var(--border-color)" }}>
            <CalendarDays size={14} className="ml-1 flex-shrink-0" style={{ color: "var(--text-sub)" }} />
            {availableDates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className="min-w-[96px] flex-shrink-0 rounded-lg border px-3 py-2 text-left transition-colors"
                style={{
                  borderColor: selectedDate === date ? "#2563eb" : "var(--border-color)",
                  color: selectedDate === date ? "#2563eb" : "var(--text-main)",
                  background: selectedDate === date ? "rgba(37,99,235,.12)" : "var(--bg-main)",
                }}
              >
                <span className="block text-xs font-bold">{formatDate(date, true)}</span>
                <span className="mt-0.5 block text-[9px] font-medium" style={{ color: selectedDate === date ? "#2563eb" : "var(--text-sub)" }}>
                  {dateCounts.get(date) ?? 0} sessions
                </span>
              </button>
            ))}
            <input
              type="date"
              value={selectedDate}
              min={availableDates[0]}
              max={availableDates[availableDates.length - 1]}
              onChange={(event) => availableDates.includes(event.target.value) && setSelectedDate(event.target.value)}
              aria-label="Jump to schedule date"
              className="ml-auto h-9 flex-shrink-0 rounded-lg border px-2 text-xs outline-none"
              style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", colorScheme: "var(--color-scheme)" as string }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {clusterOptions.length > 1 ? (
              <label className="relative min-w-52">
                <Building2 size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                <select value={clusterId} onChange={(event) => setClusterId(event.target.value)} className="w-full appearance-none rounded-lg border py-2 pl-8 pr-8 text-xs outline-none" style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                  <option value="all">All cinemas</option>
                  {clusterOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
              </label>
            ) : clusterOptions.length === 1 ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)" }}><Building2 size={13} /> {clusterOptions[0][1]}</span>
            ) : null}
            {conflictIds.size > 0 && (
              <button type="button" aria-pressed={onlyIssues} onClick={() => setOnlyIssues((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "rgba(220,38,38,.3)", color: "#dc2626", background: onlyIssues ? "rgba(220,38,38,.12)" : "transparent" }}>
                <AlertTriangle size={13} /> {onlyIssues ? "Showing conflicts" : `${conflictIds.size} conflicts`}
              </button>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs" style={{ color: conflictIds.size ? "#dc2626" : "#059669" }}>
              {conflictIds.size ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
              {conflictIds.size ? "Action required" : "No room overlaps"}
            </span>
          </div>

        </header>

        {rooms.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <CalendarDays size={26} style={{ color: "var(--text-sub)" }} />
            <p className="mt-3 text-sm font-bold" style={{ color: "var(--text-main)" }}>No sessions match this view</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Choose another date, cinema or turn off the conflict filter.</p>
          </div>
        ) : mode === "utilization" ? (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => {
              const usedMinutes = room.items.filter((item) => item.status !== "CANCELLED").reduce((sum, item) => sum + duration(item), 0);
              const utilization = Math.min(100, Math.round((usedMinutes / (DAY_END - DAY_START)) * 100));
              const sold = room.items.reduce((sum, item) => sum + (item.soldSeats ?? Math.max(0, (item.totalSeats ?? 0) - (item.availableSeats ?? item.totalSeats ?? 0))), 0);
              const capacity = room.items.reduce((sum, item) => sum + (item.totalSeats ?? 0), 0);
              return (
                <article key={room.roomId} className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{room.roomName}</p><p className="mt-1 text-[11px]" style={{ color: "var(--text-sub)" }}>{room.clusterName}</p></div>
                    <Gauge size={17} style={{ color: utilization >= 85 ? "#d97706" : "#2563eb" }} />
                  </div>
                  <div className="mt-4 flex items-end justify-between"><strong className="text-2xl" style={{ color: "var(--text-main)" }}>{utilization}%</strong><span className="text-xs" style={{ color: "var(--text-sub)" }}>{room.items.length} sessions</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--border-color)" }}><div className="h-full rounded-full" style={{ width: `${utilization}%`, background: utilization >= 85 ? "#d97706" : "#2563eb" }} /></div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><span>Forecast occupancy</span><strong style={{ color: "var(--text-main)" }}>{capacity ? Math.round((sold / capacity) * 100) : 0}%</strong></div>
                </article>
              );
            })}
          </div>
        ) : mode === "schedule" ? (
          <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
            {boardCinemas.map((cinema) => {
              const sessionCount = cinema.rooms.reduce((total, room) => total + room.items.length, 0);
              const collapsed = collapsedCinemaIds.has(cinema.key);
              const cinemaConflictCount = cinema.rooms.reduce(
                (total, room) => total + room.items.filter((item) => conflictIds.has(item.showTimeId)).length,
                0,
              );
              return (
                <section key={cinema.key}>
                  <button
                    type="button"
                    aria-expanded={!collapsed}
                    onClick={() => toggleCinema(cinema.key)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-blue-500/[0.04]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Building2 size={16} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{cinema.name}</span>
                        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-sub)" }}>{cinema.rooms.length} rooms · {sessionCount} sessions</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: cinemaConflictCount ? "#dc2626" : "#059669", background: cinemaConflictCount ? "rgba(220,38,38,.10)" : "rgba(5,150,105,.10)" }}>
                        {cinemaConflictCount ? `${cinemaConflictCount} conflicts` : "No conflicts"}
                      </span>
                      <ChevronDown size={16} className={`transition-transform ${collapsed ? "" : "rotate-180"}`} style={{ color: "var(--text-sub)" }} />
                    </span>
                  </button>

                  {!collapsed && (
                    <div className="space-y-3 px-4 pb-4">
                      {cinema.rooms.map((room) => (
                        <article
                          key={room.roomId}
                          className="overflow-hidden rounded-xl border"
                          style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => void handleDrop(event, room.roomId)}
                        >
                          <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                            <div>
                              <h4 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{room.roomName}</h4>
                              <p className="mt-1 text-[11px]" style={{ color: "var(--text-sub)" }}>{room.items.length} scheduled sessions</p>
                            </div>
                            <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-sub)" }}>
                              {formatTime(room.items[0].startTime)}–{formatTime(room.items[room.items.length - 1].endTime)}
                            </p>
                          </header>

                          <div className="overflow-x-auto">
                            <div className="flex min-w-max items-stretch gap-2 p-4">
                              {room.items.map((item, index) => {
                                const next = room.items[index + 1];
                                const gap = next ? gapMinutes(item, next) : null;
                                const meta = STATUS_META[item.status];
                                const conflict = conflictIds.has(item.showTimeId);
                                const draggable = item.status !== "CANCELLED" && item.status !== "COMPLETED";
                                const soldSeats = item.soldSeats ?? Math.max(0, (item.totalSeats ?? 0) - (item.availableSeats ?? item.totalSeats ?? 0));
                                return (
                                  <div key={item.showTimeId} className="flex items-stretch gap-2">
                                    <article
                                      draggable={draggable && !busy}
                                      onDragStart={(event) => event.dataTransfer.setData("text/showtime-id", String(item.showTimeId))}
                                      className="flex w-[340px] flex-col overflow-hidden rounded-xl border shadow-sm"
                                      style={{
                                        borderColor: conflict ? "rgba(220,38,38,.6)" : meta.border,
                                        background: "var(--bg-card)",
                                        opacity: item.status === "CANCELLED" ? .58 : 1,
                                        cursor: draggable ? "grab" : "default",
                                      }}
                                    >
                                      <header className="flex items-start justify-between gap-3 px-4 py-3" style={{ background: conflict ? "rgba(220,38,38,.10)" : meta.background }}>
                                        <div>
                                          <p className="text-base font-extrabold tabular-nums" style={{ color: conflict ? "#dc2626" : "var(--text-main)" }}>{formatTime(item.startTime)}–{formatTime(item.endTime)}</p>
                                          <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--text-sub)" }}>{duration(item)} minutes</p>
                                        </div>
                                        <span className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ color: conflict ? "#dc2626" : meta.color, background: "var(--bg-card)" }}>{conflict ? "Conflict" : item.formatCode ?? "2D"}</span>
                                      </header>

                                      <div className="flex flex-1 gap-3.5 px-4 py-4">
                                        <Poster src={item.moviePosterUrl} title={item.movieName} large />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                          <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-sub)" }}>Movie</p>
                                          <h5 className="mt-1 line-clamp-3 text-sm font-bold leading-5" style={{ color: "var(--text-main)", textDecoration: item.status === "CANCELLED" ? "line-through" : "none" }}>{item.movieName}</h5>
                                          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                                            <span className="rounded-md border px-2 py-1 text-[10px] font-semibold uppercase" style={{ borderColor: "var(--border-color)", color: meta.color }}>{meta.label}</span>
                                            {item.source && <span className="rounded-md border px-2 py-1 text-[10px]" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>{item.source === "AUTO" ? "Generated" : "Manual"}</span>}
                                          </div>
                                        </div>
                                      </div>

                                      <footer className="flex items-end justify-between gap-3 border-t px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                                        <span>
                                          <span className="block text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Seat sales</span>
                                          <span className="mt-0.5 block text-sm font-bold" style={{ color: "var(--text-main)" }}>{item.totalSeats != null ? `${soldSeats}/${item.totalSeats} seats` : "Not available"}</span>
                                        </span>
                                        <button type="button" onClick={() => { setSelected(item); setCancelReason(""); }} className="text-[11px] font-semibold text-blue-600">Showtime details</button>
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
            <div style={{ minWidth: `${timelineWidth + 220}px` }}>
              <div className="grid border-b" style={{ gridTemplateColumns: `220px ${timelineWidth}px`, borderColor: "var(--border-color)" }}>
                <div className="px-5 py-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Screening room</div>
                <div className="relative h-12">
                  {hourTicks.map((hour) => <span key={hour} className="absolute top-4 -translate-x-1/2 text-[11px] font-medium" style={{ left: `${((hour * 60 - timelineWindow.start) / timelineSpan) * 100}%`, color: "var(--text-sub)" }}>{String(hour % 24).padStart(2, "0")}:00</span>)}
                </div>
              </div>
              {rooms.map((room) => (
                <div key={room.roomId} className="grid border-b last:border-0" style={{ gridTemplateColumns: `220px ${timelineWidth}px`, borderColor: "var(--border-color)" }}>
                  <div className="border-r px-5 py-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Monitor size={17} /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{room.roomName}</p>
                        <p className="mt-1 truncate text-[11px]" style={{ color: "var(--text-sub)" }}>{room.clusterName}</p>
                        <span className="mt-2 inline-flex rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-600">{room.items.length} sessions</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative min-h-[152px]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, room.roomId)}>
                    {hourTicks.map((hour) => <span key={hour} className="pointer-events-none absolute inset-y-0 border-l" style={{ left: `${((hour * 60 - timelineWindow.start) / timelineSpan) * 100}%`, borderColor: "var(--border-color)", opacity: .55 }} />)}
                    {room.items.map((item) => {
                      const meta = STATUS_META[item.status];
                      const left = ((minutes(item.startTime) - timelineWindow.start) / timelineSpan) * 100;
                      const width = (duration(item) / timelineSpan) * 100;
                      const conflict = conflictIds.has(item.showTimeId);
                      const draggable = item.status !== "CANCELLED" && item.status !== "COMPLETED";
                      const soldSeats = item.soldSeats ?? Math.max(0, (item.totalSeats ?? 0) - (item.availableSeats ?? item.totalSeats ?? 0));
                      return (
                        <button
                          key={item.showTimeId}
                          type="button"
                          draggable={draggable && !busy}
                          onDragStart={(event) => event.dataTransfer.setData("text/showtime-id", String(item.showTimeId))}
                          onClick={() => { setSelected(item); setCancelReason(""); }}
                          title={`${item.movieName}\n${formatTime(item.startTime)}–${formatTime(item.endTime)}`}
                          className="absolute top-4 h-[120px] overflow-hidden rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          style={{
                            left: `${Math.max(0, left)}%`,
                            width: `${Math.max(12, width)}%`,
                            minWidth: 230,
                            color: meta.color,
                            borderColor: conflict ? "#dc2626" : meta.border,
                            background: meta.background,
                            opacity: item.status === "CANCELLED" ? .55 : 1,
                            cursor: draggable ? "grab" : "pointer",
                          }}
                        >
                          <div className="flex h-full gap-3">
                            <Poster src={item.moviePosterUrl} title={item.movieName} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[13px] font-bold">{formatTime(item.startTime)}–{formatTime(item.endTime)}</span>
                                <span className="rounded-md px-2 py-1 text-[9px] font-bold uppercase" style={{ background: `${meta.color}18` }}>{item.formatCode ?? "2D"}</span>
                              </div>
                              <span className="mt-2 block line-clamp-2 text-[13px] font-bold leading-4" style={{ color: "var(--text-main)", textDecoration: item.status === "CANCELLED" ? "line-through" : "none" }}>{item.movieName}</span>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="truncate text-[10px] font-semibold uppercase">{conflict ? "Conflict" : meta.label}</span>
                                {item.totalSeats != null && (
                                  <span className="whitespace-nowrap text-[10px] font-semibold" style={{ color: "var(--text-sub)" }}>{soldSeats}/{item.totalSeats} sold</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[1px]" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l p-5 shadow-2xl" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Poster src={selected.moviePosterUrl} title={selected.movieName} /><div><span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase" style={{ color: STATUS_META[selected.status].color, background: STATUS_META[selected.status].background }}>{STATUS_META[selected.status].label}</span><h2 className="mt-2 text-base font-bold" style={{ color: "var(--text-main)" }}>{selected.movieName}</h2><p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Showtime #{selected.showTimeId}</p></div></div><button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><X size={16} /></button></div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                [CalendarDays, "Date", formatDate(selected.showDate)],
                [Clock3, "Time", `${formatTime(selected.startTime)}–${formatTime(selected.endTime)}`],
                [Building2, "Cinema", selected.clusterName ?? "—"],
                [Monitor, "Room", selected.cinemaRoomName],
                [Armchair, "Availability", `${selected.availableSeats ?? "—"}/${selected.totalSeats ?? "—"}`],
                [Ticket, "From price", selected.price ? `${selected.price.toLocaleString("vi-VN")} ₫` : "—"],
              ].map(([Icon, label, value]) => {
                const DetailIcon = Icon as typeof CalendarDays;
                return <div key={String(label)} className="rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><DetailIcon size={14} className="text-blue-600" /><p className="mt-2 text-[9px] font-bold uppercase" style={{ color: "var(--text-sub)" }}>{String(label)}</p><p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-main)" }}>{String(value)}</p></div>;
              })}
            </div>

            {selected.status !== "CANCELLED" && selected.status !== "COMPLETED" && (
              <div className="mt-5 space-y-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <button type="button" onClick={() => onEdit(selected)} className="flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}><Pencil size={15} /> Edit room or time</button>
                {selected.status !== "ON_SALE" && <button type="button" disabled={busy} onClick={() => void onStatusChange(selected, "ON_SALE").then(() => setSelected(null))} className="flex w-full items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600"><PlayCircle size={15} /> Open ticket sales</button>}
                {selected.status !== "SUSPENDED" && <button type="button" disabled={busy} onClick={() => void onStatusChange(selected, "SUSPENDED").then(() => setSelected(null))} className="flex w-full items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600"><PauseCircle size={15} /> Suspend showtime</button>}
                <div className="rounded-xl border border-rose-500/20 p-3">
                  <label className="text-xs font-semibold text-rose-500">Cancellation reason</label>
                  <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} placeholder="Required before cancellation" className="mt-2 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                  <button type="button" disabled={busy || !cancelReason.trim()} onClick={() => void onStatusChange(selected, "CANCELLED", cancelReason.trim()).then(() => setSelected(null))} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><XCircle size={14} /> Cancel showtime</button>
                </div>
              </div>
            )}
            {selected.status === "CANCELLED" && selected.cancellationReason && <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-500"><strong>Cancellation reason</strong><p className="mt-1">{selected.cancellationReason}</p></div>}
          </aside>
        </div>
      )}

      <CustomerPreview open={previewOpen} showtimes={showtimes} date={selectedDate} clusterId={clusterId} onClose={() => setPreviewOpen(false)} />
      {comparisonOpen && draftPlan && <DraftComparison plan={draftPlan} showtimes={showtimes} onClose={() => setComparisonOpen(false)} />}
    </>
  );
}
