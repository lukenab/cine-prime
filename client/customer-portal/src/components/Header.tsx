import { Bell, Search, ChevronRight } from "lucide-react";

interface HeaderProps {
  activePage: string;
  isDarkMode?: boolean; // Nhận trạng thái theme từ AdminDashboard
}

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  movies: "Movies",
  showtimes: "Showtimes",
  bookings: "Bookings",
  users: "Users",
  reports: "Reports",
  settings: "Settings",
};

export function Header({ activePage, isDarkMode = true }: HeaderProps) {
  return (
    <header
      style={{
        height: "60px",
        background: isDarkMode ? "rgba(5,5,5,0.92)" : "rgba(255,255,255,0.92)", // Đổi background động
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-color)", // Dùng biến border hệ thống
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: isDarkMode ? "#444" : "#999",
          fontSize: "13px",
        }}
      >
        <span style={{ color: isDarkMode ? "#333" : "#666", fontWeight: 500 }}>CinePrime</span>
        <ChevronRight size={13} style={{ color: isDarkMode ? "#2a2a2a" : "#ccc" }} />
        <span style={{ color: "var(--text-main)", fontWeight: 500, transition: "color 0.2s ease" }}>{pageTitles[activePage] ?? activePage}</span>
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Search bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--bg-main)", // Tự động đổi màu nền ô nhập (Tối ở Dark, Sáng xám ở Light)
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "7px 14px",
            transition: "all 0.2s ease",
          }}
        >
          <Search size={13} style={{ color: "var(--text-sub)" }} />
          <input
            placeholder="Search movies, bookings…"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-main)",
              fontFamily: "Inter, sans-serif",
              fontSize: "12.5px",
              width: "180px",
              transition: "color 0.2s ease",
            }}
          />
        </div>

        {/* Date pill */}
        <div
          style={{
            padding: "5px 12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            color: "var(--text-muted)",
            fontSize: "11.5px",
            letterSpacing: "0.02em",
            transition: "all 0.2s ease",
          }}
        >
          Thu, Jun 11 2026
        </div>

        {/* Notification bell */}
        <button
          style={{
            position: "relative",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-sub)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            // Đổi màu hover sang xanh dương
            e.currentTarget.style.borderColor = isDarkMode ? "rgba(59, 130, 246, 0.3)" : "#2563eb";
            e.currentTarget.style.color = isDarkMode ? "#3b82f6" : "#2563eb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color)";
            e.currentTarget.style.color = "var(--text-sub)";
          }}
        >
          <Bell size={15} />
          <span
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "6px",
              height: "6px",
              // Chấm thông báo màu xanh dương
              background: isDarkMode ? "#3b82f6" : "#2563eb",
              borderRadius: "50%",
              boxShadow: isDarkMode ? "0 0 6px rgba(59, 130, 246, 0.9)" : "none",
            }}
          />
        </button>

        {/* Avatar */}
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            // Cập nhật gradient sang màu xanh dương
            background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            color: "#ffffff", // Chữ trắng cho nổi bật
            cursor: "pointer",
            // Đổ bóng viền theo tone xanh
            boxShadow: isDarkMode ? "0 0 12px rgba(59, 130, 246, 0.3)" : "0 2px 8px rgba(37, 99, 235, 0.2)",
            border: "1.5px solid rgba(59, 130, 246, 0.4)",
          }}
        >
          JD
        </div>
      </div>
    </header>
  );
}
