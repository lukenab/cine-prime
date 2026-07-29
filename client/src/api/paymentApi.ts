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
};
