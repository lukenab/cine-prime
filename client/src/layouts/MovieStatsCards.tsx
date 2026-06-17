import { Film, PlayCircle, Calendar, TrendingUp } from "lucide-react";

const stats = [
  {
    label: "Total Movies",
    value: "156",
    change: "+12",
    positive: true,
    icon: Film,
    color: "blue",
  },
  {
    label: "Now Showing",
    value: "24",
    change: "+3",
    positive: true,
    icon: PlayCircle,
    color: "emerald",
  },
  {
    label: "Coming Soon",
    value: "18",
    change: "-2",
    positive: false,
    icon: Calendar,
    color: "rose",
  },
  {
    label: "Top Trending",
    value: "8",
    change: "+25.4%",
    positive: true,
    icon: TrendingUp,
    color: "violet",
  },
];

const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-600" },
  rose: { bg: "bg-rose-50", icon: "text-rose-500", text: "text-rose-500" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600", text: "text-violet-600" },
};

export function MovieStatsCards() {
  return (
    <div className="grid grid-cols-4 gap-5 mb-6">
      {stats.map(({ label, value, change, positive, icon: Icon, color }) => {
        const c = colorMap[color];
        return (
          <div
            key={label}
            className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  {label}
                </p>
                <p style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1.1, color: "var(--text-main)", marginTop: "4px" }}>
                  {value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                <Icon size={18} className={c.icon} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                  positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
                }`}
                style={{ fontSize: "11px" }}
              >
                {change}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                vs last month
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}