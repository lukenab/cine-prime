import axiosClient from "./api";

export interface AdminAnalyticsSummary {
  confirmedBookings: number;
  ticketsSold: number;
  ticketRevenue: number;
  concessionRevenue: number;
  grossRevenue: number;
  refundCount: number;
  refundAmount: number;
  netRevenue: number;
  averageOrderValue: number;
  refundRate: number;
  currency: string;
  dataThrough: string | null;
  dataFreshnessSeconds: number | null;
  dataFreshnessStatus: "FRESH" | "STALE" | "NO_DATA";
  previousPeriod: AdminAnalyticsComparison | null;
}

export interface AdminAnalyticsComparison {
  from: string;
  to: string;
  confirmedBookingsDelta: number;
  confirmedBookingsChangePercent: number | null;
  ticketsSoldDelta: number;
  ticketsSoldChangePercent: number | null;
  grossRevenueDelta: number;
  grossRevenueChangePercent: number | null;
  averageOrderValueDelta: number;
  averageOrderValueChangePercent: number | null;
  refundRateDelta: number;
  refundRateChangePercent: number | null;
  netRevenueDelta: number;
  netRevenueChangePercent: number | null;
}

export interface AdminAnalyticsBranchRanking {
  rank: number;
  clusterId: number;
  confirmedBookings: number;
  ticketsSold: number;
  grossRevenue: number;
  netRevenue: number;
  averageOrderValue: number;
  refundRate: number;
}

export interface AdminAnalyticsDailyPoint {
  date: string;
  confirmedBookings: number;
  ticketsSold: number;
  ticketRevenue: number;
  concessionRevenue: number;
  grossRevenue: number;
  refundCount: number;
  refundAmount: number;
  netRevenue: number;
}

const unwrap = <T>(response: unknown): T => {
  const body = response as { result?: T } | T;
  return (body && typeof body === "object" && "result" in body && body.result ? body.result : body) as T;
};

export const analyticsApi = {
  getAdminSummary: async (params: { clusterId?: number; from: string; to: string }): Promise<AdminAnalyticsSummary> => {
    const response = await axiosClient.get("/api/analytics/admin/summary", { params });
    return unwrap<AdminAnalyticsSummary>(response);
  },
  getAdminDaily: async (params: { clusterId?: number; from: string; to: string }): Promise<AdminAnalyticsDailyPoint[]> => {
    const response = await axiosClient.get("/api/analytics/admin/daily", { params });
    return unwrap<AdminAnalyticsDailyPoint[]>(response);
  },
  getAdminBranchRanking: async (params: { from: string; to: string }): Promise<AdminAnalyticsBranchRanking[]> => {
    const response = await axiosClient.get("/api/analytics/admin/branch-ranking", { params });
    return unwrap<AdminAnalyticsBranchRanking[]>(response);
  },
};
