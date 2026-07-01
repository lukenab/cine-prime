import { useState, useEffect, useMemo } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { movieApi, MovieApiResponse, ShowTimeResponse } from "../../api/movieApi";
import {
  ChevronLeft,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Armchair,
  Calendar,
  Ticket,
  AlertTriangle,
  Ban,
  CheckCheck,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────
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

function formatPrice(v: number) {
  return new Intl.NumberFormat("vi-VN").format(v) + "đ";
}

function seatsLabel(available: number, total: number) {
  if (available === 0) return { label: "Sold Out", color: "#f87171" };
  if (available / total < 0.15) return { label: `${available} left`, color: "#fb923c" };
  return { label: `${available}/${total}`, color: "#34d399" };
}

function statusMeta(status: string) {
  switch (status) {
    case "FINISHED":
      return { label: "Ended", Icon: CheckCheck, color: "#a1a1aa", bg: "rgba(113,113,122,0.15)" };
    case "CANCELLED":
      return { label: "Cancelled", Icon: Ban, color: "#f87171", bg: "rgba(248,113,113,0.12)" };
    case "ONGOING":
      return { label: "Now Playing", Icon: Clock, color: "#60a5fa", bg: "rgba(96,165,250,0.12)" };
    default:
      return { label: "Scheduled", Icon: Clock, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
  }
}

const isDisabled = (s: string) => s === "FINISHED" || s === "CANCELLED";

function getMockShowtimesForDateAndCinema(
  movieId: number,
  date: Date,
  cinemaName: string
): (ShowTimeResponse & { showDateTimeISO: string })[] {
  if (date.getDay() === 3) {
    return []; // Empty state demo for Wednesday
  }

  const rooms = ["IMAX", "A", "B", "C"];
  const showtimesByRoom: Record<string, string[]> = cinemaName === "CinePrime Lê Văn Việt" ? {
    "IMAX": ["10:00", "14:30", "19:00"],
    "A": ["09:15", "13:45", "18:30"],
    "B": ["11:30", "16:15", "20:45"],
    "C": ["12:00", "17:00", "21:30"]
  } : {
    "IMAX": ["11:00", "15:30", "20:00"],
    "A": ["10:15", "14:45", "19:30"],
    "B": ["12:30", "17:15", "21:45"],
    "C": ["13:00", "18:00", "22:30"]
  };

  const results: (ShowTimeResponse & { showDateTimeISO: string })[] = [];
  let idCounter = movieId * 1000 + (cinemaName.includes("Việt") ? 100 : 200);

  const dateStr = format(date, "yyyy-MM-dd");

  rooms.forEach((roomName) => {
    const times = showtimesByRoom[roomName] || [];
    times.forEach((timeStr) => {
      const showTimeId = idCounter++;
      const [h, m] = timeStr.split(":");
      
      const startMinutes = parseInt(h) * 60 + parseInt(m);
      const endMinutes = startMinutes + 138;
      const endH = Math.floor(endMinutes / 60) % 24;
      const endM = endMinutes % 60;
      const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

      const isoDateTime = `${dateStr}T${timeStr}:00`;

      let status = "SCHEDULED";
      if (showTimeId % 11 === 0) status = "FINISHED";
      else if (showTimeId % 17 === 0) status = "CANCELLED";
      else if (showTimeId % 5 === 0) status = "ONGOING";

      let available = 80 - (showTimeId % 30);
      if (showTimeId % 4 === 0) available = 0; // trigger sold out
      
      results.push({
        showTimeId,
        showDate: dateStr,
        startTime: `${timeStr}:00`,
        endTime: endTimeStr,
        cinemaRoomId: showTimeId,
        cinemaRoomName: roomName,
        updateAt: new Date().toISOString(),
        status,
        price: roomName === "IMAX" ? 130000 : 90000,
        availableSeats: available,
        totalSeats: roomName === "IMAX" ? 150 : 100,
        showDateTimeISO: isoDateTime
      });
    });
  });

  return results;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-28 rounded-md bg-zinc-800" />
        <div className="h-4 w-16 rounded-md bg-zinc-800" />
      </div>
      <div className="h-8 w-20 rounded-md bg-zinc-800" />
      <div className="flex gap-3">
        <div className="h-3 w-24 rounded bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-800" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800" />
      <div className="flex justify-between items-center pt-1">
        <div className="h-5 w-14 rounded bg-zinc-800" />
        <div className="h-9 w-28 rounded-lg bg-zinc-800" />
      </div>
    </div>
  );
}

// ─── Enriched showtime card ─────────────────────────────────────────────────
interface ShowtimeCardProps {
  show: ShowTimeResponse & { showDateTimeISO?: string };
  onSelect: (show: ShowTimeResponse & { showDateTimeISO?: string }) => void;
}

function ShowtimeCard({ show, onSelect }: ShowtimeCardProps) {
  const status = show.status ?? "SCHEDULED";
  const disabled = isDisabled(status);
  const seat = seatsLabel(show.availableSeats || 0, show.totalSeats || 100);
  const sm = statusMeta(status);

  return (
    <div
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect(show)}
      onKeyDown={(e) => e.key === "Enter" && !disabled && onSelect(show)}
      className={[
        "rounded-xl border p-3.5 transition-all duration-200 min-w-[210px] flex flex-col gap-2.5",
        disabled
          ? "border-zinc-800 bg-zinc-900/40 opacity-50 cursor-not-allowed select-none"
          : "border-zinc-800 bg-zinc-900 hover:border-blue-500/50 hover:bg-zinc-800/70 hover:shadow-[0_0_18px_rgba(59,130,246,0.15)] cursor-pointer",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-[15px]" style={{ color: disabled ? "#71717a" : "#f0f0f8" }}>
          {formatTime(show.startTime)} <span className="text-zinc-500 font-normal">— {formatTime(show.endTime)}</span>
        </span>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: sm.color, background: sm.bg }}
        >
          <sm.Icon size={11} /> {sm.label}
        </span>
      </div>

      <div className="h-px bg-zinc-800" />

      <div className="flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <Ticket size={13} className="text-zinc-500" />
          {formatPrice(show.price || 90000)}
        </span>
        <span className="flex items-center gap-1.5 font-medium" style={{ color: seat.color }}>
          <Armchair size={13} />
          {seat.label}
        </span>
      </div>
    </div>
  );
}

