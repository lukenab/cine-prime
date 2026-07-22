import { useNavigate } from "react-router-dom";
import { Tag, Calendar, ArrowRight } from "lucide-react";
import { mockOffers } from "../../data/mockOffers";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function OffersTeaser() {
  const navigate = useNavigate();
  const offers = mockOffers.slice(0, 3);

  return (
    <section
      style={{ backgroundColor: "#050505", paddingTop: "80px", paddingBottom: "80px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              Deals & Promotions
            </span>
            <h2 style={{ color: "white", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", marginTop: "10px", lineHeight: 1.15 }}>
              Current{" "}
              <span
                style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                Offers
              </span>
            </h2>
          </div>
          <button
            onClick={() => navigate("/offers")}
            className="group flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={{ color: "#FFD700", background: "none", border: "none" }}
          >
            View all offers
            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <div
              key={offer.offerId}
              onClick={() => navigate("/offers")}
              className="group relative cursor-pointer overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = `${offer.accentColor}40`;
                el.style.boxShadow = "0 20px 50px rgba(0,0,0,0.5)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "rgba(255,255,255,0.07)";
                el.style.boxShadow = "none";
              }}
            >
              <div
                className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ backgroundColor: `${offer.accentColor}18`, border: `1px solid ${offer.accentColor}45` }}
              >
                <Tag size={12} style={{ color: offer.accentColor }} />
                <span style={{ color: offer.accentColor, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.05em" }}>
                  {offer.discount}
                </span>
              </div>

              <h3 className="text-base font-bold text-white">{offer.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55 line-clamp-2">{offer.description}</p>

              <div className="mt-4 flex items-center gap-1.5 text-[12px] text-white/40">
                <Calendar size={12} /> Valid until {formatDate(offer.validUntil)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
