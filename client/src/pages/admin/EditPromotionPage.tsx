import { useState, useEffect } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import type { PromotionFormData } from "./CreatePromotionPage";
import type { DiscountType } from "./ManagePromotionPage";

// ── Mock fetch ─────────────────────────────────────────────────────────────────
async function fetchPromotion(id: string): Promise<PromotionFormData> {
  await new Promise((res) => setTimeout(res, 400));
  const MOCK: Record<string, PromotionFormData> = {
    "1": { title: "Summer Blockbuster Sale", description: "Get 20% off all tickets during the summer season.", discountType: "PERCENTAGE", discountValue: "20", startDate: "2026-06-01", endDate: "2026-08-31", bannerUrl: "" },
    "2": { title: "Student Discount",        description: "50,000₫ off for valid student ID holders every Tuesday.", discountType: "FIXED_AMOUNT", discountValue: "50000", startDate: "2026-01-01", endDate: "2026-12-31", bannerUrl: "" },
    "3": { title: "Opening Week Special",    description: "30% off all seats for the first week of new releases.", discountType: "PERCENTAGE", discountValue: "30", startDate: "2026-05-01", endDate: "2026-05-31", bannerUrl: "" },
    "4": { title: "VIP Member Weekend",      description: "100,000₫ off for Platinum members on weekends.", discountType: "FIXED_AMOUNT", discountValue: "100000", startDate: "2026-08-01", endDate: "2026-09-30", bannerUrl: "" },
  };
  const result = MOCK[id];
  if (!result) throw new Error("Promotion not found");
  return result;
}

// ── Shared field components ───────────────────────────────────────────────────
function FormField({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-sub)", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
      </label>
      {children}
      {hint  && !error && <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "5px" }}>{hint}</p>}
      {error && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "5px" }}>{error}</p>}
    </div>
  );
}

