import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CopyPlus,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { RowActions, type RowAction } from "../../components/admin/RowActions";
import { movieApi, type ClusterResponse, type ScreeningFormatResponse } from "../../api/movieApi";
import {
  priceBookApi,
  type PriceBook,
  type PriceBookPayload,
  type PriceBookStatus,
  type PriceRate,
  type PriceRateDayType,
} from "../../api/priceBookApi";

const emptyRate = (): PriceRate => ({
  name: "Standard rate",
  dayType: "ALL_DAYS",
  startTime: "08:00",
  endTime: "23:59",
  formatId: null,
  standardPrice: 90000,
  vipMultiplier: 1.25,
  coupleMultiplier: 1.8,
  accessibleMultiplier: 1,
  priority: 0,
  active: true,
});

const emptyPayload = (): PriceBookPayload => ({
  clusterId: 0,
  code: "",
  name: "",
  currencyCode: "VND",
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: null,
  priority: 0,
  rates: [emptyRate()],
});

const fieldClass =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500";

const toolbarControlClass =
  "h-[42px] rounded-xl border px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function formatMoney(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "No end date";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toPayload(book: PriceBook): PriceBookPayload {
  return {
    clusterId: book.clusterId,
    code: book.code,
    name: book.name,
    currencyCode: book.currencyCode,
    validFrom: book.validFrom,
    validTo: book.validTo ?? null,
    priority: book.priority,
    rates: book.rates.map((rate) => ({ ...rate })),
  };
}

function statusStyle(status: PriceBookStatus) {
  if (status === "ACTIVE") return { color: "#059669", background: "rgba(16,185,129,.12)" };
  if (status === "ARCHIVED") return { color: "#64748b", background: "rgba(100,116,139,.12)" };
  return { color: "#2563eb", background: "rgba(37,99,235,.12)" };
}

