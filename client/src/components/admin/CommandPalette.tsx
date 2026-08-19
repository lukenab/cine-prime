import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CalendarDays,
  BookOpen,
  Clapperboard,
  Film,
  Layers3,
  LayoutDashboard,
  MapPin,
  Popcorn,
  Settings2,
  Tags,
  Ticket,
  UserCog,
  Armchair,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

type PaletteIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

interface PaletteEntry {
  label: string;
  description: string;
  path: string;
  group: string;
  keywords: string;
  icon: PaletteIcon;
  roles?: string[];
  permissions?: string[];
}

const entries: PaletteEntry[] = [
  { label: "Dashboard", description: "Business overview and admin KPIs", path: "/admin", group: "Workspace", keywords: "home overview analytics revenue", icon: LayoutDashboard, roles: ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"] },
  { label: "Movie catalogue", description: "Import and manage movie content", path: "/admin/movies", group: "Content", keywords: "movie films tmdb catalogue", icon: Film, permissions: ["MOVIE_READ"] },
  { label: "Release planning", description: "Create and review release plans", path: "/admin/release-plans", group: "Content", keywords: "release plan programming", icon: CalendarDays, permissions: ["RELEASE_PLAN_READ"] },
  { label: "Screening versions", description: "Manage presentation, audio and subtitle versions", path: "/admin/screening-versions", group: "Content", keywords: "format version language audio subtitle", icon: Layers3, permissions: ["MOVIE_READ"] },
  { label: "Cinema clusters", description: "Manage branches and operating status", path: "/admin/clusters", group: "Facilities", keywords: "cinema branch cluster location", icon: Building2, roles: ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"] },
  { label: "Screening rooms", description: "Manage rooms, layouts and capacity", path: "/admin/rooms", group: "Facilities", keywords: "room seat theatre layout", icon: Armchair, roles: ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"] },
  { label: "Showtime operations", description: "Review and manage published showtimes", path: "/admin/showtimes", group: "Operations", keywords: "showtime schedule screening", icon: Clapperboard, roles: ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"] },
  { label: "Automatic scheduling", description: "Generate schedule drafts for review", path: "/admin/showtimes/auto", group: "Operations", keywords: "auto schedule scheduling plan", icon: CalendarDays, permissions: ["SCHEDULE_PLAN_SUBMIT", "SCHEDULE_PLAN_APPROVE"] },
  { label: "Price books", description: "Manage branch pricing and availability", path: "/admin/price-books", group: "Operations", keywords: "price pricing rate book", icon: BookOpen, permissions: ["PRICE_BOOK_READ", "PRICE_BOOK_MANAGE"] },
  { label: "Bookings", description: "Search and manage customer bookings", path: "/admin/bookings", group: "Business operations", keywords: "booking order ticket reservation", icon: Ticket, permissions: ["BOOKING_READ"] },
  { label: "Concession catalogue", description: "Manage products, SKUs and combos", path: "/admin/concessions/catalog", group: "Business operations", keywords: "concession snack popcorn drink product combo", icon: Popcorn, permissions: ["CONCESSION_CATALOG_DRAFT", "CONCESSION_CATALOG_APPROVE"] },
  { label: "Concession fulfillment", description: "Prepare paid orders for pickup", path: "/admin/concessions/fulfillment", group: "Business operations", keywords: "concession order pickup fulfillment", icon: Popcorn, roles: ["ROLE_ADMIN", "ROLE_SUPER_ADMIN"] },
  { label: "Promotions", description: "Manage promotion codes and eligibility", path: "/admin/promotions", group: "Business operations", keywords: "promotion voucher discount offer", icon: Tags, permissions: ["PROMOTION_READ"] },
  { label: "Refunds & reconciliation", description: "Resolve refunds and payment exceptions", path: "/admin/refunds-reconciliation", group: "Business operations", keywords: "refund reconciliation payment finance", icon: ReceiptText, permissions: ["REFUND_READ", "RECONCILIATION_READ"] },
  { label: "People & access", description: "Manage customers, staff and invitations", path: "/admin/people", group: "Administration", keywords: "people users employees staff access rbac", icon: UserCog, permissions: ["EMPLOYEE_READ", "USER_READ", "ROLE_MANAGE"] },
  { label: "Reports", description: "Review operational and financial reports", path: "/admin/reports", group: "Administration", keywords: "report analytics dashboard", icon: BarChart3, permissions: ["REPORT_READ", "AUDIT_READ"] },
  { label: "Settings", description: "Configure workspace preferences", path: "/admin/settings", group: "Administration", keywords: "settings configuration", icon: Settings2, permissions: ["SYSTEM_CONFIG_MANAGE"] },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredEntries = useMemo(() => {
    const legacyAdmin = user?.roles.some((role) => role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN");
    const visible = entries.filter((entry) => legacyAdmin
      || ((!entry.roles || entry.roles.some((role) => user?.roles.includes(role)))
        && (!entry.permissions || entry.permissions.some((permission) => user?.permissions.includes(permission)))));
    const normalized = query.trim().toLowerCase();
    if (!normalized) return visible;
    return visible.filter((entry) =>
      `${entry.label} ${entry.description} ${entry.keywords}`.toLowerCase().includes(normalized),
    );
  }, [query, user?.permissions, user?.roles]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    onOpenChange(false);
  }, [location.pathname]); // close after navigation

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => filteredEntries.length ? (index + 1) % filteredEntries.length : 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => filteredEntries.length ? (index - 1 + filteredEntries.length) % filteredEntries.length : 0);
      } else if (event.key === "Enter" && filteredEntries[selectedIndex]) {
        event.preventDefault();
        navigate(filteredEntries[selectedIndex].path);
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filteredEntries, navigate, onOpenChange, open, selectedIndex]);

  useEffect(() => {
    setSelectedIndex((index) => Math.min(index, Math.max(filteredEntries.length - 1, 0)));
  }, [filteredEntries.length]);

  if (!open) return null;

  let lastGroup = "";
  const portalRoot = document.querySelector<HTMLElement>("#root > .theme-dark, #root > .theme-light")
    ?? document.querySelector<HTMLElement>(".theme-dark, .theme-light")
    ?? document.body;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "82px 16px 24px",
        background: "var(--modal-backdrop, rgba(15, 23, 42, 0.42))",
        backdropFilter: "blur(5px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Search and navigate"
        style={{
          width: "min(640px, 100%)",
          maxHeight: "min(620px, calc(100vh - 110px))",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          background: "var(--bg-card)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          color: "var(--text-main)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderBottom: "1px solid var(--border-color)" }}>
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, workflows or settings…"
            aria-label="Search admin pages"
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "var(--text-main)", fontSize: "14px", fontFamily: "inherit" }}
          />
          <kbd style={{ border: "1px solid var(--border-color)", borderRadius: "6px", padding: "3px 7px", color: "var(--text-sub)", fontSize: "11px" }}>Esc</kbd>
        </div>

        <div style={{ maxHeight: "510px", overflowY: "auto", padding: "8px" }}>
          {filteredEntries.length === 0 ? (
            <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--text-sub)", fontSize: "13px" }}>
              <div style={{ color: "var(--text-main)", fontWeight: 600, marginBottom: "6px" }}>No matching admin pages</div>
              Search within the current workspace for movies, bookings or people.
            </div>
          ) : filteredEntries.map((entry, index) => {
            const showGroup = entry.group !== lastGroup;
            lastGroup = entry.group;
            const Icon = entry.icon;
            return (
              <div key={entry.path}>
                {showGroup && <div style={{ padding: "10px 10px 5px", color: "var(--text-sub)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase" }}>{entry.group}</div>}
                <button
                  type="button"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => { navigate(entry.path); onOpenChange(false); }}
                  aria-selected={selectedIndex === index}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px",
                    border: "1px solid transparent",
                    borderRadius: "10px",
                    background: selectedIndex === index ? "rgba(37, 99, 235, 0.14)" : "transparent",
                    borderColor: selectedIndex === index ? "rgba(59, 130, 246, 0.32)" : "transparent",
                    color: "var(--text-main)",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ width: "32px", height: "32px", display: "grid", placeItems: "center", flex: "0 0 auto", borderRadius: "9px", background: selectedIndex === index ? "rgba(37, 99, 235, 0.18)" : "var(--bg-main)", color: selectedIndex === index ? "#60a5fa" : "var(--text-sub)" }}><Icon size={16} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>{entry.label}</span>
                    <span style={{ display: "block", marginTop: "2px", overflow: "hidden", color: "var(--text-sub)", fontSize: "11px", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.description}</span>
                  </span>
                  <span style={{ color: "var(--text-sub)", fontSize: "17px" }}>›</span>
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--border-color)", color: "var(--text-sub)", fontSize: "11px" }}>
          <span>Navigate with ↑ ↓ · Open with Enter</span>
          <span>Quick navigation</span>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}

function SearchIcon() {
  return <span aria-hidden="true" style={{ color: "#60a5fa", display: "inline-flex" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg></span>;
}
