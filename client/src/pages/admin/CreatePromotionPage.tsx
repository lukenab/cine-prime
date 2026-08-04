import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { promotionApi, type PromotionDiscountType, type PromotionUpsertPayload } from "../../api/promotionApi";

export interface PromotionFormData {
  code: string;
  name: string;
  description: string;
  discountType: PromotionDiscountType;
  discountValue: string;
  maximumDiscount: string;
  minimumOrder: string;
  validFrom: string;
  validUntil: string;
  globalUsageLimit: string;
  perAccountUsageLimit: string;
}

export const EMPTY_PROMOTION_FORM: PromotionFormData = {
  code: "", name: "", description: "", discountType: "PERCENTAGE", discountValue: "",
  maximumDiscount: "", minimumOrder: "0", validFrom: "", validUntil: "",
  globalUsageLimit: "", perAccountUsageLimit: "",
};

export function toPromotionPayload(form: PromotionFormData): PromotionUpsertPayload {
  const percentage = form.discountType === "PERCENTAGE" ? Number(form.discountValue) : null;
  const fixedAmount = form.discountType === "FIXED_AMOUNT" ? Number(form.discountValue) : null;
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description.trim(),
    validFrom: form.validFrom ? `${form.validFrom}T00:00:00+07:00` : null,
    validUntil: form.validUntil ? `${form.validUntil}T23:59:59+07:00` : null,
    globalUsageLimit: form.globalUsageLimit ? Number(form.globalUsageLimit) : null,
    perAccountUsageLimit: form.perAccountUsageLimit ? Number(form.perAccountUsageLimit) : null,
    priceRule: {
      discountType: form.discountType,
      percentage,
      fixedAmount,
      maxDiscountAmount: form.discountType === "PERCENTAGE" && form.maximumDiscount ? Number(form.maximumDiscount) : null,
      minimumOrderAmount: Number(form.minimumOrder || 0),
      currency: "VND",
    },
    targets: [],
  };
}

export function PromotionForm({ initial = EMPTY_PROMOTION_FORM, submitLabel, onSubmit }: { initial?: PromotionFormData; submitLabel: string; onSubmit: (form: PromotionFormData) => Promise<void> }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (field: keyof PromotionFormData, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const inputClass = "h-11 w-full rounded-xl border px-3.5 text-sm outline-none focus:border-blue-500";
  const inputStyle = { color: "var(--text-main)", background: "var(--bg-card)", borderColor: "var(--border-color)" };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.code.trim() || !form.name.trim() || !form.discountValue || Number(form.discountValue) <= 0) {
      setError("Code, name and a positive discount value are required."); return;
    }
    if (form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100) {
      setError("Percentage discount cannot exceed 100%."); return;
    }
    if (form.validFrom && form.validUntil && form.validUntil < form.validFrom) {
      setError("End date must be on or after the start date."); return;
    }
    setSaving(true);
    try { await onSubmit(form); } catch (cause: any) {
      setError(cause?.response?.data?.message || "Could not save this promotion. Check the values and try again.");
    } finally { setSaving(false); }
  };

  return <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => navigate("/admin/promotions")} className="grid h-10 w-10 place-items-center rounded-xl border" style={inputStyle}><ArrowLeft size={18} /></button>
      <div><h1 className="text-2xl font-semibold" style={{ color: "var(--text-main)" }}>{submitLabel}</h1><p className="text-sm" style={{ color: "var(--text-sub)" }}>Draft the commercial rule first, then activate it from the promotion list.</p></div>
    </div>

    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 className="mb-5 font-semibold" style={{ color: "var(--text-main)" }}>Promotion identity</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Promotion code *<input value={form.code} onChange={(e) => update("code", e.target.value.replace(/\s/g, "").toUpperCase())} placeholder="CINEPRIME20" maxLength={64} className={inputClass} style={inputStyle} /></label>
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Promotion name *<input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="CinePrime launch offer" className={inputClass} style={inputStyle} /></label>
        <label className="space-y-2 text-sm md:col-span-2" style={{ color: "var(--text-sub)" }}>Description<textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Short customer-facing description" className="min-h-24 w-full rounded-xl border p-3.5 text-sm outline-none focus:border-blue-500" style={inputStyle} /></label>
      </div>
    </section>

    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 className="mb-5 font-semibold" style={{ color: "var(--text-main)" }}>Discount rule</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Discount type<select value={form.discountType} onChange={(e) => update("discountType", e.target.value)} className={inputClass} style={inputStyle}><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option></select></label>
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Discount value *<input type="number" min="1" max={form.discountType === "PERCENTAGE" ? "100" : undefined} value={form.discountValue} onChange={(e) => update("discountValue", e.target.value)} placeholder={form.discountType === "PERCENTAGE" ? "20" : "50000"} className={inputClass} style={inputStyle} /></label>
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Minimum booking subtotal (VND)<input type="number" min="0" value={form.minimumOrder} onChange={(e) => update("minimumOrder", e.target.value)} className={inputClass} style={inputStyle} /></label>
        {form.discountType === "PERCENTAGE" && <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Maximum discount (VND)<input type="number" min="0" value={form.maximumDiscount} onChange={(e) => update("maximumDiscount", e.target.value)} placeholder="50000" className={inputClass} style={inputStyle} /></label>}
      </div>
    </section>

    <section className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 className="mb-5 font-semibold" style={{ color: "var(--text-main)" }}>Validity & quota</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Start date<input type="date" value={form.validFrom} onChange={(e) => update("validFrom", e.target.value)} className={inputClass} style={inputStyle} /></label>
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>End date<input type="date" value={form.validUntil} onChange={(e) => update("validUntil", e.target.value)} className={inputClass} style={inputStyle} /></label>
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Global redemption limit<input type="number" min="1" value={form.globalUsageLimit} onChange={(e) => update("globalUsageLimit", e.target.value)} placeholder="1000" className={inputClass} style={inputStyle} /></label>
        <label className="space-y-2 text-sm" style={{ color: "var(--text-sub)" }}>Limit per customer<input type="number" min="1" value={form.perAccountUsageLimit} onChange={(e) => update("perAccountUsageLimit", e.target.value)} placeholder="1" className={inputClass} style={inputStyle} /></label>
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--text-sub)" }}>P0 scope: this offer applies to all eligible movies and showtimes. Targeted campaigns can be added later.</p>
    </section>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
    <div className="flex justify-end gap-3"><button type="button" onClick={() => navigate("/admin/promotions")} className="h-11 rounded-xl border px-5 text-sm font-medium" style={inputStyle}>Cancel</button><button disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-50"><Save size={17} /> {saving ? "Saving..." : "Save draft"}</button></div>
  </form>;
}

export default function CreatePromotionPage() {
  const navigate = useNavigate();
  return <PromotionForm submitLabel="Create promotion" onSubmit={async (form) => { const created = await promotionApi.create(toPromotionPayload(form)); navigate(`/admin/promotions/${created.promotionId}`); }} />;
}
