import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Film,
  Loader2, X, ChevronRight, RotateCcw, Ticket, Armchair,
} from "lucide-react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  bookingApi,
  Seat,
  BookingConfirmation,
  ShowtimeSeatMap,
  SeatMapPosition,
  SeatHoldPolicy,
  seatInventoryWebSocketUrl,
} from "../../api/bookingApi";
import { useAuth } from "../../context/AuthContext";
import CompleteProfilePage from "../auth/CompleteProfilePage";
import { AudioCoverageFrame, ProjectionBeamOverlay, ProjectionScreenVisualization } from "../admin/cinemaRoomEditor/AuditoriumVisualization";
import type { AuditoriumVisualizationConfig } from "../admin/cinemaRoomEditor/cinemaRoomEditor.types";

// Format a number as Vietnamese đồng, e.g. 70000 → "70.000 ₫"
const formatVND = (v: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);

// ─── CountdownTimer ─────────────────────────────────────────────────────────

function CountdownTimer({
  lockedUntil,
  onExpired,
}: {
  lockedUntil: string;
  onExpired?: () => void;
}) {
  const target = new Date(lockedUntil).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((target - Date.now()) / 1000)));
  const expiredNotified = useRef(false);

  useEffect(() => {
    expiredNotified.current = false;
    const id = setInterval(() => {
      const next = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0 && !expiredNotified.current) {
        expiredNotified.current = true;
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onExpired]);

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
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <Clock size={13} />
      {done ? "Hold expired" : `Hold expires in ${m}:${String(s).padStart(2, "0")}`}
    </div>
  );
}


// Keep the customer map visually aligned with the room-layout tools used by
// administrators. Booking state is layered on top of the physical seat type.
const SEAT_TYPE_THEME: Record<Seat["type"], { bg: string; border: string; text: string }> = {
  STANDARD: { bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.45)", text: "#60a5fa" },
  VIP: { bg: "rgba(251,191,36,0.16)", border: "rgba(251,191,36,0.55)", text: "#fbbf24" },
  COUPLE: { bg: "rgba(168,85,247,0.14)", border: "rgba(168,85,247,0.5)", text: "#c084fc" },
  ACCESSIBLE: { bg: "rgba(20,184,166,0.14)", border: "rgba(20,184,166,0.5)", text: "#2dd4bf" },
};

function SeatBtn({
  seat, selected, conflict, onToggle,
}: {
  seat: Seat; selected: boolean; conflict: boolean; onToggle: (id: number) => void;
}) {
  const available = seat.status === "AVAILABLE";
  const theme = SEAT_TYPE_THEME[seat.type];
  const isDoubleSeat = seat.type === "COUPLE" || (seat.colSpan ?? 1) > 1;
  const displayCode = seat.seatCode?.trim() || `${seat.row}${seat.number}`;

  // Colour + interaction per state. Shape (seat silhouette) is shared below.
  const cls = (() => {
    // The customer only needs to know whether the position can be selected.
    // BOOKED and another customer's temporary LOCKED state share one neutral
    // visual state; the internal reason remains available to the backend.
    if (!available && !conflict) return "bg-white/[0.025] border-white/[0.08] text-white/20 cursor-not-allowed";
    if (conflict)                 return "bg-[#3d1515] border-[#e84545] text-[#ff9a9a] animate-pulse cursor-pointer";
    if (selected)                 return "bg-gradient-to-b from-[#93c5fd] to-[#2563eb] border-[#60a5fa] text-black shadow-[0_4px_14px_rgba(96,165,250,0.45)] -translate-y-0.5 cursor-pointer";
    return "hover:-translate-y-0.5 hover:brightness-125 hover:shadow-[0_4px_12px_rgba(37,99,235,0.25)] cursor-pointer";
  })();

  return (
    <button
      type="button"
      disabled={!available && !conflict}
      onClick={() => available && onToggle(seat.seatId)}
      title={`${displayCode} · ${seat.type}${available ? "" : " · Unavailable"}`}
      className={`relative ${isDoubleSeat ? "w-[4.875rem]" : "w-9"} h-8 rounded-md border-[1.5px] text-[10px] font-bold flex items-center justify-center select-none transition-all duration-150 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/60 ${cls}`}
      style={
        seat.status === "AVAILABLE" && !selected && !conflict
          ? { fontFamily: "'Inter', sans-serif", background: theme.bg, borderColor: theme.border, color: theme.text }
          : { fontFamily: "'Inter', sans-serif" }
      }
    >
      {displayCode}
    </button>
  );
}


