import { useState, useEffect, useCallback } from "react";
import { Plus, Search, RefreshCw, AlertCircle, Factory, Pencil, Trash2, X, Globe, Building } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { movieApi, type ProductionCompanyResponse, type ProductionCompanyRequest } from "../../api/movieApi";
import { getApiErrorMessage, notify } from "../../lib/notifications";

// ── Modal ──────────────────────────────────────────────────────────────────────

type ModalProps = {
  open: boolean;
  editing: ProductionCompanyResponse | null;
  onClose: () => void;
  onSave: (data: ProductionCompanyRequest, id?: number) => void;
  submitting: boolean;
};

function CompanyModal({ open, editing, onClose, onSave, submitting }: ModalProps) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setCountry(editing?.country ?? "");
      setLogoUrl(editing?.logoUrl ?? "");
      setWebsiteUrl(editing?.websiteUrl ?? "");
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
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Factory size={16} className="text-emerald-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editing ? "Edit Company" : "New Production Company"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              name,
              country: country || undefined,
              logoUrl: logoUrl || undefined,
              websiteUrl: websiteUrl || undefined,
            }, editing?.companyId);
          }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. Warner Bros., Marvel Studios"
              maxLength={150} value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-emerald-400 transition-colors"
              style={inputStyle} autoFocus
            />
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Country</label>
            <input
              type="text" placeholder="e.g. United States, South Korea"
              maxLength={100} value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-emerald-400 transition-colors"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Logo URL</label>
            <input
              type="url" placeholder="https://…"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-emerald-400 transition-colors"
              style={inputStyle}
            />
            {logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={logoUrl} alt="preview" className="h-8 w-8 object-contain rounded border" style={{ borderColor: "var(--border-color)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>Logo preview</span>
              </div>
            )}
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Website URL</label>
            <input
              type="url" placeholder="https://…"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-emerald-400 transition-colors"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50" style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl text-white transition-colors disabled:opacity-60" style={{ fontSize: "14px", fontWeight: 500, background: "#059669" }}>
              {submitting ? "Saving…" : editing ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Logo avatar ────────────────────────────────────────────────────────────────

function CompanyLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl} alt={name}
        onError={() => setFailed(true)}
        className="w-9 h-9 rounded-lg object-contain border flex-shrink-0"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}
      />
    );
  }
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: "rgba(5,150,105,0.1)", color: "#059669", border: "1px solid rgba(5,150,105,0.2)" }}>
      {initials}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ManageCompaniesPage() {
  useOutletContext<{ isDarkMode: boolean }>();

  const [companies, setCompanies] = useState<ProductionCompanyResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionCompanyResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductionCompanyResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await movieApi.searchCompanies(search || undefined);
      setCompanies(res.result ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load companies.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Load on mount, not on every search keystroke — user can click Refresh or press Enter
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: ProductionCompanyResponse) => { setEditing(c); setModalOpen(true); };

  const handleSave = async (data: ProductionCompanyRequest, id?: number) => {
    setSubmitting(true);
    try {
      if (id != null) {
        const res = await movieApi.updateCompany(id, data);
        setCompanies((prev) => prev.map((c) => c.companyId === id ? res.result : c));
      } else {
        const res = await movieApi.createCompany(data);
        setCompanies((prev) => [...prev, res.result]);
      }
      setModalOpen(false);
      notify.success(id != null ? "Company updated" : "Company created");
    } catch (err: any) {
      notify.error("Company could not be saved", getApiErrorMessage(err, "Review the values and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await movieApi.deleteCompany(deleteTarget.companyId);
      setCompanies((prev) => prev.filter((c) => c.companyId !== deleteTarget.companyId));
      setDeleteTarget(null);
      notify.success("Company removed");
    } catch (err: any) {
      notify.error("Company could not be removed", getApiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // Local filter by name/country for instant feedback
  const filtered = companies.filter(
    (c) => !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.country ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // Unique countries for stat
  const countries = [...new Set(companies.map((c) => c.country).filter(Boolean))];

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
          Production Companies
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage film studios and production companies
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Companies", value: String(companies.length), Icon: Factory },
          { label: "Countries", value: String(countries.length), Icon: Globe },
          { label: "With Website", value: String(companies.filter((c) => c.websiteUrl).length), Icon: Building },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Icon size={20} className="text-emerald-600" />
            </div>
            <div>
              <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
              <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{loading ? "—" : value}</p>
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
            type="text" placeholder="Search by name or country…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            style={inputStyle}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500" style={{ color: "var(--text-sub)" }}>×</button>}
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50" style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
        </button>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm" style={{ fontSize: "14px", fontWeight: 500, background: "#059669" }}>
          <Plus size={16} /> Add Company
        </button>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["Company", "Country", "Website", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && companies.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-16 text-center"><RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} /><p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading…</p></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>{search ? "No companies match." : "No companies yet."}</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.companyId} className="hover-row border-b transition-colors" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>{c.name}</p>
                        <p style={{ fontSize: "11px", color: "var(--text-sub)", fontFamily: "monospace" }}>#{c.companyId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {c.country ? (
                      <span style={{ fontSize: "13px", color: "var(--text-main)" }}>{c.country}</span>
                    ) : (
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.websiteUrl ? (
                      <a href={c.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:underline" style={{ fontSize: "13px", color: "#2563eb" }}>
                        <Globe size={12} />
                        {new URL(c.websiteUrl).hostname.replace(/^www\./, "")}
                      </a>
                    ) : (
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors" style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors" style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                        <Trash2 size={14} /> Delete
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
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> compan{filtered.length !== 1 ? "ies" : "y"}
            </p>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6" style={{ background: "var(--bg-main)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>Delete Company?</h3>
            <p style={{ fontSize: "14px", color: "var(--text-sub)", marginBottom: "20px" }}>
              Remove <strong style={{ color: "var(--text-main)" }}>{deleteTarget.name}</strong>? This cannot be undone and may affect movies linked to this company.
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

      <CompanyModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} onSave={handleSave} submitting={submitting} />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
      `}</style>
    </>
  );
}
