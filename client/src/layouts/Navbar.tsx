import { useState, useEffect, useRef } from "react";
import { Search, Menu, X, LogOut, User, ChevronDown, LayoutDashboard, TicketCheck } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { userApi } from "../api/userApi";
import { movieApi } from "../api/movieApi";
import { defaultPathForRole } from "../utils/roleRoutes";
import { useBookingFlow } from "../context/BookingFlowContext";
import { PROFILE_UPDATED_EVENT, type ProfileUpdatedDetail } from "../utils/profileEvents";

const ACCENT = "#3b82f6";
// A soft aurora glow blooming from the left (behind the logo) over the
// existing near-black glass bar — background only. Logo, search field, and
// Sign In control are left exactly as they are.
const NAVBAR_BG =
  "radial-gradient(60% 140% at 0% 50%, rgba(37,99,235,0.22), transparent 70%), " +
  "rgba(5,5,5,0.85)";
const navItems: { label: string; to: string; children?: { label: string; to: string }[] }[] = [
  { label: "Home", to: "/home" },
  {
    label: "Movies", to: "/movies",
    children: [
      { label: "Now Showing", to: "/movies#now-showing" },
      { label: "Coming Soon", to: "/movies#coming-soon" },
    ],
  },
  { label: "Cinemas", to: "/cinemas", children: [] },
  { label: "Events", to: "/events" },
  { label: "Offers", to: "/offers" },
];

