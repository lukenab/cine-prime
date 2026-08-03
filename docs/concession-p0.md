# Concession P0

Concession is an independent bounded context on port `8085` with its own
`concession_db`. Booking stores immutable purchased-item snapshots only.

## Customer flow

1. `booking-service` holds seats and creates a `PENDING_PAYMENT` booking.
2. The client opens `/checkout/{bookingId}/concessions`.
3. The customer adds configured SKU/combo items or selects **Skip for now**.
4. `booking-service` reserves stock through the internal concession API,
   snapshots the lines, and changes checkout expiry to the earlier hold expiry.
5. `payment-service` charges the updated booking total once.
6. On payment success, booking confirms the seat hold and concession
   reservation. Concession creates a paid order and pickup code.
7. On failure, cancellation, or expiry, both holds are released idempotently.

## Main APIs

- `GET /api/public/cinemas/{clusterId}/concessions`
- `POST /api/bookings/{bookingId}/concessions`
- `/api/admin/concession-products`
- `/api/admin/concession-skus`
- `/api/admin/concession-combos`
- `/api/admin/cinemas/{clusterId}/concession-offers`
- `/api/admin/cinemas/{clusterId}/concession-inventory`
- `GET /api/employee/concession-orders`
- `POST /api/employee/concession-orders/{id}/{prepare|ready|collect}`

## Verification

`ConcessionP0IntegrationTest` runs against PostgreSQL 16 through Testcontainers
and covers the happy path, last-item race, duplicate request, expired hold, and
payment-failure release.
