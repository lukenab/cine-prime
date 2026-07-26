import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Armchair,
  CalendarDays,
  ChevronRight,
  Clock3,
  Film,
  Heart,
  Loader2,
  MapPin,
  Ticket,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { movieApi, type ClusterResponse } from "../../api/movieApi";
import { showtimeApi, type ShowtimeResponse } from "../../api/showtimeApi";

const FAVORITE_CINEMAS_KEY = "cp_favorite_clusters";
const CUSTOMER_SALE_WINDOW_DAYS = 7;

function readFavoriteCinemaIds(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITE_CINEMAS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return format(date, "h:mm a");
}

function formatPrice(value?: number) {
  if (value == null) return "Price at checkout";
  return `From ${new Intl.NumberFormat("vi-VN").format(value)}₫`;
}

function isFutureOrNow(showtime: ShowtimeResponse) {
  const startsAt = new Date(`${showtime.showDate}T${showtime.startTime}`);
  return Number.isNaN(startsAt.getTime()) || startsAt.getTime() > Date.now();
}

function belongsToCluster(showtime: ShowtimeResponse, cluster: ClusterResponse) {
  if (showtime.clusterId != null) return showtime.clusterId === cluster.clusterId;
  return showtime.clusterName === cluster.clusterName;
}

export default function CinemaShowtimesPage() {
  const navigate = useNavigate();
  const { clusterId } = useParams<{ clusterId: string }>();
  const numericClusterId = Number(clusterId);

  const [cluster, setCluster] = useState<ClusterResponse | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [favoriteIds, setFavoriteIds] = useState<number[]>(readFavoriteCinemaIds);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dates = useMemo(
    () => Array.from({ length: CUSTOMER_SALE_WINDOW_DAYS }, (_, index) => addDays(new Date(), index)),
    []
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([movieApi.getClusters(), showtimeApi.getShowtimes()])
      .then(([clusterResponse, showtimeResponse]) => {
        if (!active) return;

        const selectedCluster = (clusterResponse.result ?? []).find(
          (item) => item.clusterId === numericClusterId && item.status === "ACTIVE"
        );

        if (!selectedCluster) {
          setError("This cinema is unavailable or no longer active.");
          return;
        }

        const allowedDates = new Set(dates.map((date) => format(date, "yyyy-MM-dd")));
        const publicSessions = (showtimeResponse.result ?? [])
          .filter((showtime) => showtime.status === "ON_SALE")
          .filter((showtime) => belongsToCluster(showtime, selectedCluster))
          .filter((showtime) => allowedDates.has(showtime.showDate))
          .filter(isFutureOrNow)
          .sort((a, b) =>
            `${a.showDate}T${a.startTime}`.localeCompare(`${b.showDate}T${b.startTime}`)
          );

        setCluster(selectedCluster);
        setShowtimes(publicSessions);
        localStorage.setItem("cp_province", selectedCluster.province);
        localStorage.setItem("cp_cluster", JSON.stringify(selectedCluster));

        const firstAvailableDate = publicSessions[0]?.showDate;
        if (firstAvailableDate) setSelectedDate(firstAvailableDate);
      })
      .catch(() => {
        if (active) setError("We could not load this cinema's showtimes. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dates, numericClusterId]);

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    showtimes.forEach((showtime) => {
      counts.set(showtime.showDate, (counts.get(showtime.showDate) ?? 0) + 1);
    });
    return counts;
  }, [showtimes]);

  const moviesForSelectedDate = useMemo(() => {
    const grouped = new Map<number, ShowtimeResponse[]>();
    showtimes
      .filter((showtime) => showtime.showDate === selectedDate)
      .forEach((showtime) => {
        const current = grouped.get(showtime.movieId) ?? [];
        current.push(showtime);
        grouped.set(showtime.movieId, current);
      });

    return Array.from(grouped.entries())
      .map(([movieId, sessions]) => ({
        movieId,
        title: sessions[0].movieName,
        posterUrl: sessions.find((session) => session.moviePosterUrl)?.moviePosterUrl,
        sessions: sessions.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [selectedDate, showtimes]);

  const isFavorite = cluster ? favoriteIds.includes(cluster.clusterId) : false;

  function toggleFavorite() {
    if (!cluster) return;
    setFavoriteIds((current) => {
      const next = current.includes(cluster.clusterId)
        ? current.filter((id) => id !== cluster.clusterId)
        : [...current, cluster.clusterId];
      localStorage.setItem(FAVORITE_CINEMAS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function selectShowtime(showtime: ShowtimeResponse) {
    if ((showtime.availableSeats ?? 1) <= 0) return;
    navigate(`/booking/${showtime.showTimeId}`, {
      state: {
        showtime: {
          movieTitle: showtime.movieName,
          cinemaName: cluster?.clusterName,
          hall: showtime.cinemaRoomName,
          dateTime: `${showtime.showDate}T${showtime.startTime}`,
        },
      },
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] pt-16 text-white/60">
        <Loader2 className="mr-3 animate-spin text-[#FFD700]" size={22} />
        Loading cinema showtimes…
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 pt-16 text-center">
        <AlertCircle className="mb-4 text-[#FFD700]" size={34} />
        <h1 className="text-xl font-bold text-white">Cinema schedule unavailable</h1>
        <p className="mt-2 max-w-md text-sm text-white/50">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/cinemas")}
          className="mt-6 rounded-xl bg-[#FFD700] px-5 py-2.5 text-sm font-bold text-black"
        >
          Browse cinemas
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] pb-20 pt-16 text-white">
      <section className="border-b border-white/10 bg-gradient-to-b from-[#10100d] to-[#050505] px-6 py-9">
        <div className="mx-auto max-w-7xl">
          <button
            type="button"
            onClick={() => navigate("/cinemas")}
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} /> All cinemas
          </button>

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex min-w-0 items-center gap-4">
              <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {cluster.coverImageUrl ? (
                  <img
                    src={cluster.coverImageUrl}
                    alt={cluster.clusterName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#FFD700]">
                    <Film size={26} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">
                  Cinema-first booking
                </p>
                <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{cluster.clusterName}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/45">
                  <MapPin size={14} className="shrink-0" />
                  <span className="truncate">{cluster.address}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={isFavorite}
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors md:self-auto"
              style={{
                color: isFavorite ? "#FFD700" : "rgba(255,255,255,0.7)",
                borderColor: isFavorite ? "rgba(255,215,0,0.45)" : "rgba(255,255,255,0.12)",
                background: isFavorite ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
              }}
            >
              <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
              {isFavorite ? "Favorite cinema" : "Add to favorites"}
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays size={16} className="text-[#FFD700]" />
            <h2 className="text-sm font-bold">Choose a date</h2>
            <span className="ml-auto text-xs text-white/35">Only showtimes open for sale</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {dates.map((date) => {
              const dateKey = format(date, "yyyy-MM-dd");
              const selected = selectedDate === dateKey;
              const count = countsByDate.get(dateKey) ?? 0;
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className="min-w-[96px] flex-shrink-0 rounded-xl border px-3 py-2.5 text-left transition-colors"
                  style={{
                    borderColor: selected ? "#FFD700" : "rgba(255,255,255,0.1)",
                    background: selected ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.025)",
                  }}
                >
                  <span className="block text-xs font-semibold" style={{ color: selected ? "#FFD700" : "#fff" }}>
                    {isSameDay(date, new Date()) ? "Today" : format(date, "EEE, d MMM")}
                  </span>
                  <span className="mt-1 block text-[11px] text-white/40">
                    {count ? `${count} showtimes` : "No sessions"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {moviesForSelectedDate.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/15 px-6 py-20 text-center">
            <CalendarDays className="mx-auto mb-4 text-white/25" size={32} />
            <h2 className="text-lg font-bold">No tickets on sale for this date</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
              Try another date. Internal or draft schedules are intentionally hidden from customers.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-extrabold">Movies at this cinema</h2>
              <p className="mt-1 text-sm text-white/40">
                {format(parseISO(selectedDate), "EEEE, d MMMM")} · {moviesForSelectedDate.length} movies
              </p>
            </div>

            {moviesForSelectedDate.map((movie) => (
              <article
                key={movie.movieId}
                className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-[112px_1fr]"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/showtime/${movie.movieId}?clusterId=${cluster.clusterId}`)}
                  className="aspect-[2/3] w-28 overflow-hidden rounded-xl bg-white/5"
                  aria-label={`View ${movie.title}`}
                >
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt={movie.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-white/25">
                      <Film size={26} />
                    </span>
                  )}
                </button>

                <div className="min-w-0 py-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate(`/showtime/${movie.movieId}?clusterId=${cluster.clusterId}`)}
                        className="text-left text-lg font-bold transition-colors hover:text-[#FFD700]"
                      >
                        {movie.title}
                      </button>
                      <p className="mt-1 text-xs text-white/40">
                        {movie.sessions.length} showtimes · Select a time to choose seats
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/showtime/${movie.movieId}?clusterId=${cluster.clusterId}`)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#FFD700]"
                    >
                      Movie details <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {movie.sessions.map((showtime) => {
                      const soldOut = (showtime.availableSeats ?? 1) <= 0;
                      return (
                        <button
                          key={showtime.showTimeId}
                          type="button"
                          disabled={soldOut}
                          onClick={() => selectShowtime(showtime)}
                          className="min-w-[168px] rounded-xl border px-3.5 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45"
                          style={{
                            borderColor: "rgba(255,215,0,0.25)",
                            background: "rgba(255,215,0,0.045)",
                          }}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <strong className="text-sm text-white">{formatTime(showtime.startTime)}</strong>
                            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-[#FFD700]">
                              {showtime.formatCode ?? "2D"}
                            </span>
                          </span>
                          <span className="mt-1.5 flex items-center gap-1 text-[11px] text-white/45">
                            <Clock3 size={11} /> {formatTime(showtime.endTime)} · {showtime.cinemaRoomName}
                          </span>
                          <span className="mt-2 grid gap-1 text-[11px]">
                            <span className="flex items-center gap-1 text-white/50">
                              <Ticket size={11} /> {formatPrice(showtime.price)}
                            </span>
                            <span className={`flex items-center gap-1 ${soldOut ? "text-red-400" : "text-emerald-400"}`}>
                              <Armchair size={11} />
                              {soldOut ? "Sold out" : `${showtime.availableSeats ?? "—"} seats available`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
