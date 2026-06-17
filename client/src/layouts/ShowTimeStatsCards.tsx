import { CalendarClock, MonitorPlay, Clock, CalendarCheck } from "lucide-react";

const stats = [
  { label: "Total Showtimes", value: "342", change: "+24", positive: true, icon: CalendarClock, color: "blue" },
  { label: "Showing Today", value: "48", change: "+5", positive: true, icon: MonitorPlay, color: "emerald" },
  { label: "Upcoming Shows", value: "126", change: "+12", positive: true, icon: CalendarCheck, color: "violet" },
  { label: "Avg. Duration", value: "115m", change: "-2m", positive: false, icon: Clock, color: "rose" },
];

const colorMap: Record<string, { bg: string; icon: string }> = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
  rose: { bg: "bg-rose-50", icon: "text-rose-500" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600" },
};

export function ShowtimeStatsCards() {
  return (
    <div className="grid grid-cols-4 gap-5 mb-6">
      {stats.map(({ label, value, change, positive, icon: Icon, color }) => {
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
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`} style={{ fontSize: "11px" }}>
                {change}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>vs last week</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}