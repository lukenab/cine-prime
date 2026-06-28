import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Ticket, Users, Star, Calendar, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Preset = "7D" | "30D" | "3M";

interface DateRange { start: Date; end: Date; }

// ── Mock data generators ───────────────────────────────────────────────────────
function generateDailyRevenue(days: number) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = days <= 30
      ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    const revenue = Math.round(8_000_000 + Math.random() * 14_000_000 + Math.sin(i / 3) * 4_000_000);
    const bookings = Math.round(60 + Math.random() * 120 + Math.sin(i / 2) * 30);
    data.push({ label, revenue, bookings });
  }
  // Collapse by month if 3M
  if (days > 30) {
    const byMonth: Record<string, { label: string; revenue: number; bookings: number }> = {};
    data.forEach((d) => {
      if (!byMonth[d.label]) byMonth[d.label] = { label: d.label, revenue: 0, bookings: 0 };
      byMonth[d.label].revenue  += d.revenue;
      byMonth[d.label].bookings += d.bookings;
    });
    return Object.values(byMonth);
  }
  return data;
}

const TOP_MOVIES = [
  { rank: 1, title: "Inside Out 3",           genre: "Animation", tickets: 1842, revenue: 73_680_000 },
  { rank: 2, title: "Avengers: Secret Wars",  genre: "Action",    tickets: 1650, revenue: 66_000_000 },
  { rank: 3, title: "Moana 2",                genre: "Animation", tickets: 1320, revenue: 52_800_000 },
  { rank: 4, title: "Mission Impossible 8",   genre: "Action",    tickets: 1105, revenue: 44_200_000 },
  { rank: 5, title: "Interstellar 2",         genre: "Sci-Fi",    tickets:  890, revenue: 35_600_000 },
];

const BOOKING_STATUS = [
  { name: "Confirmed", value: 3280, color: "#10b981" },
  { name: "Pending",   value:  640, color: "#f59e0b" },
  { name: "Cancelled", value:  410, color: "#ef4444" },
];

const ROOM_OCCUPANCY = [
  { room: "Hall 1",  rate: 88 },
  { room: "Hall 2",  rate: 74 },
  { room: "Hall 3",  rate: 91 },
  { room: "Hall 4",  rate: 62 },
  { room: "Hall 5",  rate: 79 },
  { room: "VIP 1",   rate: 95 },
];

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtVND(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B ₫`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)}M ₫`;
  return `${new Intl.NumberFormat("vi-VN").format(n)} ₫`;
}

