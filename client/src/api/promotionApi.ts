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

export interface PromotionSummary {
  promotionId: string;
  code: string;
  name: string;
  status: PromotionStatus;
  benefitScope: PromotionBenefitScope;
  validFrom?: string | null;
  validUntil?: string | null;
  priceRule: Pick<PromotionPriceRule, "discountType" | "percentage" | "fixedAmount" | "minimumOrderAmount" | "currency">;
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
  content: PromotionSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  counts: {
    total: number;
    active: number;
    draft: number;
    paused: number;
    archived: number;
  };
}

export interface PromotionListParams {
  status?: PromotionStatus;
  query?: string;
  page?: number;
  size?: number;
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

const promotionListRequests = new Map<string, Promise<PromotionPage>>();

async function listPromotions(params: PromotionListParams = {}): Promise<PromotionPage> {
  const requestParams = {
    status: params.status || undefined,
    query: params.query?.trim() || undefined,
    page: params.page ?? 0,
    size: params.size ?? 20,
  };
  const requestKey = JSON.stringify(requestParams);
  const existingRequest = promotionListRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = axiosClient
    .get("/api/promotions", { params: requestParams })
    .then((response) => resultOf<PromotionPage>(response))
    .finally(() => promotionListRequests.delete(requestKey));
  promotionListRequests.set(requestKey, request);
  return request;
}

export const promotionApi = {
  listPublicOffers: async (): Promise<PublicPromotionOffer[]> =>
    resultOf<PublicPromotionOffer[]>(await axiosClient.get("/api/public/promotions")) ?? [],
  list: listPromotions,
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
