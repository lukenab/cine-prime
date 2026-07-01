import { useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight, Monitor, Clock, Building2, Tag } from "lucide-react";
import type { ShowtimeResponse, ShowtimeStatus } from "../api/showtimeApi";

type Props = {
  showtimes: ShowtimeResponse[];
  onEdit: (showtime: ShowtimeResponse) => void;
  onDelete: (id: number) => void;
  searchQuery: string;
  statusFilter: string;
  dateFilter: string;
  cinemaFilter: number | "";
  roomFilter: number | "";
};

const ITEMS_PER_PAGE = 8;

const STATUS_STYLE: Record<ShowtimeStatus, { badge: string; dot: string }> = {
  SCHEDULED: { badge: "bg-blue-50 text-blue-700 border-blue-100",         dot: "bg-blue-500"    },
  ONGOING:   { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
  FINISHED:  { badge: "bg-gray-100 text-gray-500 border-gray-200",         dot: "bg-gray-400"    },
  CANCELLED: { badge: "bg-rose-50 text-rose-600 border-rose-100",          dot: "bg-rose-400"    },
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

export function ShowtimeTable({
  showtimes,
  onEdit,
  onDelete,
  searchQuery,
  statusFilter,
  dateFilter,
  cinemaFilter,
  roomFilter,
}: Props) {
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<ShowtimeResponse | null>(null);

  const filtered = showtimes.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      s.movieName.toLowerCase().includes(q) ||
      s.roomName.toLowerCase().includes(q) ||
      s.cinemaName.toLowerCase().includes(q);
    const matchStatus = !statusFilter || s.status === statusFilter;
    const matchDate   = !dateFilter   || s.showDate === dateFilter;
    const matchCinema = !cinemaFilter || s.cinemaId === cinemaFilter;
    const matchRoom   = !roomFilter   || s.cinemaRoomId === roomFilter;
    return matchSearch && matchStatus && matchDate && matchCinema && matchRoom;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <>
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 mx-auto mb-4">
              <Trash2 size={22} className="text-rose-500" />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "8px" }}>
              Delete Showtime
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-sub)", textAlign: "center", marginBottom: "20px" }}>
              Are you sure you want to delete the showtime for{" "}
              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{confirmDelete.movieName}</span>?
              <br />
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(confirmDelete.showtimeId); setConfirmDelete(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ background: "#ef4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
                {["Movie & Room", "Cinema", "Date", "Time", "Base Price", "Status", "Actions"].map((h) => (
                  <th key={h} className={`px-5 py-3.5 ${h === "Actions" ? "text-right" : "text-left"}`}>
                    <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {h}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                    No showtimes found matching your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.FINISHED;
                  return (
                    <tr key={item.showtimeId} className="border-b last:border-none hover-row transition-colors" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-5 py-3.5">
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{item.movieName}</p>
                        <div className="flex items-center gap-1.5 mt-1" style={{ color: "var(--text-sub)" }}>
                          <Monitor size={12} />
                          <span style={{ fontSize: "12px" }}>{item.roomName}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5" style={{ color: "var(--text-main)" }}>
                          <Building2 size={13} style={{ color: "var(--text-sub)" }} />
                          <span style={{ fontSize: "13.5px" }}>{item.cinemaName}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span style={{ fontSize: "14px", color: "var(--text-main)" }}>{item.showDate}</span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Clock size={14} style={{ color: "var(--text-sub)" }} />
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>
                            {item.startTime}{" "}
                            <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>– {item.endTime}</span>
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <Tag size={13} style={{ color: "var(--text-sub)" }} />
                          <span style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--text-main)" }}>
                            {formatPrice(item.basePrice)}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEdit(item)}
                            title="Edit"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn"
                            style={{ color: "var(--text-sub)" }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(item)}
                            title="Delete"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn text-rose-400 hover:text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
            Showing{" "}
            <span style={{ color: "var(--text-main)", fontWeight: 500 }}>
              {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}
              {`–`}
              {Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
            </span>{" "}
            of{" "}
            <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> schedules
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn"
              style={{ color: "var(--text-sub)" }}
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - safePage) <= 2)
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    fontSize: "13px",
                    fontWeight: p === safePage ? 600 : 400,
                    background: p === safePage ? "#9333ea" : "transparent",
                    color: p === safePage ? "#fff" : "var(--text-sub)",
                  }}
                >
                  {p}
                </button>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn"
              style={{ color: "var(--text-sub)" }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
