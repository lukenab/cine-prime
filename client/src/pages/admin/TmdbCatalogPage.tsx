import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2,
  Clock3, Film, Loader2, RefreshCw, Search, Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { movieApi, type TmdbMovieDetails, type TmdbSearchItem } from "../../api/movieApi";

type CatalogTab = "now-playing" | "upcoming" | "search";

const errorMessage = (error: any) =>
  error?.response?.status === 429
    ? "TMDB rate limit reached. Please wait a moment and retry."
    : error?.response?.data?.message ?? "The movie catalog is temporarily unavailable.";

function MovieCard({ item, selected, onSelect }: {
  item: TmdbSearchItem; selected: boolean; onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect}
      className="group overflow-hidden rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      style={{ background: "var(--bg-card)", borderColor: selected ? "#3b82f6" : "var(--border-color)", boxShadow: selected ? "0 0 0 2px rgba(59,130,246,0.12)" : undefined }}>
      <div className="relative aspect-[2/3] overflow-hidden" style={{ background: "var(--bg-main)" }}>
        {item.posterUrl
          ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          : <div className="flex h-full items-center justify-center"><Film size={28} style={{ color: "var(--text-sub)" }} /></div>}
        {item.alreadyImported && <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Imported</span>}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 min-h-10 text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{item.title}</p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-sub)" }}>{item.releaseDate || "Release date unavailable"}</p>
      </div>
    </button>
  );
}

function PreviewPanel({ item, details, loading, error, onRetry, onUse, onView }: {
  item: TmdbSearchItem | null; details: TmdbMovieDetails | null; loading: boolean;
  error: string; onRetry: () => void; onUse: () => void; onView: () => void;
}) {
  if (!item) return (
    <aside className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div><Film size={30} className="mx-auto mb-3 text-blue-500" /><p className="font-semibold" style={{ color: "var(--text-main)" }}>Select a movie to preview</p><p className="mt-1 max-w-xs text-xs leading-relaxed" style={{ color: "var(--text-sub)" }}>Details are read-only and no local movie is created while you browse.</p></div>
    </aside>
  );

  const backdrop = details?.media?.backdrops.find((image) => image.recommended)?.url
    || details?.media?.backdrops[0]?.url
    || item.posterUrl;
  return (
    <aside className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="relative h-48 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(37,99,235,.16), rgba(124,58,237,.10))" }}>
        {backdrop && <img src={backdrop} alt="" className="h-full w-full object-cover opacity-55 blur-[1px]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-x-5 bottom-4"><p className="text-lg font-bold text-white">{details?.originalTitle || item.title}</p><p className="mt-1 text-xs text-white/75">TMDB #{item.tmdbId}</p></div>
      </div>
      <div className="p-5">
        {loading && <div className="flex items-center justify-center gap-2 py-14 text-sm" style={{ color: "var(--text-sub)" }}><Loader2 size={16} className="animate-spin" /> Loading full details...</div>}
        {!loading && error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center"><AlertCircle size={18} className="mx-auto mb-2 text-rose-500" /><p className="text-xs text-rose-700">{error}</p><button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"><RefreshCw size={12} /> Retry</button></div>}
        {!loading && !error && details && <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: "var(--bg-main)", color: "var(--text-sub)" }}><CalendarDays size={14} /> {details.releaseDate || "Unknown"}</div>
            <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: "var(--bg-main)", color: "var(--text-sub)" }}><Clock3 size={14} /> {details.durationMinutes ? `${details.durationMinutes} min` : "Unknown"}</div>
          </div>
          <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Overview</p><p className="text-xs leading-relaxed" style={{ color: "var(--text-main)" }}>{details.overview || "No overview is available from TMDB."}</p></div>
          {!!details.genres?.length && <div className="flex flex-wrap gap-1.5">{details.genres.map((genre) => <span key={genre.tmdbGenreId} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>{genre.name}</span>)}</div>}
          {!!details.companies?.length && <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Production</p><p className="text-xs" style={{ color: "var(--text-main)" }}>{details.companies.slice(0, 3).map((company) => company.name).join(", ")}</p></div>}
          {!!details.cast?.length && <div><p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}><Users size={12} /> Main cast</p><div className="flex flex-wrap gap-1.5">{details.cast.slice(0, 5).map((member) => <span key={`${member.tmdbId}-${member.roleType}`} className="rounded-lg px-2 py-1 text-[11px]" style={{ background: "var(--bg-main)", color: "var(--text-main)" }}>{member.fullName}</span>)}</div></div>}
          {!!details.warnings?.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="mb-1.5 text-xs font-semibold text-amber-800">Review required after selection</p><p className="text-[11px] leading-relaxed text-amber-700">{details.warnings.length} source or mapping warning{details.warnings.length === 1 ? "" : "s"} will be shown in the movie editor.</p></div>}
        </div>}
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
          {item.alreadyImported
            ? <button type="button" onClick={onView} disabled={!item.localMovieId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={16} /> View existing movie</button>
            : <button type="button" onClick={onUse} disabled={!details || loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Use this movie <ArrowRight size={15} /></button>}
          <p className="mt-2 text-center text-[10.5px]" style={{ color: "var(--text-sub)" }}>This opens a draft editor. It does not import or save automatically.</p>
        </div>
      </div>
    </aside>
  );
}

