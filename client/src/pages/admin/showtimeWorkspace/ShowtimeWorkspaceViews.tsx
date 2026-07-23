import { useEffect, useMemo, useState, type ElementType, type MouseEvent } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Film,
  History,
  Loader2,
  Monitor,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import type { AutoShowtimeGenerationRunResponse, ShowtimeResponse } from "../../../api/showtimeApi";
import { showtimeApi } from "../../../api/showtimeApi";
import { loadRecentAutoScheduleRuns, type RecentAutoScheduleRun } from "../AutoScheduleShowtimePage";

type CreateChoiceProps = {
  open: boolean;
  canGenerate: boolean;
  onClose: () => void;
  onManual: () => void;
  onAutomatic: () => void;
};

type ChoiceCardProps = {
  icon: ElementType;
  title: string;
  description: string;
  bullets: string[];
  accent: string;
  iconBackground: string;
  actionLabel: string;
  disabled?: boolean;
  onClick: () => void;
};

function ChoiceCard({ icon: Icon, title, description, bullets, accent, iconBackground, actionLabel, disabled = false, onClick }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex h-full flex-col rounded-2xl border p-5 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed"
      style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", opacity: disabled ? 0.55 : 1 }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: iconBackground, color: accent }}>
          <Icon size={21} />
        </div>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: iconBackground, color: accent }}>
          Schedule workflow
        </span>
      </div>
      <h2 style={{ color: "var(--text-main)", fontSize: "16px", fontWeight: 700 }}>{title}</h2>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--text-sub)", fontSize: "12.5px" }}>{description}</p>
      <ul className="mt-4 flex-1 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: accent }} />
            {bullet}
          </li>
        ))}
      </ul>
      <span className="mt-5 inline-flex items-center gap-2 font-semibold transition-all group-hover:gap-3" style={{ color: accent, fontSize: "12.5px" }}>
        {actionLabel} <span aria-hidden="true">→</span>
      </span>
    </button>
  );
}
export function ShowtimeCreateChoiceDialog({ open, canGenerate, onClose, onManual, onAutomatic }: CreateChoiceProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 px-3 py-6 backdrop-blur-sm sm:px-6" onMouseDown={closeFromBackdrop}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="showtime-creation-method-title"
        className="relative max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border p-6 shadow-2xl sm:p-8"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
      >
        <button
          type="button"
          aria-label="Close schedule creation options"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:hover:bg-white/5"
          style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}
        >
          <X size={17} />
        </button>

        <div className="mb-7 pr-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
            <CalendarPlus size={23} />
          </div>
          <h1 id="showtime-creation-method-title" style={{ color: "var(--text-main)", fontSize: "22px", fontWeight: 750 }}>
            How would you like to create this schedule?
          </h1>
          <p className="mx-auto mt-2 max-w-2xl" style={{ color: "var(--text-sub)", fontSize: "13px" }}>
            Add one showtime for an exact slot, or generate a schedule for multiple movies and cinema clusters.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ChoiceCard
            icon={CalendarPlus}
            title="Add single showtime"
            description="Create one screening in a selected room and time slot. Best for exceptions and precise manual adjustments."
            bullets={["Choose movie, room, date and start time", "Validate the slot before saving", "Edit the showtime from the workspace"]}
            accent="#2563eb"
            iconBackground="rgba(37,99,235,0.10)"
            actionLabel="Open showtime form"
            onClick={onManual}
          />
          <ChoiceCard
            icon={Sparkles}
            title="Generate automatically"
            description="Build multiple showtimes from a selected date range, movie set and cinema scope using the active allocation policy."
            bullets={["Configure a multi-day generation scope", "Review before submitting the run", "Track created and skipped candidates"]}
            accent="#7c3aed"
            iconBackground="rgba(124,58,237,0.10)"
            actionLabel="Open schedule generator"
            disabled={!canGenerate}
            onClick={onAutomatic}
          />
        </div>
        {!canGenerate && (
          <p className="mt-4 text-center" style={{ color: "var(--text-sub)", fontSize: "11.5px" }}>
            Automatic generation is available to administrators only.
          </p>
        )}
      </section>
    </div>
  );
}
const formatTime = (time?: string) => time?.slice(0, 5) || "—";

