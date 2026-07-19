export type MovieIdentity = { movieId: number };
export type ApiResult<T> = { result: T };

type PersistMovieDraftOptions<TPayload, TMovie extends MovieIdentity> = {
  movieId: number | null;
  payload: TPayload;
  createMovie: (payload: TPayload) => Promise<ApiResult<TMovie>>;
  updateMovie: (movieId: number, payload: TPayload) => Promise<ApiResult<TMovie>>;
};

/** Selects create/update without mixing persistence with a lifecycle transition. */
export async function persistMovieDraft<TPayload, TMovie extends MovieIdentity>({
  movieId,
  payload,
  createMovie,
  updateMovie,
}: PersistMovieDraftOptions<TPayload, TMovie>): Promise<TMovie> {
  const response = movieId == null
    ? await createMovie(payload)
    : await updateMovie(movieId, payload);
  return response.result;
}

type SaveThenSubmitOptions<TMovie extends MovieIdentity> = {
  saveDraft: () => Promise<TMovie>;
  submitForReview: (movieId: number) => Promise<ApiResult<TMovie>>;
  onDraftSaved?: (movie: TMovie) => void;
};

/** Guarantees that submit is never attempted until the latest draft save succeeds. */
export async function saveDraftThenSubmit<TMovie extends MovieIdentity>({
  saveDraft,
  submitForReview,
  onDraftSaved,
}: SaveThenSubmitOptions<TMovie>): Promise<TMovie> {
  const savedMovie = await saveDraft();
  onDraftSaved?.(savedMovie);
  const response = await submitForReview(savedMovie.movieId);
  return response.result;
}
