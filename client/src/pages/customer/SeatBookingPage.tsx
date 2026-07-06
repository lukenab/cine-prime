import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Film,
  Loader2, X, ChevronRight, RotateCcw, Ticket, Armchair,
} from "lucide-react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { bookingApi, Seat, BookingConfirmation } from "../../api/bookingApi";
import { useAuth } from "../../context/AuthContext";
import CompleteProfilePage from "../auth/CompleteProfilePage";

// Format a number as Vietnamese đồng, e.g. 70000 → "70.000 ₫"
const formatVND = (v: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);

// Split a row into left / middle / right blocks so seats AND the column-number
// header share the exact same aisle layout.
function splitRow<T>(arr: T[]): { left: T[]; middle: T[]; right: T[] } {
  if (arr.length === 10) return { left: arr.slice(0, 2), middle: arr.slice(2, 8), right: arr.slice(8, 10) };
  if (arr.length >= 8) return { left: arr.slice(0, 2), middle: arr.slice(2, arr.length - 2), right: arr.slice(arr.length - 2) };
  return { left: [], middle: arr, right: [] };
}

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
      style={{ fontFamily: "'Space Mono', monospace" }}
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

  // Colour + interaction per state. Shape (seat silhouette) is shared below.
  const cls = (() => {
    if (seat.status === "BOOKED") return "bg-[#141620] border-[#20222e] text-[#33364a] cursor-not-allowed";
    if (seat.status === "LOCKED") return "bg-[#320d0d] border-[#7a2626] text-[#ff7a7a] cursor-not-allowed";
    if (conflict)                 return "bg-[#3d1515] border-[#e84545] text-[#ff9a9a] animate-pulse cursor-pointer";
    if (selected)                 return "bg-gradient-to-b from-[#93c5fd] to-[#2563eb] border-[#60a5fa] text-black shadow-[0_4px_14px_rgba(96,165,250,0.45)] -translate-y-0.5 cursor-pointer";
    if (isVip)                    return "bg-[#60a5fa]/[0.08] border-[#60a5fa]/40 text-[#60a5fa] hover:border-[#60a5fa] hover:bg-[#60a5fa]/20 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(96,165,250,0.25)] cursor-pointer";
    return "bg-white/[0.05] border-white/15 text-white/45 hover:border-[#60a5fa]/70 hover:bg-[#60a5fa]/10 hover:text-[#60a5fa] hover:-translate-y-0.5 cursor-pointer";
  })();

  return (
    <button
      type="button"
      disabled={!available && !conflict}
      onClick={() => available && onToggle(seat.seatId)}
      title={`${seat.row}${seat.number} · ${seat.type} · ${seat.status}`}
      className={`relative w-9 h-9 rounded-t-lg rounded-b-[3px] border border-b-[3px] text-[11px] font-semibold flex items-center justify-center select-none transition-all duration-150 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/60 ${cls}`}
      style={{ fontFamily: "'Space Mono', monospace" }}
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
  const { user, needsProfileSetup } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);

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

    // Gate 1: chưa đăng nhập
    if (!user) {
      navigate("/login");
      return;
    }

    // Gate 2: chưa hoàn tất profile → hiện modal ngay trên trang booking
    if (needsProfileSetup) {
      setShowProfileModal(true);
      return;
    }

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
          <Loader2 size={32} className="animate-spin text-[#60a5fa]" />
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
  const maxCols = rows.reduce((m, r) => Math.max(m, byRow(r).length), 0);
  const colNumbers = splitRow(Array.from({ length: maxCols }, (_, i) => i + 1));
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
            <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
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
              { label: "Total", value: formatVND(confirmation.totalPrice), mono: true, accent: true },
            ].map(({ label, value, mono, accent }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] pt-0.5 shrink-0"
                  style={{ fontFamily: "'Space Mono', monospace" }}>{label}</span>
                <span className={`text-sm text-right ${accent ? "text-[#60a5fa] font-semibold" : "text-white/90"}`}
                  style={{ fontFamily: mono ? "'Space Mono', monospace" : "'Inter', sans-serif" }}>
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
              className="w-full py-3 bg-[#60a5fa] text-black rounded-lg font-semibold text-lg tracking-wide hover:brightness-110 transition-colors flex items-center justify-center gap-1"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              Proceed to Home <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#050505] text-white"
      style={{
        fontFamily: "'Inter', sans-serif",
        backgroundImage:
          "radial-gradient(90% 60% at 50% -5%, rgba(96,165,250,0.07), transparent 60%), radial-gradient(60% 50% at 50% 120%, rgba(96,165,250,0.04), transparent 70%)",
      }}
    >

      {/* Header */}
      <header
        className="sticky top-16 mt-16 z-20 border-b border-white/10 backdrop-blur"
        style={{ background: "linear-gradient(to bottom, rgba(12,12,14,0.92), rgba(5,5,5,0.82))" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white mr-1 cursor-pointer"
          >
            <X size={18} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
            style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
            <Film size={16} className="text-[#60a5fa]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight truncate"
              style={{ fontFamily: "'Oswald', sans-serif" }}>
              {showtimeDetails.movieTitle}
            </h1>
            <p className="text-[11px] text-white/55 truncate">
              {showtimeDetails.cinemaName} · {showtimeDetails.hall} · {formattedDate} · {showtimeDetails.duration} min
            </p>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5" style={{ color: "#60a5fa" }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#60a5fa] text-[10px] text-black">1</span>
              Seats
            </span>
            <span className="text-white/20">→</span>
            <span className="flex items-center gap-1.5 text-white/35">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px]">2</span>
              Payment
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 pb-20">

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

          {/* Seat map panel */}
          <div
            className="relative overflow-hidden rounded-2xl border border-white/10 px-3 sm:px-6 py-6"
            style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(96,165,250,0.05), rgba(255,255,255,0.015) 45%, transparent 75%)" }}
          >
            {/* Projected light beam from the screen down over the seats */}
            <div
              className="pointer-events-none absolute left-1/2 top-14 z-0 -translate-x-1/2"
              style={{
                width: "78%",
                height: "460px",
                background:
                  "linear-gradient(to bottom, rgba(96,165,250,0.14), rgba(96,165,250,0.03) 42%, transparent 72%)",
                clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
                filter: "blur(3px)",
              }}
            />

          <div className="relative z-10">
          {/* Screen */}
          <div className="flex flex-col items-center gap-2.5 pt-1 pb-5">
            <div className="relative w-full max-w-xl">
              <div
                className="mx-auto h-3 w-[88%] rounded-[100%] bg-gradient-to-r from-transparent via-[#60a5fa] to-transparent shadow-[0_0_44px_rgba(96,165,250,0.65)]"
                style={{ transform: "perspective(300px) rotateX(-40deg)" }}
              />
              <div className="pointer-events-none absolute inset-x-10 top-2 h-16 bg-gradient-to-b from-[#60a5fa]/20 to-transparent blur-xl" />
            </div>
            <span className="text-[10px] text-white/50 uppercase tracking-[0.5em]"
              style={{ fontFamily: "'Space Mono', monospace" }}>
              Screen
            </span>
          </div>

          {/* Seat rows */}
          <div className="flex flex-col items-center overflow-x-auto pb-2">
            {rows.length === 0 && <p className="text-white/50 text-sm mt-8">No seats available.</p>}

            {/* Column numbers */}
            {rows.length > 0 && (
              <div className="flex items-center gap-2 w-max mb-2.5">
                <span className="w-5 shrink-0" />
                {colNumbers.left.length > 0 && (
                  <>
                    <div className="flex gap-1.5">
                      {colNumbers.left.map((n) => (
                        <span key={n} className="w-9 text-center text-[9px] text-white/30" style={{ fontFamily: "'Space Mono', monospace" }}>{n}</span>
                      ))}
                    </div>
                    <div className="w-5" />
                  </>
                )}
                <div className="flex gap-1.5">
                  {colNumbers.middle.map((n) => (
                    <span key={n} className="w-9 text-center text-[9px] text-white/30" style={{ fontFamily: "'Space Mono', monospace" }}>{n}</span>
                  ))}
                </div>
                {colNumbers.right.length > 0 && (
                  <>
                    <div className="w-5" />
                    <div className="flex gap-1.5">
                      {colNumbers.right.map((n) => (
                        <span key={n} className="w-9 text-center text-[9px] text-white/30" style={{ fontFamily: "'Space Mono', monospace" }}>{n}</span>
                      ))}
                    </div>
                  </>
                )}
                <span className="w-10 shrink-0" />
              </div>
            )}

            {rows.map((row, idx) => {
              const vip = isVipRow(row);
              const { left, middle, right } = splitRow(byRow(row));

              return (
                <div key={row}>
                  {idx > 0 && <div className="h-3" />}
                  <div className="flex items-center gap-2 w-max">
                    {/* Row label */}
                    <span className={`w-5 text-center text-[10px] font-bold shrink-0 ${vip ? "text-[#60a5fa]" : "text-white/45"}`}
                      style={{ fontFamily: "'Space Mono', monospace" }}>
                      {row}
                    </span>

                    {/* Left block */}
                    {left.length > 0 && (
                      <>
                        <div className="flex gap-1.5">
                          {left.map((seat) => (
                            <SeatBtn key={seat.seatId} seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                          ))}
                        </div>
                        <div className="w-5" />
                      </>
                    )}

                    {/* Middle block */}
                    <div className="flex gap-1.5">
                      {middle.map((seat) => (
                        <SeatBtn key={seat.seatId} seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                      ))}
                    </div>

                    {/* Right block */}
                    {right.length > 0 && (
                      <>
                        <div className="w-5" />
                        <div className="flex gap-1.5">
                          {right.map((seat) => (
                            <SeatBtn key={seat.seatId} seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* VIP badge */}
                    <span className="w-10 shrink-0">
                      {vip && (
                        <span className="text-[8px] font-semibold text-[#60a5fa]/70 uppercase tracking-widest"
                          style={{ fontFamily: "'Space Mono', monospace" }}>
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
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-white/[0.06]">
            {[
              { swatch: "bg-white/[0.05] border-white/15", label: "Available" },
              { swatch: "bg-[#60a5fa]/[0.08] border-[#60a5fa]/40", label: "VIP" },
              { swatch: "bg-gradient-to-b from-[#93c5fd] to-[#2563eb] border-[#60a5fa]", label: "Selected" },
              { swatch: "bg-[#320d0d] border-[#7a2626]", label: "Locked" },
              { swatch: "bg-[#141620] border-[#20222e]", label: "Booked" },
            ].map(({ swatch, label }) => (
              <div key={label} className="flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] px-2.5 py-1">
                <div className={`w-3 h-3 rounded-t-md rounded-b-[2px] border border-b-2 ${swatch}`} />
                <span className="text-[10px] text-white/60" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          </div>{/* /z-10 wrapper */}
          </div>
        </div>

        {/* Right: summary */}
        <aside className="lg:sticky lg:top-40 self-start flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.12), rgba(37,99,235,0.04))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <h2 className="flex items-center gap-2 text-white" style={{ fontFamily: "'Oswald', sans-serif", fontSize: "1.05rem" }}>
                <Ticket size={16} className="text-[#60a5fa]" /> Order Summary
              </h2>
              {pickedSeats.length > 0 && (
                <button onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white transition-colors cursor-pointer"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  <RotateCcw size={10} /> Clear
                </button>
              )}
            </div>

            {/* Selected seats */}
            <div className="px-5 py-4 min-h-[130px]">
              {pickedSeats.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-5 text-center">
                  <Armchair size={26} className="text-white/20" />
                  <p className="text-white/40 text-[13px]">Tap a seat on the map to start</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pickedSeats.map((seat) => (
                    <div key={seat.seatId} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleSeat(seat.seatId)}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-white/40 hover:bg-[#e84545]/15 hover:text-[#e84545] transition-colors cursor-pointer">
                          <X size={11} />
                        </button>
                        <span className="font-semibold text-white/90" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {seat.row}{seat.number}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                          seat.type === "VIP"
                            ? "bg-[#60a5fa]/15 text-[#60a5fa]"
                            : "bg-white/10 text-white/70"
                        }`}>
                          {seat.type}
                        </span>
                      </div>
                      <span className="text-white/85 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                        {formatVND(seat.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pickedSeats.length > 0 && (
              <div className="border-t border-white/10 px-5 py-4 space-y-3.5">
                {/* Seat count chips */}
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const vip = pickedSeats.filter((s) => s.type === "VIP").length;
                    const std = pickedSeats.length - vip;
                    return (
                      <>
                        {std > 0 && (
                          <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-white/70">
                            {std} Standard
                          </span>
                        )}
                        {vip > 0 && (
                          <span className="rounded-full bg-[#60a5fa]/12 px-2.5 py-0.5 text-[11px] text-[#60a5fa]">
                            {vip} VIP
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-end justify-between">
                  <span className="text-[10px] text-white/50 uppercase tracking-[0.15em]"
                    style={{ fontFamily: "'Space Mono', monospace" }}>
                    Total · {pickedSeats.length} seat{pickedSeats.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-2xl font-bold text-[#60a5fa] drop-shadow-[0_0_14px_rgba(96,165,250,0.35)]"
                    style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {formatVND(total)}
                  </span>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={screen === "confirming"}
                  className="group flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] py-3 text-base font-bold tracking-wide text-black shadow-[0_8px_26px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(37,99,235,0.55)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer"
                  style={{ fontFamily: "'Oswald', sans-serif" }}
                >
                  {screen === "confirming" ? (
                    <><Loader2 size={16} className="animate-spin" /> Confirming…</>
                  ) : (
                    <>Confirm Booking <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></>
                  )}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Profile completion modal — overlays the booking page */}
      {showProfileModal && (
        <CompleteProfilePage
          onClose={() => setShowProfileModal(false)}
          onDone={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
