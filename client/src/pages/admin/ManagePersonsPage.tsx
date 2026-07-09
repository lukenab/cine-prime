import { useState, useEffect, useCallback } from "react";
import { Plus, Search, RefreshCw, AlertCircle, Users, Film, X, Edit2, Trash2 } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { movieApi, type PersonResponse, type PersonRequest } from "../../api/movieApi";

// ── Person Modal (create / edit) ──────────────────────────────────────────────

type PersonModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: PersonRequest) => Promise<void>;
  initial?: PersonResponse | null;
  submitting: boolean;
};

function PersonModal({ open, onClose, onSave, initial, submitting }: PersonModalProps) {
  const [form, setForm] = useState<PersonRequest>({ fullName: "" });

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              fullName: initial.fullName,
              nationality: initial.nationality ?? "",
              birthDate: initial.birthDate ?? "",
              photoUrl: initial.photoUrl ?? "",
              biography: initial.biography ?? "",
              tmdbId: initial.tmdbId,
            }
          : { fullName: "" }
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const field = (label: string, key: keyof PersonRequest, opts?: { type?: string; rows?: number }) => (
    <div>
      <label style={{ display: "block", fontSize: "13px", color: "var(--text-sub)", marginBottom: "6px" }}>
        {label}
        {key === "fullName" && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {opts?.rows ? (
        <textarea
          rows={opts.rows}
          value={(form[key] as string) ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors resize-none"
          style={{ fontSize: "14px", background: "var(--bg-main)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
        />
      ) : (
        <input
          type={opts?.type ?? "text"}
          value={(form[key] as string) ?? ""}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              [key]: opts?.type === "number" ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value,
            }))
          }
          required={key === "fullName"}
          className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
          style={{ fontSize: "14px", background: "var(--bg-main)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-main)", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {initial ? "Edit Person" : "Add Person"}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={async (e) => { e.preventDefault(); await onSave(form); }}
          className="px-6 py-5 space-y-4"
        >
          {/* Photo preview */}
          {form.photoUrl && (
            <div className="flex justify-center">
              <img
                src={form.photoUrl}
                alt="Preview"
                className="w-24 h-24 rounded-full object-cover border-2"
                style={{ borderColor: "var(--border-color)" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
          )}

          {field("Full Name", "fullName")}
          {field("Photo URL", "photoUrl")}
          {field("Nationality", "nationality")}
          {field("Birth Date", "birthDate", { type: "date" })}
          {field("Biography", "biography", { rows: 3 })}
          {field("TMDB ID", "tmdbId", { type: "number" })}

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
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ManagePersonsPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [persons, setPersons] = useState<PersonResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<PersonResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<PersonResponse | null>(null);

  const loadPersons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await movieApi.getPersons();
      setPersons(res.result ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load persons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPersons(); }, [loadPersons]);

  const handleSave = async (data: PersonRequest) => {
    setSubmitting(true);
    try {
      if (editPerson) {
        const res = await movieApi.updatePerson(editPerson.personId, data);
        setPersons((prev) => prev.map((p) => p.personId === editPerson.personId ? res.result : p));
      } else {
        const res = await movieApi.createPerson(data);
        setPersons((prev) => [...prev, res.result]);
      }
      setModalOpen(false);
      setEditPerson(null);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Save failed."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (person: PersonResponse) => {
    try {
      await movieApi.deletePerson(person.personId);
      setPersons((prev) => prev.filter((p) => p.personId !== person.personId));
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Delete failed."}`);
    }
  };

  const filtered = persons.filter(
    (p) => !searchQuery || p.fullName.toLowerCase().includes(searchQuery.toLowerCase())
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
          Persons
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage actors, directors, and crew members
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {[
          { label: "Total Persons", value: loading ? "—" : String(persons.length), icon: Users, color: "blue" },
          {
            label: "Most Recent",
            value: loading || persons.length === 0 ? "—" : persons[persons.length - 1].fullName,
            icon: Film,
            color: "violet",
          },
        ].map(({ label, value, icon: Icon, color }) => {
          const bg = color === "blue" ? "bg-blue-50" : "bg-violet-50";
          const ic = color === "blue" ? "text-blue-600" : "text-violet-600";
          return (
            <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={ic} />
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: value.length > 15 ? "14px" : "22px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{value}</p>
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
          <button onClick={loadPersons} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600" style={{ fontSize: "13px" }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search by name…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={inputStyle}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500 text-base" style={{ color: "var(--text-sub)" }}>×</button>
          )}
        </div>
        <button
          onClick={loadPersons} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button
          onClick={() => { setEditPerson(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
        >
          <Plus size={16} /> Add Person
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["Photo", "Name", "Nationality", "Birth Date", "TMDB ID", ""].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && persons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  {searchQuery ? "No persons match your search." : "No persons yet."}
                </td>
              </tr>
            ) : (
              filtered.map((person) => (
                <tr key={person.personId} className="hover-row border-b transition-colors" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-5 py-3">
                    {person.photoUrl ? (
                      <img
                        src={person.photoUrl}
                        alt={person.fullName}
                        className="w-10 h-10 rounded-full object-cover"
                        style={{ border: "1px solid var(--border-color)" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#2563eb" }}>
                          {person.fullName.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ fontSize: "14px", color: "var(--text-main)", fontWeight: 500 }}>{person.fullName}</span>
                    {person.biography && (
                      <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "2px", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {person.biography}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{person.nationality ?? "—"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                      {person.birthDate ? String(person.birthDate) : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span style={{ fontSize: "12px", color: "var(--text-sub)", fontFamily: "monospace" }}>
                      {person.tmdbId ? `#${person.tmdbId}` : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setEditPerson(person); setModalOpen(true); }}
                        className="action-btn w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: "var(--text-sub)" }}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(person)}
                        className="action-btn w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:text-rose-500"
                        style={{ color: "var(--text-sub)" }}
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
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> person{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setDeleteConfirm(null)} />
          <div className="relative rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-main)" }}>
            <p style={{ fontSize: "15px", color: "var(--text-main)", fontWeight: 600, marginBottom: "8px" }}>Delete person?</p>
            <p style={{ fontSize: "13px", color: "var(--text-sub)", marginBottom: "20px" }}>
              "<strong>{deleteConfirm.fullName}</strong>" will be removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border"
                style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <PersonModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPerson(null); }}
        onSave={handleSave}
        initial={editPerson}
        submitting={submitting}
      />

      <style>{`
        .hover-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255,255,255,0.03); }
        .action-btn:hover { background-color: rgba(128,128,128,0.1); color: var(--text-main) !important; }
      `}</style>
    </>
  );
}
