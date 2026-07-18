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
  /** Legacy boolean — content-only statuses have no "on sale" meaning anymore, always false. */
  status: boolean;
  /** Content-review status (DRAFT/PENDING_REVIEW/APPROVED/CHANGES_REQUESTED/ARCHIVED). Admin use only. */
  movieStatus?: MovieStatus;
  /** Cluster-derived exhibition status (MOV-LC-07) — only set on getPublicMovies() results.
   *  Use this, not movieStatus, to decide Now Showing / Coming Soon on customer pages. */
  displayStatus?: DisplayStatus;
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
  releaseDate?: string;
  endDate?: string;
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
  roomCode?: string;
  roomType: RoomType;
  seatQuantity: number;
  numberOfRows: number;
  seatsPerRow: number;
  standardRowCount: number;
  vipRowCount: number;
  coupleRowCount: number;
  clusterId: number;
  clusterName?: string;
};

/** Raw shape returned by the backend (movieservice.dto.response.CinemaRoomResponse) —
 *  field is `totalSeatCapacity`, not `seatQuantity`. Kept separate so the legacy
 *  `seatQuantity` name used throughout the UI keeps working via toLegacyRoom(). */
export type RoomApiResponse = {
  cinemaRoomId: number;
  cinemaRoomName: string;
  roomCode?: string;
  roomType: RoomType;
  totalSeatCapacity: number;
  numberOfRows: number;
  seatsPerRow: number;
  standardRowCount: number;
  vipRowCount: number;
  coupleRowCount: number;
  status?: string;
  maintenanceNote?: string;
  clusterId: number;
  clusterName?: string;
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

// ── Cinema Room creation wizard (layout versioning / approval workflow) ────────
// See docs/CINEMA_ROOM_CREATION_FLOW.md. Room creation always goes through this
// flow — the old flat quick-create endpoint (no review, straight to ACTIVE) was
// removed so rooms are governed the same way as cinema clusters (draft -> submit
// -> admin approve -> activate).

export type MasterDataItem = {
  id: number;
  code: string;
  name: string;
  description?: string;
};

export type RoomConfigurationTemplate = {
  id: number;
  code: string;
  name: string;
  description?: string;
  auditoriumClassId: number;
  projectionTechnologyId: number;
  resolutionId: number;
  audioFormatId: number;
  supports2d: boolean;
  supports3d: boolean;
  numberOfRows: number;
  maxPositionsPerRow: number;
  layoutTemplateCode: string;
  standardRowPercentage: number;
  coupleLastRow: boolean;
  centerAisle: boolean;
  crossAisle: boolean;
};

export type CinemaRoomMasterData = {
  auditoriumClasses: MasterDataItem[];
  projectionTechnologies: MasterDataItem[];
  resolutions: MasterDataItem[];
  audioFormats: MasterDataItem[];
  roomTemplates?: RoomConfigurationTemplate[];
  presentationSystems?: PresentationSystemValue[];
  seatTypes: string[];
  numberingDirections: string[];
  layoutPositionTypes: string[];
  roomStatuses: string[];
  layoutStatuses: string[];
};

export type LayoutPositionType = "SEAT" | "AISLE" | "EXIT" | "EMPTY_SPACE";
export type PresentationSystemValue = "STANDARD" | "IMAX" | "DOLBY_CINEMA" | "SCREENX";
export type NumberingDirectionValue = "LEFT_TO_RIGHT" | "RIGHT_TO_LEFT";
export type NumberingPolicyValue = "CONTIGUOUS_SEATS" | "PHYSICAL_POSITION";
export type LayoutStatusValue = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "REJECTED" | "SUPERSEDED";
export type CinemaRoomWizardStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE"
  | "MAINTENANCE" | "TEMPORARILY_UNAVAILABLE" | "SUSPENDED" | "CLOSED" | "RETIRED";

export type LayoutPosition = {
  positionId?: number;
  rowIndex: number;
  columnIndex: number;
  rowLabel: string;
  positionType: LayoutPositionType;
  seatNumber?: number | null;
  seatCode?: string | null;
  seatType?: SeatTypeValue | null;
  seatGroupId?: string | null;
  seatStatus?: string;
  /** True when an operator changed this coordinate after generation. The
   *  Layout Assistant uses it to preserve exceptions during regeneration. */
  manualOverride?: boolean;
};

export type RoomLayoutSummary = {
  roomLayoutId: number;
  version: number;
  status: LayoutStatusValue;
  personCapacity: number;
  sellableUnitCount: number;
  submittedAt?: string;
  approvedAt?: string;
};

export type RoomLayoutDetail = RoomLayoutSummary & {
  cinemaRoomId: number;
  numberOfRows: number;
  maxPositionsPerRow: number;
  firstRowLabel: string;
  numberingDirection: NumberingDirectionValue;
  numberingPolicy: NumberingPolicyValue;
  generatorTemplateCode?: string;
  generatorTemplateVersion?: number;
  generationConfig?: string;
  submittedBy?: string;
  approvedBy?: string;
  rejectionReason?: string;
  positions: LayoutPosition[];
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type RoomLayoutSavePayload = {
  numberOfRows?: number;
  maxPositionsPerRow?: number;
  firstRowLabel?: string;
  numberingDirection?: NumberingDirectionValue;
  numberingPolicy?: NumberingPolicyValue;
  generatorTemplateCode?: string;
  generatorTemplateVersion?: number;
  generationConfig?: string;
  positions: LayoutPosition[];
};

/** Step 1/2 wizard fields captured when creating the DRAFT room. */
export type CreateRoomWizardPayload = {
  cinemaRoomName: string;
  roomCode: string;
  clusterId: number;
  auditoriumClassId: number;
  lengthM: number;
  widthM: number;
  clearHeightM: number;
  projectionTechnologyId?: number;
  presentationSystem?: PresentationSystemValue;
  resolutionId?: number;
  screenWidthM?: number;
  screenHeightM?: number;
  supports2d?: boolean;
  supports3d?: boolean;
  audioFormatId?: number;
};

/** Step 1/2 partial update while the room is still DRAFT — every field optional. */
export type UpdateRoomWizardPayload = Partial<CreateRoomWizardPayload>;

export type CinemaRoomDetail = {
  cinemaRoomId: number;
  cinemaRoomName: string;
  roomCode?: string;
  status: CinemaRoomWizardStatus;
  clusterId: number;
  clusterName?: string;

  lengthM?: number;
  widthM?: number;
  clearHeightM?: number;
  areaSqm?: number;

  auditoriumClassId?: number;
  auditoriumClassCode?: string;
  auditoriumClassName?: string;

  projectionTechnologyId?: number;
  projectionTechnologyCode?: string;
  projectionTechnologyName?: string;
  presentationSystem?: PresentationSystemValue;

  resolutionId?: number;
  resolutionCode?: string;

  screenWidthM?: number;
  screenHeightM?: number;
  screenAspectRatio?: number;
  supports2d?: boolean;
  supports3d?: boolean;

  audioFormatId?: number;
  audioFormatCode?: string;

  activeLayout?: RoomLayoutSummary;
};

// ── Cinema Cluster ────────────────────────────────────────────────────────────

export type ClusterStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "INACTIVE";
export type ClusterVenueType = "MALL" | "STANDALONE" | "MIXED_USE";
export type ClusterOperatingDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export type ClusterOperatingHour = {
  dayOfWeek: ClusterOperatingDay;
  opensAt?: string;
  closesAt?: string;
  closesNextDay: boolean;
  closed: boolean;
};

export type ClusterResponse = {
  clusterId: number;
  clusterCode: string;
  clusterName: string;
  venueType: ClusterVenueType;
  openingDate?: string;
  publicEmail?: string;
  countryCode: string;
  province: string;
  ward?: string;
  postalCode?: string;
  buildingName?: string;
  floorLocation?: string;
  address: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  operatingHours: ClusterOperatingHour[];
  status: ClusterStatus;
  rejectionNote?: string;
  createdBy?: string;
  updatedBy?: string;
  totalRooms?: number;
  totalSeats?: number;
};

export type CreateClusterPayload = {
  clusterCode: string;
  clusterName: string;
  venueType: ClusterVenueType;
  openingDate?: string;
  countryCode: string;
  province: string;
  ward?: string;
  postalCode?: string;
  buildingName?: string;
  floorLocation?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  operatingHours: ClusterOperatingHour[];
  status?: ClusterStatus;
};

export type UpdateClusterPayload = Partial<CreateClusterPayload>;

export type SeatResponse = {
  seatId: number;
  seatCode: string;
  seatType: string;
  colSpan?: number; // so cot vat ly ghe chiem trong hang (Couple = 2)
  aisleAfter?: boolean; // co loi di ngay sau ghe nay khong (render gap trong so do ghe)
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  price: number;
  cinemaRoomId: number;
  cinemaRoomName: string;
};

export type SeatTypeValue = "STANDARD" | "VIP" | "COUPLE" | "ACCESSIBLE";

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

// Content-review status only — never exhibition/publish state. See
// docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md. Exhibition state
// lives on MovieAvailability; customer-facing display status is a derived
// "NOW_SHOWING" | "COMING_SOON" string returned by /api/movies/public, not a
// MovieStatus value.
export type MovieStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'ARCHIVED';

export type AvailabilityStatus = 'PLANNED' | 'OPEN' | 'SUSPENDED' | 'CLOSED';

export type DisplayStatus = 'NOW_SHOWING' | 'COMING_SOON';

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
  endDate?: string;
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

/** Read-model returned by GET /api/movies/public (MOV-LC-07) — displayStatus is
 *  derived server-side from content approval + cluster availability + showtimes,
 *  never persisted. clusterId/nextShowtimeAt/bookingAvailable are only
 *  authoritative when the request included a clusterId (see contract). */
export type PublicMovieResponse = {
  movieId: number;
  originalTitle: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  trailerUrl?: string;
  synopsis?: string;
  durationMinutes?: number;
  genres: GenreResponse[];
  displayStatus: DisplayStatus;
  clusterId?: number;
  clusterName?: string;
  nextShowtimeAt?: string;
  bookingAvailable: boolean;
};

export type MovieAvailabilityResponse = {
  availabilityId: number;
  movieId: number;
  movieTitle?: string;
  clusterId: number;
  clusterName?: string;
  status: AvailabilityStatus;
  salesStartAt?: string;
  showingStartDate: string;
  showingEndDate?: string;
  suspensionReason?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type CreateMovieAvailabilityPayload = {
  movieId: number;
  clusterId: number;
  salesStartAt?: string;
  showingStartDate: string;
  showingEndDate?: string;
};

export type UpdateMovieAvailabilityPayload = Partial<Omit<CreateMovieAvailabilityPayload, 'movieId' | 'clusterId'>>;

export type TmdbSearchItem = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseDate?: string;
  posterUrl?: string;
  overview?: string;
  /** true neu phim nay da co trong DB (theo tmdbId) - dung de disable/badge o browse list */
  alreadyImported?: boolean;
};

/**
 * Issue #188 - external preview DTO cho production company trong TMDB details preview.
 * localCompanyId null/undefined nghia la company nay CHUA tung duoc import vao DB - KHONG
 * phai loi. Preview (GET /tmdb/{id}/details) chi "khop thu" read-only, khong duoc tao moi;
 * viec tao that su (neu can) chi xay ra luc admin bam Save (xem MovieEditorPage.resolveCompanyId()).
 */
export type TmdbCompanyPreview = {
  tmdbId: number;
  name: string;
  country?: string;
  logoUrl?: string;
  localCompanyId?: number;
};

/** Issue #188 - external preview DTO cho cast, cung nguyen tac voi TmdbCompanyPreview o tren. */
export type TmdbCastPreview = {
  tmdbId: number;
  fullName: string;
  photoUrl?: string;
  roleType: string;
  characterName?: string;
  billingOrder?: number;
  localPersonId?: number;
};

export type TmdbGenrePreview = {
  tmdbGenreId: number;
  name: string;
  localGenreId?: number | null;
  mappingStatus: "MAPPED" | "PENDING_REVIEW" | "UNMAPPED";
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
  /** Explicit smaller CDN size derivative of the same recommended poster - never the same
   *  string as posterUrl. Use this directly; don't copy posterUrl into a thumbnail field. */
  thumbnailUrl?: string;
  overview?: string;
  media?: MovieMediaPreview;
  companies?: TmdbCompanyPreview[];
  translations: TranslationResponse[];
  cast: TmdbCastPreview[];
  genres?: TmdbGenrePreview[];
  /** Backward-compatible fallback for the legacy preview contract. */
  genreIds?: number[];
  ageRatingId?: number;
  warnings?: string[];
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
  endDate?: string;
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

export type MovieImageType = 'POSTER' | 'BACKDROP' | 'STILL' | 'PROMOTIONAL' | 'LOGO';

export type MovieImageResponse = {
  imageId: number;
  imageUrl: string;
  imageType: MovieImageType;
  displayOrder?: number;
  caption?: string;
  /** 'TMDB' | 'MANUAL' | 'CLOUDINARY' - undefined for images added before this field existed. */
  source?: string;
  externalPath?: string;
  languageCode?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  isDefault?: boolean;
};

export type MovieImageRequest = {
  imageUrl: string;
  imageType?: MovieImageType;
  displayOrder?: number;
  caption?: string;
};

/** TMDB-FIX-05: one selectable poster/backdrop/still candidate from GET /tmdb/{tmdbId}/details .media. */
export type MovieMediaCandidate = {
  filePath: string;
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  languageCode?: string;
  voteAverage?: number;
  recommended: boolean;
};

export type MovieMediaPreview = {
  recommendedPosterPath?: string;
  recommendedBackdropPath?: string;
  posters: MovieMediaCandidate[];
  backdrops: MovieMediaCandidate[];
  /** Our own domain concept - TMDB's movie /images has no "stills" category, these are
   *  extra backdrops beyond the recommended one. */
  stills: MovieMediaCandidate[];
};

export type TmdbImageSelection = {
  filePath: string;
  imageType: MovieImageType;
  displayOrder?: number;
};

export type TmdbImageImportPayload = {
  tmdbId: number;
  selections: TmdbImageSelection[];
};

export type TmdbImageImportResult = {
  importedCount: number;
  skippedDuplicateCount: number;
  images: MovieImageResponse[];
  warnings: string[];
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
    // Content-only statuses have no "on sale" meaning — kept as a stable false
    // rather than removed, since some legacy admin UI still reads this field.
    status: false,
    movieStatus: movie.status,
    movieProductionCompany: movie.companyName ?? '',
    largeImage: movie.posterUrl ?? '',
    smallImage: movie.thumbnailUrl ?? movie.posterUrl ?? '',
    movieType: movie.genres?.map((item) => item.genreName) ?? [],
    showTimes: [],
    createAt: movie.createdAt ?? '',
    releaseDate: movie.releaseDate,
    endDate: movie.endDate,
  };
};

/** Bridges the lightweight MOV-LC-07 public read-model onto the legacy
 *  MovieApiResponse shape so existing customer components (MovieCard,
 *  NowShowing, ComingSoon, MoviesPage) keep working unchanged — only
 *  displayStatus is new/authoritative here; director/actor/localized titles
 *  aren't part of the public read-model and are left blank. */
const toLegacyPublicMovie = (movie: PublicMovieResponse): MovieApiResponse => ({
  movieId: movie.movieId,
  movieNameVn: movie.originalTitle,
  movieNameEnglish: movie.originalTitle,
  director: '',
  actor: '',
  content: movie.synopsis ?? '',
  duration: movie.durationMinutes ?? 0,
  version: '',
  status: movie.displayStatus === 'NOW_SHOWING',
  movieStatus: undefined,
  displayStatus: movie.displayStatus,
  movieProductionCompany: '',
  largeImage: movie.posterUrl ?? '',
  smallImage: movie.thumbnailUrl ?? movie.posterUrl ?? '',
  movieType: movie.genres?.map((item) => item.genreName) ?? [],
  showTimes: movie.nextShowtimeAt ? [{
    showTimeId: 0,
    showDate: movie.nextShowtimeAt,
    startTime: movie.nextShowtimeAt,
    endTime: movie.nextShowtimeAt,
    cinemaRoomId: 0,
    cinemaRoomName: movie.clusterName ?? '',
    updateAt: '',
  }] : [],
  createAt: '',
});

/** Backend uses `totalSeatCapacity`; UI has used `seatQuantity` throughout —
 *  bridge the two here so callers don't have to change. */
const toLegacyRoom = (room: RoomApiResponse): RoomResponse => ({
  cinemaRoomId: room.cinemaRoomId,
  cinemaRoomName: room.cinemaRoomName,
  roomCode: room.roomCode,
  roomType: room.roomType,
  seatQuantity: room.totalSeatCapacity,
  numberOfRows: room.numberOfRows,
  seatsPerRow: room.seatsPerRow,
  standardRowCount: room.standardRowCount,
  vipRowCount: room.vipRowCount,
  coupleRowCount: room.coupleRowCount,
  clusterId: room.clusterId,
  clusterName: room.clusterName,
});

export const movieApi = {
  /** ADMIN/EMPLOYEE only (@PreAuthorize on the backend) — returns movies of every
   *  status (DRAFT/PENDING_REVIEW/...). Use only from authenticated admin pages. */
  getAllMovies: async () => {
    const response = await axiosClient.get('/api/movies/all') as ApiWrapper<MovieV2[]>;
    return {
      ...response,
      result: (response.result ?? []).map(toLegacyMovie),
    } as ApiWrapper<MovieApiResponse[]>;
  },

  /** Public — no auth required. displayStatus is derived per cluster (MOV-LC-07);
   *  without a clusterId this is aggregate discovery only (see contract) — every
   *  cluster/booking-scoped field on the result is best-effort, not authoritative.
   *  Use from guest/customer-facing pages (HomePage, MoviesPage, ShowtimePage) —
   *  getAllMovies() 401/403s for guests. */
  getPublicMovies: async (clusterId?: number) => {
    const url = clusterId ? `/api/movies/public?clusterId=${clusterId}` : '/api/movies/public';
    const response = await axiosClient.get(url) as ApiWrapper<PublicMovieResponse[]>;
    return {
      ...response,
      result: (response.result ?? []).map(toLegacyPublicMovie),
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

  getRooms: async () => {
    const response = await axiosClient.get('/api/cinema-rooms') as ApiWrapper<RoomApiResponse[]>;
    return { ...response, result: (response.result ?? []).map(toLegacyRoom) } as ApiWrapper<RoomResponse[]>;
  },

  deleteRoom: (roomId: number) =>
    axiosClient.delete(`/api/cinema-rooms/${roomId}`) as Promise<ApiWrapper<void>>,

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
  /** TMDB-FIX-05: persists admin-selected posters/backdrops/stills from .media candidates. */
  importTmdbImages: (movieId: number, payload: TmdbImageImportPayload) =>
    axiosClient.post(`/api/movies/${movieId}/images/tmdb-import`, payload) as Promise<ApiWrapper<TmdbImageImportResult>>,

  // ── Content lifecycle commands (MOV-LC-04) — every command returns the
  // updated MovieV2, not void. See MOVIE_LIFECYCLE_CONTRACT.md.

  /** DRAFT → PENDING_REVIEW */
  submitForReview: (id: number) =>
    axiosClient.post(`/api/movies/${id}/submit`) as Promise<ApiWrapper<MovieV2>>,

  /** PENDING_REVIEW → APPROVED. Content-only — does not publish or open sales anywhere. */
  approveMovie: (id: number) =>
    axiosClient.post(`/api/movies/${id}/approve`) as Promise<ApiWrapper<MovieV2>>,

  /** PENDING_REVIEW → CHANGES_REQUESTED */
  requestMovieChanges: (id: number, note: string) =>
    axiosClient.post(`/api/movies/${id}/request-changes`, { note }) as Promise<ApiWrapper<MovieV2>>,

  /** CHANGES_REQUESTED → DRAFT */
  startMovieRevision: (id: number) =>
    axiosClient.post(`/api/movies/${id}/start-revision`) as Promise<ApiWrapper<MovieV2>>,

  /** APPROVED → ARCHIVED. Blocked while any availability window is PLANNED/OPEN. */
  archiveMovie: (id: number) =>
    axiosClient.post(`/api/movies/${id}/archive`) as Promise<ApiWrapper<MovieV2>>,

  // ── Movie availability — per-cluster exhibition/release plan (MOV-LC-06) ──

  searchAvailabilities: (params: { movieId?: number; clusterId?: number; status?: AvailabilityStatus }) => {
    const query = new URLSearchParams();
    if (params.movieId) query.set('movieId', String(params.movieId));
    if (params.clusterId) query.set('clusterId', String(params.clusterId));
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return axiosClient.get(`/api/movie-availabilities${qs ? `?${qs}` : ''}`) as Promise<ApiWrapper<MovieAvailabilityResponse[]>>;
  },

  createAvailability: (payload: CreateMovieAvailabilityPayload) =>
    axiosClient.post('/api/movie-availabilities', payload) as Promise<ApiWrapper<MovieAvailabilityResponse>>,

  updateAvailability: (id: number, payload: UpdateMovieAvailabilityPayload) =>
    axiosClient.put(`/api/movie-availabilities/${id}`, payload) as Promise<ApiWrapper<MovieAvailabilityResponse>>,

  /** PLANNED → OPEN */
  openAvailability: (id: number) =>
    axiosClient.post(`/api/movie-availabilities/${id}/open`) as Promise<ApiWrapper<MovieAvailabilityResponse>>,

  /** PLANNED/OPEN → SUSPENDED, reason required */
  suspendAvailability: (id: number, reason: string) =>
    axiosClient.post(`/api/movie-availabilities/${id}/suspend`, { reason }) as Promise<ApiWrapper<MovieAvailabilityResponse>>,

  /** SUSPENDED → OPEN */
  resumeAvailability: (id: number) =>
    axiosClient.post(`/api/movie-availabilities/${id}/resume`) as Promise<ApiWrapper<MovieAvailabilityResponse>>,

  /** PLANNED/OPEN/SUSPENDED → CLOSED */
  closeAvailability: (id: number) =>
    axiosClient.post(`/api/movie-availabilities/${id}/close`) as Promise<ApiWrapper<MovieAvailabilityResponse>>,

  // TMDB APIs
  tmdbSearch: (q: string) =>
    axiosClient.get(`/api/movies/tmdb/search?q=${encodeURIComponent(q)}`) as Promise<ApiWrapper<TmdbSearchItem[]>>,

  /** Danh sach phim dang chieu rap (Now Playing) theo khu vuc - man hinh Browse & Import */
  tmdbNowPlaying: (region = 'VN', page = 1) =>
    axiosClient.get(`/api/movies/tmdb/now-playing?region=${region}&page=${page}`) as Promise<ApiWrapper<TmdbSearchItem[]>>,

  /** Danh sach phim sap ra mat (Upcoming) theo khu vuc - tab thu 2 cua man hinh Browse & Import */
  tmdbUpcoming: (region = 'VN', page = 1) =>
    axiosClient.get(`/api/movies/tmdb/upcoming?region=${region}&page=${page}`) as Promise<ApiWrapper<TmdbSearchItem[]>>,

  tmdbDetails: (tmdbId: number) =>
    axiosClient.get(`/api/movies/tmdb/${tmdbId}/details`) as Promise<ApiWrapper<TmdbMovieDetails>>,

  tmdbImport: (tmdbId: number) =>
    axiosClient.post('/api/movies/tmdb/import', { tmdbId }) as Promise<ApiWrapper<MovieV2>>,

  // Cinema Cluster APIs
  getClusters: () =>
    axiosClient.get('/api/cinema-clusters') as Promise<ApiWrapper<ClusterResponse[]>>,

  getClusterById: (id: number) =>
    axiosClient.get(`/api/cinema-clusters/${id}`) as Promise<ApiWrapper<ClusterResponse>>,

  createCluster: (payload: CreateClusterPayload) =>
    axiosClient.post('/api/cinema-clusters', payload) as Promise<ApiWrapper<ClusterResponse>>,

  updateCluster: (id: number, payload: UpdateClusterPayload) =>
    axiosClient.put(`/api/cinema-clusters/${id}`, payload) as Promise<ApiWrapper<ClusterResponse>>,

  deleteCluster: (id: number) =>
    axiosClient.delete(`/api/cinema-clusters/${id}`) as Promise<ApiWrapper<void>>,

  /** DRAFT → PENDING_REVIEW */
  submitCluster: (id: number) =>
    axiosClient.post(`/api/cinema-clusters/${id}/submit`) as Promise<ApiWrapper<ClusterResponse>>,

  /** PENDING_REVIEW → ACTIVE */
  approveCluster: (id: number) =>
    axiosClient.post(`/api/cinema-clusters/${id}/approve`) as Promise<ApiWrapper<ClusterResponse>>,

  /** PENDING_REVIEW → DRAFT + rejectionNote */
  rejectCluster: (id: number, note: string) =>
    axiosClient.post(`/api/cinema-clusters/${id}/reject`, { note }) as Promise<ApiWrapper<ClusterResponse>>,

  getRoomsByCluster: async (clusterId: number) => {
    const response = await axiosClient.get(`/api/cinema-rooms?clusterId=${clusterId}`) as ApiWrapper<RoomApiResponse[]>;
    return { ...response, result: (response.result ?? []).map(toLegacyRoom) } as ApiWrapper<RoomResponse[]>;
  },

  // ── Cinema Room creation wizard ───────────────────────────────────────────

  getRoomMasterData: () =>
    axiosClient.get('/api/cinema-room-master-data') as Promise<ApiWrapper<CinemaRoomMasterData>>,

  getRoomDetail: (roomId: number) =>
    axiosClient.get(`/api/cinema-rooms/${roomId}`) as Promise<ApiWrapper<CinemaRoomDetail>>,

  /** Creates a DRAFT room (step 1) + an empty layout v1 shell. */
  createRoomDraft: (payload: CreateRoomWizardPayload) =>
    axiosClient.post('/api/cinema-rooms', payload) as Promise<ApiWrapper<CinemaRoomDetail>>,

  /** Step 1/2 partial update — only while the room is DRAFT. */
  updateRoomDraft: (roomId: number, payload: UpdateRoomWizardPayload) =>
    axiosClient.put(`/api/cinema-rooms/${roomId}`, payload) as Promise<ApiWrapper<CinemaRoomDetail>>,

  getRoomLayouts: (roomId: number) =>
    axiosClient.get(`/api/cinema-rooms/${roomId}/layouts`) as Promise<ApiWrapper<RoomLayoutSummary[]>>,

  getRoomLayout: (roomId: number, layoutId: number) =>
    axiosClient.get(`/api/cinema-rooms/${roomId}/layouts/${layoutId}`) as Promise<ApiWrapper<RoomLayoutDetail>>,

  saveRoomLayout: (roomId: number, layoutId: number, payload: RoomLayoutSavePayload) =>
    axiosClient.put(`/api/cinema-rooms/${roomId}/layouts/${layoutId}`, payload) as Promise<ApiWrapper<RoomLayoutDetail>>,

  /** DRAFT → PENDING_APPROVAL */
  submitRoomLayout: (roomId: number, layoutId: number) =>
    axiosClient.post(`/api/cinema-rooms/${roomId}/layouts/${layoutId}/submit`) as Promise<ApiWrapper<RoomLayoutDetail>>,

  /** PENDING_APPROVAL → APPROVED (ADMIN only) */
  approveRoomLayout: (roomId: number, layoutId: number) =>
    axiosClient.post(`/api/cinema-rooms/${roomId}/layouts/${layoutId}/approve`) as Promise<ApiWrapper<RoomLayoutDetail>>,

  /** PENDING_APPROVAL → DRAFT + rejectionReason (ADMIN only) */
  rejectRoomLayout: (roomId: number, layoutId: number, note: string) =>
    axiosClient.post(`/api/cinema-rooms/${roomId}/layouts/${layoutId}/reject`, { note }) as Promise<ApiWrapper<RoomLayoutDetail>>,

  /** APPROVED → ACTIVE — syncs Seat table (ADMIN only) */
  activateRoomLayout: (roomId: number, layoutId: number) =>
    axiosClient.post(`/api/cinema-rooms/${roomId}/layouts/${layoutId}/activate`) as Promise<ApiWrapper<RoomLayoutDetail>>,

  /** Clones an APPROVED/ACTIVE/REJECTED/SUPERSEDED version into a new DRAFT version+1 */
  cloneRoomLayout: (roomId: number, layoutId: number) =>
    axiosClient.post(`/api/cinema-rooms/${roomId}/layouts/${layoutId}/clone`) as Promise<ApiWrapper<RoomLayoutDetail>>,
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
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
