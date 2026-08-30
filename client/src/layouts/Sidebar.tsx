import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { LayoutDashboard, Film, Tags, Calendar, CalendarClock, Ticket, UserCog, BarChart2, Settings, Clapperboard, Gift, ShoppingCart, MapPin, ChevronDown, ShieldCheck, Monitor, Armchair, Layers3, BookOpen, ReceiptText, Popcorn, SlidersHorizontal, ScrollText, KeyRound, ClipboardCheck } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { OrbitaLogo } from "../components/shared/OrbitaLogo";
import { movieApi } from "../api/movieApi";
import { isPathInRoleWorkspace } from "../utils/adminWorkspaces";

type NavChild = { icon: React.ElementType; label: string; path: string; roles?: string[]; permissions?: string[] };
type NavItem = {
  icon: React.ElementType; label: string; id: string;
  path: string; group: string; roles?: string[];
  permissions?: string[];
  children?: NavChild[];
};

const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "DASHBOARD", id: "dashboard", path: "/admin", group: "main", roles: ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"] },
  { icon: CalendarClock, label: "My Schedule & Time", id: "my-workforce", path: "/admin/my-workforce", group: "main", permissions: ["WORKFORCE_SELF_READ"] },
  { icon: Film, label: "Movies", id: "movies", path: "/admin/movies", group: "content", permissions: ["MOVIE_READ"] },
  { icon: Calendar, label: "Release Planning", id: "release-planning", path: "/admin/release-plans", group: "content", permissions: ["RELEASE_PLAN_READ"] },
  { icon: Layers3, label: "Screening Versions", id: "screening-versions", path: "/admin/screening-versions", group: "content", permissions: ["MOVIE_READ"] },

  { icon: MapPin, label: "Cinema Clusters", id: "cinema-clusters", path: "/admin/clusters", group: "facility-management", roles: ["ROLE_ADMIN"] },
  { icon: Armchair, label: "Screening Rooms", id: "screening-rooms", path: "/admin/rooms", group: "facility-management", roles: ["ROLE_ADMIN"] },
  { icon: Calendar, label: "Showtime Operations", id: "showtimes", path: "/admin/showtimes", group: "facility-management", roles: ["ROLE_ADMIN"] },
  { icon: BookOpen, label: "Price Books", id: "price-books", path: "/admin/price-books", group: "facility-management", permissions: ["PRICE_BOOK_READ", "PRICE_BOOK_MANAGE"] },
  { icon: Ticket, label: "Bookings", id: "bookings", path: "/admin/bookings", group: "business-operations", permissions: ["BOOKING_READ"] },
  {
    icon: Popcorn, label: "Concessions", id: "concessions", path: "/admin/concessions/fulfillment", group: "business-operations",
    roles: ["ROLE_ADMIN", "ROLE_BRANCH_MANAGER"],
    children: [
      { icon: ShoppingCart, label: "Fulfillment", path: "/admin/concessions/fulfillment", roles: ["ROLE_ADMIN"] },
      { icon: Tags, label: "Catalog & Stock", path: "/admin/concessions/catalog", roles: ["ROLE_ADMIN", "ROLE_BRANCH_MANAGER"] },
    ],
  },

  { icon: Gift, label: "Promotions", id: "promotions", path: "/admin/promotions", group: "business-operations", permissions: ["PROMOTION_READ"] },
  { icon: ReceiptText, label: "Refunds & Reconciliation", id: "refunds-reconciliation", path: "/admin/refunds-reconciliation", group: "business-operations", permissions: ["REFUND_READ", "RECONCILIATION_READ"] },
  { icon: CalendarClock, label: "Workforce Operations", id: "workforce", path: "/admin/workforce", group: "business-operations", permissions: ["WORKFORCE_PLAN", "TIMESHEET_REVIEW"] },

  { icon: UserCog, label: "People & Access", id: "people", path: "/admin/people", group: "administration", permissions: ["EMPLOYEE_READ", "USER_READ", "ROLE_MANAGE"] },
  { icon: KeyRound, label: "Access Matrix", id: "access-matrix", path: "/admin/access-matrix", group: "administration", permissions: ["ROLE_MANAGE"] },
  { icon: ScrollText, label: "Audit Trail", id: "audit", path: "/admin/audit", group: "administration", permissions: ["AUDIT_READ"] },
  { icon: BarChart2, label: "Reports", id: "reports", path: "/admin/reports", group: "administration", permissions: ["REPORT_READ", "AUDIT_READ"] },

  {
    icon: SlidersHorizontal, label: "Reference Data", id: "reference-data", path: "/admin/genres", group: "administration",
    roles: ["ROLE_ADMIN"],
    children: [
      { icon: Tags, label: "Genres", path: "/admin/genres", roles: ["ROLE_ADMIN"] },
      { icon: ShieldCheck, label: "Age Ratings", path: "/admin/age-ratings", roles: ["ROLE_ADMIN"] },
      { icon: Monitor, label: "Screening Formats", path: "/admin/formats", roles: ["ROLE_ADMIN"] },
    ],
  },
  { icon: Settings, label: "Settings", id: "settings", path: "/admin/settings", group: "administration", permissions: ["SYSTEM_CONFIG_MANAGE"] },
];

const employeeNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Workspace", id: "dashboard", path: "/employee", group: "main", roles: ["ROLE_EMPLOYEE"] },
  { icon: CalendarClock, label: "My Schedule & Time", id: "workforce", path: "/employee/workforce", group: "my-work", permissions: ["WORKFORCE_SELF_READ"] },
  { icon: ShoppingCart, label: "Ticket Sales", id: "sell", path: "/employee/sell", group: "customer-operations", permissions: ["TICKET_SELL"] },
  { icon: Ticket, label: "Booking Lookup", id: "bookings", path: "/employee/bookings", group: "customer-operations", permissions: ["BOOKING_READ"] },
  { icon: Popcorn, label: "Order Fulfillment", id: "concessions", path: "/employee/concessions/fulfillment", group: "food-beverage", permissions: ["CONCESSION_FULFILLMENT_READ"] },
];

/**
 * Film programmers use a focused, flat workspace. Keeping the admin catalogue
 * tree for this role left two oversized parent menus with only a handful of
 * usable children and made the sidebar look unfinished.
 */
const programmingNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Programming Workspace", id: "programming-overview", path: "/admin/programming", group: "main", permissions: ["RELEASE_PLAN_EDIT", "SCHEDULE_PLAN_SUBMIT"] },
  { icon: ClipboardCheck, label: "Review Workspace", id: "programming-approvals", path: "/admin/programming/approvals", group: "main", permissions: ["MOVIE_APPROVE", "RELEASE_PLAN_APPROVE", "SCHEDULE_PLAN_APPROVE"] },
  // Follow the actual programming lifecycle instead of splitting scheduling
  // into an isolated one-item section.
  { icon: Film, label: "Movie Catalogue", id: "programming-movies", path: "/admin/movies", group: "programming-workflow", permissions: ["MOVIE_READ"] },
  { icon: Layers3, label: "Screening Versions", id: "programming-versions", path: "/admin/screening-versions", group: "programming-workflow", permissions: ["MOVIE_READ"] },
  { icon: Calendar, label: "Release Planning", id: "programming-release", path: "/admin/release-plans", group: "programming-workflow", permissions: ["RELEASE_PLAN_READ"] },
  { icon: Clapperboard, label: "Create Schedules", id: "programming-schedule-create", path: "/admin/showtimes/auto/create", group: "programming-workflow", permissions: ["SCHEDULE_PLAN_SUBMIT"] },
  { icon: ClipboardCheck, label: "Review Schedules", id: "programming-schedule-review", path: "/admin/showtimes/auto/review", group: "programming-workflow", permissions: ["SCHEDULE_PLAN_APPROVE"] },
  { icon: CalendarClock, label: "Live Schedule", id: "programming-live-schedule", path: "/admin/showtimes", group: "programming-workflow", roles: ["ROLE_PROGRAMMING_OPERATOR", "ROLE_PROGRAMMING_APPROVER"], permissions: ["SHOWTIME_READ"] },
  { icon: Monitor, label: "Screening Formats", id: "programming-formats", path: "/admin/formats", group: "programming-reference", permissions: ["MOVIE_READ"] },
  { icon: Tags, label: "Genres", id: "programming-genres", path: "/admin/genres", group: "programming-reference", permissions: ["GENRE_READ"] },
  { icon: ShieldCheck, label: "Age Ratings", id: "programming-ratings", path: "/admin/age-ratings", group: "programming-reference", permissions: ["MOVIE_READ"] },
];

