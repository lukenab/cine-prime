import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  History,
  LoaderCircle,
  MoreHorizontal,
  Package,
  Save,
  ShoppingBasket,
  Square,
  X,
} from "lucide-react";
import {
  concessionApi,
  type ClusterInventory,
  type ClusterOffer,
  type OfferAudit,
  type OfferMutation,
} from "../../../api/concessionApi";
import type { ClusterResponse } from "../../../api/movieApi";

export type PricingSellable = {
  type: "SKU" | "COMBO";
  id: number;
  code: string;
  name: string;
  category: string;
  active: boolean;
  stockSkuIds: number[];
};

export type PricingDraft = {
  price: number;
  available: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
};

type OperationalStatus = "MISSING" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "SOLD_OUT" | "EXPIRED";

const inputClass =
  "w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 py-2.5 text-sm font-medium text-[var(--text-main)] transition hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-40";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40";

const toLocalInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const toIso = (value?: string) => value ? new Date(value).toISOString() : undefined;

const formatMoney = (value: number, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(value);

const requestMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const statusFor = (
  item: PricingSellable,
  offer: ClusterOffer | undefined,
  inventory: Map<number, ClusterInventory>,
): OperationalStatus => {
  if (!offer) return "MISSING";
  const now = Date.now();
  if (offer.effectiveTo && new Date(offer.effectiveTo).getTime() <= now) return "EXPIRED";
  if (offer.effectiveFrom && new Date(offer.effectiveFrom).getTime() > now) return "SCHEDULED";
  if (!offer.available) return "PAUSED";
  if (item.stockSkuIds.length && item.stockSkuIds.some((skuId) => {
    const row = inventory.get(skuId);
    return (row?.onHand ?? 0) - (row?.reserved ?? 0) <= 0;
  })) return "SOLD_OUT";
  return "ACTIVE";
};

export default function ConcessionPricingWorkspace({
  items,
  offers,
  branchLoading,
  cluster,
  clusters,
  inventory,
  working,
  onSave,
  onReload,
  onError,
  onNotice,
}: {
  items: PricingSellable[];
  offers: Map<string, ClusterOffer>;
  branchLoading: boolean;
  cluster?: ClusterResponse;
  clusters: ClusterResponse[];
  inventory: Map<number, ClusterInventory>;
  working: string;
  onSave: (item: PricingSellable, draft: PricingDraft) => Promise<void>;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PricingSellable | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const keyOf = (item: PricingSellable) => `${item.type}:${item.id}`;
  const selectedItems = items.filter((item) => selected.has(keyOf(item)));
  const allSelected = items.length > 0 && items.every((item) => selected.has(keyOf(item)));

  useEffect(() => {
    setSelected(new Set());
    setBulkMode(false);
    setEditingItem(null);
    setMoreOpen(false);
  }, [cluster?.clusterId]);

  const applyBulk = async (settings: BulkSettings) => {
    if (!cluster || !selectedItems.length) return;
    setActionBusy(true);
    onError("");
    try {
      const payload: OfferMutation[] = selectedItems.map((item) => {
        const current = offers.get(keyOf(item));
        const currentPrice = current?.price ?? 0;
        return {
          sellableType: item.type,
          sellableId: item.id,
          price: Math.max(0, Math.round(currentPrice * (1 + settings.adjustment / 100))),
          currency: current?.currency ?? "VND",
          available: settings.availability === "KEEP"
            ? current?.available ?? false
            : settings.availability === "AVAILABLE",
          effectiveFrom: settings.effectiveFrom ? toIso(settings.effectiveFrom) : current?.effectiveFrom,
          effectiveTo: settings.effectiveTo ? toIso(settings.effectiveTo) : current?.effectiveTo,
        };
      });
      if (payload.some((row) => row.price <= 0)) {
        throw new Error("Configure a base price before applying a percentage adjustment.");
      }
      await concessionApi.admin.bulkSaveOffers(cluster.clusterId, payload);
      await onReload();
      setSelected(new Set());
      setBulkOpen(false);
      setBulkMode(false);
      onNotice(`${payload.length} pricing records updated.`);
    } catch (error: any) {
      onError(requestMessage(error, "Bulk pricing could not be applied."));
    } finally {
      setActionBusy(false);
    }
  };

  const copyPricing = async (sourceClusterId: number, overwrite: boolean) => {
    if (!cluster) return;
    setActionBusy(true);
    onError("");
    try {
      const copied = await concessionApi.admin.copyOffers(cluster.clusterId, sourceClusterId, overwrite);
      await onReload();
      setCopyOpen(false);
      onNotice(`${copied.length} pricing records copied to ${cluster.clusterName}.`);
    } catch (error: any) {
      onError(requestMessage(error, "Price book could not be copied."));
    } finally {
      setActionBusy(false);
    }
  };

  if (!cluster) return <PricingEmpty title="Select an active cinema cluster" description="Pricing is configured independently for each cinema branch." />;
  if (branchLoading) return <PricingLoading label={`Loading pricing for ${cluster.clusterName}…`} />;
  if (!items.length) return <PricingEmpty title="No sellable items found" description="Try another filter or add products and combos first." />;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-color)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Branch price book</h2>
            <p className="mt-0.5 text-xs text-[var(--text-sub)]">
              {items.length} sellable items at {cluster.clusterName}. Select an item to update its price or selling status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {bulkMode ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setBulkMode(false);
                    setSelected(new Set());
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
                <button type="button" disabled={!selectedItems.length} onClick={() => setBulkOpen(true)} className={primaryButtonClass}>
                  <CheckSquare size={14} /> Edit selected {selectedItems.length ? `(${selectedItems.length})` : ""}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setBulkMode(true)} className={secondaryButtonClass}>
                <CheckSquare size={14} /> Bulk edit
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className={secondaryButtonClass}
                aria-expanded={moreOpen}
              >
                <MoreHorizontal size={16} /> More actions
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-52 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      setAuditOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)]"
                  >
                    <History size={15} /> Pricing history
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      setCopyOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)]"
                  >
                    <Copy size={15} /> Copy price book
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b border-[var(--border-color)] bg-[var(--bg-main)] text-[11px] uppercase tracking-wide text-[var(--text-sub)]">
              <tr>
                {bulkMode && (
                  <th className="w-12 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(allSelected ? new Set() : new Set(items.map(keyOf)))}
                      className="text-[var(--text-sub)] hover:text-blue-500"
                      aria-label={allSelected ? "Clear selection" : "Select all"}
                    >
                      {allSelected ? <CheckSquare size={17} className="text-blue-500" /> : <Square size={17} />}
                    </button>
                  </th>
                )}
                <th className="px-5 py-3 font-semibold">Product / SKU</th>
                <th className="px-4 py-3 font-semibold">Current price</th>
                <th className="px-4 py-3 font-semibold">Selling</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Next schedule</th>
                <th className="w-14 px-4 py-3 text-right font-semibold"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {items.map((item) => {
                const key = keyOf(item);
                return (
                  <PricingRow
                    key={key}
                    item={item}
                    offer={offers.get(key)}
                    inventory={inventory}
                    bulkMode={bulkMode}
                    selected={selected.has(key)}
                    onSelect={() => setSelected((current) => {
                      const next = new Set(current);
                      next.has(key) ? next.delete(key) : next.add(key);
                      return next;
                    })}
                    onEdit={() => setEditingItem(item)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editingItem && (
        <PricingEditDrawer
          key={`${cluster.clusterId}:${keyOf(editingItem)}`}
          item={editingItem}
          offer={offers.get(keyOf(editingItem))}
          inventory={inventory}
          saving={working === `offer-${editingItem.type}-${editingItem.id}`}
          onClose={() => setEditingItem(null)}
          onSave={(draft) => void onSave(editingItem, draft)}
        />
      )}
      {bulkOpen && <BulkPricingModal count={selectedItems.length} busy={actionBusy} onClose={() => setBulkOpen(false)} onApply={(settings) => void applyBulk(settings)} />}
      {copyOpen && (
        <CopyPricingModal
          target={cluster}
          sources={clusters.filter((item) => item.clusterId !== cluster.clusterId)}
          busy={actionBusy}
          onClose={() => setCopyOpen(false)}
          onCopy={(sourceId, overwrite) => void copyPricing(sourceId, overwrite)}
        />
      )}
      {auditOpen && <PricingAuditModal cluster={cluster} onClose={() => setAuditOpen(false)} />}
    </>
  );
}

function PricingRow({
  item,
  offer,
  inventory,
  bulkMode,
  selected,
  onSelect,
  onEdit,
}: {
  item: PricingSellable;
  offer?: ClusterOffer;
  inventory: Map<number, ClusterInventory>;
  bulkMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const operationalStatus = statusFor(item, offer, inventory);
  const stock = stockFor(item, inventory);
  const selling = sellingFor(offer, operationalStatus);
  const schedule = scheduleFor(offer);

  return (
    <tr
      className={`group transition hover:bg-blue-500/[0.035] ${selected ? "bg-blue-500/[0.05]" : ""}`}
      onClick={() => bulkMode ? onSelect() : onEdit()}
    >
      {bulkMode && (
        <td className="px-4 py-3.5">
          <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} className="text-[var(--text-sub)] hover:text-blue-500" aria-label={selected ? "Deselect item" : "Select item"}>
            {selected ? <CheckSquare size={17} className="text-blue-500" /> : <Square size={17} />}
          </button>
        </td>
      )}
      <td className="cursor-pointer px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.type === "COMBO" ? "bg-violet-500/10 text-violet-500" : "bg-blue-500/10 text-blue-500"}`}>
            {item.type === "COMBO" ? <ShoppingBasket size={16} /> : <Package size={16} />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-main)]">{item.name}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-sub)]">{item.code} · {item.category} · {item.type}</p>
          </div>
        </div>
      </td>
      <td className="cursor-pointer px-4 py-3.5">
        {offer ? (
          <p className="text-sm font-semibold text-[var(--text-main)]">{formatMoney(offer.price, offer.currency)}</p>
        ) : (
          <span className="text-xs font-medium text-amber-500">Not configured</span>
        )}
      </td>
      <td className="cursor-pointer px-4 py-3.5">
        <CompactBadge label={selling.label} tone={selling.tone} />
      </td>
      <td className="cursor-pointer px-4 py-3.5">
        <div>
          <p className={`text-xs font-semibold ${stock.tone}`}>{stock.label}</p>
          {stock.helper && <p className="mt-0.5 text-[11px] text-[var(--text-sub)]">{stock.helper}</p>}
        </div>
      </td>
      <td className="cursor-pointer px-4 py-3.5">
        <p className={`text-xs ${schedule.active ? "font-medium text-blue-500" : "text-[var(--text-sub)]"}`}>{schedule.label}</p>
      </td>
      <td className="px-4 py-3.5 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            bulkMode ? onSelect() : onEdit();
          }}
          className="rounded-lg p-2 text-[var(--text-sub)] transition hover:bg-blue-500/10 hover:text-blue-500"
          aria-label={bulkMode ? "Select item" : `Edit ${item.name}`}
        >
          <ChevronRight size={17} />
        </button>
      </td>
    </tr>
  );
}

