import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Film,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { movieApi, type ClusterResponse, type MovieApiResponse, type RoomResponse } from "../../api/movieApi";
import {
  assessClusterEligibility,
  type ClusterScheduleEligibility,
} from "../../utils/showtimeEligibility";
import {
  showtimeApi,
  type AutoShowtimeGenerationRunResponse,
  type AutoShowtimeIneligibleMovie,
  type GenerationRunStatus,
  type SchedulePlanResponse,
} from "../../api/showtimeApi";

type StepKey = "scope" | "review" | "running" | "results";
const STEPS: { key: StepKey; label: string; icon: typeof Calendar }[] = [
  { key: "scope", label: "Scope", icon: Calendar },
  { key: "review", label: "Review", icon: CheckCircle2 },
  { key: "running", label: "Running", icon: Loader2 },
  { key: "results", label: "Results", icon: Sparkles },
];

/** Session-only run tracker (no backend run-history endpoint exists) so a page
 *  refresh doesn't lose track of an in-flight run submitted moments ago. */
export const RECENT_RUNS_KEY = "cp_admin_auto_showtime_runs";
export type RecentAutoScheduleRun = { generationRunId: number; submittedAt: string; startDate: string; endDate: string };

export function loadRecentAutoScheduleRuns(): RecentAutoScheduleRun[] {
  try {
    const raw = localStorage.getItem(RECENT_RUNS_KEY);
    return raw ? (JSON.parse(raw) as RecentAutoScheduleRun[]) : [];
  } catch {
    return [];
  }
}
function saveRecentRun(run: RecentAutoScheduleRun) {
  const existing = loadRecentAutoScheduleRuns().filter((r) => r.generationRunId !== run.generationRunId);
  localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify([run, ...existing].slice(0, 8)));
  window.dispatchEvent(new CustomEvent("auto-schedule-runs-updated"));
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function extractErrorMessage(err: unknown): { message: string; ineligibleMovies?: AutoShowtimeIneligibleMovie[] } {
  const response = (err as { response?: { data?: { message?: string; result?: { ineligibleMovies?: AutoShowtimeIneligibleMovie[] } } } })?.response;
  return {
    message: response?.data?.message ?? "The generation run could not be submitted.",
    ineligibleMovies: response?.data?.result?.ineligibleMovies,
  };
}

const STATUS_META: Record<GenerationRunStatus, { label: string; color: string; background: string }> = {
  ACCEPTED: { label: "Queued", color: "#2563eb", background: "rgba(37,99,235,0.1)" },
  RUNNING: { label: "Running", color: "#d97706", background: "rgba(217,119,6,0.1)" },
  COMPLETED: { label: "Completed", color: "#059669", background: "rgba(5,150,105,0.1)" },
  PARTIALLY_COMPLETED: { label: "Partially completed", color: "#d97706", background: "rgba(217,119,6,0.1)" },
  FAILED: { label: "Failed", color: "#dc2626", background: "rgba(220,38,38,0.1)" },
};

const DEMAND_TIER_COLOR: Record<string, string> = { HIGH: "#dc2626", NORMAL: "#2563eb", LOW: "#64748b" };

