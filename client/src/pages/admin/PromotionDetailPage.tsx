import { useCallback, useEffect, useState } from "react";
import { Activity, Archive, ArrowLeft, CalendarDays, CheckCircle2, Clipboard, Clock3, Database, Pause, Pencil, Play, RotateCcw, Send, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { promotionApi, type Promotion, type PromotionAvailabilityStatus } from "../../api/promotionApi";
import { PromotionWorkflowDialog, type PromotionWorkflowAction } from "../../components/admin/PromotionWorkflowDialog";
import { useAuth } from "../../context/AuthContext";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const workflowLabels: Record<Promotion["status"], string> = {
  DRAFT: "Draft", PENDING_APPROVAL: "Awaiting approval", APPROVED: "Approved", REJECTED: "Changes requested",
  ACTIVE: "Approved", PAUSED: "Approved", ARCHIVED: "Archived",
};
const availabilityLabels: Record<PromotionAvailabilityStatus, string> = {
  NOT_AVAILABLE: "Not available", SCHEDULED: "Scheduled", ACTIVE: "Active", PAUSED: "Paused",
  ENDED: "Ended", QUOTA_EXHAUSTED: "Quota exhausted", ARCHIVED: "Not available",
};

function availabilityOf(promotion: Promotion): PromotionAvailabilityStatus {
  if (promotion.availabilityStatus) return promotion.availabilityStatus;
  if (promotion.status === "ARCHIVED") return "ARCHIVED";
  if (promotion.status === "PAUSED") return "PAUSED";
  if (promotion.status !== "ACTIVE") return "NOT_AVAILABLE";
  const now = Date.now();
  if (promotion.validFrom && new Date(promotion.validFrom).getTime() > now) return "SCHEDULED";
  if (promotion.validUntil && new Date(promotion.validUntil).getTime() <= now) return "ENDED";
  if (promotion.globalUsageLimit != null && promotion.activeReservationCount + promotion.committedUsageCount >= promotion.globalUsageLimit) return "QUOTA_EXHAUSTED";
  return "ACTIVE";
}

function availabilityTone(status: PromotionAvailabilityStatus) {
  if (status === "ACTIVE") return { color: "#059669", background: "rgba(16,185,129,.12)" };
  if (status === "SCHEDULED") return { color: "#2563eb", background: "rgba(37,99,235,.12)" };
  if (status === "PAUSED") return { color: "#d97706", background: "rgba(245,158,11,.12)" };
  if (status === "QUOTA_EXHAUSTED") return { color: "#dc2626", background: "rgba(220,38,38,.10)" };
  return { color: "#64748b", background: "rgba(100,116,139,.12)" };
}

function availabilityDescription(status: PromotionAvailabilityStatus) {
  const descriptions: Record<PromotionAvailabilityStatus, string> = {
    NOT_AVAILABLE: "Customers cannot redeem this promotion in its current workflow state.",
    SCHEDULED: "Approved and activated; customer redemption starts at the configured time.",
    ACTIVE: "The promotion is currently available to eligible customers.",
    PAUSED: "Customer redemption is temporarily disabled.",
    ENDED: "The configured redemption window has ended.",
    QUOTA_EXHAUSTED: "The global redemption quota has been reached.",
    ARCHIVED: "This promotion is retained for records and is not available to customers.",
  };
  return descriptions[status];
}

const formatDateTime = (value?: string | null, fallback = "Not recorded") => value ? new Date(value).toLocaleString("vi-VN") : fallback;
const actionLabel = (action: string) => action.toLowerCase().replace(/_/g, " ").replace(/^./, (value: string) => value.toUpperCase());

export default function PromotionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<PromotionWorkflowAction | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activity">("overview");

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try { setPromotion(await promotionApi.get(id)); }
    catch { setError("Promotion could not be loaded."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const transition = async (note: string) => {
    if (!id || !pendingAction) return;
    setWorking(true); setError("");
    try {
      let updated: Promotion;
      if (pendingAction === "submit") updated = await promotionApi.submit(id, note);
      else if (pendingAction === "approve") updated = await promotionApi.approve(id, note);
      else if (pendingAction === "reject") updated = await promotionApi.reject(id, note);
      else if (pendingAction === "activate") updated = await promotionApi.activate(id);
      else if (pendingAction === "pause") updated = await promotionApi.pause(id, note);
      else updated = await promotionApi.archive(id, note);
      setPromotion(updated);
      setPendingAction(null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? `Could not ${pendingAction} this promotion.`);
    } finally { setWorking(false); }
  };

  if (!promotion) return <div className="rounded-xl p-4" style={{ color: error ? "#ef4444" : "var(--text-sub)" }}>{error || "Loading promotion..."}</div>;

  const rule = promotion.priceRule;
  const benefit = rule.discountType === "PERCENTAGE" ? `${rule.percentage}%` : money.format(rule.fixedAmount ?? 0);
  const used = promotion.activeReservationCount + promotion.committedUsageCount;
  const remaining = promotion.globalUsageLimit == null ? "Unlimited" : Math.max(0, promotion.globalUsageLimit - used);
  const availability = availabilityOf(promotion);
  const availabilityBadge = availabilityTone(availability);
  const editable = ["DRAFT", "REJECTED"].includes(promotion.status) && hasPermission("PROMOTION_UPDATE");
  const canSubmit = ["DRAFT", "REJECTED"].includes(promotion.status) && hasPermission("PROMOTION_SUBMIT");
  const canDecide = promotion.status === "PENDING_APPROVAL" && hasPermission("PROMOTION_APPROVE");
  const canActivate = ["APPROVED", "PAUSED"].includes(promotion.status) && hasPermission("PROMOTION_ACTIVATE");
  const canPause = promotion.status === "ACTIVE" && hasPermission("PROMOTION_PAUSE");
  const canArchive = !["PENDING_APPROVAL", "ARCHIVED"].includes(promotion.status) && hasPermission("PROMOTION_ARCHIVE");
  const scope = promotion.targets.length ? `${promotion.targets.length} selected movie/showtime target(s)` : "All eligible movies and showtimes";

  return <div className="w-full space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/admin/promotions")} aria-label="Back to promotions" className="grid h-10 w-10 place-items-center rounded-xl border" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}><ArrowLeft size={18} /></button>
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-500">Promotion · {promotion.code}</p><h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-main)" }}>{promotion.name}</h1><div className="mt-2 flex flex-wrap gap-2"><StatusPill label={workflowLabels[promotion.status]} /><StatusPill label={availabilityLabels[availability]} style={availabilityBadge} /></div></div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {editable && <button onClick={() => navigate(`/admin/promotions/edit/${promotion.promotionId}`)} className="flex h-10 items-center gap-2 rounded-xl border px-4 text-sm" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}><Pencil size={16} /> Edit</button>}
        {canSubmit && <button onClick={() => setPendingAction("submit")} className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"><Send size={16} /> Submit for approval</button>}
        {canDecide && <><button onClick={() => setPendingAction("reject")} className="flex h-10 items-center gap-2 rounded-xl border border-red-500/30 px-4 text-sm text-red-500"><RotateCcw size={16} /> Return</button><button onClick={() => setPendingAction("approve")} className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"><CheckCircle2 size={16} /> Approve</button></>}
        {canActivate && <button onClick={() => setPendingAction("activate")} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Play size={16} /> {promotion.status === "PAUSED" ? "Resume" : "Activate"}</button>}
        {canPause && <button onClick={() => setPendingAction("pause")} className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white"><Pause size={16} /> Pause</button>}
        {canArchive && <button onClick={() => setPendingAction("archive")} className="flex h-10 items-center gap-2 rounded-xl border border-red-500/30 px-4 text-sm text-red-500"><Archive size={16} /> Archive</button>}
      </div>
    </div>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500">{error}</div>}

    <div className="space-y-4">
      <div role="tablist" aria-label="Promotion details" className="inline-flex h-10 items-center rounded-xl border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}><TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton><TabButton active={activeTab === "activity"} onClick={() => setActiveTab("activity")}><Activity size={15} /> Activity <span className="ml-1 rounded-full bg-blue-500/10 px-1.5 text-xs text-blue-500">{promotion.auditLog.length}</span></TabButton></div>
      {activeTab === "overview" && <div role="tabpanel">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div><h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Offer configuration</h2><p className="mt-1 text-sm" style={{ color: "var(--text-sub)" }}>{promotion.description || "No campaign description has been added."}</p></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Highlight label="Customer benefit" value={benefit} helper={promotion.benefitScope === "ORDER" ? "Tickets + food & drinks" : promotion.benefitScope === "CONCESSIONS" ? "Food & drinks" : "Movie tickets"} />
              <Highlight label="Minimum subtotal" value={money.format(rule.minimumOrderAmount)} helper={rule.maxDiscountAmount == null ? "No discount cap" : `Capped at ${money.format(rule.maxDiscountAmount)}`} />
              <Highlight label="Customer limit" value={promotion.perAccountUsageLimit ?? "Unlimited"} helper="Redemptions per customer" />
            </div>
            <div className="mt-7 grid gap-x-10 gap-y-5 md:grid-cols-2">
              <DetailRow icon={CalendarDays} label="Starts" value={formatDateTime(promotion.validFrom, "Immediately after activation")} />
              <DetailRow icon={CalendarDays} label="Ends" value={formatDateTime(promotion.validUntil, "No expiry configured")} />
              <DetailRow icon={Users} label="Eligibility scope" value={scope} />
              <DetailRow icon={Database} label="Global quota" value={promotion.globalUsageLimit ?? "Unlimited"} />
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>Operational status</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-lg font-semibold" style={{ color: "var(--text-main)" }}>{availabilityLabels[availability]}</span><StatusPill label={workflowLabels[promotion.status]} /></div><p className="mt-2 text-sm leading-5" style={{ color: "var(--text-sub)" }}>{availabilityDescription(availability)}</p></section>
            <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}><h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Usage & quota</h2><div className="mt-4 grid grid-cols-3 divide-x" style={{ borderColor: "var(--border-color)" }}><Metric label="Reserved" value={promotion.activeReservationCount} /><Metric label="Redeemed" value={promotion.committedUsageCount} /><Metric label="Remaining" value={remaining} /></div></section>
            <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}><h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Approval workflow</h2><div className="mt-4 space-y-4"><WorkflowFact label="Created" value={formatDateTime(promotion.createdAt)} /><WorkflowFact label="Submitted" value={formatDateTime(promotion.workflow?.submittedAt, "Not submitted")} /><WorkflowFact label="Approved" value={formatDateTime(promotion.workflow?.approvedAt, "Not approved")} /></div></section>
            <details className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}><summary className="cursor-pointer font-semibold" style={{ color: "var(--text-main)" }}>Technical metadata</summary><div className="mt-4 space-y-3"><MetadataRow label="Promotion ID" value={promotion.promotionId} copy /><MetadataRow label="Record version" value={String(promotion.version)} /><MetadataRow label="Created by account" value={promotion.workflow?.createdByAccountId || "Not recorded"} copy={Boolean(promotion.workflow?.createdByAccountId)} /><MetadataRow label="Submitted by account" value={promotion.workflow?.submittedByAccountId || "Not submitted"} copy={Boolean(promotion.workflow?.submittedByAccountId)} /><MetadataRow label="Approved by account" value={promotion.workflow?.approvedByAccountId || "Not approved"} copy={Boolean(promotion.workflow?.approvedByAccountId)} /><MetadataRow label="Last updated" value={formatDateTime(promotion.updatedAt)} /></div></details>
          </aside>
        </div>
      </div>}

      {activeTab === "activity" && <div role="tabpanel">
        <section className="rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}><h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Activity & audit trail</h2><p className="mt-1 text-sm" style={{ color: "var(--text-sub)" }}>Workflow decisions and operational changes recorded for this promotion.</p></div>
          {promotion.auditLog.length === 0 ? <p className="px-6 py-12 text-center text-sm" style={{ color: "var(--text-sub)" }}>No activity recorded yet.</p> : <ol>{promotion.auditLog.map((entry, index) => {
            const reason = entry.detail?.reason ?? entry.detail?.comment;
            return <li key={entry.auditLogId ?? `${entry.occurredAt}-${index}`} className="grid gap-4 border-b px-6 py-5 last:border-0 md:grid-cols-[48px_minmax(0,1fr)_minmax(260px,.7fr)]" style={{ borderColor: "var(--border-color)" }}><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-500/10 text-blue-500"><Clock3 size={17} /></span><div><p className="font-medium" style={{ color: "var(--text-main)" }}>{actionLabel(entry.action)}</p><p className="mt-1 text-sm" style={{ color: "var(--text-sub)" }}>{reason != null ? String(reason) : "No additional note."}</p></div><div className="space-y-2 text-xs md:text-right" style={{ color: "var(--text-sub)" }}><p>{formatDateTime(entry.occurredAt)}</p><CopyValue label="Actor ID" value={entry.actorAccountId ?? "system"} /><CopyValue label="Audit ID" value={entry.auditLogId ?? "Not available"} /></div></li>;
          })}</ol>}
        </section>
      </div>}
    </div>

    {pendingAction && <PromotionWorkflowDialog action={pendingAction} promotion={promotion} busy={working} onCancel={() => !working && setPendingAction(null)} onConfirm={note => void transition(note)} />}
  </div>;
}

