import { useState, useEffect } from "react";
import { Sidebar } from "../Sidebar";
import { Header } from "../Header";
import { KpiCard } from "../KpiCard";
import { RevenueChart } from "../RevenueChart";
import { BookingsTable } from "../BookingsTable";
import { DollarSign, Ticket, Film, Activity, Sun, Moon } from "lucide-react";

const KPI_DATA = [
  {
    title: "Total Revenue",
    value: "$527,800",
    change: 12.4,
    changeLabel: "vs last week",
    sparkData: [38, 42, 35, 51, 48, 62, 72, 68, 79, 85, 91, 88, 98, 108],
    icon: <DollarSign size={17} />,
    accentColor: "#FFD700",
  },
  {
    title: "Tickets Sold",
    value: "8,934",
    change: 8.1,
    changeLabel: "vs last week",
    sparkData: [420, 380, 460, 510, 490, 580, 640, 720, 690, 740, 810, 770, 830, 894],
    icon: <Ticket size={17} />,
    accentColor: "#60A5FA",
  },
  {
    title: "Active Movies",
    value: "24",
    change: 2.0,
    changeLabel: "this week",
    sparkData: [18, 19, 19, 20, 20, 21, 21, 22, 22, 22, 23, 23, 24, 24],
    icon: <Film size={17} />,
    accentColor: "#a78bfa",
  },
  {
    title: "Occupancy Rate",
    value: "78.3%",
    change: -2.1,
    changeLabel: "vs last week",
    sparkData: [82, 79, 84, 80, 81, 76, 79, 75, 80, 82, 78, 77, 79, 78],
    icon: <Activity size={17} />,
    accentColor: "#4ade80",
  },
];

