# Loyalty service (P0)

The loyalty bounded context owns customer membership status and an immutable points
ledger. It does not change booking or payment state.

## P0 rules

- A membership account is created lazily when a customer opens their profile.
- A confirmed booking earns `floor((tickets + concessions - discounts) / 10,000)`
  points by default. The amount is configurable with `LOYALTY_POINTS_EARN_PER_VND`.
- Earned points stay **PENDING** until the booking is checked in/completed. This
  prevents rewarding no-shows and follows the cinema operating model.
- Cancellation reverses pending points. A refund reverses posted points and reduces
  the membership spend used for tiering.
- Events are processed idempotently through `loyalty_processed_event` and the unique
  ledger `event_id` constraint.
- Tiers for the demo are `MEMBER` (0), `SILVER` (1,000,000 VND), `GOLD` (5,000,000
  VND), and `PLATINUM` (15,000,000 VND) lifetime spend.

## APIs

Customer (JWT required):

- `GET /api/membership/me`
- `GET /api/membership/me/ledger?page=0&size=20`

Admin (`ADMIN` or `SUPER_ADMIN`):

- `GET /api/admin/membership?page=0&size=20`
- `GET /api/admin/membership/{accountId}/ledger`
- `POST /api/admin/membership/{accountId}/adjust`
  ```json
  {"points": 100, "reason": "Service recovery", "idempotencyKey": "case-001"}
  ```
- `POST /api/admin/membership/{accountId}/settle-booking/{bookingId}` (demo/manual
  check-in fallback)

The service consumes canonical booking events from `booking.events.v1`:
`BOOKING_CONFIRMED`, `TICKET_CHECKED_IN`, `SHOWTIME_COMPLETED`,
`BOOKING_CANCELLED`, and `BOOKING_REFUNDED`.

## Local start

If the existing Postgres volume predates this service, create the database once:

```powershell
docker exec postgres psql -U postgres -d postgres -c "CREATE DATABASE loyalty_db;"
docker compose build loyalty-service
docker compose up -d loyalty-service
```

Health: `http://localhost:8090/actuator/health`.

