import axiosClient from './api';

export type ShowTimeResponse = {
  showTimeId: number;
  showDate: string | number[];
  startTime: string | number[];
  endTime: string | number[];
  cinemaRoomId: number;
  cinemaRoomName: string;
  updateAt: string;
  status?: string;
  price?: number;
  availableSeats?: number;
  totalSeats?: number;
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

export type RoomType = "STANDARD" | "LARGE" | "IMAX";

export const ROOM_TYPE_CONFIG: Record<RoomType, { maxSeats: number; seatsPerRow: number; label: string; description: string }> = {
  STANDARD: { maxSeats: 100, seatsPerRow: 10, label: "Standard",  description: "Up to 100 seats · 10 per row" },
  LARGE:    { maxSeats: 200, seatsPerRow: 10, label: "Large",     description: "Up to 200 seats · 10 per row" },
  IMAX:     { maxSeats: 300, seatsPerRow: 15, label: "IMAX",      description: "Up to 300 seats · 15 per row" },
};

export type RoomResponse = {
  cinemaRoomId: number;
  cinemaRoomName: string;
  roomType: RoomType;
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
  roomType: RoomType;
  seatQuantity: number;
  defaultPrice: number;
};

// ── Cinema Cluster ────────────────────────────────────────────────────────────

export type ClusterStatus = "ACTIVE" | "INACTIVE";

export type ClusterResponse = {
  clusterId: number;
  clusterName: string;
  province: string;
  address: string;
  phoneNumber?: string;
  status: ClusterStatus;
  totalRooms?: number;
  totalSeats?: number;
};

export type CreateClusterPayload = {
  clusterName: string;
  province: string;
  address: string;
  phoneNumber?: string;
  status?: ClusterStatus;
};

export type UpdateClusterPayload = Partial<CreateClusterPayload>;

export type SeatResponse = {
  seatId: number;
  seatCode: string;
  seatType: string;
  seatStatus: number;
  price: number;
  cinemaRoomId: number;
  cinemaRoomName: string;
};

export type SeatTypeValue = "STANDARD" | "VIP" | "COUPLE";

export type UpdateSeatPayload = {
  seatType: SeatTypeValue;
  price: number;
};

export type CreateTypePayload = {
  typeName: string;
};

export type ImageUploadResponse = {
  url: string;
  secureUrl?: string;
  publicId?: string;
};

type ApiWrapper<T> = { code: number; message?: string; result: T };

export const movieApi = {
  getAllMovies: () =>
    axiosClient.get('/api/movies/all') as Promise<ApiWrapper<MovieApiResponse[]>>,

  createMovie: (payload: CreateMoviePayload) =>
    axiosClient.post('/api/movies', payload) as Promise<ApiWrapper<MovieApiResponse>>,

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/api/movies/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }) as Promise<ApiWrapper<ImageUploadResponse>>;
  },

  updateMovie: (id: number, payload: UpdateMoviePayload) =>
    axiosClient.put(`/api/movies/${id}`, payload) as Promise<ApiWrapper<MovieApiResponse>>,

  deleteMovie: (id: number) =>
    axiosClient.delete(`/api/movies/${id}`) as Promise<ApiWrapper<void>>,

  getTypes: () =>
    axiosClient.get('/api/movie-types') as Promise<ApiWrapper<TypeResponse[]>>,

  getRooms: () =>
    axiosClient.get('/api/cinema-rooms') as Promise<ApiWrapper<RoomResponse[]>>,

  createRoom: (payload: CreateRoomPayload) =>
    axiosClient.post('/api/cinema-rooms', payload) as Promise<ApiWrapper<RoomResponse>>,

  getSeatsByRoom: (roomId: number) =>
    axiosClient.get(`/api/seats/room/${roomId}`) as Promise<ApiWrapper<SeatResponse[]>>,

  updateSeat: (seatId: number, payload: UpdateSeatPayload) =>
    axiosClient.put(`/api/seats/${seatId}`, payload) as Promise<ApiWrapper<SeatResponse>>,

  createType: (payload: CreateTypePayload) =>
    axiosClient.post('/api/movie-types', payload) as Promise<ApiWrapper<TypeResponse>>,

  // Cinema Cluster APIs
  getClusters: () =>
    axiosClient.get('/api/cinema-clusters') as Promise<ApiWrapper<ClusterResponse[]>>,

  createCluster: (payload: CreateClusterPayload) =>
    axiosClient.post('/api/cinema-clusters', payload) as Promise<ApiWrapper<ClusterResponse>>,

  updateCluster: (id: number, payload: UpdateClusterPayload) =>
    axiosClient.put(`/api/cinema-clusters/${id}`, payload) as Promise<ApiWrapper<ClusterResponse>>,

  deleteCluster: (id: number) =>
    axiosClient.delete(`/api/cinema-clusters/${id}`) as Promise<ApiWrapper<void>>,

  getRoomsByCluster: (clusterId: number) =>
    axiosClient.get(`/api/cinema-rooms?clusterId=${clusterId}`) as Promise<ApiWrapper<RoomResponse[]>>,
};

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
