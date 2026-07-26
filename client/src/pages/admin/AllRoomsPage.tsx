import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, RefreshCw, AlertCircle, Building2, Armchair, MapPin,
  ChevronRight, CheckCircle, XCircle, Clock, Wrench,
} from "lucide-react";
import { movieApi, type RoomResponse, type ClusterResponse } from "../../api/movieApi";

// ── Room status config (kept in sync with the local copy in ClusterDetailPage.tsx) ──

const ROOM_STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:                    { label: "Draft",         icon: Clock,       color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  PENDING_APPROVAL:         { label: "Pending",        icon: Clock,       color: "#d97706", bg: "rgba(245,158,11,0.10)"  },
  APPROVED:                 { label: "Approved",       icon: CheckCircle, color: "#2563eb", bg: "rgba(37,99,235,0.10)"   },
  ACTIVE:                   { label: "Active",         icon: CheckCircle, color: "#10b981", bg: "rgba(16,185,129,0.10)"  },
  MAINTENANCE:              { label: "Maintenance",    icon: Wrench,      color: "#d97706", bg: "rgba(245,158,11,0.10)"  },
  TEMPORARILY_UNAVAILABLE:  { label: "Unavailable",    icon: AlertCircle, color: "#ea580c", bg: "rgba(234,88,12,0.10)"   },
  SUSPENDED:                { label: "Suspended",      icon: XCircle,     color: "#e11d48", bg: "rgba(225,29,72,0.10)"   },
  CLOSED:                   { label: "Closed",         icon: XCircle,     color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  RETIRED:                  { label: "Retired",        icon: XCircle,     color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
};

const PRESENTATION_SYSTEM_LABEL: Record<string, string> = {
  STANDARD: "Standard",
  IMAX: "IMAX",
  DOLBY_CINEMA: "Dolby Cinema",
  SCREENX: "ScreenX",
  FOUR_DX: "4DX",
};

/** Statuses that mean "not currently sellable due to an operational issue" — the
 *  quick-filter this page exists for ("phòng nào đang bảo trì"). */
const OUT_OF_SERVICE_STATUSES = new Set(["MAINTENANCE", "TEMPORARILY_UNAVAILABLE", "SUSPENDED"]);

export default function AllRoomsPage() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [clusterFilter, setClusterFilter] = useState<number | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<string | "ALL" | "OUT_OF_SERVICE">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [roomsRes, clustersRes] = await Promise.allSettled([
      movieApi.getRooms(),
      movieApi.getClusters(),
    ]);

    if (roomsRes.status === "fulfilled") {
      setRooms(roomsRes.value.result ?? []);
    } else {
      setError(roomsRes.reason?.response?.data?.message ?? "Failed to load rooms.");
    }
    if (clustersRes.status === "fulfilled") {
      setClusters(clustersRes.value.result ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const outOfServiceCount = rooms.filter((r) => r.status && OUT_OF_SERVICE_STATUSES.has(r.status)).length;
  const activeCount = rooms.filter((r) => r.status === "ACTIVE").length;
  const totalSeats = rooms.reduce((sum, r) => sum + (r.seatQuantity ?? 0), 0);
  const clusterCount = new Set(rooms.map((r) => r.clusterId)).size;

  const filteredRooms = rooms.filter((r) => {
    const matchSearch =
      !searchQuery ||
      r.cinemaRoomName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.clusterName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCluster = clusterFilter === "ALL" || r.clusterId === clusterFilter;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "OUT_OF_SERVICE" ? r.status && OUT_OF_SERVICE_STATUSES.has(r.status) : r.status === statusFilter);
    return matchSearch && matchCluster && matchStatus;
  });

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  const statusesPresent = Array.from(new Set(rooms.map((r) => r.status).filter(Boolean))) as string[];

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          All Cinema Rooms
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          System-wide overview of every room across all cinema clusters
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Rooms",      value: loading ? "—" : String(rooms.length),       icon: Building2, color: "violet"  },
          { label: "Active",           value: loading ? "—" : String(activeCount),         icon: CheckCircle, color: "emerald" },
          { label: "Under Maintenance/Unavailable", value: loading ? "—" : String(outOfServiceCount), icon: Wrench, color: "amber" },
          { label: "Clusters Covered", value: loading ? "—" : String(clusterCount),        icon: MapPin,    color: "blue"    },
        ].map(({ label, value, icon: Icon, color }) => {
          const bg = { blue: "bg-blue-50", emerald: "bg-emerald-50", amber: "bg-amber-50", violet: "bg-violet-50" }[color]!;
          const ic = { blue: "text-blue-600", emerald: "text-emerald-600", amber: "text-amber-600", violet: "text-violet-600" }[color]!;
          return (
            <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={ic} />
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {totalSeats > 0 && (
        <p className="mb-6" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
          <Armchair size={13} className="inline -mt-0.5 mr-1" />
          <strong style={{ color: "var(--text-main)" }}>{totalSeats.toLocaleString()}</strong> total seats installed
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600" style={{ fontSize: "13px" }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search room or cluster name…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none transition-all"
            style={inputStyle}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }}>×</button>
          )}
        </div>

        <select
          value={clusterFilter === "ALL" ? "ALL" : String(clusterFilter)}
          onChange={(e) => setClusterFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
          className="px-3.5 py-2.5 rounded-xl outline-none"
          style={inputStyle}
        >
          <option value="ALL">All clusters</option>
          {clusters.map((c) => (
            <option key={c.clusterId} value={c.clusterId}>{c.clusterName}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3.5 py-2.5 rounded-xl outline-none"
          style={inputStyle}
        >
          <option value="ALL">All statuses</option>
          <option value="OUT_OF_SERVICE">Maintenance / Unavailable / Suspended</option>
          {statusesPresent.map((s) => (
            <option key={s} value={s}>{ROOM_STATUS_CONFIG[s]?.label ?? s}</option>
          ))}
        </select>

        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Rooms table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["#", "Room Name", "Cluster", "Seats", "Format", "Status", ""].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading rooms…</p>
                </td>
              </tr>
            ) : filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  {searchQuery || clusterFilter !== "ALL" || statusFilter !== "ALL"
                    ? "No rooms match your filters."
                    : "No rooms found across any cluster."}
                </td>
              </tr>
            ) : (
              filteredRooms.map((room, idx) => (
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
                  <td className="px-5 py-3.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/clusters/${room.clusterId}`); }}
                      className="inline-flex items-center gap-1.5 hover:underline"
                      style={{ fontSize: "13px", color: "var(--text-sub)" }}
                    >
                      <MapPin size={11} /> {room.clusterName ?? `Cluster #${room.clusterId}`}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      <Armchair size={11} />
                      {room.seatQuantity} seats
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {room.presentationSystem && room.presentationSystem !== "STANDARD" && (
                        <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}>
                          {PRESENTATION_SYSTEM_LABEL[room.presentationSystem] ?? room.presentationSystem}
                        </span>
                      )}
                      {room.supports2d && (
                        <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>2D</span>
                      )}
                      {room.supports3d && (
                        <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>3D</span>
                      )}
                      {!room.presentationSystem && !room.supports2d && !room.supports3d && (
                        <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {room.status && ROOM_STATUS_CONFIG[room.status] ? (() => {
                      const cfg = ROOM_STATUS_CONFIG[room.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
                          style={{ background: cfg.bg, color: cfg.color }}
                          title={room.maintenanceNote}
                        >
                          <StatusIcon size={11} />{cfg.label}
                        </span>
                      );
                    })() : (
                      <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end">
                      <ChevronRight size={15} style={{ color: "var(--text-sub)" }} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && filteredRooms.length > 0 && (
          <div className="px-5 py-3.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filteredRooms.length}</span> room{filteredRooms.length !== 1 ? "s" : ""} ·{" "}
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filteredRooms.reduce((s, r) => s + (r.seatQuantity ?? 0), 0).toLocaleString()}</span> total seats
            </p>
          </div>
        )}
      </div>

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
      `}</style>
    </>
  );
}
