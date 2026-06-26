import { useState, useEffect } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { ArrowLeft, Pencil, Tag, Percent, DollarSign, Calendar, Clock, FileText, Image } from "lucide-react";
import type { DiscountType, PromotionStatus } from "./ManagePromotionPage";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PromotionDetail {
  id: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  bannerUrl?: string;
  createdAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deriveStatus(startDate: string, endDate: string): PromotionStatus {
  const now   = new Date();
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (now < start) return "UPCOMING";
  if (now > end)   return "EXPIRED";
  return "ACTIVE";
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysRemaining(endDate: string): number {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
}

// ── Mock fetch ─────────────────────────────────────────────────────────────────
async function fetchPromotion(id: string): Promise<PromotionDetail> {
  await new Promise((res) => setTimeout(res, 400));
  const MOCK: Record<string, PromotionDetail> = {
    "1": { id: "1", title: "Summer Blockbuster Sale", description: "Get 20% off all tickets during the summer season. Valid for all movies and all seating types.", discountType: "PERCENTAGE", discountValue: 20, startDate: "2026-06-01", endDate: "2026-08-31", bannerUrl: "", createdAt: "2026-05-20" },
    "2": { id: "2", title: "Student Discount",        description: "50,000₫ off for valid student ID holders every Tuesday. Must present student card at the counter.", discountType: "FIXED_AMOUNT", discountValue: 50000, startDate: "2026-01-01", endDate: "2026-12-31", bannerUrl: "", createdAt: "2025-12-15" },
    "3": { id: "3", title: "Opening Week Special",    description: "30% off all seats for the first week of new releases. Applies automatically at checkout.", discountType: "PERCENTAGE", discountValue: 30, startDate: "2026-05-01", endDate: "2026-05-31", bannerUrl: "", createdAt: "2026-04-25" },
    "4": { id: "4", title: "VIP Member Weekend",      description: "100,000₫ off for Platinum members on weekends. Account tier is verified automatically.", discountType: "FIXED_AMOUNT", discountValue: 100000, startDate: "2026-08-01", endDate: "2026-09-30", bannerUrl: "", createdAt: "2026-07-10" },
  };
  const result = MOCK[id];
  if (!result) throw new Error("Promotion not found");
  return result;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PromotionStatus }) {
  const map: Record<PromotionStatus, { bg: string; color: string; label: string }> = {
    ACTIVE:   { bg: "rgba(16,185,129,0.1)",  color: "#059669", label: "Active"   },
    UPCOMING: { bg: "rgba(245,158,11,0.1)",  color: "#d97706", label: "Upcoming" },
    EXPIRED:  { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: "Expired"  },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <span style={{ fontSize: "13px", color: "var(--text-sub)", minWidth: "130px", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Info card ─────────────────────────────────────────────────────────────────
function InfoCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="flex items-center gap-2 mb-1" style={{ paddingBottom: "10px", borderBottom: "1px solid var(--border-color)", marginBottom: "4px" }}>
        <Icon size={14} style={{ color: "var(--text-sub)" }} />
        <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-sub)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  const [promotion, setPromotion] = useState<PromotionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetchPromotion(id)
      .then(setPromotion)
      .catch(() => setLoadError("Promotion not found."))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "240px" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: `${accentColor} transparent transparent transparent` }} />
      </div>
    );
  }

  if (loadError || !promotion) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ height: "240px", color: "var(--text-sub)" }}>
        <p style={{ fontSize: "14px" }}>{loadError || "Promotion not found."}</p>
        <button onClick={() => navigate("/admin/promotions")}
          className="px-4 py-2 rounded-xl border text-sm hover:opacity-80"
          style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
          Back to Promotions
        </button>
      </div>
    );
  }

  const status  = deriveStatus(promotion.startDate, promotion.endDate);
  const daysLeft = daysRemaining(promotion.endDate);
  const fmtDiscount = promotion.discountType === "PERCENTAGE"
    ? `${promotion.discountValue}%`
    : `${new Intl.NumberFormat("vi-VN").format(promotion.discountValue)}₫`;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4" style={{ marginBottom: "28px" }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/promotions")}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:opacity-80 transition-all"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "3px" }}>
              Promotion Details
            </h1>
            <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>ID: {promotion.id}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/admin/promotions/edit/${promotion.id}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all"
          style={{ fontSize: "14px", fontWeight: 500, background: accentColor }}>
          <Pencil size={14} /> Edit Promotion
        </button>
      </div>

      {/* 2-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", alignItems: "start" }}>

        {/* LEFT — hero card */}
        <div className="rounded-2xl border p-6 flex flex-col items-center text-center gap-4"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>

          {/* Icon avatar */}
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.1)", border: "2px solid rgba(245,158,11,0.2)" }}>
            <Tag size={36} style={{ color: "#f59e0b" }} />
          </div>

          {/* Title */}
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px", lineHeight: 1.3 }}>
              {promotion.title}
            </h2>
            <StatusBadge status={status} />
          </div>

          {/* Discount highlight */}
          <div className="w-full rounded-xl py-4 px-3"
            style={{ background: promotion.discountType === "PERCENTAGE" ? "rgba(16,185,129,0.08)" : "rgba(59,130,246,0.08)" }}>
            <div className="flex items-center justify-center gap-2">
              {promotion.discountType === "PERCENTAGE"
                ? <Percent size={20} style={{ color: "#10b981" }} />
                : <DollarSign size={20} style={{ color: "#3b82f6" }} />
              }
              <span style={{ fontSize: "28px", fontWeight: 700, color: promotion.discountType === "PERCENTAGE" ? "#10b981" : "#3b82f6" }}>
                {fmtDiscount}
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "4px" }}>
              {promotion.discountType === "PERCENTAGE" ? "Percentage discount" : "Fixed discount"}
            </p>
          </div>

          {/* Days remaining / elapsed */}
          {status === "ACTIVE" && (
            <div className="w-full rounded-xl py-3 px-3 text-center"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <p style={{ fontSize: "22px", fontWeight: 700, color: "#10b981" }}>{Math.max(0, daysLeft)}</p>
              <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>days remaining</p>
            </div>
          )}
          {status === "UPCOMING" && (
            <div className="w-full rounded-xl py-3 px-3 text-center"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <p style={{ fontSize: "22px", fontWeight: 700, color: "#d97706" }}>{Math.abs(daysLeft)}</p>
              <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>days until start</p>
            </div>
          )}
          {status === "EXPIRED" && (
            <div className="w-full rounded-xl py-3 px-3 text-center"
              style={{ background: "rgba(107,114,128,0.06)", border: "1px solid rgba(107,114,128,0.15)" }}>
              <p style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>This promotion has ended</p>
            </div>
          )}
        </div>

        {/* RIGHT — info cards */}
        <div style={{ display: "grid", gap: "16px" }}>

          {/* Description */}
          <InfoCard title="Description" icon={FileText}>
            <p style={{ fontSize: "14px", color: "var(--text-main)", lineHeight: 1.65, paddingTop: "8px" }}>
              {promotion.description}
            </p>
          </InfoCard>

          {/* Promotion Period */}
          <InfoCard title="Promotion Period" icon={Calendar}>
            <div>
              <InfoRow label="Start Date" value={fmtDate(promotion.startDate)} />
              <InfoRow label="End Date"   value={fmtDate(promotion.endDate)} />
              <InfoRow label="Duration"   value={`${Math.ceil((new Date(promotion.endDate).getTime() - new Date(promotion.startDate).getTime()) / 86_400_000)} days`} />
              <div className="flex items-start justify-between gap-4 py-3">
                <span style={{ fontSize: "13px", color: "var(--text-sub)", minWidth: "130px" }}>Status</span>
                <StatusBadge status={status} />
              </div>
            </div>
          </InfoCard>

          {/* Discount Details */}
          <InfoCard title="Discount Details" icon={promotion.discountType === "PERCENTAGE" ? Percent : DollarSign}>
            <div>
              <InfoRow label="Discount Type"  value={promotion.discountType === "PERCENTAGE" ? "Percentage (%)" : "Fixed Amount (₫)"} />
              <InfoRow label="Discount Value" value={
                <span style={{ fontWeight: 700, color: promotion.discountType === "PERCENTAGE" ? "#10b981" : "#3b82f6", fontSize: "15px" }}>
                  {fmtDiscount} off
                </span>
              } />
              {promotion.createdAt && (
                <InfoRow label="Created On" value={fmtDate(promotion.createdAt)} />
              )}
            </div>
          </InfoCard>

          {/* Banner */}
          <InfoCard title="Banner Image" icon={Image}>
            {promotion.bannerUrl ? (
              <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
                <img src={promotion.bannerUrl} alt="Promotion banner" className="w-full object-cover" style={{ maxHeight: "200px" }} />
              </div>
            ) : (
              <div className="mt-3 rounded-xl flex items-center justify-center py-8" style={{ background: "rgba(128,128,128,0.05)", border: "1px dashed var(--border-color)" }}>
                <div className="text-center">
                  <Image size={28} style={{ color: "var(--text-sub)", opacity: 0.4, margin: "0 auto 8px" }} />
                  <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>No banner uploaded</p>
                </div>
              </div>
            )}
          </InfoCard>

        </div>
      </div>
    </>
  );
}
