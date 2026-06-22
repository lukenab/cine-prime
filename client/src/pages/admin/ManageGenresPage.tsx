import { useState, useEffect, useCallback } from "react";
import { Plus, Search, RefreshCw, AlertCircle, Tags, Film, Hash, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { movieApi, type TypeResponse, type MovieApiResponse, type CreateTypePayload } from "../../api/movieApi";

// ── Add Genre Modal ───────────────────────────────────────────────────────────

type ModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateTypePayload) => void;
  submitting: boolean;
};

function AddGenreModal({ open, onClose, onSave, submitting }: ModalProps) {
  const [typeName, setTypeName] = useState("");

  useEffect(() => { if (open) setTypeName(""); }, [open]);

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
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-main)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
              <Tags size={16} className="text-violet-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>Add Genre</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); onSave({ typeName }); }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Genre Name <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. Adventure, Documentary"
              minLength={2} maxLength={50}
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
              autoFocus
            />
            <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
              2–50 characters · Must be unique
            </p>
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-60"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {submitting ? "Creating…" : "Create Genre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tag color palette (cycles through genres) ─────────────────────────────────

const TAG_COLORS = [
  { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-100"    },
  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-100"   },
  { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-100"    },
  { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-100"  },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-100"    },
  { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-100"     },
  { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-100"  },
];

function getTagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length];
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ManageGenresPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [types, setTypes] = useState<TypeResponse[]>([]);
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, moviesRes] = await Promise.all([
        movieApi.getTypes(),
        movieApi.getAllMovies(),
      ]);
      setTypes(typesRes.result ?? []);
      setMovies(moviesRes.result ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load genres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (data: CreateTypePayload) => {
    setSubmitting(true);
    try {
      const res = await movieApi.createType(data);
      setTypes((prev) => [...prev, res.result]);
      setModalOpen(false);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Create failed."}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Count how many movies use each genre
  const movieCountByGenre = (typeName: string): number =>
    movies.filter((m) => m.movieType?.includes(typeName)).length;

  const filtered = types.filter((t) =>
    !searchQuery || t.typeName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
          Movie Genres
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage genre categories for movie classification
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Genres", value: loading ? "—" : String(types.length), icon: Tags, color: "violet" },
          { label: "Total Movies", value: loading ? "—" : String(movies.length), icon: Film, color: "blue" },
          {
            label: "Most Used Genre",
            value: loading || types.length === 0 ? "—"
              : types.reduce((best, t) => movieCountByGenre(t.typeName) > movieCountByGenre(best.typeName) ? t : best, types[0])?.typeName ?? "—",
            icon: Hash,
            color: "emerald",
          },
        ].map(({ label, value, icon: Icon, color }) => {
          const bg = color === "violet" ? "bg-violet-50" : color === "blue" ? "bg-blue-50" : "bg-emerald-50";
          const ic = color === "violet" ? "text-violet-600" : color === "blue" ? "text-blue-600" : "text-emerald-600";
          return (
            <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={ic} />
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: value.length > 10 ? "15px" : "24px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{value}</p>
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
          <button onClick={loadData} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600" style={{ fontSize: "13px" }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search genre…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={inputStyle}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500 text-base" style={{ color: "var(--text-sub)" }}>×</button>
          )}
        </div>

        <button
          onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#7c3aed" : "#6d28d9" }}
        >
          <Plus size={16} /> Add Genre
        </button>
      </div>

      {/* Genre grid + table hybrid */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["#", "Genre", "Movies Using This Genre", "ID"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && types.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading genres…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  {searchQuery ? "No genres match your search." : "No genres yet. Add one to get started."}
                </td>
              </tr>
            ) : (
              filtered.map((type, idx) => {
                const count = movieCountByGenre(type.typeName);
                const c = getTagColor(idx);
                return (
                  <tr key={type.typeId} className="hover-row border-b transition-colors" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{idx + 1}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${c.bg} ${c.text} ${c.border}`}>
                        <Tags size={12} />
                        {type.typeName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full bg-blue-200 overflow-hidden"
                          style={{ width: "80px" }}
                        >
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: movies.length > 0 ? `${Math.round((count / movies.length) * 100)}%` : "0%" }}
                          />
                        </div>
                        <span style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500 }}>
                          {count}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                          {count === 1 ? "movie" : "movies"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "12px", color: "var(--text-sub)", fontFamily: "monospace" }}>
                        #{type.typeId}
                      </span>
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
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> genre{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <AddGenreModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        submitting={submitting}
      />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
      `}</style>
    </>
  );
}