function stockFor(item: PricingSellable, inventory: Map<number, ClusterInventory>) {
  if (!item.stockSkuIds.length) {
    return { label: "Not tracked", helper: "", tone: "text-[var(--text-sub)]" };
  }
  const available = item.stockSkuIds.map((skuId) => {
    const row = inventory.get(skuId);
    return (row?.onHand ?? 0) - (row?.reserved ?? 0);
  });
  const minimum = Math.min(...available);
  if (minimum <= 0) return { label: "Sold out", helper: item.type === "COMBO" ? "Component unavailable" : "0 available", tone: "text-rose-500" };
  if (minimum <= 10) return { label: "Low stock", helper: item.type === "COMBO" ? "Check components" : `${minimum} available`, tone: "text-amber-500" };
  return { label: "In stock", helper: item.type === "COMBO" ? "Components available" : `${minimum} available`, tone: "text-emerald-500" };
}

function sellingFor(offer: ClusterOffer | undefined, status: OperationalStatus) {
  if (!offer) return { label: "Not configured", tone: "neutral" as const };
  if (!offer.available) return { label: "Paused", tone: "amber" as const };
  if (status === "SCHEDULED") return { label: "Scheduled", tone: "blue" as const };
  if (status === "EXPIRED") return { label: "Expired", tone: "violet" as const };
  return { label: "On sale", tone: "green" as const };
}

