import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Eye, Film, Search } from "lucide-react";
import { RowActions } from "../../components/admin/RowActions";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  movieApi,
  type MovieAvailabilityResponse,
  type ReleasePlanningQueuePageResponse,
} from "../../api/movieApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { AdminPagination } from "../../components/admin/AdminPagination";
import { RequestState } from "../../components/shared/RequestState";
import { classifyRequestFailure, type RequestFailure } from "../../utils/requestFailure";
import { useRole } from "../../hooks/useRole";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

const PLAN_META: Record<string, { label: string; color: string; background: string }> = {
  PLANNED: { label: "Draft plan", color: "#60a5fa", background: "rgba(59,130,246,.12)" },
  IN_REVIEW: { label: "Awaiting approval", color: "#fbbf24", background: "rgba(245,158,11,.12)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#fb7185", background: "rgba(244,63,94,.12)" },
  APPROVED: { label: "Approved", color: "#34d399", background: "rgba(16,185,129,.12)" },
  OPEN: { label: "Active", color: "#059669", background: "rgba(16,185,129,.12)" },
  SUSPENDED: { label: "Suspended", color: "#f97316", background: "rgba(249,115,22,.12)" },
  CLOSED: { label: "Closed", color: "#94a3b8", background: "rgba(148,163,184,.12)" },
};

const STATUS_ORDER = ["CHANGES_REQUESTED", "PLANNED", "IN_REVIEW", "APPROVED", "OPEN", "SUSPENDED", "CLOSED"];
const PAGE_SIZE = 10;
const TABLE_GRID = "minmax(270px,1.3fr) minmax(130px,.58fr) minmax(180px,.78fr) minmax(165px,.7fr) minmax(230px,.95fr) minmax(165px,.72fr) 72px";
const DETAIL_GRID = "minmax(220px,1.1fr) minmax(220px,1fr) minmax(190px,.85fr) minmax(150px,.65fr) minmax(190px,.8fr)";
function formatPlanDate(value?: string, includeTime = false) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", includeTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

function getStatusCounts(moviePlans: MovieAvailabilityResponse[]) {
  return moviePlans.reduce<Record<string, number>>((counts, plan) => {
    counts[plan.status] = (counts[plan.status] ?? 0) + 1;
    return counts;
  }, {});
}

function getPlanEventTimestamp(date: string, type: string) {
  const parsed = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  if (type === "run ends" && date.length === 10) parsed.setDate(parsed.getDate() + 1);
  return parsed.getTime();
}

function getUpcomingPlanMilestones(moviePlans: MovieAvailabilityResponse[]) {
  const now = Date.now();
  const candidates = moviePlans.filter((plan) => !["CLOSED", "SUSPENDED"].includes(plan.status)).flatMap((plan) => [
    plan.salesStartAt ? { type: "sales start", date: plan.salesStartAt, plan } : null,
    plan.showingStartDate ? { type: "run starts", date: plan.showingStartDate, plan } : null,
    plan.showingEndDate ? { type: "run ends", date: plan.showingEndDate, plan } : null,
  ]).filter((item): item is { type: string; date: string; plan: MovieAvailabilityResponse } => {
    if (!item) return false;
    const timestamp = getPlanEventTimestamp(item.date, item.type);
    return !Number.isNaN(timestamp) && timestamp >= now;
  }).sort((left, right) => getPlanEventTimestamp(left.date, left.type) - getPlanEventTimestamp(right.date, right.type));

  return { next: candidates[0] ?? null, remaining: Math.max(0, candidates.length - 1) };
}

function formatPlanActivation(plan: MovieAvailabilityResponse) {
  if (plan.salesStartAt) return formatPlanDate(plan.salesStartAt, true);
  if (plan.status === "OPEN") return "Manually activated";
  if (plan.status === "CLOSED") return "—";
  if (plan.status === "SUSPENDED") return "No scheduled activation";
  return "Manual activation";
}

