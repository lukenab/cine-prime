import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  bookingApi,
  BookingConfirmation,
  Seat,
  ShowtimeSeatMap,
  SeatMapPosition,
  SeatHoldPolicy,
  seatInventoryWebSocketUrl,
} from "../../api/bookingApi";
import { useAuth } from "../../context/AuthContext";
import CompleteProfilePage from "../auth/CompleteProfilePage";
import { AudioCoverageFrame, ProjectionBeamOverlay, ProjectionScreenVisualization } from "../admin/cinemaRoomEditor/AuditoriumVisualization";
import type { AuditoriumVisualizationConfig } from "../admin/cinemaRoomEditor/cinemaRoomEditor.types";
import CheckoutProgress from "../../components/booking/CheckoutProgress";
import BookingSummaryCard from "../../components/booking/BookingSummaryCard";
import { formatBookingDate } from "../../components/booking/bookingUi";
import { notify } from "../../lib/notifications";

// "Screen-glow deep space" — the same cosmic wash used on the movie-detail
// page, applied page-wide here too (including the loading/error states) so
// the booking flow doesn't drop back to flat black between screens.
const COSMIC_PAGE_BG =
  "radial-gradient(ellipse 70% 45% at 12% -8%, rgba(37,99,235,.14), transparent 58%), " +
  "radial-gradient(ellipse 55% 38% at 105% 0%, rgba(56,189,248,.12), transparent 52%), " +
  "#050914";

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
  // A LOCKED seat still held by *this* account (e.g. a hold that survived a
  // failed/slow checkout) must stay pickable so the customer can resume the
  // same hold instead of it looking permanently stuck until the TTL expires.
  const isMyHold = seat.status === "LOCKED" && seat.reservedByMe === true;
  const available = seat.status === "AVAILABLE" || isMyHold;
  const theme = SEAT_TYPE_THEME[seat.type];
  const displayCode = seat.seatCode?.trim() || `${seat.row}${seat.number}`;

  // Colour + interaction per state. Shape (seat silhouette) is shared below.
  const cls = (() => {
    // The customer only needs to know whether the position can be selected.
    // BOOKED and another customer's temporary LOCKED state share one neutral
    // visual state; the internal reason remains available to the backend.
    if (!available && !conflict) return "bg-white/[0.025] border-white/[0.08] text-white/20 cursor-not-allowed";
    if (conflict)                 return "bg-[#3d1515] border-[#e84545] text-[#ff9a9a] animate-pulse cursor-pointer";
    if (selected)                 return "bg-gradient-to-b from-[#93c5fd] to-[#2563eb] border-[#60a5fa] text-black shadow-[0_4px_14px_rgba(96,165,250,0.45)] -translate-y-0.5 cursor-pointer";
    if (isMyHold)                  return "bg-[#2a2210] border-[#d4a72c] text-[#f2c94c] cursor-pointer";
    return "hover:-translate-y-0.5 hover:brightness-125 hover:shadow-[0_4px_12px_rgba(37,99,235,0.25)] cursor-pointer";
  })();

  const title = isMyHold && !selected
    ? `${displayCode} · ${seat.type} · Held by you — click to resume`
    : `${displayCode} · ${seat.type}${available ? "" : " · Unavailable"}`;

  return (
    <button
      type="button"
      disabled={!available && !conflict}
      onClick={() => available && onToggle(seat.seatId)}
      title={title}
      className={`relative flex h-8 w-full min-w-0 items-center justify-center overflow-hidden rounded-md border-[1.5px] px-0.5 text-[clamp(7px,0.7vw,10px)] font-bold select-none transition-all duration-150 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/60 ${cls}`}
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


type Screen = "map" | "confirming";

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

// A hold's idempotency key previously lived only in a `useRef`, so an F5
// reload while a slow/failed "Continue" request was in flight lost it. The
// backend still had an active RESERVED hold under the old key, but the
// reloaded page would mint a brand-new key and the seat's own owner would
// then be rejected as SEAT_NOT_AVAILABLE by their own hold — appearing stuck
// until the TTL expired. Persisting the key + the seats it covers lets a
// reload resume the exact same hold via the backend's existing replay path.
function seatHoldStorageKey(showtimeId: string): string {
  return `seat-hold-draft:${showtimeId}`;
}

const SEAT_DRAFT_MAX_AGE_MS = 15 * 60 * 1000;

interface PersistedSeatDraft {
  idempotencyKey: string;
  seatIds: number[];
  savedAt: number;
  resumeAfterLogin: boolean;
}

function readPersistedSeatHold(
  showtimeId: string | undefined
): PersistedSeatDraft | null {
  if (!showtimeId) return null;
  try {
    const raw = sessionStorage.getItem(seatHoldStorageKey(showtimeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.idempotencyKey !== "string" || !Array.isArray(parsed?.seatIds)) {
      return null;
    }
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now();
    if (Date.now() - savedAt > SEAT_DRAFT_MAX_AGE_MS) {
      sessionStorage.removeItem(seatHoldStorageKey(showtimeId));
      return null;
    }
    return {
      idempotencyKey: parsed.idempotencyKey,
      seatIds: parsed.seatIds.filter(
        (id: unknown): id is number => typeof id === "number" && Number.isFinite(id)
      ),
      savedAt,
      resumeAfterLogin: parsed.resumeAfterLogin === true,
    };
  } catch {
    return null;
  }
}

function persistSeatDraft(
  showtimeId: string | undefined,
  draft: Omit<PersistedSeatDraft, "savedAt">
): void {
  if (!showtimeId) return;
  try {
    sessionStorage.setItem(
      seatHoldStorageKey(showtimeId),
      JSON.stringify({ ...draft, savedAt: Date.now() })
    );
  } catch {
    // Navigation state still carries the same intent when storage is blocked.
  }
}

function clearPersistedSeatHold(showtimeId: string | undefined): void {
  if (!showtimeId) return;
  try {
    sessionStorage.removeItem(seatHoldStorageKey(showtimeId));
  } catch {
    // Storage may be unavailable (private mode); the draft simply won't
    // survive a reload in that case, no worse than before this fix.
  }
}

export default function SeatBookingPage() {
  const { showtimeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, needsProfileSetup, profileCheckPending } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<BookingConfirmation | null>(null);

  const continueToCheckout = useCallback((booking: BookingConfirmation) => {
    navigate(`/checkout/${booking.bookingId}/concessions`, {
      state: booking.promotionRejectionReason
        ? { promotionRejectionReason: booking.promotionRejectionReason }
        : undefined,
    });
  }, [navigate]);

  useEffect(() => {
    if (!pendingBooking || profileCheckPending || needsProfileSetup) return;
    const booking = pendingBooking;
    setPendingBooking(null);
    continueToCheckout(booking);
  }, [continueToCheckout, needsProfileSetup, pendingBooking, profileCheckPending]);

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [holdPolicy, setHoldPolicy] = useState<SeatHoldPolicy>(DEFAULT_HOLD_POLICY);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [autoResumeReady, setAutoResumeReady] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const persistedHoldRef = useRef(readPersistedSeatHold(showtimeId));
  const pendingSeatRestoreRef = useRef<number[]>(
    Array.isArray(location.state?.resumeSeatIds)
      ? location.state.resumeSeatIds.filter(
          (seatId: unknown): seatId is number =>
            typeof seatId === "number" && Number.isFinite(seatId)
        )
      : persistedHoldRef.current?.seatIds ?? []
  );
  const restorePendingRef = useRef(pendingSeatRestoreRef.current.length > 0);
  const resumeAfterLoginRef = useRef(
    location.state?.resumeAfterLogin === true || persistedHoldRef.current?.resumeAfterLogin === true
  );
  const autoResumeSubmissionStartedRef = useRef(false);
  const idempotencyKeyRef = useRef(
    persistedHoldRef.current?.idempotencyKey
      ?? globalThis.crypto?.randomUUID?.()
      ?? `seat-hold-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
      const availableIds = new Set(
        freshSeats
          .filter((seat) => seat.status === "AVAILABLE" || (seat.status === "LOCKED" && seat.reservedByMe))
          .map((seat) => seat.seatId)
      );
      const restoredIds = pendingSeatRestoreRef.current;
      if (restoredIds.length > 0) {
        pendingSeatRestoreRef.current = [];
        restorePendingRef.current = false;

        const next = new Set(restoredIds.filter((seatId) => availableIds.has(seatId)));
        const rejectedIds = restoredIds.filter((seatId) => !availableIds.has(seatId));
        setSelected(next);
        if (rejectedIds.length > 0) {
          resumeAfterLoginRef.current = false;
          setConflicts(new Set(rejectedIds));
          setErrorMsg("Seat availability changed. Please review the highlighted positions and select again.");
          renewIdempotencyKey();
        } else if (resumeAfterLoginRef.current && next.size > 0) {
          // The customer already pressed Continue before authentication. Once
          // the fresh seat map confirms the complete selection, continue the
          // same intent automatically instead of asking for a second click.
          resumeAfterLoginRef.current = false;
          setAutoResumeReady(true);
        }
      } else {
        setSelected((previous) => new Set(
          Array.from(previous).filter((seatId) => availableIds.has(seatId))
        ));
      }
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
    if (!errorMsg) return;
    notify.error("Seats could not be reserved", errorMsg, { id: "seat-reservation-error" });
    const timer = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  // Keep the in-flight hold's idempotency key + seat selection recoverable
  // across a hard reload (see readPersistedSeatHold above).
  useEffect(() => {
    if (!showtimeId) return;
    if (selected.size === 0) {
      // Do not erase a login-resume draft during the first render, before the
      // asynchronous seat map has had a chance to validate and restore it.
      if (restorePendingRef.current) return;
      clearPersistedSeatHold(showtimeId);
      return;
    }
    persistSeatDraft(showtimeId, {
      idempotencyKey: idempotencyKeyRef.current,
      seatIds: Array.from(selected),
      resumeAfterLogin: resumeAfterLoginRef.current,
    });
  }, [selected, showtimeId]);

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
      const nextSocket = new WebSocket(seatInventoryWebSocketUrl(showtimeId));
      socket = nextSocket;

      nextSocket.onopen = () => {
        if (disposed || socket !== nextSocket) {
          nextSocket.close(1000, "Seat inventory connection is no longer needed");
          return;
        }
        reconnectAttempt = 0;
        setRealtimeConnected(true);
        // A connection may have been offline while inventory changed.
        // Reload the complete map through REST; never reconstruct state from
        // missed WebSocket messages.
        void loadSeats(true);
      };

      nextSocket.onmessage = (message) => {
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

      nextSocket.onerror = () => {
        // A failed WebSocket handshake is followed by `close` in browsers.
        // Closing a CONNECTING socket here creates a false console error in
        // React Strict Mode, where effects are mounted and cleaned up twice.
        if (!disposed && socket === nextSocket) setRealtimeConnected(false);
      };
      nextSocket.onclose = () => {
        if (socket === nextSocket) socket = null;
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const activeSocket = socket;
      socket = null;
      if (!activeSocket) return;

      activeSocket.onmessage = null;
      activeSocket.onerror = null;
      activeSocket.onclose = null;
      if (activeSocket.readyState === WebSocket.OPEN) {
        activeSocket.close(1000, "Seat booking page closed");
      } else if (activeSocket.readyState === WebSocket.CONNECTING) {
        // Let the handshake finish before closing. Calling close() while the
        // socket is CONNECTING is what produced
        // "WebSocket is closed before the connection is established".
        activeSocket.onopen = () =>
          activeSocket.close(1000, "Seat booking page closed");
      }
    };
  }, [loadSeats, showtimeId]);

  useEffect(() => {
    // Slow REST fallback covers environments where WebSocket upgrade is not
    // available. It intentionally reloads the complete map.
    pollRef.current = setInterval(() => { void loadSeats(true); }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadSeats]);

  // A COUPLE/sofa seat renders as one clickable button (see seatsByGroup
  // below) but is backed by 2+ ShowtimeSeat rows sharing a seatGroupId. The
  // hold API expands each requested id to its full group before counting
  // against maxSeatsPerBooking (ShowtimeSeatHoldService.validateExpandedSelection),
  // so the client must count the same way here — otherwise the UI lets a
  // customer pick a selection under the limit that the server then rejects
  // as SEAT_HOLD_SELECTION_INVALID at the very last step.
  const physicalSeatCountById = useMemo(() => {
    const perGroup = new Map<string, number>();
    seats.forEach((seat) => {
      if (!seat.seatGroupId) return;
      perGroup.set(seat.seatGroupId, (perGroup.get(seat.seatGroupId) ?? 0) + 1);
    });
    const perSeatId = new Map<number, number>();
    seats.forEach((seat) => {
      perSeatId.set(seat.seatId, seat.seatGroupId ? (perGroup.get(seat.seatGroupId) ?? 1) : 1);
    });
    return perSeatId;
  }, [seats]);

  const toggleSeat = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const currentPhysicalCount = Array.from(prev).reduce(
          (sum, seatId) => sum + (physicalSeatCountById.get(seatId) ?? 1),
          0
        );
        const addedPhysicalCount = physicalSeatCountById.get(id) ?? 1;
        if (currentPhysicalCount + addedPhysicalCount > holdPolicy.maxSeatsPerBooking) {
          setErrorMsg(`You can reserve up to ${holdPolicy.maxSeatsPerBooking} seats per booking.`);
          return prev;
        }
        next.add(id);
      }
      renewIdempotencyKey();
      return next;
    });
    setConflicts((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, [holdPolicy.maxSeatsPerBooking, physicalSeatCountById, renewIdempotencyKey]);

  const clearAll = () => {
    renewIdempotencyKey();
    setSelected(new Set());
    setConflicts(new Set());
    setErrorMsg(null);
  };

  const handleConfirm = useCallback(async () => {
    if (selected.size === 0 || !showtimeId) return;

    // Gate 1: chưa đăng nhập
    if (!user) {
      const currentState =
        location.state && typeof location.state === "object"
          ? location.state
          : {};
      const selectedSeatIds = Array.from(selected);

      resumeAfterLoginRef.current = true;
      persistSeatDraft(showtimeId, {
        idempotencyKey: idempotencyKeyRef.current,
        seatIds: selectedSeatIds,
        resumeAfterLogin: true,
      });

      navigate("/login", {
        state: {
          returnTo: `${location.pathname}${location.search}${location.hash}`,
          returnState: {
            ...currentState,
            resumeSeatIds: selectedSeatIds,
            resumeAfterLogin: true,
          },
        },
      });
      return;
    }

    // A previous hold is still active; resume its checkout profile step.
    if (pendingBooking) {
      if (!profileCheckPending && needsProfileSetup) setShowProfileModal(true);
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

      clearPersistedSeatHold(showtimeId);
      if (needsProfileSetup || profileCheckPending) {
        // Hold scarce inventory before collecting profile details so the
        // selected seats cannot be taken while the customer fills the form.
        setPendingBooking(result);
        setScreen("map");
        if (needsProfileSetup) setShowProfileModal(true);
        return;
      }

      // The checkout page (BookingCheckoutPage) re-fetches and displays the
      // same booking summary plus the actual payment step, so landing on an
      // interstitial "seats reserved" screen first was a redundant extra
      // click. Its "release without telling booking-service" behavior was
      // also a real bug: releasing the hold directly against movie-service
      // left the booking stuck at PENDING_PAYMENT until BookingExpiryScheduler
      // caught up, instead of going through POST /api/bookings/{id}/cancellations.
      continueToCheckout(result);
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
        const backendMessage = errResponse?.message || errResponse?.error;
        setErrorMsg(
          status === 401
            ? "Your session has expired. Sign in again to continue."
            : status === 400 || status === 404 || status === 409 || status === 422
              ? backendMessage || "This promotion code is invalid or not eligible for this booking."
            : status >= 500
              ? "We could not reserve these seats right now. Please try again in a moment."
              : "We could not complete the reservation. Review your selection and try again."
        );
      }
    }
  }, [
    continueToCheckout,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    needsProfileSetup,
    pendingBooking,
    profileCheckPending,
    selected,
    showtimeId,
    user,
  ]);

  useEffect(() => {
    if (!autoResumeReady || !user || selected.size === 0 || !showtimeId) return;
    if (autoResumeSubmissionStartedRef.current) return;
    autoResumeSubmissionStartedRef.current = true;

    setAutoResumeReady(false);
    persistSeatDraft(showtimeId, {
      idempotencyKey: idempotencyKeyRef.current,
      seatIds: Array.from(selected),
      resumeAfterLogin: false,
    });

    // Consume the one-shot resume intent before creating the booking. This
    // prevents Back/refresh from automatically submitting the same checkout
    // intent again; the persisted idempotency key still protects an in-flight
    // request from duplication.
    const cleanState = location.state && typeof location.state === "object"
      ? { ...(location.state as Record<string, unknown>) }
      : {};
    delete cleanState.resumeSeatIds;
    delete cleanState.resumeAfterLogin;
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: cleanState,
    });

    void handleConfirm();
  }, [
    autoResumeReady,
    handleConfirm,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    selected,
    showtimeId,
    user,
  ]);

  if (isLoadingSeats) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: COSMIC_PAGE_BG }}>
        <div className="cp-stars pointer-events-none fixed inset-0" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-[#60a5fa]" />
          <p className="text-white/70">Loading seat map...</p>
        </div>
      </div>
    );
  }

  if (seatFetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-['Inter',sans-serif]" style={{ background: COSMIC_PAGE_BG }}>
        <div className="cp-stars pointer-events-none fixed inset-0" aria-hidden="true" />
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111214] p-7 text-center shadow-2xl">
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
              onClick={() => void loadSeats()}
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
  // Keep a single seat close to the admin-layout proportions instead of stretching
  // every column to fill the auditorium. Wide rooms may shrink to fit the panel,
  // while narrow rooms stay centred at their natural visual width.
  const seatGridGap = 6;
  const seatGridLabelSpace = 48;
  const seatGridMaxWidth = physicalColumnCount * 44
    + Math.max(0, physicalColumnCount - 1) * seatGridGap
    + seatGridLabelSpace;
  const seatGridMinWidth = Math.min(
    seatGridMaxWidth,
    Math.max(
      480,
      physicalColumnCount * 32
        + Math.max(0, physicalColumnCount - 1) * seatGridGap
        + seatGridLabelSpace,
    ),
  );
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

  return (
    <div
      className="min-h-screen text-white"
      style={{ fontFamily: "'Inter', sans-serif", background: COSMIC_PAGE_BG }}
    >
      {/* Page-wide twinkling starfield, matching the movie-detail page —
          keeps the booking flow feeling cosmic instead of dropping to flat
          black once the seat panel scrolls past. */}
      <div className="cp-stars pointer-events-none fixed inset-0" aria-hidden="true" />
      {/* Two faint, oversized rings anchored above the seat panel — echoes
          the "light beaming from the screen into space" idea from Option B. */}
      <div className="pointer-events-none fixed left-1/2 top-0 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" aria-hidden="true" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[1200px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035]" aria-hidden="true" />

      {/* Header — a soft cosmic glow bleeding in from the left edge (instead
          of a flat near-black bar) plus a small "Now booking" eyebrow, so
          this bar reads as part of the same system as the progress row and
          seat panel below it rather than a disconnected strip. */}
      <header
        className="sticky top-16 mt-16 z-20 border-b border-white/10 backdrop-blur"
        style={{
          background:
            "radial-gradient(60% 160% at 8% 0%, rgba(37,99,235,.22), transparent 65%), " +
            "linear-gradient(to bottom, rgba(12,16,28,0.92), rgba(5,8,16,0.85))",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1540px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white mr-1 cursor-pointer"
          >
            <X size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="mb-0.5 hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,.8)]" />
              Now booking
            </p>
            <h1 className="text-base sm:text-lg font-extrabold text-white leading-tight truncate"
              style={{ fontFamily: "'Inter', sans-serif" }}>
              {showtimeDetails.movieTitle}
            </h1>
          </div>
          {/* Only surface this as an alert when live inventory sync drops —
              a permanent "Live" badge carries no information the customer
              acts on, so we stay silent while the connection is healthy. */}
          {!realtimeConnected && (
            <span
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300"
              title="Live inventory updates unavailable — falling back to periodic refresh"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Reconnecting
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1540px] px-4 pt-8 sm:px-6 lg:px-8">
        <CheckoutProgress currentStep={1} />
      </div>
      <div className="mx-auto grid w-full max-w-[1540px] grid-cols-1 gap-6 px-4 pb-20 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">

        {/* Left: map */}
        <div className="flex min-w-0 flex-col gap-5">

          {/* Seat map panel — a richer glow bleeding down from the top edge,
              as if the projection screen itself is the light source. */}
          <div
            className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 px-3 py-6 sm:px-6"
            style={{ background: "radial-gradient(140% 90% at 50% -6%, rgba(59,130,246,0.16), rgba(56,189,248,0.05) 40%, transparent 72%)" }}
          >
            <div className={`relative ${showProjector ? "pb-7" : ""}`}>
              <ProjectionScreenVisualization config={auditoriumConfig} />
              <ProjectionBeamOverlay technologyCode={auditoriumConfig.projectionTechnologyCode} />
              <AudioCoverageFrame config={auditoriumConfig}>

          {/* Seat rows */}
          <div className="flex min-w-0 flex-col items-center overflow-x-auto pb-2">
              <div
                className="flex w-full flex-col gap-2 px-1"
                style={{
                  minWidth: `${seatGridMinWidth}px`,
                  maxWidth: `${seatGridMaxWidth}px`,
                }}
              >
                {physicalRows.map(({ rowIndex, rowLabel, positions }) => {
                  const renderedGroups = new Set<string>();
                  const rowSeat = positions
                    .map((position) => seatsByCode.get(position.seatCode ?? "") ?? seatsByGroup.get(position.seatGroupId ?? ""))
                    .find(Boolean);
                  const rowTheme = SEAT_TYPE_THEME[rowSeat?.type ?? "STANDARD"];

                  return (
                    <div key={rowIndex} className="flex w-full min-w-0 items-center gap-1 sm:gap-2">
                      <span className="w-4 shrink-0 text-center text-[10px] font-bold sm:w-5 sm:text-[11px]" style={{ color: rowTheme.text }}>{rowLabel}</span>
                      <div
                        className="grid min-w-0 flex-1 gap-1 sm:gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${physicalColumnCount}, minmax(0, 1fr))` }}
                      >
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
                            <div key={positionKey} className="min-w-0" style={{ gridColumn: `span ${colSpan}` }}>
                              <SeatBtn seat={seat} selected={selected.has(seat.seatId)} conflict={conflicts.has(seat.seatId)} onToggle={toggleSeat} />
                            </div>
                          );
                        })}
                      </div>
                      <span className="w-4 shrink-0 text-center text-[10px] font-bold sm:w-5 sm:text-[11px]" style={{ color: rowTheme.text }}>{rowLabel}</span>
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
        <BookingSummaryCard
          movieName={showtimeDetails.movieTitle}
          posterUrl={showtimeDetails.posterUrl}
          ageRatingCode={showtimeDetails.ageRatingCode}
          durationMinutes={showtimeDetails.duration || undefined}
          cinemaName={showtimeDetails.cinemaName}
          roomName={showtimeDetails.hall}
          showDateLabel={formatBookingDate(new Date(showtimeDetails.dateTime))}
          showTimeLabel={new Date(showtimeDetails.dateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          seats={pickedSeats.map((seat) => ({
            id: seat.seatId,
            code: seat.seatCode?.trim() || `${seat.row}${seat.number}`,
            type: seat.type,
            price: seat.price,
          }))}
          onRemoveSeat={(seat) => toggleSeat(seat.id!)}
          maxSeats={holdPolicy.maxSeatsPerBooking}
          holdMinutes={Math.round(holdPolicy.ttlSeconds / 60)}
          emptyHint="Select seats from the map"
          total={total}
          headerAction={pickedSeats.length > 0 ? { label: "Clear all", onClick: clearAll } : undefined}
          backAction={{ label: "Back", onClick: () => navigate(-1) }}
          primaryAction={pickedSeats.length > 0 ? {
            label: screen === "confirming"
              ? "Reserving seats..."
              : pendingBooking && profileCheckPending
                ? "Checking profile..."
              : pendingBooking
                ? "Continue"
                : "Continue",
            onClick: handleConfirm,
            disabled: screen === "confirming" || Boolean(pendingBooking && profileCheckPending),
            loading: screen === "confirming" || Boolean(pendingBooking && profileCheckPending),
          } : undefined}
        />
      </div>

      {/* Profile completion modal — overlays the booking page */}
      {showProfileModal && (
        <CompleteProfilePage
          checkoutMode
          onClose={() => setShowProfileModal(false)}
          onDone={() => {
            setShowProfileModal(false);
            if (!pendingBooking) return;
            const booking = pendingBooking;
            setPendingBooking(null);
            continueToCheckout(booking);
          }}
        />
      )}
    </div>
  );
}