function scheduleFor(offer?: ClusterOffer) {
  if (!offer) return { label: "No schedule", active: false };
  const now = Date.now();
  if (offer.effectiveFrom && new Date(offer.effectiveFrom).getTime() > now) {
    return { label: `Starts ${formatScheduleDate(offer.effectiveFrom)}`, active: true };
  }
  if (offer.effectiveTo) {
    const ended = new Date(offer.effectiveTo).getTime() <= now;
    return { label: `${ended ? "Ended" : "Ends"} ${formatScheduleDate(offer.effectiveTo)}`, active: !ended };
  }
  return { label: "No schedule", active: false };
}

const formatScheduleDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

function CompactBadge({ label, tone }: { label: string; tone: "neutral" | "green" | "amber" | "blue" | "violet" }) {
  const styles = {
    neutral: "bg-slate-500/10 text-[var(--text-sub)]",
    green: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    blue: "bg-blue-500/10 text-blue-500",
    violet: "bg-violet-500/10 text-violet-500",
  };
  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-semibold ${styles[tone]}`}>{label}</span>;
}

function PricingEditDrawer({
  item,
  offer,
  inventory,
  saving,
  onClose,
  onSave,
}: {
  item: PricingSellable;
  offer?: ClusterOffer;
  inventory: Map<number, ClusterInventory>;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: PricingDraft) => void;
}) {
  const [price, setPrice] = useState(offer?.price ?? 0);
  const [available, setAvailable] = useState(offer?.available ?? false);
  const [effectiveFrom, setEffectiveFrom] = useState(toLocalInput(offer?.effectiveFrom));
  const [effectiveTo, setEffectiveTo] = useState(toLocalInput(offer?.effectiveTo));
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(offer?.effectiveFrom || offer?.effectiveTo));

  useEffect(() => {
    setPrice(offer?.price ?? 0);
    setAvailable(offer?.available ?? false);
    setEffectiveFrom(toLocalInput(offer?.effectiveFrom));
    setEffectiveTo(toLocalInput(offer?.effectiveTo));
  }, [offer?.id, offer?.price, offer?.available, offer?.effectiveFrom, offer?.effectiveTo]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const dirty = !offer
    || price !== offer.price
    || available !== offer.available
    || effectiveFrom !== toLocalInput(offer.effectiveFrom)
    || effectiveTo !== toLocalInput(offer.effectiveTo);
  const invalidWindow = Boolean(effectiveFrom && effectiveTo && new Date(effectiveTo) <= new Date(effectiveFrom));
  const status = statusFor(item, offer, inventory);
  const stock = stockFor(item, inventory);

  return (
    <div className="fixed inset-0 z-[96] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl" role="dialog" aria-modal="true" aria-label={`Edit pricing for ${item.name}`}>
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.type === "COMBO" ? "bg-violet-500/10 text-violet-500" : "bg-blue-500/10 text-blue-500"}`}>
                {item.type === "COMBO" ? <ShoppingBasket size={16} /> : <Package size={16} />}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-[var(--text-main)]">{item.name}</h2>
                <p className="mt-0.5 text-xs text-[var(--text-sub)]">{item.code} · {item.type}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-sub)] hover:bg-[var(--bg-main)]" aria-label="Close pricing editor"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-sub)]">Current status</p>
              <div className="mt-2"><StatusBadge status={status} /></div>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-sub)]">Stock</p>
              <p className={`mt-2 text-xs font-semibold ${stock.tone}`}>{stock.label}</p>
              {stock.helper && <p className="mt-0.5 text-[10px] text-[var(--text-sub)]">{stock.helper}</p>}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <PricingField label="Selling price">
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={price}
                    onChange={(event) => setPrice(Math.max(0, Number(event.target.value)))}
                    className={`${inputClass} h-[66px] pr-16 text-base font-semibold`}
                    autoFocus
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-sub)]">VND</span>
                </div>
              </PricingField>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--text-sub)]">Selling status</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={available}
                  onClick={() => setAvailable((value) => !value)}
                  className={`flex min-h-[66px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    available
                      ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                      : "border-[var(--border-color)] bg-[var(--bg-main)]"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text-main)]">{available ? "On sale" : "Paused"}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--text-sub)]">
                      {available ? "Visible when inventory is available." : "Hidden from customer checkout."}
                    </span>
                  </span>
                  <span className={`relative ml-4 h-6 w-11 shrink-0 rounded-full transition ${available ? "bg-emerald-500" : "bg-slate-400/35"}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${available ? "left-6" : "left-1"}`} />
                  </span>
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setScheduleOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 bg-[var(--bg-main)] px-4 py-3.5 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500"><CalendarClock size={15} /></span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text-main)]">Schedule price</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--text-sub)]">
                      {effectiveFrom || effectiveTo ? scheduleFor({ ...offer, effectiveFrom: effectiveFrom || undefined, effectiveTo: effectiveTo || undefined } as ClusterOffer).label : "Optional start and end time"}
                    </span>
                  </span>
                </span>
                <ChevronDown size={16} className={`text-[var(--text-sub)] transition ${scheduleOpen ? "rotate-180" : ""}`} />
              </button>
              {scheduleOpen && (
                <div className="border-t border-[var(--border-color)] p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PricingField label="Effective from">
                      <input type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className={inputClass} />
                    </PricingField>
                    <PricingField label="Effective until">
                      <input type="datetime-local" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} className={`${inputClass} ${invalidWindow ? "!border-rose-500" : ""}`} />
                    </PricingField>
                  </div>
                  {invalidWindow && <p className="text-xs text-rose-500">End time must be later than start time.</p>}
                  {(effectiveFrom || effectiveTo) && (
                    <button type="button" onClick={() => { setEffectiveFrom(""); setEffectiveTo(""); }} className="mt-4 text-xs font-semibold text-[var(--text-sub)] hover:text-rose-500">
                      Clear schedule
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="border-t border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
          {!item.active && <p className="mb-3 text-xs text-amber-500">This catalog item is disabled and cannot be priced.</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
            <button
              type="button"
              disabled={!dirty || saving || !item.active || price <= 0 || invalidWindow}
              onClick={() => onSave({ price, available, effectiveFrom, effectiveTo })}
              className={primaryButtonClass}
            >
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
              Save changes
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: OperationalStatus }) {
  const styles: Record<OperationalStatus, string> = {
    MISSING: "bg-slate-500/10 text-[var(--text-sub)]",
    SCHEDULED: "bg-blue-500/10 text-blue-500",
    ACTIVE: "bg-emerald-500/10 text-emerald-500",
    PAUSED: "bg-amber-500/10 text-amber-500",
    SOLD_OUT: "bg-rose-500/10 text-rose-500",
    EXPIRED: "bg-violet-500/10 text-violet-500",
  };
  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-semibold ${styles[status]}`}>{status.replace("_", " ")}</span>;
}

