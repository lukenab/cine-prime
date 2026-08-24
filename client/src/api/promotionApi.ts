import axiosClient from "./api";

export type PromotionStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type PromotionAvailabilityStatus = "NOT_AVAILABLE" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED" | "QUOTA_EXHAUSTED" | "ARCHIVED";
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
  auditLogId?: string | null;
  action: string;
  actorAccountId?: string | null;
  occurredAt: string;
  detail?: Record<string, unknown> | null;
}

export interface PromotionWorkflow {
  createdByAccountId?: string | null;
  submittedByAccountId?: string | null;
  submittedAt?: string | null;
  approvedByAccountId?: string | null;
  approvedAt?: string | null;
}

export interface Promotion {
  promotionId: string;
  code: string;
  name: string;
  description?: string;
  status: PromotionStatus;
  availabilityStatus: PromotionAvailabilityStatus;
  benefitScope: PromotionBenefitScope;
  validFrom?: string | null;
  validUntil?: string | null;
  globalUsageLimit?: number | null;
  perAccountUsageLimit?: number | null;
  version: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  activeReservationCount: number;
  committedUsageCount: number;
  priceRule: PromotionPriceRule;
  targets: PromotionTarget[];
  workflow: PromotionWorkflow;
  auditLog: PromotionAuditEntry[];
}

export interface PromotionSummary {
  promotionId: string;
  code: string;
  name: string;
  status: PromotionStatus;
  availabilityStatus: PromotionAvailabilityStatus;
  benefitScope: PromotionBenefitScope;
  validFrom?: string | null;
  validUntil?: string | null;
  activeReservationCount: number;
  committedUsageCount: number;
  globalUsageLimit?: number | null;
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
    draft: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    active: number;
    paused: number;
    archived: number;
    approvedOrScheduled: number;
    activeNow: number;
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
  submit: async (id: string, comment?: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/submit`, { comment: comment?.trim() || null })),
  approve: async (id: string, comment?: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/approve`, { comment: comment?.trim() || null })),
  reject: async (id: string, reason: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/reject`, { reason: reason.trim() })),
  activate: async (id: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/activate`)),
  pause: async (id: string, reason: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/pause`, { reason: reason.trim() })),
  archive: async (id: string, reason: string): Promise<Promotion> =>
    resultOf<Promotion>(await axiosClient.post(`/api/promotions/${id}/archive`, { reason: reason.trim() })),
};
