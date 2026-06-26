import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, Tag } from "lucide-react";
import type { DiscountType } from "./ManagePromotionPage";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PromotionFormData {
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;    // stored as string for input control
  startDate: string;
  endDate: string;
  bannerUrl: string;
}

const INITIAL_FORM: PromotionFormData = {
  title: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  startDate: "",
  endDate: "",
  bannerUrl: "",
};

// ── Field components ──────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, required, error, children }: FieldProps) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-sub)", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "5px" }}>{error}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

function Input({ hasError, style, ...props }: InputProps) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 13px",
        borderRadius: "10px",
        fontSize: "14px",
        outline: "none",
        transition: "border-color 0.15s",
        background: "var(--bg-card)",
        color: "var(--text-main)",
        border: `1px solid ${hasError ? "#ef4444" : "var(--border-color)"}`,
        boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

function TextArea({ hasError, style, ...props }: TextAreaProps) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "10px 13px",
        borderRadius: "10px",
        fontSize: "14px",
        outline: "none",
        resize: "vertical",
        minHeight: "90px",
        transition: "border-color 0.15s",
        background: "var(--bg-card)",
        color: "var(--text-main)",
        border: `1px solid ${hasError ? "#ef4444" : "var(--border-color)"}`,
        boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

// ── Validation ────────────────────────────────────────────────────────────────
type FormErrors = Partial<Record<keyof PromotionFormData, string>>;

function validate(form: PromotionFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim())       errors.title       = "Title is required.";
  if (!form.description.trim()) errors.description = "Description is required.";
  if (!form.discountValue || isNaN(Number(form.discountValue)) || Number(form.discountValue) <= 0)
    errors.discountValue = "Enter a valid discount value greater than 0.";
  if (form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100)
    errors.discountValue = "Percentage cannot exceed 100.";
  if (!form.startDate) errors.startDate = "Start date is required.";
  if (!form.endDate)   errors.endDate   = "End date is required.";
  if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate))
    errors.endDate = "End date must be after start date.";
  return errors;
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "20px", paddingBottom: "12px", borderBottom: "1px solid var(--border-color)" }}>
        {title}
      </h2>
      <div style={{ display: "grid", gap: "16px" }}>
        {children}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreatePromotionPage() {
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  const [form, setForm]         = useState<PromotionFormData>(INITIAL_FORM);
  const [errors, setErrors]     = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: keyof PromotionFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API call
      // await api.post("/promotions", { ...form, discountValue: Number(form.discountValue) });
      await new Promise((res) => setTimeout(res, 600));
      console.log("Create promotion:", { ...form, discountValue: Number(form.discountValue) });
      navigate("/admin/promotions");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="flex items-center gap-4" style={{ marginBottom: "28px" }}>
        <button type="button" onClick={() => navigate("/admin/promotions")}
          className="w-9 h-9 rounded-xl border flex items-center justify-center hover:opacity-80 transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "3px" }}>
            Add New Promotion
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>Create a new discount promotion or campaign.</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "20px", maxWidth: "720px" }}>
        {/* Basic Info */}
        <SectionCard title="Promotion Information">
          {/* Title */}
          <FormField label="Promotion Title" required error={errors.title}>
            <Input
              type="text"
              placeholder="e.g. Summer Blockbuster Sale"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              hasError={!!errors.title}
            />
          </FormField>

          {/* Description */}
          <FormField label="Description" required error={errors.description}>
            <TextArea
              placeholder="Describe what this promotion offers..."
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              hasError={!!errors.description}
            />
          </FormField>

          {/* Banner URL */}
          <FormField label="Banner Image URL" error={errors.bannerUrl}>
            <Input
              type="url"
              placeholder="https://example.com/banner.jpg"
              value={form.bannerUrl}
              onChange={(e) => update("bannerUrl", e.target.value)}
            />
            <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "5px" }}>
              Optional. Paste a direct image URL. File upload will be supported in a future update.
            </p>
          </FormField>
        </SectionCard>

        {/* Discount */}
        <SectionCard title="Discount Configuration">
          {/* Discount type */}
          <FormField label="Discount Type" required>
            <div className="flex gap-3">
              {(["PERCENTAGE", "FIXED_AMOUNT"] as DiscountType[]).map((type) => {
                const selected = form.discountType === type;
                const label = type === "PERCENTAGE" ? "Percentage (%)  " : "Fixed Amount (₫)";
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => update("discountType", type)}
                    className="flex-1 py-3 rounded-xl border text-sm font-medium transition-all"
                    style={{
                      background: selected ? accentColor : "transparent",
                      color: selected ? "#fff" : "var(--text-sub)",
                      borderColor: selected ? accentColor : "var(--border-color)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* Discount value */}
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
                style={{ paddingRight: "48px" }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2" style={{ fontSize: "14px", color: "var(--text-sub)", fontWeight: 500 }}>
                {form.discountType === "PERCENTAGE" ? "%" : "₫"}
              </span>
            </div>
          </FormField>
        </SectionCard>

        {/* Date range */}
        <SectionCard title="Promotion Period">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
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
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 pb-8">
          <button
            type="button"
            onClick={() => navigate("/admin/promotions")}
            className="px-6 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
            style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: accentColor }}
          >
            <Tag size={15} />
            {isSubmitting ? "Creating..." : "Create Promotion"}
          </button>
        </div>
      </div>
    </form>
  );
}
