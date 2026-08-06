import axiosClient from "./api";

export type PromotionStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type PromotionDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type PromotionTargetType = "MOVIE" | "SHOWTIME";
export type PromotionBenefitScope = "TICKETS" | "CONCESSIONS" | "ORDER";

export interface PromotionPriceRule {
  discountType: PromotionDiscountType;
  percentage?: number | null;
  fixedAmount?: number | null;
  maxDiscountAmount?: number | null;
  minimumOrderAmount: number;
  currency: string;
}

export interface PromotionTarget {
  targetType: PromotionTargetType;
  movieId?: number | null;
  showtimeId?: number | null;
}

export interface PromotionAuditEntry {
  action: string;
  actorAccountId?: string | null;
  occurredAt: string;
}

export interface Promotion {
  promotionId: string;
  code: string;
  name: string;
  description?: string;
  status: PromotionStatus;
  benefitScope: PromotionBenefitScope;
  validFrom?: string | null;
  validUntil?: string | null;
  globalUsageLimit?: number | null;
  perAccountUsageLimit?: number | null;
  version: number;
  activeReservationCount: number;
  committedUsageCount: number;
  priceRule: PromotionPriceRule;
  targets: PromotionTarget[];
  auditLog: PromotionAuditEntry[];
}

export interface PromotionUpsertPayload {
  code: string;
  name: string;
  description?: string;
  benefitScope: PromotionBenefitScope;
  validFrom?: string | null;
  validUntil?: string | null;
  globalUsageLimit?: number | null;
  perAccountUsageLimit?: number | null;
  priceRule: PromotionPriceRule;
  targets: PromotionTarget[];
}

export interface PromotionPage {
  content: Promotion[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface PublicPromotionOffer {
  promotionId: string;
  code: string;
  name: string;
  description?: string;
  benefitScope: PromotionBenefitScope;
  validFrom?: string | null;
  validUntil?: string | null;
  discountType: PromotionDiscountType;
  percentage?: number | null;
  fixedAmount?: number | null;
  maxDiscountAmount?: number | null;
  minimumOrderAmount: number;
  currency: string;
}

const resultOf = <T>(response: any): T => (response?.result ?? response) as T;

export const promotionApi = {
  listPublicOffers: async (): Promise<PublicPromotionOffer[]> =>
    resultOf<PublicPromotionOffer[]>(await axiosClient.get("/api/public/promotions")) ?? [],
  list: async (status?: PromotionStatus): Promise<Promotion[]> => {
    const response = await axiosClient.get("/api/promotions", {
      params: { status: status || undefined, page: 0, size: 100 },
    });
    return resultOf<PromotionPage>(response).content ?? [];
  },
  get: async (id: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.get(`/api/promotions/${id}`)),
  create: async (payload: PromotionUpsertPayload): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post("/api/promotions", payload)),
  update: async (id: string, payload: PromotionUpsertPayload): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.put(`/api/promotions/${id}`, payload)),
  activate: async (id: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/activate`)),
  pause: async (id: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/pause`)),
  retire: async (id: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/retire`)),
};