export default function AdminDashboard() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("admin-theme");
    return savedTheme ? savedTheme === "dark" : true;
  });

  useEffect(() => {
    localStorage.setItem("admin-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  return (
    <div
      className={isDarkMode ? "theme-dark" : "theme-light"}
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)", // Sử dụng biến CSS động
        display: "flex",
        fontFamily: "Inter, sans-serif",
        transition: "background 0.25s ease",
      }}
    >
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "46px",
          height: "46px",
          borderRadius: "50%",
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          color: "var(--text-main)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          zIndex: 999,
          transition: "all 0.2s ease",
        }}
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDarkMode ? <Sun size={18} style={{ color: "#FFD700" }} /> : <Moon size={18} />}
      </button>

      {/* Fixed sidebar */}
      <Sidebar activeItem={activeNav} onItemClick={setActiveNav} isDarkMode={isDarkMode} />

      <div
        style={{
          marginLeft: "240px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        <Header activePage={activeNav} isDarkMode={isDarkMode} />

        <main
          style={{
            flex: 1,
            padding: "28px 32px 40px",
            overflowX: "hidden",
          }}
        >
          {/* Page title */}
          <div style={{ marginBottom: "28px" }}>
            <h1
              style={{
                color: "var(--text-main)",
                fontWeight: 600,
                fontSize: "22px",
                letterSpacing: "-0.01em",
                marginBottom: "5px",
                transition: "color 0.2s ease",
              }}
            >
              Dashboard Overview
            </h1>
            <p style={{ color: "var(--text-sub)", fontSize: "13px", transition: "color 0.2s ease" }}>Real-time performance metrics · CinePrime Network</p>
          </div>

          {/* KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {KPI_DATA.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} isDarkMode={isDarkMode} />
            ))}
          </div>

          {/* Revenue Chart */}
          <div style={{ marginBottom: "24px" }}>
            <RevenueChart isDarkMode={isDarkMode} />
          </div>

          {/* Bottom row: table + mini stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: "16px",
              alignItems: "start",
            }}
          >
            {/* Bookings table */}
            <BookingsTable isDarkMode={isDarkMode} />

            {/* Side panel */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Top movies */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                  padding: "20px",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.2s ease",
                }}
              >
                {/* shimmer */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.35), transparent)",
                  }}
                />
                <h3
                  style={{
                    color: "var(--text-main)",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    marginBottom: "16px",
                  }}
                >
                  Top Movies
                </h3>
                {[
                  { title: "Interstellar Void", pct: 94, genre: "Sci-Fi" },
                  { title: "Neon Requiem", pct: 82, genre: "Thriller" },
                  { title: "Echoes of Europa", pct: 71, genre: "Drama" },
                  { title: "Dark Meridian", pct: 65, genre: "Horror" },
                  { title: "Solaris Drift", pct: 53, genre: "Action" },
                ].map(({ title, pct, genre }, i) => (
                  <div
                    key={title}
                    style={{
                      marginBottom: i < 4 ? "14px" : 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "5px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "12px",
                            fontWeight: 450,
                          }}
                        >
                          {title}
                        </div>
                        <div style={{ color: "var(--text-sub)", fontSize: "10.5px" }}>{genre}</div>
                      </div>
                      <span
                        style={{
                          color: "var(--text-sub)",
                          fontSize: "11px",
                          fontWeight: 500,
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: "3px",
                        background: "var(--progress-track)",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: i === 0 ? "linear-gradient(90deg, #FFD700, #FF8C00)" : i === 1 ? "#60A5FA" : "var(--text-sub)",
                          borderRadius: "2px",
                          boxShadow: i === 0 ? "0 0 8px rgba(255,215,0,0.3)" : "none",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Halls occupancy */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                  padding: "20px",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.35), transparent)",
                  }}
                />
                <h3
                  style={{
                    color: "var(--text-main)",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    marginBottom: "16px",
                  }}
                >
                  Hall Occupancy
                </h3>
                {[
                  { hall: "Hall 1", seats: 180, occupied: 152 },
                  { hall: "Hall 2", seats: 240, occupied: 198 },
                  { hall: "Hall 3", seats: 120, occupied: 104 },
                  { hall: "Hall 4", seats: 300, occupied: 213 },
                ].map(({ hall, seats, occupied }) => {
                  const pct = Math.round((occupied / seats) * 100);
                  const color = pct >= 85 ? "#4ade80" : pct >= 65 ? "#fbbf24" : "#f87171";
                  return (
                    <div key={hall} style={{ marginBottom: "13px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "5px",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{hall}</span>
                        <span
                          style={{
                            color,
                            fontSize: "11.5px",
                            fontWeight: 600,
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: "4px",
                          background: "var(--progress-track)",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: color,
                            borderRadius: "2px",
                            boxShadow: `0 0 6px ${color}50`,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          color: "var(--text-sub)",
                          fontSize: "10.5px",
                          marginTop: "3px",
                        }}
                      >
                        {occupied} / {seats} seats
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick stats */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  transition: "all 0.2s ease",
                }}
              >
                <h3
                  style={{
                    color: "var(--text-main)",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    marginBottom: "14px",
                  }}
                >
                  Today at a Glance
                </h3>
                {[
                  { label: "Showtimes Today", value: "36" },
                  { label: "New Bookings", value: "247" },
                  { label: "Avg. Ticket Price", value: "$13.80" },
                  { label: "Refunds Processed", value: "12" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 0",
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    <span style={{ color: "var(--text-sub)", fontSize: "12px" }}>{label}</span>
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Kiến trúc định nghĩa hệ biến màu tập trung cho cả Dark & Light Mode */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        /* 1. ĐẶC TẢ PALETTE CHO DARK MODE (Mặc định gốc) */
        .theme-dark {
          --bg-main: #050505;
          --bg-card: #141414;
          --border-color: rgba(255, 255, 255, 0.07);
          --text-main: #f0f0f0;
          --text-muted: #ccc;
          --text-sub: #555;
          --progress-track: rgba(255, 255, 255, 0.05);
        }

        /* 2. ĐẶC TẢ PALETTE CHO LIGHT MODE (Tối ưu tương phản thanh lịch) */
        .theme-light {
          --bg-main: #f4f5f7;
          --bg-card: #ffffff;
          --border-color: rgba(0, 0, 0, 0.08);
          --text-main: #1a1a1a;
          --text-muted: #333333;
          --text-sub: #7a7a7a;
          --progress-track: rgba(0, 0, 0, 0.06);
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,215,0,0.15) transparent;
          box-sizing: border-box;
        }
        *::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        *::-webkit-scrollbar-thumb {
          background: rgba(255,215,0,0.15);
          border-radius: 2px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background: rgba(255,215,0,0.3);
        }
        body {
          margin: 0;
          background: var(--bg-main);
        }
        input::placeholder {
          color: var(--text-sub);
        }
      `}</style>
    </div>
  );
}
