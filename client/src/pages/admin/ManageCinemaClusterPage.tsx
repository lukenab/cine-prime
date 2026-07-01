import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, RefreshCw, AlertCircle, MapPin, Building2,
  Armchair, X, Edit2, Trash2, Phone, CheckCircle, XCircle,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
import {
  movieApi,
  type ClusterResponse,
  type CreateClusterPayload,
  type ClusterStatus,
} from "../../api/movieApi";

// ── Provinces list ────────────────────────────────────────────────────────────

const PROVINCES = [
  "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Hải Phòng",
  "Biên Hòa", "Nha Trang", "Huế", "Vũng Tàu", "Quy Nhơn",
  "Bình Dương", "Long An", "Đồng Nai", "Bà Rịa - Vũng Tàu",
  "Thanh Hóa", "Nghệ An", "Bình Định", "Khánh Hòa", "Lâm Đồng",
  "Khác",
];

// ── Cluster Modal ─────────────────────────────────────────────────────────────

type ModalMode = "create" | "edit";

type ClusterModalProps = {
  open: boolean;
  mode: ModalMode;
  initial?: ClusterResponse | null;
  onClose: () => void;
  onSave: (data: CreateClusterPayload, id?: number) => Promise<void>;
  submitting: boolean;
};

const emptyForm: CreateClusterPayload = {
  clusterName: "",
  province: "",
  address: "",
  phoneNumber: "",
  status: "ACTIVE",
};

