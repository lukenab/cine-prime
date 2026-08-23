import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, CheckCircle2, ChevronLeft, ChevronRight, Eye, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Send, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { promotionApi, type PromotionSummary, type PromotionStatus } from "../../api/promotionApi";
import { useAuth } from "../../context/AuthContext";
import { PromotionWorkflowDialog, type PromotionWorkflowAction } from "../../components/admin/PromotionWorkflowDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const emptyCounts = { total: 0, draft: 0, pendingApproval: 0, approved: 0, rejected: 0, active: 0, paused: 0, archived: 0 };

function discountLabel(promotion: PromotionSummary) {
  return promotion.priceRule.discountType === "PERCENTAGE" ? `${promotion.priceRule.percentage ?? 0}%` : money.format(promotion.priceRule.fixedAmount ?? 0);
}

function statusStyle(status: PromotionStatus) {
  const styles: Record<PromotionStatus, { label: string; color: string; bg: string }> = {
    DRAFT: { label: "Draft", color: "#64748b", bg: "rgba(100,116,139,.12)" },
    PENDING_APPROVAL: { label: "Awaiting approval", color: "#d97706", bg: "rgba(245,158,11,.12)" },
    APPROVED: { label: "Approved", color: "#2563eb", bg: "rgba(37,99,235,.12)" },
    REJECTED: { label: "Changes requested", color: "#dc2626", bg: "rgba(220,38,38,.10)" },
    ACTIVE: { label: "Live", color: "#059669", bg: "rgba(16,185,129,.12)" },
    PAUSED: { label: "Paused", color: "#d97706", bg: "rgba(245,158,11,.12)" },
    ARCHIVED: { label: "Archived", color: "#94a3b8", bg: "rgba(148,163,184,.12)" },
  };
  return styles[status];
}