interface SidebarProps {
  isDarkMode?: boolean;
}

export function Sidebar({ isDarkMode = true }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];
  const userPermissions = user?.permissions ?? [];
  const isProgrammingOperator = userRoles.some((item) => item === "ROLE_PROGRAMMING_OPERATOR" || item === "ROLE_PROGRAMMING_APPROVER");
  const visibleNavItems = user?.role === "ROLE_EMPLOYEE"
    ? employeeNavItems
    : isProgrammingOperator
      ? programmingNavItems
      : adminNavItems.filter((item) => isPathInRoleWorkspace(user?.role, item.path));

  // Auto-expand items whose children match the current path
  const autoExpanded = visibleNavItems
    .filter(item => item.children?.some(c => location.pathname.startsWith(c.path) && c.path !== "/admin/movies" || location.pathname === c.path))
    .map(item => item.id);
  const [expandedIds, setExpandedIds] = useState<string[]>(autoExpanded);

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Badge: số phim đang PENDING_REVIEW (chỉ fetch cho ADMIN)
  const [pendingMovies, setPendingMovies] = useState(0);
  useEffect(() => {
    if (!user?.permissions.includes("MOVIE_APPROVE")
      && !user?.roles.some((item) => item === "ROLE_ADMIN" || item === "ROLE_SUPER_ADMIN")) return;
    movieApi.getAllMovies()
      .then(res => {
        const count = (res.result ?? []).filter(m => m.movieStatus === "PENDING_REVIEW").length;
        setPendingMovies(count);
      })
      .catch(() => {});
  }, [user?.permissions, user?.roles]);

  // Group destinations by business task instead of mixing content, cinema
  // infrastructure and low-frequency configuration under "Catalog".
  const groupMeta: Record<string, { label: string }> = {
    content: { label: "Content" },
    "facility-management": { label: "Facility Management" },
    "business-operations": { label: "Business Operations" },
    administration: { label: "Administration" },
    scheduling: { label: "Scheduling" },
    reference: { label: "Reference Data" },
    "programming-workflow": { label: "Film Programming" },
    "programming-reference": { label: "Reference Data" },
    "my-work": { label: "My Work" },
    "customer-operations": { label: "Customer Operations" },
    "food-beverage": { label: "Food & Beverage" },
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (group: string) => setCollapsedGroups((current) => {
    const next = new Set(current);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    return next;
  });

  // Preserve first occurrence order while ensuring that each group is rendered
  // once even when role-specific navigation items are interleaved.
  const isAllowed = ({ roles, permissions }: { roles?: string[]; permissions?: string[] }) => {
    const roleAllowed = !roles || roles.some((allowed) => userRoles.includes(allowed));
    const permissionAllowed = !permissions || permissions.some((allowed) => userPermissions.includes(allowed));
    return roleAllowed && permissionAllowed;
  };
  const filteredNavItems = visibleNavItems.filter(isAllowed);
  const sections: { group: string; items: NavItem[] }[] = [];
  const sectionIndexByGroup: Record<string, number> = {};
  filteredNavItems.forEach((item) => {
    const existingIdx = sectionIndexByGroup[item.group];
    if (existingIdx !== undefined) {
      sections[existingIdx].items.push(item);
    } else {
      sectionIndexByGroup[item.group] = sections.length;
      sections.push({ group: item.group, items: [item] });
    }
  });

  const renderNavItem = (item: NavItem, nestedInSection = false) => {
    const { icon: Icon, label, id, path, children } = item;
    const hasChildren = !!children?.length;
    const isExpanded = expandedIds.includes(id);
    // Active: exact for workspace roots, startsWith for operational pages
    const isWorkspaceRoot = path === "/admin" || path === "/employee";
    const isActive = isWorkspaceRoot
      ? location.pathname === path
      : !hasChildren && (path === "/admin/showtimes"
        ? location.pathname === path
        : location.pathname.startsWith(path));

    // Parent is "active" style when any child is active
    const childActive = hasChildren && children!.some(c => location.pathname.startsWith(c.path));

    const btnStyle = (active: boolean): React.CSSProperties => ({
      width: "100%", display: "flex", alignItems: "center", gap: "11px",
      padding: nestedInSection ? "10px 12px 10px 30px" : "10px 12px",
      marginBottom: "2px", borderRadius: "8px",
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
        {/* Parent button */}
        <button
          onClick={() => hasChildren ? toggleExpand(id) : navigate(path)}
          style={btnStyle(isActive || childActive)}
          onMouseEnter={(e) => hoverOn(e, isActive || childActive)}
          onMouseLeave={(e) => hoverOff(e, isActive || childActive)}
        >
          {(isActive || childActive) && (
            <span style={{ position: "absolute", left: nestedInSection ? 16 : 0, top: "50%", transform: "translateY(-50%)", width: "3px", height: "18px", background: isDarkMode ? "#3b82f6" : "#2563eb", borderRadius: "0 2px 2px 0", boxShadow: isDarkMode ? "0 0 8px rgba(59,130,246,0.7)" : "0 0 6px rgba(37,99,235,0.4)" }} />
          )}
          <Icon size={16} style={(isActive || childActive) && isDarkMode ? { filter: "drop-shadow(0 0 4px rgba(59,130,246,0.5))" } : {}} />
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
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
              .filter(isAllowed)
              .map(child => {
                const ChildIcon = child.icon;
                const childIsActive = location.pathname === child.path || (child.path !== "/admin/movies" && location.pathname.startsWith(child.path));
                return (
                  <button
                    key={child.path}
                    onClick={() => navigate(child.path)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "9px",
                      padding: nestedInSection ? "8px 12px 8px 54px" : "8px 12px 8px 36px",
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
  };

  return (
    <aside
      style={{
        width: "280px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
          {/* The bordered tile is gone: the planet mark carries its own
              silhouette and halo, so it does not belong inside a box. Size is
              tuned against the wordmark's cap height rather than the 36px tile
              the old Clapperboard glyph sat in. The halo is only tuned for
              dark backgrounds, so it is switched off in light mode. */}
          <OrbitaLogo size={26} glow={isDarkMode} />
          <div>
            {/* Matches the customer navbar's wordmark treatment (uppercase,
                800 weight, tracked-out, "Cine" flat / "Prime" gradient) instead
                of the flat solid-blue label this used to be — same mark,
                consistent everywhere it appears. Sized down from the navbar's
                1.45rem to fit the sidebar rail without wrapping. */}
            <div
              className="uppercase"
              style={{
                fontWeight: 800,
                fontSize: "18px",
                letterSpacing: "0.09em",
                lineHeight: 1,
                textShadow: isDarkMode ? "0 0 16px rgba(59,130,246,0.4)" : "none",
                transition: "color 0.25s ease",
              }}
            >
              <span style={{ color: isDarkMode ? "#f0f6ff" : "#0f172a" }}>Cine</span>
              <span
                style={{
                  background: "linear-gradient(135deg, #93c5fd 0%, #3b82f6 50%, #2563eb 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Prime
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Task-oriented navigation */}
      <nav style={{ padding: "10px 10px 14px", flex: 1, overflowY: "auto", minHeight: 0 }}>
        {sections.map(({ group, items }) => {
          const isRoot = group === "main";
          const meta = groupMeta[group] ?? { label: group };
          const isCollapsed = collapsedGroups.has(group);
          const headerStyle: React.CSSProperties = {
            width: "100%", display: "flex", alignItems: "center",
            padding: "15px 12px 7px", border: "none", background: "transparent",
            color: isDarkMode ? "#7f8794" : "#64748b", cursor: "pointer", textAlign: "left",
            fontSize: "12.5px", fontWeight: 800, letterSpacing: "0.065em",
            textTransform: "uppercase", whiteSpace: "nowrap",
          };
          return (
            <div key={group} style={isRoot ? undefined : { marginTop: "2px" }}>
              {!isRoot && (
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group)}
                  style={headerStyle}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
                  <ChevronDown
                    size={13}
                    style={{
                      flexShrink: 0,
                      opacity: 0.6,
                      transition: "transform 0.2s ease",
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
              )}
              <div
                style={{
                  overflow: "hidden",
                  maxHeight: !isRoot && isCollapsed ? 0 : 1000,
                  transition: "max-height 0.25s ease",
                }}
              >
                {items.map((item) => renderNavItem(item, !isRoot))}
              </div>
            </div>
          );
        })}
      </nav>

    </aside>
  );
}
