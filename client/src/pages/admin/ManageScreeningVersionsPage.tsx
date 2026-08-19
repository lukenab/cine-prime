import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import {
  movieApi,
  type MovieScreeningVersionCatalogResponse,
  type ScreeningFormatResponse,
  type ScreeningVersionStatus,
} from "../../api/movieApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";

type ReadinessFilter = "ALL" | "READY" | "ATTENTION" | "INACTIVE";

type MovieVersionGroup = {
  movieId: number;
  movieTitle: string;
  movieStatus: MovieScreeningVersionCatalogResponse["movieStatus"];
  posterUrl?: string | null;
  versions: MovieScreeningVersionCatalogResponse[];
};

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
  const [versions, setVersions] = useState<MovieScreeningVersionCatalogResponse[]>([]);
  const [formats, setFormats] = useState<ScreeningFormatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formatId, setFormatId] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("ALL");
  const [expandedMovieIds, setExpandedMovieIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [versionResponse, formatResponse] = await Promise.all([
        movieApi.searchMovieScreeningVersions(),
        movieApi.getScreeningFormats(),
      ]);
      setVersions(versionResponse.result ?? []);
      setFormats(formatResponse.result ?? []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? "Unable to load screening versions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return versions.filter((version) => {
      const matchesSearch =
        !needle
        || version.movieTitle.toLowerCase().includes(needle)
        || version.formatCode.toLowerCase().includes(needle)
        || (version.audioFormatCode ?? "").toLowerCase().includes(needle)
        || version.audioLanguageCode.toLowerCase().includes(needle)
        || (version.subtitleLanguageCode ?? "").toLowerCase().includes(needle);

      const matchesReadiness =
        readinessFilter === "ALL"
        || (readinessFilter === "READY" && versionIsReady(version))
        || (readinessFilter === "ATTENTION" && version.requiresAttention)
        || (readinessFilter === "INACTIVE" && version.status !== "ACTIVE");

      return matchesSearch
        && matchesReadiness
        && (!formatId || version.formatId === Number(formatId));
    });
  }, [formatId, readinessFilter, search, versions]);

  const groups = useMemo<MovieVersionGroup[]>(() => {
    const grouped = new Map<number, MovieVersionGroup>();
    filtered.forEach((version) => {
      const existing = grouped.get(version.movieId);
      if (existing) {
        existing.versions.push(version);
        return;
      }
      grouped.set(version.movieId, {
        movieId: version.movieId,
        movieTitle: version.movieTitle,
        movieStatus: version.movieStatus,
        posterUrl: version.posterUrl,
        versions: [version],
      });
    });
    return Array.from(grouped.values()).sort((left, right) =>
      left.movieTitle.localeCompare(right.movieTitle),
    );
  }, [filtered]);

  const stats = useMemo(() => ({
    movies: new Set(versions.map((item) => item.movieId)).size,
    total: versions.length,
    ready: versions.filter(versionIsReady).length,
    attention: versions.filter((item) => item.requiresAttention).length,
  }), [versions]);

  const summaryCards = [
    {
      label: "Movies covered",
      value: loading ? "—" : String(stats.movies),
      sub: "with screening versions",
      icon: Film,
      iconBackground: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      label: "Total versions",
      value: loading ? "—" : String(stats.total),
      sub: "presentation packages",
      icon: MonitorPlay,
      iconBackground: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Schedulable",
      value: loading ? "—" : String(stats.ready),
      sub: "ready for scheduling",
      icon: CheckCircle2,
      iconBackground: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Needs attention",
      value: loading ? "—" : String(stats.attention),
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
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Film programming"
        title="Screening Versions"
        description="Review the presentation, language and audio packages available for scheduling."
        className="!mb-0"
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
                onClick={() => setReadinessFilter(option.value)}
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
          onChange={(event) => setFormatId(event.target.value)}
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

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <section className="space-y-3" aria-label="Screening versions grouped by movie">
        {!loading && groups.map((group) => {
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
                      {group.movieTitle}
                    </h2>
                    <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {group.movieStatus.replaceAll("_", " ")}
                    </span>
                  </div>
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
                          <button
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
                          </button>
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

        {!loading && !error && groups.length === 0 && (
          <div className="rounded-2xl border py-16 text-center" style={fieldStyle}>
            <MonitorPlay size={24} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>No matching screening version</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
              Adjust the search, readiness or format filter.
            </p>
          </div>
        )}
      </section>

      {!loading && groups.length > 0 && (
        <p className="text-center text-xs" style={{ color: "var(--text-sub)" }}>
          Showing {filtered.length} of {versions.length} versions across {groups.length} movie{groups.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
