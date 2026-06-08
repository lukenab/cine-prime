import { useState } from "react";
import { Film, Ticket, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";


export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

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

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-white/60 hover:text-white text-sm transition-colors">
             Sign In
          </Link>
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
        <div style={{ backgroundColor: "#050505" }} className="md:hidden px-6 pb-4 flex flex-col gap-4">
          {["Home", "Movies", "Cinemas", "Events", "Offers"].map((item) => (
            <a key={item} href="#" className="text-white/70 hover:text-white text-sm py-1">
              {item}
            </a>
          ))}
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-full w-fit mt-2"
            style={{ backgroundColor: "#FFD700", color: "#050505", fontWeight: 700, fontSize: "0.85rem" }}
          >
            <Ticket size={14} />
            Book Now
          </button>
        </div>
      )}
    </nav>
  );
}
