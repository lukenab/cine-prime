import { useCallback, useEffect, useState } from "react";
import { Archive, ArrowLeft, CheckCircle2, Pause, Pencil, Play, RotateCcw, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { promotionApi, type Promotion } from "../../api/promotionApi";
import { PromotionWorkflowDialog, type PromotionWorkflowAction } from "../../components/admin/PromotionWorkflowDialog";
import { useAuth } from "../../context/AuthContext";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const statusLabels: Record<Promotion["status"], string> = {
  DRAFT: "Draft", PENDING_APPROVAL: "Awaiting approval", APPROVED: "Approved", REJECTED: "Changes requested",
  ACTIVE: "Live", PAUSED: "Paused", ARCHIVED: "Archived",
};

export default function PromotionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<PromotionWorkflowAction | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
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
  const editable = ["DRAFT", "REJECTED"].includes(promotion.status) && hasPermission("PROMOTION_UPDATE");
  const canSubmit = ["DRAFT", "REJECTED"].includes(promotion.status) && hasPermission("PROMOTION_SUBMIT");
  const canDecide = promotion.status === "PENDING_APPROVAL" && hasPermission("PROMOTION_APPROVE");
  const canActivate = ["APPROVED", "PAUSED"].includes(promotion.status) && hasPermission("PROMOTION_ACTIVATE");
  const canPause = promotion.status === "ACTIVE" && hasPermission("PROMOTION_PAUSE");
  const canArchive = !["PENDING_APPROVAL", "ARCHIVED"].includes(promotion.status) && hasPermission("PROMOTION_ARCHIVE");
  const usageStats = [["Reserved", promotion.activeReservationCount], ["Committed", promotion.committedUsageCount], ["Remaining", remaining]] as const;
  const details = [
    ["Promotion code", promotion.code], ["Status", statusLabels[promotion.status]], ["Discount", benefit],
    ["Benefit scope", promotion.benefitScope === "ORDER" ? "Tickets + food & drinks" : promotion.benefitScope === "CONCESSIONS" ? "Food & drinks" : "Movie tickets"],
    ["Minimum subtotal", money.format(rule.minimumOrderAmount)], ["Maximum discount", rule.maxDiscountAmount == null ? "Not capped" : money.format(rule.maxDiscountAmount)],
    ["Valid from", promotion.validFrom ? new Date(promotion.validFrom).toLocaleString("vi-VN") : "Immediately"], ["Valid until", promotion.validUntil ? new Date(promotion.validUntil).toLocaleString("vi-VN") : "No expiry"],
    ["Global quota", promotion.globalUsageLimit ?? "Unlimited"], ["Per-customer quota", promotion.perAccountUsageLimit ?? "Unlimited"],
    ["Scope", promotion.targets.length ? `${promotion.targets.length} target(s)` : "All eligible movies and showtimes"],
  ];

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4"><button onClick={() => navigate("/admin/promotions")} aria-label="Back to promotions" className="grid h-10 w-10 place-items-center rounded-xl border" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}><ArrowLeft size={18} /></button><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-500">{promotion.code}</p><h1 className="text-2xl font-semibold" style={{ color: "var(--text-main)" }}>{promotion.name}</h1></div></div>
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

    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}><h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Campaign summary</h2><p className="mt-2 text-sm" style={{ color: "var(--text-sub)" }}>{promotion.description || "No description."}</p><div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">{details.map(([label, value]) => <div key={String(label)} className="border-b pb-4" style={{ borderColor: "var(--border-color)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-1 font-medium" style={{ color: "var(--text-main)" }}>{value}</p></div>)}</div></section>

    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Approval workflow</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <WorkflowFact label="Created by" value={promotion.workflow?.createdByAccountId || "Not recorded"} />
        <WorkflowFact label="Submitted" value={promotion.workflow?.submittedAt ? new Date(promotion.workflow.submittedAt).toLocaleString("vi-VN") : "Not submitted"} />
        <WorkflowFact label="Approved" value={promotion.workflow?.approvedAt ? new Date(promotion.workflow.approvedAt).toLocaleString("vi-VN") : "Not approved"} />
      </div>
    </section>

    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}><h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Usage</h2><div className="mt-6 grid grid-cols-3 gap-4">{usageStats.map(([label, value]) => <div key={label} className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--border-color)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-main)" }}>{value}</p></div>)}</div></section>

    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Audit timeline</h2>
      {promotion.auditLog.length === 0 ? <p className="mt-3 text-sm" style={{ color: "var(--text-sub)" }}>No activity recorded yet.</p> : <ol className="mt-4 space-y-3">{promotion.auditLog.map((entry, index) => {
        const reason = entry.detail?.reason ?? entry.detail?.comment;
        return <li key={`${entry.occurredAt}-${index}`} className="border-b pb-3 text-sm" style={{ borderColor: "var(--border-color)" }}><div className="flex items-center justify-between gap-4"><span className="font-medium" style={{ color: "var(--text-main)" }}>{entry.action.toLowerCase().replaceAll("_", " ").replace(/^./, value => value.toUpperCase())}</span><span style={{ color: "var(--text-sub)" }}>{entry.actorAccountId ?? "system"} · {new Date(entry.occurredAt).toLocaleString("vi-VN")}</span></div>{reason != null && <p className="mt-1" style={{ color: "var(--text-sub)" }}>{String(reason)}</p>}</li>;
      })}</ol>}
    </section>

    {pendingAction && <PromotionWorkflowDialog action={pendingAction} promotion={promotion} busy={working} onCancel={() => !working && setPendingAction(null)} onConfirm={note => void transition(note)} />}
  </div>;
}

function WorkflowFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-2 break-all text-sm font-medium" style={{ color: "var(--text-main)" }}>{value}</p></div>;
}
