import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeDollarSign,
  Boxes,
  Box,
  CalendarClock,
  Check,
  CircleCheck,
  CircleDashed,
  Edit3,
  Eye,
  EyeOff,
  ImageIcon,
  ImageUp,
  Layers3,
  Link2,
  LoaderCircle,
  MapPin,
  Package,
  PackageOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import {
  concessionApi,
  type ClusterInventory,
  type ClusterOffer,
  type ConcessionCombo,
  type ConcessionProduct,
  type ConcessionSku,
} from "../../api/concessionApi";
import { movieApi, type ClusterResponse } from "../../api/movieApi";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { RowActions } from "../../components/admin/RowActions";
import { useRole } from "../../hooks/useRole";
import ConcessionPricingWorkspace from "./concession/ConcessionPricingWorkspace";

type Workspace = "CATALOG" | "COMBOS" | "PRICING" | "INVENTORY";
type ComboPart = {
  groupCode: string;
  allowedSkuId: number;
  quantity: number;
  minSelect: number;
  maxSelect: number;
};
type SellableRow = {
  type: "SKU" | "COMBO";
  id: number;
  code: string;
  name: string;
  category: string;
  active: boolean;
  stockSkuIds: number[];
};
type OfferDraft = {
  price: number;
  available: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
};
type OfferOperationalStatus = "MISSING" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "SOLD_OUT" | "EXPIRED";

const CLUSTER_STORAGE_KEY = "concession-catalog-cluster-id";
const LOW_STOCK_THRESHOLD = 10;
const inputClass =
  "w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] transition hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const emptyProduct = (): Omit<ConcessionProduct, "id"> => ({
  code: "",
  name: "",
  category: "POPCORN",
  description: "",
  imageUrl: "",
  active: true,
});

const emptyCombo = (skuId = 0): Omit<ConcessionCombo, "id"> => ({
  code: "",
  name: "",
  description: "",
  imageUrl: "",
  active: true,
  components: [
    {
      groupCode: "ITEM",
      allowedSkuId: skuId,
      skuCode: "",
      label: "",
      quantity: 1,
      minSelect: 1,
      maxSelect: 1,
    },
  ],
});

