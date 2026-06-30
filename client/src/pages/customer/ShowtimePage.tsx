import { useState, useEffect, useMemo } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { movieApi, MovieApiResponse, ShowTimeResponse, toDateStr } from "../../api/movieApi";
import {
  ChevronLeft,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  Armchair,
  Calendar,
  Ticket,
  AlertTriangle,
  Ban,
  CheckCheck,
} from "lucide-react";

/* ─── Helpers ────────────────────────────────────────────── */

function formatTime(t: string | number[] | undefined) {
  if (!t) return "";
  if (Array.isArray(t)) {
    const [h, m] = t;
    const date = new Date();
    date.setHours(h, m, 0);
    return format(date, "h:mm a");
  }
  const [h, m] = String(t).split(":");
  const date = new Date();
  date.setHours(Number(h), Number(m), 0);
  return format(date, "h:mm a");
}

function seatsLabel(available: number, total: number) {
  const pct = available / total;
  if (available === 0) return { label: "Sold Out", color: "text-red-400" };
  if (pct < 0.15) return { label: `${available} left`, color: "text-orange-400" };
  return { label: `${available} / ${total}`, color: "text-emerald-400" };
}

function statusMeta(status: string) {
  switch (status) {
    case "FINISHED":
      return { label: "Ended", icon: CheckCheck, bg: "bg-zinc-800", text: "text-zinc-400" };
    case "CANCELLED":
      return { label: "Cancelled", icon: Ban, bg: "bg-red-950", text: "text-red-400" };
    case "ONGOING":
      return { label: "Now Playing", icon: Clock, bg: "bg-blue-950", text: "text-blue-300" };
    default:
      return null;
  }
}

const isDisabled = (s: string) => s === "FINISHED" || s === "CANCELLED";

/* ─── Sub-components ─────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-28 rounded-md bg-muted" />
        <div className="h-4 w-16 rounded-md bg-muted" />
      </div>
      <div className="h-8 w-20 rounded-md bg-muted" />
      <div className="flex gap-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted" />
      <div className="flex justify-between items-center pt-1">
        <div className="h-5 w-14 rounded bg-muted" />
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

interface ShowtimeCardProps {
  show: ShowTimeResponse;
  onSelect: (id: string) => void;
}

function ShowtimeCard({ show, onSelect }: ShowtimeCardProps) {
  // Use status from API if available; fall back to SCHEDULED
  const status = show.status ?? "SCHEDULED";
  const disabled = isDisabled(status);
  const sm = statusMeta(status);

  return (
    <div
      className={[
        "relative rounded-lg border bg-zinc-900 px-3 py-2.5 flex flex-col gap-1.5 transition-all duration-200 min-w-[150px]",
        disabled
          ? "border-zinc-800 opacity-50 cursor-not-allowed select-none"
          : "border-zinc-800 hover:border-yellow-500/40 hover:bg-zinc-800 hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] cursor-pointer",
      ].join(" ")}
      onClick={() => !disabled && onSelect(String(show.showTimeId))}
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => e.key === "Enter" && !disabled && onSelect(String(show.showTimeId))}
    >
      {/* Status badge — only show when not SCHEDULED */}
      {sm && (
        <span className={`text-[10px] font-bold uppercase tracking-wider ${sm.text}`}>
          {sm.label}
        </span>
      )}

      {/* Time range: start → end */}
      <div className="flex items-center gap-1 flex-wrap">
        <span
          className="font-['Barlow_Condensed'] text-lg font-bold tracking-tight leading-none"
          style={{ color: disabled ? "#71717a" : "#f0f0f8" }}
        >
          {formatTime(show.startTime)}
        </span>
        {show.endTime && (
          <>
            <span className="text-zinc-600 text-xs">→</span>
            <span className="text-zinc-400 text-sm font-medium">
              {formatTime(show.endTime)}
            </span>
          </>
        )}
      </div>

      {/* Price & available seats */}
      <div className="flex items-center gap-2 text-xs">
        {show.price != null ? (
          <span className="text-yellow-500/80 font-semibold">
            {show.price.toLocaleString("vi-VN")}₫
          </span>
        ) : (
          <span className="text-zinc-600 italic">Price TBD</span>
        )}
        {show.availableSeats != null && (
          <>
            <span className="text-zinc-700">·</span>
            <span className={seatsLabel(show.availableSeats, show.totalSeats ?? 100).color}>
              <Armchair size={10} className="inline mr-0.5" />
              {seatsLabel(show.availableSeats, show.totalSeats ?? 100).label}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Cinema section ────────────────────────────────────── */

interface CinemaGroupProps {
  cinemaName: string;
  showtimes: ShowTimeResponse[];
  onSelect: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
}

function CinemaGroup({ cinemaName, showtimes, onSelect, expanded, onToggle }: CinemaGroupProps) {
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  const groupedByRoom = useMemo(() => {
    const map = new Map<string, ShowTimeResponse[]>();
    showtimes.forEach((s) => {
      let roomName = s.cinemaRoomName;
      if (!roomName) {
         const rm = s.showTimeId % 4;
         if (rm === 0) roomName = "IMAX Room";
         else if (rm === 1) roomName = "Room A";
         else if (rm === 2) roomName = "Room B";
         else roomName = "Room C";
      }
      
      if (!map.has(roomName)) map.set(roomName, []);
      map.get(roomName)!.push(s);
    });
    
    // Sort times chronologically
    Array.from(map.values()).forEach(times => {
      times.sort((a, b) => {
        const timeA = String(a.startTime);
        const timeB = String(b.startTime);
        return timeA.localeCompare(timeB);
      });
    });

    const entries = Array.from(map.entries());
    const order = ["IMAX Room", "Room A", "Room B", "Room C"];
    entries.sort((a, b) => {
      let indexA = order.indexOf(a[0]);
      let indexB = order.indexOf(b[0]);
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      return indexA - indexB;
    });

    return entries;
  }, [showtimes]);

  function toggleRoom(roomName: string) {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomName)) next.delete(roomName);
      else next.add(roomName);
      return next;
    });
  }

  return (
    <section className="bg-transparent">
      <div className="flex flex-col">
          {groupedByRoom.map(([roomName, times]) => {
             const isRoomExpanded = expandedRooms.has(roomName);
             return (
               <div key={roomName} className="border-b border-zinc-800/50 last:border-b-0">
                 <button 
                   className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
                   onClick={(e) => { e.stopPropagation(); toggleRoom(roomName); }}
                 >
                   <div className="flex items-center gap-2">
                     <span className="font-semibold text-zinc-200 tracking-wide">{roomName}</span>
                     <span className="text-xs text-zinc-500">({times.length} shows)</span>
                   </div>
                   {isRoomExpanded ? <ChevronUp size={16} className="text-zinc-600" /> : <ChevronDown size={16} className="text-zinc-600" />}
                 </button>
                 {isRoomExpanded && (
                   <div className="px-4 pb-4 flex flex-wrap gap-3">
                     {times.map((show) => (
                       <ShowtimeCard key={show.showTimeId} show={show} onSelect={onSelect} />
                     ))}
                   </div>
                 )}
               </div>
             );
          })}
      </div>
    </section>
  );
}

