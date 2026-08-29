import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  Armchair,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Film,
  Gauge,
  Monitor,
  PauseCircle,
  Pencil,
  PlayCircle,
  Ticket,
  X,
  XCircle,
} from "lucide-react";

import type { ShowtimeResponse, ShowtimeStatus } from "../../../api/showtimeApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

type BoardMode = "schedule" | "timeline" | "utilization";

type Props = {
  showtimes: ShowtimeResponse[];
  /** Unfiltered operational data used to verify what customers can actually see.
   *  Table-only movie/status/room filters must not hide sessions from this view. */
  customerPreviewShowtimes?: ShowtimeResponse[];
  busy?: boolean;
  readOnly?: boolean;
  onEdit: (showtime: ShowtimeResponse) => void;
  onMove: (showtime: ShowtimeResponse, roomId: number, showDate: string, startTime: string) => Promise<void>;
  onStatusChange: (showtime: ShowtimeResponse, status: ShowtimeStatus, reason?: string) => Promise<void>;
  /** Bulk sibling of onStatusChange — lets ops open/suspend a whole batch (e.g.
   *  every session of one movie today) in one call instead of one at a time. */
  onBulkStatusChange?: (showtimeIds: number[], status: ShowtimeStatus, reason?: string) => Promise<void>;
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(value: string, delta: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

function formatWeekday(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
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
      <section role="dialog" aria-modal="true" aria-label="Customer schedule view" className="max-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-hidden rounded-3xl border shadow-2xl" style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}>
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-blue-600" />
              <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Customer view</h2>
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

export default function ShowtimeOperationsBoard({ showtimes, customerPreviewShowtimes = showtimes, busy = false, readOnly = false, onEdit, onMove, onStatusChange, onBulkStatusChange }: Props) {
  const datesWithSessions = useMemo(() => Array.from(new Set(showtimes.map((item) => item.showDate))).sort(), [showtimes]);

  // A continuous day-by-day strip (not just days that already have a session) so admins can
  // navigate ahead into an empty future date - e.g. to check what's still unscheduled - the same
  // way the customer-facing date tabs work, rather than only ever listing days with existing data.
  const availableDates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const earliest = datesWithSessions[0] && datesWithSessions[0] < today ? datesWithSessions[0] : today;
    const minimumWindowEnd = new Date(new Date(`${earliest}T00:00:00`).getTime() + 8 * 86_400_000).toISOString().slice(0, 10);
    const latest = datesWithSessions[datesWithSessions.length - 1];
    const windowEnd = latest && latest > minimumWindowEnd ? latest : minimumWindowEnd;

    const result: string[] = [];
    for (let cursor = new Date(`${earliest}T00:00:00`); cursor.toISOString().slice(0, 10) <= windowEnd; cursor.setDate(cursor.getDate() + 1)) {
      result.push(cursor.toISOString().slice(0, 10));
    }
    return result;
  }, [datesWithSessions]);
  // Defaults to the first date that actually has a session (matching the pre-existing behavior)
  // rather than "today", which the continuous strip above may include even when every real
  // session is still in the future - landing an admin on a blank day on first load would be worse
  // than the extra navigation the continuous strip is meant to enable.
  const [selectedDate, setSelectedDate] = useState(() => datesWithSessions[0] ?? new Date().toISOString().slice(0, 10));
  const [clusterId, setClusterId] = useState("all");
  const [movieId, setMovieId] = useState("all");
  const [mode, setMode] = useState<BoardMode>("timeline");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [selected, setSelected] = useState<ShowtimeResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  // Bulk selection lives only on the Schedule board view (individual session
  // cards, unlike the drag-driven Timeline) — see the checkboxes below.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState("");
  const [bulkCancelPromptOpen, setBulkCancelPromptOpen] = useState(false);

  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) setSelectedDate(availableDates[0]);
  }, [availableDates, selectedDate]);

  // The date bar always shows exactly 7 days at a time, starting from today by default.
  // Navigation moves a full week at a time rather than one day, and is bounded by the
  // same earliest/latest dates the continuous availableDates window covers.
  const [weekStart, setWeekStart] = useState(() => todayISO());
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index)), [weekStart]);
  const minDate = availableDates[0] ?? todayISO();
  const maxDate = availableDates[availableDates.length - 1] ?? todayISO();
  const canGoPrevWeek = weekStart > minDate;
  const canGoNextWeek = weekDates[weekDates.length - 1] < maxDate;
  const goToAdjacentWeek = (direction: -1 | 1) => {
    const next = addDaysISO(weekStart, direction * 7);
    setWeekStart(next < minDate ? minDate : next > maxDate ? maxDate : next);
  };
  const jumpToDate = (value: string) => {
    if (value < minDate || value > maxDate) return;
    setSelectedDate(value);
    setWeekStart(value);
  };

  const clusterOptions = useMemo(() => Array.from(new Map(showtimes
    .filter((item) => item.clusterId != null)
    .map((item) => [item.clusterId!, item.clusterName ?? `Cinema #${item.clusterId}`])).entries()), [showtimes]);
  useEffect(() => {
    if (clusterId !== "all" && !clusterOptions.some(([id]) => id === Number(clusterId))) setClusterId("all");
  }, [clusterId, clusterOptions]);

  // Scoped to the selected date, same as clusterOptions - a movie filter that
  // still listed titles with nothing playing today would be more confusing
  // than useful for a "bulk-open today's sessions of X" workflow.
  const movieOptions = useMemo(() => Array.from(new Map(showtimes
    .filter((item) => item.showDate === selectedDate)
    .map((item) => [item.movieId, item.movieName ?? `Movie #${item.movieId}`])).entries())
    .sort((a, b) => a[1].localeCompare(b[1])), [showtimes, selectedDate]);
  useEffect(() => {
    if (movieId !== "all" && !movieOptions.some(([id]) => id === Number(movieId))) setMovieId("all");
  }, [movieId, movieOptions]);

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
    && (movieId === "all" || item.movieId === Number(movieId))
    && (!onlyIssues || conflictIds.has(item.showTimeId))),
  [clusterId, conflictIds, movieId, onlyIssues, selectedDate, showtimes]);

  // Selection is intersected with what's currently visible on every relevant
  // change, so switching the movie/cluster filter (or the day) can't leave
  // stale ids selected that the admin can no longer see on screen.
  useEffect(() => {
    const visible = new Set(scoped.map((item) => item.showTimeId));
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [scoped]);

  const selectableScoped = useMemo(
    () => scoped.filter((item) => item.status !== "CANCELLED" && item.status !== "COMPLETED"),
    [scoped],
  );
  const toggleSelected = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => setSelectedIds(new Set(selectableScoped.map((item) => item.showTimeId)));
  const clearSelection = () => setSelectedIds(new Set());

  const runBulkStatusChange = async (status: ShowtimeStatus, reason?: string) => {
    if (!onBulkStatusChange || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulkStatusChange(Array.from(selectedIds), status, reason);
      clearSelection();
      setBulkCancelPromptOpen(false);
      setBulkCancelReason("");
    } finally {
      setBulkBusy(false);
    }
  };

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

  const handleDrop = async (event: DragEvent<HTMLElement>, roomId: number) => {
    event.preventDefault();
    if (readOnly) return;
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
      {/* Date navigation - a standalone card of its own, not nested inside the
          "Daily schedule" section below, so it reads as page-level navigation
          rather than a control that belongs to just one section. */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border px-2 py-2" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <button
          type="button"
          onClick={() => goToAdjacentWeek(-1)}
          disabled={!canGoPrevWeek}
          aria-label="Previous week"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-35"
          style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}
        >
          <ChevronLeft size={16} />
        </button>

        <div className="grid min-w-0 flex-1 grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const isToday = date === todayISO();
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                type="button"
                data-selected={isSelected}
                onClick={() => setSelectedDate(date)}
                className="min-w-0 rounded-lg border px-2 py-2 text-center transition-colors"
                style={{
                  borderColor: isSelected ? "#2563eb" : "var(--border-color)",
                  color: isSelected ? "#2563eb" : "var(--text-main)",
                  background: isSelected ? "rgba(37,99,235,.12)" : "var(--bg-main)",
                }}
              >
                <span className="block text-[10px] font-bold uppercase" style={{ color: isSelected ? "#2563eb" : "var(--text-sub)" }}>
                  {isToday ? "Today" : formatWeekday(date)}
                </span>
                <span className="mt-0.5 block text-xs font-bold" style={{ color: isSelected ? "#2563eb" : "var(--text-main)" }}>
                  {formatMonthDay(date)}
                </span>
                <span className="mt-0.5 block text-[9px] font-medium" style={{ color: isSelected ? "#2563eb" : "var(--text-sub)" }}>
                  {dateCounts.get(date) ?? 0} sessions
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => goToAdjacentWeek(1)}
          disabled={!canGoNextWeek}
          aria-label="Next week"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-35"
          style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}
        >
          <ChevronRight size={16} />
        </button>

        <input
          type="date"
          value={selectedDate}
          min={minDate}
          max={maxDate}
          onChange={(event) => jumpToDate(event.target.value)}
          aria-label="Jump to schedule date"
          className="h-9 flex-shrink-0 rounded-lg border px-2 text-xs outline-none"
          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", colorScheme: "var(--color-scheme)" as string }}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <header className="border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>Daily schedule</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                {formatDate(selectedDate)} · {rooms.length} rooms · {scoped.length} sessions · {formatMinuteValue(timelineWindow.start)}–{formatMinuteValue(timelineWindow.end)}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex h-9 min-w-[190px] overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <Select value={movieId} onValueChange={setMovieId}>
                  <SelectTrigger
                    aria-label="Filter by movie"
                    className="h-full w-full rounded-none border-0 bg-transparent px-3 text-xs font-semibold focus-visible:ring-0 dark:bg-transparent dark:hover:bg-white/5"
                    style={{ height: "34px", color: "var(--text-main)" }}
                  >
                    <SelectValue placeholder="All movies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All movies</SelectItem>
                    {movieOptions.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {conflictIds.size > 0 && (
                <button type="button" aria-pressed={onlyIssues} onClick={() => setOnlyIssues((value) => !value)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold" style={{ borderColor: "rgba(220,38,38,.3)", color: "#dc2626", background: onlyIssues ? "rgba(220,38,38,.12)" : "transparent" }}>
                  <AlertTriangle size={13} /> {onlyIssues ? `Showing ${conflictIds.size} conflicts` : `${conflictIds.size} scheduling conflicts`}
                </button>
              )}
              <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <button type="button" onClick={() => setMode("timeline")} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ color: mode === "timeline" ? "#2563eb" : "var(--text-sub)", background: mode === "timeline" ? "rgba(37,99,235,.12)" : "transparent" }}>Timeline</button>
                <button type="button" onClick={() => setMode("schedule")} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ color: mode === "schedule" ? "#2563eb" : "var(--text-sub)", background: mode === "schedule" ? "rgba(37,99,235,.12)" : "transparent" }}>Schedule board</button>
                <button type="button" onClick={() => setMode("utilization")} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ color: mode === "utilization" ? "#2563eb" : "var(--text-sub)", background: mode === "utilization" ? "rgba(37,99,235,.12)" : "transparent" }}>Room utilization</button>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                title="Customer view"
                aria-label="Customer view"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}
              >
                <Eye size={15} />
              </button>
            </div>
          </div>
        </header>

        {mode === "schedule" && onBulkStatusChange && (
          <div
            className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5"
            style={{ borderColor: "var(--border-color)", background: selectedIds.size ? "rgba(37,99,235,.06)" : "var(--bg-main)" }}
          >
            {selectedIds.size === 0 ? (
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={selectableScoped.length === 0}
                className="text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "#2563eb" }}
              >
                Select all {selectableScoped.length} visible sessions
              </button>
            ) : (
              <>
                <span className="text-xs font-bold" style={{ color: "var(--text-main)" }}>{selectedIds.size} selected</span>
                <button type="button" onClick={selectAllVisible} className="text-xs font-semibold" style={{ color: "#2563eb" }}>Select all visible</button>
                <button type="button" onClick={clearSelection} className="text-xs font-semibold" style={{ color: "var(--text-sub)" }}>Clear</button>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void runBulkStatusChange("ON_SALE")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlayCircle size={13} /> Open sales
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void runBulkStatusChange("SUSPENDED")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PauseCircle size={13} /> Suspend
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => setBulkCancelPromptOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <XCircle size={13} /> Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {mode === "schedule" && bulkCancelPromptOpen && (
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--border-color)", background: "rgba(220,38,38,.06)" }}>
            <input
              type="text"
              value={bulkCancelReason}
              onChange={(event) => setBulkCancelReason(event.target.value)}
              placeholder={`Reason for cancelling ${selectedIds.size} session${selectedIds.size === 1 ? "" : "s"}...`}
              className="h-9 min-w-[240px] flex-1 rounded-lg border px-3 text-xs outline-none"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            />
            <button
              type="button"
              disabled={bulkBusy || !bulkCancelReason.trim()}
              onClick={() => void runBulkStatusChange("CANCELLED", bulkCancelReason.trim())}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm cancellation
            </button>
            <button type="button" onClick={() => { setBulkCancelPromptOpen(false); setBulkCancelReason(""); }} className="text-xs font-semibold" style={{ color: "var(--text-sub)" }}>
              Back
            </button>
          </div>
        )}

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
          // No cinema-level accordion here - the board is already scoped to a single
          // branch (selected at the page level), so grouping rooms under a repeated
          // cinema-name header was pure duplication. Rooms render directly.
          <div className="space-y-3 p-4">
            {rooms.map((room) => (
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
                  <div className="flex flex-wrap items-start gap-3 p-4">
                    {(() => {
                      // Consecutive sessions of the same movie/format collapse into one
                      // block (poster + title shown once) instead of repeating a full
                      // card per session - a room showing the same title back-to-back
                      // no longer needs N copies of the same poster to scan the day.
                      type SessionGroup = { movieName: string; posterUrl?: string; formatCode: string; items: typeof room.items };
                      const groups: SessionGroup[] = [];
                      room.items.forEach((item) => {
                        const formatCode = item.formatCode ?? "2D";
                        const last = groups[groups.length - 1];
                        if (last && last.movieName === item.movieName && last.formatCode === formatCode) {
                          last.items.push(item);
                        } else {
                          groups.push({ movieName: item.movieName, posterUrl: item.moviePosterUrl, formatCode, items: [item] });
                        }
                      });

                      return groups.map((group, groupIndex) => (
                        <article key={groupIndex} className="flex w-[250px] flex-col overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                          <div className="flex gap-3 px-3 py-3">
                            <Poster src={group.posterUrl} title={group.movieName} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-sub)" }}>Movie</p>
                                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(37,99,235,.1)", color: "#2563eb" }}>{group.formatCode}</span>
                              </div>
                              <h5 className="mt-1 line-clamp-3 text-[13px] font-bold leading-4" style={{ color: "var(--text-main)" }}>{group.movieName}</h5>
                              <p className="mt-1 text-[10px]" style={{ color: "var(--text-sub)" }}>{group.items.length} session{group.items.length > 1 ? "s" : ""}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 border-t px-3 py-2.5" style={{ borderColor: "var(--border-color)" }}>
                            {group.items.map((item) => {
                              const meta = STATUS_META[item.status];
                              const conflict = conflictIds.has(item.showTimeId);
                              const draggable = !readOnly && item.status !== "CANCELLED" && item.status !== "COMPLETED";
                              const soldSeats = item.soldSeats ?? Math.max(0, (item.totalSeats ?? 0) - (item.availableSeats ?? item.totalSeats ?? 0));
                              const checked = selectedIds.has(item.showTimeId);
                              return (
                                <button
                                  key={item.showTimeId}
                                  type="button"
                                  draggable={draggable && !busy}
                                  onDragStart={(event) => event.dataTransfer.setData("text/showtime-id", String(item.showTimeId))}
                                  onClick={() => { setSelected(item); setCancelReason(""); setCancelPromptOpen(false); }}
                                  title={`${meta.label}${item.totalSeats != null ? ` · ${soldSeats}/${item.totalSeats} seats` : ""}`}
                                  className="relative rounded-lg border px-2 py-1.5 text-left transition hover:-translate-y-0.5"
                                  style={{
                                    borderColor: checked ? "#2563eb" : conflict ? "#dc2626" : meta.border,
                                    background: conflict ? "rgba(220,38,38,.10)" : meta.background,
                                    boxShadow: checked ? "0 0 0 2px rgba(37,99,235,.35)" : "none",
                                    opacity: item.status === "CANCELLED" ? .55 : 1,
                                    cursor: draggable ? "grab" : "pointer",
                                    textDecoration: item.status === "CANCELLED" ? "line-through" : "none",
                                  }}
                                >
                                  {onBulkStatusChange && draggable && (
                                    <span
                                      role="checkbox"
                                      aria-checked={checked}
                                      onClick={(event) => { event.stopPropagation(); toggleSelected(item.showTimeId); }}
                                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border"
                                      style={{
                                        borderColor: checked ? "#2563eb" : "var(--border-color)",
                                        background: checked ? "#2563eb" : "var(--bg-card)",
                                        color: "#fff",
                                      }}
                                    >
                                      {checked && <CheckCircle2 size={11} />}
                                    </span>
                                  )}
                                  <span className="block text-[11px] font-bold tabular-nums" style={{ color: conflict ? "#dc2626" : meta.color }}>{formatTime(item.startTime)}–{formatTime(item.endTime)}</span>
                                  {item.totalSeats != null && <span className="mt-0.5 block text-[9px]" style={{ color: "var(--text-sub)" }}>{soldSeats}/{item.totalSeats} sold</span>}
                                </button>
                              );
                            })}
                          </div>
                        </article>
                      ));
                    })()}
                  </div>
                </div>
              </article>
            ))}
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
              {boardCinemas.map((cinema) => (
                <div key={cinema.key}>
                  {boardCinemas.length > 1 && (
                    <div className="flex items-center gap-2 border-b px-5 py-2" style={{ borderColor: "var(--border-color)", background: "rgba(37,99,235,.05)" }}>
                      <Building2 size={13} className="text-blue-600" />
                      <span className="text-xs font-bold" style={{ color: "var(--text-main)" }}>{cinema.name}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-sub)" }}>· {cinema.rooms.length} rooms</span>
                    </div>
                  )}
                  {cinema.rooms.map((room) => (
                    <div key={room.roomId} className="grid border-b last:border-0" style={{ gridTemplateColumns: `220px ${timelineWidth}px`, borderColor: "var(--border-color)" }}>
                      <div className="border-r px-5 py-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Monitor size={17} /></div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{room.roomName}</p>
                            {boardCinemas.length <= 1 && <p className="mt-1 truncate text-[11px]" style={{ color: "var(--text-sub)" }}>{room.clusterName}</p>}
                            <span className="mt-2 inline-flex rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-600">{room.items.length} sessions</span>
                          </div>
                        </div>
                      </div>
                      <div className="relative min-h-[104px]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, room.roomId)}>
                        {hourTicks.map((hour) => <span key={hour} className="pointer-events-none absolute inset-y-0 border-l" style={{ left: `${((hour * 60 - timelineWindow.start) / timelineSpan) * 100}%`, borderColor: "var(--border-color)", opacity: .55 }} />)}
                        {room.items.map((item) => {
                          const meta = STATUS_META[item.status];
                          const left = ((minutes(item.startTime) - timelineWindow.start) / timelineSpan) * 100;
                          const width = (duration(item) / timelineSpan) * 100;
                          const conflict = conflictIds.has(item.showTimeId);
                          const draggable = !readOnly && item.status !== "CANCELLED" && item.status !== "COMPLETED";
                          const soldSeats = item.soldSeats ?? Math.max(0, (item.totalSeats ?? 0) - (item.availableSeats ?? item.totalSeats ?? 0));
                          return (
                            <button
                              key={item.showTimeId}
                              type="button"
                              draggable={draggable && !busy}
                              onDragStart={(event) => event.dataTransfer.setData("text/showtime-id", String(item.showTimeId))}
                              onClick={() => { setSelected(item); setCancelReason(""); setCancelPromptOpen(false); }}
                              title={`${item.movieName}\n${formatTime(item.startTime)}–${formatTime(item.endTime)}`}
                              // No poster - keeping the card slim (fixed min-width down from 230px
                              // to 150px) is what stops adjacent short sessions from overlapping
                              // each other on the timeline.
                              className="absolute top-3 h-[70px] overflow-hidden rounded-lg border px-2.5 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                              style={{
                                left: `${Math.max(0, left)}%`,
                                width: `${Math.max(8, width)}%`,
                                minWidth: 150,
                                color: meta.color,
                                borderColor: conflict ? "#dc2626" : meta.border,
                                background: meta.background,
                                opacity: item.status === "CANCELLED" ? .55 : 1,
                                cursor: draggable ? "grab" : "pointer",
                              }}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="truncate text-[11px] font-bold">{formatTime(item.startTime)}–{formatTime(item.endTime)}</span>
                                <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: `${meta.color}18` }}>{item.formatCode ?? "2D"}</span>
                              </div>
                              <span className="mt-1 block truncate text-[11px] font-bold leading-4" style={{ color: "var(--text-main)", textDecoration: item.status === "CANCELLED" ? "line-through" : "none" }}>{item.movieName}</span>
                              <div className="mt-1 flex items-center justify-between gap-1.5">
                                <span className="truncate text-[9px] font-semibold uppercase">{conflict ? "Conflict" : meta.label}</span>
                                {item.totalSeats != null && (
                                  <span className="flex-shrink-0 whitespace-nowrap text-[9px] font-semibold" style={{ color: "var(--text-sub)" }}>{soldSeats}/{item.totalSeats}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div role="dialog" aria-modal="true" aria-label="Showtime details" className="max-h-[calc(100vh-3rem)] w-full max-w-md overflow-y-auto rounded-3xl border p-5 shadow-2xl" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Poster src={selected.moviePosterUrl} title={selected.movieName} /><div><span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase" style={{ color: STATUS_META[selected.status].color, background: STATUS_META[selected.status].background }}>{STATUS_META[selected.status].label}</span><h2 className="mt-2 text-base font-bold" style={{ color: "var(--text-main)" }}>{selected.movieName}</h2><p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Showtime #{selected.showTimeId}</p></div></div><button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><X size={16} /></button></div>

            {/* One bordered panel for all detail fields (instead of 6 separate boxed
                cards) - cells share a single outer border and thin internal dividers,
                so it reads as one cohesive block rather than a loose grid of pills. */}
            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              {[
                [CalendarDays, "Date", formatDate(selected.showDate)],
                [Clock3, "Time", `${formatTime(selected.startTime)}–${formatTime(selected.endTime)}`],
                [Building2, "Cinema", selected.clusterName ?? "—"],
                [Monitor, "Room", selected.cinemaRoomName],
                [Armchair, "Availability", `${selected.availableSeats ?? "—"}/${selected.totalSeats ?? "—"}`],
                [Ticket, "From price", selected.price ? `${selected.price.toLocaleString("vi-VN")} ₫` : "—"],
              ].map(([Icon, label, value], index) => {
                const DetailIcon = Icon as typeof CalendarDays;
                return (
                  <div
                    key={String(label)}
                    className="p-3.5"
                    style={{
                      borderColor: "var(--border-color)",
                      borderRight: index % 2 === 0 ? "1px solid var(--border-color)" : undefined,
                      borderBottom: index < 4 ? "1px solid var(--border-color)" : undefined,
                    }}
                  >
                    <DetailIcon size={14} className="text-blue-600" />
                    <p className="mt-2 text-[9px] font-bold uppercase" style={{ color: "var(--text-sub)" }}>{String(label)}</p>
                    <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-main)" }}>{String(value)}</p>
                  </div>
                );
              })}
            </div>

            {/* Actions live in a matching bordered panel, same radius and border color as
                the detail panel above, so the modal reads as a consistent stack of
                sections rather than a boxed grid followed by loose floating buttons. */}
            {!readOnly && selected.status !== "CANCELLED" && selected.status !== "COMPLETED" && (
              <div className="mt-3 space-y-2 rounded-2xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const showtimeToEdit = selected;
                      setSelected(null);
                      setCancelPromptOpen(false);
                      setCancelReason("");
                      onEdit(showtimeToEdit);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-card)" }}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  {selected.status !== "ON_SALE" && <button type="button" disabled={busy} onClick={() => void onStatusChange(selected, "ON_SALE").then(() => setSelected(null))} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2 py-2.5 text-xs font-semibold text-emerald-600"><PlayCircle size={14} /> Open sales</button>}
                  {selected.status !== "SUSPENDED" && <button type="button" disabled={busy} onClick={() => void onStatusChange(selected, "SUSPENDED").then(() => setSelected(null))} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2 py-2.5 text-xs font-semibold text-amber-600"><PauseCircle size={14} /> Suspend</button>}
                </div>

                {!cancelPromptOpen ? (
                  <button type="button" onClick={() => setCancelPromptOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-600"><XCircle size={14} /> Cancel showtime</button>
                ) : (
                  <div className="rounded-xl border border-rose-500/20 p-3" style={{ background: "var(--bg-card)" }}>
                    <label className="text-xs font-semibold text-rose-500">Cancellation reason</label>
                    <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} placeholder="Required before cancellation" className="mt-2 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => { setCancelPromptOpen(false); setCancelReason(""); }} className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Keep showtime</button>
                      <button type="button" disabled={busy || !cancelReason.trim()} onClick={() => void onStatusChange(selected, "CANCELLED", cancelReason.trim()).then(() => setSelected(null))} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><XCircle size={14} /> Confirm cancellation</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {selected.status === "CANCELLED" && selected.cancellationReason && <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-500"><strong>Cancellation reason</strong><p className="mt-1">{selected.cancellationReason}</p></div>}
          </div>
        </div>
      )}

      <CustomerPreview open={previewOpen} showtimes={customerPreviewShowtimes} date={selectedDate} clusterId={clusterId} onClose={() => setPreviewOpen(false)} />
    </>
  );
}
