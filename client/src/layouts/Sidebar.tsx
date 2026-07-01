import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Film, Building2, Tags, Calendar, Ticket, Users, UserCog, BarChart2, Settings, Clapperboard, LogOut, Gift, ShoppingCart, MapPin } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const roleLabels: Record<string, string> = {
  ROLE_ADMIN: "Admin",
  ROLE_EMPLOYEE: "Employee",
  ROLE_MEMBER: "Member",
  ROLE_USER: "User",
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

// roles: which roles can see this item. undefined = all roles.
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard",   id: "dashboard", path: "/admin",          group: "main" },
  { icon: Film,            label: "Movies",       id: "movies",    path: "/admin/movies",    group: "catalog" },
  { icon: MapPin,          label: "Clusters",     id: "clusters",  path: "/admin/clusters",  group: "catalog",  roles: ["ROLE_ADMIN"] },
  { icon: Building2,       label: "Cinema Rooms", id: "rooms",     path: "/admin/rooms",     group: "catalog",  roles: ["ROLE_ADMIN"] },
  { icon: Tags,            label: "Genres",       id: "genres",    path: "/admin/genres",    group: "catalog",  roles: ["ROLE_ADMIN"] },
  { icon: Calendar,        label: "Showtimes",    id: "showtimes", path: "/admin/showtimes", group: "ops" },
  { icon: Ticket,          label: "Bookings",     id: "bookings",   path: "/admin/bookings",   group: "ops" },
  { icon: ShoppingCart,    label: "Sell Tickets", id: "sell",       path: "/admin/sell",       group: "ops" },
  { icon: UserCog,         label: "Employees",    id: "employees",  path: "/admin/employees",  group: "ops",      roles: ["ROLE_ADMIN"] },
  { icon: Users,           label: "Users",        id: "users",      path: "/admin/users",      group: "ops",      roles: ["ROLE_ADMIN"] },
  { icon: Gift,            label: "Promotions",   id: "promotions", path: "/admin/promotions", group: "ops",      roles: ["ROLE_ADMIN"] },
  { icon: BarChart2,       label: "Reports",      id: "reports",   path: "/admin/reports",   group: "system",   roles: ["ROLE_ADMIN"] },
  { icon: Settings,        label: "Settings",     id: "settings",  path: "/admin/settings",  group: "system",   roles: ["ROLE_ADMIN"] },
];

interface SidebarProps {
  isDarkMode?: boolean;
}

export function Sidebar({ isDarkMode = true }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation(); 

  const { user, logout } = useAuth();

  const handleLogout = () => {
    void logout();
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
          height: "60px",
          flexShrink: 0,
          padding: "0 20px",
          borderBottom: "1px solid var(--border-color)",
          transition: "border-color 0.25s ease",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
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
      <nav style={{ padding: "0 10px", flex: 1, overflowY: "auto", minHeight: 0 }}>
        {navItems.filter(({ roles }) => !roles || roles.includes(user?.role ?? "")).map(({ icon: Icon, label, id, path, group }, idx, visibleItems) => {
          const isActive =
            path === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(path);

          const prevGroup = idx > 0 ? visibleItems[idx - 1].group : group;
          const showSectionLabel = group !== prevGroup;
          const sectionLabels: Record<string, string> = {
            catalog: "Catalog",
            ops: "Operations",
            system: "System",
          };

          return (
            <div key={id}>
              {showSectionLabel && group !== "main" && (
                <div style={{ padding: "14px 12px 4px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-sub)", transition: "color 0.25s ease" }}>
                  {sectionLabels[group] ?? group}
                </div>
              )}
            <button
              onClick={() => navigate(path)}
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
                background: isActive ? (isDarkMode ? "rgba(59, 130, 246, 0.1)" : "rgba(37, 99, 235, 0.08)") : "transparent",
                color: isActive ? (isDarkMode ? "#3b82f6" : "#2563eb") : "var(--text-sub)",
                fontSize: "13.5px",
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.01em",
                transition: "all 0.15s ease",
                position: "relative",
                textAlign: "left",
                boxShadow: isActive ? (isDarkMode ? "inset 0 0 0 1px rgba(59, 130, 246, 0.15)" : "inset 0 0 0 1px rgba(37, 99, 235, 0.2)") : "none",
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
              <Icon size={16} style={isActive && isDarkMode ? { filter: "drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))" } : {}} />
              {label}
            </button>
            </div>
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
              background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
              flexShrink: 0,
              boxShadow: isDarkMode ? "0 0 10px rgba(59, 130, 246, 0.4)" : "0 2px 6px rgba(37, 99, 235, 0.3)",
            }}
          >
            {getInitials(user?.username ?? "?")}
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
              {user?.username ?? "—"}
            </div>
            <div style={{ color: "var(--text-sub)", fontSize: "10.5px", transition: "color 0.25s ease" }}>
              {roleLabels[user?.role ?? ""] ?? user?.role ?? ""}
            </div>
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
              style={{
                color: "var(--text-muted)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = isDarkMode ? "#3b82f6" : "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
