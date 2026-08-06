import { addDays, format, isSameDay } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { movieApi, type ClusterResponse, type MovieApiResponse } from "../../api/movieApi";
import { showtimeApi, type ShowtimeResponse } from "../../api/showtimeApi";
import { TrailerModal } from "../../components/shared/TrailerModal";
import { mockMovies } from "../../data/mockMovies";

const BLUE = "#3b82f6";
// Matches the site's cosmic gradient tokens (cosmic.css --cp-grad-btn) rather
// than inventing a new accent, so the active date pill / hover states read as
// the same brand as the navbar and homepage instead of a one-off palette.
const COSMIC_GRADIENT = "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)";

const CANONICAL_CITY_LABELS: Record<string, string> = {
  "ho chi minh": "TP. Hồ Chí Minh",
};

function getCityKey(value: string | undefined) {
  return (value ?? "")
    .trim()
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(thanh pho|tp)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCanonicalCityLabel(value: string | undefined) {
  const normalizedValue = value?.trim() ?? "";
  return CANONICAL_CITY_LABELS[getCityKey(normalizedValue)] ?? normalizedValue;
}

function formatStartTime(value: string | undefined) {
  if (!value) return "";
  const [hour, minute] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

// Mirrors TrailerModal's toEmbedUrl, but keeps the raw YouTube video id
// (rather than a finished embed URL) so the hero player can also pass
// autoplay/mute/loop params and drive mute state via the postMessage API.
type TrailerEmbed = { kind: "youtube"; id: string } | { kind: "video"; src: string } | null;

function resolveTrailerEmbed(url: string | undefined): TrailerEmbed {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? { kind: "youtube", id } : null;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? { kind: "youtube", id } : null;
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
      return { kind: "video", src: url };
    }
    return null;
  } catch {
    return null;
  }
}