function StepIndicator({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 rounded-2xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      {STEPS.map((step, idx) => {
        const state = idx < currentIdx ? "complete" : idx === currentIdx ? "current" : "upcoming";
        const palette =
          state === "complete" ? { color: "#059669", background: "rgba(5,150,105,0.1)", border: "rgba(5,150,105,0.2)" }
          : state === "current" ? { color: "#2563eb", background: "rgba(37,99,235,0.1)", border: "rgba(37,99,235,0.24)" }
          : { color: "var(--text-sub)", background: "var(--bg-main)", border: "var(--border-color)" };
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border" style={{ color: palette.color, background: palette.background, borderColor: palette.border }}>
                {state === "complete" ? <Check size={13} /> : <Icon size={13} className={state === "current" && step.key === "running" ? "animate-spin" : ""} />}
              </div>
              <p className="truncate" style={{ color: palette.color, fontSize: "12px", fontWeight: state === "upcoming" ? 500 : 650 }}>{step.label}</p>
            </div>
            {idx < STEPS.length - 1 && <ArrowRight size={13} style={{ color: "var(--text-sub)", flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

type AutoScheduleShowtimePageProps = {
  embedded?: boolean;
  initialRunId?: number | null;
  onShowtimesChanged?: () => void;
};

export default function AutoScheduleShowtimePage({
  embedded = false,
  initialRunId = null,
  onShowtimesChanged,
}: AutoScheduleShowtimePageProps = {}) {
  const [step, setStep] = useState<StepKey>("scope");

  // Scope inputs
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [startDate, setStartDate] = useState(todayPlusDays(3));
  const [endDate, setEndDate] = useState(todayPlusDays(9));
  const [allClusters, setAllClusters] = useState(false);
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<number>>(new Set());
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [clusterEligibility, setClusterEligibility] = useState<Map<number, ClusterScheduleEligibility>>(new Map());
  const [clusterSearch, setClusterSearch] = useState("");
  const [movieSearch, setMovieSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");

  // Submit / run state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ineligibleMovies, setIneligibleMovies] = useState<AutoShowtimeIneligibleMovie[]>([]);
  const [run, setRun] = useState<AutoShowtimeGenerationRunResponse | null>(null);
  const [plan, setPlan] = useState<SchedulePlanResponse | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [resultsPage, setResultsPage] = useState(0);
  const [recentRuns, setRecentRuns] = useState<RecentAutoScheduleRun[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumedInitialRun = useRef<number | null>(null);
  const notifiedTerminalRun = useRef<number | null>(null);

  useEffect(() => {
    setRecentRuns(loadRecentAutoScheduleRuns());
    Promise.all([movieApi.getClusters(), movieApi.getAllMovies(), movieApi.getRooms()])
      .then(([clusterRes, movieRes, roomRes]) => {
        const activeClusters = (clusterRes.result ?? []).filter((c) => c.status === "ACTIVE");
        const roomsByCluster = new Map<number, RoomResponse[]>();
        (roomRes.result ?? []).forEach((room) => {
          const group = roomsByCluster.get(room.clusterId) ?? [];
          group.push(room);
          roomsByCluster.set(room.clusterId, group);
        });
        setClusters(activeClusters);
        setClusterEligibility(new Map(activeClusters.map((cluster) => [
          cluster.clusterId,
          assessClusterEligibility(roomsByCluster.get(cluster.clusterId) ?? []),
        ])));
        setMovies((movieRes.result ?? []).filter((m) => m.movieStatus === "APPROVED"));
      })
      .catch(() => { setClusters([]); setMovies([]); setClusterEligibility(new Map()); })
      .finally(() => setLoadingOptions(false));
  }, []);

  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.clusterId, c])), [clusters]);
  const movieById = useMemo(() => new Map(movies.map((m) => [m.movieId, m])), [movies]);
  const genreOptions = useMemo(() => Array.from(new Set(movies.flatMap((movie) => movie.movieType ?? []))).sort(), [movies]);
  const visibleClusters = useMemo(() => {
    const query = clusterSearch.trim().toLowerCase();
    return clusters.filter((cluster) => !query || [cluster.clusterName, cluster.province, cluster.address]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [clusterSearch, clusters]);
  const visibleMovies = useMemo(() => {
    const query = movieSearch.trim().toLowerCase();
    return movies.filter((movie) => {
      const matchesQuery = !query || [movie.movieNameEnglish, movie.movieNameVn, ...movie.movieType]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesGenre = !genreFilter || movie.movieType.includes(genreFilter);
      return matchesQuery && matchesGenre;
    });
  }, [genreFilter, movieSearch, movies]);

  const toggleCluster = (id: number) => setSelectedClusterIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleMovie = (id: number) => setSelectedMovieIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const schedulableClusters = useMemo(() => clusters.filter((cluster) => clusterEligibility.get(cluster.clusterId)?.schedulable), [clusterEligibility, clusters]);
  const invalidDateRange = Boolean(startDate && endDate && endDate < startDate);
  const effectiveClusterIds = allClusters ? schedulableClusters.map((c) => c.clusterId) : Array.from(selectedClusterIds);
  const canProceedFromScope = Boolean(
    startDate && endDate && !invalidDateRange && effectiveClusterIds.length > 0 && selectedMovieIds.size > 0
  );

  const stopPolling = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const pollRun = async (id: number, page = 0) => {
    try {
      const res = await showtimeApi.getAutoGenerationRun(id, page);
      const data = res.result;
      setRun(data);
      if (data.status === "COMPLETED" || data.status === "PARTIALLY_COMPLETED" || data.status === "FAILED") {
        stopPolling();
        setStep("results");
        if (data.schedulePlanId) {
          const planResponse = await showtimeApi.getSchedulePlan(data.schedulePlanId);
          setPlan(planResponse.result);
        }
      }
    } catch {
      // transient poll failure — keep the previous state and retry on the next tick
    }
  };

  const startPolling = (id: number) => {
    stopPolling();
    setRunningSince(Date.now());
    void pollRun(id);
    pollTimer.current = setInterval(() => void pollRun(id), 3000);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setIneligibleMovies([]);
    try {
      const res = await showtimeApi.submitAutoGenerationRun({
        startDate,
        endDate,
        cinemaClusterIds: effectiveClusterIds,
        movieIds: Array.from(selectedMovieIds),
      });
      const accepted = res.result;
      saveRecentRun({ generationRunId: accepted.generationRunId, submittedAt: new Date().toISOString(), startDate, endDate });
      setRecentRuns(loadRecentAutoScheduleRuns());
      setStep("running");
      startPolling(accepted.generationRunId);
    } catch (err) {
      const { message, ineligibleMovies: ineligible } = extractErrorMessage(err);
      setSubmitError(message);
      setIneligibleMovies(ineligible ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunNow = async () => {
    if (!run) return;
    try {
      await showtimeApi.executeAutoGenerationRun(run.generationRunId);
    } catch {
      // executor may have already finished (race with the scheduler) — fall through to poll
    }
    void pollRun(run.generationRunId);
  };

  const resumeRun = (id: number) => {
    setStep("running");
    startPolling(id);
  };

  useEffect(() => {
    if (!initialRunId || resumedInitialRun.current === initialRunId) return;
    resumedInitialRun.current = initialRunId;
    resumeRun(initialRunId);
  }, [initialRunId]);

  const resetWizard = () => {
    stopPolling();
    setRun(null);
    setPlan(null);
    setPlanError(null);
    setReviewNote("");
    setRunningSince(null);
    setSubmitError(null);
    setIneligibleMovies([]);
    setSelectedClusterIds(new Set());
    setSelectedMovieIds(new Set());
    setAllClusters(false);
    setResultsPage(0);
    setStep("scope");
  };

  const goToResultsPage = (page: number) => {
    if (!run) return;
    setResultsPage(page);
    void pollRun(run.generationRunId, page);
  };

  const transitionPlan = async (action: "submit" | "changes" | "publish") => {
    if (!plan) return;
    setPlanBusy(true);
    setPlanError(null);
    try {
      const response = action === "submit"
        ? await showtimeApi.submitSchedulePlanReview(plan.schedulePlanId, reviewNote || undefined)
        : action === "changes"
          ? await showtimeApi.requestSchedulePlanChanges(plan.schedulePlanId, reviewNote || undefined)
          : await showtimeApi.publishSchedulePlan(plan.schedulePlanId);
      setPlan(response.result);
      if (action === "publish" && run) {
        notifiedTerminalRun.current = run.generationRunId;
        onShowtimesChanged?.();
        await pollRun(run.generationRunId, resultsPage);
      }
    } catch (error) {
      setPlanError(extractErrorMessage(error).message);
    } finally {
      setPlanBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!embedded && <div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 style={{ color: "var(--text-main)", fontSize: "18px", fontWeight: 750 }}>Auto Schedule Showtimes</h1>
            <p style={{ color: "var(--text-sub)", fontSize: "12px" }}>
              Generate showtimes automatically based on movie/cluster demand — a background job handles the actual scheduling.
            </p>
          </div>
        </div>
      </div>}

      <StepIndicator current={step} />

      {recentRuns.length > 0 && step === "scope" && (
        <div className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <p className="mb-2" style={{ fontSize: "11px", fontWeight: 650, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Recent runs (this browser session)
          </p>
          <div className="flex flex-wrap gap-2">
            {recentRuns.map((r) => (
              <button
                key={r.generationRunId}
                type="button"
                onClick={() => resumeRun(r.generationRunId)}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-blue-500/5"
                style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                <Clock3 size={12} style={{ color: "var(--text-sub)" }} />
                Run #{r.generationRunId} · {r.startDate} → {r.endDate}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: Scope ── */}
      {step === "scope" && (
        <div className="space-y-4">
          {loadingOptions ? (
            <div className="flex items-center gap-2 rounded-2xl border p-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)" }}>
              <RefreshCw size={16} className="animate-spin" /> Loading clusters and movies…
            </div>
          ) : (
            <>
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.65fr)]">
                <div className="space-y-4">
                  <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="mb-3 flex items-center gap-2">
                      <Calendar size={15} className="text-blue-600" />
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>Planning window</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Start date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                          className="w-full rounded-xl border px-3 py-2.5 outline-none"
                          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }} />
                      </div>
                      <div>
                        <label className="mb-1.5 block" style={{ fontSize: "11px", color: "var(--text-sub)" }}>End date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                          className="w-full rounded-xl border px-3 py-2.5 outline-none"
                          style={{ background: "var(--bg-main)", borderColor: invalidDateRange ? "#dc2626" : "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }} />
                      </div>
                    </div>
                    {invalidDateRange && <p className="mt-2 text-rose-500" style={{ fontSize: "11px" }}>End date cannot be before start date.</p>}
                  </section>

                  <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-blue-600" />
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>Cinema scope</p>
                          <p style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>{effectiveClusterIds.length} selected</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!allClusters && schedulableClusters.length === 0}
                        onClick={() => { setAllClusters(!allClusters); setSelectedClusterIds(new Set()); }}
                        className="rounded-lg px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: allClusters ? "rgba(37,99,235,.1)" : "var(--bg-main)", color: allClusters ? "#2563eb" : "var(--text-sub)", fontSize: "10.5px", fontWeight: 650 }}
                      >
                        {allClusters ? "Clear all" : `All eligible (${schedulableClusters.length})`}
                      </button>
                    </div>
                    <div className="relative mb-3">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                      <input value={clusterSearch} onChange={(event) => setClusterSearch(event.target.value)} placeholder="Search cinema or city…"
                        className="w-full rounded-xl border py-2 pl-8 pr-3 outline-none"
                        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "12px" }} />
                    </div>
                    <div className="max-h-[410px] space-y-2 overflow-y-auto pr-1">
                      {visibleClusters.map((cluster) => {
                        const eligibility = clusterEligibility.get(cluster.clusterId);
                        const schedulable = eligibility?.schedulable === true;
                        const selected = schedulable && (allClusters || selectedClusterIds.has(cluster.clusterId));
                        return (
                          <label
                            key={cluster.clusterId}
                            className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${schedulable && !allClusters ? "cursor-pointer" : "cursor-not-allowed"}`}
                            style={{ borderColor: selected ? "rgba(37,99,235,.55)" : !schedulable ? "rgba(245,158,11,.28)" : "var(--border-color)", background: selected ? "rgba(37,99,235,.07)" : !schedulable ? "rgba(245,158,11,.045)" : "var(--bg-main)", opacity: !schedulable ? 0.72 : allClusters ? 0.88 : 1 }}
                          >
                            <input className="sr-only" type="checkbox" disabled={allClusters || !schedulable} checked={selected} onChange={() => toggleCluster(cluster.clusterId)} />
                            <div className="h-12 w-14 flex-shrink-0 overflow-hidden rounded-lg" style={{ background: "rgba(37,99,235,.08)" }}>
                              {cluster.coverImageUrl
                                ? <img src={cluster.coverImageUrl} alt="" className="h-full w-full object-cover" />
                                : <div className="flex h-full items-center justify-center text-blue-600"><Building2 size={18} /></div>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate" style={{ color: "var(--text-main)", fontSize: "12.5px", fontWeight: 700 }}>{cluster.clusterName}</p>
                              <p className="mt-0.5 flex items-center gap-1 truncate" style={{ color: "var(--text-sub)", fontSize: "10.5px" }}><MapPin size={10} /> {cluster.province || cluster.address}</p>
                              {schedulable ? (
                                <p className="mt-1" style={{ color: "#059669", fontSize: "10px", fontWeight: 650 }}>
                                  {eligibility?.eligibleRoomCount} eligible of {eligibility?.totalRoomCount} rooms · {(cluster.totalSeats ?? 0).toLocaleString()} seats
                                </p>
                              ) : (
                                <p className="mt-1 line-clamp-2" style={{ color: "#d97706", fontSize: "10px", fontWeight: 600 }}>
                                  Unavailable · {eligibility?.reason ?? "Room eligibility could not be verified."}
                                </p>
                              )}
                            </div>
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? "#2563eb" : !schedulable ? "#d97706" : "var(--border-color)", background: selected ? "#2563eb" : "transparent", color: selected ? "white" : "#d97706" }}>
                              {selected ? <Check size={12} /> : !schedulable ? <XCircle size={11} /> : null}
                            </span>
                          </label>
                        );
                      })}
                      {visibleClusters.length === 0 && <p className="py-8 text-center" style={{ fontSize: "12px", color: "var(--text-sub)" }}>No matching active cinema.</p>}
                    </div>
                  </section>
                </div>

                <section className="min-w-0 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><Film size={15} className="text-purple-600" /><p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>Movie catalog</p></div>
                      <p className="mt-1" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>Approved catalog titles · scheduling eligibility is revalidated on submit · {selectedMovieIds.size} selected</p>
                    </div>
                    {selectedMovieIds.size > 0 && <button type="button" onClick={() => setSelectedMovieIds(new Set())} className="text-xs font-semibold text-blue-600">Clear selection</button>}
                  </div>
                  <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                      <input value={movieSearch} onChange={(event) => setMovieSearch(event.target.value)} placeholder="Search title or genre…"
                        className="w-full rounded-xl border py-2.5 pl-9 pr-3 outline-none"
                        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "12px" }} />
                    </div>
                    <select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} className="rounded-xl border px-3 py-2.5 outline-none"
                      style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "12px" }}>
                      <option value="">All genres</option>
                      {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                    </select>
                  </div>

                  <div className="grid max-h-[570px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleMovies.map((movie) => {
                      const selected = selectedMovieIds.has(movie.movieId);
                      const title = movie.movieNameEnglish || movie.movieNameVn;
                      const alternateTitle = movie.movieNameVn && movie.movieNameVn !== title ? movie.movieNameVn : "";
                      return (
                        <label
                          key={movie.movieId}
                          className="group relative flex cursor-pointer gap-3 overflow-hidden rounded-2xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                          style={{ borderColor: selected ? "rgba(124,58,237,.65)" : "var(--border-color)", background: selected ? "rgba(124,58,237,.07)" : "var(--bg-main)" }}
                        >
                          <input className="sr-only" type="checkbox" checked={selected} onChange={() => toggleMovie(movie.movieId)} />
                          <div className="h-[120px] w-20 flex-shrink-0 overflow-hidden rounded-xl" style={{ background: "rgba(124,58,237,.08)" }}>
                            {movie.smallImage || movie.largeImage
                              ? <img src={movie.smallImage || movie.largeImage} alt={`${title} poster`} className="h-full w-full object-cover" />
                              : <div className="flex h-full items-center justify-center text-purple-500"><Film size={22} /></div>}
                          </div>
                          <div className="min-w-0 flex-1 py-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="line-clamp-2" style={{ color: "var(--text-main)", fontSize: "12.5px", fontWeight: 750, lineHeight: 1.3 }}>{title}</p>
                                {alternateTitle && <p className="mt-0.5 truncate" style={{ color: "var(--text-sub)", fontSize: "10px" }}>{alternateTitle}</p>}
                              </div>
                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? "#7c3aed" : "var(--border-color)", background: selected ? "#7c3aed" : "transparent", color: "white" }}>
                                {selected && <Check size={12} />}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-600">Approved</span>
                              {movie.ageRatingCode && <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-500">{movie.ageRatingCode}</span>}
                              <span className="rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: "rgba(37,99,235,.09)", color: "#2563eb" }}>{movie.duration || "—"} min</span>
                              {movie.version && <span className="max-w-28 truncate rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: "rgba(5,150,105,.09)", color: "#059669" }}>{movie.version}</span>}
                            </div>
                            <p className="mt-2" style={{ color: "var(--text-sub)", fontSize: "10px" }}>{movie.releaseDate || "Release date not set"}{movie.country ? ` · ${movie.country}` : ""}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {movie.movieType.slice(0, 2).map((genre) => <span key={genre} className="rounded-md border px-1.5 py-0.5" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", fontSize: "9.5px" }}>{genre}</span>)}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                    {visibleMovies.length === 0 && <div className="col-span-full py-16 text-center"><Film size={24} className="mx-auto mb-2" style={{ color: "var(--text-sub)" }} /><p style={{ fontSize: "12px", color: "var(--text-sub)" }}>No matching approved movie.</p></div>}
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl"
                style={{ borderColor: "var(--border-color)", background: "color-mix(in srgb, var(--bg-card) 92%, transparent)" }}>
                <div className="flex min-w-0 items-center gap-3">
                  {selectedMovieIds.size > 0 && (
                    <div className="flex -space-x-2">
                      {Array.from(selectedMovieIds).slice(0, 4).map((movieId) => {
                        const movie = movieById.get(movieId);
                        return (
                          <div key={movieId} title={movie?.movieNameEnglish || movie?.movieNameVn} className="h-9 w-7 overflow-hidden rounded-md border-2" style={{ borderColor: "var(--bg-card)", background: "rgba(124,58,237,.12)" }}>
                            {movie?.smallImage || movie?.largeImage
                              ? <img src={movie.smallImage || movie.largeImage} alt="" className="h-full w-full object-cover" />
                              : <div className="flex h-full items-center justify-center text-purple-500"><Film size={11} /></div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p style={{ color: "var(--text-main)", fontSize: "12.5px", fontWeight: 700 }}>{effectiveClusterIds.length} cinemas · {selectedMovieIds.size} movies</p>
                    <p style={{ color: "var(--text-sub)", fontSize: "10.5px" }}>{startDate} → {endDate}</p>
                  </div>
                </div>
                <button type="button" disabled={!canProceedFromScope} onClick={() => setStep("review")}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                  Review generation scope <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <p className="mb-3" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>Confirm generation scope</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <p style={{ fontSize: "10px", fontWeight: 650, color: "var(--text-sub)", textTransform: "uppercase" }}>Date range</p>
                <p className="mt-0.5" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{startDate} → {endDate}</p>
              </div>
              <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                <p style={{ fontSize: "10px", fontWeight: 650, color: "var(--text-sub)", textTransform: "uppercase" }}>Clusters</p>
                <p className="mt-0.5" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                  {allClusters ? `All eligible (${schedulableClusters.length})` : `${effectiveClusterIds.length} selected`}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1.5" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Clusters</p>
              <div className="flex flex-wrap gap-1.5">
                {effectiveClusterIds.map((id) => (
                  <span key={id} className="rounded-lg border px-2 py-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", fontSize: "11.5px", color: "var(--text-main)" }}>
                    {clusterById.get(id)?.clusterName ?? `#${id}`}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1.5" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Movies ({selectedMovieIds.size})</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedMovieIds).map((id) => (
                  <span key={id} className="rounded-lg border px-2 py-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", fontSize: "11.5px", color: "var(--text-main)" }}>
                    {movieById.get(id)?.movieNameEnglish ?? movieById.get(id)?.movieNameVn ?? `#${id}`}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "rgba(37,99,235,0.18)", background: "rgba(37,99,235,0.05)" }}>
              <p style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>Uses the active default allocation policy</p>
              <p className="mt-1" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                Weights, peak hours, and minimum coverage are fixed system-wide for now — there's no per-run policy picker yet.
              </p>
            </div>
          </div>

          {submitError && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5">
              <div className="flex items-start gap-2 text-rose-600">
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                <p style={{ fontSize: "12.5px" }}>{submitError}</p>
              </div>
              {ineligibleMovies.length > 0 && (
                <ul className="mt-2 space-y-1 pl-6">
                  {ineligibleMovies.map((m) => (
                    <li key={m.movieId} style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>• {m.originalTitle} (#{m.movieId})</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep("scope")}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium"
              style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <>Submit run <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Running ── */}
      {step === "running" && run && (
        <div className="rounded-2xl border p-6 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: STATUS_META[run.status].background, color: STATUS_META[run.status].color }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
          <h3 className="mt-3" style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
            Run #{run.generationRunId} — {STATUS_META[run.status].label}
          </h3>
          <p className="mt-1" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
            {run.status === "ACCEPTED"
              ? "Queued — a background scheduler picks up new runs roughly once a minute."
              : "Scoring candidates and persisting showtimes…"}
          </p>
          {runningSince && (
            <p className="mt-1" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
              Waiting {Math.max(0, Math.round((Date.now() - runningSince) / 1000))}s
            </p>
          )}
          <div className="mt-4 flex items-center justify-center gap-2">
            <button type="button" onClick={handleRunNow}
              className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold text-blue-600"
              style={{ borderColor: "rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.06)" }}>
              <Zap size={13} /> Run now (skip the wait)
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Results ── */}
      {step === "results" && run && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <div className="flex items-center gap-2.5">
              {run.status === "FAILED" ? <XCircle size={20} style={{ color: STATUS_META.FAILED.color }} /> : <CheckCircle2 size={20} style={{ color: STATUS_META[run.status].color }} />}
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>Run #{run.generationRunId} — {STATUS_META[run.status].label}</p>
                <p style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>{run.startDate} → {run.endDate}</p>
              </div>
            </div>
            <button type="button" onClick={resetWizard} className="rounded-xl border px-3.5 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
              Start a new run
            </button>
          </div>

          {run.failureDetail && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5 text-rose-600">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <p style={{ fontSize: "12.5px" }}>{run.failureDetail}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Candidates", run.summary.candidateCount, "var(--text-main)"],
              ["Draft slots", run.summary.createdCount, "#059669"],
              ["Skipped", run.summary.skippedCount, "#d97706"],
              ["Partitions", `${run.summary.successfulPartitionCount}/${run.summary.successfulPartitionCount + run.summary.failedPartitionCount}`, run.summary.failedPartitionCount ? "#d97706" : "#059669"],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                <p style={{ color: "var(--text-sub)", fontSize: "10.5px", fontWeight: 650, textTransform: "uppercase" }}>{label}</p>
                <p className="mt-0.5" style={{ color: String(color), fontSize: "22px", fontWeight: 750 }}>{value}</p>
              </div>
            ))}
          </div>

          {plan && (
            <section className="overflow-hidden rounded-2xl border" style={{ borderColor: plan.blockerCount ? "rgba(225,29,72,.3)" : "var(--border-color)", background: "var(--bg-card)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                <div>
                  <div className="flex items-center gap-2">
                    <p style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 750 }}>Schedule plan #{plan.schedulePlanId}</p>
                    <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ color: plan.status === "PUBLISHED" ? "#059669" : "#2563eb", background: plan.status === "PUBLISHED" ? "rgba(5,150,105,.1)" : "rgba(37,99,235,.1)" }}>
                      {plan.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-0.5" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
                    Generation creates a draft. Only publishing materializes customer-facing showtimes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(plan.status === "DRAFT_GENERATED" || plan.status === "CHANGES_REQUESTED") && (
                    <button type="button" disabled={planBusy} onClick={() => void transitionPlan("submit")} className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      Submit for review
                    </button>
                  )}
                  {plan.status === "IN_REVIEW" && <>
                    <button type="button" disabled={planBusy} onClick={() => void transitionPlan("changes")} className="rounded-xl border px-3.5 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                      Request changes
                    </button>
                    <button type="button" disabled={planBusy || plan.blockerCount > 0} onClick={() => void transitionPlan("publish")} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {planBusy ? "Publishing…" : "Publish schedule"}
                    </button>
                  </>}
                </div>
              </div>

              {plan.blockerCount > 0 && (
                <div className="border-b bg-rose-500/10 px-4 py-3" style={{ borderColor: "rgba(225,29,72,.2)" }}>
                  <div className="flex items-center gap-2 text-rose-500"><AlertTriangle size={14} /><p className="text-xs font-bold">{plan.blockerCount} publishing blocker{plan.blockerCount === 1 ? "" : "s"}</p></div>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-5 text-rose-500/90">{plan.validationSummary}</pre>
                </div>
              )}
              {planError && <p className="border-b bg-rose-500/10 px-4 py-2.5 text-xs text-rose-500" style={{ borderColor: "rgba(225,29,72,.2)" }}>{planError}</p>}

              {plan.status !== "PUBLISHED" && (
                <div className="border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Review note</label>
                  <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={2} placeholder="Optional for submission; explain required changes when returning a plan."
                    className="w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }} />
                </div>
              )}

              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ background: "var(--bg-card)", color: "var(--text-sub)" }}>
                    <tr><th className="px-4 py-2 text-left">Movie</th><th className="px-4 py-2 text-left">Cinema / room</th><th className="px-4 py-2 text-left">Version</th><th className="px-4 py-2 text-left">Business time</th></tr>
                  </thead>
                  <tbody>
                    {plan.slots.map((slot) => <tr key={slot.schedulePlanSlotId} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text-main)" }}>{slot.movieTitle}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)" }}>{slot.clusterName} · {slot.cinemaRoomName}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)" }}>{slot.formatCode} · {slot.audioLanguageCode}{slot.subtitleLanguageCode ? ` / ${slot.subtitleLanguageCode}` : ""}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)" }}>{slot.businessDate} · {new Date(slot.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(slot.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <p className="border-b px-4 py-3" style={{ borderColor: "var(--border-color)", fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>Per-movie breakdown</p>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ color: "var(--text-sub)", fontSize: "11px", textTransform: "uppercase" }}>
                    <th className="px-4 py-2 text-left">Movie</th>
                    <th className="px-4 py-2 text-left">Demand</th>
                    <th className="px-4 py-2 text-right">Candidates</th>
                    <th className="px-4 py-2 text-right">Created</th>
                    <th className="px-4 py-2 text-right">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {run.movieResults.map((mr) => (
                    <tr key={mr.movieId} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-main)", fontWeight: 600 }}>{mr.movieTitle}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-md px-1.5 py-0.5" style={{ color: DEMAND_TIER_COLOR[mr.demandTier] ?? "var(--text-sub)", background: `${DEMAND_TIER_COLOR[mr.demandTier] ?? "#64748b"}18`, fontSize: "10.5px", fontWeight: 700 }}>
                          {mr.demandTier}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "var(--text-main)" }}>{mr.candidateCount}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "#059669", fontWeight: 600 }}>{mr.createdCount}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "#d97706" }}>{mr.skippedCount}</td>
                    </tr>
                  ))}
                  {run.movieResults.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-4 text-center" style={{ color: "var(--text-sub)" }}>No movie results yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <p className="border-b px-4 py-3" style={{ borderColor: "var(--border-color)", fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
              Published showtimes ({run.showtimes.totalElements})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ color: "var(--text-sub)", fontSize: "11px", textTransform: "uppercase" }}>
                    <th className="px-4 py-2 text-left">Movie</th>
                    <th className="px-4 py-2 text-left">Cluster</th>
                    <th className="px-4 py-2 text-left">Room</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Time</th>
                    <th className="px-4 py-2 text-left">Format</th>
                    <th className="px-4 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {run.showtimes.items.map((s) => (
                    <tr key={s.showtimeId} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-main)", fontWeight: 600 }}>{s.movieTitle}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-main)" }}>{clusterById.get(s.cinemaClusterId)?.clusterName ?? `#${s.cinemaClusterId}`}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)" }}>{s.cinemaRoomName}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)" }}>{s.showDate}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)" }}>{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)" }}>{s.formatName}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-sub)", fontSize: "11px" }}>{s.generationReason?.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                  {run.showtimes.items.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-4 text-center" style={{ color: "var(--text-sub)" }}>No showtimes are published yet. Review and publish the generated plan first.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {run.showtimes.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                <button type="button" disabled={resultsPage === 0} onClick={() => goToResultsPage(resultsPage - 1)}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                  Previous
                </button>
                <span style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>Page {resultsPage + 1} of {run.showtimes.totalPages}</span>
                <button type="button" disabled={resultsPage + 1 >= run.showtimes.totalPages} onClick={() => goToResultsPage(resultsPage + 1)}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