export default function ReleasePlanningQueuePage() {
  const { can } = useRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageResult, setPageResult] = useState<ReleasePlanningQueuePageResponse | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(Math.max(0, Number(searchParams.get("page") ?? 1) - 1 || 0));
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const response = await movieApi.searchReleasePlanningQueue({
        q: debouncedQuery,
        page,
        size: PAGE_SIZE,
      });
      setPageResult(response.result ?? null);
    } catch (requestError) {
      setFailure(classifyRequestFailure(requestError, "The release planning queue could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedQuery) next.set("q", debouncedQuery); else next.delete("q");
    if (page > 0) next.set("page", String(page + 1)); else next.delete("page");
    next.delete("size");
    setSearchParams(next, { replace: true });
  // searchParams is intentionally excluded: it is the destination of this synchronization.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, page, setSearchParams]);

  useEffect(() => {
    const requestedMovieId = Number(searchParams.get("movieId"));
    if (Number.isInteger(requestedMovieId) && requestedMovieId > 0) {
      setSelectedMovieId(requestedMovieId);
    }
  }, [searchParams]);

  const plansByMovie = useMemo(() => (pageResult?.content ?? []).reduce<Record<number, MovieAvailabilityResponse[]>>((result, movie) => {
    result[movie.movieId] = movie.plans;
    return result;
  }, {}), [pageResult]);

  const rows = useMemo(() => (pageResult?.content ?? []).map((movie) => ({
    movieId: movie.movieId,
    movieNameVn: movie.displayTitle,
    movieNameEnglish: movie.originalTitle,
    smallImage: movie.posterUrl,
  })), [pageResult]);

  const movieStats = {
    unplanned: pageResult?.summary.unplannedMovies ?? 0,
    needsAction: pageResult?.summary.needOperatorAction ?? 0,
    awaitingApproval: pageResult?.summary.awaitingApproval ?? 0,
    activeReleases: pageResult?.summary.activeReleases ?? 0,
  };

  const selectedMovie = rows.find((movie) => movie.movieId === selectedMovieId) ?? null;
  const selectedMoviePlans = selectedMovie
    ? [...(plansByMovie[selectedMovie.movieId] ?? [])].sort((left, right) => (left.clusterName ?? "").localeCompare(right.clusterName ?? ""))
    : [];
  const selectedStatusCounts = getStatusCounts(selectedMoviePlans);
  const selectedStatuses = Object.keys(selectedStatusCounts).sort((left, right) => STATUS_ORDER.indexOf(left) - STATUS_ORDER.indexOf(right));
  const selectedClusterCount = new Set(selectedMoviePlans.map((plan) => plan.clusterId)).size;

  return (
    <div style={{ width: "100%", color: "var(--text-main)" }}>
      <AdminPageHeader
        eyebrow="Film programming"
        title="Release Planning"
        description="Plan where and when an approved movie will play, then submit the plan for administrator review."
      />

      <div className="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Unplanned movies", value: movieStats.unplanned, helper: "Approved titles without a plan", icon: Film, color: "#3b82f6" },
          { label: "Need operator action", value: movieStats.needsAction, helper: "Draft, changed or suspended", icon: AlertTriangle, color: "#f97316" },
          { label: "Awaiting approval", value: movieStats.awaitingApproval, helper: "Movies submitted for review", icon: Clock3, color: "#f59e0b" },
          { label: "Active releases", value: movieStats.activeReleases, helper: "Movies with an active cluster plan", icon: CheckCircle2, color: "#10b981" },
        ].map(({ label, value, helper, icon: Icon, color }) => (
          <div key={label} style={{ padding: 18, borderRadius: 15, border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ color: "var(--text-sub)", fontSize: 11.5 }}>{label}</div><div style={{ fontSize: 27, fontWeight: 700, marginTop: 7 }}>{loading ? "–" : value}</div><small style={{ display: "block", color: "var(--text-sub)", fontSize: 10.5, marginTop: 5 }}>{helper}</small></div>
            <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", color, background: `${color}18` }}><Icon size={19} /></span>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--text-sub)" }} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an approved movie…" style={{ width: "100%", height: 46, borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)", padding: "0 16px 0 44px", outline: "none", fontSize: 13 }} />
      </div>

      <div style={{ borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-card)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1380 }}>
            <div style={{ display: "grid", gridTemplateColumns: TABLE_GRID, gap: 18, minHeight: 50, alignItems: "center", padding: "15px 18px", color: "var(--text-sub)", borderBottom: "1px solid var(--border-color)", background: "var(--bg-main)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
              <span>Movie</span><span>Coverage</span><span>Workflow</span><span>Sales availability</span><span>Next milestone</span><span>Needs attention</span><span style={{ textAlign: "right" }}>Actions</span>
            </div>
            {failure ? <div className="p-4"><RequestState compact kind={failure.kind} description={failure.description} onRetry={() => void load()} /></div> : rows.length === 0 && !loading ? (
              <div className="p-4"><RequestState compact kind="empty" title="No release plans match this view" description="Approved movies and submitted cluster plans will appear here when they are ready for programming work." /></div>
            ) : rows.map((movie) => {
              const moviePlans = plansByMovie[movie.movieId] ?? [];
              const statusCounts = getStatusCounts(moviePlans);
              const statuses = Object.keys(statusCounts).sort((left, right) => STATUS_ORDER.indexOf(left) - STATUS_ORDER.indexOf(right));
              const clusterCount = new Set(moviePlans.map((plan) => plan.clusterId)).size;
              const activeClusterCount = new Set(moviePlans.filter((plan) => plan.status === "OPEN").map((plan) => plan.clusterId)).size;
              const milestones = getUpcomingPlanMilestones(moviePlans);
              const upcomingEvent = milestones.next;
              const primaryStatus = statuses.length === 1 ? statuses[0] : null;
              const stateMeta = primaryStatus
                ? primaryStatus === "OPEN"
                  ? { ...PLAN_META.OPEN, label: `Active in ${activeClusterCount}/${clusterCount} clusters` }
                  : (PLAN_META[primaryStatus] ?? PLAN_META.PLANNED)
                : (statusCounts.OPEN ?? 0) > 0
                  ? { label: `Active in ${activeClusterCount}/${clusterCount} clusters`, color: "#059669", background: "rgba(16,185,129,.12)" }
                  : (statusCounts.CHANGES_REQUESTED ?? 0) > 0
                    ? PLAN_META.CHANGES_REQUESTED
                    : (statusCounts.SUSPENDED ?? 0) > 0
                      ? { ...PLAN_META.SUSPENDED, label: "Partially suspended" }
                      : (statusCounts.IN_REVIEW ?? 0) > 0
                        ? { ...PLAN_META.IN_REVIEW, label: "Approval in progress" }
                        : (statusCounts.APPROVED ?? 0) > 0
                          ? { ...PLAN_META.APPROVED, label: (statusCounts.CLOSED ?? 0) > 0
                            ? `${statusCounts.APPROVED} approved · ${statusCounts.CLOSED} closed`
                            : "Approved" }
                          : { label: moviePlans.length ? "Planning in progress" : "Unplanned", color: "#2563eb", background: "rgba(37,99,235,.1)" };
              const approvedPlans = moviePlans.filter((plan) => plan.status === "APPROVED");
              const scheduledApprovedCount = approvedPlans.filter((plan) => Boolean(plan.salesStartAt)).length;
              const salesMeta = activeClusterCount > 0
                ? { label: `On sale in ${activeClusterCount}/${clusterCount}`, detail: "clusters", color: "#059669", background: "rgba(16,185,129,.12)" }
                : scheduledApprovedCount > 0
                  ? { label: `${scheduledApprovedCount} scheduled`, detail: "sales start configured", color: "#2563eb", background: "rgba(37,99,235,.1)" }
                  : approvedPlans.length > 0
                    ? { label: "Not scheduled", detail: `${approvedPlans.length} approved plan${approvedPlans.length === 1 ? "" : "s"}`, color: "#64748b", background: "rgba(100,116,139,.12)" }
                    : { label: "Not on sale", detail: "", color: "#64748b", background: "rgba(100,116,139,.10)" };
              const stateSummary = statuses.map((status) => `${statusCounts[status]} ${(PLAN_META[status]?.label ?? status).toLowerCase()}`).join(" · ");
              const changeCount = statusCounts.CHANGES_REQUESTED ?? 0;
              const suspendedCount = statusCounts.SUSPENDED ?? 0;
              const draftCount = statusCounts.PLANNED ?? 0;
              const attention = !moviePlans.length
                ? { label: "Plan required", detail: "No cluster plan created", color: "#d97706" }
                : changeCount
                  ? { label: `${changeCount} change${changeCount > 1 ? "s" : ""} requested`, detail: "Operator revision required", color: "#e11d48" }
                  : suspendedCount
                    ? { label: `${suspendedCount} suspended plan${suspendedCount > 1 ? "s" : ""}`, detail: "Review before reopening", color: "#ea580c" }
                    : draftCount
                      ? { label: `${draftCount} draft plan${draftCount > 1 ? "s" : ""}`, detail: "Ready to complete or submit", color: "#2563eb" }
                      : { label: "—", detail: "", color: "var(--text-sub)" };
              return (
                <div key={movie.movieId}>
                  <div className="transition-colors hover:bg-blue-500/5" style={{ display: "grid", gridTemplateColumns: TABLE_GRID, gap: 18, padding: "15px 18px", alignItems: "center", borderBottom: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 36, height: 46, borderRadius: 8, overflow: "hidden", background: "rgba(59,130,246,.1)", flexShrink: 0 }}>{movie.smallImage && <img src={movie.smallImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                      <div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{movie.movieNameVn || movie.movieNameEnglish}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{movie.movieNameEnglish || `Movie #${movie.movieId}`}</small></div>
                    </div>
                    <div><strong style={{ fontSize: 13 }}>{clusterCount} cluster{clusterCount === 1 ? "" : "s"}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{moviePlans.length} branch plan{moviePlans.length === 1 ? "" : "s"}</small></div>
                    <div>
                      <span style={{ display: "inline-flex", padding: "5px 8px", borderRadius: 999, color: stateMeta.color, background: stateMeta.background, fontSize: 10.5, fontWeight: 700 }}>{stateMeta.label}</span>
                      <small title={stateSummary} style={{ display: "block", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-sub)", marginTop: 5 }}>{statuses.length > 1 ? stateSummary : moviePlans.length ? `${moviePlans.length} plan${moviePlans.length === 1 ? "" : "s"}` : "Create the first plan"}</small>
                    </div>
                    <div>
                      <span style={{ display: "inline-flex", padding: "5px 8px", borderRadius: 999, color: salesMeta.color, background: salesMeta.background, fontSize: 10.5, fontWeight: 700 }}>{salesMeta.label}</span>
                      {salesMeta.detail && <small style={{ display: "block", color: "var(--text-sub)", marginTop: 5 }}>{salesMeta.detail}</small>}
                    </div>
                    <div>
                      {upcomingEvent ? <><strong style={{ display: "block", fontSize: 12.5 }}>{formatPlanDate(upcomingEvent.date, upcomingEvent.date.includes("T"))}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{upcomingEvent.plan.clusterName ?? `Cluster #${upcomingEvent.plan.clusterId}`} · {upcomingEvent.type}</small>{milestones.remaining > 0 && <small style={{ display: "block", color: "#2563eb", marginTop: 3, fontWeight: 650 }}>+{milestones.remaining} other milestone{milestones.remaining === 1 ? "" : "s"}</small>}</> : <strong style={{ display: "block", color: "var(--text-sub)", fontSize: 12.5 }}>—</strong>}
                    </div>
                    <div><strong style={{ display: "block", color: attention.color, fontSize: 12.5 }}>{attention.label}</strong>{attention.detail && <small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{attention.detail}</small>}</div>
                    <RowActions
                      className="justify-self-end"
                      ariaLabel={`Actions for ${movie.movieNameVn || movie.movieNameEnglish}`}
                      actions={[{ key: "view", label: "View details", icon: Eye, onSelect: () => setSelectedMovieId(movie.movieId) }]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {!failure && pageResult && rows.length > 0 && (
          <AdminPagination
            page={pageResult.page}
            size={pageResult.size}
            totalElements={pageResult.totalElements}
            totalPages={pageResult.totalPages}
            itemLabel="movies"
            loading={loading}
            onPageChange={setPage}
          />
        )}
      </div>

      <Dialog open={Boolean(selectedMovie)} onOpenChange={(open) => {
        if (!open) {
          setSelectedMovieId(null);
          if (searchParams.has("movieId")) {
            const next = new URLSearchParams(searchParams);
            next.delete("movieId");
            setSearchParams(next, { replace: true });
          }
        }
      }}>
        <DialogContent
          className="h-[calc(100vh-32px)] max-h-[820px] w-[calc(100vw-32px)] max-w-[1400px] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[1400px]"
          style={{
            gridTemplateRows: "auto auto minmax(0,1fr) auto",
            borderColor: "var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-main)",
          }}
        >
          {selectedMovie && (
            <>
              <DialogHeader className="border-b px-7 py-5 pr-16 text-left" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-[72px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-blue-500/10">
                    {selectedMovie.smallImage && <img src={selectedMovie.smallImage} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Release plan details</span>
                    <DialogTitle className="truncate text-xl">{selectedMovie.movieNameVn || selectedMovie.movieNameEnglish}</DialogTitle>
                    <DialogDescription className="mt-1 truncate text-xs" style={{ color: "var(--text-sub)" }}>
                      {selectedMovie.movieNameEnglish || `Movie #${selectedMovie.movieId}`} · Review release windows and status by cinema cluster.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 border-b sm:grid-cols-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <div className="border-b px-7 py-4 sm:border-r sm:border-b-0" style={{ borderColor: "var(--border-color)" }}>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-sub)" }}>Coverage</span>
                  <strong className="mt-1 block text-lg">{selectedClusterCount} cluster{selectedClusterCount === 1 ? "" : "s"}</strong>
                </div>
                <div className="border-b px-7 py-4 sm:border-r sm:border-b-0" style={{ borderColor: "var(--border-color)" }}>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-sub)" }}>Branch plans</span>
                  <strong className="mt-1 block text-lg">{selectedMoviePlans.length}</strong>
                </div>
                <div className="px-7 py-4">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-sub)" }}>Release status</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedStatuses.length ? selectedStatuses.map((status) => {
                      const meta = PLAN_META[status] ?? PLAN_META.PLANNED;
                      return <span key={status} style={{ padding: "4px 8px", borderRadius: 999, color: meta.color, background: meta.background, fontSize: 10, fontWeight: 700 }}>{meta.label} · {selectedStatusCounts[status]}</span>;
                    }) : <span className="text-xs" style={{ color: "var(--text-sub)" }}>No plans created</span>}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col px-7 py-5">
                <div className="mb-3 shrink-0">
                  <strong className="block text-sm">Plans by cinema cluster</strong>
                  <span className="mt-1 block text-xs" style={{ color: "var(--text-sub)" }}>Every schedule and timestamp below belongs to the cluster shown in the same row.</span>
                </div>
                {selectedMoviePlans.length ? (
                  <div className="min-h-0 flex-1 overflow-auto rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                    <div style={{ minWidth: 1080 }}>
                        <div className="sticky top-0 z-10 grid min-h-[50px] items-center gap-4 border-b px-4 py-3.5" style={{ gridTemplateColumns: DETAIL_GRID, borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                          <span>Cluster</span><span>Release window</span><span>Scheduled activation</span><span>Status</span><span>Updated</span>
                        </div>
                        {selectedMoviePlans.map((plan) => {
                          const meta = PLAN_META[plan.status] ?? PLAN_META.PLANNED;
                          const updatedAt = plan.updatedAt ?? plan.createdAt;
                          return (
                            <div key={plan.availabilityId} className="grid items-center gap-4 border-b px-4 py-3 last:border-b-0" style={{ gridTemplateColumns: DETAIL_GRID, borderColor: "var(--border-color)", fontSize: 12 }}>
                              <div><strong className="block">{plan.clusterName ?? `Cluster #${plan.clusterId}`}</strong></div>
                              <div><strong>{formatPlanDate(plan.showingStartDate)} – {plan.showingEndDate ? formatPlanDate(plan.showingEndDate) : "Until further notice"}</strong></div>
                              <div><strong>{formatPlanActivation(plan)}</strong></div>
                              <div><span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, color: meta.color, background: meta.background, fontSize: 10, fontWeight: 700 }}>{meta.label}</span></div>
                              <div><strong className="block">{formatPlanDate(updatedAt, true)}</strong><small className="mt-1 block" style={{ color: "var(--text-sub)" }}>{plan.updatedBy || plan.createdBy || "System"}</small></div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-5 py-12 text-center text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
                    No cluster plans have been created for this movie.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 border-t px-7 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <span className="text-xs" style={{ color: "var(--text-sub)" }}>{selectedMoviePlans.length} plan{selectedMoviePlans.length === 1 ? "" : "s"} across {selectedClusterCount} cluster{selectedClusterCount === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  onClick={() => {
                    const movieId = selectedMovie.movieId;
                    setSelectedMovieId(null);
                    navigate(`/admin/movies/${movieId}/availability`);
                  }}
                  className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                >
                  {can.approve && !can.edit ? "Review release plans" : "Manage release plans"} <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
