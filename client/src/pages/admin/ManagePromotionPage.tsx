import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Pause, Pencil, Play, Plus, RefreshCw, Search, Tag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { promotionApi, type PromotionSummary, type PromotionStatus } from "../../api/promotionApi";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function discountLabel(promotion: PromotionSummary) {
  return promotion.priceRule.discountType === "PERCENTAGE"
    ? `${promotion.priceRule.percentage ?? 0}%`
    : money.format(promotion.priceRule.fixedAmount ?? 0);
}

function statusStyle(status: PromotionStatus) {
  const styles: Record<PromotionStatus, { label: string; color: string; bg: string }> = {
    DRAFT: { label: "Draft", color: "#64748b", bg: "rgba(100,116,139,.12)" },
    ACTIVE: { label: "Active", color: "#059669", bg: "rgba(16,185,129,.12)" },
    PAUSED: { label: "Paused", color: "#d97706", bg: "rgba(245,158,11,.12)" },
    ARCHIVED: { label: "Archived", color: "#94a3b8", bg: "rgba(148,163,184,.12)" },
  };
  return styles[status];
}

export default function ManagePromotionPage() {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState<PromotionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<PromotionStatus | "">("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [counts, setCounts] = useState({ total: 0, active: 0, draft: 0, paused: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadPromotions = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await promotionApi.list({
        status: status || undefined,
        query: debouncedQuery || undefined,
        page,
        size: 20,
      });
      if (requestId !== requestSequence.current) return;
      setPromotions(result.content ?? []);
      setTotalPages(result.totalPages ?? 0);
      setTotalElements(result.totalElements ?? 0);
      setCounts(result.counts ?? { total: 0, active: 0, draft: 0, paused: 0, archived: 0 });
    } catch {
      if (requestId !== requestSequence.current) return;
      setError("Could not load promotions. Check promotion-service and try again.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [debouncedQuery, page, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => { void loadPromotions(); }, [loadPromotions]);

  const changeStatus = async (promotion: PromotionSummary, action: "activate" | "pause" | "retire") => {
    setWorkingId(promotion.promotionId);
    setError("");
    try {
      await promotionApi[action](promotion.promotionId);
      await loadPromotions();
    } catch {
      setError(`Could not ${action} ${promotion.code}. Refresh and try again.`);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-500">Commercial</p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-main)" }}>Promotions</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-sub)" }}>Create offers, control lifecycle and protect redemption quotas.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Total', counts.total], ['Active', counts.active], ['Draft', counts.draft], ['Paused', counts.paused]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p className="text-xs" style={{ color: "var(--text-sub)" }}>{label}</p>
            <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-main)" }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-[280px] flex-1">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search promotion name or code..." className="h-11 w-full rounded-xl border bg-transparent pl-11 pr-4 text-sm outline-none focus:border-blue-500" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }} />
        </label>
        <select value={status} onChange={(event) => { setStatus(event.target.value as PromotionStatus | ""); setPage(0); }} className="h-11 rounded-xl border px-4 text-sm outline-none" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="ARCHIVED">Archived</option>
        </select>
        <button onClick={() => void loadPromotions()} className="flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}><RefreshCw size={16} /> Refresh</button>
        <button onClick={() => navigate("/admin/promotions/create")} className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17} /> Create promotion</button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

      <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)", borderColor: "var(--border-color)" }}><tr><th className="px-5 py-4">Promotion</th><th className="px-5 py-4">Benefit</th><th className="px-5 py-4">Valid window</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-sub)" }}>Loading promotions...</td></tr> : promotions.length === 0 ? <tr><td colSpan={5} className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-sub)" }}>No promotions found.</td></tr> : promotions.map((promotion) => {
                const badge = statusStyle(promotion.status);
                const working = workingId === promotion.promotionId;
                return <tr key={promotion.promotionId} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><Tag size={18} /></span><div><p className="font-medium" style={{ color: "var(--text-main)" }}>{promotion.name}</p><p className="text-xs" style={{ color: "var(--text-sub)" }}>{promotion.code}</p></div></div></td>
                  <td className="px-5 py-4"><p className="font-semibold text-blue-500">{discountLabel(promotion)}</p><p className="text-xs" style={{ color: "var(--text-sub)" }}>Min. {money.format(promotion.priceRule.minimumOrderAmount)}</p></td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-main)" }}>{promotion.validFrom ? new Date(promotion.validFrom).toLocaleDateString("vi-VN") : "Immediately"}<span style={{ color: "var(--text-sub)" }}> – </span>{promotion.validUntil ? new Date(promotion.validUntil).toLocaleDateString("vi-VN") : "No expiry"}</td>
                  <td className="px-5 py-4"><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-1">
                    <button title="View" onClick={() => navigate(`/admin/promotions/${promotion.promotionId}`)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-500/10"><Eye size={17} /></button>
                    {promotion.status === "DRAFT" && <button title="Edit" onClick={() => navigate(`/admin/promotions/edit/${promotion.promotionId}`)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-500/10"><Pencil size={17} /></button>}
                    {(promotion.status === "DRAFT" || promotion.status === "PAUSED") && <button disabled={working} title="Activate" onClick={() => void changeStatus(promotion, "activate")} className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40"><Play size={17} /></button>}
                    {promotion.status === "ACTIVE" && <button disabled={working} title="Pause" onClick={() => void changeStatus(promotion, "pause")} className="rounded-lg p-2 text-amber-500 hover:bg-amber-500/10 disabled:opacity-40"><Pause size={17} /></button>}
                    {promotion.status !== "ARCHIVED" && <button disabled={working} title="Archive" onClick={() => void changeStatus(promotion, "retire")} className="rounded-lg p-2 text-red-500 hover:bg-red-500/10 disabled:opacity-40"><Trash2 size={17} /></button>}
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 text-sm" style={{ color: "var(--text-sub)" }}>
          <span>{totalElements} promotions</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>
            <span>Page {page + 1} of {totalPages}</span>
            <button
              type="button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