function fmtVNDFull(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: color + "15" }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.02em", marginBottom: "4px" }}>
        {value}
      </p>
      <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
        {label}
      </p>
      <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>{sub}</p>
    </div>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "20px" }}>{title}</p>
      {children}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-4 py-3 shadow-lg" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "6px" }}>{label}</p>
      <p style={{ fontSize: "14px", fontWeight: 600, color: "#3b82f6" }}>{fmtVNDFull(payload[0]?.value)}</p>
      {payload[1] && <p style={{ fontSize: "13px", color: "#10b981" }}>{payload[1]?.value} bookings</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  const [preset, setPreset]         = useState<Preset>("30D");
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]     = useState("");

  const days = preset === "7D" ? 7 : preset === "30D" ? 30 : 90;
  const revenueData = useMemo(() => generateDailyRevenue(days), [days]);

  const totalRevenue  = revenueData.reduce((s, d) => s + d.revenue, 0);
  const totalBookings = revenueData.reduce((s, d) => s + d.bookings, 0);
  const totalConfirmed = BOOKING_STATUS[0].value;
  const avgOccupancy  = Math.round(ROOM_OCCUPANCY.reduce((s, r) => s + r.rate, 0) / ROOM_OCCUPANCY.length);

  const gridColor  = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisColor  = isDarkMode ? "rgba(255,255,255,0.3)"  : "rgba(0,0,0,0.35)";

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between" style={{ marginBottom: "28px" }}>
        <div>
          <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
            Reports & Analytics
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>Revenue, bookings, and performance overview.</p>
        </div>

        {/* Time filter */}
        <div className="flex items-center gap-2">
          {(["7D", "30D", "3M"] as Preset[]).map((p) => (
            <button key={p} onClick={() => { setPreset(p); setShowCustom(false); }}
              className="px-4 py-2 rounded-xl border text-sm font-medium transition-all"
              style={{
                background:   preset === p && !showCustom ? accentColor : "transparent",
                color:        preset === p && !showCustom ? "#fff" : "var(--text-sub)",
                borderColor:  preset === p && !showCustom ? accentColor : "var(--border-color)",
              }}>
              {p}
            </button>
          ))}

          {/* Custom range */}
          <button onClick={() => setShowCustom((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-all"
            style={{
              background:  showCustom ? accentColor : "transparent",
              color:       showCustom ? "#fff" : "var(--text-sub)",
              borderColor: showCustom ? accentColor : "var(--border-color)",
            }}>
            <Calendar size={13} /> Custom <ChevronDown size={12} />
          </button>

          {showCustom && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 rounded-xl border text-sm"
                style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)", outline: "none" }} />
              <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>→</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                min={customStart}
                className="px-3 py-2 rounded-xl border text-sm"
                style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)", outline: "none" }} />
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <KpiCard icon={TrendingUp} label="Total Revenue"    value={fmtVND(totalRevenue)}   sub={`Last ${days} days`}                  color="#3b82f6" />
        <KpiCard icon={Ticket}     label="Total Bookings"   value={totalBookings.toLocaleString()} sub={`${totalConfirmed} confirmed`}  color="#10b981" />
        <KpiCard icon={Users}      label="Avg Occupancy"    value={`${avgOccupancy}%`}       sub="Across all rooms"                    color="#f59e0b" />
        <KpiCard icon={Star}       label="Top Movie"        value={TOP_MOVIES[0].title.split(":")[0]} sub={`${TOP_MOVIES[0].tickets.toLocaleString()} tickets sold`} color="#a855f7" />
      </div>

      {/* ── Revenue + Booking status ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px", marginBottom: "20px" }}>

        {/* Revenue trend */}
        <ChartCard title="Revenue Trend">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false}
                interval={days <= 7 ? 0 : days <= 30 ? 4 : 0} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtVND(v)} width={72} />
              <Tooltip content={<RevenueTooltip />} />
              <Line type="monotone" dataKey="revenue" stroke={accentColor} strokeWidth={2.5}
                dot={false} activeDot={{ r: 5, fill: accentColor }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Booking status donut */}
        <ChartCard title="Booking Status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={BOOKING_STATUS} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                paddingAngle={3} dataKey="value">
                {BOOKING_STATUS.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v.toLocaleString(), "Bookings"]}
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", fontSize: "13px" }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => (
                <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{v}</span>
              )} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Top Movies + Occupancy ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", paddingBottom: "32px" }}>

        {/* Top Movies */}
        <ChartCard title="Top 5 Movies by Tickets Sold">
          <table className="w-full">
            <thead>
              <tr>
                {["#", "Movie", "Genre", "Tickets", "Revenue"].map((h, i) => (
                  <th key={h} className={`py-2 ${i === 0 ? "text-center w-8" : i >= 3 ? "text-right" : "text-left"}`}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_MOVIES.map((m) => (
                <tr key={m.rank} style={{ borderTop: "1px solid var(--border-color)" }}>
                  <td className="py-3 text-center">
                    <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold"
                      style={{
                        background: m.rank === 1 ? "#f59e0b18" : m.rank === 2 ? "rgba(148,163,184,0.15)" : "transparent",
                        color:      m.rank === 1 ? "#f59e0b"   : m.rank === 2 ? "#94a3b8" : "var(--text-sub)",
                      }}>
                      {m.rank}
                    </span>
                  </td>
                  <td className="py-3 pl-2" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{m.title}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
                      {m.genre}
                    </span>
                  </td>
                  <td className="py-3 text-right" style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500 }}>
                    {m.tickets.toLocaleString()}
                  </td>
                  <td className="py-3 text-right" style={{ fontSize: "13px", color: "#10b981", fontWeight: 500 }}>
                    {fmtVND(m.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        {/* Room Occupancy */}
        <ChartCard title="Room Occupancy Rate (%)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ROOM_OCCUPANCY} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }}
                tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="room" tick={{ fontSize: 12, fill: axisColor }}
                tickLine={false} axisLine={false} width={48} />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Occupancy"]}
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", fontSize: "13px" }}
                cursor={{ fill: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              />
              <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {ROOM_OCCUPANCY.map((entry) => (
                  <Cell key={entry.room}
                    fill={entry.rate >= 90 ? "#10b981" : entry.rate >= 75 ? accentColor : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3" style={{ justifyContent: "center" }}>
            {[["≥ 90%", "#10b981", "Excellent"], ["75–89%", accentColor, "Good"], ["< 75%", "#f59e0b", "Low"]].map(([label, color, desc]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>{desc} ({label})</span>
              </div>
            ))}
          </div>
        </ChartCard>

      </div>

      <style>{`.theme-dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`}</style>
    </>
  );
}
