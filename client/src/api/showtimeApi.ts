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
  showDate: string;      // "YYYY-MM-DD"
  startTime: string;     // "HH:mm:ss"
  endTime: string;       // "HH:mm:ss"  — calculated by backend from movie duration
  status: ShowtimeStatus;
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
};
