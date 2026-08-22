import { useCallback, useEffect, useState } from "react";
import { Download, Eye, LoaderCircle, Search, ShieldCheck, X } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { auditApi, type AuditEvent } from "../../api/auditApi";

const when = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const human = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^| )\S/g, letter => letter.toUpperCase());

export default function AuditTrailPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AuditEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const page = await auditApi.search({ action: action || undefined, status: status || undefined, actorAccountId: actor || undefined, page: 0, size: 100, sort: "createdAt,desc" });
      setEvents(page.content ?? []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? "Could not load audit events.");
    } finally { setLoading(false); }
  }, [action, actor, status]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    const data = await auditApi.exportCsv({ action: action || undefined, status: status || undefined, actorAccountId: actor || undefined });
    const url = URL.createObjectURL(data as Blob);
    const link = document.createElement("a"); link.href = url; link.download = "auth-audit-events.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="w-full pb-10 text-[var(--text-main)]">
    <AdminPageHeader eyebrow="Security & compliance" title="Audit Trail" description="Review immutable authentication and access-management activity." actions={<button onClick={() => void exportCsv()} className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold"><Download size={16}/> Export CSV</button>} />
    <section className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 md:grid-cols-[1fr_220px_180px_auto]">
      <label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3"><Search size={16} className="text-[var(--text-sub)]"/><input className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" placeholder="Actor account ID" value={actor} onChange={e => setActor(e.target.value)} /></label>
      <input className="rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2.5 text-sm outline-none" placeholder="Action, e.g. LOGIN" value={action} onChange={e => setAction(e.target.value)} />
      <select className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="">All outcomes</option><option value="SUCCESS">Success</option><option value="FAILED">Failed</option></select>
      <button onClick={() => void load()} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Apply</button>
    </section>
    {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">{error}</div>}
    <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--text-sub)]"><LoaderCircle className="animate-spin" size={18}/> Loading audit trail...</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-[var(--border-color)] text-[11px] uppercase tracking-wider text-[var(--text-sub)]"><tr><th className="px-5 py-4">Timestamp</th><th>Action</th><th>Outcome</th><th>Actor</th><th>Target</th><th className="w-16"/></tr></thead><tbody>{events.map(item => <tr key={item.auditId} className="border-b border-[var(--border-color)] last:border-0"><td className="px-5 py-4 whitespace-nowrap">{when(item.createdAt)}</td><td className="font-semibold">{human(item.action)}</td><td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{human(item.status)}</span></td><td className="max-w-44 truncate text-[var(--text-sub)]">{item.actorAccountId ?? "System"}</td><td className="max-w-44 truncate text-[var(--text-sub)]">{item.targetAccountId ?? "—"}</td><td><button aria-label="View audit event" onClick={() => setDetail(item)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-500/10"><Eye size={17}/></button></td></tr>)}</tbody></table></div>}
    </section>
    {detail && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-5" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}><article className="w-full max-w-2xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--border-color)] p-5"><div className="flex items-center gap-3"><ShieldCheck className="text-blue-500"/><div><h2 className="font-bold">{human(detail.action)}</h2><p className="text-xs text-[var(--text-sub)]">{detail.auditId}</p></div></div><button onClick={() => setDetail(null)}><X size={18}/></button></header><dl className="grid gap-4 p-5 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase text-[var(--text-sub)]">Actor</dt><dd className="mt-1 break-all">{detail.actorAccountId ?? "System"}</dd></div><div><dt className="text-xs uppercase text-[var(--text-sub)]">Target</dt><dd className="mt-1 break-all">{detail.targetAccountId ?? "—"}</dd></div><div><dt className="text-xs uppercase text-[var(--text-sub)]">IP address</dt><dd className="mt-1">{detail.ipAddress ?? "—"}</dd></div><div><dt className="text-xs uppercase text-[var(--text-sub)]">Timestamp</dt><dd className="mt-1">{when(detail.createdAt)}</dd></div><div className="sm:col-span-2"><dt className="text-xs uppercase text-[var(--text-sub)]">Message</dt><dd className="mt-1">{detail.message ?? "—"}</dd></div><div className="sm:col-span-2"><dt className="text-xs uppercase text-[var(--text-sub)]">Metadata</dt><dd><pre className="mt-2 max-h-52 overflow-auto rounded-xl bg-black/10 p-3 text-xs whitespace-pre-wrap">{detail.metadata ?? "{}"}</pre></dd></div></dl></article></div>}
  </main>;
}