type BulkSettings = {
  adjustment: number;
  availability: "KEEP" | "AVAILABLE" | "PAUSED";
  effectiveFrom: string;
  effectiveTo: string;
};

function BulkPricingModal({ count, busy, onClose, onApply }: { count: number; busy: boolean; onClose: () => void; onApply: (settings: BulkSettings) => void }) {
  const [adjustment, setAdjustment] = useState(0);
  const [availability, setAvailability] = useState<BulkSettings["availability"]>("KEEP");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const invalidWindow = Boolean(effectiveFrom && effectiveTo && new Date(effectiveTo) <= new Date(effectiveFrom));
  return (
    <PricingModal title="Bulk edit pricing" subtitle={`${count} selected sellables`} onClose={onClose}>
      <div className="space-y-4 p-5">
        <PricingField label="Price adjustment (%)" hint="Use a negative value to reduce prices. Enter 0 to keep current prices.">
          <input type="number" min={-100} max={1000} value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} className={inputClass} />
        </PricingField>
        <PricingField label="Manual availability">
          <select value={availability} onChange={(event) => setAvailability(event.target.value as BulkSettings["availability"])} className={inputClass}>
            <option value="KEEP">Keep current setting</option>
            <option value="AVAILABLE">Enable sale</option>
            <option value="PAUSED">Pause sale</option>
          </select>
        </PricingField>
        <div className="grid grid-cols-2 gap-3">
          <PricingField label="Effective from"><input type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className={inputClass} /></PricingField>
          <PricingField label="Effective until"><input type="datetime-local" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} className={`${inputClass} ${invalidWindow ? "!border-rose-500" : ""}`} /></PricingField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="button" disabled={busy || invalidWindow} onClick={() => onApply({ adjustment, availability, effectiveFrom, effectiveTo })} className={primaryButtonClass}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <CheckSquare size={15} />} Apply to {count}
          </button>
        </div>
      </div>
    </PricingModal>
  );
}

