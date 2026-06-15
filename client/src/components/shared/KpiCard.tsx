import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  sparkData: number[];
  icon: ReactNode;
  accentColor?: string;
  isDarkMode?: boolean; // Nhận prop theme từ cha
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel,
  sparkData,
  icon,
  accentColor = "#FFD700",
  isDarkMode = true,
}: KpiCardProps) {
  const chartData = sparkData.map((v) => ({ v }));
  const isPositive = change >= 0;
  const gradientId = `spark-${title.replace(/\s+/g, "-")}`;

  // Đổi màu sắc mũi tên xu hướng để đảm bảo độ tương phản (WCAG) trên nền sáng
  const trendColor = isPositive 
    ? (isDarkMode ? "#4ade80" : "#16a34a") 
    : (isDarkMode ? "#f87171" : "#dc2626");

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "22px 24px 18px",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.25s ease", // Bao gồm cả transition cho background và border
        cursor: "default",
        fontFamily: "Inter, sans-serif",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        // Đậm viền lên một chút khi hover
        el.style.borderColor = `${accentColor}${isDarkMode ? '40' : '60'}`;
        // Tối ưu hiệu ứng đổ bóng cho nền sáng và nền tối
        el.style.boxShadow = isDarkMode 
          ? `0 0 32px ${accentColor}15` 
          : `0 8px 24px ${accentColor}20`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--border-color)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Top shimmer line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1.5px",
          background: `linear-gradient(90deg, transparent 0%, ${accentColor}${isDarkMode ? '50' : '80'} 50%, transparent 100%)`,
        }}
      />

      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            color: "var(--text-sub)",
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            transition: "color 0.2s ease",
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "9px",
            background: `${accentColor}${isDarkMode ? '12' : '15'}`,
            border: `1px solid ${accentColor}${isDarkMode ? '22' : '35'}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor,
            boxShadow: isDarkMode ? `0 0 14px ${accentColor}25` : `0 4px 10px ${accentColor}15`,
            transition: "all 0.2s ease",
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value */}
      <div
        style={{
          color: "var(--text-main)",
          fontSize: "30px",
          fontWeight: 600,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          marginBottom: "16px",
          transition: "color 0.2s ease",
        }}
      >
        {value}
      </div>

      {/* Sparkline Chart */}
      <div style={{ height: "44px", margin: "0 -4px 12px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                {/* Ở Light Mode, giảm opacity của mảng màu dưới biểu đồ để không bị lem nhem */}
                <stop offset="0%" stopColor={accentColor} stopOpacity={isDarkMode ? 0.35 : 0.2} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={accentColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Change badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        {isPositive ? (
          <TrendingUp size={12} style={{ color: trendColor }} />
        ) : (
          <TrendingDown size={12} style={{ color: trendColor }} />
        )}
        <span
          style={{
            color: trendColor,
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {isPositive ? "+" : ""}
          {change}%
        </span>
        <span style={{ color: "var(--text-sub)", fontSize: "12px", transition: "color 0.2s ease" }}>
          {changeLabel}
        </span>
      </div>
    </div>
  );
}