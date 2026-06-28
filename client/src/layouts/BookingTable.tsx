import { useState } from "react";
import { Eye, XCircle, CheckCircle, ChevronLeft, ChevronRight, User, Film } from "lucide-react";

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface BookingData {
  id: string;
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  movieTitle: string;
  roomName: string;
  showDate: string;
  showTime: string;
  seats: string[];
  totalAmount: number;
  status: BookingStatus;
  createdAt: string;
  expiresAt?: string;
}

interface Props {
  bookings: BookingData[];
  searchQuery: string;
  statusFilter: string;
  onView: (b: BookingData) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}

const ITEMS_PER_PAGE = 8;

const statusBadge: Record<BookingStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:   { bg: "rgba(245,158,11,0.1)",  text: "#d97706", dot: "#f59e0b", label: "Pending" },
  CONFIRMED: { bg: "rgba(16,185,129,0.1)",  text: "#059669", dot: "#10b981", label: "Confirmed" },
  CANCELLED: { bg: "rgba(239,68,68,0.1)",   text: "#dc2626", dot: "#ef4444", label: "Cancelled" },
};

export function BookingTable({ bookings, searchQuery, statusFilter, onView, onConfirm, onCancel }: Props) {
  const [page, setPage] = useState(1);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  const filtered = bookings.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      b.bookingCode.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.customerEmail.toLowerCase().includes(q) ||
      b.movieTitle.toLowerCase().includes(q);
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleCancel = (id: string) => {
    if (cancelConfirm === id) {
      onCancel(id);
      setCancelConfirm(null);
    } else {
      setCancelConfirm(id);
      setTimeout(() => setCancelConfirm(null), 3000);
    }
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["Booking", "Customer", "Movie & Showtime", "Seats", "Amount", "Status", "Actions"].map((h) => (
                <th key={h} className={`px-5 py-3.5 ${h === "Actions" ? "text-right" : "text-left"}`}>
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  No bookings found matching your filters.
                </td>
              </tr>
            ) : (
              pageItems.map((item) => {
                const badge = statusBadge[item.status];
                return (
                  <tr key={item.id} className="border-b last:border-none hover-row transition-colors" style={{ borderColor: "var(--border-color)" }}>

                    {/* Booking code + date */}
                    <td className="px-5 py-3.5">
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                        #{item.bookingCode}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "2px" }}>{item.createdAt}</p>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <User size={13} style={{ color: "#3b82f6" }} />
                        </div>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{item.customerName}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{item.customerEmail}</p>
                        </div>
                      </div>
                    </td>

                    {/* Movie & showtime */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-2">
                        <Film size={13} style={{ color: "var(--text-sub)", marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{item.movieTitle}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{item.roomName} · {item.showDate} {item.showTime}</p>
                        </div>
                      </div>
                    </td>

                    {/* Seats */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.seats.map((s) => (
                          <span key={s} style={{ fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "5px", background: "rgba(139,92,246,0.1)", color: "#7c3aed", border: "1px solid rgba(139,92,246,0.2)" }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3.5">
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{fmtCurrency(item.totalAmount)}</p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: "20px", background: badge.bg, color: badge.text, fontSize: "12px", fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot, flexShrink: 0 }} />
                        {badge.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* View detail */}
                        <button onClick={() => onView(item)} title="View detail" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn" style={{ color: "var(--text-sub)" }}>
                          <Eye size={14} />
                        </button>

                        {/* Confirm — only for PENDING */}
                        {item.status === "PENDING" && (
                          <button
                            onClick={() => onConfirm(item.id)}
                            title="Confirm booking"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: "#10b981", background: "rgba(16,185,129,0.08)" }}
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}

                        {/* Cancel — only for PENDING or CONFIRMED */}
                        {item.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancel(item.id)}
                            title={cancelConfirm === item.id ? "Click again to confirm cancel" : "Cancel booking"}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              color: cancelConfirm === item.id ? "#fff" : "#ef4444",
                              background: cancelConfirm === item.id ? "#ef4444" : "rgba(239,68,68,0.08)",
                            }}
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
          Showing{" "}
          <span style={{ color: "var(--text-main)", fontWeight: 500 }}>
            {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
          </span>{" "}
          of{" "}
          <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> bookings
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - safePage) <= 2)
            .map((p) => (
              <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ fontSize: "13px", fontWeight: p === safePage ? 600 : 400, background: p === safePage ? "#f59e0b" : "transparent", color: p === safePage ? "#fff" : "var(--text-sub)" }}>
                {p}
              </button>
            ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <style>{`
        .hover-row:hover { background-color: rgba(128, 128, 128, 0.04); }
        .action-btn:hover { background-color: rgba(128, 128, 128, 0.1); color: var(--text-main) !important; }
      `}</style>
    </div>
  );
}
