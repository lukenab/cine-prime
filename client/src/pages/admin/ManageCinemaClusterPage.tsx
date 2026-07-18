import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, RefreshCw, AlertCircle, MapPin, Building2,
  Armchair, Edit2, Trash2, CheckCircle, XCircle, Eye,
  Clock, SendHorizonal,
} from "lucide-react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  movieApi,
  type ClusterResponse,
  type ClusterStatus,
} from "../../api/movieApi";
import { useRole } from "../../hooks/useRole";
import { ClusterWizardModal } from "./ClusterWizardModal";
import { ClusterReviewModal } from "../../layouts/ClusterReviewModal";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClusterStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:          { label: "Draft",          icon: Clock,       color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  PENDING_REVIEW: { label: "Pending Review", icon: Clock,       color: "#d97706", bg: "rgba(245,158,11,0.10)"  },
  ACTIVE:         { label: "Active",         icon: CheckCircle, color: "#10b981", bg: "rgba(16,185,129,0.10)"  },
  INACTIVE:       { label: "Inactive",       icon: XCircle,     color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
};

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({ icon: Icon, title, onClick, color = "var(--text-sub)" }: {
  icon: React.ElementType; title: string; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick} title={title}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cluster-action-btn flex-shrink-0"
      style={{ color }}
    >
      <Icon size={16} />
    </button>
  );
}

// ── Status-aware action buttons ───────────────────────────────────────────────

