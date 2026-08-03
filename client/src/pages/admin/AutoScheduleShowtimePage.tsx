import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Building2,
  CalendarCog,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Film,
  Info,
  Loader2,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings2,
  XCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { movieApi, type ClusterResponse, type MovieApiResponse, type RoomResponse, type MovieAvailabilityResponse } from "../../api/movieApi";
import {
  assessClusterEligibility,
  type ClusterScheduleEligibility,
} from "../../utils/showtimeEligibility";
import {
  showtimeApi,
  type AutoShowtimeGenerationPolicyResponse,
  type AutoShowtimeGenerationRunResponse,
  type AutoShowtimeIneligibleMovie,
  type GenerationRunStatus,
  type OptimizationScenario,
  type OptimizerMode,
  type SchedulePlanResponse,
  type SchedulePlanSummaryResponse,
} from "../../api/showtimeApi";
import AutoScheduleResultsWorkspace from "./autoSchedule/AutoScheduleResultsWorkspace";
import AllocationPolicyPanel from "./autoSchedule/AllocationPolicyPanel";
import { OPTIMIZER_META, SCENARIO_META } from "./autoSchedule/optimizerMeta";

type StepKey = "scope" | "review" | "running" | "results";
type WorkspaceSection = "create" | "review-plans" | "published" | "policy";
const STEPS: { key: StepKey; label: string; icon: typeof Calendar }[] = [
  { key: "scope", label: "Scope", icon: Calendar },
  { key: "review", label: "Review", icon: CheckCircle2 },
  { key: "running", label: "Running", icon: Loader2 },
  { key: "results", label: "Results", icon: ClipboardCheck },
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

function formatPlanningDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function extractErrorMessage(err: unknown): { message: string; ineligibleMovies?: AutoShowtimeIneligibleMovie[] } {
  const response = (err as { response?: { data?: { message?: string; result?: { ineligibleMovies?: AutoShowtimeIneligibleMovie[] } } } })?.response;
  return {
    message: response?.data?.message ?? "The generation run could not be submitted.",
    ineligibleMovies: response?.data?.result?.ineligibleMovies,
  };
}

// A CP-SAT run can legitimately take up to the policy's max_solve_time_seconds (default 30s)
// plus overhead; Legacy runs normally finish in a couple seconds. Past this, the run is either
// still solving a hard model or has been orphaned (see AutoShowtimeGenerationScheduler's
// reclaimStaleRunningRuns() sweep) - either way the admin should know to expect a delay or retry,
// not just watch an ever-increasing "Elapsed Ns" with no upper bound.
const STUCK_RUN_WARNING_SECONDS = 75;

const STATUS_META: Record<GenerationRunStatus, { label: string; color: string; background: string }> = {
  ACCEPTED: { label: "Queued", color: "#2563eb", background: "rgba(37,99,235,0.1)" },
  RUNNING: { label: "Running", color: "#d97706", background: "rgba(217,119,6,0.1)" },
  COMPLETED: { label: "Completed", color: "#059669", background: "rgba(5,150,105,0.1)" },
  PARTIALLY_COMPLETED: { label: "Partially completed", color: "#d97706", background: "rgba(217,119,6,0.1)" },
  FAILED: { label: "Failed", color: "#dc2626", background: "rgba(220,38,38,0.1)" },
};

const PLAN_STATUS_META: Record<SchedulePlanResponse["status"], { label: string; color: string; background: string }> = {
  DRAFT_GENERATED: { label: "Draft", color: "#64748b", background: "rgba(100,116,139,.12)" },
  IN_REVIEW: { label: "In review", color: "#2563eb", background: "rgba(37,99,235,.12)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#d97706", background: "rgba(217,119,6,.12)" },
  PUBLISHED: { label: "Published", color: "#059669", background: "rgba(5,150,105,.12)" },
};


function SchedulePlanLibrary({
  mode,
  plans,
  loading,
  error,
  onRefresh,
  onOpen,
}: {
  mode: "review" | "published";
  plans: SchedulePlanSummaryResponse[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpen: (generationRunId: number) => void;
}) {
  const published = mode === "published";
  return (
    <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>
            {published ? "Published schedules" : "Plans for review"}
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>
            {published
              ? "Open a published plan to inspect the operational schedule."
              : "Continue generated drafts, resolve requested changes, or review plans before publishing."}
          </p>
        </div>
        <button type="button" onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-main)" }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm" style={{ color: "var(--text-sub)" }}>
            <Loader2 size={16} className="animate-spin" /> Loading schedule plans…
          </div>
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle size={22} className="text-rose-500" />
            <p className="text-sm font-semibold text-rose-500">{error}</p>
            <button type="button" onClick={onRefresh} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Try again</button>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
            <ClipboardCheck size={24} style={{ color: "var(--text-sub)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
              {published ? "No published schedules yet" : "No plans require review"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-sub)" }}>
              {published ? "Published schedule plans will appear here." : "Generate a new draft to begin the review workflow."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {plans.map((item) => {
              const statusMeta = PLAN_STATUS_META[item.status];
              const actionLabel = item.status === "PUBLISHED"
                ? "View schedule"
                : item.status === "DRAFT_GENERATED"
                  ? "Review draft"
                  : "Open plan";
              return (
                <article key={item.schedulePlanId} className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Schedule plan #{item.schedulePlanId}</h3>
                        <span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: statusMeta.color, background: statusMeta.background }}>{statusMeta.label}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-sub)" }}>
                        {formatPlanningDate(item.startDate)} – {formatPlanningDate(item.endDate)}
                      </p>
                    </div>
                    {item.blockerCount > 0 && <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-500">{item.blockerCount} blocker{item.blockerCount === 1 ? "" : "s"}</span>}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      ["Cinemas", item.cinemaCount],
                      ["Rooms", item.roomCount],
                      ["Sessions", item.sessionCount],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>{label}</p>
                        <p className="mt-1 text-base font-bold" style={{ color: "var(--text-main)" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                    <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>
                      {item.requestedBy || "Unknown user"} · Updated {formatUpdatedAt(item.updatedAt)}
                    </p>
                    <button type="button" onClick={() => onOpen(item.generationRunId)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                      {actionLabel} <ArrowRight size={13} />
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function StepIndicator({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  const currentStep = STEPS[currentIdx];
  const Icon = currentStep.icon;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
          <Icon size={15} className={current === "running" ? "animate-spin" : ""} />
        </div>
        <div className="min-w-0">
          <p style={{ color: "var(--text-sub)", fontSize: "10.5px", fontWeight: 650, textTransform: "uppercase", letterSpacing: ".045em" }}>Step {currentIdx + 1} of {STEPS.length}</p>
          <p className="truncate" style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 700 }}>{currentStep.label}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5" aria-label={`Workflow progress: step ${currentIdx + 1} of ${STEPS.length}`}>
        {STEPS.map((item, idx) => (
          <span key={item.key} className="h-1.5 rounded-full transition-all" style={{ width: idx === currentIdx ? 24 : 8, background: idx <= currentIdx ? "#2563eb" : "var(--border-color)" }} />
        ))}
      </div>
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
  const { user } = useAuth();
  const [step, setStep] = useState<StepKey>("scope");
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>("create");

  // Scope inputs
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [startDate, setStartDate] = useState(todayPlusDays(3));
  const [endDate, setEndDate] = useState(todayPlusDays(9));
  const [optimizerMode, setOptimizerMode] = useState<OptimizerMode>("LEGACY");
  const [scenario, setScenario] = useState<OptimizationScenario>("BALANCED");
  const [generationPolicy, setGenerationPolicy] = useState<AutoShowtimeGenerationPolicyResponse | null>(null);
  const [allClusters, setAllClusters] = useState(false);
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<number>>(new Set());
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [excludedRoomIds, setExcludedRoomIds] = useState<Set<number>>(new Set());
  const [clusterEligibility, setClusterEligibility] = useState<Map<number, ClusterScheduleEligibility>>(new Map());
  const [availabilities, setAvailabilities] = useState<MovieAvailabilityResponse[]>([]);
  const [clusterSearch, setClusterSearch] = useState("");
  const [movieSearch, setMovieSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");

  // Submit / run state
  const [submitting, setSubmitting] = useState(false);
  const [processingNow, setProcessingNow] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ineligibleMovies, setIneligibleMovies] = useState<AutoShowtimeIneligibleMovie[]>([]);
  const [run, setRun] = useState<AutoShowtimeGenerationRunResponse | null>(null);
  const [plan, setPlan] = useState<SchedulePlanResponse | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [resultsPage, setResultsPage] = useState(0);
  const [planLibrary, setPlanLibrary] = useState<SchedulePlanSummaryResponse[]>([]);
  const [loadingPlanLibrary, setLoadingPlanLibrary] = useState(false);
  const [planLibraryError, setPlanLibraryError] = useState<string | null>(null);
  const [planLibraryRefresh, setPlanLibraryRefresh] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumedInitialRun = useRef<number | null>(null);
  const notifiedTerminalRun = useRef<number | null>(null);
  const manualProcessingEnvironment = import.meta.env.DEV
    || import.meta.env.VITE_DEMO_MODE === "true"
    || import.meta.env.VITE_ENABLE_AUTO_SHOWTIME_PROCESS_NOW === "true";
  const canProcessNow = user?.role === "ROLE_SUPER_ADMIN"
    || (user?.role === "ROLE_ADMIN" && manualProcessingEnvironment);

  useEffect(() => {
    Promise.all([movieApi.getClusters(), movieApi.getAllMovies(), movieApi.getRooms(), movieApi.searchAvailabilities({})])
      .then(([clusterRes, movieRes, roomRes, availabilityRes]) => {
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
        setRooms(roomRes.result ?? []);
        setAvailabilities(availabilityRes.result ?? []);
      })
      .catch(() => { setClusters([]); setMovies([]); setRooms([]); setClusterEligibility(new Map()); setAvailabilities([]); })
      .finally(() => setLoadingOptions(false));
    showtimeApi.getActiveGenerationPolicy()
      .then((res) => setGenerationPolicy(res.result ?? null))
      .catch(() => setGenerationPolicy(null));
  }, []);

  useEffect(() => {
    if (step !== "scope") return;
    let active = true;
    setLoadingPlanLibrary(true);
    setPlanLibraryError(null);
    showtimeApi.listSchedulePlans(undefined, 0, 50)
      .then((response) => {
        if (active) setPlanLibrary(response.result.content ?? []);
      })
      .catch(() => {
        if (active) {
          setPlanLibrary([]);
          setPlanLibraryError("Schedule plans could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoadingPlanLibrary(false);
      });
    return () => {
      active = false;
    };
  }, [planLibraryRefresh, step]);

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
  const reviewPlans = useMemo(
    () => planLibrary.filter((item) => item.status !== "PUBLISHED"),
    [planLibrary],
  );
  const publishedPlans = useMemo(
    () => planLibrary.filter((item) => item.status === "PUBLISHED"),
    [planLibrary],
  );
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
  const toggleExcludedRoom = (id: number) => setExcludedRoomIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const schedulableClusters = useMemo(() => clusters.filter((cluster) => clusterEligibility.get(cluster.clusterId)?.schedulable), [clusterEligibility, clusters]);
  const invalidDateRange = Boolean(startDate && endDate && endDate < startDate);
  // Mirrors AutoShowtimeGenerationService.validateGenerationRange's D+start ~ D+end horizon
  // check so an out-of-horizon date range is flagged here, instead of only surfacing as a
  // 400 INVALID_GENERATION_RANGE after Submit run.
  const horizonViolation = Boolean(
    generationPolicy && startDate && endDate
    && (startDate < generationPolicy.earliestAllowedDate || endDate > generationPolicy.latestAllowedDate)
  );
  const applyAvailablePlanningWindow = () => {
    if (!generationPolicy) return;
    const clampedStart = !startDate || startDate < generationPolicy.earliestAllowedDate
      ? generationPolicy.earliestAllowedDate
      : startDate > generationPolicy.latestAllowedDate
        ? generationPolicy.latestAllowedDate
        : startDate;
    const clampedEnd = !endDate || endDate > generationPolicy.latestAllowedDate
      ? generationPolicy.latestAllowedDate
      : endDate < clampedStart
        ? clampedStart
        : endDate;
    setStartDate(clampedStart);
    setEndDate(clampedEnd);
  };
  const effectiveClusterIds = allClusters ? schedulableClusters.map((c) => c.clusterId) : Array.from(selectedClusterIds);
  const canProceedFromScope = Boolean(
    startDate && endDate && !invalidDateRange && !horizonViolation
    && effectiveClusterIds.length > 0 && selectedMovieIds.size > 0
  );

  // Rooms an admin can exclude from this generation run only (e.g. held for a private
  // booking, or under short-notice maintenance not yet reflected in room status). Scoped to
  // the currently-selected cinema clusters so the list stays relevant as scope changes.
  const excludableRooms = useMemo(() => {
    const clusterIdSet = new Set(effectiveClusterIds);
    return rooms
      .filter((room) => clusterIdSet.has(room.clusterId) && room.status !== "INACTIVE")
      .sort((a, b) => (a.clusterName ?? "").localeCompare(b.clusterName ?? "") || a.cinemaRoomName.localeCompare(b.cinemaRoomName));
  }, [effectiveClusterIds, rooms]);
  // Drop exclusions that fall outside the current cluster scope so a stale pick from a
  // previously-selected cinema doesn't silently keep excluding a room the admin can no longer see.
  useEffect(() => {
    const validIds = new Set(excludableRooms.map((room) => room.cinemaRoomId));
    setExcludedRoomIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [excludableRooms]);

  // Mirrors SchedulingEligibilityService's AVAILABILITY_NOT_OPEN gate (movie_availability.status
  // IN (PLANNED, OPEN), showingStartDate <= day <= showingEndDate) so an admin sees which movies
  // will actually be eligible for the chosen clusters/dates *before* submitting, instead of only
  // finding out from the "Prerequisites missing" error at Review. Classification/room-format are
  // checked elsewhere (Cinema scope eligibility, and preflight on submit) - this only covers the
  // release-plan gate, since that's the one driven entirely by admin-entered scheduling data.
  const movieAvailabilityEligibility = useMemo(() => {
    const result = new Map<number, { eligible: boolean; reason?: string }>();
    if (effectiveClusterIds.length === 0 || !startDate || !endDate || invalidDateRange) {
      return result;
    }
    const clusterIdSet = new Set(effectiveClusterIds);
    for (const movie of movies) {
      const hasWindow = availabilities.some((availability) =>
        availability.movieId === movie.movieId
        && clusterIdSet.has(availability.clusterId)
        && (availability.status === "PLANNED" || availability.status === "OPEN")
        && availability.showingStartDate <= endDate
        && (!availability.showingEndDate || availability.showingEndDate >= startDate));
      result.set(movie.movieId, hasWindow
        ? { eligible: true }
        : { eligible: false, reason: "No release plan (PLANNED/OPEN) covers the selected cinemas and dates." });
    }
    return result;
  }, [availabilities, effectiveClusterIds, startDate, endDate, invalidDateRange, movies]);

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
        optimizer: optimizerMode,
        scenario: optimizerMode === "LEGACY" ? undefined : scenario,
        excludedRoomIds: excludedRoomIds.size > 0 ? Array.from(excludedRoomIds) : undefined,
      });
      const accepted = res.result;
      saveRecentRun({ generationRunId: accepted.generationRunId, submittedAt: new Date().toISOString(), startDate, endDate });
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

  const handleProcessNow = async () => {
    if (!run) return;
    setProcessingNow(true);
    try {
      await showtimeApi.executeAutoGenerationRun(run.generationRunId);
    } catch {
      // executor may have already finished (race with the scheduler) — fall through to poll
    } finally {
      setProcessingNow(false);
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
    setRunningSince(null);
    setSubmitError(null);
    setIneligibleMovies([]);
    setSelectedClusterIds(new Set());
    setSelectedMovieIds(new Set());
    setExcludedRoomIds(new Set());
    setAllClusters(false);
    setResultsPage(0);
    setWorkspaceSection("create");
    setPlanLibraryRefresh((value) => value + 1);
    setStep("scope");
  };

  const goToResultsPage = (page: number) => {
    if (!run) return;
    setResultsPage(page);
    void pollRun(run.generationRunId, page);
  };

  const transitionPlan = async (action: "submit" | "changes" | "publish", note?: string) => {
    if (!plan) return;
    setPlanBusy(true);
    setPlanError(null);
    try {
      const response = action === "submit"
        ? await showtimeApi.submitSchedulePlanReview(plan.schedulePlanId, note || undefined)
        : action === "changes"
          ? await showtimeApi.requestSchedulePlanChanges(plan.schedulePlanId, note || undefined)
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

  const revalidatePlan = async () => {
    if (!plan) return;
    setPlanBusy(true);
    setPlanError(null);
    try {
      const response = await showtimeApi.revalidateSchedulePlan(plan.schedulePlanId);
      setPlan(response.result);
      setPlanLibraryRefresh((value) => value + 1);
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
            <CalendarCog size={18} />
          </div>
          <div>
            <h1 style={{ color: "var(--text-main)", fontSize: "18px", fontWeight: 750 }}>Auto Schedule Showtimes</h1>
            <p style={{ color: "var(--text-sub)", fontSize: "12px" }}>
              Generate showtimes automatically based on movie/cluster demand — a background job handles the actual scheduling.
            </p>
          </div>
        </div>
      </div>}

      {step !== "scope" && step !== "results" && <StepIndicator current={step} />}

      {/* Nav stays visible on every step (not just "scope") so Policy (and the other
          sections) are always reachable — previously it only rendered during the
          scope step, so resuming an in-flight/completed run (which jumps straight to
          "running"/"results") hid the nav entirely and made Policy unreachable from
          that flow. */}
      <nav className="flex flex-wrap items-center gap-1 rounded-xl border p-1.5" aria-label="Automatic scheduling workspace" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        {([
          { id: "create", label: "Create schedule", icon: CalendarCog, count: null },
          { id: "review-plans", label: "Review plans", icon: ClipboardCheck, count: reviewPlans.length },
          { id: "published", label: "Published schedules", icon: CheckCircle2, count: publishedPlans.length },
          { id: "policy", label: "Policy", icon: Settings2, count: null },
        ] as const).map(({ id, label, icon: Icon, count }) => {
          const active = workspaceSection === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => { setWorkspaceSection(id); setStep("scope"); }}
              className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors"
              style={{
                color: active ? "#2563eb" : "var(--text-sub)",
                background: active ? "rgba(37,99,235,.11)" : "transparent",
              }}
            >
              <Icon size={14} />
              {label}
              {count != null && count > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ color: active ? "#2563eb" : "var(--text-main)", background: active ? "rgba(37,99,235,.12)" : "var(--bg-main)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {step === "scope" && workspaceSection === "review-plans" && (
        <SchedulePlanLibrary
          mode="review"
          plans={reviewPlans}
          loading={loadingPlanLibrary}
          error={planLibraryError}
          onRefresh={() => setPlanLibraryRefresh((value) => value + 1)}
          onOpen={resumeRun}
        />
      )}

      {step === "scope" && workspaceSection === "published" && (
        <SchedulePlanLibrary
          mode="published"
          plans={publishedPlans}
          loading={loadingPlanLibrary}
          error={planLibraryError}
          onRefresh={() => setPlanLibraryRefresh((value) => value + 1)}
          onOpen={resumeRun}
        />
      )}

      {step === "scope" && workspaceSection === "policy" && <AllocationPolicyPanel />}

      {/* ── Step 1: Scope ── */}
      {step === "scope" && workspaceSection === "create" && (
        <div className="space-y-4">
          {loadingOptions ? (
            <div className="flex items-center gap-2 rounded-2xl border p-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-sub)" }}>
              <RefreshCw size={16} className="animate-spin" /> Loading clusters and movies…
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.65fr)]">
                  <div className="flex h-[650px] min-h-0 flex-col gap-4">
                    <section className="flex-shrink-0 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <div className="mb-3 flex items-center gap-2">
                        <Calendar size={15} className="text-blue-600" />
                        <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-main)" }}>Planning window</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Start date</label>
                          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2.5 outline-none"
                            style={{ background: "var(--bg-main)", borderColor: horizonViolation ? "#d97706" : "var(--border-color)", color: "var(--text-main)", fontSize: "13.5px" }} />
                        </div>
                        <div>
                          <label className="mb-1.5 block" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>End date</label>
                          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2.5 outline-none"
                            style={{ background: "var(--bg-main)", borderColor: invalidDateRange ? "#dc2626" : horizonViolation ? "#d97706" : "var(--border-color)", color: "var(--text-main)", fontSize: "13.5px" }} />
                        </div>
                      </div>
                      {invalidDateRange && <p className="mt-2 text-rose-500" style={{ fontSize: "12px" }}>End date cannot be before start date.</p>}
                      {!invalidDateRange && horizonViolation && generationPolicy && (
                        <div className="mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(217,119,6,.28)", background: "rgba(217,119,6,.08)" }}>
                          <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold" style={{ color: "var(--text-main)", fontSize: "12px" }}>Adjust the planning dates</p>
                            <p className="mt-0.5" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
                              Choose a date between {formatPlanningDate(generationPolicy.earliestAllowedDate)} and {formatPlanningDate(generationPolicy.latestAllowedDate)}.
                            </p>
                          </div>
                          <button type="button" onClick={applyAvailablePlanningWindow} className="shrink-0 rounded-lg px-2.5 py-1.5 font-semibold transition-colors hover:bg-amber-500/10" style={{ color: "#d97706", fontSize: "11px" }}>
                            Fix dates
                          </button>
                        </div>
                      )}
                      {!invalidDateRange && !horizonViolation && generationPolicy && (
                        <div className="mt-2 flex items-center gap-1.5" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
                          <CheckCircle2 size={12} className="text-emerald-500" />
                          Available window: {formatPlanningDate(generationPolicy.earliestAllowedDate)}–{formatPlanningDate(generationPolicy.latestAllowedDate)}
                        </div>
                      )}
                    </section>

                    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={15} className="text-blue-600" />
                          <div>
                            <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-main)" }}>Cinema scope</p>
                            <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>{effectiveClusterIds.length} selected</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!allClusters && schedulableClusters.length === 0}
                          onClick={() => { setAllClusters(!allClusters); setSelectedClusterIds(new Set()); }}
                          className="rounded-lg px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ background: allClusters ? "rgba(37,99,235,.1)" : "var(--bg-main)", color: allClusters ? "#2563eb" : "var(--text-sub)", fontSize: "12px", fontWeight: 650 }}
                        >
                          {allClusters ? "Clear all" : `All eligible (${schedulableClusters.length})`}
                        </button>
                      </div>
                      <div className="relative mb-3">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                        <input value={clusterSearch} onChange={(event) => setClusterSearch(event.target.value)} placeholder="Search cinema or city…"
                          className="w-full rounded-xl border py-2 pl-8 pr-3 outline-none"
                          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }} />
                      </div>
                      <div className="nice-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-2" style={{ scrollbarGutter: "stable" }}>
                        {visibleClusters.map((cluster) => {
                          const eligibility = clusterEligibility.get(cluster.clusterId);
                          const schedulable = eligibility?.schedulable === true;
                          const selected = schedulable && (allClusters || selectedClusterIds.has(cluster.clusterId));
                          return (
                            <label
                              key={cluster.clusterId}
                              className={`relative flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${schedulable && !allClusters ? "cursor-pointer" : "cursor-not-allowed"}`}
                              style={{ borderColor: selected ? "rgba(37,99,235,.55)" : !schedulable ? "rgba(245,158,11,.28)" : "var(--border-color)", background: selected ? "rgba(37,99,235,.07)" : !schedulable ? "rgba(245,158,11,.045)" : "var(--bg-main)", opacity: !schedulable ? 0.72 : allClusters ? 0.88 : 1 }}
                            >
                              <input className="sr-only" type="checkbox" disabled={allClusters || !schedulable} checked={selected} onChange={() => toggleCluster(cluster.clusterId)} />
                              <div className="h-12 w-14 flex-shrink-0 overflow-hidden rounded-lg" style={{ background: "rgba(37,99,235,.08)" }}>
                                {cluster.coverImageUrl
                                  ? <img src={cluster.coverImageUrl} alt="" className="h-full w-full object-cover" />
                                  : <div className="flex h-full items-center justify-center text-blue-600"><Building2 size={18} /></div>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate" style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 700 }}>{cluster.clusterName}</p>
                                <p className="mt-0.5 flex items-center gap-1 truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}><MapPin size={11} /> {cluster.province || cluster.address}</p>
                                {schedulable ? (
                                  <p className="mt-1" style={{ color: "#059669", fontSize: "11.5px", fontWeight: 650 }}>
                                    {eligibility?.eligibleRoomCount} eligible of {eligibility?.totalRoomCount} rooms · {(cluster.totalSeats ?? 0).toLocaleString()} seats
                                  </p>
                                ) : (
                                  <p className="mt-1 line-clamp-2" style={{ color: "#d97706", fontSize: "11.5px", fontWeight: 600 }}>
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
                        {visibleClusters.length === 0 && <p className="py-8 text-center" style={{ fontSize: "13px", color: "var(--text-sub)" }}>No matching active cinema.</p>}
                      </div>
                    </section>
                  </div>

                  <section className="flex h-[650px] min-h-0 min-w-0 flex-col rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2"><Film size={16} className="text-blue-600" /><p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-main)" }}>Movie catalog</p></div>
                        <p className="mt-1" style={{ fontSize: "12px", color: "var(--text-sub)" }}>Approved catalog titles · scheduling eligibility is revalidated on submit · {selectedMovieIds.size} selected</p>
                      </div>
                      {selectedMovieIds.size > 0 && <button type="button" onClick={() => setSelectedMovieIds(new Set())} className="text-xs font-semibold text-blue-600">Clear selection</button>}
                    </div>
                    <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                        <input value={movieSearch} onChange={(event) => setMovieSearch(event.target.value)} placeholder="Search title or genre…"
                          className="w-full rounded-xl border py-2.5 pl-9 pr-3 outline-none"
                          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }} />
                      </div>
                      <select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} className="rounded-xl border px-3 py-2.5 outline-none"
                        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}>
                        <option value="">All genres</option>
                        {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                      </select>
                    </div>

                    <div className="nice-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2" style={{ scrollbarGutter: "stable" }}>
                      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {visibleMovies.map((movie) => {
                          const scopeChosen = effectiveClusterIds.length > 0;
                          const availabilityCheck = movieAvailabilityEligibility.get(movie.movieId);
                          const eligible = !scopeChosen || availabilityCheck?.eligible !== false;
                          const selected = eligible && selectedMovieIds.has(movie.movieId);
                          const title = movie.movieNameEnglish || movie.movieNameVn;
                          const alternateTitle = movie.movieNameVn && movie.movieNameVn !== title ? movie.movieNameVn : "";
                          return (
                            <label
                              key={movie.movieId}
                              className={`group relative flex h-full gap-2.5 overflow-hidden rounded-xl border p-2.5 transition-all ${eligible ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-not-allowed"}`}
                              style={{
                                borderColor: selected ? "rgba(37,99,235,.7)" : !eligible ? "rgba(245,158,11,.28)" : "var(--border-color)",
                                background: selected ? "rgba(37,99,235,.08)" : !eligible ? "rgba(245,158,11,.045)" : "var(--bg-main)",
                                opacity: !eligible ? 0.72 : 1,
                              }}
                            >
                              <input className="sr-only" type="checkbox" disabled={!eligible} checked={selected} onChange={() => toggleMovie(movie.movieId)} />
                              <div className="h-full w-16 flex-shrink-0 overflow-hidden rounded-lg" style={{ background: "rgba(124,58,237,.08)" }}>
                                {movie.smallImage || movie.largeImage
                                  ? <img src={movie.smallImage || movie.largeImage} alt={`${title} poster`} className="h-full w-full object-cover" />
                                  : <div className="flex h-full items-center justify-center text-purple-500"><Film size={22} /></div>}
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden py-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate" title={title} style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 750, lineHeight: 1.3 }}>{title}</p>
                                    {alternateTitle && <p className="mt-0.5 truncate" style={{ color: "var(--text-sub)", fontSize: "11.5px" }}>{alternateTitle}</p>}
                                  </div>
                                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? "#2563eb" : !eligible ? "#d97706" : "var(--border-color)", background: selected ? "#2563eb" : "transparent", color: selected ? "white" : "#d97706" }}>
                                    {selected ? <Check size={12} /> : !eligible ? <XCircle size={11} /> : null}
                                  </span>
                                </div>
                                {!eligible ? (
                                  <p className="mt-1.5 line-clamp-2" style={{ color: "#d97706", fontSize: "10.5px", fontWeight: 600 }} title={availabilityCheck?.reason}>
                                    Unavailable · {availabilityCheck?.reason}
                                  </p>
                                ) : (
                                  <div className="mt-1.5 flex flex-nowrap gap-1 overflow-hidden">
                                    {movie.ageRatingCode && <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-rose-500">{movie.ageRatingCode}</span>}
                                    <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "rgba(37,99,235,.09)", color: "#2563eb" }}>{movie.duration || "—"} min</span>
                                    {movie.version && <span className="max-w-28 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "rgba(5,150,105,.09)", color: "#059669" }}>{movie.version}</span>}
                                  </div>
                                )}
                                <p className="mt-1.5 truncate" style={{ color: "var(--text-sub)", fontSize: "10.5px" }}>{movie.releaseDate || "Release date not set"}{movie.country ? ` · ${movie.country}` : ""}</p>
                                <div className="mt-1.5 flex flex-nowrap gap-1 overflow-hidden">
                                  {movie.movieType.slice(0, 2).map((genre) => <span key={genre} className="max-w-24 flex-shrink-0 truncate rounded-md border px-1.5 py-0.5" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", fontSize: "10px" }}>{genre}</span>)}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                        {visibleMovies.length === 0 && <div className="col-span-full py-16 text-center"><Film size={24} className="mx-auto mb-2" style={{ color: "var(--text-sub)" }} /><p style={{ fontSize: "13px", color: "var(--text-sub)" }}>No matching approved movie.</p></div>}
                      </div>
                    </div>
                  </section>
                </div>

                {excludableRooms.length > 0 && (
                  <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <XCircle size={15} className="text-rose-500" />
                          <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-main)" }}>Exclude rooms (optional)</p>
                        </div>
                        <p className="mt-1" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                          Hold specific rooms out of this run only — e.g. a room reserved for a private event or short-notice maintenance. Everything else is picked automatically as usual.
                          {excludedRoomIds.size > 0 && ` · ${excludedRoomIds.size} excluded`}
                        </p>
                      </div>
                      {excludedRoomIds.size > 0 && (
                        <button type="button" onClick={() => setExcludedRoomIds(new Set())} className="text-xs font-semibold text-blue-600">Clear exclusions</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {excludableRooms.map((room) => {
                        const excluded = excludedRoomIds.has(room.cinemaRoomId);
                        return (
                          <button
                            key={room.cinemaRoomId}
                            type="button"
                            onClick={() => toggleExcludedRoom(room.cinemaRoomId)}
                            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors"
                            style={{
                              borderColor: excluded ? "rgba(225,29,72,.5)" : "var(--border-color)",
                              background: excluded ? "rgba(225,29,72,.08)" : "var(--bg-main)",
                              color: excluded ? "#e11d48" : "var(--text-main)",
                              fontSize: "12px",
                              fontWeight: 650,
                            }}
                            title={room.clusterName ? `${room.clusterName} · ${room.cinemaRoomName}` : room.cinemaRoomName}
                          >
                            {excluded ? <XCircle size={12} /> : <Check size={12} className="opacity-0" />}
                            {room.cinemaRoomName}
                            {room.clusterName && <span style={{ color: "var(--text-sub)", fontWeight: 500 }}>· {room.clusterName}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                <div className="flex min-w-0 items-center gap-3.5">
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
                    <p style={{ color: "var(--text-sub)", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Selection summary</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1.5" style={{ color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                        <Building2 size={12} className="text-blue-600" />{effectiveClusterIds.length} cinema{effectiveClusterIds.length === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1.5" style={{ color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                        <Film size={12} className="text-blue-600" />{selectedMovieIds.size} movie{selectedMovieIds.size === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1.5" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
                        <Calendar size={12} />{startDate} → {endDate}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="hidden items-center gap-1.5 sm:flex" style={{ color: canProceedFromScope ? "#059669" : "#d97706", fontSize: "11.5px", fontWeight: 650 }}>
                    {canProceedFromScope ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {canProceedFromScope ? "Ready to review" : "Complete the required selection"}
                  </span>
                  <button type="button" disabled={!canProceedFromScope} onClick={() => setStep("review")}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                    Review generation scope <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <div className="w-full space-y-4">
          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <p style={{ fontSize: "15px", fontWeight: 750, color: "var(--text-main)" }}>Confirm generation scope</p>
                <p className="mt-0.5" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Review the operating window and selected content before the eligibility check.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                  <Calendar size={12} className="mr-1.5 inline" />{startDate} → {endDate}
                </span>
                <span className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "12.5px", fontWeight: 650 }}>
                  {effectiveClusterIds.length} cinema{effectiveClusterIds.length === 1 ? "" : "s"} · {selectedMovieIds.size} movie{selectedMovieIds.size === 1 ? "" : "s"}
                </span>
              </div>
            </header>

            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(290px,0.72fr)_minmax(0,1.8fr)] xl:p-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-blue-600" />
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: ".04em" }}>Cinema scope</p>
                </div>
                {effectiveClusterIds.map((id) => {
                  const cluster = clusterById.get(id);
                  return (
                    <div key={id} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                      <div className="h-10 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-blue-500/10">
                        {cluster?.coverImageUrl
                          ? <img src={cluster.coverImageUrl} alt="" className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center text-blue-600"><Building2 size={16} /></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 700 }}>{cluster?.clusterName ?? `Cinema #${id}`}</p>
                        <p className="mt-0.5 truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}>{cluster?.province || cluster?.address || "Eligible cinema"}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(37,99,235,.2)", background: "rgba(37,99,235,.05)" }}>
                  <Info size={13} className="mt-0.5 flex-shrink-0 text-blue-600" />
                  <p style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--text-sub)" }}>
                    Active default policy controls demand weights, peak hours and minimum coverage.
                  </p>
                </div>

                {excludedRoomIds.size > 0 && (
                  <div className="rounded-xl border p-2.5" style={{ borderColor: "rgba(225,29,72,.28)", background: "rgba(225,29,72,.045)" }}>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <XCircle size={12} className="text-rose-500" />
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "#e11d48", textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {excludedRoomIds.size} room{excludedRoomIds.size === 1 ? "" : "s"} excluded from this run
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {excludableRooms.filter((room) => excludedRoomIds.has(room.cinemaRoomId)).map((room) => (
                        <span key={room.cinemaRoomId} className="rounded-md bg-rose-500/10 px-2 py-1" style={{ fontSize: "10.5px", color: "#e11d48", fontWeight: 650 }}>
                          {room.cinemaRoomName}{room.clusterName ? ` · ${room.clusterName}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <Film size={14} className="text-purple-600" />
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: ".04em" }}>Selected movies</p>
                </div>
                <div className="space-y-3">
                  {Array.from(selectedMovieIds).map((id) => {
                    const movie = movieById.get(id);
                    const title = movie?.movieNameEnglish ?? movie?.movieNameVn ?? `Movie #${id}`;
                    const secondaryTitle = movie?.movieNameVn && movie.movieNameVn !== title ? movie.movieNameVn : null;
                    const isIneligible = ineligibleMovies.some((item) => item.movieId === id);
                    return (
                      <article key={id} className="flex min-w-0 gap-3.5 rounded-2xl border p-3.5" style={{ borderColor: isIneligible ? "rgba(225,29,72,.4)" : "var(--border-color)", background: isIneligible ? "rgba(225,29,72,.055)" : "var(--bg-main)" }}>
                        <div className="h-[118px] w-20 flex-shrink-0 overflow-hidden rounded-xl bg-purple-500/10 shadow-sm">
                          {movie?.smallImage || movie?.largeImage
                            ? <img src={movie.smallImage || movie.largeImage} alt={`${title} poster`} className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center text-purple-500"><Film size={22} /></div>}
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate" title={title} style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 750 }}>{title}</p>
                              {secondaryTitle && <p className="mt-0.5 truncate" title={secondaryTitle} style={{ color: "var(--text-sub)", fontSize: "12px" }}>{secondaryTitle}</p>}
                            </div>
                            <span className="inline-flex flex-shrink-0 rounded-md px-2 py-1" style={{ background: isIneligible ? "rgba(225,29,72,.12)" : "rgba(37,99,235,.10)", color: isIneligible ? "#e11d48" : "#2563eb", fontSize: "10.5px", fontWeight: 750 }}>
                              {isIneligible ? "Prerequisites missing" : "Ready for validation"}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "11.5px", fontWeight: 650 }}>{movie?.duration || "—"} min</span>
                            {movie?.ageRatingCode && <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "11.5px", fontWeight: 650 }}>{movie.ageRatingCode}</span>}
                            {movie?.version && <span className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "11.5px", fontWeight: 650 }}>{movie.version}</span>}
                            {(movie?.movieType ?? []).slice(0, 3).map((genre) => <span key={genre} className="rounded-md bg-purple-500/10 px-2 py-1 text-purple-600" style={{ fontSize: "11.5px", fontWeight: 650 }}>{genre}</span>)}
                          </div>

                          <div className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                            <p className="truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}><span style={{ fontWeight: 650 }}>Release:</span> {movie?.releaseDate || "Not scheduled"}</p>
                            <p className="truncate" style={{ color: "var(--text-sub)", fontSize: "12px" }}><span style={{ fontWeight: 650 }}>Country:</span> {movie?.country || "Not supplied"}</p>
                            <p className="truncate" title={movie?.director} style={{ color: "var(--text-sub)", fontSize: "12px" }}><span style={{ fontWeight: 650 }}>Director:</span> {movie?.director || "Not supplied"}</p>
                          </div>
                          {movie?.movieProductionCompany && (
                            <p className="mt-1.5 truncate" title={movie.movieProductionCompany} style={{ color: "var(--text-sub)", fontSize: "12px" }}>
                              <span style={{ fontWeight: 650 }}>Production:</span> {movie.movieProductionCompany}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <header className="border-b px-4 py-3.5" style={{ borderColor: "var(--border-color)" }}>
              <p style={{ fontSize: "15px", fontWeight: 750, color: "var(--text-main)" }}>Scheduling engine</p>
              <p className="mt-0.5" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Choose which algorithm allocates showtimes for this run.</p>
            </header>
            <div className="space-y-3.5 p-4">
              <div className="grid gap-2.5 sm:grid-cols-3">
                {(Object.keys(OPTIMIZER_META) as OptimizerMode[]).map((mode) => {
                  const selected = optimizerMode === mode;
                  return (
                    <button key={mode} type="button" onClick={() => setOptimizerMode(mode)}
                      className="rounded-xl border p-3 text-left transition-colors"
                      style={{ borderColor: selected ? "rgba(37,99,235,.6)" : "var(--border-color)", background: selected ? "rgba(37,99,235,.08)" : "var(--bg-main)" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: selected ? "#2563eb" : "var(--text-main)" }}>{OPTIMIZER_META[mode].label}</p>
                      <p className="mt-1" style={{ fontSize: "11px", lineHeight: 1.45, color: "var(--text-sub)" }}>{OPTIMIZER_META[mode].description}</p>
                    </button>
                  );
                })}
              </div>

              {optimizerMode !== "LEGACY" && (
                <div>
                  <p className="mb-1.5" style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: ".04em" }}>Scenario</p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {(Object.keys(SCENARIO_META) as OptimizationScenario[]).map((option) => {
                      const selected = scenario === option;
                      return (
                        <button key={option} type="button" onClick={() => setScenario(option)}
                          className="rounded-xl border p-3 text-left transition-colors"
                          style={{ borderColor: selected ? "rgba(124,58,237,.6)" : "var(--border-color)", background: selected ? "rgba(124,58,237,.08)" : "var(--bg-main)" }}>
                          <p style={{ fontSize: "12.5px", fontWeight: 700, color: selected ? "#7c3aed" : "var(--text-main)" }}>{SCENARIO_META[option].label}</p>
                          <p className="mt-1" style={{ fontSize: "11px", lineHeight: 1.45, color: "var(--text-sub)" }}>{SCENARIO_META[option].description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {optimizerMode === "CP_SAT" && (
                <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(217,119,6,.25)", background: "rgba(217,119,6,.06)" }}>
                  <Info size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
                  <p style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--text-sub)" }}>
                    If the solver can't produce a usable schedule in time, this run automatically falls back to the Legacy algorithm (configurable per policy).
                  </p>
                </div>
              )}
            </div>
          </section>

          {submitError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5 text-rose-600">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p style={{ fontSize: "12.5px", fontWeight: 700 }}>Scheduling prerequisites are incomplete</p>
                    <p className="mt-0.5" style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>{submitError}</p>
                    <p className="mt-1" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>Check availability, classification, theatrical rights, screening version, room capability and operating hours for the selected dates.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setStep("scope")} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10">
                  Fix selection
                </button>
              </div>
              {ineligibleMovies.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {ineligibleMovies.map((m) => (
                    <li key={m.movieId} className="rounded-md bg-rose-500/10 px-2 py-1" style={{ fontSize: "10.5px", color: "#e11d48", fontWeight: 650 }}>{m.originalTitle} · #{m.movieId}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <button type="button" onClick={() => setStep("scope")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold hover:opacity-75"
              style={{ color: "var(--text-sub)" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="button" disabled={submitting || Boolean(submitError)} onClick={handleSubmit}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <>Submit run <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Running ── */}
      {step === "running" && run && (
        <div className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-2xl border p-5 text-left" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="row-span-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: STATUS_META[run.status].background, color: STATUS_META[run.status].color }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
            Run #{run.generationRunId} — {STATUS_META[run.status].label}
          </h3>
          <p className="mt-1" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
            {run.status === "ACCEPTED"
              ? "Run accepted. A worker has been notified and will start automatically."
              : "Scoring candidates and building a reviewable draft schedule…"}
          </p>
          {runningSince && (() => {
            const elapsedSeconds = Math.max(0, Math.round((Date.now() - runningSince) / 1000));
            const isTakingUnusuallyLong = elapsedSeconds > STUCK_RUN_WARNING_SECONDS;
            return (
              <>
                <p className="mt-1" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                   Elapsed {elapsedSeconds}s · You may leave this page while processing continues.
                </p>
                {isTakingUnusuallyLong && (
                  <div className="col-span-2 mt-2 flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(217,119,6,.3)", background: "rgba(217,119,6,.08)" }}>
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
                    <p style={{ fontSize: "11.5px", lineHeight: 1.5, color: "var(--text-sub)" }}>
                      This is taking longer than usual — it may have failed silently (e.g. a server restart interrupted it). Try refreshing this page; if it's still stuck after a few minutes, start a new run instead of waiting indefinitely.
                    </p>
                  </div>
                )}
              </>
            );
          })()}
          {canProcessNow && run.status === "ACCEPTED" && (
            <details className="group relative col-span-2 ml-auto mt-2 w-fit text-left">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)", background: "var(--bg-main)" }}>
                <MoreHorizontal size={14} /> Advanced actions
              </summary>
              <div className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-xl border p-2 shadow-xl" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                <button type="button" disabled={processingNow} onClick={handleProcessNow} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-500/10 disabled:opacity-50">
                  {processingNow ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Process now
                </button>
                <p className="px-3 pb-2 pt-1 text-[10px] leading-4" style={{ color: "var(--text-sub)" }}>Recovery action for development, demo, or SUPER_ADMIN operations.</p>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Completed runs leave the creation wizard and become an operations review workspace. */}
      {step === "results" && run && (
        <AutoScheduleResultsWorkspace
          run={run}
          plan={plan}
          busy={planBusy}
          error={planError}
          onNewRun={resetWizard}
          onRevalidate={revalidatePlan}
          onTransition={transitionPlan}
        />
      )}
    </div>
  );
}
