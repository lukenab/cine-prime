import { CalendarClock, CirclePause, TicketCheck } from "lucide-react";
import type { ShowtimeResponse } from "../api/showtimeApi";

type Props = { showtimes: ShowtimeResponse[] };

export function ShowtimeStatsCards({ showtimes }: Props) {
  const stats = [
    {
      label: "Total",
      value: showtimes.filter((showtime) => showtime.status !== "CANCELLED").length,
      icon: CalendarClock,
      color: "#2563eb",
    },
    {
      label: "On sale",
      value: showtimes.filter((showtime) => showtime.status === "ON_SALE").length,
      icon: TicketCheck,
      color: "#059669",
    },
    {
      label: "Internal",
      value: showtimes.filter((showtime) => showtime.status === "SCHEDULED").length,
      icon: CalendarClock,
      color: "#64748b",
    },
    {
      label: "Suspended",
      value: showtimes.filter((showtime) => showtime.status === "SUSPENDED").length,
      icon: CirclePause,
      color: "#d97706",
    },
  ].filter((stat) => stat.label !== "Suspended" || stat.value > 0);

  return (
    <div
      className="flex min-h-12 flex-wrap items-center gap-x-1 gap-y-2 rounded-xl border px-2 py-1.5"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
      aria-label="Showtime summary"
    >
      {stats.map(({ label, value, icon: Icon, color }, index) => (
        <div
          key={label}
          className={`flex items-center gap-2 px-3 py-2 ${index > 0 ? "border-l" : ""}`}
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}14`, color }}>
            <Icon size={14} />
          </div>
          <strong className="text-base leading-none" style={{ color: "var(--text-main)" }}>{value}</strong>
          <span className="text-xs font-medium" style={{ color: "var(--text-sub)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
