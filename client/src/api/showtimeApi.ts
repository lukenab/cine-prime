import axiosClient from './api';

export type ShowtimeStatus = 'SCHEDULED' | 'ONGOING' | 'FINISHED' | 'CANCELLED';

export interface ShowtimeResponse {
  showtimeId: number;
  movieId: number;
  movieName: string;
  duration: number;
  cinemaId: number;
  cinemaName: string;
  cinemaRoomId: number;
  roomName: string;
  showDate: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  status: ShowtimeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShowtimeAssignPayload {
  movieId: number;
  cinemaRoomId: number;
  showDate: string;
  startTime: string;
  endTime: string;
  basePrice: number;
}

export interface ShowtimeUpdatePayload {
  movieId?: number;
  cinemaRoomId?: number;
  showDate?: string;
  startTime?: string;
  endTime?: string;
  basePrice?: number;
  status?: ShowtimeStatus;
}

export interface MovieDropdownResponse {
  movieId: number;
  movieNameVn: string;
  movieNameEnglish: string;
  duration: number;
}

export interface CinemaResponse {
  cinemaId: number;
  cinemaName: string;
  address?: string;
}

export interface RoomDropdownResponse {
  cinemaRoomId: number;
  cinemaRoomName: string;
  seatQuantity: number;
  cinemaId: number;
}

export interface ApiWrapper<T> {
  code: number;
  message?: string;
  result: T;
}

export const showtimeApi = {
  getShowtimes: () =>
    axiosClient.get('/api/showtimes') as Promise<ApiWrapper<ShowtimeResponse[]>>,

  createShowtime: (payload: ShowtimeAssignPayload) =>
    axiosClient.post('/api/showtimes/assign', payload) as Promise<ApiWrapper<ShowtimeResponse>>,

  updateShowtime: (id: number, payload: ShowtimeUpdatePayload) =>
    axiosClient.put(`/api/showtimes/${id}`, payload) as Promise<ApiWrapper<ShowtimeResponse>>,

  deleteShowtime: (id: number) =>
    axiosClient.delete(`/api/showtimes/${id}`) as Promise<ApiWrapper<void>>,

  getMovies: () =>
    axiosClient.get('/api/movies') as Promise<ApiWrapper<MovieDropdownResponse[]>>,

  getCinemas: () =>
    axiosClient.get('/api/cinemas') as Promise<ApiWrapper<CinemaResponse[]>>,

  getRooms: (cinemaId: number) =>
    axiosClient.get(`/api/cinemas/${cinemaId}/rooms`) as Promise<ApiWrapper<RoomDropdownResponse[]>>,
};
