import { useState } from "react";
import { Search, Plus, SlidersHorizontal, RefreshCw, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, Tag, Percent, DollarSign } from "lucide-react";
import { useOutletContext, useNavigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────
export type DiscountType   = "PERCENTAGE" | "FIXED_AMOUNT";
export type PromotionStatus = "ACTIVE" | "UPCOMING" | "EXPIRED";

export interface PromotionData {
  id: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  bannerUrl?: string;
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

function fmtDiscount(type: DiscountType, value: number): string {
  return type === "PERCENTAGE"
    ? `${value}% off`
    : `${new Intl.NumberFormat("vi-VN").format(value)}₫ off`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_PROMOTIONS: PromotionData[] = [
  {
    id: "1",
    title: "Summer Blockbuster Sale",
    description: "Get 20% off all tickets during the summer season.",
    discountType: "PERCENTAGE",
    discountValue: 20,
    startDate: "2026-06-01",
    endDate: "2026-08-31",
  },
  {
    id: "2",
    title: "Student Discount",
    description: "50,000₫ off for valid student ID holders every Tuesday.",
    discountType: "FIXED_AMOUNT",
    discountValue: 50000,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  },
  {
    id: "3",
    title: "Opening Week Special",
    description: "30% off all seats for the first week of new releases.",
    discountType: "PERCENTAGE",
    discountValue: 30,
    startDate: "2026-05-01",
    endDate: "2026-05-31",
  },
  {
    id: "4",
    title: "VIP Member Weekend",
    description: "100,000₫ off for Platinum members on weekends.",
    discountType: "FIXED_AMOUNT",
    discountValue: 100000,
    startDate: "2026-08-01",
    endDate: "2026-09-30",
  },
];

const ITEMS_PER_PAGE = 8;

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PromotionStatus }) {
  const styles: Record<PromotionStatus, { bg: string; color: string; label: string }> = {
    ACTIVE:   { bg: "rgba(16,185,129,0.08)",  color: "#059669", label: "Active"    },
    UPCOMING: { bg: "rgba(245,158,11,0.08)",  color: "#d97706", label: "Upcoming"  },
    EXPIRED:  { bg: "rgba(107,114,128,0.08)", color: "#6b7280", label: "Expired"   },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

// ── Stat cards ────────────────────────────────────────────────────────────────
function PromotionStatsCards({ total, active, upcoming, expired }: { total: number; active: number; upcoming: number; expired: number }) {
  const cards = [
    { label: "Total",    value: total,    color: "#3b82f6", bg: "rgba(59,130,246,0.08)"  },
    { label: "Active",   value: active,   color: "#10b981", bg: "rgba(16,185,129,0.08)"  },
    { label: "Upcoming", value: upcoming, color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
    { label: "Expired",  value: expired,  color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
  ];
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map(({ label, value, color, bg }) => (
        <div key={label} className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "8px" }}>
            {label}
          </p>
          <div className="flex items-end gap-3">
            <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1 }}>{value}</span>
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold mb-0.5" style={{ color, background: bg }}>
              promotions
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ promotion, onConfirm, onCancel }: { promotion: PromotionData; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 mx-auto mb-4">
          <Trash2 size={22} className="text-rose-500" />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "8px" }}>
          Delete Promotion
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-sub)", textAlign: "center", marginBottom: "20px" }}>
          Are you sure you want to delete{" "}
          <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{promotion.title}</span>?
          <br />This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
            style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all"
            style={{ background: "#ef4444" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ManagePromotionPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const navigate = useNavigate();

  const [promotions, setPromotions] = useState<PromotionData[]>(MOCK_PROMOTIONS);
  const [searchQuery, setSearchQuery]   = useState("");
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "">("");
  const [showFilters, setShowFilters]   = useState(false);
  const [page, setPage]                 = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<PromotionData | null>(null);

  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  // ── Filtering ──────────────────────────────────────────────────────────────
  const withStatus = promotions.map((p) => ({ ...p, status: deriveStatus(p.startDate, p.endDate) }));

  const filtered = withStatus.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const stats = {
    total:    withStatus.length,
    active:   withStatus.filter((p) => p.status === "ACTIVE").length,
    upcoming: withStatus.filter((p) => p.status === "UPCOMING").length,
    expired:  withStatus.filter((p) => p.status === "EXPIRED").length,
  };

  const handleDelete = (id: string) => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    setDeleteTarget(null);
  };

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          promotion={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Promotion Management
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Create and manage discount promotions and banner campaigns.
        </p>
      </div>

      {/* Stats */}
      <PromotionStatsCards {...stats} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text"
            placeholder="Search by title or description..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500"
              style={{ fontSize: "16px", lineHeight: 1, color: "var(--text-sub)" }}>×</button>
          )}
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <SlidersHorizontal size={15} /> Filters
          {statusFilter && <span className="w-2 h-2 rounded-full ml-0.5" style={{ background: accentColor }} />}
        </button>

        <button
          onClick={() => { setPromotions(MOCK_PROMOTIONS); setPage(1); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>

        <button
          onClick={() => navigate("/admin/promotions/create")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: accentColor }}
        >
          <Plus size={16} /> Add Promotion
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap p-4 rounded-xl border mb-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Filter by Status:</p>
          <div className="flex items-center gap-1 filter-btns">
            {[
              { value: "",          label: "All",      cls: "active-gray" },
              { value: "ACTIVE",    label: "Active",   cls: "active-green" },
              { value: "UPCOMING",  label: "Upcoming", cls: "active-amber" },
              { value: "EXPIRED",   label: "Expired",  cls: "active-slate" },
            ].map(({ value, label, cls }) => (
              <button
                key={value}
                onClick={() => { setStatusFilter(value as PromotionStatus | ""); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === value ? cls : ""}`}
              >
                {label}
                {value && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.15)" }}>
                    {value === "ACTIVE" ? stats.active : value === "UPCOMING" ? stats.upcoming : stats.expired}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
                {["Promotion", "Discount", "Date Range", "Status", "Actions"].map((h) => (
                  <th key={h} className={`px-5 py-3.5 ${h === "Actions" ? "text-right" : "text-left"}`}>
                    <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                    No promotions found.
                  </td>
                </tr>
              ) : (
                pageItems.map((promo) => (
                  <tr
                    key={promo.id}
                    style={{ transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Promotion */}
                    <td className="px-5 py-3.5" style={{ maxWidth: "320px" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(245,158,11,0.1)" }}>
                          <Tag size={16} style={{ color: "#f59e0b" }} />
                        </div>
                        <div className="min-w-0">
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>{promo.title}</p>
                          <p className="truncate" style={{ fontSize: "12px", color: "var(--text-sub)", maxWidth: "260px" }}>{promo.description}</p>
                        </div>
                      </div>
                    </td>

                    {/* Discount */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {promo.discountType === "PERCENTAGE"
                          ? <Percent size={13} style={{ color: "#10b981" }} />
                          : <DollarSign size={13} style={{ color: "#3b82f6" }} />
                        }
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                          {fmtDiscount(promo.discountType, promo.discountValue)}
                        </span>
                      </div>
                    </td>

                    {/* Date Range */}
                    <td className="px-5 py-3.5">
                      <p style={{ fontSize: "13px", color: "var(--text-main)" }}>{fmtDate(promo.startDate)}</p>
                      <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>→ {fmtDate(promo.endDate)}</p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={promo.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/promotions/${promo.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                          style={{ color: "var(--text-sub)" }}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/promotions/edit/${promo.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                          style={{ color: "var(--text-sub)" }}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(promo)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-rose-50 transition-colors"
                          style={{ color: "var(--text-sub)" }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
            Showing{" "}
            <span style={{ color: "var(--text-main)", fontWeight: 500 }}>
              {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
            </span>{" "}
            of <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> promotions
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ color: "var(--text-sub)" }}>
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => Math.abs(p - safePage) <= 2).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ fontSize: "13px", fontWeight: p === safePage ? 600 : 400, background: p === safePage ? accentColor : "transparent", color: p === safePage ? "#fff" : "var(--text-sub)" }}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ color: "var(--text-sub)" }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .filter-btns button { background: transparent; color: var(--text-sub); border-color: var(--border-color); }
        .filter-btns button:hover { background: rgba(128,128,128,0.1); color: var(--text-main); }
        .filter-btns button.active-gray  { background: #6b7280 !important; color: #fff !important; border-color: #6b7280 !important; }
        .filter-btns button.active-green { background: #059669 !important; color: #fff !important; border-color: #059669 !important; }
        .filter-btns button.active-amber { background: #d97706 !important; color: #fff !important; border-color: #d97706 !important; }
        .filter-btns button.active-slate { background: #475569 !important; color: #fff !important; border-color: #475569 !important; }
      `}</style>
    </>
  );
}
