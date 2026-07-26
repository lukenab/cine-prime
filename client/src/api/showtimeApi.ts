import axiosClient from './api';

// ── Status ────────────────────────────────────────────────────────────────────
// Matches backend: movieservice.enums.ShowTimeStatus
export type ShowtimeStatus = 'SCHEDULED' | 'ON_SALE' | 'CANCELLED' | 'COMPLETED' | 'SUSPENDED';

// ── Response (mirrors ShowTimeResponse.java) ──────────────────────────────────
export interface ShowtimeResponse {
  showTimeId: number;
  movieId: number;
  movieName: string;
  moviePosterUrl?: string;
  cinemaRoomId: number;
  cinemaRoomName: string;
  clusterId?: number;
  clusterName?: string;
  showDate: string;      // "YYYY-MM-DD"
  startTime: string;     // "HH:mm:ss"
  endTime: string;       // "HH:mm:ss"  — calculated by backend from movie duration
  status: ShowtimeStatus;
  formatCode?: string;
  source?: 'MANUAL' | 'AUTO';
  totalSeats?: number;
  soldSeats?: number;
  availableSeats?: number;
  cancellationReason?: string;
  price?: number;        // lowest active seat price in the room — "from X" display
  updatedAt?: string;
}

// ── Create payload (mirrors CreateShowTimeRequest.java) ───────────────────────
// NOTE: endTime is NOT sent — backend calculates it from movie.durationMinutes
export interface ShowtimeAssignPayload {
  movieId: number;
  cinemaRoomId: number;
  showDate: string;
  startTime: string;
  languageCode?: string;
  subtitleCode?: string;
  basePrice?: number;   // optional — overrides per-seat default price
}

// ── Update payload (mirrors UpdateShowTimeRequest.java) ───────────────────────
// NOTE: basePrice and status are NOT supported by the update endpoint yet
export interface ShowtimeUpdatePayload {
  movieId?: number;
  cinemaRoomId?: number;
  showDate?: string;
  startTime?: string;
}

export interface ApiWrapper<T> {
  code: number;
  message?: string;
  result: T;
}

// ── Auto Showtime Generation (mirrors AutoShowtimeGenerationController.java) ──
// Async: submit returns ACCEPTED immediately and publishes an after-commit event
// to the generation worker. The fixed-delay scheduler only recovers ACCEPTED runs
// left behind by a restart/interrupted dispatch. Poll getRun() until terminal.
export type GenerationRunStatus = 'ACCEPTED' | 'RUNNING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';

// ── Constraint optimizer (P1) ──────────────────────────────────────────────────
// Matches backend: movieservice.enums.OptimizerMode / OptimizationScenario / SolverStatus
export type OptimizerMode = 'LEGACY' | 'CP_SAT' | 'SHADOW_COMPARE';
export type OptimizationScenario = 'CONSERVATIVE' | 'BALANCED' | 'REVENUE_FOCUSED';
export type SolverStatus = 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'MODEL_INVALID' | 'UNKNOWN';

/** Mirrors movieservice.service.autoshowtime.optimizer.ObjectiveBreakdown - parse from the
 *  run's `objectiveBreakdown` JSON string. */
export interface ObjectiveBreakdown {
  demandScore: number;
  utilizationScore: number;
  revenueScore: number;
  primeTimeScore: number;
  diversityScore: number;
  stabilityPenalty: number;
  gapPenalty: number;
  finalWeightedScore: number;
}

/** Mirrors movieservice.service.autoshowtime.optimizer.SolverDiagnostics - parse from the
 *  run's `solverDiagnostics` JSON string. */
export interface SolverDiagnostics {
  rawCandidateCount: number;
  eligibleCandidateCount: number;
  prunedByReason: Record<string, number>;
  variablesCreated: number;
  intervalVariablesCreated: number;
  constraintCount: number;
  solveDurationMillis: number;
  optimalityProven: boolean;
}

/** Backend serializes the full ScheduleOptimizationResult (including raw candidate lists) for
 *  the non-primary optimizer in SHADOW_COMPARE mode - only the summary fields the UI actually
 *  renders are declared here; the rest is read defensively. */
export interface ShadowComparisonResult {
  solverStatus: SolverStatus;
  objectiveBreakdown: ObjectiveBreakdown;
  diagnostics: SolverDiagnostics;
}

