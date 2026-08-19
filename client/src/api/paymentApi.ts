import axiosClient from "./api";

export type PaymentAttemptStatus =
  | "INITIATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED";

export interface PaymentSession {
  paymentId: string;
  bookingId: string;
  provider: "VNPAY" | string;
  status: PaymentAttemptStatus;
  paymentUrl?: string;
  amount: number;
  currency: string;
  expiresAt: string;
  failureMessage?: string;
  bankCode?: string;
  cardType?: string;
}

export type RefundStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "MANUAL_REVIEW";
export type ReconciliationStatus = "OPEN" | "RETRYING" | "RESOLVED" | "MANUAL_REVIEW";

export interface AdminRefund {
  refundId: string;
  paymentId?: string;
  bookingId: string;
  paymentReference?: string;
  providerRefundReference?: string;
  status: RefundStatus | string;
  amount: number;
  currency: string;
  reasonCode?: string;
  reason?: string;
  failureCode?: string;
  failureMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  replayed?: boolean;
}

export interface ReconciliationCase {
  caseId: number;
  paymentId: string;
  bookingId: string;
  caseType: string;
  severity: string;
  status: ReconciliationStatus | string;
  details: string;
  attemptCount: number;
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export type RefundApprovalStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXECUTED";
export interface RefundApproval {
  requestId: string;
  refundId: string;
  bookingId: string;
  status: RefundApprovalStatus;
  requestedBy: string;
  reviewedBy?: string;
  executedBy?: string;
  requestNote?: string;
  decisionNote?: string;
  submittedAt?: string;
  reviewedAt?: string;
  executedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const unwrap = <T>(response: T | { result?: T }): T => {
  if (
    response &&
    typeof response === "object" &&
    "result" in response &&
    (response as { result?: T }).result
  ) {
    return (response as { result: T }).result;
  }
  return response as T;
};

export const paymentApi = {
  createSession: async (
    bookingId: string,
    idempotencyKey: string,
  ): Promise<PaymentSession> => {
    const response = await axiosClient.post<
      unknown,
      PaymentSession | { result: PaymentSession }
    >(
      "/api/payments/sessions",
      { bookingId },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return unwrap(response);
  },

  getByBooking: async (bookingId: string): Promise<PaymentSession> => {
    const response = await axiosClient.get<
      unknown,
      PaymentSession | { result: PaymentSession }
    >(`/api/payments/by-booking/${encodeURIComponent(bookingId)}`);
    return unwrap(response);
  },

  getAdminRefunds: async (params: {
    status?: string;
    bookingId?: string;
    page?: number;
    size?: number;
  } = {}): Promise<AdminPage<AdminRefund>> => {
    const response = await axiosClient.get<unknown, AdminPage<AdminRefund> | { result: AdminPage<AdminRefund> }>(
      "/api/payments/admin/refunds", { params },
    );
    return unwrap(response);
  },

  getAdminRefund: async (refundId: string): Promise<AdminRefund> => {
    const response = await axiosClient.get<unknown, AdminRefund | { result: AdminRefund }>(
      `/api/payments/admin/refunds/${encodeURIComponent(refundId)}`,
    );
    return unwrap(response);
  },

  retryAdminRefund: async (refundId: string): Promise<AdminRefund> => {
    const response = await axiosClient.post<unknown, AdminRefund | { result: AdminRefund }>(
      `/api/payments/admin/refunds/${encodeURIComponent(refundId)}/retry`,
    );
    return unwrap(response);
  },

  getRefundApprovals: async (params: { status?: string; page?: number; size?: number } = {}): Promise<AdminPage<RefundApproval>> => {
    const response = await axiosClient.get<unknown, AdminPage<RefundApproval> | { result: AdminPage<RefundApproval> }>(
      "/api/payments/admin/refund-approval-requests", { params },
    );
    return unwrap(response);
  },
  createRefundApprovalDraft: async (refundId: string, note?: string): Promise<RefundApproval> => unwrap(
    await axiosClient.post(`/api/payments/admin/refunds/${encodeURIComponent(refundId)}/approval-requests`, { note }),
  ),
  submitRefundApproval: async (requestId: string): Promise<RefundApproval> => unwrap(
    await axiosClient.post(`/api/payments/admin/refund-approval-requests/${encodeURIComponent(requestId)}/submit`),
  ),
  approveRefundApproval: async (requestId: string, note?: string): Promise<RefundApproval> => unwrap(
    await axiosClient.post(`/api/payments/admin/refund-approval-requests/${encodeURIComponent(requestId)}/approve`, { note }),
  ),
  rejectRefundApproval: async (requestId: string, note?: string): Promise<RefundApproval> => unwrap(
    await axiosClient.post(`/api/payments/admin/refund-approval-requests/${encodeURIComponent(requestId)}/reject`, { note }),
  ),
  executeRefundApproval: async (requestId: string): Promise<RefundApproval> => unwrap(
    await axiosClient.post(`/api/payments/admin/refund-approval-requests/${encodeURIComponent(requestId)}/execute`),
  ),

  getAdminReconciliation: async (params: {
    status?: string;
    severity?: string;
    bookingId?: string;
    page?: number;
    size?: number;
  } = {}): Promise<AdminPage<ReconciliationCase>> => {
    const response = await axiosClient.get<unknown, AdminPage<ReconciliationCase> | { result: AdminPage<ReconciliationCase> }>(
      "/api/payments/admin/reconciliation", { params },
    );
    return unwrap(response);
  },

  syncReconciliation: async (caseId: number): Promise<ReconciliationCase> => {
    const response = await axiosClient.post<unknown, ReconciliationCase | { result: ReconciliationCase }>(
      `/api/payments/admin/reconciliation/${caseId}/sync`,
    );
    return unwrap(response);
  },

  resolveReconciliation: async (caseId: number, note: string): Promise<ReconciliationCase> => {
    const response = await axiosClient.post<unknown, ReconciliationCase | { result: ReconciliationCase }>(
      `/api/payments/admin/reconciliation/${caseId}/resolve`, { note },
    );
    return unwrap(response);
  },

  escalateReconciliation: async (caseId: number, note: string): Promise<ReconciliationCase> => {
    const response = await axiosClient.post<unknown, ReconciliationCase | { result: ReconciliationCase }>(
      `/api/payments/admin/reconciliation/${caseId}/escalate`, { note },
    );
    return unwrap(response);
  },
};