export default function ManagePriceBooksPage() {
  const [books, setBooks] = useState<PriceBook[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [formats, setFormats] = useState<ScreeningFormatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | PriceBookStatus>("ALL");
  const [clusterId, setClusterId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PriceBookPayload>(emptyPayload);
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewingBook, setViewingBook] = useState<PriceBook | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [bookResponse, clusterResponse, formatResponse] = await Promise.all([
        priceBookApi.list(),
        movieApi.getClusters(),
        movieApi.getScreeningFormats(),
      ]);
      setBooks(bookResponse.result ?? []);
      setClusters(clusterResponse.result ?? []);
      setFormats(formatResponse.result ?? []);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message ?? "Unable to load pricing configuration.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => ({
    total: books.length,
    active: books.filter((book) => book.status === "ACTIVE").length,
    draft: books.filter((book) => book.status === "DRAFT").length,
    rates: books.reduce((total, book) => total + book.rates.length, 0),
  }), [books]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return books.filter((book) =>
      (!needle
        || book.name.toLowerCase().includes(needle)
        || book.code.toLowerCase().includes(needle)
        || book.clusterName.toLowerCase().includes(needle))
      && (status === "ALL" || book.status === status)
      && (!clusterId || book.clusterId === Number(clusterId)));
  }, [books, clusterId, search, status]);

  const openCreate = () => {
    const next = emptyPayload();
    if (clusters.length > 0) next.clusterId = clusters[0].clusterId;
    setEditingId(null);
    setForm(next);
    setEditorOpen(true);
  };

  const openEdit = (book: PriceBook) => {
    setEditingId(book.priceBookId);
    setForm(toPayload(book));
    setEditorOpen(true);
  };

  const duplicate = (book: PriceBook) => {
    const copy = toPayload(book);
    copy.code = `${book.code}_COPY`;
    copy.name = `${book.name} copy`;
    copy.rates = copy.rates.map(({ priceRateId: _priceRateId, ...rate }) => rate);
    setEditingId(null);
    setForm(copy);
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.clusterId || !form.code.trim() || !form.name.trim()) {
      setMessage({ type: "error", text: "Cinema, code and price book name are required." });
      return;
    }
    if (!form.rates.length) {
      setMessage({ type: "error", text: "Add at least one rate card before saving." });
      return;
    }
    setSaving(true);
    try {
      if (editingId) await priceBookApi.update(editingId, form);
      else await priceBookApi.create(form);
      setEditorOpen(false);
      await load();
      setMessage({ type: "success", text: editingId ? "Price book updated." : "Price book created as draft." });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.response?.data?.message ?? "Unable to save price book." });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (book: PriceBook, action: "activate" | "archive") => {
    try {
      if (action === "activate") await priceBookApi.activate(book.priceBookId);
      else await priceBookApi.archive(book.priceBookId);
      await load();
      setMessage({ type: "success", text: action === "activate" ? "Price book activated." : "Price book archived." });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.response?.data?.message ?? "Unable to update price book status." });
    }
  };

  const setRate = <K extends keyof PriceRate>(index: number, key: K, value: PriceRate[K]) => {
    setForm((current) => ({
      ...current,
      rates: current.rates.map((rate, rateIndex) =>
        rateIndex === index ? { ...rate, [key]: value } : rate),
    }));
  };

  const removeRate = (index: number) => {
    setForm((current) => ({ ...current, rates: current.rates.filter((_, rateIndex) => rateIndex !== index) }));
  };

  const summaryCards = [
    { label: "Price books", value: stats.total, sub: "commercial catalogues", icon: BookOpenCheck, color: "#2563eb" },
    { label: "Active", value: stats.active, sub: "eligible for pricing", icon: CheckCircle2, color: "#059669" },
    { label: "Draft", value: stats.draft, sub: "not used by showtimes", icon: Edit3, color: "#d97706" },
    { label: "Rate cards", value: stats.rates, sub: "time and format rules", icon: Clock3, color: "#7c3aed" },
  ];

  return (
    <div className="space-y-5">
      <header className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-main)" }}>
          Price Books / Rate Cards
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-sub)" }}>
          Configure cluster pricing by effective date, business day, start time and presentation format.
        </p>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, sub, icon: Icon, color }) => (
          <article
            key={label}
            className="flex flex-col gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-sm"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[13px]" style={{ color: "var(--text-sub)" }}>{label}</p>
                <p className="mt-1 text-[26px] font-bold leading-none" style={{ color: "var(--text-main)" }}>
                  {loading ? "—" : value}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color, background: `${color}18` }}>
                <Icon size={18} />
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>{sub}</p>
          </article>
        ))}
      </section>

      {message && (
        <div
          className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
          style={message.type === "error"
            ? { borderColor: "rgba(244,63,94,.35)", background: "rgba(244,63,94,.08)", color: "#f43f5e" }
            : { borderColor: "rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", color: "#059669" }}
        >
          {message.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {message.text}
        </div>
      )}

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, name or cinema..."
            className={`${toolbarControlClass} w-full pl-10 pr-4`}
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          />
        </label>
        <div
          className="flex min-w-0 items-center overflow-hidden rounded-xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <span className="flex h-[42px] shrink-0 items-center px-3" style={{ color: "var(--text-sub)" }}>
            <SlidersHorizontal size={15} />
          </span>
          <select
            value={clusterId}
            onChange={(event) => setClusterId(event.target.value)}
            className="h-[42px] min-w-0 flex-1 border-0 border-l px-3 text-sm outline-none sm:min-w-[190px]"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            aria-label="Filter by cinema"
          >
            <option value="">All cinemas</option>
            {clusters.map((cluster) => <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.clusterName}</option>)}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | PriceBookStatus)}
            className="h-[42px] min-w-[135px] border-0 border-l px-3 text-sm outline-none"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> New price book
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_.7fr_.8fr] gap-5 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-wider lg:grid" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
          <span>Price book</span><span>Effective window</span><span>Coverage</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        {!loading && filtered.map((book) => {
          const prices = book.rates.filter((rate) => rate.active).map((rate) => rate.standardPrice);
          const minPrice = prices.length ? Math.min(...prices) : null;
          const maxPrice = prices.length ? Math.max(...prices) : null;
          return (
            <article
              key={book.priceBookId}
              className="grid gap-4 border-b px-5 py-4 last:border-b-0 lg:grid-cols-[1.4fr_1fr_1fr_.7fr_.8fr] lg:items-center"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm" style={{ color: "var(--text-main)" }}>{book.name}</strong>
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">{book.code}</span>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>{book.clusterName}</p>
              </div>
              <div className="text-xs" style={{ color: "var(--text-main)" }}>
                <span className="inline-flex items-center gap-1.5"><CalendarRange size={14} /> {formatDate(book.validFrom)}</span>
                <p className="mt-1 pl-5" style={{ color: "var(--text-sub)" }}>to {formatDate(book.validTo)}</p>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{book.rates.length} rate card{book.rates.length === 1 ? "" : "s"}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                  {minPrice == null ? "No active rate" : minPrice === maxPrice
                    ? `From ${formatMoney(minPrice, book.currencyCode)}`
                    : `${formatMoney(minPrice, book.currencyCode)} – ${formatMoney(maxPrice!, book.currencyCode)}`}
                </p>
              </div>
              <div>
                <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" style={statusStyle(book.status)}>
                  {book.status}
                </span>
              </div>
              <div className="flex justify-end">
                <RowActions
                  ariaLabel={`Actions for ${book.name}`}
                  actions={[
                    { key: "view", label: "View rate cards", icon: Eye, onSelect: () => setViewingBook(book) },
                    { key: "edit", label: "Edit price book", icon: Edit3, onSelect: () => openEdit(book), hidden: book.status === "ARCHIVED" },
                    { key: "duplicate", label: "Duplicate price book", icon: CopyPlus, onSelect: () => duplicate(book) },
                    { key: "activate", label: "Activate price book", icon: CheckCircle2, onSelect: () => void changeStatus(book, "activate"), hidden: book.status !== "DRAFT", separatorBefore: true },
                    { key: "archive", label: "Archive price book", icon: Archive, onSelect: () => void changeStatus(book, "archive"), hidden: book.status === "ARCHIVED", destructive: true, separatorBefore: true },
                  ] satisfies RowAction[]}
                />
              </div>
            </article>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="px-5 py-14 text-center">
            <CircleDollarSign size={28} className="mx-auto text-blue-500" />
            <p className="mt-3 text-sm font-semibold" style={{ color: "var(--text-main)" }}>No price books found</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Create a draft or change the current filters.</p>
          </div>
        )}
      </section>

      {viewingBook && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && setViewingBook(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <header
              className="flex items-start justify-between border-b px-6 py-5"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
                    {viewingBook.name}
                  </h2>
                  <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-500">
                    {viewingBook.code}
                  </span>
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={statusStyle(viewingBook.status)}
                  >
                    {viewingBook.status}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                  {viewingBook.clusterName} · {formatDate(viewingBook.validFrom)} to {formatDate(viewingBook.validTo)}
                  {" · "}{viewingBook.currencyCode} · Book priority {viewingBook.priority}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingBook(null)}
                className="rounded-lg border p-2"
                style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}
                aria-label="Close price book details"
              >
                <X size={17} />
              </button>
            </header>

            <div className="overflow-y-auto p-6">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3 className="font-bold" style={{ color: "var(--text-main)" }}>
                    Rate cards ({viewingBook.rates.length})
                  </h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                    A showtime uses the highest-priority active card matching its day, start time and format.
                  </p>
                </div>
                {viewingBook.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingBook(null);
                      openEdit(viewingBook);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
                  >
                    <Edit3 size={15} /> Edit price book
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)" }}>
                <div
                  className="hidden grid-cols-[1.35fr_.7fr_.9fr_.7fr_.8fr_.8fr_.8fr] gap-3 border-b px-4 py-3 text-[10px] font-semibold uppercase tracking-wider lg:grid"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", background: "var(--bg-main)" }}
                >
                  <span>Rate card</span>
                  <span>Day</span>
                  <span>Start time</span>
                  <span>Format</span>
                  <span>Standard</span>
                  <span>VIP</span>
                  <span>Couple</span>
                </div>
                {viewingBook.rates
                  .slice()
                  .sort((left, right) => right.priority - left.priority || left.startTime.localeCompare(right.startTime))
                  .map((rate, index) => (
                    <article
                      key={rate.priceRateId ?? `${rate.name}-${index}`}
                      className="grid gap-2 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[1.35fr_.7fr_.9fr_.7fr_.8fr_.8fr_.8fr] lg:items-center lg:gap-3"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{rate.name}</p>
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-sub)" }}>
                          Priority {rate.priority}{rate.active ? "" : " · Inactive"}
                        </p>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-main)" }}>{rate.dayType.replace("_", " ")}</span>
                      <span className="text-xs" style={{ color: "var(--text-main)" }}>
                        {rate.startTime.slice(0, 5)}–{rate.endTime.slice(0, 5)}
                      </span>
                      <span className="text-xs font-semibold text-blue-500">{rate.formatCode ?? "All formats"}</span>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>
                        {formatMoney(rate.standardPrice, viewingBook.currencyCode)}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-main)" }}>
                        ×{rate.vipMultiplier} · {formatMoney(rate.standardPrice * rate.vipMultiplier, viewingBook.currencyCode)}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-main)" }}>
                        ×{rate.coupleMultiplier} · {formatMoney(rate.standardPrice * rate.coupleMultiplier, viewingBook.currencyCode)}
                      </span>
                    </article>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setEditorOpen(false)}>
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-2xl" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <header className="flex items-start justify-between border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>{editingId ? "Edit price book" : "New price book"}</h2>
                <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Draft changes affect only showtimes priced after activation; existing seat snapshots are retained.</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border p-2" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><X size={17} /></button>
            </header>

            <div className="overflow-y-auto p-6">
              <section className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2 xl:grid-cols-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <label className="text-xs" style={{ color: "var(--text-sub)" }}>Cinema cluster *
                  <select value={form.clusterId} onChange={(event) => setForm({ ...form, clusterId: Number(event.target.value) })} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                    <option value={0}>Select cinema</option>
                    {clusters.map((cluster) => <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.clusterName}</option>)}
                  </select>
                </label>
                <label className="text-xs" style={{ color: "var(--text-sub)" }}>Price book code *
                  <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} placeholder="HCM_2026_WEEKLY" />
                </label>
                <label className="text-xs md:col-span-2" style={{ color: "var(--text-sub)" }}>Name *
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} placeholder="Landmark 81 standard pricing" />
                </label>
                <label className="text-xs" style={{ color: "var(--text-sub)" }}>Valid from *
                  <input type="date" value={form.validFrom} onChange={(event) => setForm({ ...form, validFrom: event.target.value })} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                </label>
                <label className="text-xs" style={{ color: "var(--text-sub)" }}>Valid to
                  <input type="date" value={form.validTo ?? ""} onChange={(event) => setForm({ ...form, validTo: event.target.value || null })} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                </label>
                <label className="text-xs" style={{ color: "var(--text-sub)" }}>Currency
                  <select value={form.currencyCode} onChange={(event) => setForm({ ...form, currencyCode: event.target.value })} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}><option value="VND">VND</option><option value="USD">USD</option></select>
                </label>
                <label className="text-xs" style={{ color: "var(--text-sub)" }}>Book priority
                  <input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                </label>
              </section>

              <section className="mt-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-bold" style={{ color: "var(--text-main)" }}>Rate cards</h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Higher priority and more specific format/day rules win when several rates match.</p>
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, rates: [...form.rates, emptyRate()] })} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-blue-500" style={{ borderColor: "rgba(37,99,235,.35)" }}><Plus size={14} /> Add rate</button>
                </div>

                <div className="mt-3 space-y-3">
                  {form.rates.map((rate, index) => (
                    <article key={`${index}-${rate.priceRateId ?? "new"}`} className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Rate {index + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-sub)" }}><input type="checkbox" checked={rate.active} onChange={(event) => setRate(index, "active", event.target.checked)} /> Active</label>
                          <button type="button" onClick={() => removeRate(index)} className="rounded-lg p-1.5 text-rose-500" title="Remove rate"><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <label className="text-xs xl:col-span-2" style={{ color: "var(--text-sub)" }}>Rate name
                          <input value={rate.name} onChange={(event) => setRate(index, "name", event.target.value)} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>Day type
                          <select value={rate.dayType} onChange={(event) => setRate(index, "dayType", event.target.value as PriceRateDayType)} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}><option value="ALL_DAYS">All days</option><option value="WEEKDAY">Weekday</option><option value="WEEKEND">Weekend</option></select>
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>Start
                          <input type="time" value={rate.startTime.slice(0, 5)} onChange={(event) => setRate(index, "startTime", event.target.value)} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>End
                          <input type="time" value={rate.endTime.slice(0, 5)} onChange={(event) => setRate(index, "endTime", event.target.value)} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>Format
                          <select value={rate.formatId ?? ""} onChange={(event) => setRate(index, "formatId", event.target.value ? Number(event.target.value) : null)} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}><option value="">Any format</option>{formats.map((format) => <option key={format.formatId} value={format.formatId}>{format.formatCode}</option>)}</select>
                        </label>
                        <label className="text-xs xl:col-span-2" style={{ color: "var(--text-sub)" }}>Standard price
                          <input type="number" min="1" step="1000" value={rate.standardPrice} onChange={(event) => setRate(index, "standardPrice", Number(event.target.value))} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>VIP multiplier
                          <input type="number" min=".01" step=".05" value={rate.vipMultiplier} onChange={(event) => setRate(index, "vipMultiplier", Number(event.target.value))} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>Couple multiplier
                          <input type="number" min=".01" step=".05" value={rate.coupleMultiplier} onChange={(event) => setRate(index, "coupleMultiplier", Number(event.target.value))} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>Accessible multiplier
                          <input type="number" min=".01" step=".05" value={rate.accessibleMultiplier} onChange={(event) => setRate(index, "accessibleMultiplier", Number(event.target.value))} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                        <label className="text-xs" style={{ color: "var(--text-sub)" }}>Rate priority
                          <input type="number" value={rate.priority} onChange={(event) => setRate(index, "priority", Number(event.target.value))} className={`${fieldClass} mt-1.5`} style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t px-6 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              <p className="hidden text-xs md:block" style={{ color: "var(--text-sub)" }}>Save as draft, verify the rules, then activate it from the list.</p>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setEditorOpen(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Cancel</button>
                <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save draft"}</button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
