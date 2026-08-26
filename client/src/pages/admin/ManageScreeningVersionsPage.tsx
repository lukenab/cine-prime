import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Film,
  Languages,
  MonitorPlay,
  RefreshCw,
  Search,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  movieApi,
  type MovieScreeningVersionCatalogResponse,
  type ScreeningVersionCatalogPageResponse,
  type ScreeningFormatResponse,
  type ScreeningVersionStatus,
} from "../../api/movieApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { AdminPagination } from "../../components/admin/AdminPagination";
import { RequestState } from "../../components/shared/RequestState";
import { classifyRequestFailure, type RequestFailure } from "../../utils/requestFailure";
import { useRole } from "../../hooks/useRole";

type ReadinessFilter = "ALL" | "READY" | "ATTENTION" | "INACTIVE";
const PAGE_SIZE = 10;

const STATUS_META: Record<ScreeningVersionStatus, { label: string; color: string; background: string }> = {
  ACTIVE: { label: "Active", color: "#059669", background: "rgba(16,185,129,0.12)" },
  INACTIVE: { label: "Inactive", color: "#64748b", background: "rgba(100,116,139,0.12)" },
  SUPERSEDED: { label: "Superseded", color: "#d97706", background: "rgba(245,158,11,0.12)" },
};

function displayLanguage(code?: string | null) {
  if (!code) return "None";
  return code.toUpperCase();
}

