import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  CreditCard,
  LoaderCircle,
  MapPin,
  Popcorn,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Tag,
  User,
  X,
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
import { usePublicPromotionOffers } from "../../hooks/usePublicPromotionOffers";
import type { PublicPromotionOffer } from "../../api/promotionApi";
import { offerDiscountLabel, offerScopeLabel } from "../../utils/promotionOfferUi";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
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

function eligibleSubtotalForOffer(offer: PublicPromotionOffer, booking: BookingDetail): number {
  if (offer.benefitScope === "TICKETS") return booking.ticketSubtotal ?? 0;
  if (offer.benefitScope === "CONCESSIONS") return booking.concessionSubtotal ?? 0;
  return (booking.ticketSubtotal ?? 0) + (booking.concessionSubtotal ?? 0);
}

function offerRequirementMessage(offer: PublicPromotionOffer, booking: BookingDetail): string | null {
  const eligibleSubtotal = eligibleSubtotalForOffer(offer, booking);
  if (offer.benefitScope === "CONCESSIONS" && eligibleSubtotal <= 0) {
    return "Add food & drinks to your booking before using this offer.";
  }

  const minimum = Number(offer.minimumOrderAmount) || 0;
  if (eligibleSubtotal < minimum) {
    const remaining = minimum - eligibleSubtotal;
    const scope = offer.benefitScope === "TICKETS"
      ? "movie tickets"
      : offer.benefitScope === "CONCESSIONS"
        ? "food & drinks"
        : "your order";
    return `Add ${formatBookingMoney(remaining, offer.currency || booking.currency)} more in ${scope} to use this offer.`;
  }
  return null;
}

function promotionFailureMessage(error: unknown, offer?: PublicPromotionOffer): string {
  const apiMessage = getApiErrorMessage(error, "");
  const normalized = apiMessage.toLowerCase();
  if (normalized.includes("quota") || normalized.includes("usage limit") || normalized.includes("already been used")) {
    return "This offer has reached its usage limit for your account or for this campaign.";
  }
  if (normalized.includes("inactive") || normalized.includes("expired") || normalized.includes("no longer active")) {
    return "This offer has expired or is no longer active.";
  }
  if (normalized.includes("unavailable") || normalized.includes("temporarily")) {
    return "Promotion service is temporarily unavailable. Please try again.";
  }
  if (!offer) {
    return "This voucher code was not found, is no longer active, or is not available for this booking.";
  }
  return "This offer is not available for the selected movie or showtime.";
}

