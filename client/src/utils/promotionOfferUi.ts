import type { PublicPromotionOffer } from "../api/promotionApi";

const ACCENTS = {
  TICKETS: "#38bdf8",
  CONCESSIONS: "#a78bfa",
  ORDER: "#34d399",
} as const;

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function offerAccent(offer: PublicPromotionOffer) {
  return ACCENTS[offer.benefitScope];
}

export function offerDiscountLabel(offer: PublicPromotionOffer) {
  if (offer.discountType === "PERCENTAGE") return `${Number(offer.percentage ?? 0)}% OFF`;
  return `${formatAmount(Number(offer.fixedAmount ?? 0), offer.currency)} OFF`;
}

export function offerScopeLabel(offer: PublicPromotionOffer) {
  if (offer.benefitScope === "TICKETS") return "Movie tickets";
  if (offer.benefitScope === "CONCESSIONS") return "Food & drinks";
  return "Tickets & food";
}

export function offerValidityLabel(validUntil?: string | null) {
  if (!validUntil) return "No fixed end date";
  const date = new Date(validUntil);
  return Number.isNaN(date.getTime())
    ? "Valid while available"
    : `Valid until ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}
