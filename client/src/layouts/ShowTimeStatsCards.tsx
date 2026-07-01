import { CalendarClock, MonitorPlay, Clock, CalendarCheck } from "lucide-react";
import type { ShowtimeResponse } from "../api/showtimeApi";

type Props = { showtimes: ShowtimeResponse[] };

export function ShowtimeStatsCards({ showtimes }: Props) {
  const total     = showtimes.length;
  const ongoing   = showtimes.filter((s) => s.status === "ONGOING").length;
  const scheduled = showtimes.filter((s) => s.status === "SCHEDULED").length;

  const avgMinutes = (() => {
    if (total === 0) return 0;
    const durations = showtimes.map((s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    }).filter((d) => d > 0);
    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  })();

  const stats = [
    { label: "Total Showtimes",  value: String(total),       icon: CalendarClock, color: "blue"    },
    { label: "Showing Now",      value: String(ongoing),     icon: MonitorPlay,   color: "emerald" },
    { label: "Upcoming Shows",   value: String(scheduled),   icon: CalendarCheck, color: "violet"  },
    { label: "Avg. Duration",    value: avgMinutes ? `${avgMinutes}m` : "—", icon: Clock, color: "rose" },
  ];

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue:    { bg: "bg-blue-50",    icon: "text-blue-600"    },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
    rose:    { bg: "bg-rose-50",    icon: "text-rose-500"    },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-600"  },
  };

  return (
    <div className="grid grid-cols-4 gap-5 mb-6">
      {stats.map(({ label, value, icon: Icon, color }) => {
        const c = colorMap[color];
        return (
          <div
            key={label}
            className="rounded-2xl border p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1.1, color: "var(--text-main)", marginTop: "4px" }}>
                  {value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                <Icon size={18} className={c.icon} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
