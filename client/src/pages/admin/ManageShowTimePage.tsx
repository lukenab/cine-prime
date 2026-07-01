import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, SlidersHorizontal, RefreshCw, AlertCircle } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { ShowtimeStatsCards } from "../../layouts/ShowTimeStatsCards";
import { ShowtimeTable } from "../../layouts/ShowTimeTable";
import { ShowtimeModal } from "../../layouts/ShowTimeModal";
import {
  showtimeApi,
  type ShowtimeResponse,
  type ShowtimeAssignPayload,
  type ShowtimeUpdatePayload,
} from "../../api/showtimeApi";

export default function ManageShowtimePage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [showtimes, setShowtimes]     = useState<ShowtimeResponse[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter]   = useState("");
  const [cinemaFilter, setCinemaFilter] = useState<number | "">("");
  const [roomFilter, setRoomFilter]   = useState<number | "">("");

  const [modalOpen, setModalOpen]       = useState(false);
  const [editShowtime, setEditShowtime] = useState<ShowtimeResponse | null>(null);
  const [showFilters, setShowFilters]   = useState(false);

  const loadShowtimes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await showtimeApi.getShowtimes();
      setShowtimes(res.result ?? []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to load showtimes. Is the showtime service running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadShowtimes(); }, [loadShowtimes]);

  // Derive filter options from loaded showtimes (no extra API calls)
  const cinemaOptions = useMemo(() => {
    const map = new Map<number, string>();
    showtimes.forEach((s) => map.set(s.cinemaId, s.cinemaName));
    return Array.from(map, ([cinemaId, cinemaName]) => ({ cinemaId, cinemaName }));
  }, [showtimes]);

  const roomOptions = useMemo(() => {
    const map = new Map<number, string>();
    showtimes
      .filter((s) => !cinemaFilter || s.cinemaId === cinemaFilter)
      .forEach((s) => map.set(s.cinemaRoomId, s.roomName));
    return Array.from(map, ([cinemaRoomId, roomName]) => ({ cinemaRoomId, roomName }));
  }, [showtimes, cinemaFilter]);

  const handleSaveShowtime = async (payload: ShowtimeAssignPayload | ShowtimeUpdatePayload) => {
    if (editShowtime) {
      const res = await showtimeApi.updateShowtime(editShowtime.showtimeId, payload as ShowtimeUpdatePayload);
      setShowtimes((prev) =>
        prev.map((s) => (s.showtimeId === editShowtime.showtimeId ? res.result : s))
      );
    } else {
      const res = await showtimeApi.createShowtime(payload as ShowtimeAssignPayload);
      setShowtimes((prev) => [res.result, ...prev]);
    }
  };

  const handleDeleteShowtime = async (id: number) => {
    try {
      await showtimeApi.deleteShowtime(id);
      setShowtimes((prev) => prev.filter((s) => s.showtimeId !== id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to delete showtime. Please try again.");
    }
  };

  const handleResetFilters = () => {
    setStatusFilter("");
    setDateFilter("");
    setCinemaFilter("");
    setRoomFilter("");
  };

  const hasActiveFilters = !!(statusFilter || dateFilter || cinemaFilter || roomFilter);

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

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button
            onClick={loadShowtimes}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600"
            style={{ fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <ShowtimeStatsCards showtimes={showtimes} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text"
            placeholder="Search by movie title or room…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <SlidersHorizontal size={15} /> Filters
          {hasActiveFilters && <span className="w-2 h-2 bg-purple-600 rounded-full ml-0.5" />}
        </button>

        <button
          onClick={loadShowtimes}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>

        <button
          onClick={() => { setEditShowtime(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#9333ea" : "#7e22ce" }}
        >
          <Plus size={16} /> Schedule Show
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="p-4 rounded-xl border mb-6 space-y-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>Filter Showtimes</p>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "12px", color: "var(--text-sub)" }}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none cursor-pointer"
                style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                <option value="">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ONGOING">Ongoing</option>
                <option value="FINISHED">Finished</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontSize: "12px", color: "var(--text-sub)" }}>Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none"
                style={{ colorScheme: "var(--color-scheme)" as string, fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              />
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontSize: "12px", color: "var(--text-sub)" }}>Cinema</label>
              <select
                value={cinemaFilter}
                onChange={(e) => { setCinemaFilter(e.target.value ? Number(e.target.value) : ""); setRoomFilter(""); }}
                className="w-full px-3 py-2 rounded-lg border outline-none cursor-pointer"
                style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                <option value="">All Cinemas</option>
                {cinemaOptions.map((c) => (
                  <option key={c.cinemaId} value={c.cinemaId}>{c.cinemaName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontSize: "12px", color: "var(--text-sub)" }}>Room</label>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 rounded-lg border outline-none cursor-pointer"
                style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                <option value="">All Rooms</option>
                {roomOptions.map((r) => (
                  <option key={r.cinemaRoomId} value={r.cinemaRoomId}>{r.roomName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading && showtimes.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-purple-600" />
          <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading schedules...</p>
        </div>
      ) : (
        <ShowtimeTable
          showtimes={showtimes}
          onEdit={(s) => { setEditShowtime(s); setModalOpen(true); }}
          onDelete={handleDeleteShowtime}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          dateFilter={dateFilter}
          cinemaFilter={cinemaFilter}
          roomFilter={roomFilter}
        />
      )}

      <ShowtimeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveShowtime}
        editShowtime={editShowtime}
      />

      <style>{`
        .hover-row:hover { background-color: rgba(128, 128, 128, 0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255, 255, 255, 0.03); }
        .action-btn:hover { background-color: rgba(128, 128, 128, 0.1); color: var(--text-main) !important; }
      `}</style>
    </>
  );
}