function ClusterModal({ open, mode, initial, onClose, onSave, submitting }: ClusterModalProps) {
  const [form, setForm] = useState<CreateClusterPayload>(emptyForm);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              clusterName: initial.clusterName,
              province: initial.province,
              address: initial.address,
              phoneNumber: initial.phoneNumber ?? "",
              status: initial.status,
            }
          : emptyForm,
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form, initial?.clusterId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-main)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {mode === "create" ? "Add Cinema Cluster" : "Edit Cinema Cluster"}
            </h2>
          </div>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Cluster Name <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. CinePrime Hà Nội"
              minLength={2} maxLength={100}
              value={form.clusterName}
              onChange={(e) => setForm({ ...form, clusterName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Province / City <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={inputStyle}
              >
                <option value="">Select province…</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Phone Number
              </label>
              <input
                type="tel" placeholder="028 xxxx xxxx"
                value={form.phoneNumber ?? ""}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Address <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. 123 Nguyễn Huệ, Quận 1"
              maxLength={255}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block mb-2" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Status</label>
            <div className="flex gap-3">
              {(["ACTIVE", "INACTIVE"] as ClusterStatus[]).map((s) => {
                const active = form.status === s;
                const color = s === "ACTIVE" ? "#10b981" : "#ef4444";
                return (
                  <button
                    key={s} type="button"
                    onClick={() => setForm({ ...form, status: s })}
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: "10px",
                      border: `1.5px solid ${active ? color : "var(--border-color)"}`,
                      background: active ? `${color}14` : "var(--bg-main)",
                      cursor: "pointer", transition: "all 0.15s ease",
                      fontSize: "13px", fontWeight: 600,
                      color: active ? color : "var(--text-sub)",
                    }}
                  >
                    {s === "ACTIVE" ? "Active" : "Inactive"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {submitting ? "Saving…" : mode === "create" ? "Create Cluster" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
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

  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | ClusterStatus>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editTarget, setEditTarget] = useState<ClusterResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClusterResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadClusters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await movieApi.getClusters();
      setClusters(res.result ?? []);
    } catch (err: any) {
      // Backend chưa có — hiển thị mock data để demo UI
      if (err?.response?.status === 404 || err?.code === "ERR_NETWORK") {
        setClusters(MOCK_CLUSTERS);
      } else {
        setError(err?.response?.data?.message ?? "Failed to load cinema clusters.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClusters(); }, [loadClusters]);

  const handleSave = async (data: CreateClusterPayload, id?: number) => {
    setSubmitting(true);
    try {
      if (id !== undefined) {
        const res = await movieApi.updateCluster(id, data);
        setClusters((prev) => prev.map((c) => (c.clusterId === id ? res.result : c)));
      } else {
        const res = await movieApi.createCluster(data);
        setClusters((prev) => [...prev, res.result]);
      }
      setModalOpen(false);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Save failed."}`);
    } finally {
      setSubmitting(false);
    }
  };

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

  const openCreate = () => {
    setEditTarget(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = (cluster: ClusterResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(cluster);
    setModalMode("edit");
    setModalOpen(true);
  };

  const filtered = clusters.filter((c) => {
    const matchSearch =
      !searchQuery ||
      c.clusterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.province.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount = clusters.filter((c) => c.status === "ACTIVE").length;
  const totalRooms = clusters.reduce((s, c) => s + (c.totalRooms ?? 0), 0);
  const totalSeats = clusters.reduce((s, c) => s + (c.totalSeats ?? 0), 0);

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
          { label: "Total Clusters",  value: loading ? "—" : String(clusters.length),          icon: MapPin,     color: "blue"    },
          { label: "Active",          value: loading ? "—" : String(activeCount),              icon: CheckCircle, color: "emerald" },
          { label: "Total Rooms",     value: loading ? "—" : String(totalRooms),               icon: Building2,  color: "violet"  },
          { label: "Total Seats",     value: loading ? "—" : totalSeats.toLocaleString(),      icon: Armchair,   color: "amber"   },
        ].map(({ label, value, icon: Icon, color }) => {
          const bg  = { blue: "bg-blue-50",    emerald: "bg-emerald-50", violet: "bg-violet-50",  amber: "bg-amber-50"  }[color];
          const ic  = { blue: "text-blue-600", emerald: "text-emerald-600", violet: "text-violet-600", amber: "text-amber-600" }[color];
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
        {/* Search */}
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

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3.5 py-2.5 rounded-xl border outline-none transition-all"
          style={{ ...inputStyle, minWidth: "130px" }}
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <button
          onClick={loadClusters} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
        >
          <Plus size={16} /> Add Cluster
        </button>
      </div>

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
              filtered.map((cluster, idx) => (
                <tr
                  key={cluster.clusterId}
                  className="cluster-row border-b transition-colors"
                  style={{ borderColor: "var(--border-color)" }}
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
                        {cluster.phoneNumber && (
                          <p className="flex items-center gap-1" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                            <Phone size={10} />{cluster.phoneNumber}
                          </p>
                        )}
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
                    <span style={{ fontSize: "13px", color: "var(--text-sub)", maxWidth: "200px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cluster.address}
                    </span>
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
                    {cluster.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                        <CheckCircle size={11} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600">
                        <XCircle size={11} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 opacity-0 cluster-actions transition-opacity">
                      <button
                        onClick={(e) => openEdit(cluster, e)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors"
                        style={{ color: "#3b82f6" }}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(cluster); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-rose-50 transition-colors"
                        style={{ color: "#ef4444" }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-5 py-3.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> cluster{filtered.length !== 1 ? "s" : ""}
              {filterStatus !== "ALL" && ` · filtered by ${filterStatus.toLowerCase()}`}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ClusterModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        submitting={submitting}
      />

      {deleteTarget && (
        <DeleteModal
          cluster={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          submitting={deleting}
        />
      )}

      <style>{`
        .cluster-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .cluster-row:hover { background-color: rgba(255,255,255,0.03); }
        .cluster-row:hover .cluster-actions { opacity: 1; }
      `}</style>
    </>
  );
}

// ── Mock data (dùng khi backend chưa có /api/cinema-clusters) ─────────────────

const MOCK_CLUSTERS: ClusterResponse[] = [
  { clusterId: 1, clusterName: "CinePrime Quận 1",     province: "TP. Hồ Chí Minh", address: "123 Nguyễn Huệ, Quận 1",          phoneNumber: "028 3822 1234", status: "ACTIVE",   totalRooms: 5,  totalSeats: 650  },
  { clusterId: 2, clusterName: "CinePrime Thủ Đức",    province: "TP. Hồ Chí Minh", address: "456 Võ Văn Ngân, TP. Thủ Đức",   phoneNumber: "028 3896 5678", status: "ACTIVE",   totalRooms: 4,  totalSeats: 480  },
  { clusterId: 3, clusterName: "CinePrime Hoàn Kiếm",  province: "Hà Nội",           address: "78 Hàng Bài, Hoàn Kiếm",         phoneNumber: "024 3936 9012", status: "ACTIVE",   totalRooms: 6,  totalSeats: 820  },
  { clusterId: 4, clusterName: "CinePrime Cầu Giấy",   province: "Hà Nội",           address: "22 Xuân Thủy, Cầu Giấy",         phoneNumber: "024 3768 3456", status: "ACTIVE",   totalRooms: 4,  totalSeats: 510  },
  { clusterId: 5, clusterName: "CinePrime Hải Châu",   province: "Đà Nẵng",          address: "30 Trần Phú, Hải Châu",          phoneNumber: "0236 382 7890", status: "ACTIVE",   totalRooms: 3,  totalSeats: 360  },
  { clusterId: 6, clusterName: "CinePrime Ninh Kiều",  province: "Cần Thơ",          address: "15 Hai Bà Trưng, Ninh Kiều",     phoneNumber: "0292 381 2345", status: "INACTIVE", totalRooms: 2,  totalSeats: 220  },
];
