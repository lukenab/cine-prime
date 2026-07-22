import axiosClient from './api';

// ── Status ────────────────────────────────────────────────────────────────────
// Matches backend: movieservice.enums.ShowTimeStatus
export type ShowtimeStatus = 'SCHEDULED' | 'ON_SALE' | 'CANCELLED' | 'COMPLETED' | 'SUSPENDED';

// ── Response (mirrors ShowTimeResponse.java) ──────────────────────────────────
export interface ShowtimeResponse {
  showTimeId: number;
  movieId: number;
  movieName: string;
  cinemaRoomId: number;
  cinemaRoomName: string;
  clusterId?: number;
  clusterName?: string;
  showDate: string;      // "YYYY-MM-DD"
  startTime: string;     // "HH:mm:ss"
  endTime: string;       // "HH:mm:ss"  — calculated by backend from movie duration
  status: ShowtimeStatus;
  totalSeats?: number;
  availableSeats?: number;
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
// Async: submit returns ACCEPTED immediately, a background scheduler picks the
// run up within ~60s (fixed-delay poll) and executes it — poll getRun() until
// status is COMPLETED/FAILED. executeRun() forces immediate execution instead
// of waiting for the scheduler (same underlying executor, called synchronously).
export type GenerationRunStatus = 'ACCEPTED' | 'RUNNING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';

export interface AutoShowtimeGenerationRequestPayload {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  cinemaClusterIds: number[];
  movieIds: number[];
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
  startDate: string;
  endDate: string;
  summary: { candidateCount: number; createdCount: number; skippedCount: number };
  movieResults: AutoShowtimeMovieResult[];
  showtimes: { items: GeneratedShowtime[]; page: number; size: number; totalElements: number; totalPages: number };
  startedAt?: string;
  completedAt?: string;
  failureDetail?: string;
}

export interface AutoShowtimeIneligibleMovie {
  movieId: number;
  originalTitle: string;
}

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

  /** DELETE /api/schedules/{id} — ADMIN only */
  deleteShowtime: (id: number) =>
    axiosClient.delete(`/api/schedules/${id}`) as Promise<ApiWrapper<void>>,

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

  /** POST /api/schedules/auto-generation-runs/{id}/execute — ADMIN only. Forces the run
   *  to execute now instead of waiting for the scheduler's next ~60s pass. No-op if the
   *  run isn't ACCEPTED anymore (already running/done) — safe to call speculatively. */
  executeAutoGenerationRun: (id: number) =>
    axiosClient.post(`/api/schedules/auto-generation-runs/${id}/execute`) as Promise<ApiWrapper<unknown>>,
};
