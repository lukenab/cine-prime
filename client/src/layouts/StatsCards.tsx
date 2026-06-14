import { Users, UserCheck, UserX, TrendingUp } from "lucide-react";

const stats = [
  {
    label: "Total Users",
    value: "2,847",
    change: "+12.5%",
    positive: true,
    icon: Users,
    color: "blue",
  },
  {
    label: "Active Users",
    value: "2,391",
    change: "+8.2%",
    positive: true,
    icon: UserCheck,
    color: "emerald",
  },
  {
    label: "Inactive Users",
    value: "456",
    change: "-3.1%",
    positive: false,
    icon: UserX,
    color: "rose",
  },
  {
    label: "New This Month",
    value: "184",
    change: "+24.3%",
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

export function StatsCards() {
  return (
    <div className="grid grid-cols-4 gap-5">
      {stats.map(({ label, value, change, positive, icon: Icon, color }) => {
        const c = colorMap[color];
        return (
          <div
            key={label}
            className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500" style={{ fontSize: "13px" }}>
                  {label}
                </p>
                <p className="text-gray-900 mt-1" style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1.1 }}>
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
              <span className="text-gray-400" style={{ fontSize: "11px" }}>
                vs last month
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
