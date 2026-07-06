import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Play, Plus, Check, ThumbsUp, Volume2, VolumeX, Ticket, Star, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MovieApiResponse } from "../../api/movieApi";

type Props = {
  movie: MovieApiResponse | null;
  onClose: () => void;
};

function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ||
    url.match(/youtu\.be\/([\w-]{6,})/) ||
    url.match(/\/embed\/([\w-]{6,})/);
  return m?.[1] ?? null;
}

function releaseYear(movie: MovieApiResponse): string {
  const raw = movie.showTimes?.[0]?.showDate ?? movie.createAt;
  if (Array.isArray(raw)) return String(raw[0]);
  const s = String(raw ?? "");
  const y = s.match(/\d{4}/);
  return y ? y[0] : "";
}

function formatDuration(min?: number) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function MoviePreviewModal({ movie, onClose }: Props) {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);
  // Fallback backdrop cycling when there is no trailer.
  const [bgIdx, setBgIdx] = useState(0);

  const vid = youtubeId(movie?.trailerUrl);
  const gallery =
    movie?.gallery && movie.gallery.length > 0
      ? movie.gallery
      : ([movie?.largeImage, movie?.smallImage].filter(Boolean) as string[]);

  // Esc + scroll lock.
  useEffect(() => {
    if (!movie) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [movie, onClose]);

  // Reset per movie.
  useEffect(() => {
    setMuted(true);
    setAdded(false);
    setLiked(false);
    setBgIdx(0);
  }, [movie?.movieId]);

  // Cycle backdrops only when there's no trailer video.
  useEffect(() => {
    if (!movie || vid || gallery.length <= 1) return;
    const id = setInterval(() => setBgIdx((i) => (i + 1) % gallery.length), 4500);
    return () => clearInterval(id);
  }, [movie, vid, gallery.length]);

  const toggleMute = useCallback(() => {
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.postMessage(
        JSON.stringify({ event: "command", func: muted ? "unMute" : "mute", args: [] }),
        "*"
      );
    }
    setMuted((m) => !m);
  }, [muted]);

  if (!movie) return null;

  const title = movie.movieNameEnglish || movie.movieNameVn || "Untitled Movie";
  const year = releaseYear(movie);
  const embedSrc = vid
    ? `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`
    : null;

  const handleBook = () => {
    onClose();
    navigate(`/showtime/${movie.movieId}`);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm px-4 py-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-xl bg-[#141414] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* ── Hero (trailer / backdrop) ── */}
        <div className="relative w-full overflow-hidden bg-black aspect-video">
          {embedSrc ? (
            <iframe
              ref={iframeRef}
              src={embedSrc}
              title={`${title} — Trailer`}
              className="pointer-events-none absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            gallery.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={title}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = movie.largeImage; }}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                style={{ opacity: i === bgIdx ? 1 : 0 }}
              />
            ))
          )}

          {/* Bottom fade into the card */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/10 to-transparent" />

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#141414]/80 text-white transition-colors hover:bg-[#141414] cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Mute toggle (only with a trailer) */}
          {embedSrc && (
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="absolute bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white transition-colors hover:border-white cursor-pointer"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}

          {/* Title + actions */}
          <div className="absolute bottom-6 left-6 right-20 z-10">
            <h2 className="mb-4 text-2xl sm:text-4xl font-extrabold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
              {title}
            </h2>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleBook}
                className="flex items-center gap-2 rounded-md bg-white px-6 py-2 text-sm font-bold text-black transition-colors hover:bg-white/85 cursor-pointer"
              >
                <Play size={18} fill="#000" /> Book
              </button>
              <button
                onClick={() => setAdded((v) => !v)}
                aria-label="Add to list"
                title="My List"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/50 bg-[#141414]/60 text-white transition-colors hover:border-white cursor-pointer"
              >
                {added ? <Check size={18} /> : <Plus size={18} />}
              </button>
              <button
                onClick={() => setLiked((v) => !v)}
                aria-label="Like"
                title="Rate this"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/50 bg-[#141414]/60 text-white transition-colors hover:border-white cursor-pointer"
              >
                <ThumbsUp size={17} fill={liked ? "#fff" : "none"} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Info ── */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-6 pb-7 pt-2 sm:grid-cols-[1.6fr_1fr] sm:px-8">
          {/* Left */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2.5 text-sm">
              {year && <span className="font-semibold text-[#46d369]">{year}</span>}
              {movie.duration ? <span className="text-white/80">{formatDuration(movie.duration)}</span> : null}
              <span className="rounded border border-white/40 px-1.5 text-[10px] font-semibold text-white/80">HD</span>
              <span className="flex items-center gap-1 rounded bg-[#FFD700]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#FFD700]">
                <Star size={10} fill="#FFD700" /> 9.0
              </span>
              <span className="rounded border border-white/30 px-1.5 text-[11px] text-white/70">
                {movie.version || "2D"}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-white/85">
              {movie.content || "Movie details will be updated soon."}
            </p>
          </div>

          {/* Right */}
          <div className="space-y-3 text-sm">
            {movie.actor && (
              <p className="text-white/50">
                Cast:{" "}
                <span className="text-white/85">{movie.actor}</span>
              </p>
            )}
            {movie.movieType?.length ? (
              <p className="text-white/50">
                Genres:{" "}
                <span className="text-white/85">{movie.movieType.join(", ")}</span>
              </p>
            ) : null}
            {movie.director && (
              <p className="text-white/50">
                Director:{" "}
                <span className="text-white/85">{movie.director}</span>
              </p>
            )}
            {movie.movieProductionCompany && (
              <p className="text-white/50">
                Studio:{" "}
                <span className="text-white/85">{movie.movieProductionCompany}</span>
              </p>
            )}
          </div>

          {/* Full-width CTA */}
          <div className="sm:col-span-2">
            <button
              onClick={handleBook}
              className="group relative mt-1 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFC400] to-[#FFA500] py-3.5 text-[15px] font-bold uppercase tracking-wide text-black shadow-[0_8px_28px_rgba(255,175,0,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(255,175,0,0.55)] cursor-pointer"
            >
              {/* Shine sweep on hover */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
              <Ticket size={18} />
              Book Tickets
              <ChevronRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