function ClusterActions({
  cluster, onEdit, onDelete, onSubmit, onReview,
}: {
  cluster: ClusterResponse;
  onEdit: () => void; onDelete: () => void;
  onSubmit: () => void; onReview: () => void;
}) {
  const { can, isAdmin } = useRole();
  const s = cluster.status;

  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 cluster-actions transition-opacity">
      {s === "DRAFT" && <>
        {can.submit  && <ActionBtn icon={SendHorizonal} title="Submit for review" onClick={onSubmit}  color="#2563eb" />}
        {can.edit    && <ActionBtn icon={Edit2}         title="Edit"              onClick={onEdit}              />}
        {isAdmin     && <ActionBtn icon={Trash2}        title="Delete"            onClick={onDelete}  color="#ef4444" />}
      </>}
      {s === "PENDING_REVIEW" && <>
        {(can.approve || can.reject) && <ActionBtn icon={Eye} title="Review" onClick={onReview} color="#2563eb" />}
      </>}
      {(s === "ACTIVE" || s === "INACTIVE") && <>
        {isAdmin && <ActionBtn icon={Edit2}  title="Edit"   onClick={onEdit}   />}
        {isAdmin && <ActionBtn icon={Trash2} title="Delete" onClick={onDelete} color="#ef4444" />}
      </>}
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({
  cluster, onConfirm, onCancel, submitting,
}: {
  cluster: ClusterResponse;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6"
        style={{ background: "var(--bg-main)" }}
      >
        <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-rose-500" />
        </div>
        <h3 className="text-center font-semibold mb-1" style={{ color: "var(--text-main)", fontSize: "16px" }}>
          Delete Cluster?
        </h3>
        <p className="text-center mb-5" style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          <strong style={{ color: "var(--text-main)" }}>{cluster.clusterName}</strong> and all associated
          rooms will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel} disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-60"
            style={{ fontSize: "14px", fontWeight: 500 }}
          >
            {submitting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ManageCinemaClusterPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const { can, isAdmin } = useRole();
  const navigate = useNavigate();

  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | ClusterStatus>("ALL");

  const [deleteTarget, setDeleteTarget] = useState<ClusterResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<ClusterResponse | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<"create" | "edit">("create");
  const [wizardClusterId, setWizardClusterId] = useState<number | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadClusters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await movieApi.getClusters();
      setClusters(res.result ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load cinema clusters.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClusters(); }, [loadClusters]);

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await movieApi.deleteCluster(deleteTarget.clusterId);
      setClusters((prev) => prev.filter((c) => c.clusterId !== deleteTarget.clusterId));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Delete failed."}`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Workflow handlers ─────────────────────────────────────────────────────

  const doWorkflow = async (fn: () => Promise<{ result: ClusterResponse }>, id: number) => {
    try {
      const res = await fn();
      setClusters((prev) => prev.map((c) => (c.clusterId === id ? res.result : c)));
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Action failed."}`);
    }
  };

  const handleSubmitCluster = (id: number) =>
    doWorkflow(() => movieApi.submitCluster(id), id);

  // Approve/reject go through ClusterReviewModal, which shows its own toast on
  // failure — these must throw (not swallow errors like doWorkflow) for that to work.
  const handleApproveCluster = async (id: number) => {
    const res = await movieApi.approveCluster(id);
    setClusters((prev) => prev.map((c) => (c.clusterId === id ? res.result : c)));
  };

  const handleRejectCluster = async (id: number, note: string) => {
    const res = await movieApi.rejectCluster(id, note);
    setClusters((prev) => prev.map((c) => (c.clusterId === id ? res.result : c)));
  };

  // ── Filtering & stats ─────────────────────────────────────────────────────

  const filtered = clusters.filter((c) => {
    const matchSearch =
      !searchQuery ||
      c.clusterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clusterCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.province.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount  = clusters.filter((c) => c.status === "ACTIVE").length;
  const pendingCount = clusters.filter((c) => c.status === "PENDING_REVIEW").length;
  const totalRooms   = clusters.reduce((s, c) => s + (c.totalRooms ?? 0), 0);
  const totalSeats   = clusters.reduce((s, c) => s + (c.totalSeats ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Cinema Clusters
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage cinema locations and clusters across the country
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Clusters",  value: loading ? "—" : String(clusters.length),     icon: MapPin,      color: "blue"    },
          { label: "Active",          value: loading ? "—" : String(activeCount),          icon: CheckCircle, color: "emerald" },
          { label: "Pending Review",  value: loading ? "—" : String(pendingCount),         icon: Clock,       color: "amber"   },
          { label: "Total Rooms",     value: loading ? "—" : String(totalRooms),           icon: Building2,   color: "violet"  },
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button onClick={loadClusters} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600" style={{ fontSize: "13px" }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search cluster name or province…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none transition-all"
            style={inputStyle}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }}>×</button>
          )}
        </div>

        <button
          onClick={loadClusters} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>

        {can.edit && (
          <button
            onClick={() => { setWizardMode("create"); setWizardClusterId(null); setWizardOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
            style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
          >
            <Plus size={16} /> Add Cluster
          </button>
        )}
      </div>

      {/* Status tabs */}
      {(() => {
        const counts: Record<ClusterStatus, number> = { DRAFT: 0, PENDING_REVIEW: 0, ACTIVE: 0, INACTIVE: 0 };
        clusters.forEach((c) => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
        const pendingCount = counts.PENDING_REVIEW;

        const statuses: ClusterStatus[] = ["DRAFT", "PENDING_REVIEW", "ACTIVE", "INACTIVE"];
        const tabs = [
          { value: "ALL" as const, label: "All", color: "var(--text-sub)" },
          ...statuses.map((value) => ({
            value,
            label: STATUS_CONFIG[value].label,
            color: STATUS_CONFIG[value].color,
          })),
        ];

        return (
          <div className="flex items-center gap-1 mb-5 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0" }}>
            {tabs.map(({ value, label, color }) => {
              const count = value === "ALL" ? clusters.length : counts[value];
              const isActive = filterStatus === value;
              const isPending = value === "PENDING_REVIEW";
              return (
                <button
                  key={value}
                  onClick={() => setFilterStatus(value)}
                  style={{
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? color : "var(--text-sub)",
                    background: "transparent",
                    border: "none",
                    borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "-1px",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-main)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-sub)"; }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      minWidth: "18px", height: "18px", padding: "0 5px",
                      borderRadius: "9px", fontSize: "10px", fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: isActive
                        ? color
                        : (isPending && isAdmin && pendingCount > 0 ? "#ef4444" : "rgba(128,128,128,0.15)"),
                      color: (isActive || (isPending && isAdmin && pendingCount > 0)) ? "#fff" : "var(--text-sub)",
                      transition: "all 0.15s ease",
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["#", "Cluster", "Province", "Address", "Rooms", "Seats", "Status", ""].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && clusters.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading clusters…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  {searchQuery || filterStatus !== "ALL"
                    ? "No clusters match your filters."
                    : "No cinema clusters yet. Add one to get started."}
                </td>
              </tr>
            ) : (
              filtered.map((cluster, idx) => {
                const cfg = STATUS_CONFIG[cluster.status];
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={cluster.clusterId}
                    className="cluster-row border-b transition-colors"
                    style={{ borderColor: "var(--border-color)", cursor: "pointer" }}
                    onClick={() => navigate(`/admin/clusters/${cluster.clusterId}`)}
                  >
                    <td className="px-5 py-4">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{idx + 1}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <MapPin size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{cluster.clusterName}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                            {cluster.clusterCode ?? `Cluster ${cluster.clusterId}`} · {(cluster.venueType ?? "MALL").replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: "rgba(59,130,246,0.08)", color: "#3b82f6" }}
                      >
                        <MapPin size={10} />{cluster.province}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span style={{ fontSize: "13px", color: "var(--text-sub)", maxWidth: "200px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cluster.address}
                        </span>
                        {cluster.latitude != null && cluster.longitude != null && (
                          <span className="inline-flex items-center gap-1 mt-0.5" style={{ fontSize: "10px", color: "#10b981" }}>
                            <MapPin size={8} />
                            {cluster.latitude.toFixed(4)}, {cluster.longitude.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                        <Building2 size={10} />{cluster.totalRooms ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        <Armchair size={10} />{(cluster.totalSeats ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {/* Status badge */}
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                      {/* Rejection note */}
                      {cluster.rejectionNote && (
                        <div className="flex items-start gap-1 mt-1.5 max-w-[160px]">
                          <AlertCircle size={10} style={{ color: "#d97706", flexShrink: 0, marginTop: "1px" }} />
                          <span style={{ fontSize: "10.5px", color: "#d97706", lineHeight: 1.3 }}>
                            {cluster.rejectionNote}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <ClusterActions
                        cluster={cluster}
                        onEdit={() => { setWizardMode("edit"); setWizardClusterId(cluster.clusterId); setWizardOpen(true); }}
                        onDelete={() => setDeleteTarget(cluster)}
                        onSubmit={() => handleSubmitCluster(cluster.clusterId)}
                        onReview={() => setReviewTarget(cluster)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-5 py-3.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> cluster{filtered.length !== 1 ? "s" : ""}
              {filterStatus !== "ALL" && ` · filtered by ${STATUS_CONFIG[filterStatus as ClusterStatus]?.label ?? filterStatus}`}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ClusterWizardModal
        open={wizardOpen}
        mode={wizardMode}
        clusterId={wizardClusterId}
        onClose={() => setWizardOpen(false)}
        onSaved={(saved) => {
          setClusters((prev) => (
            prev.some((c) => c.clusterId === saved.clusterId)
              ? prev.map((c) => (c.clusterId === saved.clusterId ? saved : c))
              : [...prev, saved]
          ));
        }}
      />

      {deleteTarget && (
        <DeleteModal
          cluster={deleteTarget}
         onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          submitting={deleting}
        />
      )}

      <ClusterReviewModal
        open={!!reviewTarget}
        cluster={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onApprove={handleApproveCluster}
        onReject={handleRejectCluster}
      />

      <style>{`
        .cluster-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .cluster-row:hover { background-color: rgba(255,255,255,0.03); }
        .cluster-row:hover .cluster-actions { opacity: 1; }
        .cluster-action-btn:hover { background-color: rgba(128,128,128,0.1); }
      `}</style>
    </>
  );
}
