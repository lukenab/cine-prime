import { useState } from "react";
import { Film, Ticket, Menu, X, User, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const token = localStorage.getItem("accessToken");
  const isLogged = !!token;
  const username = user?.username || "User";

  const handleLogout = () => {
    logout();
  };

  return (
    <nav
      style={{ backgroundColor: "rgba(5,5,5,0.85)", backdropFilter: "blur(12px)" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Film size={22} style={{ color: "#FFD700" }} />
          <span
            className="tracking-widest uppercase"
            style={{ color: "#FFD700", fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.2em" }}
          >
            CinePrime
          </span>
        </div>

        {/* Desktop nav */}
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

        {/* CTA & User Profile */}
        <div className="hidden md:flex items-center gap-4">
          {isLogged ? (
            // UI khi ĐÃ ĐĂNG NHẬP
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 cursor-pointer group">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: "rgba(255,215,0,0.15)", border: "1px solid #FFD700" }}
                >
                  {/* Lấy chữ cái đầu tiên của username làm Avatar */}
                  <span style={{ color: "#FFD700", fontWeight: 700, fontSize: "0.85rem" }}>
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-white/80 text-sm font-medium">{username}</span>
              </div>
              
              <button 
                onClick={handleLogout}
                className="text-white/50 hover:text-[#FFD700] transition-colors p-1"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            // UI khi CHƯA ĐĂNG NHẬP
            <Link to="/login" className="text-white/60 hover:text-white text-sm transition-colors mr-2">
              Sign In
            </Link>
          )}

          <button
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 hover:brightness-110"
            style={{ backgroundColor: "#FFD700", color: "#050505", fontSize: "0.85rem", fontWeight: 700 }}
          >
            <Ticket size={14} />
            Book Now
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ backgroundColor: "#050505" }} className="md:hidden px-6 pb-4 flex flex-col gap-4 border-t border-white/10 pt-4">
          
          {/* Thông tin user trên Mobile */}
          {isLogged && (
             <div className="flex items-center justify-between mb-2 pb-4 border-b border-white/10">
               <div className="flex items-center gap-3">
                 <div 
                   className="w-10 h-10 rounded-full flex items-center justify-center"
                   style={{ backgroundColor: "rgba(255,215,0,0.15)", border: "1px solid #FFD700" }}
                 >
                   <span style={{ color: "#FFD700", fontWeight: 700 }}>
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

          {["Home", "Movies", "Cinemas", "Events", "Offers"].map((item) => (
            <a key={item} href="#" className="text-white/70 hover:text-white text-sm py-1">
              {item}
            </a>
          ))}
          
          {!isLogged && (
            <Link to="/login" className="text-white/70 hover:text-white text-sm py-1 font-bold">
              Sign In
            </Link>
          )}

          <button
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-full w-full mt-2"
            style={{ backgroundColor: "#FFD700", color: "#050505", fontWeight: 700, fontSize: "0.9rem" }}
          >
            <Ticket size={16} />
            Book Now
          </button>
        </div>
      )}
    </nav>
  );
}