function CopyPricingModal({ target, sources, busy, onClose, onCopy }: {
  target: ClusterResponse;
  sources: ClusterResponse[];
  busy: boolean;
  onClose: () => void;
  onCopy: (sourceId: number, overwrite: boolean) => void;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.clusterId ?? 0);
  const [overwrite, setOverwrite] = useState(false);
  return (
    <PricingModal title="Copy price book" subtitle={`Destination: ${target.clusterName}`} onClose={onClose}>
      <div className="space-y-4 p-5">
        <PricingField label="Source cinema cluster">
          <select value={sourceId} onChange={(event) => setSourceId(Number(event.target.value))} className={inputClass}>
            {!sources.length && <option value={0}>No other active cluster</option>}
            {sources.map((source) => <option key={source.clusterId} value={source.clusterId}>{source.clusterName}</option>)}
          </select>
        </PricingField>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-color)] p-3.5">
          <span><strong className="block text-sm text-[var(--text-main)]">Overwrite configured prices</strong><small className="mt-0.5 block text-xs text-[var(--text-sub)]">Otherwise only missing prices are copied.</small></span>
          <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} className="h-4 w-4 accent-blue-600" />
        </label>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-[var(--text-sub)]">
          Price, manual availability and effective dates are copied. Every changed record is audited.
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="button" disabled={busy || !sourceId} onClick={() => onCopy(sourceId, overwrite)} className={primaryButtonClass}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />} Copy pricing
          </button>
        </div>
      </div>
    </PricingModal>
  );
}

