import { useState, useEffect, useCallback } from "react";
import { Plus, Search, RefreshCw, AlertCircle, ShieldCheck, Pencil, Trash2, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { movieApi, type AgeRatingResponse, type AgeRatingRequest } from "../../api/movieApi";

// ── Rating badge color map ─────────────────────────────────────────────────────

const RATING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  G:     { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  PG:    { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  "PG-13": { bg: "#fefce8", text: "#b45309", border: "#fde68a" },
  R:     { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  "NC-17": { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  T:     { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  T13:   { bg: "#fefce8", text: "#b45309", border: "#fde68a" },
  T16:   { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  T18:   { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  K:     { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
};

function getRatingStyle(code: string) {
  return RATING_COLORS[code] ?? { bg: "#f9fafb", text: "#374151", border: "#e5e7eb" };
}

// ── Modal ──────────────────────────────────────────────────────────────────────

type ModalProps = {
  open: boolean;
  editing: AgeRatingResponse | null;
  onClose: () => void;
  onSave: (data: AgeRatingRequest, id?: number) => void;
  submitting: boolean;
};

function AgeRatingModal({ open, editing, onClose, onSave, submitting }: ModalProps) {
  const [ratingCode, setRatingCode] = useState("");
  const [minAge, setMinAge] = useState(0);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setRatingCode(editing?.ratingCode ?? "");
      setMinAge(editing?.minAge ?? 0);
      setDescription(editing?.description ?? "");
    }
  }, [open, editing]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--bg-main)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <ShieldCheck size={16} className="text-amber-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editing ? "Edit Age Rating" : "New Age Rating"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSave({ ratingCode, minAge, description }, editing?.ratingId); }}
          className="px-6 py-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Rating Code <span className="text-rose-500">*</span>
              </label>
              <input
                required type="text" placeholder="e.g. PG-13, T16"
                maxLength={5} value={ratingCode}
                onChange={(e) => setRatingCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-amber-400 transition-colors"
                style={inputStyle} autoFocus
              />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Minimum Age <span className="text-rose-500">*</span>
              </label>
              <input
                required type="number" min={0} max={21}
                value={minAge}
                onChange={(e) => setMinAge(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-amber-400 transition-colors"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required maxLength={255} rows={3}
              placeholder="Suitable for audiences age…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-amber-400 transition-colors resize-none"
              style={{ ...inputStyle, lineHeight: 1.5 }}
            />
            <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>{description.length}/255</p>
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
              className="flex-1 px-4 py-2.5 rounded-xl text-white transition-colors disabled:opacity-60"
              style={{ fontSize: "14px", fontWeight: 500, background: "#d97706" }}
            >
              {submitting ? "Saving…" : editing ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ManageAgeRatingsPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [ratings, setRatings] = useState<AgeRatingResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgeRatingResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgeRatingResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await movieApi.getAgeRatings();
      setRatings(res.result ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load age ratings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: AgeRatingResponse) => { setEditing(r); setModalOpen(true); };

  const handleSave = async (data: AgeRatingRequest, id?: number) => {
    setSubmitting(true);
    try {
      if (id != null) {
        const res = await movieApi.updateAgeRating(id, data);
        setRatings((prev) => prev.map((r) => r.ratingId === id ? res.result : r));
      } else {
        const res = await movieApi.createAgeRating(data);
        setRatings((prev) => [...prev, res.result]);
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
      await movieApi.deleteAgeRating(deleteTarget.ratingId);
      setRatings((prev) => prev.filter((r) => r.ratingId !== deleteTarget.ratingId));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Delete failed."}`);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = ratings.filter(
    (r) => !search || r.ratingCode.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()),
  );

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
          Age Ratings
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage content rating codes shown on movies
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Ratings", value: String(ratings.length), color: "amber" },
          { label: "Lowest Min Age", value: ratings.length ? String(Math.min(...ratings.map((r) => r.minAge))) + " yrs" : "—", color: "green" },
          { label: "Highest Min Age", value: ratings.length ? String(Math.max(...ratings.map((r) => r.minAge))) + " yrs" : "—", color: "red" },
        ].map(({ label, value, color }) => {
          const bg = color === "amber" ? "bg-amber-50" : color === "green" ? "bg-green-50" : "bg-rose-50";
          const ic = color === "amber" ? "#d97706" : color === "green" ? "#16a34a" : "#dc2626";
          return (
            <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <ShieldCheck size={20} style={{ color: ic }} />
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{loading ? "—" : value}</p>
              </div>
            </div>
          );
        })}
      </div>

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
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search ratings…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
            style={inputStyle}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500" style={{ color: "var(--text-sub)" }}>×</button>
          )}
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50" style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
        </button>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm" style={{ fontSize: "14px", fontWeight: 500, background: "#d97706" }}>
          <Plus size={16} /> Add Rating
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["Code", "Min Age", "Description", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && ratings.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-16 text-center"><RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} /><p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading…</p></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>{search ? "No results." : "No age ratings yet."}</td></tr>
            ) : (
              filtered.map((r) => {
                const style = getRatingStyle(r.ratingCode);
                return (
                  <tr key={r.ratingId} className="hover-row border-b transition-colors" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold" style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                        {r.ratingCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{r.minAge}+</span>
                    </td>
                    <td className="px-5 py-3.5" style={{ maxWidth: "420px" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-sub)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {r.description}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(r)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors" style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button onClick={() => setDeleteTarget(r)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors" style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
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
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> rating{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6" style={{ background: "var(--bg-main)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>Delete Age Rating?</h3>
            <p style={{ fontSize: "14px", color: "var(--text-sub)", marginBottom: "20px" }}>
              Remove <strong style={{ color: "var(--text-main)" }}>{deleteTarget.ratingCode}</strong>? This cannot be undone and may affect movies using this rating.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50" style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-60" style={{ fontSize: "14px", fontWeight: 500 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AgeRatingModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        submitting={submitting}
      />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
      `}</style>
    </>
  );
}
