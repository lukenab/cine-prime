import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MapPin,
  RefreshCw,
  RotateCcw,
  Ticket,
} from "lucide-react";
import {
  bookingApi,
  type BookingDetail,
  type BookingPage,
  type CancellationResult,
} from "../../api/bookingApi";
import CancelBookingModal from "../../components/booking/CancelBookingModal";
import {
  bookingStatusMeta,
  canCancelBooking,
  formatBookingDate,
  formatBookingMoney,
  getApiErrorMessage,
} from "../../components/booking/bookingUi";
import "../../components/booking/booking.css";
import "./MyBookingsPage.css";

type Filter = "ALL" | "ACTIVE" | "CONFIRMED" | "CLOSED";

export default function MyBookingsPage() {
  const [result, setResult] = useState<BookingPage | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<BookingDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await bookingApi.getMyBookings({ page, size: 10, sort: "createdAt,desc" }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Your booking history could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const content = result?.content ?? [];
    if (filter === "ACTIVE") {
      return content.filter((item) =>
        ["PENDING_PAYMENT", "CONFIRM_PENDING", "CANCEL_REQUESTED", "REFUND_PENDING"].includes(item.status),
      );
    }
    if (filter === "CONFIRMED") return content.filter((item) => item.status === "CONFIRMED");
    if (filter === "CLOSED") {
      return content.filter((item) => ["EXPIRED", "CANCELLED", "REFUNDED"].includes(item.status));
    }
    return content;
  }, [filter, result]);

  const onCancelled = (_result: CancellationResult) => {
    setCancelTarget(null);
    void load();
  };

  return (
    <main className="booking-shell">
      <div className="booking-container">
        <div className="booking-page-heading">
          <div>
            <span className="booking-eyebrow">Account</span>
            <h1>My bookings</h1>
            <p>Track payments, open digital tickets, or request a cancellation.</p>
          </div>
          <button className="booking-button booking-button--secondary" onClick={() => void load()}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="my-bookings-tabs" role="tablist">
          {(["ALL", "ACTIVE", "CONFIRMED", "CLOSED"] as Filter[]).map((item) => (
            <button
              key={item}
              className={filter === item ? "is-active" : ""}
              onClick={() => setFilter(item)}
              role="tab"
            >
              {item === "ALL" ? "All bookings" : item.charAt(0) + item.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="booking-loading"><LoaderCircle className="booking-spin" size={30} /></div>
        ) : error ? (
          <div className="booking-empty"><div className="booking-empty__inner"><h2>Unable to load bookings</h2><p>{error}</p></div></div>
        ) : visible.length === 0 ? (
          <div className="booking-empty">
            <div className="booking-empty__inner">
              <Ticket size={38} />
              <h2>No bookings in this view</h2>
              <p>Bookings created from an on-sale showtime will appear here.</p>
              <Link to="/movies" className="booking-button booking-button--primary">Browse movies</Link>
            </div>
          </div>
        ) : (
          <div className="my-bookings-list">
            {visible.map((booking) => {
              const status = bookingStatusMeta[booking.status];
              return (
                <article className="my-booking-card" key={booking.bookingId}>
                  <div className="my-booking-card__main">
                    <span className="booking-status" style={{ color: status.color, background: status.background }}>{status.label}</span>
                    <small>{booking.bookingCode}</small>
                    <h2>{booking.movieName}</h2>
                    <div className="my-booking-card__meta">
                      <span><CalendarDays size={14} /> {formatBookingDate(booking.showDate)} · {booking.startTime?.slice(0, 5)}</span>
                      <span><MapPin size={14} /> {booking.cinemaClusterName} · {booking.cinemaRoomName}</span>
                    </div>
                  </div>
                  <div className="my-booking-card__summary">
                    <small>{booking.seats.map((seat) => seat.seatCode).join(", ")}</small>
                    <strong>{formatBookingMoney(booking.total, booking.currency)}</strong>
                    <div className="my-booking-card__actions">
                      {canCancelBooking(booking) && (
                        <button className="booking-button booking-button--danger" onClick={() => setCancelTarget(booking)}>
                          <RotateCcw size={15} /> Cancel
                        </button>
                      )}
                      <Link className="booking-button booking-button--primary" to={`/checkout/${booking.bookingId}`}>
                        {booking.status === "CONFIRMED" ? "View ticket" : "View booking"}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {(result?.totalPages ?? 0) > 1 && (
          <div className="my-bookings-pagination">
            <button className="booking-icon-button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ChevronLeft size={17} /></button>
            <span>Page {page + 1} of {result?.totalPages}</span>
            <button className="booking-icon-button" onClick={() => setPage((value) => value + 1)} disabled={result?.last}><ChevronRight size={17} /></button>
          </div>
        )}
      </div>

      <CancelBookingModal
        open={!!cancelTarget}
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCompleted={onCancelled}
      />
    </main>
  );
}
