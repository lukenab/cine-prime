import { useState, useEffect, useCallback } from "react";
import { Plus, Search, RefreshCw, AlertCircle, Building2, Users, Armchair, ChevronRight, MapPin } from "lucide-react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import { movieApi, type RoomResponse, type CreateRoomPayload, type RoomType, ROOM_TYPE_CONFIG, type ClusterResponse } from "../../api/movieApi";
import { AddCinemaRoomModal } from "../../layouts/AddCinemaRoomModal";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ManageCinemaRoomsPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCluster, setFilterCluster] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsRes, clustersRes] = await Promise.allSettled([
        movieApi.getRooms(),
        movieApi.getClusters(),
      ]);
      if (roomsRes.status === "fulfilled") setRooms(roomsRes.value.result ?? []);
      else setError("Failed to load cinema rooms.");
      if (clustersRes.status === "fulfilled") setClusters(clustersRes.value.result ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const handleCreate = async (data: CreateRoomPayload) => {
    setSubmitting(true);
    try {
      const res = await movieApi.createRoom(data);
      setRooms((prev) => [...prev, res.result]);
      setModalOpen(false);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Create failed."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = rooms.filter((r) => {
    const matchSearch = !searchQuery || r.cinemaRoomName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCluster = filterCluster === "ALL" || String(r.clusterId) === filterCluster;
    return matchSearch && matchCluster;
  });

  const totalSeats = rooms.reduce((sum, r) => sum + (r.seatQuantity ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  return (
    <>
      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Cinema Rooms
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage screening rooms and seating capacity
        </p>
        <p style={{ color: "var(--text-sub)", fontSize: "12px", marginTop: "6px" }}>
          Tip: this is the cross-cluster view. To manage rooms for one specific cinema, open it from{" "}
          <Link to="/admin/clusters" style={{ color: "#2563eb", textDecoration: "underline" }}>Cinema Clusters</Link>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Rooms", value: loading ? "—" : String(rooms.length), icon: Building2, color: "blue" },
          { label: "Total Seats", value: loading ? "—" : totalSeats.toLocaleString(), icon: Armchair, color: "emerald" },
          { label: "Avg. Capacity", value: loading || rooms.length === 0 ? "—" : Math.round(totalSeats / rooms.length).toString(), icon: Users, color: "violet" },
        ].map(({ label, value, icon: Icon, color }) => {
          const bg = color === "blue" ? "bg-blue-50" : color === "emerald" ? "bg-emerald-50" : "bg-violet-50";
          const ic = color === "blue" ? "text-blue-600" : color === "emerald" ? "text-emerald-600" : "text-violet-600";
          return (
            <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={ic} />
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button onClick={loadRooms} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600" style={{ fontSize: "13px" }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search room name…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={inputStyle}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500 text-base" style={{ color: "var(--text-sub)" }}>×</button>
          )}
        </div>

        {/* Cluster filter */}
        {clusters.length > 0 && (
          <select
            value={filterCluster}
            onChange={(e) => setFilterCluster(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border outline-none transition-all"
            style={{ ...inputStyle, minWidth: "160px", background: "var(--bg-card)" }}
          >
            <option value="ALL">All Clusters</option>
            {clusters.map((c) => (
              <option key={c.clusterId} value={String(c.clusterId)}>{c.clusterName}</option>
            ))}
          </select>
        )}

        <button
          onClick={loadRooms} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
        >
          <Plus size={16} /> Add Room
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["#", "Room Name", "Cluster", "Type", "Seat Quantity", "Seat Layout", ""].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rooms.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading rooms…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  {searchQuery ? "No rooms match your search." : "No cinema rooms yet. Add one to get started."}
                </td>
              </tr>
            ) : (
              filtered.map((room, idx) => {
                const numRows = Math.ceil((room.seatQuantity ?? 0) / 10);
                const lastRowSeats = (room.seatQuantity ?? 0) % 10 || 10;
                const lastRow = String.fromCharCode(64 + numRows);
                return (
                  <tr
                    key={room.cinemaRoomId}
                    className="hover-row border-b transition-colors"
                    style={{ borderColor: "var(--border-color)", cursor: "pointer" }}
                    onClick={() => navigate(`/admin/rooms/${room.cinemaRoomId}`, { state: { room } })}
                  >
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{idx + 1}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Building2 size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{room.cinemaRoomName}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>ID: {room.cinemaRoomId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {room.clusterName ? (
                        <Link
                          to={`/admin/clusters/${room.clusterId}`}
                          style={{ fontSize: "13px", color: "#2563eb" }}
                          className="hover:underline"
                        >
                          {room.clusterName}
                        </Link>
                      ) : (
                        <span style={{ fontSize: "13px", color: "#ef4444" }}>Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {room.roomType && (() => {
                        const colors: Record<string, string> = {
                          STANDARD: "bg-blue-50 text-blue-700",
                          LARGE: "bg-emerald-50 text-emerald-700",
                          IMAX: "bg-purple-50 text-purple-700",
                        };
                        return (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${colors[room.roomType] ?? "bg-gray-100 text-gray-600"}`}>
                            {ROOM_TYPE_CONFIG[room.roomType]?.label ?? room.roomType}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        <Armchair size={11} />
                        {room.seatQuantity} seats
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                        Rows A–{lastRow} · Last row {lastRowSeats} seats
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <ChevronRight size={15} style={{ color: "var(--text-sub)" }} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> room{filtered.length !== 1 ? "s" : ""} ·{" "}
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.reduce((s, r) => s + (r.seatQuantity ?? 0), 0).toLocaleString()}</span> total seats
            </p>
          </div>
        )}
      </div>

      <AddCinemaRoomModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        submitting={submitting}
        clusters={clusters}
      />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
      `}</style>
    </>
  );
}
