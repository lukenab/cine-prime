import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TicketCheck,
  User,
  WalletCards,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  bookingApi,
  type BookingDetail,
  type CancellationResult,
  type TicketPass,
} from "../../api/bookingApi";
import { paymentApi, type PaymentSession } from "../../api/paymentApi";
import { movieApi, type ClusterResponse, type PublicMovieResponse } from "../../api/movieApi";
import { userApi } from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import CancelBookingModal from "../../components/booking/CancelBookingModal";
import {
  bookingStatusMeta,
  canCancelBooking,
  formatBookingDate,
  formatBookingDateTime,
  formatBookingMoney,
  getApiErrorMessage,
  isBookingInFlight,
  paymentStatusLabel,
} from "../../components/booking/bookingUi";
import "../../components/booking/booking.css";

// VNPAY sends the raw method code back on its callback (vnp_CardType); this
// only translates the handful of values the sandbox and common issuers use.
const VNPAY_CARD_TYPE_LABEL: Record<string, string> = {
  ATM: "Domestic ATM card",
  QRCODE: "VNPayQR",
  INTCARD: "International card",
  VNPAYQR: "VNPayQR",
};

function paymentMethodLabel(session: PaymentSession | null): string | null {
  if (!session) return null;
  if (session.bankCode) {
    const method = session.cardType ? VNPAY_CARD_TYPE_LABEL[session.cardType] ?? session.cardType : null;
    return method ? `${session.bankCode} · ${method}` : session.bankCode;
  }
  return session.provider || null;
}

// A booking that has already been paid (CONFIRMED) or is mid-confirmation
// (CONFIRM_PENDING) needs a refund if the customer backs out — cancelling an
// unpaid PENDING_PAYMENT hold never involves money. CancelBookingModal already
// branches its copy on this; the page-level button label needs to match.
const isPaidBooking = (bookingStatus: BookingDetail["status"]) =>
  bookingStatus === "CONFIRMED" || bookingStatus === "CONFIRM_PENDING";

