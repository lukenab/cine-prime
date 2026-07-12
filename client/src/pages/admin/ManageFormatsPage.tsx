import { useState, useEffect, useCallback } from "react";
import { Plus, Search, RefreshCw, AlertCircle, Monitor, Pencil, Trash2, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { movieApi, type ScreeningFormatResponse, type ScreeningFormatRequest } from "../../api/movieApi";

// ── Format code palette ────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "2D":    { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
  "3D":    { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  "IMAX":  { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  "4DX":   { bg: "#fef9c3", text: "#a16207", border: "#fef08a" },
  "4K":    { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  "ATMOS": { bg: "#fdf4ff", text: "#86198f", border: "#f0abfc" },
};

function getFormatStyle(code: string) {
  const key = Object.keys(FORMAT_COLORS).find((k) => code.toUpperCase().includes(k));
  return key ? FORMAT_COLORS[key] : { bg: "#f9fafb", text: "#374151", border: "#e5e7eb" };
}

// ── Modal ──────────────────────────────────────────────────────────────────────

type ModalProps = {
  open: boolean;
  editing: ScreeningFormatResponse | null;
  onClose: () => void;
  onSave: (data: ScreeningFormatRequest, id?: number) => void;
  submitting: boolean;
};

function FormatModal({ open, editing, onClose, onSave, submitting }: ModalProps) {
  const [formatCode, setFormatCode] = useState("");
  const [formatName, setFormatName] = useState("");
  const [description, setDescription] = useState("");
  const [surcharge, setSurcharge] = useState(0);

  useEffect(() => {
    if (open) {
      setFormatCode(editing?.formatCode ?? "");
      setFormatName(editing?.formatName ?? "");
      setDescription(editing?.description ?? "");
      setSurcharge(editing?.surcharge ?? 0);
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
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Monitor size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editing ? "Edit Format" : "New Screening Format"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSave({ formatCode, formatName, description: description || undefined, surcharge }, editing?.formatId); }}
          className="px-6 py-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Format Code <span className="text-rose-500">*</span>
              </label>
              <input
                required type="text" placeholder="e.g. 2D, 3D, IMAX"
                maxLength={20} value={formatCode}
                onChange={(e) => setFormatCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={inputStyle} autoFocus
              />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Surcharge (VND) <span className="text-rose-500">*</span>
              </label>
              <input
                required type="number" min={0} step={1000}
                value={surcharge}
                onChange={(e) => setSurcharge(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Format Name <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. Standard 2D, IMAX Experience"
              maxLength={100} value={formatName}
              onChange={(e) => setFormatName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Description</label>
            <textarea
              rows={2} maxLength={255} placeholder="Optional description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors resize-none"
              style={{ ...inputStyle, lineHeight: 1.5 }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50" style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl text-white transition-colors disabled:opacity-60" style={{ fontSize: "14px", fontWeight: 500, background: "#2563eb" }}>
              {submitting ? "Saving…" : editing ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function formatVND(n: number) {
  return n === 0 ? "No surcharge" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

export default function ManageFormatsPage() {
  useOutletContext<{ isDarkMode: boolean }>();

  const [formats, setFormats] = useState<ScreeningFormatResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScreeningFormatResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScreeningFormatResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await movieApi.getScreeningFormats();
      setFormats(res.result ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load formats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (f: ScreeningFormatResponse) => { setEditing(f); setModalOpen(true); };

  const handleSave = async (data: ScreeningFormatRequest, id?: number) => {
    setSubmitting(true);
    try {
      if (id != null) {
        const res = await movieApi.updateScreeningFormat(id, data);
        setFormats((prev) => prev.map((f) => f.formatId === id ? res.result : f));
      } else {
        const res = await movieApi.createScreeningFormat(data);
        setFormats((prev) => [...prev, res.result]);
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
      await movieApi.deleteScreeningFormat(deleteTarget.formatId);
      setFormats((prev) => prev.filter((f) => f.formatId !== deleteTarget.formatId));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Delete failed."}`);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = formats.filter(
    (f) => !search || f.formatCode.toLowerCase().includes(search.toLowerCase()) || f.formatName.toLowerCase().includes(search.toLowerCase()),
  );

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  return (
    <>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Screening Formats
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage projection formats and their ticket surcharges
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Formats", value: String(formats.length) },
          { label: "Free Formats", value: String(formats.filter((f) => f.surcharge === 0).length) },
          { label: "Highest Surcharge", value: formats.length ? formatVND(Math.max(...formats.map((f) => f.surcharge))) : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Monitor size={20} className="text-blue-600" />
            </div>
            <div>
              <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
              <p style={{ fontSize: value.length > 12 ? "13px" : "24px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{loading ? "—" : value}</p>
            </div>
          </div>
        ))}
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

      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search formats…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={inputStyle}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500" style={{ color: "var(--text-sub)" }}>×</button>}
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50" style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
        </button>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm" style={{ fontSize: "14px", fontWeight: 500, background: "#2563eb" }}>
          <Plus size={16} /> Add Format
        </button>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["Code", "Name", "Surcharge", "Description", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && formats.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-16 text-center"><RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} /><p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading…</p></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>{search ? "No results." : "No formats yet."}</td></tr>
            ) : (
              filtered.map((f) => {
                const style = getFormatStyle(f.formatCode);
                return (
                  <tr key={f.formatId} className="hover-row border-b transition-colors" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold" style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                        {f.formatCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>{f.formatName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span style={{
                        fontSize: "13px", fontWeight: 500,
                        color: f.surcharge === 0 ? "var(--text-sub)" : "#16a34a",
                      }}>
                        {formatVND(f.surcharge)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" style={{ maxWidth: "280px" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{f.description || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(f)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors" style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button onClick={() => setDeleteTarget(f)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors" style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
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
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> format{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6" style={{ background: "var(--bg-main)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>Delete Format?</h3>
            <p style={{ fontSize: "14px", color: "var(--text-sub)", marginBottom: "20px" }}>
              Remove <strong style={{ color: "var(--text-main)" }}>{deleteTarget.formatCode} — {deleteTarget.formatName}</strong>? This cannot be undone.
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

      <FormatModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} onSave={handleSave} submitting={submitting} />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
      `}</style>
    </>
  );
}
