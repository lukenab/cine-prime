import { X, User, Film, MapPin, Clock, Ticket, DollarSign, CheckCircle, XCircle } from "lucide-react";
import type { BookingData, BookingStatus } from "./BookingTable";

interface Props {
  open: boolean;
  booking: BookingData | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}

const statusBadge: Record<BookingStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:   { bg: "rgba(245,158,11,0.12)",  text: "#d97706", dot: "#f59e0b", label: "Pending" },
  CONFIRMED: { bg: "rgba(16,185,129,0.12)",  text: "#059669", dot: "#10b981", label: "Confirmed" },
  CANCELLED: { bg: "rgba(239,68,68,0.12)",   text: "#dc2626", dot: "#ef4444", label: "Cancelled" },
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--border-color)" }}>
      <span style={{ fontSize: "12px", color: "var(--text-sub)", flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function BookingDetailModal({ open, booking, onClose, onConfirm, onCancel }: Props) {
  if (!open || !booking) return null;

  const badge = statusBadge[booking.status];
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: "20px" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Booking Detail</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-main)", fontFamily: "monospace" }}>#{booking.bookingCode}</h2>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: "20px", background: badge.bg, color: badge.text, fontSize: "12px", fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot }} />
                {badge.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-sub)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>

          {/* Customer info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "14px 16px", borderRadius: "10px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <User size={18} style={{ color: "#3b82f6" }} />
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{booking.customerName}</p>
              <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>{booking.customerEmail}</p>
            </div>
          </div>

          {/* Movie info */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Film size={13} style={{ color: "var(--text-sub)" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Showtime Info</span>
            </div>
            <InfoRow label="Movie" value={booking.movieTitle} />
            <InfoRow label="Room" value={<span style={{ display: "flex", alignItems: "center", gap: 5 }}><MapPin size={12} />{booking.roomName}</span>} />
            <InfoRow label="Date & Time" value={<span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={12} />{booking.showDate} at {booking.showTime}</span>} />
          </div>

          {/* Ticket info */}
          <div style={{ margin: "18px 0 6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Ticket size={13} style={{ color: "var(--text-sub)" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ticket Info</span>
            </div>
            <InfoRow
              label="Seats"
              value={
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                  {booking.seats.map((s) => (
                    <span key={s} style={{ fontSize: "12px", fontWeight: 600, padding: "2px 8px", borderRadius: "5px", background: "rgba(139,92,246,0.1)", color: "#7c3aed", border: "1px solid rgba(139,92,246,0.2)" }}>
                      {s}
                    </span>
                  ))}
                </div>
              }
            />
            <InfoRow label="Number of seats" value={`${booking.seats.length} seat(s)`} />
            <InfoRow label="Booked at" value={booking.createdAt} />
            {booking.expiresAt && booking.status === "PENDING" && (
              <InfoRow label="Expires at" value={<span style={{ color: "#f59e0b" }}>{booking.expiresAt}</span>} />
            )}
          </div>

          {/* Payment */}
          <div style={{ margin: "18px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <DollarSign size={13} style={{ color: "var(--text-sub)" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Payment</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: "10px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
              <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>Total Amount</span>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#10b981" }}>{fmtCurrency(booking.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        {booking.status !== "CANCELLED" && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {booking.status === "PENDING" && (
              <>
                <button
                  onClick={() => { onCancel(booking.id); onClose(); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: "9px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
                >
                  <XCircle size={15} /> Cancel Booking
                </button>
                <button
                  onClick={() => { onConfirm(booking.id); onClose(); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: "9px", border: "none", background: "#10b981", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  <CheckCircle size={15} /> Confirm Booking
                </button>
              </>
            )}
            {booking.status === "CONFIRMED" && (
              <button
                onClick={() => { onCancel(booking.id); onClose(); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: "9px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
              >
                <XCircle size={15} /> Cancel Booking
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