/* ─── Main App ───────────────────────────────────────────── */

export default function ShowtimePage() {
  const navigate = useNavigate();
  const { movieId } = useParams<{ movieId: string }>();

  const [movie, setMovie] = useState<MovieApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Default to today
  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedCinema, setSelectedCinema] = useState<string>("CinePrime Lê Văn Việt");

  // Fetch movie data
  useEffect(() => {
    setLoading(true);
    movieApi.getAllMovies().then(res => {
      const found = res.result.find(m => m.movieId === Number(movieId));
      if (found) {
        setMovie(found);
      }
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setLoading(false);
    });
  }, [movieId]);

  // Filter showtimes by selected date
  const filteredShowtimes = useMemo(() => {
    if (!movie?.showTimes) return [];
    return movie.showTimes.filter((s) => {
      const showDateStr = toDateStr(s.showDate);
      const selectedDateStr = toDateStr(selectedDate.toISOString());
      return showDateStr === selectedDateStr;
    });
  }, [movie, selectedDate]);

  // We now have two hardcoded cinemas for the demo
  const hasShowtimes = filteredShowtimes.length > 0;

  function handleSelectShowtime(id: string) {
    navigate(`/booking/${id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Skeleton hero */}
        <div className="h-48 bg-zinc-900 animate-pulse" />
        {/* Skeleton filter bar */}
        <div className="h-14 bg-zinc-900/70 border-b border-zinc-800 animate-pulse" />
        {/* Skeleton cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center flex-col gap-4 text-white">
        <AlertTriangle size={32} className="text-red-500" />
        <h2 className="text-xl font-bold">Movie not found!</h2>
        <button className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg" onClick={() => navigate("/")}>
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 text-white font-['DM_Sans',sans-serif]"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#1a1a2e transparent" }}
    >
      {/* ── Movie hero ── */}
      <div className="relative overflow-hidden">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black">
          <img
            src={movie.largeImage || "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1400&h=420&fit=crop"}
            alt="Backdrop"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-background/60 to-background" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          {/* Nav row */}
          <div className="flex items-center gap-3 mb-8">
            <button 
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
              onClick={() => navigate("/")}
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Home
            </button>
          </div>

          {/* Movie info */}
          <div className="flex gap-5 sm:gap-7 items-end">
            <div className="shrink-0 w-24 sm:w-32 rounded-xl overflow-hidden shadow-2xl bg-zinc-900">
              <img
                src={movie.smallImage || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=220&h=330&fit=crop"}
                alt={movie.movieNameEnglish}
                className="w-full aspect-[2/3] object-cover"
              />
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                  {movie.version || "2D"}
                </span>
                <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                  <Star size={11} fill="currentColor" />
                  9.0
                </span>
              </div>
              <h1 className="font-['Barlow_Condensed'] text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-none mb-2">
                {movie.movieNameEnglish}
              </h1>
              <p className="text-zinc-300 text-sm mb-4 max-w-2xl hidden md:block leading-relaxed">
                {movie.content}
              </p>

              <div className="flex flex-col gap-1.5 text-sm text-zinc-400 mb-4 hidden md:flex">
                {movie.director && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-zinc-300 w-20 shrink-0">Director:</span>
                    <span className="text-zinc-400">{movie.director}</span>
                  </div>
                )}
                {movie.actor && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-zinc-300 w-20 shrink-0">Cast:</span>
                    <span className="text-zinc-400">{movie.actor}</span>
                  </div>
                )}
                {movie.movieProductionCompany && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-zinc-300 w-20 shrink-0">Production:</span>
                    <span className="text-zinc-400">{movie.movieProductionCompany}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-yellow-500/90 font-medium">
                <span>{movie.movieType?.join(" · ") || "Action · Sci-Fi"}</span>
                <span className="w-1 h-1 rounded-full bg-yellow-500/50" />
                <span className="flex items-center gap-1"><Clock size={14} /> {movie.duration} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-3 overflow-x-auto no-scrollbar">
            {/* Date pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar size={14} className="text-zinc-500 shrink-0" />
              <div className="flex gap-1.5">
                {dates.map((d) => {
                  const isSelected = isSameDay(d, selectedDate);
                  const isToday = isSameDay(d, today);
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDate(d)}
                      className={[
                        "flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 shrink-0 cursor-pointer",
                        isSelected
                          ? "bg-yellow-500 text-black"
                          : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800",
                      ].join(" ")}
                    >
                      <span className="text-[10px] uppercase tracking-wider leading-none mb-0.5">
                        {isToday ? "Today" : format(d, "EEE")}
                      </span>
                      <span className="text-sm font-bold">{format(d, "d")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Result count */}
            <span className="text-xs text-muted-foreground shrink-0 ml-auto">
              {filteredShowtimes.length} shows
            </span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!hasShowtimes ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-5">
              <AlertTriangle size={24} className="text-muted-foreground" />
            </div>
            <h3 className="font-['Barlow_Condensed'] text-2xl font-bold text-foreground mb-2">
              No showtimes available
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Currently no showtimes scheduled for{" "}
              <span className="text-foreground font-medium">{format(selectedDate, "dd/MM/yyyy")}</span>.
              Please select another date.
            </p>
          </div>
        ) : (
          /* Showtime groups */
          <div>
            {/* Cinema Tabs styled like ShowtimeCards */}
            <div className="flex flex-wrap gap-3 mb-6">
              {["CinePrime Lê Văn Việt", "CinePrime Quang Trung"].map((cinema) => {
                const isSelected = selectedCinema === cinema;
                return (
                  <div
                    key={cinema}
                    className={[
                      "relative rounded-lg border px-4 py-2 flex items-center justify-center transition-all duration-200 cursor-pointer",
                      isSelected 
                        ? "bg-zinc-800 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]" 
                        : "bg-zinc-900 border-zinc-800 hover:border-yellow-500/50 hover:bg-zinc-800/80"
                    ].join(" ")}
                    onClick={() => setSelectedCinema(cinema)}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MapPin size={16} className={isSelected ? "text-yellow-500" : "text-zinc-500"} />
                      <span
                        className="font-['Barlow_Condensed'] text-lg font-bold tracking-tight"
                        style={{ color: isSelected ? "#f0f0f8" : "#a1a1aa" }}
                      >
                        {cinema}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Render the selected cinema's rooms (CinemaGroup handles the inner accordion) */}
            <div className="bg-zinc-950/30 rounded-xl">
              <CinemaGroup
                cinemaName={selectedCinema}
                showtimes={filteredShowtimes}
                onSelect={handleSelectShowtime}
                expanded={true}
                onToggle={() => {}} // Not toggleable at this level anymore since it's a tab
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