export default function BookingCheckoutPage() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [ticketPass, setTicketPass] = useState<TicketPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [startingPayment, setStartingPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [updatingPromotion, setUpdatingPromotion] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [movieDetail, setMovieDetail] = useState<PublicMovieResponse | null>(null);
  const [clusterDetail, setClusterDetail] = useState<ClusterResponse | null>(null);
  const [bookerName, setBookerName] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [referenceCopied, setReferenceCopied] = useState(false);
  const paymentResult = searchParams.get("paymentResult")?.toUpperCase();
  const { offers: publicOffers, loading: offersLoading } = usePublicPromotionOffers();

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
    if (!quiet) setLoading(true);
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
    }
  }, [bookingId]);

  const copyBookingReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setReferenceCopied(true);
      window.setTimeout(() => setReferenceCopied(false), 1800);
    } catch {
      setReferenceCopied(false);
    }
  };

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

  const handleApplyPromoCode = async (selectedCode?: string) => {
    const normalized = (selectedCode ?? promoCode).trim().toUpperCase();
    if (!bookingId || !normalized || booking?.status !== "PENDING_PAYMENT") return false;
    const selectedOffer = publicOffers.find((offer) => offer.code.toUpperCase() === normalized);
    if (selectedOffer && booking) {
      const requirementMessage = offerRequirementMessage(selectedOffer, booking);
      if (requirementMessage) {
        setPromoMessage(requirementMessage);
        return false;
      }
    }
    setUpdatingPromotion(true);
    setPromoMessage("");
    setPaymentError("");
    try {
      const updated = await bookingApi.applyPromotion(
        bookingId,
        normalized,
        window.crypto.randomUUID(),
      );
      setBooking(updated);
      setPromoCode("");
      setPromoMessage("Promotion applied. Your checkout total has been updated.");
      return true;
    } catch (requestError) {
      setPromoMessage(promotionFailureMessage(requestError, selectedOffer));
      return false;
    } finally {
      setUpdatingPromotion(false);
    }
  };

  const applyOfferFromModal = async (code: string) => {
    const applied = await handleApplyPromoCode(code);
    if (applied) setOffersOpen(false);
  };

  const removePromoCode = async () => {
    if (!bookingId || !booking?.promotionCode) return;
    setUpdatingPromotion(true);
    setPromoMessage("");
    setPaymentError("");
    try {
      const updated = await bookingApi.removePromotion(bookingId);
      setBooking(updated);
      setPromoMessage("Promotion removed.");
    } catch (requestError) {
      setPromoMessage(getApiErrorMessage(requestError, "The promotion could not be removed."));
    } finally {
      setUpdatingPromotion(false);
    }
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
              <span className="booking-eyebrow booking-eyebrow--success">
                <CheckCircle2 size={13} /> Payment successful
              </span>
              <h1>Booking confirmed</h1>
              <p>Your ticket, food pickup and payment details are ready below.</p>
            </div>
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
                  <div>
                    <span><User size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Booked by</span>
                    <strong>{bookerName || user?.username || "—"}</strong>
                  </div>
                </div>

                {!!booking.concessions?.length && (
                  <section className="ticket-pass__section">
                    <div className="ticket-pass__section-heading">
                      <span className="ticket-pass__section-icon"><Popcorn size={16} /></span>
                      <div>
                        <h3>Food &amp; drinks</h3>
                        <p>Collect your order at the concession counter.</p>
                      </div>
                    </div>

                    <div className="ticket-pass__concessions">
                      {booking.concessions.map((item) => (
                        <div className="ticket-pass__concession-item" key={`${item.itemCode}-${item.options ?? "default"}`}>
                          <div>
                            <strong>{item.quantity} &times; {item.itemName}</strong>
                            {item.options && <span>{item.options}</span>}
                          </div>
                          <strong>{formatBookingMoney(item.finalAmount, booking.currency)}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="ticket-pass__pickup">
                      <div>
                        <span>Pick up at</span>
                        <strong>Concession counter</strong>
                      </div>
                      <div>
                        <span>Pickup code</span>
                        <strong>{booking.concessionPickupCode || "Preparing..."}</strong>
                      </div>
                    </div>
                  </section>
                )}

                <section className="ticket-pass__section">
                  <div className="ticket-pass__section-heading">
                    <span className="ticket-pass__section-icon"><ReceiptText size={16} /></span>
                    <div>
                      <h3>Payment summary</h3>
                      <p>{method || "VNPay"}</p>
                    </div>
                  </div>
                  <div className="ticket-pass__payment-summary">
                    <div><span>Tickets</span><strong>{formatBookingMoney(booking.ticketSubtotal, booking.currency)}</strong></div>
                    {booking.concessionSubtotal > 0 && (
                      <div><span>Food &amp; drinks</span><strong>{formatBookingMoney(booking.concessionSubtotal, booking.currency)}</strong></div>
                    )}
                    {booking.serviceFee > 0 && (
                      <div><span>Service fee</span><strong>{formatBookingMoney(booking.serviceFee, booking.currency)}</strong></div>
                    )}
                    {booking.discount > 0 && (
                      <div className="ticket-pass__payment-discount"><span>Promotion</span><strong>-{formatBookingMoney(booking.discount, booking.currency)}</strong></div>
                    )}
                    <div className="ticket-pass__payment-total"><span>Total paid</span><strong>{formatBookingMoney(booking.total, booking.currency)}</strong></div>
                  </div>
                </section>
              </div>
            </div>

            <div className="ticket-pass__perforation">
              <span className="ticket-pass__notch ticket-pass__notch--top" />
              <span className="ticket-pass__notch ticket-pass__notch--bottom" />
            </div>

            <div className="ticket-pass__stub">
              <div className="ticket-pass__qr"><QRCodeSVG value={ticketPass.passToken} size={148} level="M" /></div>
              <div className="ticket-pass__scan-copy">
                <strong>Scan at cinema entry</strong>
                <span>Keep this QR code private.</span>
              </div>
              <div className="ticket-pass__stub-info">
                <span>Booking reference</span>
                <button
                  type="button"
                  aria-label="Copy booking reference"
                  onClick={() => void copyBookingReference(ticketPass.bookingCode)}
                >
                  <strong>{ticketPass.bookingCode}</strong>
                  {referenceCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
                {referenceCopied && <small>Copied</small>}
              </div>
            </div>
          </div>

          <div className="ticket-pass__actions">
            <Link className="booking-button booking-button--secondary" to="/my-bookings">My bookings</Link>
            {canCancelBooking(booking) && (
              <button className="booking-button booking-button--danger" onClick={() => setCancelOpen(true)}>
                <RotateCcw size={16} /> {isPaidBooking(booking.status) ? "Request a refund" : "Cancel booking"}
              </button>
            )}
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
          <div className={booking.status === "PENDING_PAYMENT" ? "xl:pt-10" : undefined}>
            {booking.status === "PENDING_PAYMENT" && (
              <section className="booking-card mb-5">
                <header className="booking-card__header">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-300">
                      <Tag size={19} />
                    </span>
                    <div>
                      <h2>Promotion</h2>
                      <p>Optional — choose an offer or enter a promotion code.</p>
                    </div>
                  </div>
                </header>

                <div className="booking-card__body">
                  {booking.promotionCode ? (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Tag size={16} className="text-emerald-300" />
                          <div>
                            <strong className="text-emerald-300">{booking.promotionCode}</strong>
                            <p className="mt-0.5 text-xs text-white/50">
                              {booking.promotionBenefitScope === "ORDER" ? "Tickets and food & drinks" : booking.promotionBenefitScope === "CONCESSIONS" ? "Food & drinks" : "Movie tickets"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-emerald-300">
                            -{formatBookingMoney(booking.promotionDiscountAmount ?? booking.discount, booking.currency)}
                          </span>
                          <button
                            type="button"
                            aria-label="Remove promotion"
                            disabled={updatingPromotion}
                            onClick={() => void removePromoCode()}
                            className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Recommended offers</p>
                          <span className="text-xs text-white/35">Eligibility checked when applied</span>
                        </div>

                        {offersLoading ? (
                          <div className="grid gap-3 md:grid-cols-3">
                            {[0, 1, 2].map((item) => <div key={item} className="h-[92px] animate-pulse rounded-xl bg-white/[0.05]" />)}
                          </div>
                        ) : publicOffers.length > 0 ? (
                          <div className="grid gap-3 md:grid-cols-3">
                            {publicOffers.slice(0, 3).map((offer) => (
                              <button
                                key={offer.promotionId}
                                type="button"
                                disabled={updatingPromotion}
                                onClick={() => void handleApplyPromoCode(offer.code)}
                                className="group flex min-h-[92px] flex-col items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left transition hover:border-blue-400/50 hover:bg-blue-500/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <span className="min-w-0 max-w-full">
                                  <span className="block truncate text-sm font-semibold text-white">{offer.name}</span>
                                  <span className="mt-1 block truncate text-xs text-white/45">{offerScopeLabel(offer)}</span>
                                </span>
                                <span className="flex w-full items-center justify-between gap-2">
                                  <span className="truncate text-[11px] font-semibold tracking-wide text-white/40">{offer.code}</span>
                                  <span className="shrink-0 rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-xs font-bold text-blue-300 group-hover:bg-blue-500 group-hover:text-white">
                                    {offerDiscountLabel(offer)}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/45">
                            No public offers are available right now. You can still enter a code below.
                          </p>
                        )}

                        {!offersLoading && publicOffers.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setOffersOpen(true)}
                            className="mt-3 text-sm font-semibold text-blue-300 transition hover:text-blue-200"
                          >
                            View all {publicOffers.length} offers
                          </button>
                        )}
                      </div>

                      <div className="mt-5 border-t border-white/10 pt-4">
                        <button
                          type="button"
                          aria-expanded={voucherOpen}
                          onClick={() => setVoucherOpen((current) => !current)}
                          className="flex w-full items-center justify-between rounded-lg py-1 text-left text-sm font-semibold text-white/65 transition hover:text-white"
                        >
                          <span>Have a voucher code?</span>
                          <ChevronDown size={16} className={`transition-transform ${voucherOpen ? "rotate-180" : ""}`} />
                        </button>

                        {voucherOpen && (
                          <div className="mt-3 flex gap-2">
                            <input
                              value={promoCode}
                              onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoMessage(""); }}
                              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleApplyPromoCode(); } }}
                              placeholder="Enter voucher code"
                              maxLength={64}
                              autoComplete="off"
                              autoFocus
                              className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-semibold tracking-wide text-white outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-white/30 focus:border-blue-400"
                            />
                            <button
                              type="button"
                              disabled={!promoCode.trim() || updatingPromotion}
                              onClick={() => void handleApplyPromoCode()}
                              className="h-11 shrink-0 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {updatingPromotion ? "Applying..." : "Apply"}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {promoMessage && <p className={`mt-3 text-xs ${promoMessage.includes("applied") || promoMessage.includes("removed") ? "text-emerald-300" : "text-red-300"}`}>{promoMessage}</p>}
                </div>
              </section>
            )}

            <section className="booking-card">
              <header className="booking-card__header">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-300">
                    {booking.status === "PENDING_PAYMENT" ? <CreditCard size={19} /> : <ShieldCheck size={19} />}
                  </span>
                  <div>
                    <h2>{booking.status === "PENDING_PAYMENT" ? "Payment" : "Booking status"}</h2>
                    <p>{booking.status === "PENDING_PAYMENT" ? "Choose how you'd like to pay." : status.description}</p>
                  </div>
                </div>
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

                {booking.status === "PENDING_PAYMENT" && (
                  <div className="booking-payment-method">
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
                disabled: startingPayment || updatingPromotion,
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

      <Dialog open={offersOpen} onOpenChange={(open) => { if (!updatingPromotion) setOffersOpen(open); }}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto border-white/10 bg-[#10141f] p-0 text-white sm:max-w-2xl">
          <DialogHeader className="border-b border-white/10 px-6 py-5 pr-14">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-300">
                <Tag size={19} />
              </span>
              All available offers
            </DialogTitle>
            <DialogDescription className="pl-[52px] text-white/45">
              Select one offer. Eligibility and usage limits are verified before it is applied.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 p-6 sm:grid-cols-2">
            {publicOffers.map((offer) => (
              <button
                key={offer.promotionId}
                type="button"
                disabled={updatingPromotion}
                onClick={() => void applyOfferFromModal(offer.code)}
                className="group flex min-h-[104px] flex-col items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-blue-400/50 hover:bg-blue-500/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="min-w-0 max-w-full">
                  <span className="block truncate text-sm font-semibold text-white">{offer.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-white/45">{offer.description || offerScopeLabel(offer)}</span>
                </span>
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="truncate text-xs font-semibold tracking-wide text-white/45">{offer.code}</span>
                  <span className="shrink-0 rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-xs font-bold text-blue-300 group-hover:bg-blue-500 group-hover:text-white">
                    {offerDiscountLabel(offer)}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {promoMessage && (
            <p className={`mx-6 mb-5 rounded-lg px-3 py-2 text-xs ${promoMessage.includes("applied") ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
              {promoMessage}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <CancelBookingModal
        open={cancelOpen}
        booking={booking}
        onClose={() => setCancelOpen(false)}
        onCompleted={onCancelled}
      />
    </main>
  );
}
