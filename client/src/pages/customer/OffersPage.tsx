import { useState } from "react";
import { Tag, Calendar, Copy, Check, Ticket, LoaderCircle } from "lucide-react";
import { usePublicPromotionOffers } from "../../hooks/usePublicPromotionOffers";
import { offerAccent, offerDiscountLabel, offerScopeLabel, offerValidityLabel } from "../../utils/promotionOfferUi";

export default function OffersPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { offers, loading, error } = usePublicPromotionOffers();

  const handleCopy = (offerId: string, code: string) => {
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
            <Ticket size={20} style={{ color: "#38bdf8" }} />
            <span style={{ color: "#38bdf8", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              Deals & Promotions
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Offers</h1>
          <p className="mt-1.5 text-sm text-white/45">Save on tickets and combos with these current promotions</p>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {loading && (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-white/50">
            <LoaderCircle size={18} className="mr-2 animate-spin text-blue-400" /> Loading current offers...
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-6 py-10 text-center text-sm text-red-200">
            Current offers could not be loaded. Please try again shortly.
          </div>
        )}
        {!loading && !error && offers.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-white/50">
            No public promotion is active right now.
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {!loading && !error && offers.map((offer) => {
            const copied = copiedId === offer.promotionId;
            const accentColor = offerAccent(offer);
            return (
              <div
                key={offer.promotionId}
                className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = `${accentColor}40`;
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
                  style={{ backgroundColor: `${accentColor}18`, border: `1px solid ${accentColor}45` }}
                >
                  <Tag size={12} style={{ color: accentColor }} />
                  <span style={{ color: accentColor, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.05em" }}>
                    {offerDiscountLabel(offer)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-white">{offer.name}</h3>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-white/55">{offerScopeLabel(offer)}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{offer.description}</p>

                <div className="mt-4 flex items-center gap-1.5 text-[12px] text-white/40">
                  <Calendar size={12} /> {offerValidityLabel(offer.validUntil)}
                </div>

                {/* Promo code */}
                <button
                  onClick={() => handleCopy(offer.promotionId, offer.code)}
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
