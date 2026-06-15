import { useState } from "react";
import { ArrowUpDown, ExternalLink } from "lucide-react";

const bookings = [
  {
    id: "BK-8821",
    movie: "Interstellar Void",
    user: "Amara Osei",
    date: "Jun 11",
    time: "19:30",
    seats: "D5, D6",
    theater: "Hall 3",
    status: "Confirmed",
    amount: 28.0,
  },
  {
    id: "BK-8820",
    movie: "Neon Requiem",
    user: "Linh Tran",
    date: "Jun 11",
    time: "21:00",
    seats: "F9",
    theater: "Hall 1",
    status: "Confirmed",
    amount: 14.0,
  },
  {
    id: "BK-8819",
    movie: "Echoes of Europa",
    user: "Marco Bianchi",
    date: "Jun 11",
    time: "17:00",
    seats: "B2, B3, B4",
    theater: "Hall 2",
    status: "Pending",
    amount: 42.0,
  },
  {
    id: "BK-8818",
    movie: "Interstellar Void",
    user: "Sarah Chen",
    date: "Jun 11",
    time: "14:30",
    seats: "H7",
    theater: "Hall 3",
    status: "Confirmed",
    amount: 14.0,
  },
  {
    id: "BK-8817",
    movie: "Dark Meridian",
    user: "Raj Patel",
    date: "Jun 10",
    time: "22:15",
    seats: "C1, C2",
    theater: "Hall 4",
    status: "Cancelled",
    amount: 28.0,
  },
  {
    id: "BK-8816",
    movie: "Neon Requiem",
    user: "Elena Vasquez",
    date: "Jun 10",
    time: "15:00",
    seats: "A4",
    theater: "Hall 1",
    status: "Confirmed",
    amount: 14.0,
  },
  {
    id: "BK-8815",
    movie: "Echoes of Europa",
    user: "Kai Nakamura",
    date: "Jun 10",
    time: "20:45",
    seats: "G8, G9",
    theater: "Hall 2",
    status: "Confirmed",
    amount: 28.0,
  },
  {
    id: "BK-8814",
    movie: "Dark Meridian",
    user: "Fatima Al-Hassan",
    date: "Jun 10",
    time: "18:00",
    seats: "E3, E4, E5",
    theater: "Hall 4",
    status: "Confirmed",
    amount: 42.0,
  },
];

// Cấu hình mã màu badge động theo trạng thái cho cả 2 mode (Tăng độ đậm màu chữ ở Light Mode để dễ nhìn)
const STATUS_CONFIG = {
  Confirmed: { 
    bg: "rgba(74,222,128,0.1)", 
    colorDark: "#4ade80", 
    colorLight: "#15803d", 
    dot: "#4ade80" 
  },
  Pending: { 
    bg: "rgba(251,191,36,0.1)", 
    colorDark: "#fbbf24", 
    colorLight: "#b45309", 
    dot: "#fbbf24" 
  },
  Cancelled: { 
    bg: "rgba(248,113,113,0.1)", 
    colorDark: "#f87171", 
    colorLight: "#b91c1c", 
    dot: "#f87171" 
  },
} as const;

const COLS = [
  "Booking ID",
  "Movie",
  "Customer",
  "Date & Time",
  "Seats",
  "Theater",
  "Status",
  "Amount",
  "",
];

// Khai báo Interface nhận prop từ AdminDashboard
interface BookingsTableProps {
  isDarkMode?: boolean;
}

