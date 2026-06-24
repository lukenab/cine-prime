import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Film,
  Loader2, X, ChevronRight, RotateCcw,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type SeatStatus = "AVAILABLE" | "LOCKED" | "BOOKED";
type SeatType = "STANDARD" | "VIP";

interface Seat {
  id: string;
  row: string;
  number: number;
  type: SeatType;
  status: SeatStatus;
  price: number;
}

interface BookingConfirmation {
  bookingId: string;
  lockedUntil: string;
  seats: Seat[];
  totalPrice: number;
}

type Screen = "map" | "confirming" | "confirmed" | "error";

// ─── Static showtime ────────────────────────────────────────────────────────

const SHOWTIME = {
  id: "st-2847",
  movieTitle: "Dune: Part Three",
  cinemaName: "Cinemax Grand",
  hall: "Auditorium 4",
  dateTime: "2026-06-23T20:15:00",
  duration: 155,
};

// ─── Seat generation ────────────────────────────────────────────────────────

// Each row: 2 seats | aisle | 4 seats | aisle | 2 seats  →  8 seats total, wings equal
function buildSeats(): Seat[] {
  const config: [string, SeatType][] = [
    ["B", "VIP"],
    ["C", "STANDARD"], ["D", "STANDARD"],
    ["E", "STANDARD"], ["F", "STANDARD"],
    ["G", "STANDARD"],
  ];
  const booked = new Set(["C-3", "C-4", "D-7", "E-2", "F-5", "F-6", "G-3"]);
  const locked = new Set(["D-4", "D-5", "E-6", "F-7"]);
  const seats: Seat[] = [];
  for (const [row, type] of config) {
    for (let n = 1; n <= 8; n++) {
      const key = `${row}-${n}`;
      const status: SeatStatus = booked.has(key) ? "BOOKED" : locked.has(key) ? "LOCKED" : "AVAILABLE";
      seats.push({ id: `seat-${key}`, row, number: n, type, status, price: type === "VIP" ? 22 : 14 });
    }
  }
  return seats;
}

// ─── API layer ──────────────────────────────────────────────────────────────

async function apiBooking(showtimeId: string, seatIds: string[]): Promise<BookingConfirmation> {
  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
      },
      body: JSON.stringify({ showtimeId, seatIds }),
    });
    if (res.status === 409) {
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw { type: "CONFLICT", conflictingSeatIds: data.conflictingSeatIds ?? [] };
    }
    if (!res.ok) throw new Error("api_error");
    return res.json();
  } catch (err) {
    if (err && typeof err === "object" && "type" in err) throw err;
    // Mock fallback
    const until = new Date(Date.now() + 12 * 60 * 1000);
    return {
      bookingId: `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      lockedUntil: until.toISOString(),
      seats: [],
      totalPrice: 0,
    };
  }
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
          ? "bg-[#3d2a00] border-primary text-primary"
          : "bg-secondary border-border text-foreground"
      }`}
      style={{ fontFamily: "'DM Mono', monospace" }}
    >
      <Clock size={13} />
      {done ? "Hold expired" : `Hold expires in ${m}:${String(s).padStart(2, "0")}`}
    </div>
  );
}

// ─── SeatBtn ────────────────────────────────────────────────────────────────