function Input({ hasError, style, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return (
    <input {...props} style={{
      width: "100%", padding: "10px 13px", borderRadius: "10px", fontSize: "14px",
      outline: "none", transition: "border-color 0.15s", background: "var(--bg-card)",
      color: "var(--text-main)", border: `1px solid ${hasError ? "#ef4444" : "var(--border-color)"}`,
      boxSizing: "border-box", ...style,
    }} />
  );
}

function TextArea({ hasError, style, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }) {
  return (
    <textarea {...props} style={{
      width: "100%", padding: "10px 13px", borderRadius: "10px", fontSize: "14px",
      outline: "none", resize: "vertical", minHeight: "110px", transition: "border-color 0.15s",
      background: "var(--bg-card)", color: "var(--text-main)",
      border: `1px solid ${hasError ? "#ef4444" : "var(--border-color)"}`,
      boxSizing: "border-box", ...style,
    }} />
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 style={{
        fontSize: "14px", fontWeight: 600, color: "var(--text-main)",
        marginBottom: "20px", paddingBottom: "12px", borderBottom: "1px solid var(--border-color)",
      }}>
        {title}
      </h2>
      <div style={{ display: "grid", gap: "16px" }}>{children}</div>
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────
type FormErrors = Partial<Record<keyof PromotionFormData, string>>;

function validate(form: PromotionFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim())       errors.title       = "Title is required.";
  if (!form.description.trim()) errors.description = "Description is required.";
  if (!form.discountValue || isNaN(Number(form.discountValue)) || Number(form.discountValue) <= 0)
    errors.discountValue = "Enter a valid value greater than 0.";
  if (form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100)
    errors.discountValue = "Percentage cannot exceed 100.";
  if (!form.startDate) errors.startDate = "Start date is required.";
  if (!form.endDate)   errors.endDate   = "End date is required.";
  if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate))
    errors.endDate = "End date must be after start date.";
  return errors;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EditPromotionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  const [form, setForm]                 = useState<PromotionFormData | null>(null);
  const [errors, setErrors]             = useState<FormErrors>({});
  const [isLoading, setIsLoading]       = useState(true);
  const [loadError, setLoadError]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetchPromotion(id)
      .then((data) => setForm(data))
      .catch(() => setLoadError("Promotion not found."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const update = (field: keyof PromotionFormData, value: string) => {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API call
      // await api.put(`/promotions/${id}`, { ...form, discountValue: Number(form.discountValue) });
      await new Promise((res) => setTimeout(res, 600));
      console.log("Update promotion:", id, form);
      navigate(`/admin/promotions/${id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "200px" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: `${accentColor} transparent transparent transparent` }} />
      </div>
    );
  }
  if (loadError || !form) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ height: "200px", color: "var(--text-sub)" }}>
        <p style={{ fontSize: "14px" }}>{loadError || "Promotion not found."}</p>
        <button onClick={() => navigate("/admin/promotions")}
          className="px-4 py-2 rounded-xl border text-sm hover:opacity-80"
          style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
          Back to Promotions
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4" style={{ marginBottom: "28px" }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(`/admin/promotions/${id}`)}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:opacity-80 transition-all"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "3px" }}>
              Edit Promotion
            </h1>
            <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
              Editing: <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{form.title}</span>
            </p>
          </div>
        </div>

        {/* Action buttons in header (right side) */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(`/admin/promotions/${id}`)}
            className="px-5 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
            style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: accentColor }}>
            <Save size={15} />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* ── 2-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px", alignItems: "start" }}>

        {/* LEFT — Promotion Info (tall card) */}
        <SectionCard title="Promotion Information">
          <FormField label="Promotion Title" required error={errors.title}>
            <Input
              type="text"
              placeholder="e.g. Summer Blockbuster Sale"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              hasError={!!errors.title}
            />
          </FormField>

          <FormField label="Description" required error={errors.description}>
            <TextArea
              placeholder="Describe what this promotion offers..."
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              hasError={!!errors.description}
              style={{ minHeight: "140px" }}
            />
          </FormField>

          <FormField
            label="Banner Image URL"
            hint="Optional. Paste a direct image URL. File upload will be supported in a future update."
          >
            <Input
              type="url"
              placeholder="https://example.com/banner.jpg"
              value={form.bannerUrl}
              onChange={(e) => update("bannerUrl", e.target.value)}
            />
          </FormField>

          {/* Banner preview */}
          {form.bannerUrl && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
              <img
                src={form.bannerUrl}
                alt="Banner preview"
                className="w-full object-cover"
                style={{ maxHeight: "180px" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </SectionCard>

        {/* RIGHT — Discount + Period stacked */}
        <div style={{ display: "grid", gap: "16px" }}>

          {/* Discount Configuration */}
          <SectionCard title="Discount Configuration">
            <FormField label="Discount Type" required>
              <div className="flex gap-2">
                {(["PERCENTAGE", "FIXED_AMOUNT"] as DiscountType[]).map((type) => {
                  const selected = form.discountType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => update("discountType", type)}
                      className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all"
                      style={{
                        background: selected ? accentColor : "transparent",
                        color: selected ? "#fff" : "var(--text-sub)",
                        borderColor: selected ? accentColor : "var(--border-color)",
                      }}
                    >
                      {type === "PERCENTAGE" ? "Percentage (%)" : "Fixed Amount (₫)"}
                    </button>
                  );
                })}
              </div>
            </FormField>

            <FormField
              label={form.discountType === "PERCENTAGE" ? "Discount Percentage" : "Discount Amount (₫)"}
              required
              error={errors.discountValue}
            >
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max={form.discountType === "PERCENTAGE" ? "100" : undefined}
                  step={form.discountType === "PERCENTAGE" ? "1" : "1000"}
                  placeholder={form.discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 50000"}
                  value={form.discountValue}
                  onChange={(e) => update("discountValue", e.target.value)}
                  hasError={!!errors.discountValue}
                  style={{ paddingRight: "44px" }}
                />
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ fontSize: "14px", color: "var(--text-sub)", fontWeight: 500, pointerEvents: "none" }}
                >
                  {form.discountType === "PERCENTAGE" ? "%" : "₫"}
                </span>
              </div>
            </FormField>
          </SectionCard>

          {/* Promotion Period */}
          <SectionCard title="Promotion Period">
            <FormField label="Start Date" required error={errors.startDate}>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                hasError={!!errors.startDate}
              />
            </FormField>
            <FormField label="End Date" required error={errors.endDate}>
              <Input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => update("endDate", e.target.value)}
                hasError={!!errors.endDate}
              />
            </FormField>
          </SectionCard>

        </div>
      </div>
    </form>
  );
}