function SelectField({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-[#111827] px-3.5 pr-9 text-sm font-medium text-white outline-none transition focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/45"
        />
      </span>
    </label>
  );
}

function LoadingTimes() {
  return (
    <div className="space-y-4">
      {[0, 1].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-white/8 bg-white/[0.025] p-5">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="mt-4 flex gap-3">
            <div className="h-11 w-20 rounded-xl bg-white/10" />
            <div className="h-11 w-20 rounded-xl bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

type PresentationGroup = {
  key: string;
  format: string;
  cinemaName?: string;
  audio?: string;
  subtitle?: string;
  sessions: ShowtimeResponse[];
};

function buildPresentationGroups(showtimes: ShowtimeResponse[]): PresentationGroup[] {
  const groups = new Map<string, PresentationGroup>();
  showtimes.forEach((showtime) => {
    const presentation = showtime.formatCode || "2D";
    const cinemaName = showtime.clusterName;
    const audio = showtime.audioLanguageCode;
    const subtitle = showtime.subtitleLanguageCode;
    const key = [showtime.clusterId ?? "", presentation, audio ?? "", subtitle ?? ""].join("|");
    const current = groups.get(key) ?? {
      key,
      format: presentation,
      cinemaName,
      audio,
      subtitle,
      sessions: [],
    };
    current.sessions.push(showtime);
    groups.set(key, current);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      sessions: group.sessions.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
    .sort((a, b) => a.format.localeCompare(b.format));
}

export default function ShowtimePage() {
  const navigate = useNavigate();
  const { movieId } = useParams<{ movieId: string }>();
  const [searchParams] = useSearchParams();
  const requestedClusterId = Number(searchParams.get("clusterId"));

  const [movie, setMovie] = useState<MovieApiResponse | null>(null);
  const [movieLoading, setMovieLoading] = useState(true);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [showtimesLoading, setShowtimesLoading] = useState(false);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [showTrailer, setShowTrailer] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  // The hero trailer plays inline and starts automatically — muted, since
  // browsers block unmuted autoplay. These drive the custom mute toggle.
  const [trailerMuted, setTrailerMuted] = useState(true);
  const trailerIframeRef = useRef<HTMLIFrameElement>(null);
  const trailerVideoRef = useRef<HTMLVideoElement>(null);

  const [today] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const didAutoSelectDate = useRef(false);

  const [selectedProvince, setSelectedProvince] = useState(
    () => localStorage.getItem("cp_province") ?? "",
  );
  // Generic Buy Ticket entries must not inherit a stale cinema from a prior
  // visit. An explicit ?clusterId=... still pins the scope.
  const [selectedCinema, setSelectedCinema] = useState("");

  useEffect(() => {
    movieApi
      .getClusters()
      .then((response) => {
        const activeClusters = (response.result ?? []).filter((cluster) => cluster.status === "ACTIVE");
        setClusters(activeClusters);

        const requested = Number.isFinite(requestedClusterId)
          ? activeClusters.find((cluster) => cluster.clusterId === requestedClusterId)
          : undefined;
        if (requested) {
          const cityLabel = getCanonicalCityLabel(requested.province);
          setSelectedProvince(cityLabel);
          setSelectedCinema(requested.clusterName);
          localStorage.setItem("cp_province", cityLabel);
          localStorage.setItem("cp_cluster", JSON.stringify(requested));
          return;
        }

        setSelectedProvince((previous) => {
          const previousKey = getCityKey(previous);
          const previousStillExists = activeClusters.some(
            (cluster) => getCityKey(cluster.province) === previousKey,
          );
          if (previousStillExists) return getCanonicalCityLabel(previous);

          return getCanonicalCityLabel(activeClusters[0]?.province);
        });
      })
      .catch(() => setClusters([]));
    // The saved cinema is intentionally read only during initial hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedClusterId]);

  const provinces = useMemo(() => {
    const cityLabels = new Map<string, string>();
    clusters.forEach((cluster) => {
      const key = getCityKey(cluster.province);
      if (!key || cityLabels.has(key)) return;
      cityLabels.set(key, getCanonicalCityLabel(cluster.province));
    });
    return Array.from(cityLabels, ([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [clusters]);
  const cinemasInProvince = useMemo(
    () => clusters
      .filter((cluster) => getCityKey(cluster.province) === getCityKey(selectedProvince))
      .sort((a, b) => a.clusterName.localeCompare(b.clusterName)),
    [clusters, selectedProvince],
  );

  useEffect(() => {
    setSelectedCinema((previous) => (
      cinemasInProvince.some((cluster) => cluster.clusterName === previous)
        ? previous
        : ""
    ));
  }, [cinemasInProvince]);

  useEffect(() => {
    const id = Number(movieId);
    setMovieLoading(true);

    const fallback = () => mockMovies.find((candidate) => candidate.movieId === id) ?? null;
    movieApi
      .getPublicMovieById(id)
      .then((response) => {
        if (!response.result) {
          setMovie(fallback());
          return;
        }
        const mock = mockMovies.find(
          (candidate) => candidate.movieNameEnglish?.toLowerCase()
            === response.result.movieNameEnglish?.toLowerCase(),
        );
        setMovie({
          ...response.result,
          trailerUrl: response.result.trailerUrl ?? mock?.trailerUrl,
          gallery: response.result.gallery ?? mock?.gallery,
        });
      })
      .catch(() => setMovie(fallback()))
      .finally(() => setMovieLoading(false));
  }, [movieId]);

  useEffect(() => {
    if (!movie) return;
    let mounted = true;
    didAutoSelectDate.current = false;
    setShowtimesLoading(true);
    showtimeApi
      .getByMovie(movie.movieId)
      .then((response) => {
        if (!mounted) return;
        // Backend owns the public ON_SALE boundary. This check is defense in depth
        // for stale gateways or an older service during a rolling deployment.
        setShowtimes((response.result ?? []).filter((showtime) => {
          if (showtime.status !== "ON_SALE") return false;
          const start = new Date(`${showtime.showDate}T${showtime.startTime}`);
          return Number.isNaN(start.getTime()) || start.getTime() > Date.now();
        }));
      })
      .catch(() => mounted && setShowtimes([]))
      .finally(() => mounted && setShowtimesLoading(false));
    return () => {
      mounted = false;
    };
  }, [movie]);

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.clusterName === selectedCinema),
    [clusters, selectedCinema],
  );

  const showtimesInScope = useMemo(
    () => showtimes.filter((showtime) => {
      const cluster = clusters.find((candidate) => candidate.clusterId === showtime.clusterId);
      return (!selectedCluster || showtime.clusterId === selectedCluster.clusterId)
        && (!selectedProvince || getCityKey(cluster?.province) === getCityKey(selectedProvince));
    }),
    [clusters, selectedCluster, selectedProvince, showtimes],
  );

  const dates = useMemo(() => {
    // Keep a useful skeleton window while data is loading. Once loaded, show
    // the next available dates so a movie never opens on an empty day.
    if (!showtimesInScope.length) {
      return Array.from({ length: 7 }, (_, index) => addDays(today, index));
    }
    return Array.from(new Set(showtimesInScope.map((showtime) => showtime.showDate)))
      .sort()
      .slice(0, 7)
      .map((date) => new Date(`${date}T00:00:00`));
  }, [showtimesInScope, today]);

  const filteredShowtimes = useMemo(
    () => showtimesInScope.filter((showtime) => showtime.showDate === format(selectedDate, "yyyy-MM-dd")),
    [selectedDate, showtimesInScope],
  );

  const groups = useMemo(() => buildPresentationGroups(filteredShowtimes), [filteredShowtimes]);

  useEffect(() => {
    didAutoSelectDate.current = false;
  }, [clusters.length, selectedCluster?.clusterId, selectedProvince]);

  useEffect(() => {
    if (didAutoSelectDate.current || showtimesLoading || !selectedCluster) return;
    const visibleDates = new Set(dates.map((date) => format(date, "yyyy-MM-dd")));
    const firstAvailable = showtimes.find(
      (showtime) => showtime.clusterId === selectedCluster.clusterId
        && visibleDates.has(showtime.showDate),
    );
    if (firstAvailable) setSelectedDate(new Date(`${firstAvailable.showDate}T00:00:00`));
    didAutoSelectDate.current = true;
  }, [dates, selectedCluster, showtimes, showtimesLoading]);

  useEffect(() => {
    if (didAutoSelectDate.current || showtimesLoading || !showtimes.length) return;
    const visibleDates = new Set(dates.map((date) => format(date, "yyyy-MM-dd")));
    const firstAvailable = showtimesInScope.find((showtime) => visibleDates.has(showtime.showDate));
    if (firstAvailable) setSelectedDate(new Date(`${firstAvailable.showDate}T00:00:00`));
    didAutoSelectDate.current = true;
  }, [dates, showtimesInScope, showtimesLoading, showtimes.length]);

  function selectProvince(province: string) {
    setSelectedProvince(province);
    localStorage.setItem("cp_province", province);
  }

  function selectCinema(clusterName: string) {
    setSelectedCinema(clusterName);
    const cluster = clusters.find((candidate) => candidate.clusterName === clusterName);
    if (cluster) {
      localStorage.setItem("cp_province", getCanonicalCityLabel(cluster.province));
      localStorage.setItem("cp_cluster", JSON.stringify(cluster));
    }
  }

  function selectShowtime(showtime: ShowtimeResponse) {
    if (showtime.availableSeats === 0) return;
    navigate(`/booking/${showtime.showTimeId}`, {
      state: {
        showtime: {
          movieTitle: movie?.movieNameVn || movie?.movieNameEnglish || "Đặt vé xem phim",
          cinemaName: showtime.clusterName || selectedCinema,
          hall: showtime.cinemaRoomName,
          dateTime: `${showtime.showDate}T${showtime.startTime}`,
          duration: movie?.duration || 0,
          posterUrl: movie?.smallImage || movie?.largeImage,
          ageRatingCode: movie?.ageRatingCode,
        },
      },
    });
  }

  const heroImages = useMemo(() => Array.from(new Set([
    ...(movie?.backdrops ?? []),
    ...(movie?.gallery ?? []),
    movie?.largeImage,
  ].filter((image): image is string => Boolean(image)))), [movie]);

  useEffect(() => {
    setActiveHeroSlide(0);
    if (heroImages.length <= 1) return undefined;
    const interval = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroImages.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [heroImages]);

  if (movieLoading) {
    return <div className="min-h-screen animate-pulse bg-[#050914]" />;
  }

  if (!movie) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050914] text-white">
        <AlertTriangle size={30} className="text-red-400" />
        <h1 className="text-xl font-bold">Movie not found</h1>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500"
        >
          Back to home
        </button>
      </div>
    );
  }

  const title = movie.movieNameVn || movie.movieNameEnglish;
  const alternateTitle = movie.movieNameEnglish && movie.movieNameEnglish !== title
    ? movie.movieNameEnglish
    : null;
  const ageRating = movie.ageRatingCode;
  // Rendered as individual chips now instead of one comma-joined line, so a
  // long cast list wraps like the genre chips above it rather than reading
  // as a dense paragraph.
  const castList = movie.actor
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6) ?? [];

  const trailerEmbed = resolveTrailerEmbed(movie.trailerUrl);

  const toggleTrailerMute = () => {
    const next = !trailerMuted;
    setTrailerMuted(next);
    if (trailerEmbed?.kind === "youtube") {
      // The cropped/scaled iframe can't be controlled with a native mute
      // button, so mute state is driven through the YouTube postMessage API
      // instead of reloading the iframe (which would restart the video).
      trailerIframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: next ? "mute" : "unMute", args: [] }),
        "https://www.youtube.com",
      );
    } else if (trailerEmbed?.kind === "video" && trailerVideoRef.current) {
      trailerVideoRef.current.muted = next;
    }
  };

  return (
    <div
      className="min-h-screen pt-16 text-white"
      style={{
        // A page-wide cosmic wash (not just behind the trailer) so the
        // showtime picker and results list below don't drop back to a flat
        // black once you scroll past the trailer — matches the reference's
        // body background instead of confining "cosmic" to one section.
        background:
          "radial-gradient(ellipse 80% 50% at 15% -10%, rgba(37,99,235,.16), transparent 60%), " +
          "radial-gradient(ellipse 60% 40% at 100% 0%, rgba(56,189,248,.14), transparent 55%), " +
          "#050914",
      }}
    >
      {/* Page-wide twinkling starfield (fixed, sits behind everything) — the
          reference scatters ~90 stars across the whole viewport, not just
          behind the trailer, so the picker/results sections read as cosmic
          too instead of dropping back to flat dark panels. */}
      <div className="cp-stars pointer-events-none fixed inset-0" aria-hidden="true" />

      {/* TRAILER — a standalone showcase, deliberately its own section rather
          than sharing space with the poster/info block. The poster overlaps
          this section's bottom edge from below instead of living inside it. */}
      <section className="relative min-h-[min(56vh,480px)] overflow-hidden border-b border-white/8 bg-[#050914]">
        {trailerEmbed ? (
          <>
            {/* Trailer plays right here, automatically — muted, since
                browsers block unmuted autoplay — instead of requiring a
                click to open a modal. The iframe/video is oversized and
                centered to crop-to-cover the section like a background. */}
            <div className="absolute inset-0 overflow-hidden bg-black">
              {trailerEmbed.kind === "youtube" ? (
                <iframe
                  ref={trailerIframeRef}
                  key={trailerEmbed.id}
                  src={`https://www.youtube.com/embed/${trailerEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${trailerEmbed.id}&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`}
                  title={`${title} trailer`}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 border-0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              ) : (
                <video
                  ref={trailerVideoRef}
                  key={trailerEmbed.src}
                  src={trailerEmbed.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            {/* Light scrim only at the top/bottom edges — enough to keep the
                tag, mute button, and caption legible without dimming the
                whole video like the old static-photo scrim did. */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,20,.5)_0%,transparent_16%,transparent_72%,rgba(5,9,20,.75)_100%)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[#050914]">
            {heroImages.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={image}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === activeHeroSlide ? "opacity-30" : "opacity-0"}`}
              />
            ))}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 22% 28%, rgba(37,99,235,.4), transparent 45%), " +
                  "radial-gradient(circle at 78% 65%, rgba(56,189,248,.32), transparent 50%)",
              }}
            />
            {/* Two slow, faint spinning rings — the orbit motif from the
                reference, kept subtle enough to sit behind real movie artwork
                instead of fighting it. */}
            <div className="showtime-orbit pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
            <div className="showtime-orbit showtime-orbit--reverse pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.045]" />
            <div className="cp-stars absolute inset-0" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#050914_2%,rgba(5,9,20,.9)_38%,rgba(5,9,20,.5)_78%,#050914_100%),linear-gradient(0deg,#050914_8%,rgba(5,9,20,.1)_55%,#050914_100%)]" />
            <div className="cp-nebula" style={{ "--x": "78%", "--y": "-25%" } as React.CSSProperties} />
          </div>
        )}

        {!trailerEmbed && (
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 backdrop-blur-md sm:left-8">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,.8)]" />
            Watch trailer
          </div>
        )}

        {trailerEmbed ? (
          <button
            type="button"
            onClick={toggleTrailerMute}
            aria-label={trailerMuted ? "Unmute trailer" : "Mute trailer"}
            className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur-md transition hover:border-blue-400/50 hover:text-white sm:right-8"
          >
            {trailerMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowTrailer(true)}
            aria-label="Play trailer"
            className="showtime-play-btn absolute left-1/2 top-1/2 z-10 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md transition hover:scale-[1.07] hover:bg-white/[0.16]"
          >
            <span className="showtime-play-ring pointer-events-none absolute inset-0 rounded-full border border-white/30" />
            <Play size={26} className="ml-1 fill-white text-white" />
          </button>
        )}

        {/* Sits well above the poster-overlap zone (max -80px on md) so the
            poster card never clips this caption from below. */}
        <p className="pointer-events-none absolute bottom-24 left-5 z-10 text-sm font-medium text-white/70 sm:left-8">
          {trailerEmbed ? "Now playing — " : "Watching trailer — "}<b className="text-white">{title}</b>
        </p>

        {!trailerEmbed && heroImages.length > 1 && (
          <div className="absolute bottom-24 right-5 z-10 flex items-center gap-2 sm:right-8">
            <button
              type="button"
              aria-label="Previous movie artwork"
              onClick={() => setActiveHeroSlide((activeHeroSlide - 1 + heroImages.length) % heroImages.length)}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/30 text-white/70 backdrop-blur transition hover:border-blue-400/60 hover:text-white"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex items-center gap-1.5" aria-label={`Artwork ${activeHeroSlide + 1} of ${heroImages.length}`}>
              {heroImages.map((image, index) => (
                <button
                  key={`${image}-dot`}
                  type="button"
                  aria-label={`Show artwork ${index + 1}`}
                  onClick={() => setActiveHeroSlide(index)}
                  className={`h-1.5 rounded-full transition-all ${index === activeHeroSlide ? "w-5 bg-blue-400" : "w-1.5 bg-white/35 hover:bg-white/60"}`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next movie artwork"
              onClick={() => setActiveHeroSlide((activeHeroSlide + 1) % heroImages.length)}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/30 text-white/70 backdrop-blur transition hover:border-blue-400/60 hover:text-white"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </section>

      {/* POSTER + INFO — its own plain section. The poster is pulled up with
          a negative margin so it physically overlaps the trailer's bottom
          edge by roughly 15% of its height, instead of the two blending
          into one shared banner like the first pass did. */}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid -mt-12 gap-8 pb-10 sm:-mt-16 md:-mt-20 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
          <div className="relative z-10 mx-auto aspect-[2/3] w-40 overflow-hidden rounded-2xl border border-white/15 bg-[#0b1222] shadow-[0_30px_60px_-20px_rgba(0,0,0,.65),0_0_40px_-6px_rgba(37,99,235,.35)] sm:w-44 md:mx-0 md:w-[220px]">
              <img
                src={movie.smallImage || movie.largeImage}
                alt={`${title} poster`}
                className="h-full w-full object-cover"
              />
              {ageRating && (
                <span className="absolute right-2.5 top-2.5 rounded-md bg-gradient-to-r from-rose-500 to-orange-400 px-2 py-1 text-[11px] font-extrabold tracking-wide text-white shadow-[0_4px_12px_rgba(0,0,0,.35)]">
                  {ageRating}
                </span>
              )}
            </div>

            {/* md:pt-24 compensates for the row's md:-mt-20 (-80px) shift so
                only the poster physically overlaps the trailer above — the
                title/text content still starts safely below the trailer's
                bottom border instead of rendering across it. */}
            <div className="flex min-w-0 flex-col pt-2 text-center md:pt-24 md:text-left">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
              {alternateTitle && (
                <p className="mt-1 text-sm text-white/45">{alternateTitle}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-white/65 md:justify-start">
                <span>{movie.movieType?.join(" · ") || "Movie"}</span>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={14} />
                  {movie.duration} min
                </span>
                {ageRating && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/25" />
                    <span className="inline-flex items-center rounded-md border border-rose-400/35 bg-rose-500/15 px-2 py-0.5 text-xs font-extrabold tracking-wide text-rose-200">
                      {ageRating}
                    </span>
                  </>
                )}
              </div>

              {movie.content && (
                <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-white/65 line-clamp-3 md:mx-0">
                  {movie.content}
                </p>
              )}

              {(movie.releaseDate || movie.country || movie.originalLanguage || movie.director || movie.movieProductionCompany) && (
                <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-white/8 bg-white/[0.025] p-5 text-left text-xs sm:grid-cols-3 md:mx-0">
                  {movie.releaseDate && (
                    <div>
                      <span className="block uppercase tracking-wide text-white/35">Release date</span>
                      <span className="mt-0.5 block font-medium text-white/75">
                        {format(new Date(`${movie.releaseDate}T00:00:00`), "dd/MM/yyyy")}
                      </span>
                    </div>
                  )}
                  {movie.country && (
                    <div>
                      <span className="block uppercase tracking-wide text-white/35">Country</span>
                      <span className="mt-0.5 block font-medium text-white/75">{movie.country}</span>
                    </div>
                  )}
                  {movie.originalLanguage && (
                    <div>
                      <span className="block uppercase tracking-wide text-white/35">Original language</span>
                      <span className="mt-0.5 block font-medium uppercase text-white/75">
                        {movie.originalLanguage}
                      </span>
                    </div>
                  )}
                  {movie.director && (
                    <div>
                      <span className="block uppercase tracking-wide text-white/35">Director</span>
                      <span className="mt-0.5 block font-medium text-white/75">{movie.director}</span>
                    </div>
                  )}
                  {movie.movieProductionCompany && (
                    <div className="col-span-2">
                      <span className="block uppercase tracking-wide text-white/35">Production</span>
                      <span className="mt-0.5 block font-medium text-white/75">
                        {movie.movieProductionCompany}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {castList.length > 0 && (
                <div className="mx-auto mt-4 max-w-3xl text-left md:mx-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/35">Cast</span>
                  <div className="mt-2 flex flex-wrap justify-center gap-2 md:justify-start">
                    {castList.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      {/* Cosmic divider — a glowing dot on a fading line, matching the
          reference's separator between the movie info block and the
          showtime picker instead of the previous sticky glass bar. */}
      <div className="mx-auto flex max-w-6xl items-center gap-3.5 px-5 pt-2 sm:px-8">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
        <span className="h-2 w-2 flex-none rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6]" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
      </div>

      <section id="showtime-picker" className="relative mx-auto max-w-6xl px-5 pb-2 pt-9 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
              Date
            </span>
            <div className="flex flex-wrap gap-2.5">
              {dates.map((date) => {
                const selected = isSameDay(date, selectedDate);
                const hasShowtimes = showtimesInScope.some(
                  (showtime) => showtime.showDate === format(date, "yyyy-MM-dd"),
                );
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    disabled={!hasShowtimes}
                    style={selected ? { background: COSMIC_GRADIENT } : undefined}
                    className={[
                      "min-w-[66px] rounded-xl border px-2 py-2.5 text-center transition",
                      selected
                        ? "border-transparent text-white shadow-[0_10px_26px_-10px_rgba(37,99,235,.65)]"
                        : hasShowtimes
                          ? "border-white/10 bg-white/[0.035] text-white/55 hover:border-blue-400/40 hover:text-white"
                          : "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20",
                    ].join(" ")}
                  >
                    <span className="block text-[10px] font-semibold uppercase tracking-wide">
                      {isSameDay(date, today) ? "Today" : format(date, "EEE")}
                    </span>
                    <span className="mt-0.5 block text-sm font-bold">{format(date, "dd/MM")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="w-[180px]">
              <SelectField label="City" value={selectedProvince} onChange={selectProvince}>
                {provinces.map((province) => (
                  <option key={province.key} value={province.label}>{province.label}</option>
                ))}
              </SelectField>
            </div>

            <div className="w-[210px]">
              <SelectField
                label="Cinema"
                value={selectedCinema}
                onChange={selectCinema}
                disabled={cinemasInProvince.length === 0}
              >
                <option value="">All cinemas</option>
                {cinemasInProvince.map((cluster) => (
                  <option key={cluster.clusterId} value={cluster.clusterName}>
                    {cluster.clusterName}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,.8)]" />
              Select a showtime
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {selectedCinema || `All cinemas in ${selectedProvince || "your city"}`}
            </h2>
            {selectedCluster?.address && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/40">
                <MapPin size={13} />
                {selectedCluster.address}
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
            <CalendarDays size={14} color={BLUE} />
            {format(selectedDate, "EEEE, dd/MM/yyyy")}
          </span>
        </header>

        {showtimesLoading ? (
          <LoadingTimes />
        ) : groups.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
            <CalendarDays size={26} className="text-blue-400" />
            <h3 className="mt-4 text-lg font-bold">No showtimes available</h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-white/40">
              Try another date or cinema. Only sessions currently open for ticket sales are shown.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <article key={group.key} className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition hover:border-blue-400/40 hover:bg-blue-500/[0.05] hover:shadow-[0_16px_40px_-20px_rgba(59,130,246,.4)] md:grid-cols-[190px_minmax(0,1fr)] md:items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <div>
                    {group.cinemaName && !selectedCluster && (
                      <h3 className="text-base font-bold text-white">{group.cinemaName}</h3>
                    )}
                    <p className={group.cinemaName && !selectedCluster
                      ? "mt-0.5 text-xs font-bold uppercase tracking-wide text-blue-400"
                      : "text-base font-bold text-white"}
                    >
                      {group.format}
                    </p>
                  </div>
                  {group.audio && (
                    <span className="rounded-md bg-white/[0.045] px-2 py-1 text-[11px] text-white/45">
                      Audio {group.audio.toUpperCase()}
                    </span>
                  )}
                  {group.subtitle && (
                    <span className="rounded-md bg-white/[0.045] px-2 py-1 text-[11px] text-white/45">
                      Sub {group.subtitle.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {group.sessions.map((session) => {
                    const soldOut = session.availableSeats === 0;
                    return (
                      <button
                        key={session.showTimeId}
                        type="button"
                        disabled={soldOut}
                        onClick={() => selectShowtime(session)}
                        aria-label={`${formatStartTime(session.startTime)} ${group.format}${soldOut ? ", sold out" : ""}`}
                        className="min-w-[88px] rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-base font-bold text-white transition hover:-translate-y-0.5 hover:border-transparent hover:bg-[image:linear-gradient(135deg,#2563eb_0%,#38bdf8_100%)] hover:text-white hover:shadow-[0_10px_24px_-10px_rgba(37,99,235,.65)] focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.025] disabled:text-white/25 disabled:hover:translate-y-0"
                        title={soldOut ? "Sold out" : `Choose ${formatStartTime(session.startTime)}`}
                      >
                        {formatStartTime(session.startTime)}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <TrailerModal movie={showTrailer ? movie : null} onClose={() => setShowTrailer(false)} />

      <style>{`
        @keyframes showtimePlayRing {
          0%   { transform: scale(1);    opacity: .6; }
          100% { transform: scale(1.65); opacity: 0;  }
        }
        @keyframes showtimeOrbitSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .showtime-play-ring { animation: showtimePlayRing 2.4s ease-out infinite; }
        .showtime-orbit { animation: showtimeOrbitSpin 70s linear infinite; }
        .showtime-orbit--reverse { animation-duration: 100s; animation-direction: reverse; }
        @media (prefers-reduced-motion: reduce) {
          .showtime-play-ring,
          .showtime-orbit { animation: none; }
        }
      `}</style>
    </div>
  );
}
