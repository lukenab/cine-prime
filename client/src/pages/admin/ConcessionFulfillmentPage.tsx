import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock3,
  MapPin,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { concessionApi, type ConcessionOrder } from "../../api/concessionApi";
import { movieApi, type ClusterResponse } from "../../api/movieApi";

type QueueFilter = "ALL" | ConcessionOrder["status"];
type TimeFilter = "ALL" | "30_MIN" | "60_MIN" | "TODAY";
type SortOrder = "OLDEST" | "NEWEST";

const CLUSTER_STORAGE_KEY = "cineprime:fulfillment-cluster";

const FILTER_TABS: Array<{
  value: QueueFilter;
  label: string;
  color: string;
}> = [
  { value: "ALL", label: "All", color: "#2563eb" },
  { value: "PAID", label: "Paid", color: "#0284c7" },
  { value: "PREPARING", label: "Preparing", color: "#d97706" },
  { value: "READY", label: "Ready", color: "#059669" },
  { value: "COLLECTED", label: "Collected", color: "#64748b" },
];

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: "ALL", label: "All times" },
  { value: "30_MIN", label: "Last 30 minutes" },
  { value: "60_MIN", label: "Last hour" },
  { value: "TODAY", label: "Today" },
];

const STATUS_META: Record<
  ConcessionOrder["status"],
  { label: string; text: string; background: string }
> = {
  PAID: { label: "Paid", text: "#0369a1", background: "rgba(14, 165, 233, 0.12)" },
  PREPARING: { label: "Preparing", text: "#b45309", background: "rgba(245, 158, 11, 0.14)" },
  READY: { label: "Ready", text: "#047857", background: "rgba(16, 185, 129, 0.13)" },
  COLLECTED: { label: "Collected", text: "#64748b", background: "rgba(100, 116, 139, 0.12)" },
};

const money = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const orderTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const matchesTimeFilter = (order: ConcessionOrder, filter: TimeFilter) => {
  if (filter === "ALL") return true;
  const paidAt = new Date(order.paidAt);
  const now = new Date();
  if (filter === "30_MIN") return now.getTime() - paidAt.getTime() <= 30 * 60 * 1000;
  if (filter === "60_MIN") return now.getTime() - paidAt.getTime() <= 60 * 60 * 1000;
  return paidAt.toDateString() === now.toDateString();
};

