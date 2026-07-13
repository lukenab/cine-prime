import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowLeft, MapPin, Phone, Building2, Armchair, RefreshCw, AlertCircle,
  Plus, Search, ChevronRight, CheckCircle, XCircle, Clock, SendHorizonal, Edit2, Trash2,
} from "lucide-react";
import {
  movieApi,
  type ClusterResponse,
  type ClusterStatus,
  type RoomResponse,
  ROOM_TYPE_CONFIG,
} from "../../api/movieApi";
import { AddCinemaRoomModal } from "../../layouts/AddCinemaRoomModal";
import { useRole } from "../../hooks/useRole";

// ── Status config (small local copy — kept in sync with ManageCinemaClusterPage.tsx) ──

const STATUS_CONFIG: Record<ClusterStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:          { label: "Draft",          icon: Clock,       color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  PENDING_REVIEW: { label: "Pending Review", icon: Clock,       color: "#d97706", bg: "rgba(245,158,11,0.10)"  },
  ACTIVE:         { label: "Active",         icon: CheckCircle, color: "#10b981", bg: "rgba(16,185,129,0.10)"  },
  INACTIVE:       { label: "Inactive",       icon: XCircle,     color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
};

// ── Small reject-reason modal ─────────────────────────────────────────────────

function RejectModal({ onConfirm, onCancel }: { onConfirm: (note: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={onCancel}>
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: "#dc262618" }}>
          <XCircle size={22} style={{ color: "#dc2626" }} />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "16px" }}>Reject Cluster</h3>
        <div className="mb-4">
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: "6px" }}>Rejection reason</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Mô tả vấn đề cụ thể: địa chỉ không đúng, tên trùng, tọa độ sai…"
            rows={3}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border outline-none focus:ring-2 resize-none"
            style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button
            onClick={() => value.trim() ? onConfirm(value.trim()) : null}
            disabled={!value.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#dc2626" }}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClusterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const { can, isAdmin } = useRole();

  const clusterId = Number(id);

  const [cluster, setCluster] = useState<ClusterResponse | null>(null);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!clusterId) return;
    setLoading(true);
    setError(null);
    try {
      const [clusterRes, roomsRes] = await Promise.allSettled([
        movieApi.getClusterById(clusterId),
        movieApi.getRoomsByCluster(clusterId),
      ]);
      if (clusterRes.status === "fulfilled") setCluster(clusterRes.value.result);
      else setError("Failed to load cluster.");
      if (roomsRes.status === "fulfilled") setRooms(roomsRes.value.result ?? []);
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => { load(); }, [load]);

  const handleCreateRoom = async (data: Parameters<typeof movieApi.createRoom>[0]) => {
    setSubmitting(true);
    try {
      const res = await movieApi.createRoom(data);
      setRooms((prev) => [...prev, res.result]);
      setModalOpen(false);
      // Room counts on the cluster (totalRooms/totalSeats) are computed server-side —
      // refresh so the stat cards below reflect the room we just added.
      const clusterRes = await movieApi.getClusterById(clusterId);
      setCluster(clusterRes.result);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Create failed."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const doWorkflow = async (fn: () => Promise<{ result: ClusterResponse }>) => {
    setWorkflowBusy(true);
    try {
      const res = await fn();
      setCluster(res.result);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Action failed."}`);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!cluster) return;
    if (!window.confirm(`Delete cluster "${cluster.clusterName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await movieApi.deleteCluster(cluster.clusterId);
      navigate("/admin/clusters");
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Delete failed — cluster may still have rooms."}`);
    } finally {
      setDeleting(false);
    }
  };

  const filteredRooms = rooms.filter(
    (r) => !searchQuery || r.cinemaRoomName?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalSeats = rooms.reduce((sum, r) => sum + (r.seatQuantity ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  if (loading && !cluster) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-sub)" }} />
        <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading cluster…</p>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle size={22} style={{ color: "#ef4444" }} />
        <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>{error ?? "Cluster not found."}</p>
        <button
          onClick={() => navigate("/admin/clusters")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        >
          <ArrowLeft size={15} /> Back to Clusters
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[cluster.status];
  const StatusIcon = cfg.icon;

  return (
    <>
      {/* Back header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button
          onClick={() => navigate("/admin/clusters")}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h1 style={{ color: "var(--text-main)", fontWeight: 700, fontSize: "20px", lineHeight: 1.2 }}>
                {cluster.clusterName}
              </h1>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                <StatusIcon size={11} /> {cfg.label}
              </span>
            </div>
            <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
              {cluster.province} · {cluster.address}
              {cluster.phoneNumber && <> · <Phone size={10} className="inline -mt-0.5" /> {cluster.phoneNumber}</>}
            </p>
            {cluster.rejectionNote && (
              <p className="flex items-start gap-1 mt-1" style={{ fontSize: "12px", color: "#d97706" }}>
                <AlertCircle size={11} style={{ marginTop: "2px", flexShrink: 0 }} />
                {cluster.rejectionNote}
              </p>
            )}
          </div>
        </div>

        {/* Cluster workflow actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {cluster.status === "DRAFT" && (can.submit || isAdmin) && (
            <button
              disabled={workflowBusy}
              onClick={() => doWorkflow(() => movieApi.submitCluster(cluster.clusterId))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "13px", color: "#2563eb", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
            >
              <SendHorizonal size={14} /> Submit for review
            </button>
          )}
          {cluster.status === "PENDING_REVIEW" && isAdmin && (
            <>
              <button
                disabled={workflowBusy}
                onClick={() => doWorkflow(() => movieApi.approveCluster(cluster.clusterId))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80 disabled:opacity-50"
                style={{ fontSize: "13px", color: "#059669", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
              >
                <CheckCircle size={14} /> Approve
              </button>
              <button
                disabled={workflowBusy}
                onClick={() => setRejecting(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80 disabled:opacity-50"
                style={{ fontSize: "13px", color: "#dc2626", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
              >
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {can.edit && (
            <button
              onClick={() => navigate("/admin/clusters", { state: { editClusterId: cluster.clusterId } })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80"
              style={{ fontSize: "13px", color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
            >
              <Edit2 size={14} /> Edit
            </button>
          )}
          {isAdmin && (
            <button
              disabled={deleting}
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "13px", color: "#ef4444", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-violet-600" />
          </div>
          <div>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Rooms</p>
            <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{cluster.totalRooms ?? rooms.length}</p>
          </div>
        </div>
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Armchair size={20} className="text-emerald-600" />
          </div>
          <div>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Seats</p>
            <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{(cluster.totalSeats ?? totalSeats).toLocaleString()}</p>
          </div>
        </div>
      </div>

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
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)" }}>Rooms in this cluster</h2>
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search room name…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={inputStyle}
          />
        </div>
        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
        {can.edit && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
            style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
          >
            <Plus size={16} /> Add Room
          </button>
        )}
      </div>

      {/* Rooms table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["#", "Room Name", "Type", "Seat Quantity", "Seat Layout", ""].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rooms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading rooms…</p>
                </td>
              </tr>
            ) : filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  {searchQuery ? "No rooms match your search." : "No rooms in this cluster yet. Add one to get started."}
                </td>
              </tr>
            ) : (
              filteredRooms.map((room, idx) => {
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

        {filteredRooms.length > 0 && (
          <div className="px-5 py-3.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filteredRooms.length}</span> room{filteredRooms.length !== 1 ? "s" : ""} ·{" "}
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filteredRooms.reduce((s, r) => s + (r.seatQuantity ?? 0), 0).toLocaleString()}</span> total seats
            </p>
          </div>
        )}
      </div>

      <AddCinemaRoomModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateRoom}
        submitting={submitting}
        fixedClusterId={cluster.clusterId}
      />

      {rejecting && (
        <RejectModal
          onConfirm={(note) => {
            doWorkflow(() => movieApi.rejectCluster(cluster.clusterId, note));
            setRejecting(false);
          }}
          onCancel={() => setRejecting(false)}
        />
      )}

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
      `}</style>
    </>
  );
}
