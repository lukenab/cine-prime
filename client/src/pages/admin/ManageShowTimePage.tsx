import { useState } from "react";
import { Search, Plus, SlidersHorizontal, Calendar } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { ShowtimeStatsCards } from "../../layouts/ShowTimeStatsCards";
import { ShowtimeTable } from "../../layouts/ShowTimeTable";
import { ShowtimeModal, type ShowtimeData } from "../../layouts/ShowTimeModal";

const initialShowtimes: ShowtimeData[] = [
  { id: 1, movieName: "Dune: Part Two", roomName: "Cinema 1 (IMAX)", showDate: "2024-06-20", startTime: "09:00", endTime: "11:46", status: "Completed" },
  { id: 2, movieName: "Deadpool & Wolverine", roomName: "Cinema 2 (3D)", showDate: "2024-06-25", startTime: "14:30", endTime: "16:37", status: "Upcoming" },
  { id: 3, movieName: "Inside Out 2", roomName: "Cinema 3 (Standard)", showDate: "2024-06-25", startTime: "18:00", endTime: "19:36", status: "Upcoming" },
];

export default function ManageShowtimePage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [showtimes, setShowtimes] = useState<ShowtimeData[]>(initialShowtimes);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editShowtime, setEditShowtime] = useState<ShowtimeData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  let nextId = showtimes.length > 0 ? Math.max(...showtimes.map((s) => s.id)) + 1 : 1;

  const handleSaveShowtime = (data: Omit<ShowtimeData, "id" | "endTime" | "status">) => {
    // Tính toán giả lập endTime (cộng thêm 2 tiếng)
    const [h, m] = data.startTime.split(":").map(Number);
    const endH = (h + 2).toString().padStart(2, "0");
    const endM = m.toString().padStart(2, "0");
    const endTime = `${endH}:${endM}`;

    if (editShowtime) {
      setShowtimes((prev) => prev.map((s) => (s.id === editShowtime.id ? { ...s, ...data, endTime } : s)));
    } else {
      const newShowtime: ShowtimeData = { ...data, id: nextId++, endTime, status: "Upcoming" };
      setShowtimes((prev) => [newShowtime, ...prev]);
    }
  };

  return (
    <>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Showtime Scheduling
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage daily schedules, screening rooms, and time slots
        </p>
      </div>

      <ShowtimeStatsCards />

      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search by movie title or room..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
        </div>

        <button onClick={() => setShowFilters((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80" style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
          <SlidersHorizontal size={15} /> Filters
          {statusFilter && <span className="w-2 h-2 bg-purple-600 rounded-full ml-0.5" />}
        </button>

        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80" style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
          <Calendar size={15} /> Calendar View
        </button>

        <button
          onClick={() => { setEditShowtime(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#9333ea" : "#7e22ce" }} // Đổi tông màu tím cho trang Showtimes
        >
          <Plus size={16} /> Schedule Show
        </button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap p-4 rounded-xl border transition-all mb-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Filter by Status:</p>
          <div className="flex items-center gap-1 filter-btns">
            <button onClick={() => setStatusFilter("")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!statusFilter ? "active-purple" : ""}`}>All Status</button>
            <button onClick={() => setStatusFilter("Showing")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Showing" ? "active-green" : ""}`}>Showing</button>
            <button onClick={() => setStatusFilter("Upcoming")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Upcoming" ? "active-blue" : ""}`}>Upcoming</button>
            <button onClick={() => setStatusFilter("Completed")} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === "Completed" ? "active-gray" : ""}`}>Completed</button>
          </div>
        </div>
      )}

      <ShowtimeTable showtimes={showtimes} onEdit={(s) => { setEditShowtime(s); setModalOpen(true); }} onDelete={(id) => setShowtimes((p) => p.filter((x) => x.id !== id))} searchQuery={searchQuery} statusFilter={statusFilter} />
      <ShowtimeModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveShowtime} editShowtime={editShowtime} />

      <style>{`
        .hover-row:hover { background-color: rgba(128, 128, 128, 0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255, 255, 255, 0.03); }
        .action-btn:hover { background-color: rgba(128, 128, 128, 0.1); color: var(--text-main) !important; }

        .filter-btns button { background: transparent; color: var(--text-sub); border-color: var(--border-color); }
        .filter-btns button:hover { background: rgba(128, 128, 128, 0.1); color: var(--text-main); }
        .filter-btns button.active-purple { background: #9333ea !important; color: white !important; border-color: #9333ea !important; }
        .filter-btns button.active-green { background: #059669 !important; color: white !important; border-color: #059669 !important; }
        .filter-btns button.active-blue { background: #3b82f6 !important; color: white !important; border-color: #3b82f6 !important; }
        .filter-btns button.active-gray { background: #4b5563 !important; color: white !important; border-color: #4b5563 !important; }
      `}</style>
    </>
  );
}