function computeShowEndTime(showDate: string, startTime: string, durationMinutes?: number): string | null {
  if (!durationMinutes) return null;
  const start = new Date(`${showDate}T${startTime}`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(end);
}

export default function BookingCheckoutPage() {
  const { bookingId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [ticketPass, setTicketPass] = useState<TicketPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [startingPayment, setStartingPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [movieDetail, setMovieDetail] = useState<PublicMovieResponse | null>(null);
  const [clusterDetail, setClusterDetail] = useState<ClusterResponse | null>(null);
  const [bookerName, setBookerName] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentSession | null>(null);
  const paymentResult = searchParams.get("paymentResult")?.toUpperCase();

  // Enrichment data (movie duration/age rating/genres, full cinema address,
  // booker's display name): BookingDetail only carries IDs + denormalized
  // names, so these are separate, best-effort fetches against movie-service
  // and user-service. A failure here must never block the booking itself
  // from rendering — the ticket is still usable with the fields it has.
  useEffect(() => {
    if (!booking?.movieId) return;
    let active = true;
    movieApi.getPublicMovieDetail(booking.movieId)
      .then((res) => { if (active) setMovieDetail(res.result); })
      .catch(() => {});
    return () => { active = false; };
  }, [booking?.movieId]);

  useEffect(() => {
    if (!booking?.cinemaClusterId) return;
    let active = true;
    movieApi.getClusterById(booking.cinemaClusterId)
      .then((res) => { if (active) setClusterDetail(res.result); })
      .catch(() => {});
    return () => { active = false; };
  }, [booking?.cinemaClusterId]);

  useEffect(() => {
    if (!user?.accountId) return;
    let active = true;
    userApi.getUserById(user.accountId)
      .then((res: any) => { if (active) setBookerName(res?.result?.fullName || res?.fullName || null); })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.accountId]);

  useEffect(() => {
    if (!bookingId || !booking || booking.status === "PENDING_PAYMENT") return;
    let active = true;
    paymentApi.getByBooking(bookingId)
      .then((session) => { if (active) setPaymentDetail(session); })
      .catch(() => {});
    return () => { active = false; };
  }, [bookingId, booking?.status]);

  const load = useCallback(async (quiet = false) => {
    if (!bookingId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const detail = await bookingApi.getBooking(bookingId);
      setBooking(detail);
      if (detail.status === "CONFIRMED") {
        try {
          setTicketPass(await bookingApi.getTicketPass(bookingId));
        } catch {
          setTicketPass(null);
        }
      } else {
        setTicketPass(null);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "This booking could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isBookingInFlight(booking)) return;
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [booking, load]);

  const onCancelled = (_result: CancellationResult) => {
    setCancelOpen(false);
    void load(true);
  };

  const startPayment = async () => {
    if (!bookingId || booking?.status !== "PENDING_PAYMENT") return;
    setStartingPayment(true);
    setPaymentError("");
    try {
      const storageKey = `cineprime:payment-idempotency:${bookingId}`;
      let idempotencyKey = window.sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = window.crypto.randomUUID();
        window.sessionStorage.setItem(storageKey, idempotencyKey);
      }
      const session = await paymentApi.createSession(bookingId, idempotencyKey);
      if (!session.paymentUrl) {
        throw new Error("The payment provider did not return a checkout URL.");
      }
      window.location.assign(session.paymentUrl);
    } catch (requestError) {
      setPaymentError(
        getApiErrorMessage(
          requestError,
          "Payment could not be started. Your seats remain held until the displayed expiry time.",
        ),
      );
    } finally {
      setStartingPayment(false);
    }
  };

  if (loading) {
    return (
      <main className="booking-shell">
        <div className="booking-loading"><LoaderCircle className="booking-spin" size={32} /></div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="booking-shell">
        <div className="booking-empty">
          <div className="booking-empty__inner">
            <AlertCircle size={38} />
            <h2>Booking unavailable</h2>
            <p>{error || "The booking does not exist or you do not have access to it."}</p>
            <Link className="booking-button booking-button--primary" to="/my-bookings">View my bookings</Link>
          </div>
        </div>
      </main>
    );
  }

  const status = bookingStatusMeta[booking.status];

  if (booking.status === "CONFIRMED" && ticketPass) {
    const method = paymentMethodLabel(paymentDetail);
    return (
      <main className="booking-shell">
        <div className="booking-container booking-container--ticket">
          <div className="booking-page-heading">
            <div>
              <span className="booking-eyebrow">Booking · {booking.bookingCode}</span>
              <h1>Your ticket is ready</h1>
              <p>Booking state is updated automatically when payment or inventory changes.</p>
            </div>
            <span className="booking-status" style={{ color: status.color, background: status.background }}>
              <CheckCircle2 size={15} /> {status.label}
            </span>
          </div>

          <div className="ticket-pass">
            <div className="ticket-pass__main">
              <div className="ticket-pass__header">
                {movieDetail?.posterUrl && (
                  <img className="ticket-pass__poster" src={movieDetail.posterUrl} alt="" />
                )}
                <div className="ticket-pass__header-info">
                  <h2>{booking.movieName}</h2>
                  <div className="ticket-pass__chips">
                    {movieDetail?.ageRating && (
                      <span className="ticket-pass__chip ticket-pass__chip--age">{movieDetail.ageRating.ratingCode}</span>
                    )}
                    {movieDetail?.durationMinutes ? (
                      <span className="ticket-pass__chip"><Clock3 size={11} /> {movieDetail.durationMinutes} min</span>
                    ) : null}
                    {movieDetail?.genres?.length ? (
                      <span className="ticket-pass__chip">{movieDetail.genres.map((g) => g.genreName).join(", ")}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="ticket-pass__body">
                <div className="ticket-pass__row">
                  <MapPin size={15} />
                  <div>
                    <strong>{booking.cinemaClusterName}</strong>
                    {clusterDetail?.address && <span>{clusterDetail.address}</span>}
                  </div>
                </div>

                <div className="ticket-pass__grid">
                  <div><span>Date</span><strong>{formatBookingDate(booking.showDate)}</strong></div>
                  <div>
                    <span>Showtime</span>
                    <strong>
                      {booking.startTime?.slice(0, 5) || "—"}
                      {(() => {
                        const end = computeShowEndTime(booking.showDate, booking.startTime, movieDetail?.durationMinutes);
                        return end ? ` – ${end}` : "";
                      })()}
                    </strong>
                  </div>
                  <div><span>Screening room</span><strong>{booking.cinemaRoomName}</strong></div>
                  <div><span>Seats</span><strong>{booking.seats.map((s) => s.seatCode).join(", ")}</strong></div>
                </div>

                <div className="ticket-pass__grid">
                  <div>
                    <span><User size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Booked by</span>
                    <strong>{bookerName || user?.username || "—"}</strong>
                  </div>
                  <div>
                    <span><CreditCard size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Payment method</span>
                    <strong>{method || "—"}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="ticket-pass__perforation">
              <span className="ticket-pass__notch ticket-pass__notch--top" />
              <span className="ticket-pass__notch ticket-pass__notch--bottom" />
            </div>

            <div className="ticket-pass__stub">
              <div className="ticket-pass__qr"><QRCodeSVG value={ticketPass.passToken} size={148} level="M" /></div>
              <div className="ticket-pass__stub-info">
                <span>{ticketPass.bookingCode}</span>
                <strong>{formatBookingMoney(booking.total, booking.currency)}</strong>
              </div>
            </div>
          </div>

          <section className="booking-card">
            <header className="booking-card__header">
              <div>
                <h2>Present at check-in</h2>
                <p>Show the QR code above at your cinema. Keep it private.</p>
              </div>
              <button
                className="booking-icon-button"
                onClick={() => void load(true)}
                aria-label="Refresh booking"
                disabled={refreshing}
              >
                <RefreshCw size={16} className={refreshing ? "booking-spin" : ""} />
              </button>
            </header>
            <div className="booking-card__body">
              <div className="booking-actions">
                <Link className="booking-button booking-button--secondary" to="/my-bookings">My bookings</Link>
                {canCancelBooking(booking) && (
                  <button className="booking-button booking-button--danger" onClick={() => setCancelOpen(true)}>
                    <RotateCcw size={16} /> {isPaidBooking(booking.status) ? "Request a refund" : "Cancel booking"}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <CancelBookingModal
          open={cancelOpen}
          booking={booking}
          onClose={() => setCancelOpen(false)}
          onCompleted={onCancelled}
        />
      </main>
    );
  }

  return (
    <main className="booking-shell">
      <div className="booking-container">
        <div className="booking-page-heading">
          <div>
            <span className="booking-eyebrow">Booking · {booking.bookingCode}</span>
            <h1>{booking.status === "CONFIRMED" ? "Your ticket is ready" : "Complete your booking"}</h1>
            <p>Booking state is updated automatically when payment or inventory changes.</p>
          </div>
          <span className="booking-status" style={{ color: status.color, background: status.background }}>
            {booking.status === "CONFIRMED" ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
            {status.label}
          </span>
        </div>

        <div className="booking-grid">
          <div>
            <section className="booking-card">
              <header className="booking-card__header">
                <div>
                  <h2>{booking.movieName}</h2>
                  <p>
                    {movieDetail?.durationMinutes ? `${movieDetail.durationMinutes} min` : "Showtime and cinema"}
                    {movieDetail?.ageRating ? ` · ${movieDetail.ageRating.ratingCode}` : ""}
                  </p>
                </div>
                <TicketCheck size={22} color="#60a5fa" />
              </header>
              <div className="booking-card__body">
                <div className="booking-detail-grid">
                  <div className="booking-detail">
                    <span><CalendarDays size={12} /> Date</span>
                    <strong>{formatBookingDate(booking.showDate)}</strong>
                  </div>
                  <div className="booking-detail">
                    <span><Clock3 size={12} /> Showtime</span>
                    <strong>{booking.startTime?.slice(0, 5) || "—"}</strong>
                  </div>
                  <div className="booking-detail">
                    <span><MapPin size={12} /> Cinema</span>
                    <strong>{booking.cinemaClusterName}</strong>
                    {clusterDetail?.address && <small style={{ display: "block", fontWeight: 400, color: "#8390a2", marginTop: 3 }}>{clusterDetail.address}</small>}
                  </div>
                  <div className="booking-detail">
                    <span>Screening room</span>
                    <strong>{booking.cinemaRoomName}</strong>
                  </div>
                  <div className="booking-detail">
                    <span><User size={12} /> Booked by</span>
                    <strong>{bookerName || user?.username || "—"}</strong>
                  </div>
                  <div className="booking-detail">
                    <span><CreditCard size={12} /> Payment method</span>
                    <strong>{paymentMethodLabel(paymentDetail) || "—"}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="booking-card">
              <header className="booking-card__header">
                <div><h2>Selected seats</h2><p>{booking.seats.length} seat{booking.seats.length === 1 ? "" : "s"}</p></div>
              </header>
              <div className="booking-card__body">
                <div className="booking-seat-list">
                  {booking.seats.map((seat) => (
                    <div className="booking-seat-chip" key={seat.showtimeSeatId}>
                      <div><strong>{seat.seatCode}</strong><br /><small>{seat.seatType}</small></div>
                      <strong>{formatBookingMoney(seat.finalPrice, booking.currency)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="booking-card">
              <header className="booking-card__header">
                <div><h2>Booking status</h2><p>{status.description}</p></div>
                <button
                  className="booking-icon-button"
                  onClick={() => void load(true)}
                  aria-label="Refresh booking"
                  disabled={refreshing}
                >
                  <RefreshCw size={16} className={refreshing ? "booking-spin" : ""} />
                </button>
              </header>
              <div className="booking-card__body">
                {paymentResult === "PAID" && booking.status !== "CONFIRMED" && (
                  <div className="booking-message booking-message--success booking-return-message">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>Payment accepted</strong>
                      <p>We are confirming your seats and preparing the digital ticket.</p>
                    </div>
                  </div>
                )}
                {paymentResult && ["FAILED", "EXPIRED", "UNKNOWN"].includes(paymentResult) && (
                  <div className="booking-message booking-message--warning booking-return-message">
                    <AlertCircle size={20} />
                    <div>
                      <strong>Payment was not completed</strong>
                      <p>You can retry while the seat hold is still active.</p>
                    </div>
                  </div>
                )}
                {booking.status === "PENDING_PAYMENT" && (
                  <div className="booking-message booking-message--warning">
                    <Clock3 size={20} />
                    <div>
                      <strong>Waiting for payment</strong>
                      <p>
                        Your seats are reserved until {formatBookingDateTime(booking.expiresAt)}.
                        Complete payment before this time to keep the reservation.
                      </p>
                    </div>
                  </div>
                )}
                {paymentError && (
                  <div className="booking-inline-error booking-payment-error">
                    {paymentError}
                  </div>
                )}
                {booking.status === "CONFIRM_PENDING" && (
                  <div className="booking-message">
                    <LoaderCircle size={20} className="booking-spin" />
                    <div><strong>Payment received</strong><p>We are confirming seat ownership and issuing your ticket.</p></div>
                  </div>
                )}
                {booking.status === "CONFIRMED" && (
                  <div className="booking-message booking-message--success">
                    <CheckCircle2 size={20} />
                    <div><strong>Booking confirmed</strong><p>Present the ticket pass at your cinema. Keep the QR code private.</p></div>
                  </div>
                )}
                {["EXPIRED", "CANCELLED", "REFUNDED"].includes(booking.status) && (
                  <div className="booking-message">
                    <AlertCircle size={20} />
                    <div><strong>{status.label}</strong><p>{status.description}</p></div>
                  </div>
                )}

                <div className="booking-actions">
                  {booking.status === "PENDING_PAYMENT" && (
                    <button
                      className="booking-button booking-button--primary booking-button--pay"
                      onClick={() => void startPayment()}
                      disabled={startingPayment}
                    >
                      {startingPayment ? (
                        <LoaderCircle size={17} className="booking-spin" />
                      ) : (
                        <WalletCards size={17} />
                      )}
                      {startingPayment ? "Opening VNPAY…" : "Pay securely with VNPAY"}
                    </button>
                  )}
                  <Link className="booking-button booking-button--secondary" to="/my-bookings">My bookings</Link>
                  {canCancelBooking(booking) && (
                    <button className="booking-button booking-button--danger" onClick={() => setCancelOpen(true)}>
                      <RotateCcw size={16} /> {isPaidBooking(booking.status) ? "Request a refund" : "Cancel booking"}
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside>
            <section className="booking-card">
              <header className="booking-card__header">
                <div><h2>Order summary</h2><p>Server-calculated price snapshot</p></div>
              </header>
              <div className="booking-card__body">
                <div className="booking-price-row"><span>Seats</span><strong>{formatBookingMoney(booking.subtotal, booking.currency)}</strong></div>
                <div className="booking-price-row"><span>Service fee</span><strong>{formatBookingMoney(booking.serviceFee, booking.currency)}</strong></div>
                {booking.discount > 0 && <div className="booking-price-row"><span>Discount</span><strong>-{formatBookingMoney(booking.discount, booking.currency)}</strong></div>}
                <div className="booking-price-row booking-price-row--total"><span>Total</span><strong>{formatBookingMoney(booking.total, booking.currency)}</strong></div>
                <div className="booking-price-row"><span>Payment</span><strong>{paymentStatusLabel[booking.paymentStatus]}</strong></div>
              </div>
            </section>

            {booking.status === "CONFIRMED" && ticketPass && (
              <section className="booking-card">
                <div className="booking-qr">
                  <span className="booking-eyebrow">Digital ticket pass</span>
                  <div className="booking-qr__code">
                    <QRCodeSVG value={ticketPass.passToken} size={178} level="M" />
                  </div>
                  <h3>{ticketPass.bookingCode}</h3>
                  <p>{ticketPass.seatCodes.join(", ")} · {ticketPass.clusterName}</p>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      <CancelBookingModal
        open={cancelOpen}
        booking={booking}
        onClose={() => setCancelOpen(false)}
        onCompleted={onCancelled}
      />
    </main>
  );
}