export function BookingsTable({ isDarkMode = true }: BookingsTableProps) {
  const [filter, setFilter] = useState<"All" | "Confirmed" | "Pending" | "Cancelled">("All");

  const filtered =
    filter === "All" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div
      style={{
        background: "var(--bg-card)", // Đổi từ #141414
        border: "1px solid var(--border-color)", // Đổi từ rgba(255,255,255,0.07)
        borderRadius: "12px",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Table header */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              color: "var(--text-main)", // Đổi từ #f0f0f0
              fontWeight: 600,
              fontSize: "15px",
              marginBottom: "3px",
              transition: "color 0.2s ease",
            }}
          >
            Recent Ticket Bookings
          </h2>
          <p style={{ color: "var(--text-sub)", fontSize: "12px", transition: "color 0.2s ease" }}>
            Last 48 hours · {bookings.length} transactions
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Filter pills */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              background: isDarkMode ? "#0f0f0f" : "#e4e6eb", // Đổi màu nền thanh lọc theo chế độ
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "3px",
              transition: "background 0.2s ease",
            }}
          >
            {(["All", "Confirmed", "Pending", "Cancelled"] as const).map(
              (f) => {
                const isSelected = filter === f;
                let btnBg = "transparent";
                let btnColor = isDarkMode ? "var(--text-sub)" : "#555555";

                if (isSelected) {
                  if (f === "All") {
                    btnBg = isDarkMode ? "rgba(255,215,0,0.1)" : "rgba(218,165,32,0.15)";
                    btnColor = isDarkMode ? "#FFD700" : "#b45309";
                  } else {
                    const conf = STATUS_CONFIG[f];
                    btnBg = conf.bg;
                    btnColor = isDarkMode ? conf.colorDark : conf.colorLight;
                  }
                }

                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "5px",
                      border: "none",
                      background: btnBg,
                      color: btnColor,
                      fontSize: "11.5px",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f}
                  </button>
                );
              }
            )}
          </div>

          <button
            style={{
              padding: "7px 16px",
              background: isDarkMode ? "rgba(255,215,0,0.07)" : "rgba(218,165,32,0.08)",
              border: isDarkMode ? "1px solid rgba(255,215,0,0.18)" : "1px solid rgba(218,165,32,0.25)",
              borderRadius: "7px",
              color: isDarkMode ? "#FFD700" : "#b45309",
              fontSize: "12px",
              cursor: "pointer",
              boxShadow: isDarkMode ? "0 0 10px rgba(255,215,0,0.08)" : "none",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode ? "rgba(255,215,0,0.12)" : "rgba(218,165,32,0.14)";
              if (isDarkMode) e.currentTarget.style.boxShadow = "0 0 16px rgba(255,215,0,0.14)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkMode ? "rgba(255,215,0,0.07)" : "rgba(218,165,32,0.08)";
              e.currentTarget.style.boxShadow = isDarkMode ? "0 0 10px rgba(255,215,0,0.08)" : "none";
            }}
          >
            View all
            <ExternalLink size={11} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: "780px" }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
              {COLS.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "11px 16px",
                    textAlign: "left",
                    color: "var(--text-sub)", // Đổi màu chữ label từ #333 sang màu sub linh hoạt
                    fontSize: "10.5px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    background: isDarkMode ? "#0e0e0e" : "#f8f9fa", // Đổi màu nền header table linh hoạt
                    whiteSpace: "nowrap",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {col}
                    {col === "Amount" && (
                      <ArrowUpDown size={10} style={{ color: "var(--text-sub)" }} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => {
              const sc = STATUS_CONFIG[b.status as keyof typeof STATUS_CONFIG];
              return (
                <tr
                  key={b.id}
                  style={{
                    borderBottom:
                      i < filtered.length - 1
                        ? "1px solid var(--border-color)"
                        : "none",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDarkMode 
                      ? "rgba(255,255,255,0.018)" 
                      : "rgba(0,0,0,0.015)"; // Hover sáng/tối tùy mode
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Booking ID */}
                  <td style={{ padding: "13px 16px" }}>
                    <span
                      style={{
                        color: isDarkMode ? "#FFD700" : "#d97706", // Đậm hơn ở light mode để tránh lóa mắt
                        fontSize: "12.5px",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        filter: isDarkMode ? "drop-shadow(0 0 4px rgba(255,215,0,0.3))" : "none",
                      }}
                    >
                      {b.id}
                    </span>
                  </td>

                  {/* Movie */}
                  <td style={{ padding: "13px 16px" }}>
                    <span
                      style={{
                        color: "var(--text-muted)", // Đổi từ #ddd
                        fontSize: "13px",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.movie}
                    </span>
                  </td>

                  {/* Customer */}
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "50%",
                          background: `hsl(${b.user.charCodeAt(0) * 5 % 360}, ${isDarkMode ? "35%" : "45%"}, ${isDarkMode ? "30%" : "40%"})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "#ffffff",
                          flexShrink: 0,
                        }}
                      >
                        {b.user.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                        {b.user}
                      </span>
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                      {b.date}
                    </span>
                    <span style={{ color: "var(--text-sub)", fontSize: "12px" }}>
                      {" "}·{" "}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                      {b.time}
                    </span>
                  </td>

                  {/* Seats */}
                  <td style={{ padding: "13px 16px" }}>
                    <code
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "11.5px",
                        background: "var(--progress-track)",
                        padding: "3px 8px",
                        borderRadius: "5px",
                        border: "1px solid var(--border-color)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {b.seats}
                    </code>
                  </td>

                  {/* Theater */}
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ color: "var(--text-sub)", fontSize: "12.5px" }}>
                      {b.theater}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: "13px 16px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 10px",
                        borderRadius: "5px",
                        background: sc.bg,
                        color: isDarkMode ? sc.colorDark : sc.colorLight,
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          width: "5px",
                          height: "5px",
                          borderRadius: "50%",
                          background: isDarkMode ? sc.dot : sc.colorLight,
                          display: "inline-block",
                          boxShadow: isDarkMode ? `0 0 5px ${sc.dot}` : "none",
                        }}
                      />
                      {b.status}
                    </span>
                  </td>

                  {/* Amount */}
                  <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        color: "var(--text-main)", // Đổi từ #f0f0f0
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      ${b.amount.toFixed(2)}
                    </span>
                  </td>

                  {/* Action */}
                  <td style={{ padding: "13px 16px" }}>
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border-color)",
                        borderRadius: "5px",
                        padding: "4px 10px",
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isDarkMode ? "rgba(255,215,0,0.35)" : "#d97706";
                        e.currentTarget.style.color = isDarkMode ? "#FFD700" : "#d97706";
                        e.currentTarget.style.background = isDarkMode ? "rgba(255,215,0,0.02)" : "rgba(0,0,0,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 24px",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "var(--text-sub)", fontSize: "12px", transition: "color 0.2s ease" }}>
          Showing {filtered.length} of {bookings.length} bookings
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {["←", "→"].map((arrow) => (
            <button
              key={arrow}
              style={{
                width: "28px",
                height: "28px",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "5px",
                color: "var(--text-muted)",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = isDarkMode ? "rgba(255,215,0,0.3)" : "#d97706";
                e.currentTarget.style.color = isDarkMode ? "#FFD700" : "#d97706";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {arrow}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}