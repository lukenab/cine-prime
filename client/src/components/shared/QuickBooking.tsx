import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Clock3,
  LoaderCircle,
  MapPin,
  Ticket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { movieApi, type ClusterResponse } from "../../api/movieApi";
import { showtimeApi, type ShowtimeResponse } from "../../api/showtimeApi";

const BOOKABLE_STATUSES = new Set(["ON_SALE"]);

type BookingOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type BookingDropdownProps = {
  id: string;
  value: string;
  options: BookingOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function BookingDropdown({ id, value, options, placeholder, disabled = false, onChange }: BookingDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white/[0.05] px-3 text-left text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-35 ${
          open ? "border-blue-400/80 ring-2 ring-blue-400/10" : "border-white/10 hover:border-white/25"
        } ${selectedOption ? "text-white" : "text-white/35"}`}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={id}
          className="nice-scrollbar absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-[#181818] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.65)]"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-white/35">No options available</div>
          ) : (
            options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    option.disabled
                      ? "cursor-not-allowed text-white/20 line-through"
                      : selected
                        ? "bg-blue-600 text-white font-bold"
                        : "text-white/75 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function readSavedCluster(): ClusterResponse | null {
  try {
    const saved = localStorage.getItem("cp_cluster");
    return saved ? (JSON.parse(saved) as ClusterResponse) : null;
  } catch {
    return null;
  }
}

function formatPrice(price?: number) {
  if (price == null) return null;
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

function getDurationMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;
  return end - start;
}

function isFutureShowtime(showtime: ShowtimeResponse, selectedDate: string) {
  if (selectedDate !== format(new Date(), "yyyy-MM-dd")) return true;

  const nowTime = format(new Date(), "HH:mm:ss");
  return showtime.startTime >= nowTime;
}

export function QuickBooking() {
  const navigate = useNavigate();
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(new Date(), index)), []);

  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState(format(dates[0], "yyyy-MM-dd"));
  const [selectedMovieId, setSelectedMovieId] = useState<number | "">("");
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([movieApi.getClusters(), showtimeApi.getShowtimes()])
      .then(([clusterResponse, showtimeResponse]) => {
        if (!active) return;

        const activeClusters = (clusterResponse.result ?? []).filter((cluster) => cluster.status === "ACTIVE");
        const availableShowtimes = (showtimeResponse.result ?? []).filter(
          (showtime) => BOOKABLE_STATUSES.has(showtime.status)
        );

        setClusters(activeClusters);
        setShowtimes(availableShowtimes);

        const savedCluster = readSavedCluster();
        if (savedCluster && activeClusters.some((cluster) => cluster.clusterId === savedCluster.clusterId)) {
          setSelectedClusterId(savedCluster.clusterId);
        }
      })
      .catch(() => {
        if (active) setError("Quick booking is temporarily unavailable. Please try again shortly.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.clusterId === selectedClusterId) ?? null,
    [clusters, selectedClusterId]
  );

  const dateShowtimes = useMemo(() => {
    if (!selectedCluster || !selectedDate) return [];

    return showtimes
      .filter((showtime) => {
        const belongsToCluster = showtime.clusterId != null
          ? showtime.clusterId === selectedCluster.clusterId
          : showtime.clusterName === selectedCluster.clusterName;

        return belongsToCluster
          && showtime.showDate === selectedDate
          && isFutureShowtime(showtime, selectedDate);
      })
      .sort((first, second) => first.startTime.localeCompare(second.startTime));
  }, [selectedCluster, selectedDate, showtimes]);

  const movies = useMemo(() => {
    const uniqueMovies = new Map<number, string>();
    dateShowtimes.forEach((showtime) => uniqueMovies.set(showtime.movieId, showtime.movieName));
    return Array.from(uniqueMovies, ([movieId, movieName]) => ({ movieId, movieName }));
  }, [dateShowtimes]);

  const movieShowtimes = useMemo(
    () => dateShowtimes.filter((showtime) => showtime.movieId === selectedMovieId),
    [dateShowtimes, selectedMovieId]
  );

  const selectedShowtime = useMemo(
    () => showtimes.find((showtime) => showtime.showTimeId === selectedShowtimeId) ?? null,
    [selectedShowtimeId, showtimes]
  );

  const selectedMovie = useMemo(
    () => movies.find((movie) => movie.movieId === selectedMovieId) ?? null,
    [movies, selectedMovieId]
  );

  function selectCluster(value: string) {
    const clusterId = value ? Number(value) : "";
    const cluster = clusters.find((item) => item.clusterId === clusterId) ?? null;

    setSelectedClusterId(clusterId);
    setSelectedMovieId("");
    setSelectedShowtimeId("");

    if (cluster) {
      localStorage.setItem("cp_cluster", JSON.stringify(cluster));
      localStorage.setItem("cp_province", cluster.province);
    } else {
      localStorage.removeItem("cp_cluster");
      localStorage.removeItem("cp_province");
    }
  }

  function selectDate(value: string) {
    setSelectedDate(value);
    setSelectedMovieId("");
    setSelectedShowtimeId("");
  }

  function selectMovie(value: string) {
    setSelectedMovieId(value ? Number(value) : "");
    setSelectedShowtimeId("");
  }

  function continueToSeats() {
    if (!selectedShowtime || !selectedCluster || !selectedMovie) return;

    navigate(`/booking/${selectedShowtime.showTimeId}`, {
      state: {
        showtime: {
          movieTitle: selectedMovie.movieName,
          cinemaName: selectedCluster.clusterName,
          hall: selectedShowtime.cinemaRoomName,
          dateTime: `${selectedShowtime.showDate}T${selectedShowtime.startTime}`,
          duration: getDurationMinutes(selectedShowtime.startTime, selectedShowtime.endTime),
        },
      },
    });
  }

  if (loading) {
    return (
      <section className="px-4 py-5 sm:px-6" aria-label="Quick booking">
        <div className="mx-auto flex max-w-6xl items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] py-10 text-sm text-white/60">
          <LoaderCircle className="mr-2 animate-spin text-blue-400" size={18} />
          Loading booking options…
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-30 px-4 py-5 sm:px-6" aria-labelledby="quick-booking-title">
      <div className="mx-auto max-w-6xl rounded-2xl border border-blue-400/25 bg-white/[0.03] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.32)] backdrop-blur-sm sm:p-5">
        <div className="mb-4 flex items-center gap-3 text-left">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-[0_8px_22px_rgba(37,99,235,0.3)]">
            <Ticket size={18} />
          </span>
          <div>
            <h2 id="quick-booking-title" className="!m-0 !text-lg !font-bold !text-white">Quick booking</h2>
            <p className="text-xs text-white/40">Choose a cinema to see its available schedule.</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-left text-sm text-red-300" role="alert">{error}</div>
        ) : (
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.35fr_.9fr_1.35fr_1.2fr_auto]">
            <div className="min-w-0 text-left">
              <label htmlFor="quick-booking-cinema" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">
                <MapPin size={13} className="text-blue-400" /> 1. Cinema
              </label>
              <BookingDropdown
                id="quick-booking-cinema"
                value={selectedClusterId === "" ? "" : String(selectedClusterId)}
                placeholder="Select a cinema"
                options={clusters.map((cluster) => ({
                  value: String(cluster.clusterId),
                  label: `${cluster.clusterName} · ${cluster.province}`,
                }))}
                onChange={selectCluster}
              />
            </div>

            <div className="min-w-0 text-left">
              <label htmlFor="quick-booking-date" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">
                <CalendarDays size={13} className="text-blue-400" /> 2. Date
              </label>
              <BookingDropdown
                id="quick-booking-date"
                value={selectedDate}
                disabled={!selectedClusterId}
                placeholder="Select a date"
                options={dates.map((date, index) => ({
                  value: format(date, "yyyy-MM-dd"),
                  label: index === 0 ? "Today" : format(date, "EEE, dd MMM"),
                }))}
                onChange={selectDate}
              />
            </div>

            <div className="min-w-0 text-left">
              <label htmlFor="quick-booking-movie" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">
                <Clapperboard size={13} className="text-blue-400" /> 3. Movie
              </label>
              <BookingDropdown
                id="quick-booking-movie"
                value={selectedMovieId === "" ? "" : String(selectedMovieId)}
                disabled={!selectedClusterId || dateShowtimes.length === 0}
                placeholder={!selectedClusterId
                  ? "Select cinema first"
                  : dateShowtimes.length === 0
                    ? "No movies available"
                    : "Select a movie"}
                options={movies.map((movie) => ({ value: String(movie.movieId), label: movie.movieName }))}
                onChange={selectMovie}
              />
            </div>

            <div className="min-w-0 text-left">
              <label htmlFor="quick-booking-showtime" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">
                <Clock3 size={13} className="text-blue-400" /> 4. Showtime
              </label>
              <BookingDropdown
                id="quick-booking-showtime"
                value={selectedShowtimeId === "" ? "" : String(selectedShowtimeId)}
                disabled={!selectedMovieId || movieShowtimes.length === 0}
                placeholder={selectedMovieId ? "Select a time" : "Select movie first"}
                options={movieShowtimes.map((showtime) => {
                  const soldOut = showtime.availableSeats === 0;
                  const price = formatPrice(showtime.price);
                  return {
                    value: String(showtime.showTimeId),
                    label: `${showtime.startTime.slice(0, 5)} · ${showtime.cinemaRoomName}${price ? ` · ${price}` : ""}${soldOut ? " · Sold out" : ""}`,
                    disabled: soldOut,
                  };
                })}
                onChange={(value) => setSelectedShowtimeId(value ? Number(value) : "")}
              />
            </div>

            <button
              type="button"
              disabled={!selectedShowtime}
              onClick={continueToSeats}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 text-sm font-black text-white shadow-[0_8px_22px_rgba(37,99,235,0.28)] transition hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-30 sm:col-span-2 lg:col-span-1"
            >
              Choose seats <ArrowRight size={16} />
            </button>
          </div>
        )}

        {!error && clusters.length === 0 && (
          <p className="mt-2 text-left text-xs text-amber-300">No active cinema is available.</p>
        )}
      </div>
    </section>
  );
}
