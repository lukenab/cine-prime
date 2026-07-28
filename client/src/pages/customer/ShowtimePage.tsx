import { addDays, format, isSameDay } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Clock3,
  MapPin,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { movieApi, type ClusterResponse, type MovieApiResponse } from "../../api/movieApi";
import { showtimeApi, type ShowtimeResponse } from "../../api/showtimeApi";
import { TrailerModal } from "../../components/shared/TrailerModal";
import { mockMovies } from "../../data/mockMovies";

const BLUE = "#3b82f6";

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
  audio?: string;
  subtitle?: string;
  sessions: ShowtimeResponse[];
};

function buildPresentationGroups(showtimes: ShowtimeResponse[]): PresentationGroup[] {
  const groups = new Map<string, PresentationGroup>();
  showtimes.forEach((showtime) => {
    const presentation = showtime.formatCode || "2D";
    const audio = showtime.audioLanguageCode;
    const subtitle = showtime.subtitleLanguageCode;
    const key = [presentation, audio ?? "", subtitle ?? ""].join("|");
    const current = groups.get(key) ?? {
      key,
      format: presentation,
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

  const [today] = useState(() => new Date());
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index)), [today]);
  const [selectedDate, setSelectedDate] = useState(today);
  const didAutoSelectDate = useRef(false);

  const [selectedProvince, setSelectedProvince] = useState(
    () => localStorage.getItem("cp_province") ?? "",
  );
  const [selectedCinema, setSelectedCinema] = useState(() => {
    try {
      const saved = localStorage.getItem("cp_cluster");
      return saved ? String(JSON.parse(saved)?.clusterName ?? "") : "";
    } catch {
      return "";
    }
  });

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
          const savedCinema = activeClusters.find((cluster) => cluster.clusterName === selectedCinema);
          if (savedCinema) return getCanonicalCityLabel(savedCinema.province);

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
        : cinemasInProvince[0]?.clusterName ?? ""
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

  const filteredShowtimes = useMemo(
    () => showtimes.filter((showtime) => (
      (!selectedCluster || showtime.clusterId === selectedCluster.clusterId)
      && showtime.showDate === format(selectedDate, "yyyy-MM-dd")
    )),
    [selectedCluster, selectedDate, showtimes],
  );

  const groups = useMemo(() => buildPresentationGroups(filteredShowtimes), [filteredShowtimes]);

  useEffect(() => {
    didAutoSelectDate.current = false;
  }, [selectedCluster?.clusterId]);

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
          movieTitle: movie?.movieNameEnglish || movie?.movieNameVn || "Movie booking",
          cinemaName: showtime.clusterName || selectedCinema,
          hall: showtime.cinemaRoomName,
          dateTime: `${showtime.showDate}T${showtime.startTime}`,
          duration: movie?.duration || 0,
        },
      },
    });
  }

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

  const title = movie.movieNameEnglish || movie.movieNameVn;
  const ageRating = movie.ageRatingCode;
  const primaryCast = movie.actor
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");

  return (
    <div className="min-h-screen bg-[#050914] pt-16 text-white">
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0">
          <img
            src={movie.largeImage || movie.smallImage}
            alt=""
            className="h-full w-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#050914_4%,rgba(5,9,20,.88)_48%,rgba(5,9,20,.62)),linear-gradient(0deg,#050914,transparent_55%)]" />
          <div className="absolute inset-0 bg-blue-600/5" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-6 sm:px-8">
          <div className="grid items-start gap-7 md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="relative mx-auto aspect-[2/3] w-40 overflow-hidden rounded-2xl border border-white/12 shadow-2xl md:mx-0 md:w-[180px]">
              <img
                src={movie.smallImage || movie.largeImage}
                alt={`${title} poster`}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 text-center md:text-left">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
              {movie.movieNameVn && movie.movieNameVn !== title && (
                <p className="mt-1 text-sm text-white/45">{movie.movieNameVn}</p>
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
                <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-white/60 line-clamp-3 md:mx-0">
                  {movie.content}
                </p>
              )}

              <div className="mt-4 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-2 text-left text-xs sm:grid-cols-3">
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
                  <div className="sm:col-span-2">
                    <span className="block uppercase tracking-wide text-white/35">Production</span>
                    <span className="mt-0.5 block font-medium text-white/75">
                      {movie.movieProductionCompany}
                    </span>
                  </div>
                )}
                {primaryCast && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="block uppercase tracking-wide text-white/35">Cast</span>
                    <span className="mt-0.5 block line-clamp-2 font-medium text-white/75">{primaryCast}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                <button
                  type="button"
                  onClick={() => setShowTrailer(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(37,99,235,.24)] transition hover:bg-blue-500"
                >
                  <Play size={14} fill="currentColor" />
                  Watch trailer
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-white/8 bg-[#070c18]/95 shadow-[0_12px_30px_rgba(0,0,0,.2)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(500px,1fr)_220px_300px] xl:items-end">
            <div className="min-w-0">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Date
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] xl:grid xl:grid-cols-7 xl:overflow-visible xl:pb-0">
                {dates.map((date) => {
                  const selected = isSameDay(date, selectedDate);
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={[
                        "min-w-[66px] rounded-xl border px-2 py-2 text-center transition sm:min-w-[70px] xl:min-w-0",
                        selected
                          ? "border-blue-400 bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,.26)]"
                          : "border-white/10 bg-white/[0.035] text-white/55 hover:border-blue-400/40 hover:text-white",
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

            <SelectField label="City" value={selectedProvince} onChange={selectProvince}>
              {provinces.map((province) => (
                <option key={province.key} value={province.label}>{province.label}</option>
              ))}
            </SelectField>

            <SelectField
              label="Cinema"
              value={selectedCinema}
              onChange={selectCinema}
              disabled={cinemasInProvince.length === 0}
            >
              {cinemasInProvince.map((cluster) => (
                <option key={cluster.clusterId} value={cluster.clusterName}>
                  {cluster.clusterName}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-400">
              Select a showtime
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {selectedCinema || "Choose a cinema"}
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
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]">
            {groups.map((group) => (
              <article key={group.key} className="grid gap-4 border-b border-white/8 p-5 last:border-b-0 md:grid-cols-[190px_minmax(0,1fr)] md:items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">{group.format}</h3>
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
                        className="min-w-[88px] rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-base font-bold text-blue-200 transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.025] disabled:text-white/25 disabled:hover:translate-y-0"
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
    </div>
  );
}
