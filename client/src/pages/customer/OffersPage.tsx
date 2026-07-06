import { useState } from "react";
import { Tag, Calendar, Copy, Check, Ticket } from "lucide-react";
import { mockOffers } from "../../data/mockOffers";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OffersPage() {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = (offerId: number, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedId(offerId);
    setTimeout(() => setCopiedId((id) => (id === offerId ? null : id)), 1800);
  };

  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: "#050505" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 pb-8 pt-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-1 flex items-center gap-2.5">
            <Ticket size={20} style={{ color: "#FFD700" }} />
            <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              Deals & Promotions
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Offers</h1>
          <p className="mt-1.5 text-sm text-white/45">Save on tickets and combos with these current promotions</p>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mockOffers.map((offer) => {
            const copied = copiedId === offer.offerId;
            return (
              <div
                key={offer.offerId}
                className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
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
                {/* Discount badge */}
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
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{offer.description}</p>

                <div className="mt-4 flex items-center gap-1.5 text-[12px] text-white/40">
                  <Calendar size={12} /> Valid until {formatDate(offer.validUntil)}
                </div>

                {/* Promo code */}
                <button
                  onClick={() => handleCopy(offer.offerId, offer.code)}
                  className="mt-4 flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 transition-all duration-200 cursor-pointer"
                  style={{ border: "1px dashed rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.03)" }}
                >
                  <span className="font-mono text-[13px] font-semibold tracking-wider text-white/85">{offer.code}</span>
                  {copied ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#34d399" }}>
                      <Check size={13} /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-white/45">
                      <Copy size={13} /> Copy code
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