function PricingAuditModal({ cluster, onClose }: { cluster: ClusterResponse; onClose: () => void }) {
  const [rows, setRows] = useState<OfferAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    concessionApi.admin.getOfferAudit(cluster.clusterId)
      .then(setRows)
      .catch((requestError) => setError(requestMessage(requestError, "Pricing history could not be loaded.")))
      .finally(() => setLoading(false));
  }, [cluster.clusterId]);
  return (
    <PricingModal title="Pricing history" subtitle={cluster.clusterName} onClose={onClose} wide>
      <div className="max-h-[70vh] overflow-y-auto p-5">
        {loading ? <PricingLoading label="Loading pricing history…" /> : error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-500">{error}</div>
        ) : rows.length ? (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="grid gap-3 rounded-xl border border-[var(--border-color)] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-[var(--text-main)]">{row.sellableName || row.sellableCode || `${row.sellableType} ${row.sellableId}`}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${row.sellableType === "COMBO" ? "bg-violet-500/10 text-violet-500" : "bg-blue-500/10 text-blue-500"}`}>{row.sellableType}</span>
                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500">{row.operation.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-sub)]">{row.changedBy} · {new Date(row.changedAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--text-main)]">{row.oldPrice == null ? "New" : formatMoney(row.oldPrice, row.currency)} → {formatMoney(row.newPrice, row.currency)}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-sub)]">{row.newAvailable ? "Sale enabled" : "Sale paused"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <PricingEmpty title="No pricing changes yet" description="Saved price changes will appear here." compact />}
      </div>
    </PricingModal>
  );
}

function PricingModal({ title, subtitle, onClose, children, wide = false }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`w-full overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div><h2 className="font-semibold text-[var(--text-main)]">{title}</h2><p className="mt-0.5 text-xs text-[var(--text-sub)]">{subtitle}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-sub)] hover:bg-[var(--bg-main)]"><X size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function PricingField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[var(--text-sub)]">{label}</span>{children}{hint && <span className="mt-1.5 block text-[11px] text-[var(--text-sub)]">{hint}</span>}</label>;
}

function PricingLoading({ label }: { label: string }) {
  return <div className="grid min-h-52 place-items-center"><div className="text-center"><LoaderCircle size={22} className="mx-auto animate-spin text-blue-500" /><p className="mt-3 text-sm text-[var(--text-sub)]">{label}</p></div></div>;
}

function PricingEmpty({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <div className={`grid place-items-center rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] px-6 text-center ${compact ? "min-h-40" : "min-h-72"}`}><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-500"><BadgeDollarSign size={21} /></span><h3 className="mt-3 text-sm font-semibold text-[var(--text-main)]">{title}</h3><p className="mt-1 text-xs text-[var(--text-sub)]">{description}</p></div></div>;
}