type Screen = "map" | "confirming" | "confirmed";

const DEFAULT_HOLD_POLICY: SeatHoldPolicy = {
  channel: "WEB",
  ttlSeconds: 10 * 60,
  maxSeatsPerBooking: 8,
};

function seatMapErrorMessage(error: any): string {
  const status = error?.response?.status;
  if (status === 404) {
    return "This showtime is no longer available or does not have a published seat map.";
  }
  if (status === 409 || status === 422) {
    return "The auditorium layout is not ready for online booking. Please choose another showtime.";
  }
  if (status >= 500) {
    return "Seat availability is temporarily unavailable. Please try again in a moment.";
  }
  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    return "We could not connect to the cinema service. Check your connection and try again.";
  }
  return "We could not load this auditorium's seat map. Please try again.";
}

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
  const [seatMap, setSeatMap] = useState<ShowtimeSeatMap | null>(null);
  const [isLoadingSeats, setIsLoadingSeats] = useState(true);
  const [seatFetchError, setSeatFetchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [conflicts, setConflicts] = useState<Set<number>>(new Set());
  const [confirmation, setConfirmation] = useState<(BookingConfirmation & { seats: Seat[], totalPrice: number }) | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [holdPolicy, setHoldPolicy] = useState<SeatHoldPolicy>(DEFAULT_HOLD_POLICY);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idempotencyKeyRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? `seat-hold-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const renewIdempotencyKey = useCallback(() => {
    idempotencyKeyRef.current =
      globalThis.crypto?.randomUUID?.() ?? `seat-hold-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  const loadSeats = useCallback(async (silent = false) => {
    if (!showtimeId) return;
    try {
      if (!silent) {
        setIsLoadingSeats(true);
        setSeatFetchError(null);
      }
      const data = await bookingApi.getSeatMapByShowtime(showtimeId);
      if (!data?.positions?.length) {
        setSeatMap(null);
        setSeats([]);
        setSeatFetchError(
          "This showtime is not linked to an active auditorium layout. Please choose another showtime."
        );
        return;
      }
      setSeatMap(data);
      const freshSeats = data.seats || [];
      setSeats(freshSeats);
      const unavailableIds = new Set(
        freshSeats.filter((seat) => seat.status !== "AVAILABLE").map((seat) => seat.seatId)
      );
      setSelected((previous) => {
        const next = new Set(Array.from(previous).filter((seatId) => !unavailableIds.has(seatId)));
        if (next.size !== previous.size) {
          setConflicts(new Set(Array.from(previous).filter((seatId) => unavailableIds.has(seatId))));
          setErrorMsg("Seat availability changed. Please review the highlighted positions and select again.");
          renewIdempotencyKey();
        }
        return next;
      });
    } catch (err: any) {
      if (!silent) {
        setSeatMap(null);
        setSeats([]);
        setSeatFetchError(seatMapErrorMessage(err));
      }
    } finally {
      if (!silent) setIsLoadingSeats(false);
    }
  }, [renewIdempotencyKey, showtimeId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  useEffect(() => {
    let active = true;
    bookingApi.getSeatHoldPolicy()
      .then((policy) => {
        if (active && policy?.maxSeatsPerBooking > 0 && policy?.ttlSeconds > 0) {
          setHoldPolicy(policy);
        }
      })
      .catch(() => {
        // The server policy is preferred. The conservative fallback only
        // keeps the page usable while an older gateway is being upgraded.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!showtimeId) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(seatInventoryWebSocketUrl(showtimeId));

      socket.onopen = () => {
        reconnectAttempt = 0;
        setRealtimeConnected(true);
        // A connection may have been offline while inventory changed.
        // Reload the complete map through REST; never reconstruct state from
        // missed WebSocket messages.
        void loadSeats(true);
      };

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data));
          if (["seat.held", "seat.released", "seat.sold"].includes(event?.type)) {
            // Events are invalidation signals only. REST + database remain the
            // source of truth for every visible seat state.
            void loadSeats(true);
          }
        } catch {
          // Ignore malformed/non-domain messages and preserve current state.
        }
      };

      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        setRealtimeConnected(false);
        if (disposed) return;
        const delay = Math.min(15_000, 1_000 * 2 ** reconnectAttempt);
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadSeats(true);
        if (!socket || socket.readyState === WebSocket.CLOSED) connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      setRealtimeConnected(false);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [loadSeats, showtimeId]);

  useEffect(() => {
    // Slow REST fallback covers environments where WebSocket upgrade is not
    // available. It intentionally reloads the complete map.
    pollRef.current = setInterval(() => { void loadSeats(true); }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadSeats]);

  const toggleSeat = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= holdPolicy.maxSeatsPerBooking) {
          setErrorMsg(`You can reserve up to ${holdPolicy.maxSeatsPerBooking} seats per booking.`);
          return prev;
        }
        next.add(id);
      }
      renewIdempotencyKey();
      return next;
    });
    setConflicts((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, [holdPolicy.maxSeatsPerBooking, renewIdempotencyKey]);

  const clearAll = () => {
    renewIdempotencyKey();
    setSelected(new Set());
    setConflicts(new Set());
    setErrorMsg(null);
  };

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
        idempotencyKey: idempotencyKeyRef.current,
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
        const status = err.response?.status;
        setErrorMsg(
          status === 401
            ? "Your session has expired. Sign in again to continue."
            : status >= 500
              ? "We could not reserve these seats right now. Please try again in a moment."
              : "We could not complete the reservation. Review your selection and try again."
        );
      }
    }
  };

  const handleReleaseHold = useCallback(async (mode: "change" | "cancel") => {
    if (!showtimeId || !confirmation?.holdId) {
      setErrorMsg("This reservation cannot be changed automatically. Please reload the seat map.");
      setScreen("map");
      setConfirmation(null);
      void loadSeats(true);
      return;
    }

    try {
      await bookingApi.releaseSeatHold(showtimeId, confirmation.holdId);
      setConfirmation(null);
      setSelected(new Set());
      setConflicts(new Set());
      setErrorMsg(null);
      renewIdempotencyKey();
      await loadSeats(true);
      if (mode === "change") {
        setScreen("map");
      } else {
        navigate(-1);
      }
    } catch (error: any) {
      const status = error?.response?.status;
      setErrorMsg(
        status === 409
          ? "The reservation has already expired or changed. The latest seat map has been loaded."
          : "We could not release this reservation. Please try again."
      );
      setConfirmation(null);
      setSelected(new Set());
      setScreen("map");
      await loadSeats(true);
    }
  }, [confirmation?.holdId, loadSeats, navigate, renewIdempotencyKey, showtimeId]);

  const handleHoldExpired = useCallback(() => {
    setConfirmation(null);
    setSelected(new Set());
    setConflicts(new Set());
    setErrorMsg("Your seat hold expired. The latest availability has been loaded.");
    renewIdempotencyKey();
    setScreen("map");
    void loadSeats(true);
  }, [loadSeats, renewIdempotencyKey]);

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-['Inter',sans-serif]">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111214] p-7 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
            <AlertTriangle size={23} className="text-amber-300" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-white">Seat map unavailable</h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-white/55">{seatFetchError}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Back to showtimes
            </button>
            <button
              onClick={loadSeats}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pickedSeats = seats.filter((s) => selected.has(s.seatId));
  const total = pickedSeats.reduce((sum, s) => sum + s.price, 0);
  // Hang lam moc de ve header so cot — chon hang dai nhat (hang cuoi co the bi cat ngan
  // nen it ghe hon, khong dai dien dung cho vi tri loi di).
  const physicalPositions = seatMap?.positions ?? [];
  const positionsByRow = new Map<number, SeatMapPosition[]>();
  physicalPositions.forEach((position) => {
    const row = positionsByRow.get(position.rowIndex) ?? [];
    row.push(position);
    positionsByRow.set(position.rowIndex, row);
  });
  const physicalRows = Array.from(positionsByRow.entries())
    .sort(([left], [right]) => left - right)
    .map(([rowIndex, positions]) => ({
      rowIndex,
      rowLabel: positions[0]?.rowLabel ?? String.fromCharCode(65 + rowIndex),
      positions: positions.sort((left, right) => left.columnIndex - right.columnIndex),
    }));
  const physicalColumnCount = Math.max(1, ...physicalPositions.map((position) => position.columnIndex + 1));
  const seatsByCode = new Map(seats.filter((seat) => seat.seatCode).map((seat) => [seat.seatCode!, seat]));
  const seatsByGroup = new Map(seats.filter((seat) => seat.seatGroupId).map((seat) => [seat.seatGroupId!, seat]));
  const auditoriumConfig: AuditoriumVisualizationConfig = {
    presentationSystem: seatMap?.presentationSystem ?? "STANDARD",
    projectionTechnologyCode: seatMap?.projectionTechnologyCode,
    audioFormatCode: seatMap?.audioFormatCode,
    audioFormatName: seatMap?.audioFormatName,
  };
  const showProjector = auditoriumConfig.projectionTechnologyCode === "LASER"
    || auditoriumConfig.projectionTechnologyCode === "XENON";
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
            <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              Seats reserved
            </h2>
            <p className="text-white/60 text-sm">Complete payment before the server hold expires</p>
          </div>

          <div className="px-6 py-5 space-y-3 border-b border-white/5">
            {[
              { label: "Booking ID", value: confirmation.bookingId, accent: true },
              { label: "Film", value: showtimeDetails.movieTitle, accent: false },
              { label: "Hall", value: `${showtimeDetails.cinemaName} · ${showtimeDetails.hall}`, accent: false },
              { label: "Seats", value: confirmation.seats.map((s) => s.seatCode?.trim() || `${s.row}${s.number}`).join(", "), accent: false },
              { label: "Total", value: formatVND(confirmation.totalPrice), accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] pt-0.5 shrink-0"
                  style={{ fontFamily: "'Inter', sans-serif" }}>{label}</span>
                <span className={`text-sm text-right ${accent ? "text-[#60a5fa] font-semibold" : "text-white/90"}`}
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex justify-center">
              <CountdownTimer lockedUntil={confirmation.lockedUntil} onExpired={handleHoldExpired} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => void handleReleaseHold("change")}
                className="rounded-lg border border-white/15 px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                Change seats
              </button>
              <button
                onClick={() => void handleReleaseHold("cancel")}
                className="rounded-lg border border-red-400/20 px-3 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-400/10"
              >
                Cancel hold
              </button>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 bg-[#60a5fa] text-black rounded-lg font-semibold text-base tracking-wide hover:brightness-110 transition-colors flex items-center justify-center gap-1"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Continue <ChevronRight size={16} />
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
        <div className="mx-auto flex h-16 w-full max-w-[1540px] items-center gap-3 px-4 sm:px-6 lg:px-8">
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
              style={{ fontFamily: "'Inter', sans-serif" }}>
              {showtimeDetails.movieTitle}
            </h1>
            <p className="text-[11px] text-white/55 truncate">
              {showtimeDetails.cinemaName} · {showtimeDetails.hall} · {formattedDate} · {showtimeDetails.duration} min
            </p>
          </div>
          <span
            className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              realtimeConnected
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-white/45"
            }`}
            title={realtimeConnected ? "Live inventory updates connected" : "REST refresh fallback is active"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${realtimeConnected ? "bg-emerald-400" : "bg-white/30"}`} />
            {realtimeConnected ? "Live" : "Reconnecting"}
          </span>

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
      <div className="mx-auto grid w-full max-w-[1540px] grid-cols-1 gap-6 px-4 py-8 pb-20 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">

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
            className="relative rounded-2xl border border-white/10 px-3 py-6 sm:px-6"
            style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(96,165,250,0.05), rgba(255,255,255,0.015) 45%, transparent 75%)" }}
          >
            <div className={`relative ${showProjector ? "pb-7" : ""}`}>
              <ProjectionScreenVisualization config={auditoriumConfig} />
              <ProjectionBeamOverlay technologyCode={auditoriumConfig.projectionTechnologyCode} />
              <AudioCoverageFrame config={auditoriumConfig}>

          {/* Seat rows */}
          <div className="flex flex-col items-center overflow-x-auto pb-2">
              <div className="flex w-max flex-col gap-2 px-5">
                {physicalRows.map(({ rowIndex, rowLabel, positions }) => {
                  const renderedGroups = new Set<string>();
                  const rowSeat = positions
                    .map((position) => seatsByCode.get(position.seatCode ?? "") ?? seatsByGroup.get(position.seatGroupId ?? ""))
                    .find(Boolean);
                  const rowTheme = SEAT_TYPE_THEME[rowSeat?.type ?? "STANDARD"];

                  return (
                    <div key={rowIndex} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-[11px] font-bold" style={{ color: rowTheme.text }}>{rowLabel}</span>
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${physicalColumnCount}, 2.25rem)` }}>
                        {positions.map((position) => {
                          const positionKey = position.positionId ?? `${rowIndex}-${position.columnIndex}`;
                          if (position.positionType === "AISLE") return <span key={positionKey} className="h-8" aria-label="Aisle" />;
                          if (position.positionType === "EXIT") return <span key={positionKey} title="Exit" className="m-auto h-4 w-4 rounded border border-emerald-400/50 bg-emerald-400/15" />;
                          if (position.positionType !== "SEAT") return <span key={positionKey} className="h-8 rounded-md border border-dashed border-white/[0.06] bg-white/[0.015]" />;

                          const groupId = position.seatGroupId;
                          if (groupId && renderedGroups.has(groupId)) return null;
                          if (groupId) renderedGroups.add(groupId);
                          const seat = seatsByCode.get(position.seatCode ?? "") ?? seatsByGroup.get(groupId ?? "");
                          if (!seat) return <span key={positionKey} className="h-8 rounded-md border border-white/[0.08] bg-white/[0.025]" title="Unavailable" />;
                          const colSpan = Math.max(1, seat.colSpan ?? (seat.type === "COUPLE" ? 2 : 1));
                          return (
                            <div key={positionKey} style={{ gridColumn: `span ${colSpan}` }}>
                              <SeatBtn seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                            </div>
                          );
                        })}
                      </div>
                      <span className="w-5 shrink-0 text-center text-[11px] font-bold" style={{ color: rowTheme.text }}>{rowLabel}</span>
                    </div>
                  );
                })}
              </div>

          </div>

              </AudioCoverageFrame>
            </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-white/[0.06]">
            {[
              {
                label: "Standard",
                swatch: { background: SEAT_TYPE_THEME.STANDARD.bg, borderColor: SEAT_TYPE_THEME.STANDARD.border },
                color: SEAT_TYPE_THEME.STANDARD.text,
              },
              {
                label: "VIP",
                swatch: { background: SEAT_TYPE_THEME.VIP.bg, borderColor: SEAT_TYPE_THEME.VIP.border },
                color: SEAT_TYPE_THEME.VIP.text,
              },
              {
                label: "Couple",
                swatch: { background: SEAT_TYPE_THEME.COUPLE.bg, borderColor: SEAT_TYPE_THEME.COUPLE.border },
                color: SEAT_TYPE_THEME.COUPLE.text,
              },
              {
                label: "Selected",
                swatch: { background: "linear-gradient(to bottom, #93c5fd, #2563eb)", borderColor: "#60a5fa" },
                color: "#93c5fd",
              },
              {
                label: "Unavailable",
                swatch: { background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.16)" },
                color: "rgba(255,255,255,0.5)",
              },
            ].map(({ swatch, color, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5"
              >
                <div className="h-3.5 w-3.5 rounded-[4px] border-[1.5px]" style={swatch} />
                <span className="text-[10px] font-semibold" style={{ color }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Right: summary */}
        <aside className="self-start flex flex-col gap-3 xl:sticky xl:top-40">
          <div className="overflow-hidden rounded-2xl border border-blue-400/15 bg-[#0b0f16] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            {/* Header */}
            <div
              className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4"
              style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.12), rgba(37,99,235,0.025))" }}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Ticket size={16} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">Booking summary</h2>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/45">
                    {pickedSeats.length > 0
                      ? `${pickedSeats.length} selected seat${pickedSeats.length !== 1 ? "s" : ""}`
                      : "Your selected seats will appear here"}
                  </p>
                </div>
              </div>
              {pickedSeats.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
                >
                  <RotateCcw size={12} /> Clear all
                </button>
              )}
            </div>

            {/* Selected seats */}
            <div className="min-h-[130px] px-5 py-4">
              {pickedSeats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-5 text-center">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/8 text-blue-300/45">
                    <Armchair size={22} />
                  </span>
                  <p className="text-sm font-medium text-white/70">Select seats from the map</p>
                  <p className="mt-1 text-[11px] text-white/35">Prices are shown before you continue</p>
                  <p className="mt-1 text-[10px] text-white/25">
                    Maximum {holdPolicy.maxSeatsPerBooking} seats · {Math.round(holdPolicy.ttlSeconds / 60)}-minute web hold
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pickedSeats.map((seat) => (
                    <div
                      key={seat.seatId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {seat.seatCode?.trim() || `${seat.row}${seat.number}`}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          seat.type === "VIP"
                            ? "bg-[#60a5fa]/15 text-[#60a5fa]"
                            : seat.type === "COUPLE"
                            ? "bg-[#c084fc]/15 text-[#c084fc]"
                            : seat.type === "ACCESSIBLE"
                            ? "bg-[#2dd4bf]/15 text-[#2dd4bf]"
                            : "bg-white/10 text-white/70"
                          }`}>
                            {seat.type}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-white/35">Seat price</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-white/85">
                          {formatVND(seat.price)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove seat ${seat.seatCode?.trim() || `${seat.row}${seat.number}`}`}
                          onClick={() => toggleSeat(seat.seatId)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pickedSeats.length > 0 && (
              <div className="space-y-4 border-t border-white/8 px-5 py-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/55">Total</p>
                    <p className="mt-1 text-[11px] text-white/35">
                      {pickedSeats.length} selected seat{pickedSeats.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="text-[1.65rem] font-bold leading-none tabular-nums text-[#60a5fa]">
                    {formatVND(total)}
                  </span>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={screen === "confirming"}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#60a5fa] to-[#2563eb] py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(37,99,235,0.38)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
                >
                  {screen === "confirming" ? (
                    <><Loader2 size={16} className="animate-spin" /> Reserving seats...</>
                  ) : (
                    <>Continue <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></>
                  )}
                </button>
                <p className="text-center text-[10px] leading-4 text-white/30">
                  Seats are held for a limited time after you continue.
                </p>
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
