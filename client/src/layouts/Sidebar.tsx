import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { LayoutDashboard, Film, Building2, Tags, Calendar, Ticket, Users, UserCog, BarChart2, Settings, Clapperboard, Gift, ShoppingCart, MapPin, UserSquare2, ChevronDown, List, ShieldCheck, Monitor, Factory, Armchair, Languages, BadgeDollarSign, Popcorn } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { movieApi } from "../api/movieApi";

type NavChild = { icon: React.ElementType; label: string; path: string; roles?: string[] };
type NavItem = {
  icon: React.ElementType; label: string; id: string;
  path: string; group: string; roles?: string[];
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", path: "/admin", group: "main", roles: ["ROLE_ADMIN", "ROLE_EMPLOYEE"] },
  {
    icon: Film, label: "Movies", id: "movies", path: "/admin/movies", group: "catalog",
    roles: ["ROLE_ADMIN", "ROLE_EMPLOYEE"],
    children: [
      { icon: List,        label: "Movie List",  path: "/admin/movies" },
      { icon: Tags,        label: "Genres",      path: "/admin/genres",      roles: ["ROLE_ADMIN"] },
      { icon: ShieldCheck, label: "Age Ratings", path: "/admin/age-ratings", roles: ["ROLE_ADMIN"] },
      { icon: Monitor,     label: "Formats",     path: "/admin/formats",     roles: ["ROLE_ADMIN"] },
      { icon: Languages,   label: "Screening Versions", path: "/admin/screening-versions", roles: ["ROLE_ADMIN"] },
      { icon: Factory,     label: "Companies",   path: "/admin/companies",   roles: ["ROLE_ADMIN"] },
      { icon: UserSquare2, label: "Persons",     path: "/admin/persons",     roles: ["ROLE_ADMIN"] },
    ],
  },
  {
    icon: Building2, label: "Cinemas", id: "cinemas", path: "/admin/clusters", group: "catalog",
    roles: ["ROLE_ADMIN", "ROLE_EMPLOYEE"],
    children: [
      { icon: MapPin,    label: "Clusters",  path: "/admin/clusters" },
      { icon: Armchair,  label: "All Rooms", path: "/admin/rooms" },
    ],
  },
  {
    icon: Calendar, label: "Showtimes", id: "showtimes", path: "/admin/showtimes", group: "ops",
    roles: ["ROLE_ADMIN", "ROLE_EMPLOYEE"],
    children: [
      { icon: Calendar, label: "Showtime Workspace", path: "/admin/showtimes" },
      { icon: BadgeDollarSign, label: "Price Books", path: "/admin/price-books", roles: ["ROLE_ADMIN"] },
    ],
  },
  { icon: Ticket,      label: "Bookings",     id: "bookings",   path: "/admin/bookings",   group: "ops", roles: ["ROLE_ADMIN", "ROLE_EMPLOYEE"] },
  { icon: ShoppingCart,label: "Sell Tickets", id: "sell",       path: "/admin/sell",       group: "ops", roles: ["ROLE_EMPLOYEE"] },
  {
    icon: Popcorn, label: "Concessions", id: "concessions", path: "/admin/concessions/fulfillment", group: "ops",
    roles: ["ROLE_ADMIN", "ROLE_BRANCH_MANAGER", "ROLE_EMPLOYEE"],
    children: [
      { icon: ShoppingCart, label: "Fulfillment", path: "/admin/concessions/fulfillment", roles: ["ROLE_ADMIN", "ROLE_EMPLOYEE"] },
      { icon: Tags, label: "Catalog & Stock", path: "/admin/concessions/catalog", roles: ["ROLE_ADMIN", "ROLE_BRANCH_MANAGER"] },
    ],
  },
  { icon: UserCog,     label: "Employees",    id: "employees",  path: "/admin/employees",  group: "ops",    roles: ["ROLE_ADMIN"] },
  { icon: Users,       label: "Users",        id: "users",      path: "/admin/users",      group: "ops",    roles: ["ROLE_ADMIN"] },
  { icon: Gift,        label: "Promotions",   id: "promotions", path: "/admin/promotions", group: "ops",    roles: ["ROLE_ADMIN"] },
  { icon: BarChart2,   label: "Reports",      id: "reports",    path: "/admin/reports",    group: "system", roles: ["ROLE_ADMIN"] },
  { icon: Settings,    label: "Settings",     id: "settings",   path: "/admin/settings",   group: "system", roles: ["ROLE_ADMIN"] },
];

interface SidebarProps {
  isDarkMode?: boolean;
}

