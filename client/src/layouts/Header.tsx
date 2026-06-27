import { useAuth } from "../context/AuthContext";
import { Bell, Search, ChevronRight, User, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const roleLabels: Record<string, string> = {
  ROLE_ADMIN: "Admin",
  ROLE_EMPLOYEE: "Employee",
  ROLE_MEMBER: "Member",
  ROLE_USER: "User",
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

interface HeaderProps {
  activePage: string;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  movies: "Movies",
  rooms: "Cinema Rooms",
  genres: "Movie Genres",
  showtimes: "Showtimes",
  bookings: "Bookings",
  users: "Users",
  reports: "Reports",
  settings: "Settings",
};

export function Header({ activePage, isDarkMode = true, onToggleTheme }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Xử lý click ra ngoài để đóng dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

    const { user, logout } = useAuth();

const handleLogout = () => {
    logout();               
    setIsProfileOpen(false); 
    navigate("/login");     
  };

  return (
    <header
      style={{
        height: "60px",
        background: isDarkMode ? "rgba(5,5,5,0.92)" : "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 40,
        fontFamily: "Inter, sans-serif",
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: isDarkMode ? "#444" : "#999", fontSize: "13px" }}>
        <span style={{ color: isDarkMode ? "#333" : "#666", fontWeight: 500 }}>CinePrime</span>
        <ChevronRight size={13} style={{ color: isDarkMode ? "#2a2a2a" : "#ccc" }} />
        <span style={{ color: "var(--text-main)", fontWeight: 500, transition: "color 0.2s ease" }}>{pageTitles[activePage] ?? activePage}</span>
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        
        {/* Search bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-main)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "7px 14px", transition: "all 0.2s ease" }}>
          <Search size={13} style={{ color: "var(--text-sub)" }} />
          <input
            placeholder="Search movies, bookings…"
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--text-main)", fontFamily: "Inter, sans-serif", fontSize: "12.5px", width: "180px", transition: "color 0.2s ease" }}
          />
        </div>

        {/* Date pill */}
        <div style={{ padding: "5px 12px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-muted)", fontSize: "11.5px", letterSpacing: "0.02em", transition: "all 0.2s ease" }}>
          Thu, Jun 11 2026
        </div>

        {/* Dark / Light mode toggle */}
        <button
          onClick={onToggleTheme}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-sub)", transition: "all 0.15s ease" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = isDarkMode ? "rgba(255, 215, 0, 0.4)" : "#ca8a04";
            e.currentTarget.style.color = isDarkMode ? "#FFD700" : "#ca8a04";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color)";
            e.currentTarget.style.color = "var(--text-sub)";
          }}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun size={15} style={{ color: "#FFD700" }} /> : <Moon size={15} />}
        </button>

        {/* Notification bell */}
        <button
          style={{ position: "relative", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-sub)", transition: "all 0.15s ease" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = isDarkMode ? "rgba(59, 130, 246, 0.3)" : "#2563eb";
            e.currentTarget.style.color = isDarkMode ? "#3b82f6" : "#2563eb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color)";
            e.currentTarget.style.color = "var(--text-sub)";
          }}
        >
          <Bell size={15} />
          <span style={{ position: "absolute", top: "8px", right: "8px", width: "6px", height: "6px", background: isDarkMode ? "#3b82f6" : "#2563eb", borderRadius: "50%", boxShadow: isDarkMode ? "0 0 6px rgba(59, 130, 246, 0.9)" : "none" }} />
        </button>

        {/* 🚀 AVATAR & DROPDOWN MENU */}
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <div
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: isDarkMode ? "0 0 12px rgba(59, 130, 246, 0.3)" : "0 2px 8px rgba(37, 99, 235, 0.2)",
              border: "1.5px solid rgba(59, 130, 246, 0.4)",
              userSelect: "none",
            }}
          >
            {getInitials(user?.username ?? "?")}
          </div>

          {/* Menu thả xuống */}
          {isProfileOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: "200px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                boxShadow: isDarkMode ? "0 4px 24px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.08)",
                padding: "6px",
                animation: "fadeInDown 0.2s ease",
                zIndex: 50,
              }}
            >
              {/* Thông tin nhanh */}
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", marginBottom: "4px" }}>
                <p style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 600, margin: "0 0 2px 0" }}>
                  {user?.username ?? "—"}
                </p>
                <p style={{ color: "var(--text-sub)", fontSize: "11px", margin: 0 }}>
                  {roleLabels[user?.role ?? ""] ?? user?.role ?? ""}
                </p>
              </div>

              {/* Các nút bấm */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <button
                  className="dropdown-item"
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: "6px", color: "var(--text-muted)", fontSize: "13px", transition: "all 0.2s ease" }}
                >
                  <User size={15} />
                  My Profile
                </button>
                
                <button
                  className="dropdown-item"
                  onClick={() => navigate("/admin/settings")}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: "6px", color: "var(--text-muted)", fontSize: "13px", transition: "all 0.2s ease" }}
                >
                  <Settings size={15} />
                  Settings
                </button>

                <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />

                <button
                  onClick={handleLogout}
                  className="dropdown-logout"
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: "6px", color: "#ef4444", fontSize: "13px", fontWeight: 500, transition: "all 0.2s ease" }}
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Thêm CSS cho hiệu ứng Hover của Dropdown */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Hiệu ứng hover cho nút thường */
        .theme-dark .dropdown-item:hover { background: rgba(255,255,255,0.05) !important; color: var(--text-main) !important; }
        .theme-light .dropdown-item:hover { background: rgba(0,0,0,0.04) !important; color: var(--text-main) !important; }
        
        /* Hiệu ứng hover cho nút Logout (Đỏ) */
        .theme-dark .dropdown-logout:hover { background: rgba(239, 68, 68, 0.1) !important; }
        .theme-light .dropdown-logout:hover { background: rgba(239, 68, 68, 0.08) !important; }
      `}</style>
    </header>
  );
}