function SeatBtn({
  seat, selected, conflict, onToggle,
}: {
  seat: Seat; selected: boolean; conflict: boolean; onToggle: (id: string) => void;
}) {
  const available = seat.status === "AVAILABLE";
  const isVip = seat.type === "VIP";

  const cls = (() => {
    if (seat.status === "BOOKED") return "bg-[#1a1c28] border-[#252840] text-[#3a3d52] cursor-not-allowed opacity-50";
    if (seat.status === "LOCKED") return "bg-[#3d0e0e] border-[#c0392b] text-[#ff6b6b] cursor-not-allowed";
    if (conflict)                 return "bg-[#3d1515] border-[#e84545] text-[#e84545] animate-pulse cursor-pointer";
    if (selected)                 return "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(245,166,35,0.35)] cursor-pointer";
    if (isVip)                    return "bg-secondary border-border text-primary hover:border-primary hover:bg-[#252838] cursor-pointer";
    return "bg-secondary border-border text-muted-foreground hover:border-primary/60 hover:bg-[#252838] hover:text-primary cursor-pointer";
  })();

  return (
    <button
      type="button"
      disabled={!available && !conflict}
      onClick={() => available && onToggle(seat.id)}
      title={`${seat.row}${seat.number} · ${seat.type} · ${seat.status}`}
      className={`w-8 h-8 rounded-sm border text-[10px] font-semibold flex items-center justify-center select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${cls}`}
      style={{ fontFamily: "'DM Mono', monospace" }}
    >
      {seat.number}
    </button>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

const INITIAL_SEATS = buildSeats();

export default function App() {
  const [screen, setScreen] = useState<Screen>("map");
  const [seats, setSeats] = useState<Seat[]>(INITIAL_SEATS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll every 20s for seat refresh
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/showtimes/${SHOWTIME.id}/seats`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        });
        if (!res.ok) return;
        const fresh: Seat[] = await res.json();
        setSeats((prev) =>
          fresh.map((s) => {
            const p = prev.find((x) => x.id === s.id);
            return p && selected.has(s.id) ? p : s;
          })
        );
      } catch { /* no backend available, silent */ }
    }, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSeat = useCallback((id: string) => {
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
    if (selected.size === 0) return;
    setScreen("confirming");
    setErrorMsg(null);
    try {
      const result = await apiBooking(SHOWTIME.id, Array.from(selected));
      const pickedSeats = seats.filter((s) => selected.has(s.id));
      const total = pickedSeats.reduce((sum, s) => sum + s.price, 0);
      setConfirmation({ ...result, seats: pickedSeats, totalPrice: total });
      setScreen("confirmed");
    } catch (err) {
      setScreen("map");
      if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "CONFLICT") {
        const ids = (err as { conflictingSeatIds: string[] }).conflictingSeatIds;
        setConflicts(new Set(ids));
        setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
        setErrorMsg("Some seats were just taken. Conflicting seats are highlighted — please pick alternatives.");
      } else {
        setErrorMsg("Something went wrong. Please try again.");
      }
    }
  };

  // Derived
  const pickedSeats = seats.filter((s) => selected.has(s.id));
  const total = pickedSeats.reduce((sum, s) => sum + s.price, 0);
  const rows = Array.from(new Set(seats.map((s) => s.row)));
  const byRow = (r: string) => seats.filter((s) => s.row === r);
  const isVipRow = (r: string) => seats.find((s) => s.row === r)?.type === "VIP";
  const formattedDate = new Date(SHOWTIME.dateTime).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // ── Confirmed ─────────────────────────────────────────────────────────────
  if (screen === "confirmed" && confirmation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-b from-[#0f3020] to-card px-8 pt-8 pb-6 text-center border-b border-border">
            <div className="w-14 h-14 rounded-full bg-[#1a5535] border border-[#2a7a4a] flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-[#34d399]" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Booking Confirmed
            </h2>
            <p className="text-muted-foreground text-sm">Complete payment before the hold expires</p>
          </div>

          <div className="px-6 py-5 space-y-3 border-b border-border">
            {[
              { label: "Booking ID", value: confirmation.bookingId, mono: true, accent: true },
              { label: "Film", value: SHOWTIME.movieTitle, mono: false, accent: false },
              { label: "Hall", value: `${SHOWTIME.cinemaName} · ${SHOWTIME.hall}`, mono: false, accent: false },
              { label: "Seats", value: confirmation.seats.map((s) => `${s.row}${s.number}`).join(", "), mono: true, accent: false },
              { label: "Total", value: `$${confirmation.totalPrice}`, mono: true, accent: true },
            ].map(({ label, value, mono, accent }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] pt-0.5 shrink-0"
                  style={{ fontFamily: "'DM Mono', monospace" }}>{label}</span>
                <span className={`text-sm text-right ${accent ? "text-primary font-semibold" : "text-foreground"}`}
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
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-lg tracking-wide hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Proceed to Payment <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Seat map ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Film size={18} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {SHOWTIME.movieTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {SHOWTIME.cinemaName} · {SHOWTIME.hall} · {formattedDate} · {SHOWTIME.duration} min
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6">

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
            <div className="w-full max-w-md h-1 rounded-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-[0.25em]"
              style={{ fontFamily: "'DM Mono', monospace" }}>
              Screen
            </span>
          </div>

          {/* Seat rows — layout: [1] | aisle | [6] | aisle | [1] */}
          <div className="flex flex-col items-center overflow-x-auto pb-2">
            {rows.map((row, idx) => {
              const vip = isVipRow(row);
              const rowSeats = byRow(row); // always 8 seats
              const left   = rowSeats.slice(0, 2);   // seats 1-2
              const middle = rowSeats.slice(2, 6);   // seats 3-6
              const right  = rowSeats.slice(6, 8);   // seats 7-8

              return (
                <div key={row}>
                  {/* Spacer between rows */}
                  {idx > 0 && <div className="h-3" />}

                  <div className="flex items-center gap-2 w-max">
                    {/* Row label */}
                    <span
                      className={`w-5 text-center text-[10px] font-medium shrink-0 ${vip ? "text-primary" : "text-muted-foreground"}`}
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    >
                      {row}
                    </span>

                    {/* Left block: 1 seat */}
                    <div className="flex gap-1">
                      {left.map((seat) => (
                        <SeatBtn key={seat.id} seat={seat} selected={selected.has(seat.id)} conflict={conflicts.has(seat.id)} onToggle={toggleSeat} />
                      ))}
                    </div>

                    {/* Aisle */}
                    <div className="w-5" />

                    {/* Middle block: 6 seats */}
                    <div className="flex gap-1">
                      {middle.map((seat) => (
                        <SeatBtn key={seat.id} seat={seat} selected={selected.has(seat.id)} conflict={conflicts.has(seat.id)} onToggle={toggleSeat} />
                      ))}
                    </div>

                    {/* Aisle */}
                    <div className="w-5" />

                    {/* Right block: 1 seat */}
                    <div className="flex gap-1">
                      {right.map((seat) => (
                        <SeatBtn key={seat.id} seat={seat} selected={selected.has(seat.id)} conflict={conflicts.has(seat.id)} onToggle={toggleSeat} />
                      ))}
                    </div>

                    {/* VIP badge */}
                    <span className="w-10 shrink-0">
                      {vip && (
                        <span className="text-[8px] font-semibold text-primary/70 uppercase tracking-widest"
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
              { swatch: "bg-secondary border-border", label: "Available" },
              { swatch: "bg-primary border-primary", label: "Selected" },
              { swatch: "bg-[#3d0e0e] border-[#c0392b]", label: "Locked" },
              { swatch: "bg-[#1a1c28] border-[#252840] opacity-50", label: "Booked" },
            ].map(({ swatch, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3.5 h-3.5 rounded-sm border ${swatch}`} />
                <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: summary */}
        <aside className="lg:sticky lg:top-20 self-start flex flex-col gap-3">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-sm tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
                Booking Summary
              </h2>
              {pickedSeats.length > 0 && (
                <button onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  style={{ fontFamily: "'DM Mono', monospace" }}>
                  <RotateCcw size={10} /> Clear
                </button>
              )}
            </div>

            <div className="px-5 py-4 min-h-[120px]">
              {pickedSeats.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-3">
                  Select seats on the map
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pickedSeats.map((seat) => (
                    <div key={seat.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleSeat(seat.id)}
                          className="text-muted-foreground/60 hover:text-[#e84545] transition-colors">
                          <X size={11} />
                        </button>
                        <span className="font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>
                          {seat.row}{seat.number}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                          seat.type === "VIP"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground"
                        }`}>
                          {seat.type}
                        </span>
                      </div>
                      <span className="text-foreground text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>
                        ${seat.price}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pickedSeats.length > 0 && (
              <div className="border-t border-border px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]"
                    style={{ fontFamily: "'DM Mono', monospace" }}>
                    Total · {pickedSeats.length} seat{pickedSeats.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xl font-bold text-primary"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    ${total}
                  </span>
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={screen === "confirming"}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-base tracking-wide hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
