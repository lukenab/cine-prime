import axiosClient from "./api";

export type ConcessionAvailability = "AVAILABLE" | "LOW_AVAILABILITY" | "SOLD_OUT";

export interface ComboComponent {
  groupCode: string;
  allowedSkuId: number;
  skuCode: string;
  label: string;
  quantity: number;
  minSelect: number;
  maxSelect: number;
  availableCount?: number | null;
}

export interface CatalogConcession {
  sellableType: "SKU" | "COMBO";
  sellableId: number;
  code: string;
  name: string;
  category: "COMBOS" | "POPCORN" | "DRINKS" | "SNACKS" | string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency: string;
  availability: ConcessionAvailability;
  size?: string;
  flavor?: string;
  components: ComboComponent[];
}

export interface ReservationSelection {
  groupCode: string;
  skuIds: number[];
}

export interface ConcessionCartItem {
  sellableType: "SKU" | "COMBO";
  sellableId: number;
  quantity: number;
  selections?: ReservationSelection[];
}

export interface ConcessionOrderItem {
  itemCode: string;
  itemName: string;
  options?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  finalAmount: number;
}

export interface ConcessionOrder {
  orderId: string;
  bookingId: string;
  paymentId?: string;
  cinemaClusterId: number;
  pickupCode: string;
  status: "PAID" | "PREPARING" | "READY" | "COLLECTED";
  paidAt: string;
  readyAt?: string;
  collectedAt?: string;
  total: number;
  currency: string;
  items: ConcessionOrderItem[];
}