function StatusPill({ label, style }: { label: string; style?: React.CSSProperties }) {
  return <span className="inline-flex rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold" style={{ color: "var(--text-sub)", ...style }}>{label}</span>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-blue-600 text-white" : "hover:bg-blue-500/10"}`} style={active ? undefined : { color: "var(--text-sub)" }}>{children}</button>;
}

function Highlight({ label, value, helper }: { label: string; value: React.ReactNode; helper: string }) {
  return <div className="rounded-xl bg-blue-500/[.06] p-4"><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-2 text-xl font-semibold text-blue-500">{value}</p><p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>{helper}</p></div>;
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: React.ReactNode }) {
  return <div className="flex gap-3 border-b pb-4" style={{ borderColor: "var(--border-color)" }}><Icon size={17} className="mt-0.5 shrink-0 text-blue-500" /><div><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-1 text-sm font-medium" style={{ color: "var(--text-main)" }}>{value}</p></div></div>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="px-2 text-center first:pl-0 last:pr-0"><p className="text-xl font-semibold" style={{ color: "var(--text-main)" }}>{value}</p><p className="mt-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>{label}</p></div>;
}

function WorkflowFact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 text-sm"><span style={{ color: "var(--text-sub)" }}>{label}</span><span className="max-w-[65%] break-all text-right font-medium" style={{ color: "var(--text-main)" }}>{value}</span></div>;
}

function MetadataRow({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return <div className="flex items-start justify-between gap-4 text-xs"><span className="shrink-0" style={{ color: "var(--text-sub)" }}>{label}</span><span className="flex min-w-0 items-center gap-1 font-mono" style={{ color: "var(--text-main)" }}><span className="truncate">{value}</span>{copy && <CopyButton value={value} />}</span></div>;
}

function CopyValue({ label, value }: { label: string; value: string }) {
  return <p className="flex items-center gap-1 md:justify-end"><span>{label}: {value}</span>{value !== "Not available" && <CopyButton value={value} />}</p>;
}

function CopyButton({ value }: { value: string }) {
  return <button type="button" title="Copy to clipboard" aria-label="Copy to clipboard" onClick={() => void navigator.clipboard.writeText(value)} className="rounded p-1 hover:bg-blue-500/10 hover:text-blue-500"><Clipboard size={13} /></button>;
}