const roleLabels: Record<string, string> = {
  ROLE_SUPER_ADMIN: "Super Admin",
  ROLE_ADMIN: "Admin",
  ROLE_EMPLOYEE: "Employee",
  ROLE_BRANCH_MANAGER: "Branch Manager",
  ROLE_PROGRAMMING_OPERATOR: "Programming Operator",
  ROLE_PROGRAMMING_APPROVER: "Programming Approver",
  ROLE_FINANCE_OFFICER: "Finance Officer",
  ROLE_FINANCE_APPROVER: "Finance Approver",
  ROLE_COMMERCIAL_MANAGER: "Commercial Manager",
  ROLE_SYSTEM_ADMIN: "System Administrator",
  ROLE_SECURITY_AUDITOR: "Security Auditor",
  ROLE_MEMBER: "Member",
};

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [cinemaClusters, setCinemaClusters] = useState<{ label: string; to: string }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cancelAction } = useBookingFlow();

  const token = localStorage.getItem("accessToken");
  const isLogged = !!token;
  const username = user?.username || "User";
  const displayName = fullName?.trim() || username;
  const isStaff = !!user && user.role !== "ROLE_MEMBER";
  const staffWorkspacePath = defaultPathForRole(user?.role ?? "");

  // Fetch avatar khi user đăng nhập
  useEffect(() => {
    if (!user?.accountId) { setAvatarUrl(null); setFullName(null); return; }
    userApi.getUserById(user.accountId)
      .then((res: any) => {
        const p = res?.result ?? res?.data?.result ?? res?.data ?? res;
        setAvatarUrl(p?.avatarUrl ?? null);
        setFullName(p?.fullName ?? null);
      })
      .catch(() => { setAvatarUrl(null); setFullName(null); });
  }, [user?.accountId]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail;
      if (!detail || detail.accountId !== user?.accountId) return;
      setAvatarUrl(detail.avatarUrl);
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, [user?.accountId]);

  // Load danh sách chi nhánh rạp đang hoạt động cho dropdown "Cinemas"
  useEffect(() => {
    movieApi.getClusters()
      .then((res) => {
        const clusters = (res.result ?? [])
          .filter((c) => c.status === "ACTIVE")
          .map((c) => ({ label: c.clusterName, to: `/cinemas?q=${encodeURIComponent(c.clusterName)}` }));
        setCinemaClusters(clusters);
      })
      .catch(() => setCinemaClusters([]));
  }, []);

  const resolvedNavItems = navItems.map((item) =>
    item.label === "Cinemas" ? { ...item, children: cinemaClusters } : item
  );

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate("/login", { replace: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/movies?search=${encodeURIComponent(q)}`);
    setMenuOpen(false);
  };

  const logo = (
    <Link to="/" className="flex items-center gap-2.5 cursor-pointer select-none group">
      {/* "Orbita" mark — pure SVG so it stays crisp at any size.
          Layer order is load-bearing, not incidental:
            1. the FULL tilted ring, dimmed — this is the half that will read
               as passing behind the planet
            2. the sphere, which covers that rear half
            3. rim light: a thin bright crescent on the shaded limb, made by
               masking the sphere against a slightly offset copy of itself
            4. the ring's shadow cast onto the planet's surface, clipped to
               the sphere — this is the detail that makes the mark read as one
               3D object instead of two flat shapes stacked together
            5. specular highlight on the lit side
            6. the FRONT arc at full opacity, plus the satellite
          Reordering 1/2/4/6 breaks the depth illusion. */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-300 group-hover:scale-105"
        style={{ width: 44, height: 44, filter: "drop-shadow(0 0 10px rgba(59,130,246,0.45))" }}
      >
        <defs>
          <radialGradient id="cpLogoSphere" cx="34%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="45%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </radialGradient>
          <linearGradient id="cpLogoRing" gradientUnits="userSpaceOnUse" x1="20" y1="30" x2="180" y2="170">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          {/* Offsetting the black circle up-left by 7 and growing it slightly
              leaves a hairline crescent along the bottom-right limb. */}
          <mask id="cpLogoRim">
            <circle cx="100" cy="100" r="49" fill="#fff" />
            <circle cx="93" cy="93" r="48.2" fill="#000" />
          </mask>
          <radialGradient id="cpLogoSpec">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="cpLogoClip">
            <circle cx="100" cy="100" r="49" />
          </clipPath>
        </defs>

        <g transform="rotate(-22 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="86"
            ry="31"
            fill="none"
            stroke="url(#cpLogoRing)"
            strokeWidth="7"
            opacity="0.5"
          />
        </g>

        <circle cx="100" cy="100" r="49" fill="url(#cpLogoSphere)" />
        <circle cx="100" cy="100" r="49" fill="#7DD3FC" mask="url(#cpLogoRim)" opacity="0.8" />

        <g clipPath="url(#cpLogoClip)">
          <g transform="rotate(-22 100 100)">
            <path
              d="M14,108 A86,31 0 0 0 186,108"
              fill="none"
              stroke="#0A1A42"
              strokeWidth="7"
              opacity="0.5"
            />
          </g>
        </g>

        <ellipse cx="83" cy="79" rx="15" ry="10" fill="url(#cpLogoSpec)" transform="rotate(-28 83 79)" />

        <g transform="rotate(-22 100 100)">
          <path
            d="M14,100 A86,31 0 0 0 186,100"
            fill="none"
            stroke="url(#cpLogoRing)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="186" cy="100" r="8.5" fill="#7DD3FC" />
        </g>
      </svg>
      <span
        className="uppercase leading-none"
        style={{
          fontSize: "1.3rem",
          fontWeight: 800,
          letterSpacing: "0.18em",
          fontFamily: "'Inter', sans-serif",
          textShadow: "0 0 22px rgba(59,130,246,0.45)",
        }}
      >
        <span style={{ color: "#f0f6ff" }}>Cine</span>
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
      </span>
    </Link>
  );

  // While a Food/Payment step is registering a cancel action, the full
  // navigation would just tempt the customer away mid-checkout (and doubles
  // up on branding with the step's own header). Lock down to logo + exit.
  if (cancelAction) {
    return (
      <nav
        style={{ background: NAVBAR_BG, backdropFilter: "blur(12px)" }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
      >
        {/* Stars are confined to their own clipped strip — NOT nav itself —
            so this never risks clipping a dropdown that overflows below. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 overflow-hidden" aria-hidden="true">
          <div className="cp-stars absolute inset-0" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          {logo}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancelAction.onClick}
              className="group flex min-h-9 items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-2 text-sm font-semibold text-rose-200 transition-all hover:-translate-y-px hover:border-rose-300/35 hover:bg-rose-400/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/35"
            >
              <span className="grid h-5 w-5 place-items-center rounded-md bg-rose-400/10 text-rose-300 transition-colors group-hover:bg-rose-400/20">
                <X size={13} strokeWidth={2.2} />
              </span>
              <span>{cancelAction.label}</span>
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      style={{ background: NAVBAR_BG, backdropFilter: "blur(12px)" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
    >
      {/* Stars are confined to their own clipped strip — NOT nav itself — so
          this never risks clipping the Movies/Cinemas dropdowns, the account
          menu, or the mobile menu panel, all of which overflow below h-16. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 overflow-hidden" aria-hidden="true">
        <div className="cp-stars absolute inset-0" />
      </div>
      <div className="relative max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {logo}

        <div className="hidden md:flex items-center gap-8">
          {resolvedNavItems.map((item) =>
            item.children && item.children.length > 0 ? (
              <div key={item.to} className="relative group">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1 ${isActive ? "text-white" : "text-white/70"} hover:text-white transition-colors duration-200`
                  }
                  style={{ fontSize: "0.875rem", letterSpacing: "0.05em" }}
                >
                  {item.label}
                  <ChevronDown size={13} className="transition-transform duration-200 group-hover:rotate-180" />
                </NavLink>
                {/* pt-3 bridges the gap to the panel below so the hover state survives moving the
                    mouse from the link down into the dropdown, instead of closing mid-transit. */}
                <div className="absolute left-0 top-full pt-3 opacity-0 invisible -translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
                  <div style={{ background: "#0f1117", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: 6, minWidth: 220 }}>
                    <div className="nav-dropdown-scroll" style={{ maxHeight: 280, overflowY: "auto" }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className="block whitespace-nowrap rounded-lg px-4 py-2.5 text-white/70 transition-colors duration-150"
                          style={{ fontSize: "0.9rem" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(59,130,246,0.14)";
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.boxShadow = "inset 3px 0 0 0 #3b82f6";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                    {item.label === "Cinemas" && (
                      <>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 5px" }} />
                        <Link
                          to="/cinemas"
                          className="block rounded-lg px-4 py-2.5 transition-colors duration-150"
                          style={{ fontSize: "0.9rem", color: "#60a5fa", fontWeight: 600 }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(59,130,246,0.14)";
                            e.currentTarget.style.boxShadow = "inset 3px 0 0 0 #3b82f6";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          View all cinemas →
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${isActive ? "text-white" : "text-white/70"} hover:text-white transition-colors duration-200`
                }
                style={{ fontSize: "0.875rem", letterSpacing: "0.05em" }}
              >
                {item.label}
              </NavLink>
            )
          )}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 rounded-full px-4 py-2 transition-all duration-200"
            style={{
              backgroundColor: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.35)",
            }}
          >
            <Search size={15} style={{ color: ACCENT }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies..."
              className="bg-transparent outline-none text-white placeholder-white/40"
              style={{ fontSize: "0.85rem", width: "150px" }}
            />
          </form>

          {isLogged ? (
            <div style={{ position: "relative" }} ref={dropdownRef}>
              {/* Avatar trigger */}
              <button
                type="button"
                className="navbar-avatar-trigger"
                onClick={() => setDropdownOpen(o => !o)}
                aria-label={`Open account menu for ${displayName}`}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                title={displayName}
                style={{
                  width: 38, height: 38, display: "grid", placeItems: "center",
                  background: dropdownOpen ? "rgba(37,99,235,0.16)" : "transparent",
                  border: 0, borderRadius: "50%", padding: 2,
                  cursor: "pointer",
                }}
              >
                <div
                  className="navbar-avatar"
                  style={{
                    width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                    boxShadow: dropdownOpen
                      ? "0 8px 24px rgba(37,99,235,0.42)"
                      : "0 6px 18px rgba(37,99,235,0.24)",
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(145deg,#60a5fa 0%,#2563eb 48%,#1e40af 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>{displayName.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="nav-account-menu" role="menu" style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0, width: 232,
                  borderRadius: 16, padding: 7, zIndex: 100,
                  animation: "navDropdown 0.18s cubic-bezier(0.16,1,0.3,1) both",
                }}>
                  <div className="nav-account-header">
                    <div className="nav-account-header-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" />
                      ) : (
                        <span>{displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="nav-account-name">{displayName}</p>
                      <p className="nav-account-role">{roleLabels[user?.role ?? ""] ?? "Member"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { navigate("/profile"); setDropdownOpen(false); }}
                    className="nav-account-action"
                    role="menuitem"
                  >
                    <span className="nav-account-action-icon"><User size={15} /></span>
                    <span>My Profile</span>
                  </button>
                  {!isStaff && (
                    <button
                      onClick={() => { navigate("/my-bookings"); setDropdownOpen(false); }}
                      className="nav-account-action"
                      role="menuitem"
                    >
                      <span className="nav-account-action-icon"><TicketCheck size={15} /></span>
                      <span>My Bookings</span>
                    </button>
                  )}
                  {isStaff && (
                    <button
                      onClick={() => { navigate(staffWorkspacePath); setDropdownOpen(false); }}
                      className="nav-account-action"
                      role="menuitem"
                    >
                      <span className="nav-account-action-icon"><LayoutDashboard size={15} /></span>
                      <span>Back to workspace</span>
                    </button>
                  )}
                  <div className="nav-account-divider" />
                  <button
                    onClick={handleLogout}
                    className="nav-account-action nav-account-signout"
                    role="menuitem"
                  >
                    <span className="nav-account-action-icon"><LogOut size={15} /></span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
              style={{
                color: ACCENT,
                border: `1px solid ${ACCENT}`,
                backgroundColor: "rgba(59,130,246,0.08)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = ACCENT;
                e.currentTarget.style.color = "#050505";
                e.currentTarget.style.boxShadow = "0 0 16px rgba(59,130,246,0.45)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(59,130,246,0.08)";
                e.currentTarget.style.color = ACCENT;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <User size={15} />
              Sign In
            </Link>
          )}
        </div>

        <button
          className="md:hidden text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div style={{ backgroundColor: "#050505" }} className="md:hidden px-6 pb-4 flex flex-col gap-4 border-t border-white/10 pt-4">

          {isLogged && (
             <div className="flex items-center justify-between mb-2 pb-4 border-b border-white/10">
               <div className="flex items-center gap-3">
                 <div
                   className="w-10 h-10 rounded-full flex items-center justify-center"
                   style={{ backgroundColor: "rgba(59,130,246,0.15)", border: `1px solid ${ACCENT}` }}
                 >
                   <span style={{ color: ACCENT, fontWeight: 700 }}>
                     {displayName.charAt(0).toUpperCase()}
                   </span>
                 </div>
                 <span className="text-white font-medium">{displayName}</span>
               </div>
               <button onClick={handleLogout} className="text-white/50 hover:text-white">
                 <LogOut size={20} />
               </button>
             </div>
          )}

          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 rounded-full px-4 py-3 w-full"
            style={{
              backgroundColor: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.35)",
            }}
          >
            <Search size={16} style={{ color: ACCENT }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies..."
              className="bg-transparent outline-none text-white placeholder-white/40 w-full"
              style={{ fontSize: "0.9rem" }}
            />
          </form>

          {resolvedNavItems.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `${isActive ? "text-white" : "text-white/70"} hover:text-white text-sm py-1`
                }
              >
                {item.label}
              </NavLink>
              {item.children && item.children.length > 0 && (
                <div
                  className={`flex flex-col gap-1 pl-4 mt-1 border-l border-white/10 ${item.label === "Cinemas" ? "nav-dropdown-scroll" : ""}`}
                  style={item.label === "Cinemas" ? { maxHeight: 200, overflowY: "auto" } : undefined}
                >
                  {item.children.map((child) => (
                    <Link
                      key={child.to}
                      to={child.to}
                      onClick={() => setMenuOpen(false)}
                      className="text-white/50 hover:text-white text-sm py-1"
                    >
                      {child.label}
                    </Link>
                  ))}
                  {item.label === "Cinemas" && (
                    <Link
                      to="/cinemas"
                      onClick={() => setMenuOpen(false)}
                      className="text-sm py-1 font-semibold"
                      style={{ color: "#60a5fa" }}
                    >
                      View all cinemas →
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}

          {isStaff && (
            <button
              onClick={() => { navigate(staffWorkspacePath); setMenuOpen(false); }}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full w-full mt-1 text-sm font-semibold"
              style={{ color: "#60a5fa", border: "1px solid rgba(59,130,246,0.4)", backgroundColor: "rgba(59,130,246,0.08)" }}
            >
              <LayoutDashboard size={16} />
              Back to workspace
            </button>
          )}

          {isLogged && !isStaff && (
            <button
              onClick={() => { navigate("/my-bookings"); setMenuOpen(false); }}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full w-full mt-1 text-sm font-semibold"
              style={{ color: "#60a5fa", border: "1px solid rgba(59,130,246,0.4)", backgroundColor: "rgba(59,130,246,0.08)" }}
            >
              <TicketCheck size={16} />
              My Bookings
            </button>
          )}

          {!isLogged && (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full w-full mt-1 text-sm font-semibold transition-all duration-200"
              style={{
                color: ACCENT,
                border: `1px solid ${ACCENT}`,
                backgroundColor: "rgba(59,130,246,0.08)",
              }}
            >
              <User size={16} />
              Sign In
            </Link>
          )}
        </div>
      )}

      <style>{`
        @keyframes navDropdown {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        .navbar-avatar-trigger:hover {
          background: rgba(37,99,235,0.14) !important;
          transform: translateY(-1px);
        }
        .navbar-avatar-trigger {
          transition: background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .navbar-avatar-trigger:focus {
          outline: none;
        }
        .navbar-avatar-trigger:focus-visible {
          box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
        }
        .navbar-avatar-trigger:hover .navbar-avatar {
          box-shadow: 0 9px 26px rgba(37,99,235,0.42) !important;
        }
        .nav-account-menu {
          overflow: hidden;
          background:
            radial-gradient(90% 75% at 100% 0%, rgba(59,130,246,0.22), transparent 68%),
            radial-gradient(55% 70% at 0% 100%, rgba(30,64,175,0.18), transparent 72%),
            linear-gradient(150deg, rgba(15,30,62,0.985), rgba(8,15,32,0.99) 58%, rgba(6,10,22,0.995));
          border: 1px solid rgba(96,165,250,0.2);
          box-shadow: 0 24px 68px rgba(0,0,0,0.58), 0 10px 32px rgba(30,64,175,0.16), inset 0 1px 0 rgba(255,255,255,0.05);
          backdrop-filter: blur(22px);
        }
        .nav-account-header {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px 11px 13px;
          margin-bottom: 5px;
          border-bottom: 1px solid rgba(148,163,184,0.13);
        }
        .nav-account-header-avatar {
          display: grid;
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          place-items: center;
          overflow: hidden;
          border-radius: 999px;
          background: linear-gradient(145deg,#60a5fa 0%,#2563eb 48%,#1e40af 100%);
          box-shadow: 0 8px 22px rgba(37,99,235,0.3);
          color: white;
          font-size: 13px;
          font-weight: 800;
        }
        .nav-account-header-avatar img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .nav-account-name {
          overflow: hidden;
          margin: 0;
          color: #f8fafc;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nav-account-role {
          overflow: hidden;
          margin: 2px 0 0;
          color: rgba(147,197,253,0.62);
          font-size: 11px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nav-account-action {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 9px 10px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: rgba(226,232,240,0.76);
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          transition: color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
        }
        .nav-account-action:hover {
          color: #fff;
          background: rgba(59,130,246,0.13);
          transform: translateX(2px);
        }
        .nav-account-action-icon {
          display: grid;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          place-items: center;
          border-radius: 9px;
          background: rgba(59,130,246,0.1);
          color: #60a5fa;
          transition: color 0.16s ease, background-color 0.16s ease;
        }
        .nav-account-action:hover .nav-account-action-icon {
          color: #bfdbfe;
          background: rgba(59,130,246,0.2);
        }
        .nav-account-divider {
          height: 1px;
          margin: 5px 7px;
          background: rgba(148,163,184,0.13);
        }
        .nav-account-signout {
          color: #fca5a5;
        }
        .nav-account-signout .nav-account-action-icon {
          color: #fb7185;
          background: rgba(244,63,94,0.09);
        }
        .nav-account-signout:hover {
          color: #fecdd3;
          background: rgba(244,63,94,0.1);
        }
        .nav-account-signout:hover .nav-account-action-icon {
          color: #fda4af;
          background: rgba(244,63,94,0.16);
        }
        .nav-dropdown-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        .nav-dropdown-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .nav-dropdown-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .nav-dropdown-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 999px;
        }
        .nav-dropdown-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.28);
        }
      `}</style>
    </nav>
  );
}