// ─── Cinema → room accordion ────────────────────────────────────────────────
interface CinemaGroupProps {
  showtimes: (ShowTimeResponse & { showDateTimeISO?: string })[];
  onSelect: (show: ShowTimeResponse & { showDateTimeISO?: string }) => void;
}

function CinemaGroup({ showtimes, onSelect }: CinemaGroupProps) {
  const [open, setOpen] = useState<Set<string>>(new Set(["IMAX"]));

  const byRoom = useMemo(() => {
    const map = new Map<string, (ShowTimeResponse & { showDateTimeISO?: string })[]>();
    showtimes.forEach((s) => {
      let roomName = s.cinemaRoomName;
      if (!roomName) {
         const rm = s.showTimeId % 4;
         if (rm === 0) roomName = "IMAX";
         else if (rm === 1) roomName = "A";
         else if (rm === 2) roomName = "B";
         else roomName = "C";
      }
      if (!map.has(roomName)) map.set(roomName, []);
      map.get(roomName)!.push(s);
    });
    
    const order = ["IMAX", "A", "B", "C"];
    return Array.from(map.entries())
      .sort((a, b) => {
        let indexA = order.indexOf(a[0]);
        let indexB = order.indexOf(b[0]);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
      })
      .map(([room, list]) => {
         return [room, list.sort((x, y) => String(x.startTime).localeCompare(String(y.startTime)))] as const;
      });
  }, [showtimes]);

  const toggle = (room: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(room) ? n.delete(room) : n.add(room);
      return n;
    });

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/60 bg-transparent">
      {byRoom.map(([room, list]) => {
        const expanded = open.has(room);
        return (
          <div key={room}>
            <button
              onClick={() => toggle(room)}
              className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="font-semibold text-zinc-200 tracking-wide">ROOM {room}</span>
                <span className="text-xs text-zinc-500">({list.length} shows)</span>
              </span>
              {expanded ? <ChevronUp size={16} className="text-zinc-600" /> : <ChevronDown size={16} className="text-zinc-600" />}
            </button>
            {expanded && (
              <div className="px-4 pb-4 flex flex-wrap gap-3">
                {list.map((s) => (
                  <ShowtimeCard key={s.showTimeId} show={s} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ShowtimePage() {
  const navigate = useNavigate();
  const { movieId } = useParams<{ movieId: string }>();

  const [movie, setMovie] = useState<MovieApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedCinema, setSelectedCinema] = useState<string>("CinePrime Lê Văn Việt");
  const CINEMAS = ["CinePrime Lê Văn Việt", "CinePrime Quang Trung"];

  const [showSoldOutModal, setShowSoldOutModal] = useState(false);

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

  const filteredShowtimes = useMemo(() => {
    if (!movie) return [];
    return getMockShowtimesForDateAndCinema(movie.movieId, selectedDate, selectedCinema);
  }, [movie, selectedDate, selectedCinema]);

  const hasShowtimes = filteredShowtimes.length > 0;

  function handleSelectShowtime(show: ShowTimeResponse & { showDateTimeISO?: string }) {
    if ((show.availableSeats || 0) === 0) {
      setShowSoldOutModal(true);
      return;
    }
    navigate(`/booking/${show.showTimeId}`, {
      state: {
        showtime: {
          movieTitle: movie?.movieNameEnglish || movie?.movieNameVn || "Movie Booking",
          cinemaName: selectedCinema,
          hall: show.cinemaRoomName,
          dateTime: show.showDateTimeISO,
          duration: movie?.duration || 120,
        }
      }
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="h-48 bg-zinc-900 animate-pulse" />
        <div className="h-14 bg-zinc-900/70 border-b border-zinc-800 animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 py-8">
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
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg" onClick={() => navigate("/")}>
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      {/* ── Movie hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <img
            src={movie.largeImage || "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1400&h=420&fit=crop"}
            alt="Backdrop"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-zinc-950/80 to-zinc-950" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <button 
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors group cursor-pointer"
              onClick={() => navigate("/")}
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Home
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {movie.version || "2D"}
            </span>
            <span className="text-blue-400 text-xs font-medium">★ 9.0</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-1">
            {movie.movieNameEnglish}
          </h1>
          <p className="text-zinc-400 text-sm flex items-center gap-2">
            {movie.movieType?.join(" · ") || "Sci-Fi · Action"} 
            <span className="w-1 h-1 rounded-full bg-zinc-600" /> 
            <Clock size={13} /> {movie.duration} min
          </p>
        </div>
      </div>

      {/* ── Date filter ── */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur border-y border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Calendar size={15} className="text-zinc-500 shrink-0" />
          {dates.map((d) => {
            const active = isSameDay(d, selectedDate);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className={[
                  "flex flex-col items-center px-3 py-1.5 rounded-lg text-xs shrink-0 transition-all cursor-pointer",
                  active ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white",
                ].join(" ")}
              >
                <span className="text-[10px] uppercase tracking-wider">{isSameDay(d, today) ? "Today" : format(d, "EEE")}</span>
                <span className="text-sm font-bold">{format(d, "d")}</span>
              </button>
            );
          })}
          <span className="ml-auto text-xs text-zinc-500 shrink-0">
            {filteredShowtimes.length} shows
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Cinema selector */}
        <div className="flex flex-wrap gap-3 mb-6">
          {CINEMAS.map((c) => {
            const active = c === selectedCinema;
            return (
              <button
                key={c}
                onClick={() => setSelectedCinema(c)}
                className={[
                  "flex items-center gap-2 rounded-lg border px-4 py-2 transition-all cursor-pointer",
                  active ? "bg-zinc-800 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "bg-zinc-900 border-zinc-800 hover:border-blue-500/50",
                ].join(" ")}
              >
                <MapPin size={16} className={active ? "text-blue-400" : "text-zinc-500"} />
                <span className="font-bold" style={{ color: active ? "#f0f0f8" : "#a1a1aa" }}>{c}</span>
              </button>
            );
          })}
        </div>

        {!hasShowtimes ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-5">
              <AlertTriangle size={24} className="text-zinc-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No showtimes available</h3>
            <p className="text-sm text-zinc-500 max-w-xs">
              No showtimes scheduled for{" "}
              <span className="text-zinc-300 font-medium">{format(selectedDate, "dd/MM/yyyy")}</span>. Please select another date.
            </p>
          </div>
        ) : (
          <>
            <CinemaGroup showtimes={filteredShowtimes} onSelect={handleSelectShowtime} />
            
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-6 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" /> Plenty of seats</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#fb923c]" /> Almost full</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f87171]" /> Sold out</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-600" /> Ended / Cancelled (disabled)</span>
            </div>
          </>
        )}
      </div>

      {/* Sold Out Modal */}
      {showSoldOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Thông báo</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Suất chiếu đã hết ghế. Xin vui lòng đặt suất chiếu khác
            </p>
            <button 
              onClick={() => setShowSoldOutModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Quay lại chọn suất chiếu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
