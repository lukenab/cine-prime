import { X } from "lucide-react";
import type { MovieApiResponse } from "../../api/movieApi";

type TrailerMovie = MovieApiResponse & {
  trailerUrl?: string;
};

type Props = {
  movie: TrailerMovie | null;
  onClose: () => void;
};

function toEmbedUrl(url?: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    return url;
  } catch {
    return url;
  }
}

export function TrailerModal({ movie, onClose }: Props) {
  if (!movie) return null;

  const title = movie.movieNameVn || movie.movieNameEnglish || "Trailer phim";
  const embedUrl = toEmbedUrl(movie.trailerUrl);
  const isVideoFile = Boolean(embedUrl && /\.(mp4|webm|ogg)(\?.*)?$/i.test(embedUrl));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#050505] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white/70 transition-colors hover:text-white"
          aria-label="Close trailer"
        >
          <X size={18} />
        </button>

        <div className="aspect-video w-full bg-black">
          {!embedUrl ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-base font-semibold text-white">Trailer is not available yet</p>
              <p className="mt-2 max-w-md text-sm text-white/45">
                Please check back later for the official trailer.
              </p>
            </div>
          ) : isVideoFile ? (
            <video
              src={embedUrl}
              controls
              autoPlay
              className="h-full w-full"
              poster={movie.largeImage || movie.smallImage}
            />
          ) : (
            <iframe
              src={embedUrl}
              title={`${title} trailer`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-white/45">Trailer</p>
        </div>
      </div>
    </div>
  );
}
