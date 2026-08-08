import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertCircle, Activity, BadgeDollarSign, Building2, CalendarClock, CircleDollarSign, Info, RefreshCw, TicketCheck,
  TrendingDown, TrendingUp, UtensilsCrossed, WalletCards,
} from "lucide-react";
import { analyticsApi, type AdminAnalyticsBranchRanking, type AdminAnalyticsDailyPoint, type AdminAnalyticsSummary } from "../../api/analyticsApi";
import { movieApi, type ClusterResponse } from "../../api/movieApi";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => formatDate(new Date(new Date(value).getTime() + days * 86400000));
const daySpan = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const formatMoney = (value: number) => money.format(value ?? 0);
const formatMoneyCompact = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B ₫`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ₫`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K ₫`;
  return `${value} ₫`;
};

const formatDayLabel = (iso: string) => {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
};

const formatRelativeAge = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return null;
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/** null means "no prior-period baseline to compare against" — the UI omits the badge rather than showing a fake ∞%. */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function TrendBadge({ delta, invert = false }: { delta: number | null; invert?: boolean }) {
  if (delta === null || Number.isNaN(delta)) return null;
  const rounded = Math.round(delta);
  if (rounded === 0) return <span className="text-[11px] font-medium" style={{ color: "var(--text-sub)" }}>Flat vs previous period</span>;
  const isUp = rounded > 0;
  const good = invert ? !isUp : isUp;
  const color = good ? "#34d399" : "#fb7185";
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color }}>
      <Icon size={12} /> {isUp ? "+" : ""}{rounded}% <span className="font-normal" style={{ color: "var(--text-sub)" }}>vs previous period</span>
    </span>
  );
}

function KpiCard({
  title, value, helper, delta, invert, icon, accent,
}: { title: string; value: string; helper?: string; delta: number | null; invert?: boolean; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${accent}18`, color: accent }}>{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>{title}</p>
      {helper && <p className="mt-1 text-[11px]" style={{ color: "var(--text-sub)" }}>{helper}</p>}
      <div className="mt-2 h-4">
        <TrendBadge delta={delta} invert={invert} />
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{title}</p>
      {subtitle && <p className="mt-0.5 text-xs" style={{ color: "var(--text-sub)" }}>{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function fieldClass(): string {
  return "h-10 rounded-xl border px-3 text-sm outline-none transition-colors focus:border-blue-500";
}

export default function AdminDashboard() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [clusterId, setClusterId] = useState<number | null>(null);
  const [from, setFrom] = useState(() => formatDate(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => formatDate(new Date()));
  const [rangePreset, setRangePreset] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<AdminAnalyticsDailyPoint[]>([]);
  const [rankings, setRankings] = useState<AdminAnalyticsBranchRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClusters = useCallback(async () => {
    try {
      const response = await movieApi.getClusters();
      const items = response.result ?? [];
      setClusters(items);
    } catch {
      setError("Could not load cinema branches.");
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    const span = daySpan(from, to);
    const previousFrom = addDays(from, -span);
    const previousTo = addDays(from, -1);
    try {
      const [current, previous, dailyPoints, branchRankings] = await Promise.all([
        analyticsApi.getAdminSummary({ ...(clusterId ? { clusterId } : {}), from, to }),
        analyticsApi.getAdminSummary({ ...(clusterId ? { clusterId } : {}), from: previousFrom, to: previousTo }).catch(() => null),
        analyticsApi.getAdminDaily({ ...(clusterId ? { clusterId } : {}), from, to }).catch(() => []),
        analyticsApi.getAdminBranchRanking({ from, to }).catch(() => []),
      ]);
      setSummary(current);
      setPreviousSummary(previous);
      setDaily(dailyPoints);
      setRankings(branchRankings);
    } catch (reason: any) {
      setSummary(null);
      setPreviousSummary(null);
      setDaily([]);
      setRankings([]);
      setError(reason?.response?.data?.message ?? "Analytics data is not available yet. Complete a confirmed booking first.");
    } finally {
      setLoading(false);
    }
  }, [clusterId, from, to]);

  useEffect(() => { void loadClusters(); }, [loadClusters]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const branchName = useMemo(() => clusterId
    ? clusters.find((item) => item.clusterId === clusterId)?.clusterName ?? `Cluster ${clusterId}`
    : "All cinemas", [clusters, clusterId]);
  const coverageText = useMemo(() => {
    if (clusterId) {
      const selected = clusters.find((item) => item.clusterId === clusterId);
      return selected?.totalRooms ? `${selected.totalRooms} rooms` : "1 branch";
    }
    const roomCount = clusters.reduce((total, cluster) => total + (cluster.totalRooms ?? 0), 0);
    return roomCount > 0 ? `${clusters.length} branches / ${roomCount} rooms` : `${clusters.length} branches`;
  }, [clusters, clusterId]);
  const dataThrough = summary?.dataThrough ? new Date(summary.dataThrough).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Waiting for booking events";
  const hasActivity = !!summary && (summary.confirmedBookings > 0 || summary.refundCount > 0 || summary.grossRevenue > 0);
  const averageOrderValue = summary?.averageOrderValue ?? (summary && summary.confirmedBookings > 0 ? summary.grossRevenue / summary.confirmedBookings : 0);
  const refundRate = summary?.refundRate ?? (summary && summary.confirmedBookings > 0 ? (summary.refundCount / summary.confirmedBookings) * 100 : 0);
  const comparison = summary?.previousPeriod;
  const freshnessLabel = summary?.dataFreshnessStatus === "FRESH" ? "Fresh data"
    : summary?.dataFreshnessStatus === "STALE" ? "Data may be delayed" : "No event data";
  const freshnessAge = formatRelativeAge(summary?.dataFreshnessSeconds);
  const freshnessText = summary?.dataThrough
    ? `Updated ${freshnessAge ?? "recently"}`
    : "No events yet";
  const freshnessTooltip = summary?.dataThrough
    ? `${freshnessLabel}. Latest event received ${dataThrough}.`
    : "No confirmed booking events have been projected for this scope and period.";

  const chartData = useMemo(
    () => daily.map((point) => ({ ...point, label: formatDayLabel(point.date) })),
    [daily],
  );

  const composition = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Tickets", value: summary.ticketRevenue, color: "#60a5fa" },
      { name: "Concessions", value: summary.concessionRevenue, color: "#38bdf8" },
      { name: "Refunded", value: summary.refundAmount, color: "#fb7185" },
    ].filter((slice) => slice.value > 0);
  }, [summary]);

  const gridColor = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisColor = isDarkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)";
  const accentColor = "#60a5fa";

  const cards = summary ? [
    {
      title: "Gross revenue", value: formatMoneyCompact(summary.grossRevenue), helper: "Tickets + concessions",
      delta: comparison?.grossRevenueChangePercent ?? (previousSummary ? percentChange(summary.grossRevenue, previousSummary.grossRevenue) : null),
      icon: <CircleDollarSign size={18} />, accent: "#60a5fa",
    },
    {
      title: "Confirmed bookings", value: summary.confirmedBookings.toLocaleString(), helper: "Completed customer orders",
      delta: comparison?.confirmedBookingsChangePercent ?? (previousSummary ? percentChange(summary.confirmedBookings, previousSummary.confirmedBookings) : null),
      icon: <TicketCheck size={18} />, accent: "#38bdf8",
    },
    {
      title: "Tickets sold", value: summary.ticketsSold.toLocaleString(), helper: "Admissions in selected period",
      delta: comparison?.ticketsSoldChangePercent ?? (previousSummary ? percentChange(summary.ticketsSold, previousSummary.ticketsSold) : null),
      icon: <WalletCards size={18} />, accent: "#818cf8",
    },
    {
      title: "Average order value", value: averageOrderValue ? formatMoneyCompact(averageOrderValue) : "—", helper: "Gross revenue / booking",
      delta: comparison?.averageOrderValueChangePercent ?? (previousSummary && previousSummary.confirmedBookings > 0
        ? percentChange(averageOrderValue, previousSummary.grossRevenue / previousSummary.confirmedBookings) : null),
      icon: <BadgeDollarSign size={18} />, accent: "#2563eb",
    },
  ] : [];

  const applyRangePreset = (preset: "today" | "7d" | "30d" | "custom") => {
    setRangePreset(preset);
    if (preset === "custom") return;
    const end = new Date();
    const start = new Date();
    if (preset === "7d") start.setDate(end.getDate() - 6);
    if (preset === "30d") start.setDate(end.getDate() - 29);
    setFrom(formatDate(start));
    setTo(formatDate(end));
  };

  return (
    <div style={{ color: "var(--text-main)" }}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-blue-400" />
            <h1 className="text-[22px] font-bold tracking-tight">Business overview</h1>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--text-sub)" }}>Revenue, bookings and concession performance across CinePrime.</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 w-[220px] max-w-full items-center gap-2 rounded-xl border px-3 text-sm" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
            <Building2 size={15} className="text-blue-400" />
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-sub)" }}>Scope</span>
            <select
              aria-label="Cinema branch"
              value={clusterId ?? ""}
              onChange={(event) => setClusterId(Number(event.target.value) || null)}
              className="min-w-0 w-full bg-transparent outline-none"
              style={{ color: "var(--text-main)" }}
            >
              <option value="">All cinemas</option>
              {clusters.map((cluster) => <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.clusterName}</option>)}
            </select>
          </label>
          <div className="flex h-10 items-center rounded-xl border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
            {(["today", "7d", "30d", "custom"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyRangePreset(preset)}
                className="h-8 rounded-lg px-3 text-xs font-semibold transition-colors"
                style={{ background: rangePreset === preset ? "#2563eb" : "transparent", color: rangePreset === preset ? "white" : "var(--text-sub)" }}
              >
                {preset === "today" ? "Today" : preset === "7d" ? "Last 7 days" : preset === "30d" ? "Last 30 days" : "Custom"}
              </button>
            ))}
          </div>
          {rangePreset === "custom" && (
            <div className="flex items-center gap-2">
              <input aria-label="From date" type="date" value={from} max={to} onChange={(event) => { setRangePreset("custom"); setFrom(event.target.value); }}
                className={fieldClass()} style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)" }} />
              <span className="text-xs" style={{ color: "var(--text-sub)" }}>to</span>
              <input aria-label="To date" type="date" value={to} min={from} max={formatDate(new Date())} onChange={(event) => { setRangePreset("custom"); setTo(event.target.value); }}
                className={fieldClass()} style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)" }} />
            </div>
          )}
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
            aria-label="Refresh analytics"
            title="Refresh analytics"
            className="grid h-10 w-10 place-items-center rounded-xl border transition-colors hover:border-blue-500 hover:text-blue-500"
            style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)", cursor: loading ? "wait" : "pointer" }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="ml-auto flex min-w-0 items-center gap-2 text-[11px]" style={{ color: "var(--text-sub)" }}>
            <span className="hidden whitespace-nowrap lg:inline">{coverageText}</span>
            <span className="hidden whitespace-nowrap text-[10px] xl:inline">{from} - {to}</span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={freshnessTooltip}>
              <CalendarClock size={13} /> {freshnessText}
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: summary?.dataFreshnessStatus === "STALE" ? "#fbbf24" : summary?.dataFreshnessStatus === "FRESH" ? "#34d399" : "#94a3b8" }} />
              <Info size={12} aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" style={{ color: "#fb7185", borderColor: "#fb718544", background: "#fb71850d" }}>
          <AlertCircle size={16} />{error}
        </div>
      )}

      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border" style={{ height: 132, background: "var(--bg-card)", borderColor: "var(--border-color)" }} />
          ))
          : cards.map((card) => <KpiCard key={card.title} {...card} />)}
      </div>

      {!loading && summary && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
          <ChartCard title="Revenue trend" subtitle={`${branchName} · ${from} → ${to}`}>
            {!hasActivity ? (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                <TrendingUp size={22} style={{ color: "var(--text-sub)" }} />
                <p className="text-sm" style={{ color: "var(--text-sub)" }}>No confirmed activity in this period yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} tickFormatter={formatMoneyCompact} width={60} />
                  <Tooltip
                    formatter={(value: any, name: any) => [formatMoney(Number(value)), name === "grossRevenue" ? "Gross revenue" : String(name)]}
                    labelFormatter={(label) => `Day ${label}`}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, fontSize: 13 }}
                  />
                  <Area type="monotone" dataKey="grossRevenue" stroke={accentColor} strokeWidth={2.5} fill="url(#revenueFill)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Revenue composition" subtitle="Revenue mix for selected period">
            {composition.length === 0 ? (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                <CircleDollarSign size={22} style={{ color: "var(--text-sub)" }} />
                <p className="text-sm" style={{ color: "var(--text-sub)" }}>Nothing to break down yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
                <PieChart>
                  <Pie data={composition} cx="50%" cy="46%" innerRadius={58} outerRadius={86} paddingAngle={3} dataKey="value">
                    {composition.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [formatMoney(Number(value)), String(name)]}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, fontSize: 13 }}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs" style={{ color: "var(--text-sub)" }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

       {!loading && summary && (
         <div className="mt-4 grid gap-4 md:grid-cols-3">
           <KpiCard
             title="Refund health"
             value={`${summary.refundCount.toLocaleString()} refunds`}
             helper={`${refundRate.toFixed(1)}% of confirmed bookings`}
             delta={comparison?.refundRateChangePercent ?? (previousSummary ? percentChange(summary.refundRate, previousSummary.refundRate) : null)}
             invert
             icon={<RefreshCw size={18} />}
             accent="#fb7185"
           />
           <KpiCard
             title="Concession revenue"
             value={formatMoneyCompact(summary.concessionRevenue)}
             helper="Food and beverage sales"
             delta={previousSummary ? percentChange(summary.concessionRevenue, previousSummary.concessionRevenue) : null}
             icon={<UtensilsCrossed size={18} />}
             accent="#38bdf8"
           />
           <KpiCard
             title="Net revenue"
             value={formatMoneyCompact(summary.netRevenue)}
             helper="Gross revenue after refunds"
             delta={previousSummary ? percentChange(summary.netRevenue, previousSummary.netRevenue) : null}
             icon={<WalletCards size={18} />}
             accent="#2563eb"
           />
         </div>
       )}

       {!loading && rankings.length > 0 && (
         <div className="mt-4">
           <ChartCard title="Branch performance" subtitle="Ranked by gross revenue for the selected period">
             <div className="overflow-x-auto">
               <table className="w-full min-w-[620px] text-left text-xs">
                 <thead style={{ color: "var(--text-sub)" }}>
                   <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
                     <th className="pb-3 pr-3 font-medium">Rank</th>
                     <th className="pb-3 pr-3 font-medium">Cinema branch</th>
                     <th className="pb-3 pr-3 font-medium">Bookings</th>
                     <th className="pb-3 pr-3 font-medium">Tickets</th>
                     <th className="pb-3 pr-3 font-medium">Gross revenue</th>
                     <th className="pb-3 font-medium">Refund rate</th>
                   </tr>
                 </thead>
                 <tbody>
                   {rankings.map((item) => (
                     <tr key={item.clusterId} className="border-b last:border-b-0" style={{ borderColor: "var(--border-color)" }}>
                       <td className="py-3 pr-3 font-semibold" style={{ color: item.rank === 1 ? "#60a5fa" : "var(--text-sub)" }}>#{item.rank}</td>
                       <td className="py-3 pr-3 font-semibold" style={{ color: "var(--text-main)" }}>{clusters.find((cluster) => cluster.clusterId === item.clusterId)?.clusterName ?? `Cluster ${item.clusterId}`}</td>
                       <td className="py-3 pr-3" style={{ color: "var(--text-main)" }}>{item.confirmedBookings.toLocaleString()}</td>
                       <td className="py-3 pr-3" style={{ color: "var(--text-sub)" }}>{item.ticketsSold.toLocaleString()}</td>
                       <td className="py-3 pr-3 font-semibold" style={{ color: "#60a5fa" }}>{formatMoneyCompact(item.grossRevenue)}</td>
                       <td className="py-3" style={{ color: item.refundRate > 5 ? "#fb7185" : "var(--text-sub)" }}>{item.refundRate.toFixed(1)}%</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </ChartCard>
         </div>
       )}

       {!loading && !summary && !error && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm" style={{ color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
          No analytics facts for this branch and date range.
        </div>
      )}

       <div className="mt-5 text-[11px]" style={{ color: "var(--text-sub)" }}>
         Confirmed booking events only · scope: {branchName}
       </div>
    </div>
  );
}
