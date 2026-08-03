import { useState, useEffect, useRef } from "react";
import { Film, Search, Menu, X, LogOut, User, ChevronDown, LayoutDashboard, TicketCheck } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { userApi } from "../api/userApi";
import { movieApi } from "../api/movieApi";
import { defaultPathForRole } from "../utils/roleRoutes";
import { useBookingFlow } from "../context/BookingFlowContext";

const ACCENT = "#3b82f6";
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
  ROLE_MEMBER: "Member",
};

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cinemaClusters, setCinemaClusters] = useState<{ label: string; to: string }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cancelAction } = useBookingFlow();

  const token = localStorage.getItem("accessToken");
  const isLogged = !!token;
  const username = user?.username || "User";
  const isStaff = ["ROLE_SUPER_ADMIN", "ROLE_ADMIN", "ROLE_PROGRAMMING_OPERATOR", "ROLE_BRANCH_MANAGER", "ROLE_EMPLOYEE"].includes(user?.role ?? "");
  const staffWorkspacePath = defaultPathForRole(user?.role ?? "");

  // Fetch avatar khi user đăng nhập
  useEffect(() => {
    if (!user?.accountId) { setAvatarUrl(null); return; }
    userApi.getUserById(user.accountId)
      .then((res: any) => {
        const p = res?.result ?? res?.data?.result ?? res?.data ?? res;
        setAvatarUrl(p?.avatarUrl ?? null);
      })
      .catch(() => setAvatarUrl(null));
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
      <div
        className="flex items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
        style={{
          width: "38px",
          height: "38px",
          background: "linear-gradient(135deg, rgba(96,165,250,0.18), rgba(37,99,235,0.10))",
          border: "1px solid rgba(96,165,250,0.45)",
          boxShadow: "0 0 18px rgba(59,130,246,0.35), inset 0 0 10px rgba(96,165,250,0.15)",
        }}
      >
        <Film size={20} style={{ color: "#60a5fa", filter: "drop-shadow(0 0 6px rgba(96,165,250,0.7))" }} />
      </div>
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
        style={{ backgroundColor: "rgba(5,5,5,0.85)", backdropFilter: "blur(12px)" }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          {logo}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancelAction.onClick}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-rose-300/80 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
            >
              <X size={15} /> {cancelAction.label}
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      style={{ backgroundColor: "rgba(5,5,5,0.85)", backdropFilter: "blur(12px)" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
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
                onClick={() => setDropdownOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(59,130,246,0.08)", border: `1px solid ${dropdownOpen ? ACCENT : "rgba(59,130,246,0.3)"}`,
                  borderRadius: 99, padding: "5px 12px 5px 5px",
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {/* Avatar circle */}
                <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `1.5px solid ${ACCENT}` }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1e3a8a,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{username.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", fontWeight: 500 }}>{username}</span>
                <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0, width: 200,
                  background: "#0f1117", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  padding: 6, zIndex: 100,
                  animation: "navDropdown 0.18s cubic-bezier(0.16,1,0.3,1) both",
                }}>
                  <div style={{ padding: "10px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{username}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{roleLabels[user?.role ?? ""] ?? "Member"}</p>
                  </div>
                  <button
                    onClick={() => { navigate("/profile"); setDropdownOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 13, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                  >
                    <User size={15} /> My Profile
                  </button>
                  {!isStaff && (
                    <button
                      onClick={() => { navigate("/my-bookings"); setDropdownOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 13, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.1)"; e.currentTarget.style.color = "#60a5fa"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                    >
                      <TicketCheck size={15} /> My Bookings
                    </button>
                  )}
                  {isStaff && (
                    <button
                      onClick={() => { navigate(staffWorkspacePath); setDropdownOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 13, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.1)"; e.currentTarget.style.color = "#60a5fa"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                    >
                      <LayoutDashboard size={15} /> Back to workspace
                    </button>
                  )}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                  <button
                    onClick={handleLogout}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8, color: "#ef4444", fontSize: 13, fontWeight: 500, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <LogOut size={15} /> Sign Out
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
                     {username.charAt(0).toUpperCase()}
                   </span>
                 </div>
                 <span className="text-white font-medium">{username}</span>
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
