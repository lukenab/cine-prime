import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  User,
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
import { useBookingFlowCancelAction } from "../../context/BookingFlowContext";
import CancelBookingModal from "../../components/booking/CancelBookingModal";
import CheckoutProgress from "../../components/booking/CheckoutProgress";
import BookingSummaryCard from "../../components/booking/BookingSummaryCard";
import {
  bookingStatusMeta,
  canCancelBooking,
  formatBookingDate,
  formatBookingMoney,
  getApiErrorMessage,
  isBookingInFlight,
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
  const navigate = useNavigate();
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
  const [payTab, setPayTab] = useState<"payment" | "promotion">("payment");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [movieDetail, setMovieDetail] = useState<PublicMovieResponse | null>(null);
  const [clusterDetail, setClusterDetail] = useState<ClusterResponse | null>(null);
  const [bookerName, setBookerName] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const paymentResult = searchParams.get("paymentResult")?.toUpperCase();

  // Same hold countdown shown on the Seats/Food steps, carried through here
  // so the customer keeps seeing it instead of only a static expiry line.
  useEffect(() => {
    if (!booking?.expiresAt || booking.status !== "PENDING_PAYMENT") return;
    const updateRemaining = () => {
      const expiry = new Date(booking.expiresAt as string).getTime();
      setRemainingSeconds(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [booking?.expiresAt, booking?.status]);

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

  const openCancel = useCallback(() => setCancelOpen(true), []);
  // Locks the navbar down to logo + this action while payment is still
  // pending; once a ticket exists the booking is no longer "in progress"
  // so the full navbar returns.
  useBookingFlowCancelAction(
    "Cancel booking",
    booking?.status === "PENDING_PAYMENT" && canCancelBooking(booking) ? openCancel : null,
  );

  // Promotions have no backend yet (no endpoint applies a code to a booking).
  // This stays a plain, honest "not available" response instead of faking a
  // discount, so it does not misrepresent what the system actually does.
  const applyPromoCode = () => {
    if (!promoCode.trim()) return;
    setPromoMessage("Promo codes aren't available yet — check back soon.");
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
      <main className="grid min-h-screen place-items-center bg-[#080b12] px-4 pt-24 text-white sm:px-8 sm:pt-28">
        <LoaderCircle className="animate-spin text-blue-400" size={32} />
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="min-h-screen bg-[#080b12] px-4 pb-7 pt-24 text-white sm:px-8 sm:pt-28">
        <div className="mx-auto max-w-[1320px]">
          <div className="booking-empty">
            <div className="booking-empty__inner">
              <AlertCircle size={38} />
              <h2>Booking unavailable</h2>
              <p>{error || "The booking does not exist or you do not have access to it."}</p>
              <Link className="booking-button booking-button--primary" to="/my-bookings">View my bookings</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const status = bookingStatusMeta[booking.status];
  const holdExpired = booking.status === "PENDING_PAYMENT" && remainingSeconds <= 0;

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

          <CheckoutProgress currentStep={4} />

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
                  {booking.concessionPickupCode && <div><span>Concession pickup</span><strong>{booking.concessionPickupCode}</strong></div>}
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
              {!!booking.concessions?.length && (
                <div className="ticket-pass__grid">
                  <div>
                    <span>Concessions</span>
                    <strong>{booking.concessions.map((item) => `${item.quantity}× ${item.itemName}`).join(", ")}</strong>
                  </div>
                  <div>
                    <span>Pickup code</span>
                    <strong>{booking.concessionPickupCode || "Preparing..."}</strong>
                  </div>
                </div>
              )}
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
    <main className="min-h-screen bg-[#080b12] px-4 pb-7 pt-24 text-white sm:px-8 sm:pt-28">
      <div className="mx-auto max-w-[1320px]">
        {/* Same shell/heading/grid dimensions as the Food step (same max
            width, gap, right-column width) so pressing Continue there lands
            here without anything visibly shifting. */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Checkout</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{booking.status === "CONFIRMED" ? "Your ticket is ready" : "Complete your booking"}</h1>
            <p className="mt-2 text-sm text-white/50">Booking state is updated automatically when payment or inventory changes.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* PENDING_PAYMENT is already unmistakable from the countdown
                timer and the "Booking status" card below — an "Awaiting
                payment" pill up here doesn't tell the customer anything new,
                so it's skipped for that state. Other statuses (confirmed,
                expired, refunded...) keep it since nothing else on the page
                signals them this clearly at a glance. */}
            {booking.status !== "PENDING_PAYMENT" && (
              <span className="booking-status" style={{ color: status.color, background: status.background }}>
                {booking.status === "CONFIRMED" ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                {status.label}
              </span>
            )}
            {/* PENDING_PAYMENT already gets "Cancel booking" from the locked
                navbar (see useBookingFlowCancelAction above); this stays only
                for the paid states, where it means "request a refund". */}
            {canCancelBooking(booking) && booking.status !== "PENDING_PAYMENT" && (
              <button
                type="button"
                className="booking-button booking-button--danger booking-button--compact"
                onClick={() => setCancelOpen(true)}
              >
                <RotateCcw size={14} /> {isPaidBooking(booking.status) ? "Request a refund" : "Cancel booking"}
              </button>
            )}
          </div>
        </div>

        <CheckoutProgress currentStep={booking.status === "CONFIRMED" ? 4 : 3} />

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <section className="booking-card">
              <header className="booking-card__header">
                {/* This card holds payment method + promo code once payment
                    is pending, not just a status readout, so the heading
                    follows what the customer is actually here to do. */}
                <div>
                  <h2>{booking.status === "PENDING_PAYMENT" ? "Payment" : "Booking status"}</h2>
                  <p>{booking.status === "PENDING_PAYMENT" ? "Choose how you'd like to pay." : status.description}</p>
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

                {/* Promo code + payment method moved here from the summary
                    card, which now only carries the order recap and the
                    Back / Pay actions. */}
                {booking.status === "PENDING_PAYMENT" && (
                  <div className="booking-payment-method">
                    <div className="booking-tabs" role="tablist" aria-label="Payment options">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={payTab === "payment"}
                        className={`booking-tab ${payTab === "payment" ? "booking-tab--active" : ""}`}
                        onClick={() => setPayTab("payment")}
                      >
                        Payment method
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={payTab === "promotion"}
                        className={`booking-tab ${payTab === "promotion" ? "booking-tab--active" : ""}`}
                        onClick={() => setPayTab("promotion")}
                      >
                        Promotion
                      </button>
                    </div>

                    {payTab === "payment" ? (
                      <div className="booking-payment-option booking-payment-option--selected">
                        <span className="booking-payment-option__logo" aria-hidden="true">
                          <svg width="44" height="22" viewBox="0 0 44 22" xmlns="http://www.w3.org/2000/svg">
                            <rect width="44" height="22" rx="4" fill="#ffffff" />
                            <text x="4" y="15.5" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="800" fill="#00509a">VN</text>
                            <text x="20" y="15.5" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="800" fill="#ed1c24">PAY</text>
                          </svg>
                        </span>
                        <div className="booking-payment-option__info">
                          <strong>VNPAY</strong>
                          <span>Domestic ATM, VNPayQR &amp; international cards</span>
                        </div>
                        <CheckCircle2 size={18} className="booking-payment-option__check" />
                      </div>
                    ) : (
                      <div className="booking-promo">
                        <label className="booking-promo__label" htmlFor="checkout-promo-code">Promotion code</label>
                        <div className="booking-promo__row">
                          <input
                            id="checkout-promo-code"
                            type="text"
                            value={promoCode}
                            onChange={(event) => { setPromoCode(event.target.value); setPromoMessage(""); }}
                            placeholder="Enter code"
                            className="booking-promo__input"
                          />
                          <button type="button" className="booking-promo__apply" onClick={applyPromoCode}>Apply</button>
                        </div>
                        {promoMessage && <p className="booking-promo__message">{promoMessage}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside>
            <BookingSummaryCard
              movieName={booking.movieName}
              posterUrl={movieDetail?.posterUrl}
              ageRatingCode={movieDetail?.ageRating?.ratingCode}
              durationMinutes={movieDetail?.durationMinutes}
              cinemaName={booking.cinemaClusterName}
              cinemaAddress={clusterDetail?.address}
              roomName={booking.cinemaRoomName}
              showDateLabel={formatBookingDate(booking.showDate)}
              showTimeLabel={booking.startTime?.slice(0, 5) || "—"}
              seats={booking.seats.map((seat) => ({ code: seat.seatCode, type: seat.seatType, price: seat.finalPrice }))}
              seatsSubtotal={booking.ticketSubtotal ?? booking.subtotal}
              comboItems={booking.concessions?.map((item) => ({ name: item.itemName, quantity: item.quantity, totalPrice: item.finalAmount }))}
              comboSubtotal={booking.concessionSubtotal}
              serviceFee={booking.serviceFee}
              discount={booking.discount}
              paymentMethod={paymentMethodLabel(paymentDetail) ?? undefined}
              currency={booking.currency}
              total={booking.total}
              holdRemainingSeconds={booking.status === "PENDING_PAYMENT" ? remainingSeconds : undefined}
              holdExpired={booking.status === "PENDING_PAYMENT" ? holdExpired : undefined}
              backAction={booking.status === "PENDING_PAYMENT" ? {
                label: "Back",
                onClick: () => navigate(-1),
              } : undefined}
              primaryAction={booking.status === "PENDING_PAYMENT" ? {
                label: startingPayment ? "Opening…" : "Pay now",
                onClick: () => void startPayment(),
                disabled: startingPayment,
                loading: startingPayment,
              } : undefined}
            />

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
