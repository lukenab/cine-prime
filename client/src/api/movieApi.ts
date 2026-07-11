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
  /** Legacy boolean — use movieStatus for real workflow state */
  status: boolean;
  /** Real V2 workflow status */
  movieStatus?: MovieStatus;
  movieProductionCompany: string;
  largeImage: string;
  smallImage: string;
  movieType: string[];
  showTimes: ShowTimeResponse[];
  createAt: string | number[];
  // Extended fields (V2)
  gallery?: string[];
  backdrops?: string[];
  trailerUrl?: string;
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
  latitude?: number;
  longitude?: number;
  status: ClusterStatus;
  totalRooms?: number;
  totalSeats?: number;
};

export type CreateClusterPayload = {
  clusterName: string;
  province: string;
  address: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
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

export type CreateGenrePayload = {
  genreName: string;
};

export type ImageUploadResponse = {
  url: string;
  secureUrl?: string;
  publicId?: string;
};

type ApiWrapper<T> = { code: number; message?: string; result: T };

// ─────────────────────────────────────────────────────────────────────────────
// V2 Types (movie-service v2 API)
// ─────────────────────────────────────────────────────────────────────────────

export type MovieStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'COMING_SOON'
  | 'NOW_SHOWING'
  | 'SUSPENDED'
  | 'ENDED'
  | 'REJECTED';

export type GenreResponse = {
  genreId: number;
  genreCode: string;
  genreName: string;
};

export type AgeRatingResponse = {
  ratingId: number;
  ratingCode: string;
  minAge: number;
  description: string;
};

export type ScreeningFormatResponse = {
  formatId: number;
  formatCode: string;
  formatName: string;
  description: string;
  surcharge: number;
};

export type ProductionCompanyResponse = {
  companyId: number;
  name: string;
  country: string;
  logoUrl: string;
  websiteUrl?: string;
};

export type AgeRatingRequest = {
  ratingCode: string;
  minAge: number;
  description: string;
};

export type ScreeningFormatRequest = {
  formatCode: string;
  formatName: string;
  description?: string;
  surcharge: number;
};

export type ProductionCompanyRequest = {
  name: string;
  country?: string;
  logoUrl?: string;
  websiteUrl?: string;
};

export type PersonResponse = {
  personId: number;
  fullName: string;
  photoUrl: string;
  nationality: string;
  birthDate?: string;   // ISO "YYYY-MM-DD"
  biography?: string;
  tmdbId?: number;
};

export type TranslationResponse = {
  languageCode: string;
  title: string;
  synopsis: string;
};

export type CastResponse = {
  personId: number;
  fullName: string;
  photoUrl: string;
  roleType: string;
  characterName: string;
  billingOrder: number;
};

export type MovieV2 = {
  movieId: number;
  tmdbId?: number;
  imdbId?: string;
  originalTitle: string;
  originalLanguage: string;
  durationMinutes: number;
  releaseDate?: string;
  country?: string;
  status: MovieStatus;
  ageRating?: AgeRatingResponse;
  companyName?: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  trailerUrl?: string;
  synopsis?: string;
  genres: GenreResponse[];
  formats: ScreeningFormatResponse[];
  translations: TranslationResponse[];
  cast: CastResponse[];
  images: MovieImageResponse[];
  createdAt?: string;
  updatedAt?: string;
};

export type TmdbSearchItem = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseDate?: string;
  posterUrl?: string;
  overview?: string;
};

export type TmdbMovieDetails = {
  tmdbId: number;
  imdbId?: string;
  originalTitle: string;
  originalLanguage: string;
  durationMinutes?: number;
  releaseDate?: string;
  country?: string;
  posterUrl?: string;
  overview?: string;
  companyId?: number;
  companyName?: string;
  translations: TranslationResponse[];
  cast: CastResponse[];
  genreIds?: number[];
  ageRatingId?: number;
};

export type TranslationRequest = {
  languageCode: string;
  title: string;
  synopsis?: string;
};

export type CastRequest = {
  personId: number;
  roleType: string;
  characterName?: string;
  billingOrder?: number;
};

export type CreateMovieRequest = {
  originalTitle: string;
  originalLanguage: string;
  durationMinutes: number;
  releaseDate?: string;
  country?: string;
  ageRatingId?: number;
  companyId?: number;
  genreIds: number[];
  formatIds: number[];
  posterUrl?: string;
  thumbnailUrl?: string;
  trailerUrl?: string;
  synopsis?: string;
  tmdbId?: number;
  imdbId?: string;
  translations?: TranslationRequest[];
  cast?: CastRequest[];
};

export type UpdateMovieRequest = Partial<CreateMovieRequest>;

export type PersonRequest = {
  fullName: string;
  nationality?: string;
  birthDate?: string;   // ISO "YYYY-MM-DD"
  photoUrl?: string;
  biography?: string;
  tmdbId?: number;
};

export type MovieImageResponse = {
  imageId: number;
  imageUrl: string;
  imageType: 'POSTER' | 'BACKDROP' | 'STILL' | 'PROMOTIONAL';
  displayOrder?: number;
  caption?: string;
};