export interface AutoShowtimeGenerationRequestPayload {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  cinemaClusterIds: number[];
  movieIds: number[];
  /** Omit (or LEGACY) to keep the current greedy algorithm. */
  optimizer?: OptimizerMode;
  /** Ignored when optimizer is LEGACY. Defaults to BALANCED server-side. */
  scenario?: OptimizationScenario;
}

export interface AutoShowtimeGenerationAcceptedResponse {
  generationRunId: number;
  status: GenerationRunStatus;
  startDate: string;
  endDate: string;
}

export interface GeneratedShowtime {
  showtimeId: number;
  movieId: number;
  movieTitle: string;
  cinemaClusterId: number;
  cinemaRoomId: number;
  cinemaRoomName: string;
  formatId: number;
  formatName: string;
  showDate: string;
  startTime: string;
  endTime: string;
  status: string;
  generationReason: string;
}

export interface AutoShowtimeMovieResult {
  movieId: number;
  movieTitle: string;
  demandTier: string;
  candidateCount: number;
  createdCount: number;
  skippedCount: number;
}

export interface AutoShowtimeGenerationRunResponse {
  generationRunId: number;
  status: GenerationRunStatus;
  schedulePlanId?: number;
  schedulePlanStatus?: SchedulePlanStatus;
  startDate: string;
  endDate: string;
  summary: { candidateCount: number; createdCount: number; skippedCount: number; successfulPartitionCount: number; failedPartitionCount: number };
  movieResults: AutoShowtimeMovieResult[];
  showtimes: { items: GeneratedShowtime[]; page: number; size: number; totalElements: number; totalPages: number };
  startedAt?: string;
  completedAt?: string;
  failureDetail?: string;
  optimizerMode?: OptimizerMode;
  scenario?: OptimizationScenario;
  /** Null until the run finishes. UNKNOWN must never be read as a successful optimal result. */
  solverStatus?: SolverStatus;
  solveDurationMillis?: number;
  objectiveScore?: number;
  /** Raw JSON - parse with JSON.parse(...) as ObjectiveBreakdown. */
  objectiveBreakdown?: string;
  /** Raw JSON - parse with JSON.parse(...) as SolverDiagnostics. */
  solverDiagnostics?: string;
  /** Raw JSON - parse with JSON.parse(...) as ShadowComparisonResult. Only set for SHADOW_COMPARE runs. */
  shadowComparison?: string;
}

export type SchedulePlanStatus = 'DRAFT_GENERATED' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'PUBLISHED';

export interface SchedulePlanSlot {
  schedulePlanSlotId: number;
  movieId: number;
  movieTitle: string;
  moviePosterUrl?: string;
  clusterId: number;
  clusterName: string;
  cinemaRoomId: number;
  cinemaRoomName: string;
  screeningVersionId: number;
  formatCode: string;
  audioLanguageCode: string;
  subtitleLanguageCode?: string;
  businessDate: string;
  startAt: string;
  endAt: string;
  basePrice?: number;
  totalSeats?: number;
  generationReason?: string;
  scoreBreakdown?: {
    allocationScore?: number;
    daypart?: string;
    movieDemandScore?: number;
    clusterDemandScore?: number;
    timeDemandScore?: number;
    formatDemandScore?: number;
    capacityFitScore?: number;
    expectedAttendance?: number;
    roomCapacity?: number;
  };
  publishedShowtimeId?: number;
}

export interface SchedulePlanResponse {
  schedulePlanId: number;
  generationRunId: number;
  status: SchedulePlanStatus;
  blockerCount: number;
  validationSummary?: string;
  slots: SchedulePlanSlot[];
  submittedAt?: string;
  submittedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  reviewNote?: string;
}

export interface ShowtimeStatusUpdatePayload {
  status: ShowtimeStatus;
  reason?: string;
}

export interface BulkShowtimeStatusUpdatePayload extends ShowtimeStatusUpdatePayload {
  showtimeIds: number[];
}

