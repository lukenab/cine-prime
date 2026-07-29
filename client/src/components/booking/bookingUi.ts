import type { BookingDetail, BookingStatus, PaymentStatus } from "../../api/bookingApi";

export const formatBookingMoney = (value: number, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(value || 0);

export const formatBookingDate = (value?: string) => {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
};

export const formatBookingDateTime = (value?: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed);
};

export const bookingStatusMeta: Record<
  BookingStatus,
  { label: string; color: string; background: string; description: string }
> = {
  PENDING_PAYMENT: {
    label: "Awaiting payment",
    color: "#fbbf24",
    background: "rgba(245,158,11,.12)",
    description: "Seats are held temporarily while payment is pending.",
  },
  CONFIRM_PENDING: {
    label: "Confirming booking",
    color: "#60a5fa",
    background: "rgba(59,130,246,.12)",
    description: "Payment was received. Your ticket is being issued.",
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "#34d399",
    background: "rgba(16,185,129,.12)",
    description: "Your booking is confirmed and ready for check-in.",
  },
  CANCEL_REQUESTED: {
    label: "Cancellation requested",
    color: "#fbbf24",
    background: "rgba(245,158,11,.12)",
    description: "Your cancellation request is being processed.",
  },
  REFUND_PENDING: {
    label: "Refund pending",
    color: "#c084fc",
    background: "rgba(168,85,247,.12)",
    description: "The refund has been requested and is being processed.",
  },
  REFUNDED: {
    label: "Refunded",
    color: "#a78bfa",
    background: "rgba(139,92,246,.12)",
    description: "The booking was cancelled and its refund completed.",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#f87171",
    background: "rgba(239,68,68,.11)",
    description: "This booking is no longer active.",
  },
  EXPIRED: {
    label: "Expired",
    color: "#94a3b8",
    background: "rgba(148,163,184,.1)",
    description: "The seat hold expired before payment was completed.",
  },
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  NOT_STARTED: "Not started",
  PENDING: "Pending",
  PROCESSING: "Processing",
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  UNKNOWN: "Needs verification",
  CANCELLED: "Cancelled",
};

export const canCancelBooking = (booking?: BookingDetail | null) =>
  !!booking &&
  ["PENDING_PAYMENT", "CONFIRM_PENDING", "CONFIRMED"].includes(booking.status);

export const isBookingInFlight = (booking?: BookingDetail | null) =>
  !!booking &&
  ["PENDING_PAYMENT", "CONFIRM_PENDING", "CANCEL_REQUESTED", "REFUND_PENDING"].includes(
    booking.status,
  );

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  const candidate = error as {
    response?: { data?: { message?: string; error?: string; result?: { message?: string } } };
    message?: string;
  };
  return (
    candidate?.response?.data?.message ||
    candidate?.response?.data?.result?.message ||
    candidate?.response?.data?.error ||
    candidate?.message ||
    fallback
  );
};