export type MovieImageRequest = {
  imageUrl: string;
  imageType?: 'POSTER' | 'BACKDROP' | 'STILL' | 'PROMOTIONAL';
  displayOrder?: number;
  caption?: string;
};

const toLegacyMovie = (movie: MovieV2): MovieApiResponse => {
  const english = movie.translations?.find((item) => item.languageCode === 'en');
  const vietnamese = movie.translations?.find((item) => item.languageCode === 'vi');
  const directors = movie.cast
    ?.filter((item) => item.roleType === 'DIRECTOR')
    .map((item) => item.fullName)
    .join(', ');
  const actors = movie.cast
    ?.filter((item) => item.roleType === 'ACTOR')
    .map((item) => item.fullName)
    .join(', ');

  return {
    movieId: movie.movieId,
    movieNameVn: vietnamese?.title ?? movie.originalTitle,
    movieNameEnglish: english?.title ?? movie.originalTitle,
    director: directors ?? '',
    actor: actors ?? '',
    content: vietnamese?.synopsis ?? english?.synopsis ?? movie.synopsis ?? '',
    duration: movie.durationMinutes,
    version: movie.formats?.map((item) => item.formatName).join(', ') ?? '',
    status: movie.status === 'NOW_SHOWING' || movie.status === 'COMING_SOON',
    movieStatus: movie.status,
    movieProductionCompany: movie.companyName ?? '',
    largeImage: movie.posterUrl ?? '',
    smallImage: movie.thumbnailUrl ?? movie.posterUrl ?? '',
    movieType: movie.genres?.map((item) => item.genreName) ?? [],
    showTimes: [],
    createAt: movie.createdAt ?? '',
  };
};

