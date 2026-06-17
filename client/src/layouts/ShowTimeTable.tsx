import { useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight, Monitor, Clock } from "lucide-react";
import type { ShowtimeData } from "./ShowTimeModal";

type Props = {
  showtimes: ShowtimeData[];
  onEdit: (showtime: ShowtimeData) => void;
  onDelete: (id: number) => void;
  searchQuery: string;
  statusFilter: string;
};

const ITEMS_PER_PAGE = 8;

export function ShowtimeTable({ showtimes, onEdit, onDelete, searchQuery, statusFilter }: Props) {
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const filtered = showtimes.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || s.movieName.toLowerCase().includes(q) || s.roomName.toLowerCase().includes(q);
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Movie & Room</span></th>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Date</span></th>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Time</span></th>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Status</span></th>
              <th className="px-5 py-3.5 text-right"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Actions</span></th>
            </tr>
          </thead>

          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  No showtimes found matching your filters.
                </td>
              </tr>
            ) : (
              pageItems.map((item) => (
                <tr key={item.id} className="border-b last:border-none hover-row transition-colors" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col">
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{item.movieName}</p>
                      <div className="flex items-center gap-1.5 mt-1" style={{ color: "var(--text-sub)" }}>
                        <Monitor size={12} />
                        <span style={{ fontSize: "12px" }}>{item.roomName}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <span style={{ fontSize: "14px", color: "var(--text-main)" }}>{item.showDate}</span>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Clock size={14} style={{ color: "var(--text-sub)" }} />
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>
                        {item.startTime} <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>- {item.endTime}</span>
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.status === "Showing" ? "bg-emerald-50 text-emerald-700" :
                        item.status === "Upcoming" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                          item.status === "Showing" ? "bg-emerald-500" :
                          item.status === "Upcoming" ? "bg-blue-500" : "bg-gray-400"
                        }`}
                      />
                      {item.status}
                    </span>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onEdit(item)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn" style={{ color: "var(--text-sub)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} title={deleteConfirm === item.id ? "Confirm?" : "Delete"} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${deleteConfirm === item.id ? "bg-rose-100 text-rose-600" : "action-btn text-rose-400 hover:text-rose-500"}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (Tái sử dụng code của trang trước) */}
      <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
          Showing <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</span> of <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> schedules
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => Math.abs(p - safePage) <= 2).map((p) => (
            <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ fontSize: "13px", fontWeight: p === safePage ? 600 : 400, background: p === safePage ? "#9333ea" : "transparent", color: p === safePage ? "#fff" : "var(--text-sub)" }}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}