export interface ConcessionProduct {
  id: number;
  code: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  active: boolean;
  status?: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "ARCHIVED";
  createdBy?: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface ConcessionSku {
  id: number;
  productId: number;
  productName: string;
  skuCode: string;
  size?: string;
  flavor?: string;
  attributes: Record<string, unknown>;
  active: boolean;
}

export interface ConcessionCombo {
  id: number;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  active: boolean;
  components: ComboComponent[];
}

export interface ClusterOffer {
  id: number;
  cinemaClusterId: number;
  sellableType: "SKU" | "COMBO";
  sellableId: number;
  price: number;
  currency: string;
  available: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface OfferAudit {
  id: number;
  cinemaClusterId: number;
  sellableType: "SKU" | "COMBO";
  sellableId: number;
  sellableCode?: string;
  sellableName?: string;
  operation: "CREATE" | "UPDATE" | "BULK_UPDATE" | "COPY";
  oldPrice?: number;
  newPrice: number;
  currency: string;
  oldAvailable?: boolean;
  newAvailable: boolean;
  oldEffectiveFrom?: string;
  newEffectiveFrom?: string;
  oldEffectiveTo?: string;
  newEffectiveTo?: string;
  sourceClusterId?: number;
  changedBy: string;
  changedAt: string;
}

export interface OfferMutation {
  sellableType: "SKU" | "COMBO";
  sellableId: number;
  price: number;
  currency: string;
  available: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface MediaUpload {
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface ClusterInventory {
  cinemaClusterId: number;
  skuId: number;
  skuCode: string;
  onHand: number;
  reserved: number;
  version: number;
}

const unwrap = <T>(value: T | { result?: T }): T =>
  value && typeof value === "object" && "result" in value && (value as { result?: T }).result
    ? (value as { result: T }).result
    : value as T;

export const concessionApi = {
  getCatalog: async (clusterId: number, showtimeId?: number): Promise<CatalogConcession[]> => {
    const response = await axiosClient.get<unknown, CatalogConcession[] | { result: CatalogConcession[] }>(
      `/api/public/cinemas/${clusterId}/concessions`,
      { params: showtimeId ? { showtimeId } : undefined },
    );
    return unwrap(response);
  },

  getOrders: async (clusterId: number, status?: string): Promise<ConcessionOrder[]> => {
    const response = await axiosClient.get<unknown, ConcessionOrder[] | { result: ConcessionOrder[] }>(
      "/api/employee/concession-orders",
      {
        params: { clusterId, status: status || undefined },
        headers: { "X-Cinema-Cluster-Id": clusterId },
      },
    );
    return unwrap(response);
  },

  transitionOrder: async (
    orderId: string,
    action: "prepare" | "ready" | "collect",
    clusterId: number,
  ): Promise<ConcessionOrder> => {
    const response = await axiosClient.post<unknown, ConcessionOrder | { result: ConcessionOrder }>(
      `/api/employee/concession-orders/${encodeURIComponent(orderId)}/${action}`,
      undefined,
      { headers: { "X-Cinema-Cluster-Id": clusterId } },
    );
    return unwrap(response);
  },

  admin: {
    getProducts: async (): Promise<ConcessionProduct[]> =>
      unwrap(await axiosClient.get("/api/admin/concession-products")),
    saveProduct: async (payload: Omit<ConcessionProduct, "id">, id?: number): Promise<ConcessionProduct> =>
      unwrap(id
        ? await axiosClient.put(`/api/admin/concession-products/${id}`, payload)
        : await axiosClient.post("/api/admin/concession-products", payload)),
    submitProduct: async (id: number): Promise<ConcessionProduct> =>
      unwrap(await axiosClient.post(`/api/admin/concession-products/${id}/submit`)),
    approveProduct: async (id: number): Promise<ConcessionProduct> =>
      unwrap(await axiosClient.post(`/api/admin/concession-products/${id}/approve`)),
    rejectProduct: async (id: number, reason: string): Promise<ConcessionProduct> =>
      unwrap(await axiosClient.post(`/api/admin/concession-products/${id}/reject`, { reason })),
    deleteProduct: (id: number) => axiosClient.delete(`/api/admin/concession-products/${id}`),

    getSkus: async (): Promise<ConcessionSku[]> =>
      unwrap(await axiosClient.get("/api/admin/concession-skus")),
    saveSku: async (
      payload: { productId: number; skuCode: string; size?: string; flavor?: string; attributes: Record<string, unknown>; active: boolean },
      id?: number,
    ): Promise<ConcessionSku> =>
      unwrap(id
        ? await axiosClient.put(`/api/admin/concession-skus/${id}`, payload)
        : await axiosClient.post("/api/admin/concession-skus", payload)),
    deleteSku: (id: number) => axiosClient.delete(`/api/admin/concession-skus/${id}`),

    getCombos: async (): Promise<ConcessionCombo[]> =>
      unwrap(await axiosClient.get("/api/admin/concession-combos")),
    saveCombo: async (
      payload: {
        code: string;
        name: string;
        description?: string;
        imageUrl?: string;
        active: boolean;
        components: Array<{ groupCode: string; allowedSkuId: number; quantity: number; minSelect: number; maxSelect: number }>;
      },
      id?: number,
    ): Promise<ConcessionCombo> =>
      unwrap(id
        ? await axiosClient.put(`/api/admin/concession-combos/${id}`, payload)
        : await axiosClient.post("/api/admin/concession-combos", payload)),
    deleteCombo: (id: number) => axiosClient.delete(`/api/admin/concession-combos/${id}`),

    getOffers: async (clusterId: number): Promise<ClusterOffer[]> =>
      unwrap(await axiosClient.get(`/api/admin/cinemas/${clusterId}/concession-offers`)),
    saveOffer: async (
      clusterId: number,
      type: string,
      sellableId: number,
      payload: {
        price: number;
        currency: string;
        available: boolean;
        effectiveFrom?: string;
        effectiveTo?: string;
      },
    ): Promise<ClusterOffer> =>
      unwrap(await axiosClient.put(
        `/api/admin/cinemas/${clusterId}/concession-offers/${type}/${sellableId}`,
        payload,
      )),
    bulkSaveOffers: async (clusterId: number, offers: OfferMutation[]): Promise<ClusterOffer[]> =>
      unwrap(await axiosClient.put(
        `/api/admin/cinemas/${clusterId}/concession-offers/bulk`,
        { offers },
      )),
    copyOffers: async (
      clusterId: number,
      sourceClusterId: number,
      overwriteExisting: boolean,
    ): Promise<ClusterOffer[]> =>
      unwrap(await axiosClient.post(
        `/api/admin/cinemas/${clusterId}/concession-offers/copy`,
        { sourceClusterId, overwriteExisting },
      )),
    getOfferAudit: async (clusterId: number, limit = 100): Promise<OfferAudit[]> =>
      unwrap(await axiosClient.get(
        `/api/admin/cinemas/${clusterId}/concession-offers/audit`,
        { params: { limit } },
      )),
    uploadImage: async (file: File): Promise<MediaUpload> => {
      const data = new FormData();
      data.append("file", file);
      return unwrap(await axiosClient.post(
        "/api/admin/concession-media/images",
        data,
        { headers: { "Content-Type": undefined } },
      ));
    },
    getInventory: async (clusterId: number): Promise<ClusterInventory[]> =>
      unwrap(await axiosClient.get(`/api/admin/cinemas/${clusterId}/concession-inventory`)),
    saveInventory: async (clusterId: number, skuId: number, onHand: number): Promise<ClusterInventory> =>
      unwrap(await axiosClient.put(
        `/api/admin/cinemas/${clusterId}/concession-inventory/${skuId}`,
        { onHand },
      )),
  },
};
