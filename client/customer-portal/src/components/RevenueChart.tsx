import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const weeklyData = [
  { day: "Mon", revenue: 42300, tickets: 880 },
  { day: "Tue", revenue: 38100, tickets: 740 },
  { day: "Wed", revenue: 55400, tickets: 1100 },
  { day: "Thu", revenue: 61200, tickets: 1240 },
  { day: "Fri", revenue: 87500, tickets: 1820 },
  { day: "Sat", revenue: 124000, tickets: 2560 },
  { day: "Sun", revenue: 118300, tickets: 2390 },
];

// Thêm isDarkMode vào props của Tooltip để đổi màu nền Tooltip theo theme
function CustomTooltip({ active, payload, label, metric, isDarkMode }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;

  // Điều chỉnh màu sắc giá trị trong tooltip
  const valueColor = metric === "revenue" ? (isDarkMode ? "#FFD700" : "#d97706") : isDarkMode ? "#60A5FA" : "#3b82f6";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isDarkMode ? "rgba(255,215,0,0.18)" : "rgba(218,165,32,0.3)"}`,
        borderRadius: "8px",
        padding: "10px 14px",
        fontFamily: "Inter, sans-serif",
        boxShadow: isDarkMode ? "0 8px 32px rgba(0,0,0,0.7)" : "0 8px 24px rgba(0,0,0,0.08)",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          color: "var(--text-sub)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>
      <div style={{ color: valueColor, fontSize: "15px", fontWeight: 600 }}>
        {metric === "revenue" ? `$${val?.toLocaleString()}` : `${val?.toLocaleString()} tickets`}
      </div>
    </div>
  );
}

interface RevenueChartProps {
  isDarkMode?: boolean;
}

export function RevenueChart({ isDarkMode = true }: RevenueChartProps) {
  const [metric, setMetric] = useState<"revenue" | "tickets">("revenue");

  // Tinh chỉnh màu chủ đạo cho 2 đường line chart theo Theme
  const color =
    metric === "revenue"
      ? isDarkMode
        ? "#FFD700"
        : "#d97706" // Vàng sáng (Dark) -> Cam đậm (Light)
      : isDarkMode
        ? "#60A5FA"
        : "#3b82f6"; // Xanh pastel (Dark) -> Xanh dương (Light)

  const gradientId = `chart-grad-${metric}`;

  const formatY = (v: number) => (metric === "revenue" ? `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}` : `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "24px 28px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        transition: "all 0.25s ease",
      }}
    >
      {/* Top shimmer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: isDarkMode
            ? "linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.45) 50%, transparent 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(218,165,32,0.4) 50%, transparent 100%)",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "28px",
        }}
      >
        <div>
          <h2
            style={{
              color: "var(--text-main)",
              fontWeight: 600,
              fontSize: "15px",
              marginBottom: "4px",
              letterSpacing: "0.01em",
              transition: "color 0.2s ease",
            }}
          >
            Weekly Revenue Trends
          </h2>
          <p style={{ color: "var(--text-sub)", fontSize: "12px", transition: "color 0.2s ease" }}>Mon – Sun · Current week performance</p>
        </div>

        {/* Buttons toggle Revenue/Tickets */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            background: isDarkMode ? "#0f0f0f" : "#e4e6eb",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "3px",
            transition: "background 0.2s ease",
          }}
        >
          {(["revenue", "tickets"] as const).map((m) => {
            const isActive = metric === m;
            return (
              <button
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: "5px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: isActive ? (isDarkMode ? "rgba(255,215,0,0.1)" : "rgba(218,165,32,0.15)") : "transparent",
                  color: isActive ? color : "var(--text-sub)",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  boxShadow: isActive && isDarkMode ? "0 0 10px rgba(255,215,0,0.12)" : "none",
                  transition: "all 0.15s ease",
                  letterSpacing: "0.02em",
                }}
              >
                {m === "revenue" ? "Revenue" : "Tickets"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: "260px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeklyData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={isDarkMode ? 0.3 : 0.15} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"} strokeDasharray="0" />
            <XAxis
              dataKey="day"
              tick={{
                fill: isDarkMode ? "#555" : "#888",
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
              }}
              axisLine={{ stroke: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)" }}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tick={{
                fill: isDarkMode ? "#555" : "#888",
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatY}
              width={52}
            />
            <Tooltip
              content={<CustomTooltip metric={metric} isDarkMode={isDarkMode} />}
              cursor={{
                stroke: isDarkMode ? "rgba(255,215,0,0.15)" : "rgba(218,165,32,0.25)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: color,
                strokeWidth: 0,
                style: {
                  filter: `drop-shadow(0 0 6px ${color})`,
                },
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary row */}
      <div
        style={{
          display: "flex",
          gap: "28px",
          marginTop: "20px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border-color)",
          transition: "border-color 0.2s ease",
        }}
      >
        {[
          { label: "Peak Day", value: "Saturday" },
          {
            label: "Total Revenue",
            value: `$${weeklyData.reduce((s, d) => s + d.revenue, 0).toLocaleString()}`,
          },
          {
            label: "Total Tickets",
            value: weeklyData.reduce((s, d) => s + d.tickets, 0).toLocaleString(),
          },
          { label: "Avg. Daily", value: "$75,114" },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ color: "var(--text-sub)", fontSize: "11px", marginBottom: "3px", transition: "color 0.2s ease" }}>{label}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "13.5px", fontWeight: 600, transition: "color 0.2s ease" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
