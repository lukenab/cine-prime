import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Image as ImageIcon, RefreshCw } from "lucide-react";
import { movieApi, type MovieResponse } from "../../api/movieApi";
import { MOVIE_CONTENT_STATUS_META, toMovieContentStatus } from "../../utils/movieContentStatus";
import { MovieAvailabilityPanel } from "../../layouts/MovieAvailabilityPanel";

/** Standalone page for the theatrical-availability workflow (release plans per cluster:
 *  create/open/suspend/resume/close). This used to be a passive-looking tab inside
 *  MovieDetailModal, which buried a full CRUD lifecycle tool inside a read-only detail
 *  view. It now lives at its own route so it has room to breathe and is reachable
 *  directly from the movie table ("Manage availability" row action) — see #139. */
export default function MovieAvailabilityPage() {
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const id = movieId ? Number(movieId) : NaN;

  const [movie, setMovie] = useState<MovieResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError("Invalid movie id."); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    movieApi.getMovieById(id)
      .then((res) => { if (!cancelled) setMovie(res.result); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message ?? "Movie not found."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-sub)" }} />
        <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading movie…</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertCircle size={22} style={{ color: "#ef4444" }} />
        <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>{error ?? "Movie not found."}</p>
        <button
          type="button"
          onClick={() => navigate("/admin/movies")}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 transition-all hover:opacity-80"
          style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        >
          <ArrowLeft size={15} /> Back to Movies
        </button>
      </div>
    );
  }

  const contentStatus = toMovieContentStatus(movie.status);
  const status = MOVIE_CONTENT_STATUS_META[contentStatus];
  const posterUrl = movie.images?.find((i) => i.imageType === "POSTER")?.imageUrl ?? movie.posterUrl;
  const vietnameseTitle = movie.translations?.find((translation) => translation.languageCode === "vi")?.title;
  const englishTitle = movie.translations?.find((translation) => translation.languageCode === "en")?.title;
  const displayTitle = vietnameseTitle || englishTitle || movie.originalTitle;
  const alternateTitle = movie.originalTitle !== displayTitle ? movie.originalTitle : undefined;

  return (
    <>
      <header className="mb-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="h-[60px] w-11 flex-shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)", background: "var(--bg-hover)" }}>
            {posterUrl
              ? <img src={posterUrl} alt={displayTitle} className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center" style={{ color: "var(--text-sub)" }}><ImageIcon size={16} /></div>}
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-blue-600">Release plan review</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate" style={{ color: "var(--text-main)", fontWeight: 750, fontSize: "22px", lineHeight: 1.2 }}>
                {displayTitle}
              </h1>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${status.dot}26`, color: status.dot }}>
                {status.label}
              </span>
            </div>
            {alternateTitle && <p className="mt-1 truncate text-xs" style={{ color: "var(--text-sub)" }}>{alternateTitle}</p>}
          </div>
        </div>
      </header>

      {contentStatus === "APPROVED" ? (
        <MovieAvailabilityPanel movieId={movie.movieId} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <AlertCircle size={20} style={{ color: "var(--text-sub)" }} />
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>Availability opens once content is approved.</p>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>This title is currently <strong>{status.label}</strong> — release plans can be created after content approval.</p>
        </div>
      )}
    </>
  );
}
