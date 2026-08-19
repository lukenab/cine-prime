import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw, TicketX, X } from "lucide-react";
import { bookingApi, type BookingDetail, type CancellationResult } from "../../api/bookingApi";
import { formatBookingDate, formatBookingMoney, getApiErrorMessage } from "./bookingUi";

interface Props {
  open: boolean;
  booking: BookingDetail | null;
  onClose: () => void;
  onCompleted: (result: CancellationResult) => void;
}

// Refund reasons (booking already paid) mirror the categories real cinema
// chains offer on a post-payment refund request — distinct from the reasons
// that make sense for abandoning an unpaid hold, which never involves money.
const REFUND_REASONS = [
  { value: "PERSONAL_SCHEDULE_CHANGE", label: "Personal schedule change" },
  { value: "WRONG_SHOWTIME_OR_CINEMA", label: "Booked the wrong showtime or cinema" },
  { value: "WRONG_SEATS", label: "Booked the wrong seats" },
  { value: "HEALTH_EMERGENCY", label: "Health or family emergency" },
  { value: "SERVICE_DISSATISFACTION", label: "Dissatisfied with the service" },
  { value: "OTHER", label: "Other reason" },
];

const CANCEL_REASONS = [
  { value: "CHANGED_MIND", label: "Changed my mind" },
  { value: "WRONG_SHOWTIME_OR_CINEMA", label: "Selected the wrong showtime, cinema, or seats" },
  { value: "FOUND_BETTER_OPTION", label: "Found a better showtime elsewhere" },
  { value: "OTHER", label: "Other reason" },
];

export default function CancelBookingModal({ open, booking, onClose, onCompleted }: Props) {
  const confirmed = booking?.status === "CONFIRMED" || booking?.status === "CONFIRM_PENDING";
  const reasons = confirmed ? REFUND_REASONS : CANCEL_REASONS;
  const [reasonCode, setReasonCode] = useState(reasons[0].value);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReasonCode(reasons[0].value);
    setReason("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking?.bookingId]);

  if (!open || !booking) return null;

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await bookingApi.cancelBooking(
        booking.bookingId,
        {
          reasonCode: confirmed ? reasonCode : "CANCELLED_BEFORE_PAYMENT",
          reason: confirmed ? reason.trim() || undefined : undefined,
        },
        crypto.randomUUID(),
      );
      onCompleted(result);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "The cancellation request could not be submitted."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="booking-modal__header">
          <div className="booking-modal__icon">
            {confirmed ? <RotateCcw size={20} /> : <TicketX size={20} />}
          </div>
          <div>
            <h2 id="cancel-booking-title">{confirmed ? "Request a refund" : "Cancel this booking?"}</h2>
            <p>{confirmed ? `${booking.bookingCode} · ${booking.movieName}` : booking.bookingCode}</p>
          </div>
          <button className="booking-icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="booking-modal__body">
          {confirmed ? (
            <>
              <div className="booking-cancel-notice">
                <AlertTriangle size={18} />
                <div>
                  <strong>A refund may be required</strong>
                  <p>
                    The system will calculate the eligible refund for {formatBookingMoney(booking.total, booking.currency)} using the cinema cancellation policy.
                  </p>
                </div>
              </div>

              <label className="booking-field">
                <span>Reason</span>
                <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
                  {reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="booking-field">
                <span>Additional details <small>Optional</small></span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Tell us anything that may help process this request."
                />
              </label>
            </>
          ) : (
            <>
              <div className="booking-cancel-summary">
                <strong>{booking.movieName}</strong>
                <span>{booking.cinemaClusterName} · {booking.cinemaRoomName}</span>
                <span>
                  {formatBookingDate(booking.showDate)} · {booking.startTime?.slice(0, 5) || "—"} · Seat{booking.seats.length === 1 ? "" : "s"} {booking.seats.map((seat) => seat.seatCode).join(", ")}
                </span>
              </div>
              <p className="booking-cancel-consequence">
                Your selected seats will be released immediately. You won't be charged.
              </p>
            </>
          )}

          {error && <p className="booking-inline-error">{error}</p>}
        </div>

        <footer className="booking-modal__footer">
          <button className="booking-button booking-button--secondary" onClick={onClose} disabled={submitting} autoFocus={!confirmed}>
            {confirmed ? "Keep booking" : "Continue booking"}
          </button>
          <button className="booking-button booking-button--danger" onClick={submit} disabled={submitting}>
            {submitting ? <LoaderCircle size={17} className="booking-spin" /> : null}
            {confirmed ? "Submit refund request" : "Cancel booking"}
          </button>
        </footer>
      </section>
    </div>
  );
}
