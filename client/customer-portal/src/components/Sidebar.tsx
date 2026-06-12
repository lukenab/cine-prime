import {
  LayoutDashboard,
  Film,
  Calendar,
  Ticket,
  Users,
  BarChart2,
  Settings,
  Clapperboard,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Film, label: "Movies", id: "movies" },
  { icon: Calendar, label: "Showtimes", id: "showtimes" },
  { icon: Ticket, label: "Bookings", id: "bookings" },
  { icon: Users, label: "Users", id: "users" },
  { icon: BarChart2, label: "Reports", id: "reports" },
  { icon: Settings, label: "Settings", id: "settings" },
];

interface SidebarProps {
  activeItem: string;
  onItemClick: (id: string) => void;
  isDarkMode?: boolean;
}

export function Sidebar({ activeItem, onItemClick, isDarkMode = true }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        height: "100%",
        background: isDarkMode ? "#0a0a0a" : "var(--bg-card)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 50,
        fontFamily: "Inter, sans-serif",
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "28px 20px 24px",
          borderBottom: "1px solid var(--border-color)",
          transition: "border-color 0.25s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
              // Tone Xanh dương: rgba(59, 130, 246) cho Dark, rgba(37, 99, 235) cho Light
              background: isDarkMode ? "rgba(59, 130, 246, 0.1)" : "rgba(37, 99, 235, 0.1)",
              border: isDarkMode ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(37, 99, 235, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isDarkMode ? "0 0 16px rgba(59, 130, 246, 0.2)" : "0 4px 12px rgba(37, 99, 235, 0.15)",
              transition: "all 0.25s ease",
            }}
          >
            <Clapperboard
              size={18}
              style={{
                color: isDarkMode ? "#3b82f6" : "#2563eb",
                filter: isDarkMode ? "drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))" : "none",
              }}
            />
          </div>
          <div>
            <div
              style={{
                color: isDarkMode ? "#3b82f6" : "#2563eb",
                fontWeight: 700,
                fontSize: "17px",
                letterSpacing: "0.04em",
                lineHeight: 1,
                filter: isDarkMode ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))" : "none",
                transition: "color 0.25s ease",
              }}
            >
              CinePrime
            </div>
            <div
              style={{
                color: "var(--text-sub)",
                fontSize: "10px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginTop: "3px",
                transition: "color 0.25s ease",
              }}
            >
              Admin Console
            </div>
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div
        style={{
          padding: "20px 20px 8px",
          color: "var(--text-sub)",
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
          transition: "color 0.25s ease",
        }}
      >
        Main Menu
      </div>

      {/* Nav items */}
      <nav style={{ padding: "0 10px", flex: 1 }}>
        {navItems.map(({ icon: Icon, label, id }) => {
          const isActive = activeItem === id;
          return (
            <button
              key={id}
              onClick={() => onItemClick(id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "11px",
                padding: "10px 12px",
                marginBottom: "2px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                background: isActive 
                  ? (isDarkMode ? "rgba(59, 130, 246, 0.1)" : "rgba(37, 99, 235, 0.08)") 
                  : "transparent",
                color: isActive 
                  ? (isDarkMode ? "#3b82f6" : "#2563eb") 
                  : "var(--text-sub)",
                fontSize: "13.5px",
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.01em",
                transition: "all 0.15s ease",
                position: "relative",
                textAlign: "left",
                boxShadow: isActive
                  ? (isDarkMode ? "inset 0 0 0 1px rgba(59, 130, 246, 0.15)" : "inset 0 0 0 1px rgba(37, 99, 235, 0.2)")
                  : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
                  e.currentTarget.style.color = "var(--text-main)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-sub)";
                }
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "3px",
                    height: "18px",
                    background: isDarkMode ? "#3b82f6" : "#2563eb",
                    borderRadius: "0 2px 2px 0",
                    boxShadow: isDarkMode ? "0 0 8px rgba(59, 130, 246, 0.7)" : "0 0 6px rgba(37, 99, 235, 0.4)",
                  }}
                />
              )}
              <Icon
                size={16}
                style={
                  isActive && isDarkMode
                    ? { filter: "drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))" }
                    : {}
                }
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background: "var(--border-color)",
          margin: "0 20px 16px",
          transition: "background 0.25s ease",
        }}
      />

      {/* User profile */}
      <div style={{ padding: "0 16px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: isDarkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
            border: "1px solid var(--border-color)",
            transition: "all 0.25s ease",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              // Gradient xanh dương mượt mà
              background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff", // Đổi màu chữ trong avatar thành trắng
              flexShrink: 0,
              boxShadow: isDarkMode ? "0 0 10px rgba(59, 130, 246, 0.4)" : "0 2px 6px rgba(37, 99, 235, 0.3)",
            }}
          >
            JD
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "var(--text-main)",
                fontSize: "12.5px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "color 0.25s ease",
              }}
            >
              James Donovan
            </div>
            <div style={{ color: "var(--text-sub)", fontSize: "10.5px", transition: "color 0.25s ease" }}>Super Admin</div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Logout"
          >
            <LogOut
              size={14}
              style={{ color: "var(--text-muted)", cursor: "pointer", flexShrink: 0, transition: "color 0.2s ease" }}
              onMouseEnter={(e) => e.currentTarget.style.color = isDarkMode ? "#3b82f6" : "#2563eb"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}