export function ShowtimeCalendarView({ showtimes, onEdit }: { showtimes: ShowtimeResponse[]; onEdit: (showtime: ShowtimeResponse) => void }) {
  const availableDates = useMemo(() => Array.from(new Set(showtimes.map((item) => item.showDate))).sort(), [showtimes]);
  const [selectedDate, setSelectedDate] = useState(availableDates[0] ?? new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) setSelectedDate(availableDates[0]);
  }, [availableDates, selectedDate]);

  const rooms = useMemo(() => {
    const grouped = new Map<number, { name: string; items: ShowtimeResponse[] }>();
    showtimes.filter((item) => item.showDate === selectedDate).forEach((item) => {
      const group = grouped.get(item.cinemaRoomId) ?? { name: item.cinemaRoomName, items: [] };
      group.items.push(item);
      grouped.set(item.cinemaRoomId, group);
    });
    return Array.from(grouped.entries()).map(([id, group]) => ({ id, ...group, items: group.items.sort((a, b) => a.startTime.localeCompare(b.startTime)) }));
  }, [selectedDate, showtimes]);

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <p style={{ color: "var(--text-main)", fontSize: "14px", fontWeight: 700 }}>Room schedule</p>
          <p style={{ color: "var(--text-sub)", fontSize: "11.5px" }}>Daily timeline grouped by screening room</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-xl border px-3 py-2 outline-none"
          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "12.5px" }}
        />
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-14 text-center">
          <CalendarDays size={25} style={{ color: "var(--text-sub)" }} />
          <p className="mt-3" style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 650 }}>No showtimes on this date</p>
          <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "12px" }}>Choose another date or create a new schedule.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
          {rooms.map((room) => (
            <div key={room.id} className="grid gap-3 px-5 py-4 md:grid-cols-[180px_1fr]">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Monitor size={15} /></div>
                <div>
                  <p style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 650 }}>{room.name}</p>
                  <p style={{ color: "var(--text-sub)", fontSize: "11px" }}>{room.items.length} showtime{room.items.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {room.items.map((item) => (
                  <button
                    key={item.showTimeId}
                    type="button"
                    onClick={() => onEdit(item)}
                    className="min-w-40 rounded-xl border px-3 py-2 text-left transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}
                  >
                    <span className="flex items-center gap-1.5" style={{ color: "#2563eb", fontSize: "11.5px", fontWeight: 700 }}>
                      <Clock3 size={12} /> {formatTime(item.startTime)}–{formatTime(item.endTime)}
                    </span>
                    <span className="mt-1 block max-w-52 truncate" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>{item.movieName}</span>
                    <span className="mt-0.5 block" style={{ color: "var(--text-sub)", fontSize: "10.5px" }}>{item.status.replace(/_/g, " ")}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type RunWithDetails = RecentAutoScheduleRun & { detail?: AutoShowtimeGenerationRunResponse; loading?: boolean; unavailable?: boolean };

export function GenerationRunsView({ onOpenRun, onCreate }: { onOpenRun: (id: number) => void; onCreate: () => void }) {
  const [runs, setRuns] = useState<RunWithDetails[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => {
      const recent = loadRecentAutoScheduleRuns();
      setRuns(recent.map((item) => ({ ...item, loading: true })));
      void Promise.all(recent.map(async (item) => {
        try {
          const response = await showtimeApi.getAutoGenerationRun(item.generationRunId, 0, 1);
          return { ...item, detail: response.result } as RunWithDetails;
        } catch {
          return { ...item, unavailable: true } as RunWithDetails;
        }
      })).then((details) => active && setRuns(details));
    };
    load();
    window.addEventListener("auto-schedule-runs-updated", load);
    return () => {
      active = false;
      window.removeEventListener("auto-schedule-runs-updated", load);
    };
  }, []);

  if (runs.length === 0) {
    return (
      <div className="rounded-2xl border px-5 py-14 text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <History size={26} className="mx-auto" style={{ color: "var(--text-sub)" }} />
        <p className="mt-3" style={{ color: "var(--text-main)", fontSize: "14px", fontWeight: 700 }}>No generation runs in this browser yet</p>
        <p className="mx-auto mt-1 max-w-md" style={{ color: "var(--text-sub)", fontSize: "12px" }}>Run history is shown after an automatic schedule is submitted from this device.</p>
        <button type="button" onClick={onCreate} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white">
          <Sparkles size={14} /> Generate schedule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const status = run.detail?.status ?? (run.loading ? "LOADING" : "UNAVAILABLE");
        const success = status === "COMPLETED";
        const failed = status === "FAILED" || status === "UNAVAILABLE";
        return (
          <button
            key={run.generationRunId}
            type="button"
            onClick={() => onOpenRun(run.generationRunId)}
            className="flex w-full flex-wrap items-center gap-4 rounded-2xl border p-4 text-left transition-colors hover:border-blue-500/35 hover:bg-blue-500/[0.03]"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: failed ? "rgba(220,38,38,.08)" : success ? "rgba(5,150,105,.08)" : "rgba(37,99,235,.08)", color: failed ? "#dc2626" : success ? "#059669" : "#2563eb" }}>
              {run.loading ? <Loader2 size={18} className="animate-spin" /> : failed ? <XCircle size={18} /> : success ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
            </div>
            <div className="min-w-48 flex-1">
              <p style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 700 }}>Generation run #{run.generationRunId}</p>
              <p className="mt-0.5" style={{ color: "var(--text-sub)", fontSize: "11.5px" }}>{run.startDate} → {run.endDate}</p>
            </div>
            {run.detail && (
              <div className="flex items-center gap-5 text-right">
                <div><p style={{ color: "#059669", fontSize: "14px", fontWeight: 750 }}>{run.detail.summary.createdCount}</p><p style={{ color: "var(--text-sub)", fontSize: "10px" }}>Created</p></div>
                <div><p style={{ color: "#d97706", fontSize: "14px", fontWeight: 750 }}>{run.detail.summary.skippedCount}</p><p style={{ color: "var(--text-sub)", fontSize: "10px" }}>Skipped</p></div>
              </div>
            )}
            <span className="rounded-full px-2.5 py-1" style={{ background: failed ? "rgba(220,38,38,.08)" : success ? "rgba(5,150,105,.08)" : "rgba(37,99,235,.08)", color: failed ? "#dc2626" : success ? "#059669" : "#2563eb", fontSize: "10.5px", fontWeight: 700 }}>
              {status.replace(/_/g, " ")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

