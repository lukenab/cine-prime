import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Film,
  Loader2, X, ChevronRight, RotateCcw,
} from "lucide-react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { bookingApi, Seat, BookingConfirmation } from "../../api/bookingApi";

// ─── CountdownTimer ─────────────────────────────────────────────────────────

function CountdownTimer({ lockedUntil }: { lockedUntil: string }) {
  const target = new Date(lockedUntil).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((target - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const warn = remaining > 0 && remaining < 120;
  const done = remaining === 0;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
        done
          ? "bg-[#3d1515] border-[#e84545] text-[#e84545]"
          : warn
          ? "bg-[#3d2a00] border-[#f5a623] text-[#f5a623]"
          : "bg-black/30 border-white/20 text-white"
      }`}
      style={{ fontFamily: "'DM Mono', monospace" }}
    >
      <Clock size={13} />
      {done ? "Hold expired" : `Hold expires in ${m}:${String(s).padStart(2, "0")}`}
    </div>
  );
}


function SeatBtn({
  seat, selected, conflict, onToggle,
}: {
  seat: Seat; selected: boolean; conflict: boolean; onToggle: (id: number) => void;
}) {
  const available = seat.status === "AVAILABLE";
  const isVip = seat.type === "VIP";

  const cls = (() => {
    if (seat.status === "BOOKED") return "bg-[#1a1c28] border-[#252840] text-[#3a3d52] cursor-not-allowed opacity-50";
    if (seat.status === "LOCKED") return "bg-[#3d0e0e] border-[#c0392b] text-[#ff6b6b] cursor-not-allowed";
    if (conflict)                 return "bg-[#3d1515] border-[#e84545] text-[#e84545] animate-pulse cursor-pointer";
    if (selected)                 return "bg-[#FFD700] border-[#FFD700] text-black shadow-[0_0_10px_rgba(255,215,0,0.35)] cursor-pointer";
    if (isVip)                    return "bg-black/40 border-white/20 text-[#FFD700] hover:border-[#FFD700] hover:bg-black/60 cursor-pointer";
    return "bg-black/40 border-white/20 text-white/50 hover:border-[#FFD700]/60 hover:bg-black/60 hover:text-[#FFD700] cursor-pointer";
  })();

  return (
    <button
      type="button"
      disabled={!available && !conflict}
      onClick={() => available && onToggle(seat.seatId)}
      title={`${seat.row}${seat.number} · ${seat.type} · ${seat.status}`}
      className={`w-8 h-8 rounded-sm border text-[10px] font-semibold flex items-center justify-center select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFD700] ${cls}`}
      style={{ fontFamily: "'DM Mono', monospace" }}
    >
      {seat.number}
    </button>
  );
}


type Screen = "map" | "confirming" | "confirmed";

export default function SeatBookingPage() {
  const { showtimeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const showtimeDetails = location.state?.showtime || {
    movieTitle: "Movie Booking",
    cinemaName: "CinePrime",
    hall: "Standard Hall",
    dateTime: new Date().toISOString(),
    duration: 120,
  };

  const [screen, setScreen] = useState<Screen>("map");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [isLoadingSeats, setIsLoadingSeats] = useState(true);
  const [seatFetchError, setSeatFetchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [conflicts, setConflicts] = useState<Set<number>>(new Set());
  const [confirmation, setConfirmation] = useState<(BookingConfirmation & { seats: Seat[], totalPrice: number }) | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSeats = useCallback(async () => {
    if (!showtimeId) return;
    try {
      setSeatFetchError(null);
      const data = await bookingApi.getSeatsByShowtime(showtimeId);
      setSeats(data || []);
    } catch (err: any) {
      setSeatFetchError(err.message || "Failed to load seat map. Please try again.");
    } finally {
      setIsLoadingSeats(false);
    }
  }, [showtimeId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      if (!showtimeId) return;
      try {
        const fresh = await bookingApi.getSeatsByShowtime(showtimeId);
        if (fresh) {
          setSeats((prev) =>
            fresh.map((s) => {
              const p = prev.find((x) => x.seatId === s.seatId);
              return p && selected.has(s.seatId) && s.status === "AVAILABLE" ? p : s;
            })
          );
        }
      } catch { /* no backend available, silent */ }
    }, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [showtimeId, selected]);

  const toggleSeat = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setConflicts((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setErrorMsg(null);
  }, []);

  const clearAll = () => { setSelected(new Set()); setConflicts(new Set()); setErrorMsg(null); };

  const handleConfirm = async () => {
    if (selected.size === 0 || !showtimeId) return;
    setScreen("confirming");
    setErrorMsg(null);
    try {
      const payload = {
        showtimeId: parseInt(showtimeId),
        seatIds: Array.from(selected),
      };
      const result = await bookingApi.createBooking(payload);
      
      const pickedSeats = seats.filter((s) => selected.has(s.seatId));
      const total = pickedSeats.reduce((sum, s) => sum + s.price, 0);
      setConfirmation({ ...result, seats: pickedSeats, totalPrice: total });
      setScreen("confirmed");
    } catch (err: any) {
      setScreen("map");
      const errResponse = err.response?.data;
      if (errResponse?.result?.conflictingSeatIds) {
        const ids = errResponse.result.conflictingSeatIds as number[];
        setConflicts(new Set(ids));
        setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
        setErrorMsg("Some seats were just taken. Conflicting seats are highlighted — please pick alternatives.");
      } else {
        setErrorMsg(errResponse?.message || "Something went wrong. Please try again.");
      }
    }
  };

  if (isLoadingSeats) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-[#FFD700]" />
          <p className="text-white/70">Loading seat map...</p>
        </div>
      </div>
    );
  }

  if (seatFetchError) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="bg-[#150a0a] border border-red-500/30 p-6 rounded-xl flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-red-200">{seatFetchError}</p>
          <button onClick={loadSeats} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pickedSeats = seats.filter((s) => selected.has(s.seatId));
  const total = pickedSeats.reduce((sum, s) => sum + s.price, 0);
  const rows = Array.from(new Set(seats.map((s) => s.row))).sort();
  const byRow = (r: string) => seats.filter((s) => s.row === r).sort((a, b) => a.number - b.number);
  const isVipRow = (r: string) => seats.find((s) => s.row === r)?.type === "VIP";
  const formattedDate = new Date(showtimeDetails.dateTime).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  if (screen === "confirmed" && confirmation) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-b from-[#152515] to-[#0a0a0a] px-8 pt-8 pb-6 text-center border-b border-white/5">
            <div className="w-14 h-14 rounded-full bg-[#1a5535] border border-[#2a7a4a] flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-[#34d399]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Booking Confirmed
            </h2>
            <p className="text-white/60 text-sm">Complete payment before the hold expires</p>
          </div>

          <div className="px-6 py-5 space-y-3 border-b border-white/5">
            {[
              { label: "Booking ID", value: confirmation.bookingId, mono: true, accent: true },
              { label: "Film", value: showtimeDetails.movieTitle, mono: false, accent: false },
              { label: "Hall", value: `${showtimeDetails.cinemaName} · ${showtimeDetails.hall}`, mono: false, accent: false },
              { label: "Seats", value: confirmation.seats.map((s) => `${s.row}${s.number}`).join(", "), mono: true, accent: false },
              { label: "Total", value: `${confirmation.totalPrice.toLocaleString('vi-VN')} đ`, mono: true, accent: true },
            ].map(({ label, value, mono, accent }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] pt-0.5 shrink-0"
                  style={{ fontFamily: "'DM Mono', monospace" }}>{label}</span>
                <span className={`text-sm text-right ${accent ? "text-[#FFD700] font-semibold" : "text-white/90"}`}
                  style={{ fontFamily: mono ? "'DM Mono', monospace" : "'DM Sans', sans-serif" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex justify-center">
              <CountdownTimer lockedUntil={confirmation.lockedUntil} />
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-semibold text-lg tracking-wide hover:brightness-110 transition-colors flex items-center justify-center gap-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Proceed to Home <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <header className="sticky top-16 mt-16 z-20 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-white/60 hover:text-white transition-colors mr-2">
            <X size={20} />
          </button>
          <Film size={18} className="text-[#FFD700] shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {showtimeDetails.movieTitle}
            </h1>
            <p className="text-[11px] text-white/60 truncate">
              {showtimeDetails.cinemaName} · {showtimeDetails.hall} · {formattedDate} · {showtimeDetails.duration} min
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6 pb-20">

        {/* Left: map */}
        <div className="flex flex-col gap-5">

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-3 bg-[#2a1515] border border-[#e84545]/40 rounded-lg p-4 text-sm text-[#f87171]">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span className="flex-1">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-[#f87171]/50 hover:text-[#f87171] transition-colors">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Screen */}
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <div className="w-full max-w-md h-1 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <span className="text-[9px] text-white/50 uppercase tracking-[0.25em]"
              style={{ fontFamily: "'DM Mono', monospace" }}>
              Screen
            </span>
          </div>

          {/* Seat rows */}
          <div className="flex flex-col items-center overflow-x-auto pb-2">
            {rows.length === 0 && <p className="text-white/50 text-sm mt-8">No seats available.</p>}
            {rows.map((row, idx) => {
              const vip = isVipRow(row);
              const rowSeats = byRow(row);
              let left: Seat[] = [], middle: Seat[] = [], right: Seat[] = [];
              if (rowSeats.length === 10) {
                left = rowSeats.slice(0, 2);
                middle = rowSeats.slice(2, 8);
                right = rowSeats.slice(8, 10);
              } else if (rowSeats.length >= 8) {
                left = rowSeats.slice(0, 2);
                middle = rowSeats.slice(2, rowSeats.length - 2);
                right = rowSeats.slice(rowSeats.length - 2, rowSeats.length);
              } else {
                middle = rowSeats; // fallback
              }

              return (
                <div key={row}>
                  {idx > 0 && <div className="h-3" />}
                  <div className="flex items-center gap-2 w-max">
                    {/* Row label */}
                    <span className={`w-5 text-center text-[10px] font-medium shrink-0 ${vip ? "text-[#FFD700]" : "text-white/50"}`}
                      style={{ fontFamily: "'DM Mono', monospace" }}>
                      {row}
                    </span>

                    {/* Left block */}
                    {left.length > 0 && (
                      <>
                        <div className="flex gap-1">
                          {left.map((seat) => (
                            <SeatBtn key={seat.seatId} seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                          ))}
                        </div>
                        <div className="w-5" />
                      </>
                    )}

                    {/* Middle block */}
                    <div className="flex gap-1">
                      {middle.map((seat) => (
                        <SeatBtn key={seat.seatId} seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                      ))}
                    </div>

                    {/* Right block */}
                    {right.length > 0 && (
                      <>
                        <div className="w-5" />
                        <div className="flex gap-1">
                          {right.map((seat) => (
                            <SeatBtn key={seat.seatId} seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* VIP badge */}
                    <span className="w-10 shrink-0">
                      {vip && (
                        <span className="text-[8px] font-semibold text-[#FFD700]/70 uppercase tracking-widest"
                          style={{ fontFamily: "'DM Mono', monospace" }}>
                          VIP
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
            {[
              { swatch: "bg-black/40 border-white/20", label: "Available" },
              { swatch: "bg-[#FFD700] border-[#FFD700]", label: "Selected" },
              { swatch: "bg-[#3d0e0e] border-[#c0392b]", label: "Locked" },
              { swatch: "bg-[#1a1c28] border-[#252840] opacity-50", label: "Booked" },
            ].map(({ swatch, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3.5 h-3.5 rounded-sm border ${swatch}`} />
                <span className="text-[10px] text-white/60" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: summary */}
        <aside className="lg:sticky lg:top-40 self-start flex flex-col gap-3">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-lg">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-semibold text-white text-sm tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
                Booking Summary
              </h2>
              {pickedSeats.length > 0 && (
                <button onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white transition-colors"
                  style={{ fontFamily: "'DM Mono', monospace" }}>
                  <RotateCcw size={10} /> Clear
                </button>
              )}
            </div>

            <div className="px-5 py-4 min-h-[120px]">
              {pickedSeats.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-3">
                  Select seats on the map
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pickedSeats.map((seat) => (
                    <div key={seat.seatId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleSeat(seat.seatId)}
                          className="text-white/40 hover:text-[#e84545] transition-colors">
                          <X size={11} />
                        </button>
                        <span className="font-medium text-white/90" style={{ fontFamily: "'DM Mono', monospace" }}>
                          {seat.row}{seat.number}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                          seat.type === "VIP"
                            ? "bg-[#FFD700]/15 text-[#FFD700]"
                            : "bg-white/10 text-white/70"
                        }`}>
                          {seat.type}
                        </span>
                      </div>
                      <span className="text-white text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>
                        {seat.price.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pickedSeats.length > 0 && (
              <div className="border-t border-white/10 px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/50 uppercase tracking-[0.15em]"
                    style={{ fontFamily: "'DM Mono', monospace" }}>
                    Total · {pickedSeats.length} seat{pickedSeats.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xl font-bold text-[#FFD700]"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {total.toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={screen === "confirming"}
                  className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-semibold text-base tracking-wide hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {screen === "confirming" ? (
                    <><Loader2 size={15} className="animate-spin" /> Confirming…</>
                  ) : (
                    <>Confirm Booking <ChevronRight size={15} /></>
                  )}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