export function Sidebar({ isDarkMode = true }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Auto-expand items whose children match the current path
  const autoExpanded = navItems
    .filter(item => item.children?.some(c => location.pathname.startsWith(c.path) && c.path !== "/admin/movies" || location.pathname === c.path))
    .map(item => item.id);
  const [expandedIds, setExpandedIds] = useState<string[]>(autoExpanded);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Badge: số phim đang PENDING_REVIEW (chỉ fetch cho ADMIN)
  const [pendingMovies, setPendingMovies] = useState(0);
  useEffect(() => {
    if (user?.role !== "ROLE_ADMIN" && user?.role !== "ROLE_SUPER_ADMIN") return;
    movieApi.getAllMovies()
      .then(res => {
        const count = (res.result ?? []).filter(m => m.movieStatus === "PENDING_REVIEW").length;
        setPendingMovies(count);
      })
      .catch(() => {});
  }, [user?.role]);

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
        {navItems.filter(({ roles }) => !roles || roles.includes(user?.role ?? "")).map((item, idx, visibleItems) => {
          const { icon: Icon, label, id, path, group, children } = item;
          const hasChildren = !!children?.length;
          const isExpanded = expandedIds.includes(id);
          const role = user?.role ?? "";

          // Active: exact for /admin, startsWith for others
          const isActive = path === "/admin"
            ? location.pathname === "/admin"
            : !hasChildren && location.pathname.startsWith(path);

          // Parent is "active" style when any child is active
          const childActive = hasChildren && children!.some(c => location.pathname.startsWith(c.path));

          const prevGroup = idx > 0 ? visibleItems[idx - 1].group : group;
          const showSectionLabel = group !== prevGroup;
          const sectionLabels: Record<string, string> = { catalog: "Catalog", ops: "Operations", system: "System" };

          const btnStyle = (active: boolean): React.CSSProperties => ({
            width: "100%", display: "flex", alignItems: "center", gap: "11px",
            padding: "10px 12px", marginBottom: "2px", borderRadius: "8px",
            border: "none", cursor: "pointer",
            background: active ? (isDarkMode ? "rgba(59,130,246,0.1)" : "rgba(37,99,235,0.08)") : "transparent",
            color: active ? (isDarkMode ? "#3b82f6" : "#2563eb") : "var(--text-sub)",
            fontSize: "13.5px", fontWeight: active ? 600 : 500,
            letterSpacing: "0.01em", transition: "all 0.15s ease",
            position: "relative", textAlign: "left",
            boxShadow: active ? (isDarkMode ? "inset 0 0 0 1px rgba(59,130,246,0.15)" : "inset 0 0 0 1px rgba(37,99,235,0.2)") : "none",
          });

          const hoverOn = (e: React.MouseEvent<HTMLButtonElement>, active: boolean) => {
            if (!active) { e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "var(--text-main)"; }
          };
          const hoverOff = (e: React.MouseEvent<HTMLButtonElement>, active: boolean) => {
            if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-sub)"; }
          };

          return (
            <div key={id}>
              {showSectionLabel && group !== "main" && (
                <div style={{ padding: "14px 12px 4px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-sub)", transition: "color 0.25s ease" }}>
                  {sectionLabels[group] ?? group}
                </div>
              )}

              {/* Parent button */}
              <button
                onClick={() => hasChildren ? toggleExpand(id) : navigate(path)}
                style={btnStyle(isActive || childActive)}
                onMouseEnter={(e) => hoverOn(e, isActive || childActive)}
                onMouseLeave={(e) => hoverOff(e, isActive || childActive)}
              >
                {(isActive || childActive) && (
                  <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "3px", height: "18px", background: isDarkMode ? "#3b82f6" : "#2563eb", borderRadius: "0 2px 2px 0", boxShadow: isDarkMode ? "0 0 8px rgba(59,130,246,0.7)" : "0 0 6px rgba(37,99,235,0.4)" }} />
                )}
                <Icon size={16} style={(isActive || childActive) && isDarkMode ? { filter: "drop-shadow(0 0 4px rgba(59,130,246,0.5))" } : {}} />
                <span style={{ flex: 1 }}>{label}</span>
                {id === "movies" && pendingMovies > 0 && (
                  <span style={{
                    minWidth: "18px", height: "18px", padding: "0 5px",
                    background: "#ef4444", color: "#fff",
                    borderRadius: "9px", fontSize: "10px", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, lineHeight: 1,
                  }}>
                    {pendingMovies > 99 ? "99+" : pendingMovies}
                  </span>
                )}
                {hasChildren && (
                  <ChevronDown size={13} style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", opacity: 0.5 }} />
                )}
              </button>

              {/* Children */}
              {hasChildren && (
                <div style={{ overflow: "hidden", maxHeight: isExpanded ? "400px" : "0", transition: "max-height 0.25s ease" }}>
                  {children!
                    .filter(c => !c.roles || c.roles.includes(role))
                    .map(child => {
                      const ChildIcon = child.icon;
                      const childIsActive = location.pathname === child.path || (child.path !== "/admin/movies" && location.pathname.startsWith(child.path));
                      return (
                        <button
                          key={child.path}
                          onClick={() => navigate(child.path)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: "9px",
                            padding: "8px 12px 8px 36px", marginBottom: "1px",
                            borderRadius: "8px", border: "none", cursor: "pointer",
                            background: childIsActive ? (isDarkMode ? "rgba(59,130,246,0.08)" : "rgba(37,99,235,0.06)") : "transparent",
                            color: childIsActive ? (isDarkMode ? "#3b82f6" : "#2563eb") : "var(--text-sub)",
                            fontSize: "12.5px", fontWeight: childIsActive ? 600 : 400,
                            transition: "all 0.15s ease", textAlign: "left",
                          }}
                          onMouseEnter={(e) => { if (!childIsActive) { e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"; e.currentTarget.style.color = "var(--text-main)"; } }}
                          onMouseLeave={(e) => { if (!childIsActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-sub)"; } }}
                        >
                          <ChildIcon size={13} />
                          {child.label}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

    </aside>
  );
}
