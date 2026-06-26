import { Ticket, Clock, CheckCircle, XCircle } from "lucide-react";

interface Props {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
}

export function BookingStatsCards({ total, pending, confirmed, cancelled }: Props) {
  const cards = [
    {
      label: "Total Bookings",
      value: total,
      icon: Ticket,
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.18)",
    },
    {
      label: "Pending",
      value: pending,
      icon: Clock,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.18)",
    },
    {
      label: "Confirmed",
      value: confirmed,
      icon: CheckCircle,
      color: "#10b981",
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.18)",
    },
    {
      label: "Cancelled",
      value: cancelled,
      icon: XCircle,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.18)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "28px",
      }}
    >
      {cards.map(({ label, value, icon: Icon, color, bg, border }) => (
        <div
          key={label}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "20px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            transition: "border-color 0.2s",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: bg,
              border: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={18} style={{ color }} />
          </div>
          <div>
            <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1 }}>
              {value}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "4px" }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
