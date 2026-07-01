import { useState } from "react";
import { Film, Search, Menu, X, LogOut, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ACCENT = "#3b82f6";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const token = localStorage.getItem("accessToken");
  const isLogged = !!token;
  const username = user?.username || "User";

  const handleLogout = () => {
    logout();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/movies?search=${encodeURIComponent(q)}`);
    setMenuOpen(false);
  };

  return (
    <nav
      style={{ backgroundColor: "rgba(5,5,5,0.85)", backdropFilter: "blur(12px)" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-2.5 cursor-pointer select-none group">
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
        </div>

        <div className="hidden md:flex items-center gap-8">
          {["Home", "Movies", "Cinemas", "Events", "Offers"].map((item) => (
            <a
              key={item}
              href="#"
              className="text-white/70 hover:text-white transition-colors duration-200"
              style={{ fontSize: "0.875rem", letterSpacing: "0.05em" }}
            >
              {item}
            </a>
          ))}
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 cursor-pointer group">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: "rgba(59,130,246,0.15)", border: `1px solid ${ACCENT}` }}
                >
                  <span style={{ color: ACCENT, fontWeight: 700, fontSize: "0.85rem" }}>
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-white/80 text-sm font-medium">{username}</span>
              </div>

              <button
                onClick={handleLogout}
                className="text-white/50 hover:text-[#3b82f6] transition-colors p-1"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
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

          {["Home", "Movies", "Cinemas", "Events", "Offers"].map((item) => (
            <a key={item} href="#" className="text-white/70 hover:text-white text-sm py-1">
              {item}
            </a>
          ))}

          {!isLogged && (
            <Link
              to="/login"
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
    </nav>
  );
}
