import axiosClient from './api';

export type ShowTimeResponse = {
  showTimeId: number;
  showDate: string | number[];
  startTime: string | number[];
  endTime: string | number[];
  updateAt: string;
};

export type MovieApiResponse = {
  movieId: number;
  movieNameVn: string;
  movieNameEnglish: string;
  director: string;
  actor: string;
  content: string;
  duration: number;
  version: string;
  status: boolean;
  movieProductionCompany: string;
  largeImage: string;
  smallImage: string;
  movieType: string[];
  showTimes: ShowTimeResponse[];
  createAt: string | number[];
};

export type TypeResponse = {
  typeId: number;
  typeName: string;
};

export type RoomResponse = {
  cinemaRoomId: number;
  cinemaRoomName: string;
  seatQuantity: number;
};

export type ShowTimePayload = {
  cinemaRoomId: number;
  showDate: string;
  startTime: string;
};

export type CreateMoviePayload = {
  movieNameVn: string;
  movieNameEnglish: string;
  director: string;
  actor: string;
  duration: number;
  content: string;
  version: string;
  status: boolean;
  movieProductionCompany: string;
  largeImage: string;
  smallImage: string;
  typeIds: number[];
  showTimes: ShowTimePayload[];
};

export type UpdateMoviePayload = {
  movieNameVn: string;
  movieNameEnglish: string;
  director: string;
  actor: string;
  duration: number;
  content: string;
  version: string;
  status: boolean;
  movieProductionCompany: string;
  largeImage?: string;
  smallImage?: string;
  typeIds?: number[];
};

export type CreateRoomPayload = {
  cinemaRoomName: string;
  seatQuantity: number;
};

export type CreateTypePayload = {
  typeName: string;
};

type ApiWrapper<T> = { code: number; message?: string; result: T };

export const movieApi = {
  getAllMovies: () =>
    axiosClient.get('/api/movies/all') as Promise<ApiWrapper<MovieApiResponse[]>>,

  createMovie: (payload: CreateMoviePayload) =>
    axiosClient.post('/api/movies', payload) as Promise<ApiWrapper<MovieApiResponse>>,

  updateMovie: (id: number, payload: UpdateMoviePayload) =>
    axiosClient.put(`/api/movies/${id}`, payload) as Promise<ApiWrapper<MovieApiResponse>>,

  deleteMovie: (id: number) =>
    axiosClient.delete(`/api/movies/${id}`) as Promise<ApiWrapper<void>>,

  getTypes: () =>
    axiosClient.get('/api/movies/types') as Promise<ApiWrapper<TypeResponse[]>>,

  getRooms: () =>
    axiosClient.get('/api/movies/rooms') as Promise<ApiWrapper<RoomResponse[]>>,

  createRoom: (payload: CreateRoomPayload) =>
    axiosClient.post('/api/movies/room', payload) as Promise<ApiWrapper<RoomResponse>>,

  createType: (payload: CreateTypePayload) =>
    axiosClient.post('/api/movies/type', payload) as Promise<ApiWrapper<TypeResponse>>,
};

// Spring Boot may serialize LocalDate/LocalDateTime as [2026,6,22] arrays or "2026-06-22" strings.
// This helper normalises both to "YYYY-MM-DD".
export function toDateStr(val: string | number[] | undefined): string {
  if (!val) return '';
  if (Array.isArray(val)) {
    const [y, m, d] = val as number[];
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return String(val).substring(0, 10);
}

export function formatDisplayDate(val: string | number[] | undefined): string {
  const iso = toDateStr(val);
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function todayPlusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
