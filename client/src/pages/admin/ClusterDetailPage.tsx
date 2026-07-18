import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowLeft, MapPin, Phone, Building2, Armchair, RefreshCw, AlertCircle,
  Plus, Search, ChevronRight, CheckCircle, CheckCircle2, XCircle, Clock, SendHorizonal, Edit2, Trash2,
  CalendarDays, Mail, Timer,
} from "lucide-react";
import {
  movieApi,
  type ClusterResponse,
  type ClusterStatus,
  type ClusterOperatingHour,
  type RoomResponse,
  ROOM_TYPE_CONFIG,
} from "../../api/movieApi";
import { useRole } from "../../hooks/useRole";
import { RoomCreationMethodDialog } from "./cinemaRoomEditor/RoomCreationMethodDialog";
import { ClusterWizardModal } from "./ClusterWizardModal";

// ── Status config (small local copy — kept in sync with ManageCinemaClusterPage.tsx) ──

const STATUS_CONFIG: Record<ClusterStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:          { label: "Draft",          icon: Clock,       color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  PENDING_REVIEW: { label: "Pending Review", icon: Clock,       color: "#d97706", bg: "rgba(245,158,11,0.10)"  },
  ACTIVE:         { label: "Active",         icon: CheckCircle, color: "#10b981", bg: "rgba(16,185,129,0.10)"  },
  INACTIVE:       { label: "Inactive",       icon: XCircle,     color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
};

const OPERATING_DAY_LABELS = { MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun" } as const;
const OPERATING_DAY_ORDER = Object.keys(OPERATING_DAY_LABELS) as Array<keyof typeof OPERATING_DAY_LABELS>;

function formatHourRange(hour: ClusterOperatingHour): string {
  if (hour.closed) return "Closed";
  if (!hour.opensAt || !hour.closesAt) return "—";
  return `${hour.opensAt.slice(0, 5)}–${hour.closesAt.slice(0, 5)}${hour.closesNextDay ? " (overnight)" : ""}`;
}

/** Groups consecutive days sharing the same hours into one line each (e.g. "Mon–Sun 08:00–23:00"
 *  instead of 7 near-identical boxes) — the common case (uniform week) collapses to a single row. */
function summarizeSchedule(hours: ClusterOperatingHour[]) {
  const groups: Array<{ labels: string[]; hour: ClusterOperatingHour }> = [];
  for (const id of OPERATING_DAY_ORDER) {
    const hour = hours.find((h) => h.dayOfWeek === id);
    if (!hour) continue;
    const label: string = OPERATING_DAY_LABELS[id];
    const last = groups[groups.length - 1];
    if (
      last
      && last.hour.closed === hour.closed
      && last.hour.opensAt === hour.opensAt
      && last.hour.closesAt === hour.closesAt
      && last.hour.closesNextDay === hour.closesNextDay
    ) {
      last.labels.push(label);
    } else {
      groups.push({ labels: [label], hour });
    }
  }

  return groups.map(({ labels, hour }) => ({
    range: labels.length > 1 ? `${labels[0]}–${labels[labels.length - 1]}` : labels[0],
    hours: formatHourRange(hour),
    closed: hour.closed,
  }));
}

// Nhan hang kieu Excel (khop rowLabel() ben backend): 0->A, 1->B, ..., 25->Z, 26->AA...
function excelRowLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

// ── Toast (matches the pattern used in SettingsPage.tsx / CreateEmployeePage.tsx) ──

function Toast({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
      style={{ background: type === "success" ? "#059669" : "#ef4444", color: "#fff", minWidth: "280px" }}>
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{message}</span>
      <button onClick={onClose} className="ml-auto opacity-75 hover:opacity-100" style={{ fontSize: "18px", lineHeight: 1 }}>×</button>
    </div>
  );
}

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
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);
  const [choosingRoomCreationMethod, setChoosingRoomCreationMethod] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

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

  const handleDeleteRoom = async (room: RoomResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete room "${room.cinemaRoomName}"? This cannot be undone.`)) return;
    setDeletingRoomId(room.cinemaRoomId);
    try {
      await movieApi.deleteRoom(room.cinemaRoomId);
      setRooms((prev) => prev.filter((r) => r.cinemaRoomId !== room.cinemaRoomId));
      showToast("success", `Room "${room.cinemaRoomName}" deleted.`);
      const clusterRes = await movieApi.getClusterById(clusterId);
      setCluster(clusterRes.result);
    } catch (err: any) {
      showToast("error", err?.response?.data?.message ?? "Delete failed — room may already have showtimes.");
    } finally {
      setDeletingRoomId(null);
    }
  };

  const doWorkflow = async (fn: () => Promise<{ result: ClusterResponse }>) => {
    setWorkflowBusy(true);
    try {
      const res = await fn();
      setCluster(res.result);
    } catch (err: any) {
      showToast("error", err?.response?.data?.message ?? "Action failed.");
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
      showToast("error", err?.response?.data?.message ?? "Delete failed — cluster may still have rooms.");
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
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

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
              onClick={() => setEditOpen(true)}
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

      {/* Operational profile — Sections 1-4 only; amenities remain out of scope. Everything
          reads as two flowing lines (like the "province · address · phone" line in the
          header) instead of a labeled dl-grid + divided sub-sections — that stacked so much
          vertical chrome it ate half the page before the room table even showed up. */}
      <section className="mb-6 rounded-2xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2"><Building2 size={16} className="text-blue-600" /><h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>Cluster profile</h2></div>

        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
          {[
            cluster.clusterCode ?? `Cluster ${cluster.clusterId}`,
            (cluster.venueType ?? "MALL").replace(/_/g, " "),
            cluster.timezone ?? "Asia/Ho_Chi_Minh",
            cluster.countryCode ?? "VN",
            cluster.openingDate && `Opened ${cluster.openingDate}`,
            cluster.ward,
            [cluster.buildingName, cluster.floorLocation].filter(Boolean).join(" · ") || undefined,
          ].filter(Boolean).map((part, i, arr) => (
            <span key={i}>
              <strong style={{ color: "var(--text-main)", fontWeight: 600 }}>{part}</strong>{i < arr.length - 1 && <span className="ml-1.5">·</span>}
            </span>
          ))}
          {cluster.publicEmail && (
            <>
              <span>·</span>
              <a href={`mailto:${cluster.publicEmail}`} className="inline-flex items-center gap-1" style={{ color: "#2563eb", fontWeight: 600 }}>
                <Mail size={11} />{cluster.publicEmail}
              </a>
            </>
          )}
        </p>

        <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderColor: "var(--border-color)" }}>
          <span className="flex items-center gap-1.5" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
            <Building2 size={13} className="text-violet-600" /><strong style={{ color: "var(--text-main)" }}>{cluster.totalRooms ?? rooms.length}</strong> rooms
          </span>
          <span className="flex items-center gap-1.5" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
            <Armchair size={13} className="text-emerald-600" /><strong style={{ color: "var(--text-main)" }}>{(cluster.totalSeats ?? totalSeats).toLocaleString()}</strong> seats
          </span>
          <span style={{ width: "1px", height: "14px", background: "var(--border-color)" }} />
          {summarizeSchedule(cluster.operatingHours ?? []).map((group) => (
            <span key={group.range} className="flex items-center gap-1.5" style={{ fontSize: "12.5px", color: group.closed ? "#ef4444" : "var(--text-sub)" }}>
              <Timer size={13} style={{ color: group.closed ? "#ef4444" : "#2563eb" }} />
              <strong style={{ color: group.closed ? "#ef4444" : "var(--text-main)" }}>{group.range}</strong> {group.hours}
            </span>
          ))}
          {!cluster.operatingHours?.length && <span style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Schedule not migrated</span>}
        </div>
      </section>

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
        {can.edit && cluster.status === "ACTIVE" && (
          <button
            onClick={() => setChoosingRoomCreationMethod(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
            style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
          >
            <Plus size={16} /> Add Room
          </button>
        )}
        {can.edit && cluster.status !== "ACTIVE" && (
          <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>
            Cluster must be ACTIVE before rooms can be added.
          </span>
        )}
      </div>

      <ClusterWizardModal
        open={editOpen}
        mode="edit"
        clusterId={cluster.clusterId}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => setCluster(saved)}
      />

      {choosingRoomCreationMethod && (
        <RoomCreationMethodDialog
          rooms={rooms}
          onClose={() => setChoosingRoomCreationMethod(false)}
          onCreateNew={() => navigate(`/admin/clusters/${cluster.clusterId}/rooms/new`)}
          onDuplicate={(sourceRoomId) => navigate(`/admin/clusters/${cluster.clusterId}/rooms/new?duplicateFrom=${sourceRoomId}`)}
        />
      )}

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
                const lastRow = excelRowLabel((room.numberOfRows ?? 1) - 1);
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
                        Rows A–{lastRow} · {room.seatsPerRow} seats/row
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 justify-end">
                        {can.edit && (
                          <button
                            disabled={deletingRoomId === room.cinemaRoomId}
                            onClick={(e) => handleDeleteRoom(room, e)}
                            className="p-1.5 rounded-lg hover:opacity-80 disabled:opacity-50"
                            style={{ color: "#ef4444" }}
                            title="Delete room"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <ChevronRight size={15} style={{ color: "var(--text-sub)" }} />
                      </div>
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
