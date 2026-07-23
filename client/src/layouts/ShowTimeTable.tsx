import { useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight, Monitor, Clock, PlayCircle, PauseCircle, XCircle } from "lucide-react";
import type { ShowtimeResponse, ShowtimeStatus } from "../api/showtimeApi";

type Props = {
  showtimes: ShowtimeResponse[];
  onEdit: (showtime: ShowtimeResponse) => void;
  onDelete: (id: number) => void;
  searchQuery: string;
  statusFilter: string;
  dateFilter: string;
  roomFilter: number | "";
  onBulkStatusChange: (ids: number[], status: ShowtimeStatus, reason?: string) => Promise<void>;
};

const ITEMS_PER_PAGE = 8;

const STATUS_STYLE: Record<ShowtimeStatus, { badge: string; dot: string }> = {
  SCHEDULED:  { badge: "bg-blue-50 text-blue-700 border-blue-100",         dot: "bg-blue-500"    },
  ON_SALE:    { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
  COMPLETED:  { badge: "bg-gray-100 text-gray-500 border-gray-200",         dot: "bg-gray-400"    },
  CANCELLED:  { badge: "bg-rose-50 text-rose-600 border-rose-100",          dot: "bg-rose-400"    },
  SUSPENDED:  { badge: "bg-amber-50 text-amber-700 border-amber-100",       dot: "bg-amber-400"   },
};

const STATUS_LABEL: Record<ShowtimeStatus, string> = {
  SCHEDULED: "Scheduled",
  ON_SALE:   "On Sale",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  SUSPENDED: "Suspended",
};

/** "HH:mm:ss" → "HH:mm" */
const fmt = (time: string) => time?.slice(0, 5) ?? "—";

export function ShowtimeTable({
  showtimes,
  onEdit,
  onDelete,
  searchQuery,
  statusFilter,
  dateFilter,
  roomFilter,
  onBulkStatusChange,
}: Props) {
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<ShowtimeResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = showtimes.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      s.movieName.toLowerCase().includes(q) ||
      s.cinemaRoomName.toLowerCase().includes(q);
    const matchStatus = !statusFilter || s.status === statusFilter;
    const matchDate   = !dateFilter   || s.showDate === dateFilter;
    const matchRoom   = !roomFilter   || s.cinemaRoomId === roomFilter;
    return matchSearch && matchStatus && matchDate && matchRoom;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const actionablePageIds = pageItems
    .filter((item) => item.status !== "CANCELLED" && item.status !== "COMPLETED")
    .map((item) => item.showTimeId);
  const allPageSelected = actionablePageIds.length > 0 && actionablePageIds.every((id) => selectedIds.includes(id));

  const runBulkAction = async (status: ShowtimeStatus, reason?: string) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkStatusChange(selectedIds, status, reason);
      setSelectedIds([]);
      setCancelOpen(false);
      setCancelReason("");
    } finally {
      setBulkBusy(false);
    }
  };

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
                onClick={() => { onDelete(confirmDelete.showTimeId); setConfirmDelete(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ background: "#ef4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && setCancelOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500"><XCircle size={19} /></div>
              <div><h3 className="text-base font-bold" style={{ color: "var(--text-main)" }}>Cancel selected showtimes</h3><p className="mt-0.5 text-xs" style={{ color: "var(--text-sub)" }}>{selectedIds.length} sessions will be removed from sale.</p></div>
            </div>
            <label className="mt-5 block text-xs font-semibold" style={{ color: "var(--text-main)" }}>Operational reason</label>
            <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={4} placeholder="For example: room maintenance or distributor request" className="mt-2 w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCancelOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Keep showtimes</button>
              <button type="button" disabled={!cancelReason.trim() || bulkBusy} onClick={() => void runBulkAction("CANCELLED", cancelReason.trim())} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Confirm cancellation</button>
            </div>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <strong className="mr-auto text-sm" style={{ color: "var(--text-main)" }}>{selectedIds.length} selected</strong>
          <button type="button" disabled={bulkBusy} onClick={() => void runBulkAction("ON_SALE")} className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600"><PlayCircle size={14} /> Open sales</button>
          <button type="button" disabled={bulkBusy} onClick={() => void runBulkAction("SUSPENDED")} className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600"><PauseCircle size={14} /> Suspend</button>
          <button type="button" disabled={bulkBusy} onClick={() => setCancelOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600"><XCircle size={14} /> Cancel</button>
          <button type="button" onClick={() => setSelectedIds([])} className="px-2 py-2 text-xs font-semibold" style={{ color: "var(--text-sub)" }}>Clear</button>
        </div>
      )}

      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
                <th className="w-12 px-5 py-3.5 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all actionable showtimes on this page"
                    checked={allPageSelected}
                    onChange={() => setSelectedIds((current) => allPageSelected
                      ? current.filter((id) => !actionablePageIds.includes(id))
                      : Array.from(new Set([...current, ...actionablePageIds])))}
                  />
                </th>
                {["Movie & Room", "Date", "Time", "Status", "Actions"].map((h) => (
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
                  <td colSpan={6} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                    No showtimes found matching your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.COMPLETED;
                  return (
                    <tr key={item.showTimeId} className="border-b last:border-none hover-row transition-colors" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.movieName}`}
                          disabled={item.status === "CANCELLED" || item.status === "COMPLETED"}
                          checked={selectedIds.includes(item.showTimeId)}
                          onChange={() => setSelectedIds((current) => current.includes(item.showTimeId)
                            ? current.filter((id) => id !== item.showTimeId)
                            : [...current, item.showTimeId])}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{item.movieName}</p>
                        <div className="flex items-center gap-1.5 mt-1" style={{ color: "var(--text-sub)" }}>
                          <Monitor size={12} />
                          <span style={{ fontSize: "12px" }}>{item.cinemaRoomName}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span style={{ fontSize: "14px", color: "var(--text-main)" }}>{item.showDate}</span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Clock size={14} style={{ color: "var(--text-sub)" }} />
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>
                            {fmt(item.startTime)}{" "}
                            <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>– {fmt(item.endTime)}</span>
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {STATUS_LABEL[item.status] ?? item.status}
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
              {"–"}
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
