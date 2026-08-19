import axiosClient from "./api";
import type { AdminPage } from "./paymentApi";

export interface AuditEvent {
  auditId: string;
  actorAccountId?: string;
  targetAccountId?: string;
  action: string;
  status: string;
  message?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: string;
  createdAt: string;
}

const unwrap = <T,>(value: T | { result: T }): T =>
  value && typeof value === "object" && "result" in value ? (value as { result: T }).result : value as T;

export const auditApi = {
  search: async (params: Record<string, string | number | undefined>): Promise<AdminPage<AuditEvent>> =>
    unwrap(await axiosClient.get("/api/audit-events", { params })),
  exportCsv: (params: Record<string, string | undefined>) =>
    axiosClient.get("/api/audit-events/export", { params, responseType: "blob" }),
};
