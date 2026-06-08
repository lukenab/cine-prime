import { Film } from "lucide-react";
import { FaTwitter, FaInstagram, FaYoutube, FaFacebook } from "react-icons/fa";

export function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "#030303",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div
            className="md:col-span-1"
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div className="flex items-center gap-2">
              <Film size={20} style={{ color: "#FFD700" }} />
              <span
                style={{
                  color: "#FFD700",
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                CinePrime
              </span>
            </div>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "0.82rem",
                lineHeight: 1.7,
              }}
            >
              The ultimate premium cinema experience. Book tickets, discover
              films, and lose yourself in the magic of movies.
            </p>
            <div className="flex gap-3">
              {/* Đã gỡ bỏ Facebook ra khỏi mảng này để tránh lỗi */}
              {[FaTwitter, FaInstagram, FaYoutube, FaFacebook].map(
                (Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110"
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    <Icon size={14} />
                  </a>
                ),
              )}
            </div>
          </div>

          {/* Links */}
          {[
            {
              title: "Explore",
              links: [
                "Now Showing",
                "Coming Soon",
                "Top Rated",
                "Genres",
                "New Releases",
              ],
            },
            {
              title: "Cinemas",
              links: [
                "Find a Cinema",
                "Premium Screens",
                "IMAX",
                "Dolby Atmos",
                "Drive-In",
              ],
            },
            {
              title: "Account",
              links: [
                "Sign In",
                "My Bookings",
                "Loyalty Points",
                "Gift Cards",
                "Help Center",
              ],
            },
          ].map(({ title, links }) => (
            <div
              key={title}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <h4
                style={{
                  color: "white",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {title}
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="transition-colors duration-200 hover:text-white"
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "0.82rem",
                    }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" }}>
            © 2026 CineVault. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service", "Cookie Settings"].map(
              (item) => (
                <a
                  key={item}
                  href="#"
                  className="transition-colors duration-200 hover:text-white"
                  style={{
                    color: "rgba(255,255,255,0.25)",
                    fontSize: "0.75rem",
                  }}
                >
                  {item}
                </a>
              ),
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