export interface SchedulePlanSummaryResponse {
  schedulePlanId: number;
  generationRunId: number;
  status: SchedulePlanStatus;
  blockerCount: number;
  startDate: string;
  endDate: string;
  requestedBy: string;
  sessionCount: number;
  roomCount: number;
  cinemaCount: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  publishedAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface AutoShowtimeIneligibleMovie {
  movieId: number;
  originalTitle: string;
}

export interface AutoShowtimeGenerationPolicyResponse {
  policyCode: string;
  businessTimezone: string;
  planningHorizonStartDays: number;
  planningHorizonEndDays: number;
  earliestAllowedDate: string;
  latestAllowedDate: string;
}

// ── Allocation policy admin CRUD (mirrors ShowtimeAllocationPolicyController.java) ──────
// NOTE: auto-generation runs only ever read policy_code="DEFAULT" + active=true
// (AutoShowtimeGenerationService.DEFAULT_POLICY_CODE) - creating a row with a different
// code doesn't plug into any run. Managing multiple rows is only useful for keeping
// alternates ready and swapping which one is active under the DEFAULT code.
export interface ShowtimeAllocationFormatPriority {
  formatId: number;
  formatCode?: string;
  formatName?: string;
  allocationPriority: number;
}

export type ShowtimeDaypart = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'LATE_NIGHT';

/** Mirrors ShowtimeDaypartPolicy.java, nested full-replace list on ShowtimeAllocationPolicy —
 *  same pattern as formatPriorities above. daypartPolicyId is undefined for a row the admin
 *  just added client-side and hasn't saved yet. */
export interface ShowtimeDaypartPolicy {
  daypartPolicyId?: number;
  daypartCode: ShowtimeDaypart;
  startTime: string; // "HH:mm:ss"
  endTime: string;
  weekdayDemandMultiplier: number;
  weekendDemandMultiplier: number;
  active: boolean;
}

export interface ShowtimeAllocationPolicy {
  policyId: number;
  policyCode: string;
  active: boolean;
  peakDemandWeight: number;
  movieDemandWeight: number;
  clusterDemandWeight: number;
  timeSlotDemandWeight: number;
  formatDemandWeight: number;
  roomCapacityWeight: number;
  minimumCoverage: number;
  maximumRoomShare: number;
  planningHorizonStartDays: number;
  planningHorizonEndDays: number;
  cleanupBufferMinutes: number;
  timeSlotIntervalMinutes: number;
  sameMovieStaggerMinutes: number;
  maxSolveTimeSeconds: number;
  solverRandomSeed: number;
  solverSearchWorkers: number;
  solverRelativeGap: number;
  solverLogSearchProgress: boolean;
  maxCandidatesPerMoviePerDay?: number;
  optimizerFallbackToLegacyOnError: boolean;
  defaultOptimizerMode: OptimizerMode;
  businessTimezone: string;
  peakStartTime: string; // "HH:mm:ss"
  peakEndTime: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  formatPriorities: ShowtimeAllocationFormatPriority[];
  daypartPolicies: ShowtimeDaypartPolicy[];
}

export type ShowtimeAllocationPolicyPayload = Omit<
  ShowtimeAllocationPolicy,
  'policyId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
>;

// ── API ───────────────────────────────────────────────────────────────────────
export const showtimeApi = {
  /** GET /api/schedules — list all showtimes */
  getShowtimes: () =>
    axiosClient.get('/api/schedules') as Promise<ApiWrapper<ShowtimeResponse[]>>,

  /** GET /api/schedules/{id} */
  getById: (id: number) =>
    axiosClient.get(`/api/schedules/${id}`) as Promise<ApiWrapper<ShowtimeResponse>>,

  /** GET /api/schedules/movie/{movieId}?date=YYYY-MM-DD */
  getByMovie: (movieId: number, date?: string) =>
    axiosClient.get(`/api/schedules/movie/${movieId}${date ? `?date=${date}` : ''}`) as Promise<ApiWrapper<ShowtimeResponse[]>>,

  /** POST /api/schedules — ADMIN only */
  createShowtime: (payload: ShowtimeAssignPayload) =>
    axiosClient.post('/api/schedules', payload) as Promise<ApiWrapper<ShowtimeResponse>>,

  /** PUT /api/schedules/{id} — ADMIN only */
  updateShowtime: (id: number, payload: ShowtimeUpdatePayload) =>
    axiosClient.put(`/api/schedules/${id}`, payload) as Promise<ApiWrapper<ShowtimeResponse>>,

  updateShowtimeStatus: (id: number, payload: ShowtimeStatusUpdatePayload) =>
    axiosClient.patch(`/api/schedules/${id}/status`, payload) as Promise<ApiWrapper<ShowtimeResponse>>,

  bulkUpdateShowtimeStatus: (payload: BulkShowtimeStatusUpdatePayload) =>
    axiosClient.patch('/api/schedules/bulk/status', payload) as Promise<ApiWrapper<ShowtimeResponse[]>>,

  /** DELETE /api/schedules/{id} — ADMIN only */
  deleteShowtime: (id: number) =>
    axiosClient.delete(`/api/schedules/${id}`) as Promise<ApiWrapper<void>>,

  /** GET /api/schedules/auto-generation-runs/policy — ADMIN only. The active allocation
   *  policy's planning horizon (D+start ~ D+end), with earliest/latest allowed dates
   *  pre-computed server-side so the wizard can validate the chosen date range before
   *  submit instead of only learning about it from a 400 INVALID_GENERATION_RANGE. */
  getActiveGenerationPolicy: () =>
    axiosClient.get('/api/schedules/auto-generation-runs/policy') as Promise<ApiWrapper<AutoShowtimeGenerationPolicyResponse>>,

  /** POST /api/schedules/auto-generation-runs — ADMIN only. Idempotent: submitting
   *  the same scope (dates + movies + clusters) again returns the existing run
   *  instead of creating a duplicate. */
  submitAutoGenerationRun: (payload: AutoShowtimeGenerationRequestPayload) =>
    axiosClient.post('/api/schedules/auto-generation-runs', payload) as Promise<ApiWrapper<AutoShowtimeGenerationAcceptedResponse>>,

  /** GET /api/schedules/auto-generation-runs/{id}?page=&size= — ADMIN only. Poll this
   *  while status is ACCEPTED/RUNNING. `showtimes` is paginated and only ever lists
   *  showtimes that were actually CREATED (not skipped candidates). */
  getAutoGenerationRun: (id: number, page = 0, size = 20) =>
    axiosClient.get(`/api/schedules/auto-generation-runs/${id}?page=${page}&size=${size}`) as Promise<ApiWrapper<AutoShowtimeGenerationRunResponse>>,

  /** POST /api/schedules/auto-generation-runs/{id}/execute — Process-now escape hatch.
   *  Production: SUPER_ADMIN only. Development/demo may explicitly allow ADMIN.
   *  No-op if another worker has already claimed the run. */
  executeAutoGenerationRun: (id: number) =>
    axiosClient.post(`/api/schedules/auto-generation-runs/${id}/execute`) as Promise<ApiWrapper<unknown>>,

  getSchedulePlan: (id: number) =>
    axiosClient.get(`/api/schedule-plans/${id}`) as Promise<ApiWrapper<SchedulePlanResponse>>,

  listSchedulePlans: (status?: SchedulePlanStatus, page = 0, size = 20) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) params.set('status', status);
    return axiosClient.get(`/api/schedule-plans?${params.toString()}`) as Promise<ApiWrapper<PageResponse<SchedulePlanSummaryResponse>>>;
  },

  submitSchedulePlanReview: (id: number, note?: string) =>
    axiosClient.post(`/api/schedule-plans/${id}/submit-review`, { note }) as Promise<ApiWrapper<SchedulePlanResponse>>,

  requestSchedulePlanChanges: (id: number, note?: string) =>
    axiosClient.post(`/api/schedule-plans/${id}/request-changes`, { note }) as Promise<ApiWrapper<SchedulePlanResponse>>,

  publishSchedulePlan: (id: number) =>
    axiosClient.post(`/api/schedule-plans/${id}/publish`) as Promise<ApiWrapper<SchedulePlanResponse>>,

  /** GET /api/schedules/allocation-policies — ADMIN only. Lists every policy row, most
   *  recently updated first. */
  listAllocationPolicies: () =>
    axiosClient.get('/api/schedules/allocation-policies') as Promise<ApiWrapper<ShowtimeAllocationPolicy[]>>,

  getAllocationPolicy: (policyId: number) =>
    axiosClient.get(`/api/schedules/allocation-policies/${policyId}`) as Promise<ApiWrapper<ShowtimeAllocationPolicy>>,

  createAllocationPolicy: (payload: ShowtimeAllocationPolicyPayload) =>
    axiosClient.post('/api/schedules/allocation-policies', payload) as Promise<ApiWrapper<ShowtimeAllocationPolicy>>,

  updateAllocationPolicy: (policyId: number, payload: ShowtimeAllocationPolicyPayload) =>
    axiosClient.put(`/api/schedules/allocation-policies/${policyId}`, payload) as Promise<ApiWrapper<ShowtimeAllocationPolicy>>,

  /** Activates this row and deactivates any other row sharing the same policy_code — see
   *  ShowtimeAllocationPolicy's DEFAULT-code caveat above. */
  activateAllocationPolicy: (policyId: number) =>
    axiosClient.post(`/api/schedules/allocation-policies/${policyId}/activate`) as Promise<ApiWrapper<ShowtimeAllocationPolicy>>,
};
