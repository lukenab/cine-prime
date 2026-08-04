import { useEffect, useState } from "react";
import { ArrowLeft, Archive, Pause, Pencil, Play } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { promotionApi, type Promotion } from "../../api/promotionApi";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function PromotionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const load = () => id && promotionApi.get(id).then(setPromotion).catch(() => setError("Promotion could not be loaded."));
  useEffect(() => { void load(); }, [id]);

  const transition = async (action: "activate" | "pause" | "retire") => {
    if (!id) return;
    setWorking(true); setError("");
    try { setPromotion(await promotionApi[action](id)); } catch { setError(`Could not ${action} this promotion.`); } finally { setWorking(false); }
  };

  if (!promotion) return <div className="rounded-xl p-4" style={{ color: error ? "#ef4444" : "var(--text-sub)" }}>{error || "Loading promotion..."}</div>;
  const rule = promotion.priceRule;
  const benefit = rule.discountType === "PERCENTAGE" ? `${rule.percentage}%` : money.format(rule.fixedAmount ?? 0);
  const used = promotion.activeReservationCount + promotion.committedUsageCount;
  const remaining = promotion.globalUsageLimit == null ? "Unlimited" : Math.max(0, promotion.globalUsageLimit - used);
  const usageStats = [
    ["Reserved", promotion.activeReservationCount], ["Committed", promotion.committedUsageCount], ["Remaining", remaining],
  ] as const;
  const details = [
    ["Promotion code", promotion.code], ["Status", promotion.status], ["Discount", benefit],
    ["Minimum subtotal", money.format(rule.minimumOrderAmount)],
    ["Maximum discount", rule.maxDiscountAmount == null ? "Not capped" : money.format(rule.maxDiscountAmount)],
    ["Valid from", promotion.validFrom ? new Date(promotion.validFrom).toLocaleString("vi-VN") : "Immediately"],
    ["Valid until", promotion.validUntil ? new Date(promotion.validUntil).toLocaleString("vi-VN") : "No expiry"],
    ["Global quota", promotion.globalUsageLimit ?? "Unlimited"], ["Per-customer quota", promotion.perAccountUsageLimit ?? "Unlimited"],
    ["Scope", promotion.targets.length ? `${promotion.targets.length} target(s)` : "All eligible movies and showtimes"],
  ];

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4"><button onClick={() => navigate("/admin/promotions")} className="grid h-10 w-10 place-items-center rounded-xl border" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}><ArrowLeft size={18} /></button><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-500">{promotion.code}</p><h1 className="text-2xl font-semibold" style={{ color: "var(--text-main)" }}>{promotion.name}</h1></div></div>
      <div className="flex gap-2">
        {promotion.status === "DRAFT" && <button onClick={() => navigate(`/admin/promotions/edit/${promotion.promotionId}`)} className="flex h-10 items-center gap-2 rounded-xl border px-4 text-sm" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}><Pencil size={16} /> Edit</button>}
        {(promotion.status === "DRAFT" || promotion.status === "PAUSED") && <button disabled={working} onClick={() => void transition("activate")} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Play size={16} /> Activate</button>}
        {promotion.status === "ACTIVE" && <button disabled={working} onClick={() => void transition("pause")} className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white"><Pause size={16} /> Pause</button>}
        {promotion.status !== "ARCHIVED" && <button disabled={working} onClick={() => void transition("retire")} className="flex h-10 items-center gap-2 rounded-xl border border-red-500/30 px-4 text-sm text-red-500"><Archive size={16} /> Archive</button>}
      </div>
    </div>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500">{error}</div>}
    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}><h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Campaign summary</h2><p className="mt-2 text-sm" style={{ color: "var(--text-sub)" }}>{promotion.description || "No description."}</p><div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">{details.map(([label, value]) => <div key={String(label)} className="border-b pb-4" style={{ borderColor: "var(--border-color)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-1 font-medium" style={{ color: "var(--text-main)" }}>{value}</p></div>)}</div></section>
    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Usage</h2>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {usageStats.map(([label, value]) => <div key={label} className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--border-color)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>{label}</p><p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-main)" }}>{value}</p></div>)}
      </div>
    </section>
    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 className="font-semibold" style={{ color: "var(--text-main)" }}>Audit timeline</h2>
      {promotion.auditLog.length === 0
        ? <p className="mt-3 text-sm" style={{ color: "var(--text-sub)" }}>No activity recorded yet.</p>
        : <ol className="mt-4 space-y-3">
            {promotion.auditLog.map((entry, index) => (
              <li key={`${entry.occurredAt}-${index}`} className="flex items-center justify-between gap-4 border-b pb-3 text-sm" style={{ borderColor: "var(--border-color)" }}>
                <span className="font-medium" style={{ color: "var(--text-main)" }}>{entry.action}</span>
                <span style={{ color: "var(--text-sub)" }}>{entry.actorAccountId ?? "system"} · {new Date(entry.occurredAt).toLocaleString("vi-VN")}</span>
              </li>
            ))}
          </ol>}
    </section>
  </div>;
}