function displayDate(value?: string | null) {
  if (!value) return "Open";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function displayEffectiveWindow(version: MovieScreeningVersionCatalogResponse) {
  if (!version.effectiveFrom && !version.effectiveTo) {
    return "Always effective";
  }
  return `${displayDate(version.effectiveFrom)} – ${displayDate(version.effectiveTo)}`;
}

function versionIsReady(version: MovieScreeningVersionCatalogResponse) {
  return version.status === "ACTIVE" && !version.requiresAttention;
}

function readinessReason(version: MovieScreeningVersionCatalogResponse) {
  if (!version.audioFormatId) {
    return {
      title: "Audio format not configured",
      detail: "Set the playback audio system before this version can be scheduled.",
    };
  }
  return {
    title: "No compatible room",
    detail: "Check the room presentation and audio capabilities.",
  };
}

export default function ManageScreeningVersionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isAdmin } = useRole();
  const canManageVersions = isAdmin || hasPermission("MOVIE_UPDATE");
  const [pageResult, setPageResult] = useState<ScreeningVersionCatalogPageResponse | null>(null);
  const [formats, setFormats] = useState<ScreeningFormatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") ?? "");
  const [formatId, setFormatId] = useState(searchParams.get("format") ?? "");
  const initialReadiness = searchParams.get("readiness") as ReadinessFilter | null;
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>(
    initialReadiness && ["ALL", "READY", "ATTENTION", "INACTIVE"].includes(initialReadiness)
      ? initialReadiness
      : "ALL",
  );
  const [page, setPage] = useState(Math.max(0, Number(searchParams.get("page") ?? 1) - 1 || 0));
  const [expandedMovieIds, setExpandedMovieIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const response = await movieApi.searchMovieScreeningVersionPage({
        q: debouncedSearch,
        formatId: formatId ? Number(formatId) : undefined,
        readiness: readinessFilter,
        page,
        size: PAGE_SIZE,
      });
      setPageResult(response.result ?? null);
    } catch (requestError) {
      setFailure(classifyRequestFailure(requestError, "Screening versions could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, formatId, page, readinessFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void movieApi.getScreeningFormats()
      .then((response) => setFormats(response.result ?? []))
      .catch(() => setFormats([]));
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set("q", debouncedSearch);
    if (formatId) next.set("format", formatId);
    if (readinessFilter !== "ALL") next.set("readiness", readinessFilter);
    if (page > 0) next.set("page", String(page + 1));
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, formatId, page, readinessFilter, setSearchParams]);

  const groups = pageResult?.content ?? [];
  const stats = pageResult?.summary;

  const summaryCards = [
    {
      label: "Movies covered",
      value: loading ? "—" : String(stats?.moviesCovered ?? 0),
      sub: "with screening versions",
      icon: Film,
      iconBackground: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      label: "Total versions",
      value: loading ? "—" : String(stats?.totalVersions ?? 0),
      sub: "presentation packages",
      icon: MonitorPlay,
      iconBackground: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Schedulable",
      value: loading ? "—" : String(stats?.schedulable ?? 0),
      sub: "ready for scheduling",
      icon: CheckCircle2,
      iconBackground: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Needs attention",
      value: loading ? "—" : String(stats?.needsAttention ?? 0),
      sub: "configuration blockers",
      icon: AlertTriangle,
      iconBackground: "bg-rose-50",
      iconColor: "text-rose-500",
    },
  ];

  const fieldStyle = {
    background: "var(--bg-card)",
    borderColor: "var(--border-color)",
    color: "var(--text-main)",
  };

  const toggleMovie = (movieId: number) => {
    setExpandedMovieIds((current) => {
      const next = new Set(current);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  };

  const openMovieEditor = (movieId: number) => {
    navigate(`/admin/movies/${movieId}/edit#screening-versions`);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Film programming"
        title="Screening Versions"
        description="Review the presentation, language and audio packages available for scheduling."
        className="!mb-2"
      />

      <section
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Screening version summary"
      >
        {summaryCards.map(({ label, value, sub, icon: Icon, iconBackground, iconColor }) => (
          <div
            key={label}
            className="flex flex-col gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-sm"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
                <p
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: "var(--text-main)",
                    marginTop: "4px",
                  }}
                >
                  {value}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBackground}`}>
                <Icon size={18} className={iconColor} />
              </div>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{sub}</p>
          </div>
        ))}
      </section>

      <section
        className="flex flex-wrap items-center gap-3 rounded-2xl border p-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        aria-label="Screening version filters"
      >
        <label className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search movie, format or language..."
            className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            style={fieldStyle}
          />
        </label>

        <div className="flex items-center rounded-xl border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
          {([
            { value: "ALL", label: "All" },
            { value: "READY", label: "Schedulable" },
            { value: "ATTENTION", label: "Needs attention" },
            { value: "INACTIVE", label: "Inactive" },
          ] as const).map((option) => {
            const selected = readinessFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setReadinessFilter(option.value);
                  setPage(0);
                }}
                className="rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                style={selected
                  ? { background: "#2563eb", color: "white" }
                  : { background: "transparent", color: "var(--text-sub)" }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <select
          value={formatId}
          onChange={(event) => {
            setFormatId(event.target.value);
            setPage(0);
          }}
          className="min-w-[145px] rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-500"
          style={fieldStyle}
          aria-label="Filter by presentation format"
        >
          <option value="">All formats</option>
          {formats.map((format) => (
            <option key={format.formatId} value={format.formatId}>{format.formatCode}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-opacity hover:opacity-80 disabled:opacity-50"
          style={fieldStyle}
          title="Refresh screening versions"
          aria-label="Refresh screening versions"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </section>

      {failure && <RequestState compact kind={failure.kind} description={failure.description} onRetry={() => void load()} />}

      <section className="space-y-3" aria-label="Screening versions grouped by movie">
        {!failure && !loading && groups.length === 0 && (
          <RequestState compact kind="empty" title="No screening versions match this view" description="Change the search or filters, or add a screening version to an approved movie." />
        )}
        {!failure && !loading && groups.map((group) => {
          const expanded = expandedMovieIds.has(group.movieId);
          const readyCount = group.versions.filter(versionIsReady).length;
          const attentionCount = group.versions.filter((version) => version.requiresAttention).length;

          return (
            <article
              key={group.movieId}
              className="overflow-hidden rounded-2xl border"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              <button
                type="button"
                onClick={() => toggleMovie(group.movieId)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-blue-500/[0.035]"
                aria-expanded={expanded}
                aria-controls={`movie-versions-${group.movieId}`}
              >
                {group.posterUrl?.trim() ? (
                  <img src={group.posterUrl} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <Film size={17} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-bold" style={{ color: "var(--text-main)" }}>
                      {group.displayTitle}
                    </h2>
                    <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {group.movieStatus.replaceAll("_", " ")}
                    </span>
                  </div>
                  {group.originalTitle && group.originalTitle !== group.displayTitle && (
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--text-sub)" }}>
                      {group.originalTitle}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-sub)" }}>
                    <span>{group.versions.length} version{group.versions.length === 1 ? "" : "s"}</span>
                    <span className={readyCount > 0 ? "text-emerald-500" : ""}>{readyCount} schedulable</span>
                    {attentionCount > 0 && <span className="text-rose-500">{attentionCount} need attention</span>}
                  </div>
                </div>

                <span className="shrink-0" style={{ color: "var(--text-sub)" }}>
                  {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </span>
              </button>

              {expanded && (
                <div id={`movie-versions-${group.movieId}`} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                  {group.versions.map((version) => {
                    const statusMeta = STATUS_META[version.status];
                    const ready = versionIsReady(version);
                    const reason = readinessReason(version);

                    return (
                      <div
                        key={version.screeningVersionId}
                        className="grid gap-4 border-b px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(280px,1.35fr)_minmax(240px,1fr)_auto] lg:items-center"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-500">
                              {version.formatCode}
                            </span>
                            <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                              {displayLanguage(version.audioLanguageCode)} audio
                            </span>
                            <span className="text-sm" style={{ color: "var(--text-sub)" }}>·</span>
                            <span className="text-sm" style={{ color: "var(--text-sub)" }}>
                              {version.subtitleLanguageCode
                                ? `${displayLanguage(version.subtitleLanguageCode)} subtitles`
                                : "No subtitles"}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-sub)" }}>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarRange size={13} />
                              {displayEffectiveWindow(version)}
                            </span>
                            {version.referenceCount > 0 && (
                              <span>{version.referenceCount} schedule reference{version.referenceCount === 1 ? "" : "s"}</span>
                            )}
                          </div>
                        </div>

                        <div className="min-w-0">
                          {ready ? (
                            <>
                              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
                                <CheckCircle2 size={16} />
                                Ready for scheduling
                              </div>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                                {version.audioFormatName || version.audioFormatCode} · {version.compatibleRoomCount} rooms across {version.compatibleClusterCount} cinemas
                              </p>
                            </>
                          ) : version.requiresAttention ? (
                            <>
                              <div className="flex items-center gap-2 text-sm font-semibold text-rose-500">
                                <AlertTriangle size={16} />
                                {reason.title}
                              </div>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>{reason.detail}</p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-sub)" }}>
                                <Languages size={16} />
                                Not available for scheduling
                              </div>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
                                {version.audioFormatName || version.audioFormatCode || "Audio format not configured"}
                              </p>
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:justify-end">
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{ color: statusMeta.color, background: statusMeta.background }}
                          >
                            {statusMeta.label}
                          </span>
                          {canManageVersions && <button
                            type="button"
                            onClick={() => openMovieEditor(version.movieId)}
                            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                              version.requiresAttention
                                ? "border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                                : "hover:border-blue-500 hover:text-blue-500"
                            }`}
                            style={version.requiresAttention ? undefined : fieldStyle}
                          >
                            {version.requiresAttention ? "Fix configuration" : "Manage"}
                          </button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}

        {loading && (
          <div className="rounded-2xl border py-16 text-center text-sm" style={{ ...fieldStyle, color: "var(--text-sub)" }}>
            Loading screening versions...
          </div>
        )}

      </section>

      {!loading && pageResult && groups.length > 0 && (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <AdminPagination
            page={pageResult.page}
            size={pageResult.size}
            totalElements={pageResult.totalElements}
            totalPages={pageResult.totalPages}
            itemLabel="movies"
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
