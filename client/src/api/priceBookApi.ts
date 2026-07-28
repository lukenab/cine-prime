import axiosClient from "./api";

export type PriceBookStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type PriceRateDayType = "ALL_DAYS" | "WEEKDAY" | "WEEKEND";

export type PriceRate = {
  priceRateId?: number;
  name: string;
  dayType: PriceRateDayType;
  startTime: string;
  endTime: string;
  formatId?: number | null;
  formatCode?: string | null;
  standardPrice: number;
  vipMultiplier: number;
  coupleMultiplier: number;
  accessibleMultiplier: number;
  priority: number;
  active: boolean;
};

export type PriceBook = {
  priceBookId: number;
  clusterId: number;
  clusterName: string;
  code: string;
  name: string;
  currencyCode: string;
  validFrom: string;
  validTo?: string | null;
  priority: number;
  status: PriceBookStatus;
  rates: PriceRate[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PriceBookPayload = Omit<
  PriceBook,
  "priceBookId" | "clusterName" | "status" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;

type ApiWrapper<T> = {
  code: number;
  message?: string;
  result: T;
};

export const priceBookApi = {
  list: () =>
    axiosClient.get("/api/price-books") as Promise<ApiWrapper<PriceBook[]>>,
  get: (priceBookId: number) =>
    axiosClient.get(`/api/price-books/${priceBookId}`) as Promise<ApiWrapper<PriceBook>>,
  create: (payload: PriceBookPayload) =>
    axiosClient.post("/api/price-books", payload) as Promise<ApiWrapper<PriceBook>>,
  update: (priceBookId: number, payload: PriceBookPayload) =>
    axiosClient.put(`/api/price-books/${priceBookId}`, payload) as Promise<ApiWrapper<PriceBook>>,
  activate: (priceBookId: number) =>
    axiosClient.post(`/api/price-books/${priceBookId}/activate`) as Promise<ApiWrapper<PriceBook>>,
  archive: (priceBookId: number) =>
    axiosClient.post(`/api/price-books/${priceBookId}/archive`) as Promise<ApiWrapper<PriceBook>>,
};