export const movieApi = {
  getAllMovies: async () => {
    const response = await axiosClient.get('/api/movies/all') as ApiWrapper<MovieV2[]>;
    return {
      ...response,
      result: (response.result ?? []).map(toLegacyMovie),
    } as ApiWrapper<MovieApiResponse[]>;
  },

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

  getRooms: () =>
    axiosClient.get('/api/cinema-rooms') as Promise<ApiWrapper<RoomResponse[]>>,

  createRoom: (payload: CreateRoomPayload) =>
    axiosClient.post('/api/cinema-rooms', payload) as Promise<ApiWrapper<RoomResponse>>,

  getSeatsByRoom: (roomId: number) =>
    axiosClient.get(`/api/seats/room/${roomId}`) as Promise<ApiWrapper<SeatResponse[]>>,

  updateSeat: (seatId: number, payload: UpdateSeatPayload) =>
    axiosClient.put(`/api/seats/${seatId}`, payload) as Promise<ApiWrapper<SeatResponse>>,

  // ── V2 Movie APIs ─────────────────────────────────────────────────────────

  getMovieById: (id: number, lang?: string) => {
    const url = lang ? `/api/movies/${id}?lang=${lang}` : `/api/movies/${id}`;
    return axiosClient.get(url) as Promise<ApiWrapper<MovieV2>>;
  },

  createMovieV2: (payload: CreateMovieRequest) =>
    axiosClient.post('/api/movies', payload) as Promise<ApiWrapper<MovieV2>>,

  updateMovieV2: (id: number, payload: UpdateMovieRequest) =>
    axiosClient.put(`/api/movies/${id}`, payload) as Promise<ApiWrapper<MovieV2>>,

  // Lookup APIs
  getGenres: () =>
    axiosClient.get('/api/genres') as Promise<ApiWrapper<GenreResponse[]>>,

  createGenre: (payload: CreateGenrePayload) =>
    axiosClient.post('/api/genres', payload) as Promise<ApiWrapper<GenreResponse>>,

  // Age Ratings
  getAgeRatings: () =>
    axiosClient.get('/api/age-ratings') as Promise<ApiWrapper<AgeRatingResponse[]>>,
  createAgeRating: (payload: AgeRatingRequest) =>
    axiosClient.post('/api/age-ratings', payload) as Promise<ApiWrapper<AgeRatingResponse>>,
  updateAgeRating: (id: number, payload: AgeRatingRequest) =>
    axiosClient.put(`/api/age-ratings/${id}`, payload) as Promise<ApiWrapper<AgeRatingResponse>>,
  deleteAgeRating: (id: number) =>
    axiosClient.delete(`/api/age-ratings/${id}`) as Promise<ApiWrapper<void>>,

  // Screening Formats
  getScreeningFormats: () =>
    axiosClient.get('/api/screening-formats') as Promise<ApiWrapper<ScreeningFormatResponse[]>>,
  createScreeningFormat: (payload: ScreeningFormatRequest) =>
    axiosClient.post('/api/screening-formats', payload) as Promise<ApiWrapper<ScreeningFormatResponse>>,
  updateScreeningFormat: (id: number, payload: ScreeningFormatRequest) =>
    axiosClient.put(`/api/screening-formats/${id}`, payload) as Promise<ApiWrapper<ScreeningFormatResponse>>,
  deleteScreeningFormat: (id: number) =>
    axiosClient.delete(`/api/screening-formats/${id}`) as Promise<ApiWrapper<void>>,

  // Production Companies
  searchCompanies: (q?: string) => {
    const url = q ? `/api/companies?q=${encodeURIComponent(q)}` : '/api/companies';
    return axiosClient.get(url) as Promise<ApiWrapper<ProductionCompanyResponse[]>>;
  },
  createCompany: (payload: ProductionCompanyRequest) =>
    axiosClient.post('/api/companies', payload) as Promise<ApiWrapper<ProductionCompanyResponse>>,
  updateCompany: (id: number, payload: ProductionCompanyRequest) =>
    axiosClient.put(`/api/companies/${id}`, payload) as Promise<ApiWrapper<ProductionCompanyResponse>>,
  deleteCompany: (id: number) =>
    axiosClient.delete(`/api/companies/${id}`) as Promise<ApiWrapper<void>>,

  searchPersons: (q: string) =>
    axiosClient.get(`/api/persons/search?q=${encodeURIComponent(q)}`) as Promise<ApiWrapper<PersonResponse[]>>,

  // Person CRUD
  getPersons: (q?: string) => {
    const url = q ? `/api/persons?q=${encodeURIComponent(q)}` : '/api/persons';
    return axiosClient.get(url) as Promise<ApiWrapper<PersonResponse[]>>;
  },
  getPersonById: (id: number) =>
    axiosClient.get(`/api/persons/${id}`) as Promise<ApiWrapper<PersonResponse>>,
  createPerson: (payload: PersonRequest) =>
    axiosClient.post('/api/persons', payload) as Promise<ApiWrapper<PersonResponse>>,
  updatePerson: (id: number, payload: PersonRequest) =>
    axiosClient.put(`/api/persons/${id}`, payload) as Promise<ApiWrapper<PersonResponse>>,
  deletePerson: (id: number) =>
    axiosClient.delete(`/api/persons/${id}`) as Promise<ApiWrapper<void>>,

  // Movie image APIs
  getMovieImages: (movieId: number) =>
    axiosClient.get(`/api/movies/${movieId}/images`) as Promise<ApiWrapper<MovieImageResponse[]>>,
  addMovieImage: (movieId: number, payload: MovieImageRequest) =>
    axiosClient.post(`/api/movies/${movieId}/images`, payload) as Promise<ApiWrapper<MovieImageResponse>>,
  deleteMovieImage: (movieId: number, imageId: number) =>
    axiosClient.delete(`/api/movies/${movieId}/images/${imageId}`) as Promise<ApiWrapper<void>>,

  // ── Workflow / Status transitions ─────────────────────────────────────────

  /** DRAFT → PENDING_REVIEW */
  submitForReview: (id: number) =>
    axiosClient.post(`/api/movies/${id}/submit`) as Promise<ApiWrapper<void>>,

  /** PENDING_REVIEW → COMING_SOON */
  approveMovie: (id: number) =>
    axiosClient.post(`/api/movies/${id}/approve`) as Promise<ApiWrapper<void>>,

  /** PENDING_REVIEW → REJECTED */
  rejectMovie: (id: number, note: string) =>
    axiosClient.post(`/api/movies/${id}/reject`, { note }) as Promise<ApiWrapper<void>>,

  /** NOW_SHOWING / COMING_SOON → SUSPENDED */
  suspendMovie: (id: number, reason: string) =>
    axiosClient.post(`/api/movies/${id}/suspend`, { reason }) as Promise<ApiWrapper<void>>,

  /** COMING_SOON / NOW_SHOWING / SUSPENDED → ENDED */
  endMovie: (id: number) =>
    axiosClient.post(`/api/movies/${id}/end`) as Promise<ApiWrapper<void>>,

  /** REJECTED → DRAFT */
  reworkMovie: (id: number) =>
    axiosClient.post(`/api/movies/${id}/rework`) as Promise<ApiWrapper<void>>,

  /** COMING_SOON → NOW_SHOWING */
  releaseMovie: (id: number) =>
    axiosClient.post(`/api/movies/${id}/release`) as Promise<ApiWrapper<void>>,

  /** SUSPENDED → NOW_SHOWING */
  reinstateMovie: (id: number) =>
    axiosClient.post(`/api/movies/${id}/reinstate`) as Promise<ApiWrapper<void>>,

  // TMDB APIs
  tmdbSearch: (q: string) =>
    axiosClient.get(`/api/movies/tmdb/search?q=${encodeURIComponent(q)}`) as Promise<ApiWrapper<TmdbSearchItem[]>>,

  tmdbDetails: (tmdbId: number) =>
    axiosClient.get(`/api/movies/tmdb/${tmdbId}/details`) as Promise<ApiWrapper<TmdbMovieDetails>>,

  tmdbImport: (tmdbId: number) =>
    axiosClient.post('/api/movies/tmdb/import', { tmdbId }) as Promise<ApiWrapper<MovieV2>>,

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
