# Canonical cross-service event and idempotency contract

Status: accepted for extended-demo P0 (issue #286)

Contract owner: platform/backend team

Envelope version: `1`

This contract is the integration boundary for booking, payment, concession,
promotion, refund and analytics. Payload schemas remain owned by their bounded
context; no service may import another service's JPA entity.

## 1. Canonical envelope

Every domain event published to Kafka must use this shape:

```json
{
  "eventId": "01910b69-81c5-7dd8-bd80-d627ea7c18d4",
  "eventType": "BOOKING_CONFIRMED",
  "eventVersion": "1",
  "occurredAt": "2026-08-02T14:30:00+07:00",
  "correlationId": "checkout-58d2b748",
  "causationId": "payment-event-7391",
  "producer": "booking-service",
  "payload": {}
}
```

| Field | Rule |
|---|---|
| `eventId` | Globally unique and immutable. The same logical event keeps this ID across every retry. |
| `eventType` | Upper snake case business fact, past tense where practical. Never use a Java class name. |
| `eventVersion` | Positive schema version represented as a string. It versions the payload, not the topic. |
| `occurredAt` | RFC 3339 timestamp with offset, generated when the business transaction commits. |
| `correlationId` | Stable across one user/business flow; copied from inbound context when present. |
| `causationId` | ID of the command/event that caused this event; may be absent only at a flow root. |
| `producer` | Stable service name registered in service discovery. |
| `payload` | Bounded-context snapshot needed by named consumers; no persistence object. |

Unknown envelope or payload fields must be ignored by consumers. Required fields
may only be removed or semantically changed in a new `eventVersion`. Additive,
optional fields are backward compatible.

## 2. Money and identifiers

- Money is a JSON decimal generated from Java `BigDecimal`, accompanied by an
  ISO-4217 `currency`; `double`/`float` is forbidden.
- VND values use scale 0 in business examples. Consumers must still parse a
  decimal because another currency can have fractional units.
- IDs are opaque strings at the event boundary. A consumer must not infer an ID
  format or reuse `eventId` as a domain aggregate ID.
- Timestamps are instants with an explicit UTC offset; local date-time without
  zone/offset is forbidden.

## 3. Topics, ownership and consumers

| Event | Producer/owner | Topic | P0 consumers | Partition key |
|---|---|---|---|---|
| `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_REFUNDED` | booking-service | `booking.events.v1` | analytics-service, notification-service | `bookingId` |
| `PAYMENT_SUCCEEDED`, `PAYMENT_REFUNDED` | payment-service | `payment.events.v1` | booking-service, analytics-service | `bookingId` |
| `CONCESSION_CONFIRMED`, `CONCESSION_RELEASED` | concession-service | `concession.events.v1` | booking-service, analytics-service | `bookingId` |
| `PROMOTION_COMMITTED`, `PROMOTION_RELEASED` | promotion-service | `promotion.events.v1` | booking-service, analytics-service | `bookingId` |

The table declares the target contract. A producer that has not yet migrated to
its topic must not publish a look-alike event with a different envelope.

## 4. Payload examples

The examples below omit no required envelope metadata, but use shortened IDs.

### Booking confirmed

```json
{"eventId":"evt-b1","eventType":"BOOKING_CONFIRMED","eventVersion":"1","occurredAt":"2026-08-02T14:30:00+07:00","correlationId":"checkout-1","causationId":"evt-p1","producer":"booking-service","payload":{"bookingId":"BKG-1","bookingCode":"CP001","accountId":"ACC-1","showtimeId":501,"clusterId":81,"bookingStatus":"CONFIRMED","paymentStatus":"PAID","inventoryStatus":"CONFIRMED","total":263000,"currency":"VND"}}
```

### Booking cancelled

```json
{"eventId":"evt-b2","eventType":"BOOKING_CANCELLED","eventVersion":"1","occurredAt":"2026-08-02T15:00:00+07:00","correlationId":"cancel-1","causationId":"cmd-cancel-1","producer":"booking-service","payload":{"bookingId":"BKG-1","accountId":"ACC-1","clusterId":81,"bookingStatus":"CANCELLED","refundRequired":true,"total":263000,"currency":"VND"}}
```

### Booking refunded

```json
{"eventId":"evt-b3","eventType":"BOOKING_REFUNDED","eventVersion":"1","occurredAt":"2026-08-02T15:05:00+07:00","correlationId":"cancel-1","causationId":"evt-pr1","producer":"booking-service","payload":{"bookingId":"BKG-1","clusterId":81,"refundId":"REF-1","refundAmount":263000,"currency":"VND","bookingStatus":"REFUNDED"}}
```

### Payment succeeded

```json
{"eventId":"evt-p1","eventType":"PAYMENT_SUCCEEDED","eventVersion":"1","occurredAt":"2026-08-02T14:29:58+07:00","correlationId":"checkout-1","causationId":"payment-session-1","producer":"payment-service","payload":{"paymentId":"PAY-1","bookingId":"BKG-1","provider":"VNPAY","providerReference":"masked-or-opaque-reference","amount":263000,"currency":"VND"}}
```

### Payment refunded

```json
{"eventId":"evt-pr1","eventType":"PAYMENT_REFUNDED","eventVersion":"1","occurredAt":"2026-08-02T15:04:58+07:00","correlationId":"cancel-1","causationId":"evt-b2","producer":"payment-service","payload":{"paymentId":"PAY-1","bookingId":"BKG-1","refundId":"REF-1","amount":263000,"currency":"VND","status":"SUCCEEDED"}}
```

### Promotion committed and released

```json
{"eventId":"evt-promo1","eventType":"PROMOTION_COMMITTED","eventVersion":"1","occurredAt":"2026-08-02T14:28:00+07:00","correlationId":"checkout-1","causationId":"promotion-reservation-1","producer":"promotion-service","payload":{"promotionId":"PROMO-1","promotionCode":"MOVIE10","bookingId":"BKG-1","accountId":"ACC-1","discountAmount":20000,"currency":"VND"}}
```

```json
{"eventId":"evt-promo2","eventType":"PROMOTION_RELEASED","eventVersion":"1","occurredAt":"2026-08-02T15:00:02+07:00","correlationId":"cancel-1","causationId":"evt-b2","producer":"promotion-service","payload":{"promotionId":"PROMO-1","promotionCode":"MOVIE10","bookingId":"BKG-1","accountId":"ACC-1","discountAmount":20000,"currency":"VND","reason":"BOOKING_CANCELLED"}}
```

## 5. Idempotency, deduplication and retry

1. HTTP commands use `Idempotency-Key`, scoped by authenticated account/service
   and operation. Reusing a key with a different request hash returns conflict.
2. Producer deduplication identity is `eventId`. Outbox retries publish the exact
   same `eventId`, `occurredAt`, type, version and payload.
3. Every consumer persists `eventId` in an inbox/processed-event table with a
   unique constraint in the same transaction as its projection/business change.
4. A duplicate event is acknowledged without applying side effects again.
5. Retry only transient dependency failures with bounded exponential backoff.
   Invalid schema/business invariants are non-retryable and go to the DLT with
   the original envelope intact.
6. Ordering is guaranteed only per partition key. Consumers use aggregate state
   or version where an older event can arrive after a newer one.

## 6. Data classification

Allowed: opaque account/booking/payment IDs, branch/showtime IDs, status, item
counts and monetary snapshots required by declared consumers.

Forbidden: password/hash, JWT, refresh token, API/internal key, provider secret,
full card/bank data, unmasked provider credentials, email, phone, address or free
text that may contain personal data unless a separately reviewed contract needs it.

## 7. Current implementation

`booking-service` persists business facts in its transactional outbox and now
publishes the full canonical envelope. `eventId` comes from the outbox row and is
therefore stable across Kafka retry attempts. Other producers migrate when their
P0 event publishers are implemented; consumers must not depend on undocumented
payload fields.