export default function ManagePromotionPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [promotions, setPromotions] = useState<PromotionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<PromotionStatus | "">("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [counts, setCounts] = useState(emptyCounts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ promotion: PromotionSummary; action: PromotionWorkflowAction } | null>(null);
  const requestSequence = useRef(0);

  const loadPromotions = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await promotionApi.list({ status: status || undefined, query: debouncedQuery || undefined, page, size: 20 });
      if (requestId !== requestSequence.current) return;
      setPromotions(result.content ?? []);
      setTotalPages(result.totalPages ?? 0);
      setTotalElements(result.totalElements ?? 0);
      setCounts(result.counts ?? emptyCounts);
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

  const runAction = async (note: string) => {
    if (!pendingAction) return;
    const { promotion, action } = pendingAction;
    setWorkingId(promotion.promotionId);
    setError("");
    try {
      if (action === "submit") await promotionApi.submit(promotion.promotionId, note);
      else if (action === "approve") await promotionApi.approve(promotion.promotionId, note);
      else if (action === "reject") await promotionApi.reject(promotion.promotionId, note);
      else if (action === "activate") await promotionApi.activate(promotion.promotionId);
      else if (action === "pause") await promotionApi.pause(promotion.promotionId, note);
      else await promotionApi.archive(promotion.promotionId, note);
      setPendingAction(null);
      await loadPromotions();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? `Could not ${action} ${promotion.code}. Refresh and try again.`);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-500">Commercial</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-main)" }}>Promotions</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-sub)" }}>Create offers, govern approvals and protect redemption quotas.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Draft & returned", counts.draft + counts.rejected], ["Awaiting approval", counts.pendingApproval], ["Ready to launch", counts.approved], ["Live", counts.active]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p className="text-xs" style={{ color: "var(--text-sub)" }}>{label}</p>
            <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-main)" }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-[280px] flex-1">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search promotion name or code..." className="h-11 w-full rounded-xl border pl-11 pr-4 text-sm outline-none focus:border-blue-500" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }} />
        </label>
        <select value={status} onChange={(event) => { setStatus(event.target.value as PromotionStatus | ""); setPage(0); }} className="h-11 rounded-xl border px-4 text-sm outline-none" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <option value="">All statuses</option>
          {(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ACTIVE", "PAUSED", "ARCHIVED"] as PromotionStatus[]).map(value => <option key={value} value={value}>{statusStyle(value).label}</option>)}
        </select>
        <button onClick={() => void loadPromotions()} className="flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}><RefreshCw size={16} /> Refresh</button>
        {hasPermission("PROMOTION_CREATE") && <button onClick={() => navigate("/admin/promotions/create")} className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17} /> Create promotion</button>}
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

      <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)", borderColor: "var(--border-color)" }}><tr><th className="px-5 py-4">Promotion</th><th className="px-5 py-4">Benefit</th><th className="px-5 py-4">Valid window</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-sub)" }}>Loading promotions...</td></tr> : promotions.length === 0 ? <tr><td colSpan={5} className="px-5 py-16 text-center text-sm" style={{ color: "var(--text-sub)" }}>No promotions found.</td></tr> : promotions.map((promotion) => {
                const badge = statusStyle(promotion.status);
                const editable = ["DRAFT", "REJECTED"].includes(promotion.status) && hasPermission("PROMOTION_UPDATE");
                const canSubmit = ["DRAFT", "REJECTED"].includes(promotion.status) && hasPermission("PROMOTION_SUBMIT");
                const canDecide = promotion.status === "PENDING_APPROVAL" && hasPermission("PROMOTION_APPROVE");
                const canActivate = ["APPROVED", "PAUSED"].includes(promotion.status) && hasPermission("PROMOTION_ACTIVATE");
                const canPause = promotion.status === "ACTIVE" && hasPermission("PROMOTION_PAUSE");
                const canArchive = !["PENDING_APPROVAL", "ARCHIVED"].includes(promotion.status) && hasPermission("PROMOTION_ARCHIVE");
                const hasWorkflowAction = editable || canSubmit || canDecide || canActivate || canPause || canArchive;
                return <tr key={promotion.promotionId} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><Tag size={18} /></span><div><p className="font-medium" style={{ color: "var(--text-main)" }}>{promotion.name}</p><p className="text-xs" style={{ color: "var(--text-sub)" }}>{promotion.code}</p></div></div></td>
                  <td className="px-5 py-4"><p className="font-semibold text-blue-500">{discountLabel(promotion)}</p><p className="text-xs" style={{ color: "var(--text-sub)" }}>Min. {money.format(promotion.priceRule.minimumOrderAmount)}</p></td>
                  <td className="px-5 py-4 text-sm" style={{ color: "var(--text-main)" }}>{promotion.validFrom ? new Date(promotion.validFrom).toLocaleDateString("vi-VN") : "Immediately"}<span style={{ color: "var(--text-sub)" }}> – </span>{promotion.validUntil ? new Date(promotion.validUntil).toLocaleDateString("vi-VN") : "No expiry"}</td>
                  <td className="px-5 py-4"><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-1">
                    <button type="button" title="View details" aria-label={`View ${promotion.name}`} onClick={() => navigate(`/admin/promotions/${promotion.promotionId}`)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-500/10"><Eye size={17} /></button>
                    {hasWorkflowAction && <DropdownMenu>
                      <DropdownMenuTrigger asChild><button type="button" disabled={workingId === promotion.promotionId} aria-label={`Actions for ${promotion.name}`} className="rounded-lg p-2 hover:bg-blue-500/10 disabled:opacity-40" style={{ color: "var(--text-sub)" }}><MoreHorizontal size={18} /></button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {editable && <DropdownMenuItem onSelect={() => navigate(`/admin/promotions/edit/${promotion.promotionId}`)}><Pencil /> Edit draft</DropdownMenuItem>}
                        {canSubmit && <DropdownMenuItem onSelect={() => setPendingAction({ promotion, action: "submit" })}><Send /> Submit for approval</DropdownMenuItem>}
                        {canDecide && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setPendingAction({ promotion, action: "approve" })}><CheckCircle2 /> Approve</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => setPendingAction({ promotion, action: "reject" })}><RotateCcw /> Return for changes</DropdownMenuItem></>}
                        {canActivate && <DropdownMenuItem onSelect={() => setPendingAction({ promotion, action: "activate" })}><Play /> {promotion.status === "PAUSED" ? "Resume promotion" : "Activate promotion"}</DropdownMenuItem>}
                        {canPause && <DropdownMenuItem onSelect={() => setPendingAction({ promotion, action: "pause" })}><Pause /> Pause promotion</DropdownMenuItem>}
                        {canArchive && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setPendingAction({ promotion, action: "archive" })}><Archive /> Archive promotion</DropdownMenuItem></>}
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && <div className="flex items-center justify-between gap-4 text-sm" style={{ color: "var(--text-sub)" }}><span>{totalElements} promotions</span><div className="flex items-center gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(0, current - 1))} className="grid h-9 w-9 place-items-center rounded-lg border disabled:opacity-40" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {page + 1} of {totalPages}</span><button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} className="grid h-9 w-9 place-items-center rounded-lg border disabled:opacity-40" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }} aria-label="Next page"><ChevronRight size={17} /></button></div></div>}

      {pendingAction && <PromotionWorkflowDialog action={pendingAction.action} promotion={pendingAction.promotion} busy={workingId === pendingAction.promotion.promotionId} onCancel={() => !workingId && setPendingAction(null)} onConfirm={note => void runAction(note)} />}
    </div>
  );
}
