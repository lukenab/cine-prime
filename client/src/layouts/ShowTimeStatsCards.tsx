import { CalendarClock, CirclePause, TicketCheck, Clock } from "lucide-react";
import type { ShowtimeResponse } from "../api/showtimeApi";

type Props = { showtimes: ShowtimeResponse[]; loading?: boolean };

// Same big-tile stat card look as the Cinema Cluster management page
// (ManageCinemaClusterPage.tsx "Stats" grid): rounded-2xl card, 44px icon
// chip, label above value.
const COLOR_STYLES: Record<string, { bg: string; icon: string }> = {
  blue:    { bg: "bg-blue-50",    icon: "text-blue-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-600" },
};

export function ShowtimeStatsCards({ showtimes, loading = false }: Props) {
  const stats = [
    {
      label: "Total Showtimes",
      value: showtimes.filter((showtime) => showtime.status !== "CANCELLED").length,
      icon: CalendarClock,
      color: "blue",
    },
    {
      label: "On Sale",
      value: showtimes.filter((showtime) => showtime.status === "ON_SALE").length,
      icon: TicketCheck,
      color: "emerald",
    },
    {
      label: "Internal",
      value: showtimes.filter((showtime) => showtime.status === "SCHEDULED").length,
      icon: Clock,
      color: "violet",
    },
    {
      label: "Suspended",
      value: showtimes.filter((showtime) => showtime.status === "SUSPENDED").length,
      icon: CirclePause,
      color: "amber",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Showtime summary">
      {stats.map(({ label, value, icon: Icon, color }) => {
        const { bg, icon } = COLOR_STYLES[color];
        return (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border p-5"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${bg}`}>
              <Icon size={18} className={icon} />
            </div>
            <div>
              <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>{label}</p>
              <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>
                {loading ? "—" : value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
