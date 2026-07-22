import { Star, Quote } from "lucide-react";
import { mockTestimonials } from "../../data/mockTestimonials";

export function Testimonials() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)",
        paddingTop: "80px",
        paddingBottom: "80px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
            Loved By Movie Fans
          </span>
          <h2 style={{ color: "white", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.5rem)", marginTop: "12px", lineHeight: 1.2 }}>
            What Our{" "}
            <span
              style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              Guests Say
            </span>
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mockTestimonials.slice(0, 6).map((t) => (
            <div
              key={t.id}
              className="group relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "rgba(255,215,0,0.25)";
                el.style.boxShadow = "0 20px 50px rgba(0,0,0,0.5)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "rgba(255,255,255,0.07)";
                el.style.boxShadow = "none";
              }}
            >
              <Quote size={26} style={{ color: "rgba(255,215,0,0.25)" }} className="mb-3" />

              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    fill={i < t.rating ? "#FFD700" : "none"}
                    style={{ color: i < t.rating ? "#FFD700" : "rgba(255,255,255,0.2)" }}
                  />
                ))}
              </div>

              <p className="flex-1 text-[13.5px] leading-relaxed text-white/70">"{t.quote}"</p>

              <div className="mt-5 flex items-center gap-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="h-9 w-9 rounded-full object-cover"
                  style={{ border: "1px solid rgba(255,215,0,0.3)" }}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{t.name}</p>
                  <p className="text-[11px] text-white/40 truncate">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