export default function TmdbCatalogPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<CatalogTab>("now-playing");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<TmdbSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<TmdbSearchItem | null>(null);
  const [details, setDetails] = useState<TmdbMovieDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsReloadKey, setDetailsReloadKey] = useState(0);

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 400); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    let active = true;
    if (tab === "search" && debouncedQuery.length < 2) { setItems([]); setError(""); setLoading(false); return () => { active = false; }; }
    setLoading(true); setError("");
    const request = tab === "now-playing" ? movieApi.tmdbNowPlaying("VN", page) : tab === "upcoming" ? movieApi.tmdbUpcoming("VN", page) : movieApi.tmdbSearch(debouncedQuery);
    request.then((response) => { if (active) setItems(response.result ?? []); }).catch((requestError) => { if (active) { setItems([]); setError(errorMessage(requestError)); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, page, debouncedQuery, reloadKey]);
  useEffect(() => {
    if (!selected) return;
    let active = true; setDetails(null); setDetailsLoading(true); setDetailsError("");
    movieApi.tmdbDetails(selected.tmdbId).then((response) => { if (active) setDetails(response.result); }).catch((requestError) => { if (active) setDetailsError(errorMessage(requestError)); }).finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [selected, detailsReloadKey]);

  const tabs = useMemo(() => [
    { id: "now-playing" as const, label: "Now playing", icon: Film },
    { id: "upcoming" as const, label: "Upcoming", icon: CalendarDays },
    { id: "search" as const, label: "Search", icon: Search },
  ], []);
  const changeTab = (next: CatalogTab) => { setTab(next); setPage(1); setSelected(null); setDetails(null); };

  return <div className="w-full">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><button type="button" onClick={() => navigate("/admin/movies/new")} className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)" }} aria-label="Back to creation methods"><ArrowLeft size={16} /></button><div><h1 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>Import from movie catalog</h1><p className="text-xs" style={{ color: "var(--text-sub)" }}>Vietnam catalog · read-only preview</p></div></div>
      <button type="button" onClick={() => navigate("/admin/movies/new/manual")} className="rounded-xl border px-4 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-card)" }}>Create manually instead</button>
    </div>
    <div className="mb-5 rounded-2xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}><div className="flex flex-wrap items-center gap-2">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => changeTab(id)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold" style={{ background: tab === id ? "#2563eb" : "transparent", color: tab === id ? "#fff" : "var(--text-sub)" }}><Icon size={14} /> {label}</button>)}
      {tab === "search" && <div className="relative ml-0 min-w-[240px] flex-1 sm:ml-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by movie title..." className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)" }} /></div>}
    </div></div>
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section>
        {loading && items.length === 0 ? <div className="flex min-h-96 items-center justify-center gap-2 rounded-2xl border" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><Loader2 size={17} className="animate-spin" /> Loading catalog...</div>
          : error ? <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border p-6 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}><AlertCircle size={24} className="mb-3 text-rose-500" /><p className="text-sm" style={{ color: "var(--text-main)" }}>{error}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"><RefreshCw size={13} /> Retry</button></div>
          : tab === "search" && debouncedQuery.length < 2 ? <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>Enter at least 2 characters to search the catalog.</div>
          : items.length === 0 ? <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>No movies found for this catalog page.</div>
          : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{items.map((item) => <MovieCard key={item.tmdbId} item={item} selected={selected?.tmdbId === item.tmdbId} onSelect={() => setSelected(item)} />)}</div>}
        {tab !== "search" && !error && <div className="mt-5 flex items-center justify-center gap-3"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-card)" }}>Previous</button><span className="text-xs" style={{ color: "var(--text-sub)" }}>Page {page}</span><button type="button" disabled={loading || items.length === 0} onClick={() => setPage((value) => value + 1)} className="rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-card)" }}>Next</button></div>}
      </section>
      <div className="xl:sticky xl:top-5"><PreviewPanel item={selected} details={details} loading={detailsLoading} error={detailsError} onRetry={() => setDetailsReloadKey((key) => key + 1)} onView={() => selected?.localMovieId && navigate(`/admin/movies/${selected.localMovieId}/edit`)} onUse={() => selected && details && navigate(`/admin/movies/new/manual?tmdbId=${selected.tmdbId}`, { state: { tmdbItem: selected, tmdbDetails: details } })} /></div>
    </div>
  </div>;
}