export default function ConcessionFulfillmentPage() {
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [clusterId, setClusterId] = useState<number | null>(null);
  const [orders, setOrders] = useState<ConcessionOrder[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("OLDEST");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const loadClusters = useCallback(async () => {
    setClustersLoading(true);
    setError("");
    try {
      const response = await movieApi.getClusters();
      const activeClusters = (response.result ?? [])
        .filter((cluster) => cluster.status === "ACTIVE")
        .sort((a, b) => a.clusterName.localeCompare(b.clusterName));

      setClusters(activeClusters);
      setClusterId((current) => {
        if (current && activeClusters.some((cluster) => cluster.clusterId === current)) {
          return current;
        }
        const saved = Number(localStorage.getItem(CLUSTER_STORAGE_KEY));
        if (saved && activeClusters.some((cluster) => cluster.clusterId === saved)) {
          return saved;
        }
        return activeClusters[0]?.clusterId ?? null;
      });

      if (!activeClusters.length) {
        setError("No active cinema cluster is available for concession fulfillment.");
      }
    } catch (requestError: any) {
      setClusters([]);
      setClusterId(null);
      setError(requestError?.response?.data?.message || "Cinema clusters could not be loaded.");
    } finally {
      setClustersLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async (mode: "initial" | "manual" | "background" = "initial") => {
    if (!clusterId) return;
    if (mode === "initial") setLoading(true);
    if (mode === "manual") setRefreshing(true);
    if (mode !== "background") setError("");
    try {
      const result = await concessionApi.getOrders(clusterId);
      setOrders(result);
      localStorage.setItem(CLUSTER_STORAGE_KEY, String(clusterId));
    } catch (requestError: any) {
      if (mode !== "background") {
        setError(requestError?.response?.data?.message || "Fulfillment queue could not be loaded.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clusterId]);

  useEffect(() => {
    void loadClusters();
  }, [loadClusters]);

  useEffect(() => {
    if (!clusterId) {
      setOrders([]);
      return;
    }
    void loadOrders("initial");
    const timer = window.setInterval(() => void loadOrders("background"), 15_000);
    return () => clearInterval(timer);
  }, [clusterId, loadOrders]);

  const counts = useMemo(() => {
    const result: Record<ConcessionOrder["status"], number> = {
      PAID: 0,
      PREPARING: 0,
      READY: 0,
      COLLECTED: 0,
    };
    orders.forEach((order) => {
      result[order.status] += 1;
    });
    return result;
  }, [orders]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return orders
      .filter((order) => filter === "ALL" || order.status === filter)
      .filter((order) => matchesTimeFilter(order, timeFilter))
      .filter((order) =>
        !needle
        || order.pickupCode.toLocaleLowerCase().includes(needle)
        || order.bookingId.toLocaleLowerCase().includes(needle)
        || order.items.some((item) => item.itemName.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => {
        const difference = new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime();
        return sortOrder === "OLDEST" ? difference : -difference;
      });
  }, [filter, orders, query, sortOrder, timeFilter]);

  const selectedCluster = clusters.find((cluster) => cluster.clusterId === clusterId);
  const activeCount = counts.PAID + counts.PREPARING + counts.READY;
  const activeFilterCount = Number(timeFilter !== "ALL") + Number(sortOrder !== "OLDEST");

  const transition = async (order: ConcessionOrder) => {
    if (!clusterId) return;
    const action = order.status === "PAID" ? "prepare" : order.status === "PREPARING" ? "ready" : "collect";
    setWorking(order.orderId);
    setError("");
    try {
      const updated = await concessionApi.transitionOrder(order.orderId, action, clusterId);
      setOrders((current) =>
        current.map((item) => item.orderId === updated.orderId ? updated : item));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Order status could not be changed.");
    } finally {
      setWorking("");
    }
  };

  const clearFilters = () => {
    setTimeFilter("ALL");
    setSortOrder("OLDEST");
  };

  return (
    <>
      <div style={{ marginBottom: "28px" }}>
        <h1
          style={{
            color: "var(--text-main)",
            fontWeight: 600,
            fontSize: "22px",
            letterSpacing: "-0.01em",
            marginBottom: "5px",
          }}
        >
          Concession Fulfillment
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Prepare paid concession orders and hand them off using the pickup code
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Active Orders",
            value: activeCount,
            sub: "waiting, preparing or ready",
            icon: ShoppingBag,
            bg: "bg-blue-50",
            color: "text-blue-600",
          },
          {
            label: "Waiting",
            value: counts.PAID,
            sub: "paid and awaiting preparation",
            icon: Clock3,
            bg: "bg-sky-50",
            color: "text-sky-600",
          },
          {
            label: "Preparing",
            value: counts.PREPARING,
            sub: "currently being prepared",
            icon: ChefHat,
            bg: "bg-amber-50",
            color: "text-amber-600",
          },
          {
            label: "Ready",
            value: counts.READY,
            sub: "waiting for customer pickup",
            icon: PackageCheck,
            bg: "bg-emerald-50",
            color: "text-emerald-600",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-sm"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{stat.label}</p>
                <p
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: "var(--text-main)",
                    marginTop: "4px",
                  }}
                >
                  {loading || clustersLoading ? "—" : stat.value}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon size={18} className={stat.color} />
              </div>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertCircle size={16} className="flex-shrink-0 text-rose-500" />
          <p className="flex-1" style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button
            onClick={() => clusterId ? void loadOrders("manual") : void loadClusters()}
            className="flex items-center gap-1.5 rounded-lg bg-rose-100 px-3 py-1.5 text-rose-600 transition-colors hover:bg-rose-200"
            style={{ fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-sub)" }}
          />
          <input
            type="text"
            placeholder="Search pickup code, booking or item..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl py-2.5 pl-9 pr-9 outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
            style={{
              fontSize: "14px",
              background: "var(--bg-card)",
              color: "var(--text-main)",
              border: "1px solid var(--border-color)",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500"
              style={{ color: "var(--text-sub)" }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="relative">
          <MapPin
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-sub)" }}
          />
          <select
            value={clusterId ?? ""}
            onChange={(event) => setClusterId(event.target.value ? Number(event.target.value) : null)}
            disabled={clustersLoading || !clusters.length}
            className="min-w-64 appearance-none rounded-xl py-2.5 pl-9 pr-9 outline-none transition-all disabled:opacity-50"
            style={{
              fontSize: "14px",
              background: "var(--bg-card)",
              color: "var(--text-main)",
              border: "1px solid var(--border-color)",
            }}
            aria-label="Cinema cluster"
          >
            {!clusters.length && <option value="">No active clusters</option>}
            {clusters.map((cluster) => (
              <option key={cluster.clusterId} value={cluster.clusterId}>
                {cluster.clusterName} — {cluster.province}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowFilters((current) => !current)}
          className="flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all hover:opacity-80"
          style={{
            fontSize: "14px",
            background: "var(--bg-card)",
            color: "var(--text-main)",
            borderColor: showFilters || activeFilterCount ? "#2563eb" : "var(--border-color)",
          }}
        >
          <SlidersHorizontal size={15} /> Filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={() => void loadOrders("manual")}
          disabled={!clusterId || loading || refreshing}
          className="flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all hover:opacity-80 disabled:opacity-50"
          style={{
            fontSize: "14px",
            background: "var(--bg-card)",
            color: "var(--text-main)",
            borderColor: "var(--border-color)",
          }}
        >
          <RefreshCw size={15} className={loading || refreshing ? "animate-spin" : ""} />
          {loading || refreshing ? "Loading…" : "Refresh"}
        </button>
      </div>

      {showFilters && (
        <div
          className="mb-4 flex flex-wrap items-end gap-5 rounded-xl border p-4"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <label className="min-w-48">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--text-sub)" }}>
              Order age
            </span>
            <select
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
              className="w-full rounded-lg px-3 py-2 outline-none"
              style={{
                fontSize: "13px",
                background: "var(--bg-main)",
                color: "var(--text-main)",
                border: "1px solid var(--border-color)",
              }}
            >
              {TIME_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="min-w-48">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--text-sub)" }}>
              Queue order
            </span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              className="w-full rounded-lg px-3 py-2 outline-none"
              style={{
                fontSize: "13px",
                background: "var(--bg-main)",
                color: "var(--text-main)",
                border: "1px solid var(--border-color)",
              }}
            >
              <option value="OLDEST">Oldest first</option>
              <option value="NEWEST">Newest first</option>
            </select>
          </label>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mb-2 flex items-center gap-1 text-xs font-semibold text-rose-500 hover:opacity-75"
            >
              <X size={13} /> Clear filters
            </button>
          )}

          {selectedCluster && (
            <div className="ml-auto mb-1 text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>
                {selectedCluster.clusterCode}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>
                {selectedCluster.address}
              </p>
            </div>
          )}
        </div>
      )}

      <div
        className="mb-5 flex items-center gap-1 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border-color)" }}
      >
        {FILTER_TABS.map((tab) => {
          const count = tab.value === "ALL" ? orders.length : counts[tab.value];
          const selected = filter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="flex items-center gap-1.5 whitespace-nowrap"
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: selected ? 600 : 400,
                color: selected ? tab.color : "var(--text-sub)",
                borderBottom: selected ? `2px solid ${tab.color}` : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
              <span
                className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                style={{
                  background: selected ? tab.color : "rgba(128,128,128,0.14)",
                  color: selected ? "#fff" : "var(--text-sub)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          className="grid min-h-72 place-items-center rounded-2xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="text-center">
            <RefreshCw size={20} className="mx-auto mb-3 animate-spin" style={{ color: "var(--text-sub)" }} />
            <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading concession orders…</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((order) => {
            const status = STATUS_META[order.status];
            return (
              <article
                key={order.orderId}
                className="rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs" style={{ color: "var(--text-sub)" }}>Pickup code</span>
                    <h2 className="mt-1 text-2xl font-black tracking-[0.12em]">{order.pickupCode}</h2>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{ color: status.text, background: status.background }}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-sub)" }}>
                  <span>Booking {order.bookingId}</span>
                  <span>Paid {orderTime(order.paidAt)}</span>
                </div>

                <div className="my-4 space-y-3 border-y py-4" style={{ borderColor: "var(--border-color)" }}>
                  {order.items.map((item) => (
                    <div key={`${item.itemCode}:${item.options}`} className="flex justify-between gap-4 text-sm">
                      <div>
                        <strong>{item.quantity}× {item.itemName}</strong>
                        {item.options && (
                          <p className="mt-0.5 text-xs" style={{ color: "var(--text-sub)" }}>{item.options}</p>
                        )}
                      </div>
                      <span className="whitespace-nowrap">{money(item.finalAmount)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs" style={{ color: "var(--text-sub)" }}>Total</span>
                    <p className="font-bold">{money(order.total)}</p>
                  </div>
                  {order.status !== "COLLECTED" && (
                    <button
                      disabled={working === order.orderId}
                      onClick={() => void transition(order)}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {working === order.orderId
                        ? <RefreshCw size={15} className="animate-spin" />
                        : order.status === "PAID"
                          ? <ChefHat size={15} />
                          : order.status === "PREPARING"
                            ? <PackageCheck size={15} />
                            : <CheckCircle2 size={15} />}
                      {order.status === "PAID"
                        ? "Start preparing"
                        : order.status === "PREPARING"
                          ? "Mark ready"
                          : "Collect"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {!visible.length && (
            <div
              className="col-span-full rounded-2xl border border-dashed py-16 text-center"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              <PackageOpen size={30} className="mx-auto mb-3" style={{ color: "var(--text-sub)" }} />
              <p className="font-medium" style={{ color: "var(--text-main)" }}>No matching orders</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-sub)" }}>
                {orders.length
                  ? "Try another status, search term or time filter."
                  : "New paid concession orders will appear here automatically."}
              </p>
              {(query || filter !== "ALL" || activeFilterCount > 0) && (
                <button
                  onClick={() => {
                    setQuery("");
                    setFilter("ALL");
                    clearFilters();
                  }}
                  className="mt-4 text-sm font-semibold text-blue-600 hover:opacity-75"
                >
                  Clear search and filters
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
