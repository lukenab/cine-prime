package bookingservice.entity;

/** A quote never holds inventory; it only snapshots the price presented to one member. */
public enum BookingQuoteStatus {
    ACTIVE,
    CONSUMED,
    EXPIRED
}
