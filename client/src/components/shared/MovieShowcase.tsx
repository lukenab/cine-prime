import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { MovieCard, type Movie } from "../../layouts/MovieCard";
import type { MovieApiResponse } from "../../api/movieApi";
import { TrailerModal } from "./TrailerModal";

type Props = {
  movies: MovieApiResponse[];
  loading?: boolean;
  error?: string;
};

type ShelfTone = "now" | "soon";

type MovieShelfProps = {
  title: string;
  description: string;
  movies: MovieApiResponse[];
  cardMovies: Movie[];
  tone: ShelfTone;
  loading: boolean;
  emptyMessage: string;
  onTrailer: (movie: MovieApiResponse) => void;
};

function formatDuration(minutes?: number): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
}

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return "TBA";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toCardMovie(movie: MovieApiResponse, comingSoon: boolean): Movie {
  return {
    id: movie.movieId,
    title: movie.movieNameEnglish || movie.movieNameVn || "Untitled Movie",
    genre: movie.movieType?.[0] || "Cinema",
    duration: formatDuration(movie.duration),
    image: movie.largeImage || movie.smallImage,
    badge: comingSoon ? undefined : (movie.movieId % 2 === 0 ? "NEW" : "HOT"),
    badgeColor: movie.movieId % 2 === 0 ? "#8B5CF6" : "#F97316",
    releaseLabel: comingSoon ? formatReleaseDate(movie.releaseDate) : undefined,
    trailerUrl: movie.trailerUrl,
  };
}

function MovieShelf({
  title,
  description,
  movies,
  cardMovies,
  tone,
  loading,
  emptyMessage,
  onTrailer,
}: MovieShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const isNowShowing = tone === "now";
  const accent = isNowShowing
    ? { color: "#EF4444", soft: "rgba(239,68,68,0.12)", line: "rgba(239,68,68,0.3)" }
    : { color: "#A855F7", soft: "rgba(139,92,246,0.13)", line: "rgba(168,85,247,0.3)" };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateScrollState = () => {
      const maximumScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      setCanScroll(maximumScroll > 1);
      setAtStart(element.scrollLeft <= 1);
      setAtEnd(element.scrollLeft >= maximumScroll - 1);
    };
    updateScrollState();
    window.addEventListener("resize", updateScrollState);

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState);
    observer?.observe(element);

    return () => {
      window.removeEventListener("resize", updateScrollState);
      observer?.disconnect();
    };
  }, [cardMovies.length, loading]);

  const scroll = (direction: "left" | "right") => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = Math.max(240, element.clientWidth * 0.8);
    element.scrollBy({ left: direction === "left" ? -distance : distance, behavior: "smooth" });
  };

  return (
    <div className={isNowShowing ? "" : "border-t border-white/[0.08] pt-14"}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: accent.soft, border: `1px solid ${accent.line}` }}
          >
            {isNowShowing
              ? <Flame size={19} style={{ color: accent.color }} />
              : <Calendar size={19} style={{ color: accent.color }} />}
          </span>
          <div>
            <h2 className="text-[1.6rem] font-extrabold leading-tight text-white">{title}</h2>
            <p className="mt-0.5 text-xs text-white/45">
              {loading ? "Loading movies..." : description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canScroll && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={atStart}
                aria-label={`Scroll ${title} left`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white transition hover:scale-105 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={atEnd}
                aria-label={`Scroll ${title} right`}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
                style={{ backgroundColor: accent.color }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex gap-5 overflow-hidden" aria-label={`Loading ${title}`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="shrink-0 animate-pulse rounded-2xl bg-white/[0.055]"
              style={{ width: 240, height: 360 }}
            />
          ))}
        </div>
      )}

      {!loading && cardMovies.length === 0 && (
        <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] text-sm text-white/45">
          {emptyMessage}
        </div>
      )}

      {!loading && cardMovies.length > 0 && (
        <div
          ref={scrollRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            const maximumScroll = Math.max(0, element.scrollWidth - element.clientWidth);
            setAtStart(element.scrollLeft <= 1);
            setAtEnd(element.scrollLeft >= maximumScroll - 1);
          }}
          className="flex overflow-x-auto pb-4"
          style={{ gap: 20, scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {cardMovies.map((movie, index) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              variant="standard"
              comingSoon={!isNowShowing}
              onTrailer={() => onTrailer(movies[index])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MovieShowcase({ movies, loading = false, error = "" }: Props) {
  const [trailerMovie, setTrailerMovie] = useState<MovieApiResponse | null>(null);

  const nowShowing = useMemo(() => movies.filter((movie) => movie.displayStatus === "NOW_SHOWING"), [movies]);
  const comingSoon = useMemo(() => movies.filter((movie) => movie.displayStatus === "COMING_SOON"), [movies]);
  const nowShowingCards = useMemo(() => nowShowing.map((movie) => toCardMovie(movie, false)), [nowShowing]);
  const comingSoonCards = useMemo(() => comingSoon.map((movie) => toCardMovie(movie, true)), [comingSoon]);

  return (
    <section className="pb-16">
      <div className="mx-auto max-w-7xl space-y-14 px-6">
        {error && !loading && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!error && (
          <>
            <MovieShelf
              title="Now Showing"
              description={`${nowShowingCards.length} movies available this week`}
              movies={nowShowing}
              cardMovies={nowShowingCards}
              tone="now"
              loading={loading}
              emptyMessage="No movies are available yet."
              onTrailer={setTrailerMovie}
            />
            <MovieShelf
              title="Coming Soon"
              description="Plan your next cinema visit"
              movies={comingSoon}
              cardMovies={comingSoonCards}
              tone="soon"
              loading={loading}
              emptyMessage="No upcoming movies yet."
              onTrailer={setTrailerMovie}
            />
          </>
        )}
      </div>

      <TrailerModal movie={trailerMovie} onClose={() => setTrailerMovie(null)} />
    </section>
  );
}