const formatMoney = (value: number, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(value);

const requestMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const toLocalInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const toIso = (value?: string) => value ? new Date(value).toISOString() : undefined;

const operationalStatus = (
  item: SellableRow,
  offer: ClusterOffer | undefined,
  inventory: Map<number, ClusterInventory>,
): OfferOperationalStatus => {
  if (!offer) return "MISSING";
  const now = Date.now();
  if (offer.effectiveTo && new Date(offer.effectiveTo).getTime() <= now) return "EXPIRED";
  if (offer.effectiveFrom && new Date(offer.effectiveFrom).getTime() > now) return "SCHEDULED";
  if (!offer.available) return "PAUSED";
  if (item.stockSkuIds.length && item.stockSkuIds.some((skuId) => {
    const stock = inventory.get(skuId);
    return (stock?.onHand ?? 0) - (stock?.reserved ?? 0) <= 0;
  })) return "SOLD_OUT";
  return "ACTIVE";
};

export default function ConcessionCatalogPage() {
  const { isAdmin, isBranchManager } = useRole();
  const [workspace, setWorkspace] = useState<Workspace>("CATALOG");
  const [products, setProducts] = useState<ConcessionProduct[]>([]);
  const [skus, setSkus] = useState<ConcessionSku[]>([]);
  const [combos, setCombos] = useState<ConcessionCombo[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [clusterId, setClusterId] = useState<number | null>(null);
  const [offers, setOffers] = useState<ClusterOffer[]>([]);
  const [inventory, setInventory] = useState<ClusterInventory[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [branchLoading, setBranchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productEditor, setProductEditor] = useState<ConcessionProduct | null | undefined>();
  const [comboEditor, setComboEditor] = useState<ConcessionCombo | null | undefined>();
  const [stockEditor, setStockEditor] = useState<ConcessionSku | null>(null);

  const loadCore = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      if (isBranchManager) {
        const [productRows, skuRows] = await Promise.all([
          concessionApi.admin.getProducts(),
          concessionApi.admin.getSkus(),
        ]);
        setProducts(productRows);
        setSkus(skuRows);
        setCombos([]);
        setClusters([]);
        setClusterId(null);
        return;
      }
      const [productRows, skuRows, comboRows, clusterResponse] = await Promise.all([
        concessionApi.admin.getProducts(),
        concessionApi.admin.getSkus(),
        concessionApi.admin.getCombos(),
        movieApi.getClusters(),
      ]);
      const activeClusters = (clusterResponse.result ?? [])
        .filter((cluster) => cluster.status === "ACTIVE")
        .sort((a, b) => a.clusterName.localeCompare(b.clusterName));

      setProducts(productRows);
      setSkus(skuRows);
      setCombos(comboRows);
      setClusters(activeClusters);
      setClusterId((current) => {
        if (current && activeClusters.some((cluster) => cluster.clusterId === current)) return current;
        const saved = Number(localStorage.getItem(CLUSTER_STORAGE_KEY));
        if (saved && activeClusters.some((cluster) => cluster.clusterId === saved)) return saved;
        return activeClusters[0]?.clusterId ?? null;
      });
      if (!activeClusters.length) {
        setError("No active cinema cluster is available for pricing and inventory.");
      }
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Concession catalog could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isBranchManager]);

  const loadBranch = useCallback(async (selectedClusterId: number) => {
    if (isBranchManager) return;
    setBranchLoading(true);
    setError("");
    try {
      const [offerRows, inventoryRows] = await Promise.all([
        concessionApi.admin.getOffers(selectedClusterId),
        concessionApi.admin.getInventory(selectedClusterId),
      ]);
      setOffers(offerRows);
      setInventory(inventoryRows);
      localStorage.setItem(CLUSTER_STORAGE_KEY, String(selectedClusterId));
    } catch (requestError: any) {
      setOffers([]);
      setInventory([]);
      setError(requestMessage(requestError, "Cluster pricing and inventory could not be loaded."));
    } finally {
      setBranchLoading(false);
    }
  }, [isBranchManager]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (!clusterId) {
      setOffers([]);
      setInventory([]);
      return;
    }
    void loadBranch(clusterId);
  }, [clusterId, loadBranch]);

  useEffect(() => {
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setQuery("");
  }, [workspace]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const refresh = async () => {
    await loadCore(true);
    if (clusterId) await loadBranch(clusterId);
  };

  const saveProduct = async (form: Omit<ConcessionProduct, "id">, id?: number) => {
    setWorking("product");
    setError("");
    try {
      const saved = await concessionApi.admin.saveProduct(form, id);
      await loadCore(true);
      setProductEditor(saved);
      showNotice(id ? "Product updated successfully." : "Product created. You can now add variants.");
      return saved;
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Product could not be saved."));
      throw requestError;
    } finally {
      setWorking("");
    }
  };

  const submitProduct = async (product: ConcessionProduct) => {
    setWorking(`submit-product-${product.id}`);
    setError("");
    try {
      const saved = await concessionApi.admin.submitProduct(product.id);
      await loadCore(true);
      setProductEditor((current) => current?.id === saved.id ? saved : current);
      showNotice(`${product.name} was submitted for approval.`);
      return saved;
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Product could not be submitted for approval."));
      throw requestError;
    } finally {
      setWorking("");
    }
  };

  const approveProduct = async (product: ConcessionProduct) => {
    if (!window.confirm(`Approve and publish "${product.name}"?`)) return;
    setWorking(`approve-product-${product.id}`);
    setError("");
    try {
      await concessionApi.admin.approveProduct(product.id);
      await loadCore(true);
      showNotice(`${product.name} is now active.`);
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Product could not be approved."));
    } finally {
      setWorking("");
    }
  };

  const rejectProduct = async (product: ConcessionProduct) => {
    const reason = window.prompt(`Why is "${product.name}" being rejected?`);
    if (!reason?.trim()) return;
    setWorking(`reject-product-${product.id}`);
    setError("");
    try {
      await concessionApi.admin.rejectProduct(product.id, reason.trim());
      await loadCore(true);
      showNotice(`${product.name} was returned for changes.`);
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Product could not be rejected."));
    } finally {
      setWorking("");
    }
  };

  const saveSku = async (
    payload: {
      productId: number;
      skuCode: string;
      size?: string;
      flavor?: string;
      attributes: Record<string, unknown>;
      active: boolean;
    },
    id?: number,
  ) => {
    setWorking(`sku-${id ?? "new"}`);
    setError("");
    try {
      await concessionApi.admin.saveSku(payload, id);
      await loadCore(true);
      showNotice(id ? "Variant updated." : "Variant added.");
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Variant could not be saved."));
      throw requestError;
    } finally {
      setWorking("");
    }
  };

  const saveCombo = async (form: Omit<ConcessionCombo, "id">, id?: number) => {
    setWorking("combo");
    setError("");
    try {
      const saved = await concessionApi.admin.saveCombo({
        code: form.code,
        name: form.name,
        description: form.description,
        imageUrl: form.imageUrl,
        active: form.active,
        components: form.components.map(({ groupCode, allowedSkuId, quantity, minSelect, maxSelect }) => ({
          groupCode,
          allowedSkuId,
          quantity,
          minSelect,
          maxSelect,
        })),
      }, id);
      await loadCore(true);
      setComboEditor(saved);
      showNotice(id ? "Combo updated successfully." : "Combo created successfully.");
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Combo could not be saved."));
      throw requestError;
    } finally {
      setWorking("");
    }
  };

  const disableItem = async (kind: "product" | "sku" | "combo", id: number, label: string) => {
    if (!window.confirm(`Disable "${label}"? Existing booking snapshots will be kept.`)) return;
    setWorking(`${kind}-${id}`);
    setError("");
    try {
      if (kind === "product") await concessionApi.admin.deleteProduct(id);
      if (kind === "sku") await concessionApi.admin.deleteSku(id);
      if (kind === "combo") await concessionApi.admin.deleteCombo(id);
      await loadCore(true);
      showNotice(`${label} was disabled.`);
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Catalog item could not be disabled."));
    } finally {
      setWorking("");
    }
  };

  const selectedCluster = clusters.find((cluster) => cluster.clusterId === clusterId);
  const normalizedQuery = query.trim().toLowerCase();
  const productVariants = useMemo(() => {
    const grouped = new Map<number, ConcessionSku[]>();
    skus.forEach((sku) => grouped.set(sku.productId, [...(grouped.get(sku.productId) ?? []), sku]));
    return grouped;
  }, [skus]);
  const offerMap = useMemo(
    () => new Map(offers.map((offer) => [`${offer.sellableType}:${offer.sellableId}`, offer])),
    [offers],
  );
  const inventoryMap = useMemo(
    () => new Map(inventory.map((row) => [row.skuId, row])),
    [inventory],
  );

  const filteredProducts = products.filter((product) => {
    const variants = productVariants.get(product.id) ?? [];
    const workflowStatus = product.status ?? (product.active ? "ACTIVE" : "ARCHIVED");
    const matchesQuery =
      !normalizedQuery ||
      `${product.name} ${product.code} ${product.category} ${variants.map((sku) => sku.skuCode).join(" ")}`
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesCategory = categoryFilter === "ALL" || product.category === categoryFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      statusFilter === workflowStatus ||
      (statusFilter === "ATTENTION" && (!product.imageUrl || variants.length === 0));
    return matchesQuery && matchesCategory && matchesStatus;
  });

  const filteredCombos = combos.filter((combo) => {
    const matchesQuery =
      !normalizedQuery || `${combo.name} ${combo.code} ${combo.description ?? ""}`.toLowerCase().includes(normalizedQuery);
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && combo.active) ||
      (statusFilter === "INACTIVE" && !combo.active) ||
      (statusFilter === "ATTENTION" && (!combo.imageUrl || combo.components.length === 0));
    return matchesQuery && matchesStatus;
  });

  const allSellables = useMemo<SellableRow[]>(
    () => [
      ...skus.map((sku) => ({
        type: "SKU" as const,
        id: sku.id,
        code: sku.skuCode,
        name: [sku.productName, sku.size, sku.flavor].filter(Boolean).join(" · "),
        category: products.find((product) => product.id === sku.productId)?.category ?? "SKU",
        active: sku.active,
        stockSkuIds: [sku.id],
      })),
      ...combos.map((combo) => ({
        type: "COMBO" as const,
        id: combo.id,
        code: combo.code,
        name: combo.name,
        category: "COMBO",
        active: combo.active,
        stockSkuIds: Array.from(new Set(combo.components.map((component) => component.allowedSkuId))),
      })),
    ],
    [skus, combos, products],
  );

  const filteredSellables = allSellables.filter((item) => {
    const offer = offerMap.get(`${item.type}:${item.id}`);
    const offerStatus = operationalStatus(item, offer, inventoryMap);
    const matchesQuery =
      !normalizedQuery || `${item.name} ${item.code} ${item.category}`.toLowerCase().includes(normalizedQuery);
    const matchesType = categoryFilter === "ALL" || item.type === categoryFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      statusFilter === offerStatus;
    return matchesQuery && matchesType && matchesStatus;
  });

  const filteredStock = skus.filter((sku) => {
    const row = inventoryMap.get(sku.id);
    const available = (row?.onHand ?? 0) - (row?.reserved ?? 0);
    const matchesQuery =
      !normalizedQuery || `${sku.productName} ${sku.skuCode} ${sku.size ?? ""} ${sku.flavor ?? ""}`.toLowerCase().includes(normalizedQuery);
    const matchesCategory =
      categoryFilter === "ALL" ||
      products.find((product) => product.id === sku.productId)?.category === categoryFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "IN_STOCK" && available > LOW_STOCK_THRESHOLD) ||
      (statusFilter === "LOW" && available > 0 && available <= LOW_STOCK_THRESHOLD) ||
      (statusFilter === "OUT" && available <= 0);
    return matchesQuery && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set(products.map((product) => product.category))).sort();
  const stats = buildStats(workspace, products, skus, combos, offers, inventory, productVariants);

  const saveOffer = async (
    item: SellableRow,
    draft: OfferDraft,
  ) => {
    if (!clusterId) return;
    setWorking(`offer-${item.type}-${item.id}`);
    setError("");
    try {
      await concessionApi.admin.saveOffer(clusterId, item.type, item.id, {
        price: draft.price,
        currency: "VND",
        available: draft.available,
        effectiveFrom: toIso(draft.effectiveFrom),
        effectiveTo: toIso(draft.effectiveTo),
      });
      await loadBranch(clusterId);
      showNotice(`${item.name} pricing saved for ${selectedCluster?.clusterName ?? "the selected cluster"}.`);
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Pricing could not be saved."));
    } finally {
      setWorking("");
    }
  };

  const saveStock = async (sku: ConcessionSku, onHand: number) => {
    if (!clusterId) return;
    setWorking(`stock-${sku.id}`);
    setError("");
    try {
      await concessionApi.admin.saveInventory(clusterId, sku.id, onHand);
      await loadBranch(clusterId);
      setStockEditor(null);
      showNotice(`${sku.skuCode} stock level updated.`);
    } catch (requestError: any) {
      setError(requestMessage(requestError, "Inventory could not be saved."));
    } finally {
      setWorking("");
    }
  };

  const allWorkspaceMeta: Array<{ value: Workspace; label: string; icon: typeof Package }> = [
    { value: "CATALOG", label: "Catalog", icon: Package },
    { value: "COMBOS", label: "Combos", icon: ShoppingBasket },
    { value: "PRICING", label: "Pricing & availability", icon: BadgeDollarSign },
    { value: "INVENTORY", label: "Inventory", icon: Warehouse },
  ];
  const workspaceMeta = allWorkspaceMeta.filter(
    (item) => !isBranchManager || item.value === "CATALOG",
  );

  return (
    <>
      <header className="mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-main)]">
            Concession management
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-sub)]">
            {isBranchManager
              ? "Create product proposals and submit them to the catalog team for approval."
              : "Review products, manage combos, branch pricing and stock from one workspace."}
          </p>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border-color)]">
        {workspaceMeta.map(({ value, label, icon: Icon }) => (
          <button
            type="button"
            key={value}
            onClick={() => setWorkspace(value)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition ${
              workspace === value
                ? "border-blue-600 font-semibold text-blue-500"
                : "border-transparent text-[var(--text-sub)] hover:text-[var(--text-main)]"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
          <AlertCircle size={17} className="shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="ml-auto rounded-lg p-1 hover:bg-rose-500/10" aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}

      {notice && (
        <div className="fixed right-6 top-20 z-[80] flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <Check size={16} /> {notice}
        </div>
      )}

      <StatsGrid stats={stats} loading={loading} />

      <Toolbar
        workspace={workspace}
        query={query}
        onQuery={setQuery}
        categoryFilter={categoryFilter}
        onCategory={setCategoryFilter}
        statusFilter={statusFilter}
        onStatus={setStatusFilter}
        categories={categories}
        clusters={clusters}
        clusterId={clusterId}
        onCluster={setClusterId}
        loading={loading || refreshing}
        onRefresh={() => void refresh()}
        onAdd={
          workspace === "CATALOG"
            ? () => setProductEditor(null)
            : workspace === "COMBOS"
              ? () => setComboEditor(null)
              : undefined
        }
      />

      {loading ? (
        <LoadingPanel label="Loading concession catalog…" />
      ) : workspace === "CATALOG" ? (
        <CatalogWorkspace
          products={filteredProducts}
          variants={productVariants}
          offers={offerMap}
          onEdit={(product) => setProductEditor(product)}
          onDisable={(product) => void disableItem("product", product.id, product.name)}
          isAdmin={isAdmin}
          isBranchManager={isBranchManager}
          working={working}
          onSubmit={(product) => void submitProduct(product)}
          onApprove={(product) => void approveProduct(product)}
          onReject={(product) => void rejectProduct(product)}
        />
      ) : workspace === "COMBOS" ? (
        <ComboWorkspace
          combos={filteredCombos}
          skus={skus}
          offers={offerMap}
          onEdit={(combo) => setComboEditor(combo)}
          onDisable={(combo) => void disableItem("combo", combo.id, combo.name)}
        />
      ) : workspace === "PRICING" ? (
        <ConcessionPricingWorkspace
          items={filteredSellables}
          offers={offerMap}
          branchLoading={branchLoading}
          cluster={selectedCluster}
          clusters={clusters}
          inventory={inventoryMap}
          working={working}
          onSave={saveOffer}
          onReload={() => clusterId ? loadBranch(clusterId) : Promise.resolve()}
          onError={setError}
          onNotice={showNotice}
        />
      ) : (
        <InventoryWorkspace
          skus={filteredStock}
          products={products}
          inventory={inventoryMap}
          branchLoading={branchLoading}
          cluster={selectedCluster}
          onAdjust={setStockEditor}
        />
      )}

      {productEditor !== undefined && (
        <ProductEditorModal
          initial={productEditor}
          variants={productEditor ? productVariants.get(productEditor.id) ?? [] : []}
          working={working}
          onClose={() => setProductEditor(undefined)}
          onSave={saveProduct}
          onSaveSku={saveSku}
          onDisableSku={(sku) => void disableItem("sku", sku.id, sku.skuCode)}
          onSubmitProduct={submitProduct}
        />
      )}
      {comboEditor !== undefined && (
        <ComboEditorModal
          initial={comboEditor}
          skus={skus.filter((sku) => sku.active)}
          products={products}
          working={working}
          onClose={() => setComboEditor(undefined)}
          onSave={saveCombo}
        />
      )}
      {stockEditor && (
        <StockAdjustmentModal
          sku={stockEditor}
          inventory={inventoryMap.get(stockEditor.id)}
          working={working === `stock-${stockEditor.id}`}
          onClose={() => setStockEditor(null)}
          onSave={(onHand) => void saveStock(stockEditor, onHand)}
        />
      )}
    </>
  );
}

function buildStats(
  workspace: Workspace,
  products: ConcessionProduct[],
  skus: ConcessionSku[],
  combos: ConcessionCombo[],
  offers: ClusterOffer[],
  inventory: ClusterInventory[],
  variants: Map<number, ConcessionSku[]>,
) {
  if (workspace === "CATALOG") {
    return [
      { label: "Products", value: products.length, helper: "Master catalog", icon: Package, tone: "blue" },
      { label: "Active", value: products.filter((item) => (item.status ?? (item.active ? "ACTIVE" : "ARCHIVED")) === "ACTIVE").length, helper: "Ready to sell", icon: Check, tone: "green" },
      { label: "Variants", value: skus.length, helper: "Sellable SKUs", icon: Layers3, tone: "violet" },
      {
        label: "Pending review",
        value: products.filter((item) => item.status === "PENDING_APPROVAL").length,
        helper: "Awaiting admin decision",
        icon: AlertCircle,
        tone: "amber",
      },
    ];
  }
  if (workspace === "COMBOS") {
    return [
      { label: "Combos", value: combos.length, helper: "Configured bundles", icon: ShoppingBasket, tone: "blue" },
      { label: "Active", value: combos.filter((item) => item.active).length, helper: "Available to price", icon: Check, tone: "green" },
      { label: "Components", value: combos.reduce((sum, item) => sum + item.components.length, 0), helper: "SKU selections", icon: Boxes, tone: "violet" },
      { label: "Needs attention", value: combos.filter((item) => !item.imageUrl || !item.components.length).length, helper: "Incomplete content", icon: AlertCircle, tone: "amber" },
    ];
  }
  if (workspace === "PRICING") {
    const now = Date.now();
    const inventoryBySku = new Map(inventory.map((row) => [row.skuId, row]));
    const scheduled = offers.filter((offer) =>
      offer.effectiveFrom && new Date(offer.effectiveFrom).getTime() > now).length;
    const operational = offers.filter((offer) => {
      if (!offer.available) return false;
      if (offer.effectiveFrom && new Date(offer.effectiveFrom).getTime() > now) return false;
      if (offer.effectiveTo && new Date(offer.effectiveTo).getTime() <= now) return false;
      if (offer.sellableType === "SKU") {
        const row = inventoryBySku.get(offer.sellableId);
        return (row?.onHand ?? 0) - (row?.reserved ?? 0) > 0;
      }
      const combo = combos.find((item) => item.id === offer.sellableId);
      if (combo?.components.length) {
        return combo.components.every((component) => {
          const row = inventoryBySku.get(component.allowedSkuId);
          return (row?.onHand ?? 0) - (row?.reserved ?? 0) > 0;
        });
      }
      return true;
    }).length;
    const sellableCount = skus.length + combos.length;
    return [
      { label: "On sale", value: operational, helper: "Live and available now", icon: Eye, tone: "green" },
      {
        label: "Needs attention",
        value: Math.max(0, sellableCount - operational - scheduled),
        helper: "Paused, sold out or missing price",
        icon: AlertCircle,
        tone: "amber",
      },
      { label: "Scheduled changes", value: scheduled, helper: "Starts in the future", icon: CalendarClock, tone: "blue" },
    ];
  }
  const inventoryBySku = new Map(inventory.map((row) => [row.skuId, row]));
  const availableUnits = skus.map((sku) => {
    const row = inventoryBySku.get(sku.id);
    return (row?.onHand ?? 0) - (row?.reserved ?? 0);
  });
  return [
    { label: "Tracked SKUs", value: skus.length, helper: "At selected branch", icon: Warehouse, tone: "blue" },
    { label: "Low stock", value: availableUnits.filter((value) => value > 0 && value <= LOW_STOCK_THRESHOLD).length, helper: `≤ ${LOW_STOCK_THRESHOLD} available`, icon: AlertCircle, tone: "amber" },
    { label: "Sold out", value: availableUnits.filter((value) => value <= 0).length, helper: "No units available", icon: PackageOpen, tone: "rose" },
    { label: "Reserved", value: inventory.reduce((sum, row) => sum + row.reserved, 0), helper: "Awaiting fulfillment", icon: Box, tone: "violet" },
  ];
}

function StatsGrid({
  stats,
  loading,
}: {
  stats: Array<{ label: string; value: number; helper: string; icon: typeof Package; tone: string }>;
  loading: boolean;
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-emerald-500/10 text-emerald-500",
    violet: "bg-violet-500/10 text-violet-500",
    amber: "bg-amber-500/10 text-amber-500",
    rose: "bg-rose-500/10 text-rose-500",
  };
  const gridColumns = stats.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4";
  return (
    <div className={`mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 ${gridColumns}`}>
      {stats.map(({ label, value, helper, icon: Icon, tone }) => (
        <section key={label} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--text-sub)]">{label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-main)]">{loading ? "—" : value}</p>
              <p className="mt-1 text-[11px] text-[var(--text-sub)]">{helper}</p>
            </div>
            <span className={`rounded-xl p-2.5 ${tones[tone] ?? tones.blue}`}><Icon size={18} /></span>
          </div>
        </section>
      ))}
    </div>
  );
}

function Toolbar({
  workspace,
  query,
  onQuery,
  categoryFilter,
  onCategory,
  statusFilter,
  onStatus,
  categories,
  clusters,
  clusterId,
  onCluster,
  loading,
  onRefresh,
  onAdd,
}: {
  workspace: Workspace;
  query: string;
  onQuery: (value: string) => void;
  categoryFilter: string;
  onCategory: (value: string) => void;
  statusFilter: string;
  onStatus: (value: string) => void;
  categories: string[];
  clusters: ClusterResponse[];
  clusterId: number | null;
  onCluster: (value: number) => void;
  loading: boolean;
  onRefresh: () => void;
  onAdd?: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const statuses =
    workspace === "PRICING"
      ? [
          ["ALL", "All pricing"],
          ["ACTIVE", "Active"],
          ["SCHEDULED", "Scheduled"],
          ["PAUSED", "Paused"],
          ["SOLD_OUT", "Sold out"],
          ["EXPIRED", "Expired"],
          ["MISSING", "Missing price"],
        ]
      : workspace === "INVENTORY"
        ? [["ALL", "All stock"], ["IN_STOCK", "In stock"], ["LOW", "Low stock"], ["OUT", "Sold out"]]
        : workspace === "CATALOG"
          ? [
              ["ALL", "All status"],
              ["DRAFT", "Draft"],
              ["PENDING_APPROVAL", "Pending approval"],
              ["ACTIVE", "Active"],
              ["REJECTED", "Rejected"],
              ["ARCHIVED", "Archived"],
              ["ATTENTION", "Needs attention"],
            ]
          : [["ALL", "All status"], ["ACTIVE", "Active"], ["INACTIVE", "Disabled"], ["ATTENTION", "Needs attention"]];
  const categoryOptions =
    workspace === "PRICING"
      ? [["ALL", "All types"], ["SKU", "Products / SKUs"], ["COMBO", "Combos"]]
      : [["ALL", "All categories"], ...categories.map((category) => [category, category])];
  const placeholder =
    workspace === "CATALOG"
      ? "Search product, code or SKU…"
      : workspace === "COMBOS"
        ? "Search combo name or code…"
        : workspace === "PRICING"
          ? "Search sellable item…"
          : "Search product or SKU…";
  const activeFilterCount = Number(categoryFilter !== "ALL") + Number(statusFilter !== "ALL");
  const addLabel = workspace === "CATALOG" ? "Add product" : "Create combo";

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-2.5 pl-10 pr-10 text-sm text-[var(--text-main)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
        />
        {query && (
          <button type="button" onClick={() => onQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-sub)] hover:text-[var(--text-main)]" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(workspace === "PRICING" || workspace === "INVENTORY") && (
          <label className="relative min-w-[230px] flex-1 sm:flex-none">
            <MapPin size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500" />
            <select
              value={clusterId ?? ""}
              onChange={(event) => onCluster(Number(event.target.value))}
              className={`${inputClass} h-[42px] min-w-[230px] pl-9 sm:!w-auto`}
              aria-label="Cinema cluster"
            >
              {!clusters.length && <option value="">No active cluster</option>}
              {clusters.map((cluster) => (
                <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.clusterName}</option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={secondaryButtonClass}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            className={`${secondaryButtonClass} ${filtersOpen || activeFilterCount ? "!border-blue-500/50 text-blue-500" : ""}`}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={15} />
            Filter
            {activeFilterCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filtersOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[300px] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">Filter items</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--text-sub)]">Narrow the current workspace.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--text-sub)] hover:bg-[var(--bg-main)] hover:text-[var(--text-main)]"
                  aria-label="Close filters"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4">
                {workspace !== "COMBOS" && (
                  <Field label={workspace === "PRICING" ? "Sellable type" : "Category"}>
                    <select value={categoryFilter} onChange={(event) => onCategory(event.target.value)} className={inputClass}>
                      {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                )}
                <Field label={workspace === "INVENTORY" ? "Stock status" : workspace === "PRICING" ? "Pricing status" : "Status"}>
                  <select value={statusFilter} onChange={(event) => onStatus(event.target.value)} className={inputClass}>
                    {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[var(--border-color)] pt-4">
                <button
                  type="button"
                  disabled={!activeFilterCount}
                  onClick={() => {
                    onCategory("ALL");
                    onStatus("ALL");
                  }}
                  className="text-xs font-semibold text-[var(--text-sub)] transition hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset filters
                </button>
                <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {onAdd && (
          <button type="button" onClick={onAdd} className={primaryButtonClass}>
            <Plus size={16} />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function CatalogWorkspace({
  products,
  variants,
  offers,
  onEdit,
  onDisable,
  isAdmin,
  isBranchManager,
  working,
  onSubmit,
  onApprove,
  onReject,
}: {
  products: ConcessionProduct[];
  variants: Map<number, ConcessionSku[]>;
  offers: Map<string, ClusterOffer>;
  onEdit: (product: ConcessionProduct) => void;
  onDisable: (product: ConcessionProduct) => void;
  isAdmin: boolean;
  isBranchManager: boolean;
  working: string;
  onSubmit: (product: ConcessionProduct) => void;
  onApprove: (product: ConcessionProduct) => void;
  onReject: (product: ConcessionProduct) => void;
}) {
  if (!products.length) return <EmptyState icon={PackageOpen} title="No products found" description="Try another filter or add a new product to the catalog." />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const productSkus = variants.get(product.id) ?? [];
        const pricedVariants = productSkus.map((sku) => offers.get(`SKU:${sku.id}`)).filter(Boolean) as ClusterOffer[];
        return (
          <ProductCard
            key={product.id}
            product={product}
            variants={productSkus}
            pricedVariants={pricedVariants}
            onEdit={() => onEdit(product)}
            onDisable={() => onDisable(product)}
            isAdmin={isAdmin}
            isBranchManager={isBranchManager}
            working={working}
            onSubmit={() => onSubmit(product)}
            onApprove={() => onApprove(product)}
            onReject={() => onReject(product)}
          />
        );
      })}
    </div>
  );
}

function ProductCard({
  product,
  variants,
  pricedVariants,
  onEdit,
  onDisable,
  isAdmin,
  isBranchManager,
  working,
  onSubmit,
  onApprove,
  onReject,
}: {
  product: ConcessionProduct;
  variants: ConcessionSku[];
  pricedVariants: ClusterOffer[];
  onEdit: () => void;
  onDisable: () => void;
  isAdmin: boolean;
  isBranchManager: boolean;
  working: string;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const workflowStatus = product.status ?? (product.active ? "ACTIVE" : "ARCHIVED");
  const editable = workflowStatus !== "PENDING_APPROVAL"
    && workflowStatus !== "ARCHIVED"
    && (isAdmin || (isBranchManager && (workflowStatus === "DRAFT" || workflowStatus === "REJECTED")));
  const canSubmit = (isAdmin || isBranchManager)
    && (workflowStatus === "DRAFT" || workflowStatus === "REJECTED");
  const reviewing = working === `approve-product-${product.id}` || working === `reject-product-${product.id}`;
  const submitting = working === `submit-product-${product.id}`;
  const prices = pricedVariants.map((offer) => offer.price);
  const priceLabel = prices.length
    ? `${formatMoney(Math.min(...prices))}${prices.length > 1 && Math.max(...prices) !== Math.min(...prices) ? ` – ${formatMoney(Math.max(...prices))}` : ""}`
    : "Price not configured";
  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] transition hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-lg">
      <div className="relative">
        <ProductVisual
          imageUrl={product.imageUrl}
          name={product.name}
          className="aspect-[3/2] w-full bg-slate-950"
          fit="contain"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-lg bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">{product.category}</span>
          <ProductWorkflowBadge status={workflowStatus} />
        </div>
        {(editable || (isAdmin && workflowStatus === "ACTIVE")) && (
          <div className="absolute right-3 top-3 opacity-0 transition group-hover:opacity-100">
            <CardActions active={isAdmin && workflowStatus === "ACTIVE"} onEdit={onEdit} onDisable={onDisable} overlay />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[var(--text-main)]">{product.name}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-sub)]">{product.code}</p>
          </div>
          {!product.imageUrl && <span title="Missing product image"><ImageIcon size={16} className="text-amber-500" /></span>}
        </div>
        <p className="mt-3 line-clamp-2 min-h-9 text-xs leading-relaxed text-[var(--text-sub)]">
          {product.description || "No product description yet."}
        </p>
        {workflowStatus === "REJECTED" && product.rejectionReason && (
          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-[11px] leading-relaxed text-rose-500">
            <strong>Changes requested:</strong> {product.rejectionReason}
          </div>
        )}
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--border-color)] pt-3">
          <div>
            <p className="text-[11px] text-[var(--text-sub)]">Variants</p>
            <p className={`text-sm font-semibold ${variants.length ? "text-[var(--text-main)]" : "text-amber-500"}`}>
              {variants.length || "None"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[var(--text-sub)]">Selected branch</p>
            <p className={`text-xs font-semibold ${prices.length ? "text-blue-500" : "text-[var(--text-sub)]"}`}>{priceLabel}</p>
          </div>
        </div>
        {canSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || variants.length === 0}
            className={`${secondaryButtonClass} mt-3 w-full !py-2 text-xs`}
            title={variants.length ? "Send this draft to an administrator" : "Add at least one variant before submitting"}
          >
            {submitting ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
            Submit for approval
          </button>
        )}
        {isAdmin && workflowStatus === "PENDING_APPROVAL" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={onReject} disabled={reviewing} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/25 px-3 py-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50">
              <X size={14} /> Reject
            </button>
            <button type="button" onClick={onApprove} disabled={reviewing} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
              {reviewing ? <LoaderCircle size={14} className="animate-spin" /> : <CircleCheck size={14} />} Approve
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function ComboWorkspace({
  combos,
  skus,
  offers,
  onEdit,
  onDisable,
}: {
  combos: ConcessionCombo[];
  skus: ConcessionSku[];
  offers: Map<string, ClusterOffer>;
  onEdit: (combo: ConcessionCombo) => void;
  onDisable: (combo: ConcessionCombo) => void;
}) {
  const skuMap = new Map(skus.map((sku) => [sku.id, sku]));
  if (!combos.length) return <EmptyState icon={ShoppingBasket} title="No combos found" description="Create a bundle from your existing product variants." />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {combos.map((combo) => {
        const offer = offers.get(`COMBO:${combo.id}`);
        const componentLabel = combo.components
          .slice(0, 3)
          .map((part) => `${part.quantity}× ${skuMap.get(part.allowedSkuId)?.productName ?? part.skuCode}`)
          .join(" · ");
        return (
          <article key={combo.id} className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] transition hover:border-blue-500/30">
            <ProductVisual
              imageUrl={combo.imageUrl}
              name={combo.name}
              className="aspect-[3/2] w-full bg-slate-950"
              fit="contain"
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-[var(--text-main)]">{combo.name}</h3>
                    <StatusBadge active={combo.active} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-sub)]">{combo.code}</p>
                </div>
                <CardActions active={combo.active} onEdit={() => onEdit(combo)} onDisable={() => onDisable(combo)} />
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[var(--text-sub)]">
                {combo.description || componentLabel || "No combo description yet."}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-color)] pt-3 text-xs">
                <span className="text-[var(--text-sub)]">{combo.components.length} component{combo.components.length === 1 ? "" : "s"}</span>
                <strong className={offer ? "text-blue-500" : "text-[var(--text-sub)]"}>
                  {offer ? formatMoney(offer.price, offer.currency) : "Price not configured"}
                </strong>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PricingWorkspace({
  items,
  offers,
  branchLoading,
  cluster,
  working,
  onSave,
}: {
  items: Array<{ type: "SKU" | "COMBO"; id: number; code: string; name: string; category: string; active: boolean }>;
  offers: Map<string, ClusterOffer>;
  branchLoading: boolean;
  cluster?: ClusterResponse;
  working: string;
  onSave: (item: (typeof items)[number], draft: { price: number; available: boolean }) => Promise<void>;
}) {
  if (!cluster) return <EmptyState icon={MapPin} title="Select an active cinema cluster" description="Pricing is configured independently for each cinema branch." />;
  if (branchLoading) return <LoadingPanel label={`Loading pricing for ${cluster.clusterName}…`} />;
  if (!items.length) return <EmptyState icon={BadgeDollarSign} title="No sellable items found" description="Try another filter or add products and combos first." />;
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border-color)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-main)]">Branch price book</h2>
          <p className="mt-0.5 text-xs text-[var(--text-sub)]">Changes apply only to {cluster.clusterName}.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500">
          <MapPin size={12} /> {cluster.clusterCode}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-[var(--border-color)] bg-[var(--bg-main)] text-[11px] uppercase tracking-wide text-[var(--text-sub)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Sellable item</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Availability</th>
              <th className="w-40 px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {items.map((item) => (
              <PricingRow
                key={`${item.type}-${item.id}`}
                item={item}
                offer={offers.get(`${item.type}:${item.id}`)}
                saving={working === `offer-${item.type}-${item.id}`}
                onSave={(draft) => void onSave(item, draft)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PricingRow({
  item,
  offer,
  saving,
  onSave,
}: {
  item: { type: "SKU" | "COMBO"; id: number; code: string; name: string; category: string; active: boolean };
  offer?: ClusterOffer;
  saving: boolean;
  onSave: (draft: { price: number; available: boolean }) => void;
}) {
  const [price, setPrice] = useState(offer?.price ?? 0);
  const [available, setAvailable] = useState(offer?.available ?? false);
  useEffect(() => {
    setPrice(offer?.price ?? 0);
    setAvailable(offer?.available ?? false);
  }, [offer?.id, offer?.price, offer?.available]);
  const dirty = price !== (offer?.price ?? 0) || available !== (offer?.available ?? false) || !offer;
  return (
    <tr className="transition hover:bg-blue-500/[0.025]">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.type === "COMBO" ? "bg-violet-500/10 text-violet-500" : "bg-blue-500/10 text-blue-500"}`}>
            {item.type === "COMBO" ? <ShoppingBasket size={16} /> : <Package size={16} />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-main)]">{item.name}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-sub)]">{item.code} · {item.category}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5"><TypeBadge type={item.type} /></td>
      <td className="px-4 py-3.5">
        <div className="relative w-44">
          <input type="number" min={0} step={1000} value={price} onChange={(event) => setPrice(Math.max(0, Number(event.target.value)))} className={`${inputClass} pr-12`} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--text-sub)]">VND</span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--text-main)]">
          <button
            type="button"
            role="switch"
            aria-checked={available}
            onClick={() => setAvailable((value) => !value)}
            className={`relative h-6 w-11 rounded-full transition ${available ? "bg-emerald-500" : "bg-slate-400/35"}`}
          >
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${available ? "left-6" : "left-1"}`} />
          </button>
          {available ? "Available" : "Unavailable"}
        </label>
      </td>
      <td className="w-40 px-5 py-3.5 text-right">
        <RowActions
          ariaLabel={`Actions for ${item.name}`}
          busy={saving}
          primaryAction={{
            key: "save",
            label: offer ? "Save" : "Configure",
            icon: Save,
            onSelect: () => onSave({ price, available }),
            disabled: !dirty || !item.active || price <= 0,
            disabledReason: !item.active ? "The item is inactive" : price <= 0 ? "Enter a valid price" : !dirty ? "No unsaved changes" : undefined,
          }}
        />
      </td>
    </tr>
  );
}

function InventoryWorkspace({
  skus,
  products,
  inventory,
  branchLoading,
  cluster,
  onAdjust,
}: {
  skus: ConcessionSku[];
  products: ConcessionProduct[];
  inventory: Map<number, ClusterInventory>;
  branchLoading: boolean;
  cluster?: ClusterResponse;
  onAdjust: (sku: ConcessionSku) => void;
}) {
  if (!cluster) return <EmptyState icon={MapPin} title="Select an active cinema cluster" description="Stock levels are tracked independently for each cinema branch." />;
  if (branchLoading) return <LoadingPanel label={`Loading inventory for ${cluster.clusterName}…`} />;
  if (!skus.length) return <EmptyState icon={Warehouse} title="No inventory items found" description="Try another filter or create product variants first." />;
  const productMap = new Map(products.map((product) => [product.id, product]));
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border-color)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-main)]">Branch inventory</h2>
          <p className="mt-0.5 text-xs text-[var(--text-sub)]">Available stock equals on hand minus reserved units.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500">
          <MapPin size={12} /> {cluster.clusterName}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left">
          <thead className="border-b border-[var(--border-color)] bg-[var(--bg-main)] text-[11px] uppercase tracking-wide text-[var(--text-sub)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Product / SKU</th>
              <th className="px-4 py-3 font-semibold">On hand</th>
              <th className="px-4 py-3 font-semibold">Reserved</th>
              <th className="px-4 py-3 font-semibold">Available</th>
              <th className="px-4 py-3 font-semibold">Stock status</th>
              <th className="w-40 px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {skus.map((sku) => {
              const row = inventory.get(sku.id);
              const onHand = row?.onHand ?? 0;
              const reserved = row?.reserved ?? 0;
              const available = onHand - reserved;
              const product = productMap.get(sku.productId);
              return (
                <tr key={sku.id} className="transition hover:bg-blue-500/[0.025]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <ProductVisual imageUrl={product?.imageUrl} name={sku.productName} className="h-10 w-10 shrink-0 rounded-xl" />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-main)]">{sku.productName}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-sub)]">{sku.skuCode}{sku.size ? ` · ${sku.size}` : ""}{sku.flavor ? ` · ${sku.flavor}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-[var(--text-main)]">{onHand}</td>
                  <td className="px-4 py-3.5 text-sm text-[var(--text-sub)]">{reserved}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-[var(--text-main)]">{available}</td>
                  <td className="px-4 py-3.5"><StockBadge available={available} /></td>
                  <td className="w-40 px-5 py-3.5 text-right">
                    <RowActions
                      ariaLabel={`Actions for ${sku.productName}`}
                      primaryAction={{ key: "adjust", label: "Adjust stock", icon: Edit3, onSelect: () => onAdjust(sku) }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductEditorModal({
  initial,
  variants,
  working,
  onClose,
  onSave,
  onSaveSku,
  onDisableSku,
  onSubmitProduct,
}: {
  initial: ConcessionProduct | null;
  variants: ConcessionSku[];
  working: string;
  onClose: () => void;
  onSave: (form: Omit<ConcessionProduct, "id">, id?: number) => Promise<ConcessionProduct>;
  onSaveSku: (
    payload: { productId: number; skuCode: string; size?: string; flavor?: string; attributes: Record<string, unknown>; active: boolean },
    id?: number,
  ) => Promise<void>;
  onDisableSku: (sku: ConcessionSku) => void;
  onSubmitProduct: (product: ConcessionProduct) => Promise<ConcessionProduct>;
}) {
  const [tab, setTab] = useState<"DETAILS" | "VARIANTS">("DETAILS");
  const [form, setForm] = useState<Omit<ConcessionProduct, "id">>(initial ? {
    code: initial.code,
    name: initial.name,
    category: initial.category,
    description: initial.description ?? "",
    imageUrl: initial.imageUrl ?? "",
    active: initial.active,
  } : emptyProduct());
  const [savedProduct, setSavedProduct] = useState<ConcessionProduct | null>(initial);
  const [variantEditor, setVariantEditor] = useState<ConcessionSku | null | undefined>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [imageDragging, setImageDragging] = useState(false);
  const [showImageUrl, setShowImageUrl] = useState(false);
  const workflowStatus = savedProduct?.status ?? initial?.status ?? "DRAFT";

  useEffect(() => setSavedProduct(initial), [initial]);

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.category.trim()) return;
    const saved = await onSave({ ...form, code: form.code.trim(), name: form.name.trim(), category: form.category.trim().toUpperCase() }, savedProduct?.id);
    setSavedProduct(saved);
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must not exceed 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await concessionApi.admin.uploadImage(file);
      setForm((current) => ({ ...current, imageUrl: uploaded.url }));
      setShowImageUrl(false);
    } catch (requestError: any) {
      setUploadError(requestMessage(requestError, "Image could not be uploaded."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title={savedProduct ? "Edit product" : "Add product"} subtitle="Product information and sellable variants" onClose={onClose} size="lg">
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-[var(--border-color)] px-6">
        {([
          ["DETAILS", "Product details"],
          ["VARIANTS", `Variants (${variants.length})`],
        ] as const).map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => setTab(value)}
            className={`border-b-2 px-4 py-3.5 text-sm transition ${tab === value ? "border-blue-600 font-semibold text-blue-500" : "border-transparent text-[var(--text-sub)] hover:text-[var(--text-main)]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "DETAILS" ? (
        <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product code" required><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className={inputClass} placeholder="e.g. POPCORN" /></Field>
            <Field label="Category" required>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={inputClass}>
                {["POPCORN", "DRINKS", "SNACKS"].map((category) => <option key={category}>{category}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Product name" required><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Customer-facing product name" /></Field>
          <Field label="Description"><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${inputClass} resize-none`} placeholder="Short product description…" /></Field>

          {savedProduct && (
            <Field
              label="Product status"
              hint={workflowStatus === "REJECTED" && savedProduct.rejectionReason
                ? savedProduct.rejectionReason
                : workflowStatus === "ACTIVE"
                  ? "This product is approved and available for branch configuration."
                  : workflowStatus === "PENDING_APPROVAL"
                    ? "An administrator is reviewing this product."
                    : "Add at least one variant before submitting it."}
            >
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  workflowStatus === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : workflowStatus === "PENDING_APPROVAL"
                      ? "bg-amber-500/10 text-amber-500"
                      : workflowStatus === "REJECTED"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-blue-500/10 text-blue-500"
                }`}>
                  {workflowStatus === "ACTIVE"
                    ? <CircleCheck size={17} />
                    : workflowStatus === "DRAFT"
                      ? <CircleDashed size={17} />
                      : <AlertCircle size={17} />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">
                    {workflowStatus === "PENDING_APPROVAL" ? "Pending approval" : workflowStatus === "REJECTED" ? "Changes requested" : workflowStatus.charAt(0) + workflowStatus.slice(1).toLowerCase()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-sub)]">Status is controlled by the catalog approval workflow.</p>
                </div>
              </div>
            </Field>
          )}

          <Field label="Product image">
            <div className="space-y-3">
              <ProductImageUploader
                imageUrl={form.imageUrl}
                name={form.name || "Product"}
                uploading={uploading}
                dragging={imageDragging}
                onDraggingChange={setImageDragging}
                onFile={(file) => void uploadImage(file)}
                onClear={() => {
                  setUploadError("");
                  setForm({ ...form, imageUrl: "" });
                }}
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowImageUrl((visible) => !visible)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-500 transition hover:bg-blue-500/10"
                  aria-expanded={showImageUrl}
                >
                  <Link2 size={14} /> {showImageUrl ? "Hide image URL" : "Use image URL"}
                </button>
              </div>
              {showImageUrl && (
                <div className="relative">
                  <ImageIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" />
                  <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} className={`${inputClass} pl-10`} placeholder="Paste an external image URL" autoFocus />
                </div>
              )}
              {uploadError && <p className="text-xs text-rose-500">{uploadError}</p>}
            </div>
          </Field>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
            {savedProduct && (workflowStatus === "DRAFT" || workflowStatus === "REJECTED") && (
              <button
                type="button"
                onClick={() => void onSubmitProduct(savedProduct).then(setSavedProduct).catch(() => undefined)}
                disabled={working === `submit-product-${savedProduct.id}` || variants.length === 0}
                className={secondaryButtonClass}
                title={variants.length ? "Send this product to an administrator" : "Add at least one variant first"}
              >
                {working === `submit-product-${savedProduct.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                Submit for approval
              </button>
            )}
            <button type="button" onClick={() => void submit().catch(() => undefined)} disabled={working === "product" || uploading || !form.code.trim() || !form.name.trim()} className={primaryButtonClass}>
              {working === "product" ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={17} strokeWidth={2.5} />} Save product
            </button>
        </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {!savedProduct ? (
            <EmptyState icon={Layers3} title="Save the product first" description="A product must exist before you can create sellable variants." compact />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">Sellable variants</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-sub)]">Size and flavor combinations shown at checkout.</p>
                </div>
                <button type="button" onClick={() => setVariantEditor(null)} className={secondaryButtonClass}><Plus size={15} /> Add variant</button>
              </div>
              <div className="space-y-2">
                {variants.map((sku) => (
                  <div key={sku.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] p-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><Tag size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-[var(--text-main)]">{sku.skuCode}</p><StatusBadge active={sku.active} /></div>
                      <p className="mt-0.5 text-xs text-[var(--text-sub)]">{[sku.size, sku.flavor].filter(Boolean).join(" · ") || "Default variant"}</p>
                    </div>
                    <button type="button" onClick={() => setVariantEditor(sku)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-500/10" aria-label={`Edit ${sku.skuCode}`}><Edit3 size={15} /></button>
                    {sku.active && <button type="button" onClick={() => onDisableSku(sku)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10" aria-label={`Disable ${sku.skuCode}`}><Trash2 size={15} /></button>}
                  </div>
                ))}
                {!variants.length && <EmptyState icon={Tag} title="No variants yet" description="Add at least one SKU so this product can be priced and stocked." compact />}
              </div>
            </>
          )}
        </div>
      )}
      {variantEditor !== undefined && savedProduct && (
        <VariantModal
          product={savedProduct}
          initial={variantEditor}
          working={working}
          onClose={() => setVariantEditor(undefined)}
          onSave={async (payload, id) => {
            await onSaveSku(payload, id);
            setVariantEditor(undefined);
          }}
        />
      )}
      </div>
    </Modal>
  );
}

function VariantModal({
  product,
  initial,
  working,
  onClose,
  onSave,
}: {
  product: ConcessionProduct;
  initial: ConcessionSku | null;
  working: string;
  onClose: () => void;
  onSave: (
    payload: { productId: number; skuCode: string; size?: string; flavor?: string; attributes: Record<string, unknown>; active: boolean },
    id?: number,
  ) => Promise<void>;
}) {
  const [form, setForm] = useState({
    skuCode: initial?.skuCode ?? "",
    size: initial?.size ?? "",
    flavor: initial?.flavor ?? "",
    active: initial?.active ?? true,
  });
  const busy = working === `sku-${initial?.id ?? "new"}`;
  return (
    <Modal title={initial ? "Edit variant" : "Add variant"} subtitle={product.name} onClose={onClose}>
      <div className="space-y-4 p-5">
        <Field label="SKU code" required><input value={form.skuCode} onChange={(event) => setForm({ ...form, skuCode: event.target.value })} className={inputClass} placeholder="e.g. POP-L-CARAMEL" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Size"><input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} className={inputClass} placeholder="Large" /></Field>
          <Field label="Flavor"><input value={form.flavor} onChange={(event) => setForm({ ...form, flavor: event.target.value })} className={inputClass} placeholder="Caramel" /></Field>
        </div>
        <ToggleField label="Active variant" description="Active variants can be priced and stocked." checked={form.active} onChange={(active) => setForm({ ...form, active })} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button
            type="button"
            disabled={busy || !form.skuCode.trim()}
            onClick={() => void onSave({ productId: product.id, skuCode: form.skuCode.trim(), size: form.size.trim(), flavor: form.flavor.trim(), attributes: {}, active: form.active }, initial?.id).catch(() => undefined)}
            className={primaryButtonClass}
          >
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Save variant
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ComboEditorModal({
  initial,
  skus,
  products,
  working,
  onClose,
  onSave,
}: {
  initial: ConcessionCombo | null;
  skus: ConcessionSku[];
  products: ConcessionProduct[];
  working: string;
  onClose: () => void;
  onSave: (form: Omit<ConcessionCombo, "id">, id?: number) => Promise<void>;
}) {
  const [form, setForm] = useState<Omit<ConcessionCombo, "id">>(initial ? {
    code: initial.code,
    name: initial.name,
    description: initial.description ?? "",
    imageUrl: initial.imageUrl ?? "",
    active: initial.active,
    components: initial.components.map((part) => ({ ...part })),
  } : emptyCombo(skus[0]?.id));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [imageDragging, setImageDragging] = useState(false);
  const [showImageUrl, setShowImageUrl] = useState(false);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const updatePart = (index: number, patch: Partial<ComboPart>) =>
    setForm({ ...form, components: form.components.map((part, current) => current === index ? { ...part, ...patch } : part) });
  const addPart = () => setForm({
    ...form,
    components: [...form.components, {
      groupCode: "ITEM",
      allowedSkuId: skus[0]?.id ?? 0,
      skuCode: "",
      label: "",
      quantity: 1,
      minSelect: 1,
      maxSelect: 1,
    }],
  });
  const valid = form.code.trim() && form.name.trim() && form.components.length > 0 && form.components.every((part) => part.allowedSkuId > 0 && part.quantity > 0);

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must not exceed 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await concessionApi.admin.uploadImage(file);
      setForm((current) => ({ ...current, imageUrl: uploaded.url }));
      setShowImageUrl(false);
    } catch (requestError: any) {
      setUploadError(requestMessage(requestError, "Image could not be uploaded."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title={initial ? "Edit combo" : "Create combo"} subtitle="Bundle product variants into one sellable offer" onClose={onClose} size="lg">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Combo code" required><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className={inputClass} placeholder="e.g. DATE-NIGHT" /></Field>
            <Field label="Combo name" required><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Customer-facing name" /></Field>
          </div>
          <Field label="Description"><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} /></Field>

          <Field label="Combo image">
            <div className="space-y-3">
              <ProductImageUploader
                imageUrl={form.imageUrl}
                name={form.name || "Combo"}
                uploading={uploading}
                dragging={imageDragging}
                onDraggingChange={setImageDragging}
                onFile={(file) => void uploadImage(file)}
                onClear={() => {
                  setUploadError("");
                  setForm({ ...form, imageUrl: "" });
                }}
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowImageUrl((visible) => !visible)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-500 transition hover:bg-blue-500/10"
                  aria-expanded={showImageUrl}
                >
                  <Link2 size={14} /> {showImageUrl ? "Hide image URL" : "Use image URL"}
                </button>
              </div>
              {showImageUrl && (
                <div className="relative">
                  <ImageIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" />
                  <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} className={`${inputClass} pl-10`} placeholder="Paste an external image URL" autoFocus />
                </div>
              )}
              {uploadError && <p className="text-xs text-rose-500">{uploadError}</p>}
            </div>
          </Field>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-main)]">Combo components</h3>
                <p className="mt-0.5 text-xs text-[var(--text-sub)]">Choose the product variants included in this bundle.</p>
              </div>
              <button type="button" onClick={addPart} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500"><Plus size={14} /> Add item</button>
            </div>
            <div className="space-y-3">
              {form.components.map((part, index) => {
                const selectedSku = skus.find((sku) => sku.id === part.allowedSkuId);
                const product = selectedSku ? productMap.get(selectedSku.productId) : undefined;
                return (
                  <div key={`${index}-${part.allowedSkuId}`} className="rounded-2xl border border-[var(--border-color)] p-3">
                    <div className="flex gap-3">
                      <ProductVisual imageUrl={product?.imageUrl} name={selectedSku?.productName ?? "Item"} className="h-14 w-14 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1 space-y-3">
                        <select value={part.allowedSkuId} onChange={(event) => updatePart(index, { allowedSkuId: Number(event.target.value) })} className={inputClass}>
                          {!skus.length && <option value={0}>No active SKU available</option>}
                          {skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.productName} · {sku.skuCode}{sku.size ? ` · ${sku.size}` : ""}</option>)}
                        </select>
                        <div className="grid grid-cols-[1fr_92px] gap-2">
                          <input value={part.groupCode} onChange={(event) => updatePart(index, { groupCode: event.target.value.toUpperCase() })} className={inputClass} placeholder="Group code" />
                          <input type="number" min={1} value={part.quantity} onChange={(event) => updatePart(index, { quantity: Math.max(1, Number(event.target.value)) })} className={inputClass} title="Quantity" />
                        </div>
                      </div>
                      <button type="button" disabled={form.components.length === 1} onClick={() => setForm({ ...form, components: form.components.filter((_, current) => current !== index) })} className="h-fit rounded-lg p-2 text-rose-500 hover:bg-rose-500/10 disabled:opacity-25" aria-label="Remove component"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <ToggleField label="Active combo" description="Active combos can be priced for cinema branches." checked={form.active} onChange={(active) => setForm({ ...form, active })} />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="button" disabled={working === "combo" || uploading || !valid} onClick={() => void onSave(form, initial?.id).catch(() => undefined)} className={primaryButtonClass}>
            {working === "combo" ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save combo
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StockAdjustmentModal({
  sku,
  inventory,
  working,
  onClose,
  onSave,
}: {
  sku: ConcessionSku;
  inventory?: ClusterInventory;
  working: boolean;
  onClose: () => void;
  onSave: (onHand: number) => void;
}) {
  const [onHand, setOnHand] = useState(inventory?.onHand ?? 0);
  const reserved = inventory?.reserved ?? 0;
  return (
    <Modal title="Adjust stock level" subtitle={`${sku.productName} · ${sku.skuCode}`} onClose={onClose}>
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Current" value={inventory?.onHand ?? 0} />
          <Metric label="Reserved" value={reserved} />
          <Metric label="Available after" value={onHand - reserved} emphasize />
        </div>
        <Field label="New on-hand quantity" required hint={`Must be at least ${reserved}, because reserved units cannot be removed.`}>
          <input type="number" min={reserved} value={onHand} onChange={(event) => setOnHand(Number(event.target.value))} className={inputClass} autoFocus />
        </Field>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-relaxed text-[var(--text-sub)]">
          This Phase 1 action sets the absolute stock level. Adjustment reasons and audit history are planned for Phase 2.
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="button" disabled={working || onHand < reserved || onHand < 0} onClick={() => onSave(onHand)} className={primaryButtonClass}>
            {working ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Update stock
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl ${size === "lg" ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <div><h2 className="font-semibold text-[var(--text-main)]">{title}</h2><p className="mt-0.5 text-xs text-[var(--text-sub)]">{subtitle}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-sub)] hover:bg-[var(--bg-main)]" aria-label="Close dialog"><X size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ProductVisual({
  imageUrl,
  name,
  className,
  fit = "cover",
}: {
  imageUrl?: string;
  name: string;
  className: string;
  fit?: "cover" | "contain";
}) {
  if (imageUrl) {
    const resolvedUrl = imageUrl.startsWith("/api/")
      ? `${import.meta.env.VITE_API_URL ?? "http://localhost:8080"}${imageUrl}`
      : imageUrl;
    return (
      <ImageWithFallback
        key={resolvedUrl}
        src={resolvedUrl}
        alt={name}
        className={`${className} block ${fit === "contain" ? "object-contain" : "object-cover"}`}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`${className} grid place-items-center bg-gradient-to-br from-blue-500/15 via-violet-500/10 to-amber-500/15 text-blue-500`}>
      <div className="text-center"><Sparkles size={24} className="mx-auto opacity-70" /><span className="mt-1 block max-w-32 truncate px-2 text-[10px] font-semibold uppercase tracking-wide opacity-60">{name}</span></div>
    </div>
  );
}

function ProductImageUploader({
  imageUrl,
  name,
  uploading,
  dragging,
  onDraggingChange,
  onFile,
  onClear,
}: {
  imageUrl?: string;
  name: string;
  uploading: boolean;
  dragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onFile: (file?: File) => void;
  onClear: () => void;
}) {
  const resolvedUrl = imageUrl?.startsWith("/api/")
    ? `${import.meta.env.VITE_API_URL ?? "http://localhost:8080"}${imageUrl}`
    : imageUrl;

  return (
    <div
      className={`relative h-40 w-full overflow-hidden rounded-xl border border-dashed bg-[var(--bg-main)] transition ${dragging ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/10" : "border-[var(--border-color)]"}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!uploading) onDraggingChange(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!uploading) onDraggingChange(true);
      }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDraggingChange(false);
        if (!uploading) onFile(event.dataTransfer.files?.[0]);
      }}
    >
      {resolvedUrl ? (
        <>
          <ImageWithFallback src={resolvedUrl} alt={`${name} preview`} className="block h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8">
            <p className="min-w-0 truncate text-xs font-medium text-white/90">{name}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white">
                <RefreshCw size={13} /> Replace
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(event) => {
                    onFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  className="hidden"
                />
              </label>
              <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-black/75">
                <Trash2 size={13} /> Remove
              </button>
            </div>
          </div>
        </>
      ) : (
        <label className="grid h-full cursor-pointer place-items-center px-6 text-center">
          <span>
            <span className={`mx-auto grid h-10 w-10 place-items-center rounded-xl transition ${dragging ? "bg-blue-500 text-white" : "bg-blue-500/10 text-blue-500"}`}>
              <ImageUp size={19} />
            </span>
            <span className="mt-3 block text-sm font-medium text-[var(--text-main)]">
              Drop an image here or <span className="font-semibold text-blue-500">browse files</span>
            </span>
            <span className="mt-1 block text-[11px] text-[var(--text-sub)]">PNG, JPG or WebP · Maximum 5 MB · Recommended 16:9</span>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
            className="hidden"
          />
        </label>
      )}
      {uploading && (
        <div className="absolute inset-0 grid place-items-center bg-[var(--bg-card)]/85 backdrop-blur-sm">
          <div className="text-center">
            <LoaderCircle size={21} className="mx-auto animate-spin text-blue-500" />
            <p className="mt-2 text-xs font-semibold text-[var(--text-main)]">Uploading image…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CardActions({
  active,
  onEdit,
  onDisable,
  overlay = false,
}: {
  active: boolean;
  onEdit: () => void;
  onDisable: () => void;
  overlay?: boolean;
}) {
  return (
    <div className={`flex gap-1 ${overlay ? "rounded-xl bg-black/65 p-1 backdrop-blur" : ""}`}>
      <button type="button" onClick={onEdit} className={`rounded-lg p-2 transition ${overlay ? "text-white hover:bg-white/15" : "text-blue-500 hover:bg-blue-500/10"}`} aria-label="Edit"><Edit3 size={15} /></button>
      {active && <button type="button" onClick={onDisable} className={`rounded-lg p-2 transition ${overlay ? "text-white hover:bg-white/15" : "text-rose-500 hover:bg-rose-500/10"}`} aria-label="Disable"><EyeOff size={15} /></button>}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-emerald-500/12 text-emerald-500" : "bg-slate-500/12 text-[var(--text-sub)]"}`}>{active ? "ACTIVE" : "DISABLED"}</span>;
}

function ProductWorkflowBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-950/70 text-slate-200",
    PENDING_APPROVAL: "bg-amber-500/90 text-slate-950",
    ACTIVE: "bg-emerald-500/90 text-white",
    REJECTED: "bg-rose-500/90 text-white",
    ARCHIVED: "bg-slate-600/90 text-white",
  };
  const labels: Record<string, string> = {
    DRAFT: "DRAFT",
    PENDING_APPROVAL: "PENDING REVIEW",
    ACTIVE: "ACTIVE",
    REJECTED: "CHANGES REQUESTED",
    ARCHIVED: "ARCHIVED",
  };
  return (
    <span className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold tracking-wide backdrop-blur ${styles[status] ?? styles.DRAFT}`}>
      {labels[status] ?? status}
    </span>
  );
}

function TypeBadge({ type }: { type: "SKU" | "COMBO" }) {
  return <span className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold ${type === "COMBO" ? "bg-violet-500/10 text-violet-500" : "bg-blue-500/10 text-blue-500"}`}>{type}</span>;
}

function StockBadge({ available }: { available: number }) {
  if (available <= 0) return <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-500">SOLD OUT</span>;
  if (available <= LOW_STOCK_THRESHOLD) return <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-500">LOW STOCK</span>;
  return <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-500">IN STOCK</span>;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[var(--text-sub)]">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-[var(--text-sub)]">{hint}</span>}
    </label>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-color)] p-3.5">
      <div><p className="text-sm font-medium text-[var(--text-main)]">{label}</p><p className="mt-0.5 text-xs text-[var(--text-sub)]">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-400/35"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function Metric({ label, value, emphasize = false }: { label: string; value: number; emphasize?: boolean }) {
  return <div className={`rounded-xl border p-3 text-center ${emphasize ? "border-blue-500/25 bg-blue-500/5" : "border-[var(--border-color)]"}`}><p className="text-[11px] text-[var(--text-sub)]">{label}</p><p className={`mt-1 text-xl font-semibold ${emphasize ? "text-blue-500" : "text-[var(--text-main)]"}`}>{value}</p></div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]"><div className="text-center"><LoaderCircle size={22} className="mx-auto animate-spin text-blue-500" /><p className="mt-3 text-sm text-[var(--text-sub)]">{label}</p></div></div>;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`grid place-items-center rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] px-6 text-center ${compact ? "min-h-44 py-6" : "min-h-72 py-10"}`}>
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-500"><Icon size={21} /></span>
        <h3 className="mt-3 text-sm font-semibold text-[var(--text-main)]">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-sub)]">{description}</p>
      </div>
    </div>
  );
}
