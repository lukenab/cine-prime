# Booking Service API Specification

## 1. General Information

| Field          | Value                                           |
| -------------- | ----------------------------------------------- |
| Service        | `booking-service`                               |
| Feature        | Booking & Ticket Management                     |
| Related APIs   | Bookings, Tickets                               |
| Contract Owner | Nguyễn An Bình                                  |
| Backend Owner  |                                                 |
| Reviewer       |                                                 |
| Status         | Draft                                           |
| Milestone      | Sprint 2 — Showtime Management & Ticket Booking |
| Last Updated   | 02/07/2026                                      |

---

## 2. Document Purpose

This document defines the API contract for the `booking-service` within the system.

Objectives:

* Establish a shared API contract between Backend, Frontend, API Gateway, and dependent services.
* Provide Backend engineers with a definitive reference for endpoints, request/response shapes, and business rules — without guesswork.
* Give Frontend engineers a clear specification for building the online booking flow, counter sales, booking history, and ticket history screens.
* Draw a clear boundary between data owned by Booking Service and data owned by Movie Service.
* Standardize validation, authorization, HTTP status codes, and error codes.
* Serve as the basis for splitting implementation issues once the contract is approved.

---

## 3. Booking Service Scope

Booking Service owns the following tables:

```txt
booking
booking_detail
ticket
seat_lock
```

Booking Service is responsible for:

* Creating and managing online booking orders placed by Members.
* Temporarily locking seats (via `seat_lock` table) during the hold window.
* Cancelling bookings and releasing seat locks.
* Storing snapshots of movie, seat, and showtime information at the time of transaction.

Booking Service is NOT responsible for:

* Managing movie, room, or physical seat information.
* Managing showtimes.
* Payment processing (belongs to Payment Service).
* Push/email notifications (belongs to Notification Service).
* Loyalty point balance management (belongs to User Service).
* Revenue reporting and analytics.

---

## 4. Physical Schema

The schema below reflects the current database structure. Final schema, constraints, indexes, and migrations are to be confirmed by the Booking Service Owner.

### 4.1. Table `booking`

| Column           | Type          | Notes                                                      |
| ---------------- | ------------- | ---------------------------------------------------------- |
| booking_id       | varchar(50)   | Primary key, UUID                                          |
| account_id       | varchar(50)   | Logical reference → auth_db.account                        |
| member_id        | varchar(50)   | Nullable — walk-in customers without a membership          |
| showtime_id      | bigint        | Logical reference → movie_db.show_time                     |
| movie_name       | varchar(255)  | Snapshot at time of booking                                |
| show_date        | date          | Snapshot                                                   |
| start_time       | time          | Snapshot                                                   |
| cinema_room_name | varchar(100)  | Snapshot                                                   |
| total_amount     | decimal(12,2) | Total price before discount                                |
| points_used      | int           | Total loyalty points applied                               |
| points_discount  | decimal(12,2) | Monetary discount derived from points                      |
| final_amount     | decimal(12,2) | Amount actually charged to customer                        |
| booking_type     | varchar(20)   | ONLINE \| COUNTER                                          |
| status           | varchar(20)   | PENDING \| CONFIRMED \| CANCELLED                          |
| created_by       | varchar(36)   | account_id of the creator                                  |
| created_at       | timestamp     | Creation timestamp (auto-set by `@CreationTimestamp`)      |
| updated_at       | timestamp     | Last update timestamp (auto-set by `@UpdateTimestamp`)     |
| expires_at       | timestamp     | PENDING bookings auto-expire after the configured window   |

### 4.2. Table `booking_detail`

Java entity class: `BookingItem`

| Column           | Type          | Notes                                              |
| ---------------- | ------------- | -------------------------------------------------- |
| detail_id        | bigint        | Primary key, auto-increment                        |
| booking_id       | varchar(50)   | FK → booking.booking_id                            |
| showtime_seat_id | bigint        | Logical reference → movie_db.showtime_seat         |
| seat_code        | varchar(20)   | Snapshot                                           |
| seat_type        | varchar(50)   | Snapshot — STANDARD \| VIP                         |
| unit_price       | decimal(12,2) | Price for this individual seat                     |
| points_redeemed  | int           | Points applied specifically to this seat           |
| is_from_points   | boolean       | true = this seat was paid entirely with points     |
| version          | int           | Optimistic locking field — prevents double-booking |

### 4.3. Table `ticket`

| Column           | Type          | Notes                                          |
| ---------------- | ------------- | ---------------------------------------------- |
| ticket_id        | varchar(50)   | Primary key, UUID                              |
| booking_id       | varchar(50)   | FK → booking                                   |
| detail_id        | bigint        | FK → booking_detail                            |
| showtime_id      | bigint        | Logical reference → movie_db.show_time         |
| movie_name       | varchar(255)  | Snapshot                                       |
| cinema_room_name | varchar(100)  | Snapshot                                       |
| show_date        | date          | Snapshot                                       |
| start_time       | time          | Snapshot                                       |
| seat_code        | varchar(20)   | Snapshot                                       |
| seat_type        | varchar(50)   | Snapshot                                       |
| price            | decimal(12,2) | Ticket price at time of issuance               |
| is_from_points   | boolean       | Ticket was paid with loyalty points            |
| member_id        | varchar(50)   | Nullable                                       |
| account_id       | varchar(50)   | Logical reference → auth_db.account            |
| qr_code          | varchar(500)  | QR code used for ticket scanning               |
| status           | varchar(20)   | VALID \| USED \| CANCELLED                     |
| issued_at        | timestamp     | Ticket issuance timestamp                      |
| used_at          | timestamp     | Nullable — timestamp when ticket was scanned   |
| issued_by        | varchar(36)   | account_id of the issuing employee             |

### 4.4. Table `seat_lock`

| Column                | Type        | Notes                                                         |
| --------------------- | ----------- | ------------------------------------------------------------- |
| id                    | bigint      | Primary key, auto-increment                                   |
| showtime_id           | bigint      | Logical reference → movie_db.show_time; part of unique key   |
| seat_id               | varchar(50) | Logical reference → movie_db.showtime_seat; part of unique key |
| locked_by_account_id  | varchar(50) | Account that holds the lock                                   |
| locked_at             | timestamp   | Auto-set by `@CreationTimestamp`                              |
| expires_at            | timestamp   | Lock expires after 10 minutes                                 |

Unique constraint: `(showtime_id, seat_id)` — guarantees at most one active lock per seat per showtime.

---

## 5. Database-per-Service and Logical References

The system follows the Database-per-Service principle.

Booking Service stores IDs belonging to other services as logical references only:

```txt
showtimeId       → movie_db.show_time
showtimeSeatId   → movie_db.showtime_seat
accountId        → auth_db.account
memberId         → user_db.member
```

No physical foreign keys are created from booking_db to any other service's database.

Booking Service does not access another service's database directly.

---

## 6. API Gateway and Service URLs

### 6.1. API Gateway URL

Frontend communicates exclusively through:

```txt
http://localhost:8080
```

### 6.2. Booking Service Direct URL

For backend debugging and isolated service testing only:

```txt
http://localhost:8085
```

Port is taken from project configuration and must not be hardcoded in Frontend.

### 6.3. Request Flow

```txt
React Frontend
→ API Gateway (8080)
→ Booking Service (8085)
→ booking_db
→ (cross-service) Movie Service / User Service
```

Frontend must not call the Booking Service port directly.

---

## 7. General Conventions

### 7.1. Content Type

```http
Content-Type: application/json
```

### 7.2. Authorization Header

All Protected, Employee, and Admin APIs require:

```http
Authorization: Bearer <accessToken>
```

### 7.3. Date Format

```txt
YYYY-MM-DD
```

### 7.4. Datetime Format

ISO-8601:

```txt
YYYY-MM-DDTHH:mm:ss
```

### 7.5. Timezone

Default business timezone:

```txt
Asia/Ho_Chi_Minh
```

### 7.6. Currency

```txt
VND
```

Monetary values are returned as plain numbers without currency symbols.

### 7.7. Pagination

* `page` is zero-based (starts at `0`).
* `size` defaults to `10`.
* Response pagination fields use `pageNumber`, `pageSize`, `totalElements`, `totalPages`, `isLast`.

---

## 8. Common Response Contract

All responses use the shared `ApiResponse<T>` wrapper from the `common` module:

```java
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    int code;
    String message;
    T result;
}
```

`@JsonInclude(NON_NULL)` means any `null` field is **omitted** from JSON output.

### 8.1. Success Response — with payload

```json
{
  "code": 1000,
  "result": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PENDING"
  }
}
```

`message` is omitted because it is `null`.

### 8.2. Success Response — with message, no payload

```json
{
  "code": 1000,
  "message": "Booking cancelled successfully"
}
```

`result` is omitted because it is `null`.

### 8.3. Error Response

```json
{
  "code": 2004,
  "message": "Booking not found"
}
```

### 8.4. Validation Error

Returned when `@Valid` constraint fails. Returns the `defaultMessage` of the first failing field.

```json
{
  "code": 1005,
  "message": "SEAT_LIST_REQUIRED"
}
```

### 8.5. Uncategorized Server Error

```json
{
  "code": 1003,
  "message": "Uncategorized error!"
}
```

### 8.6. Response Field Definitions

| Field   | Type         | Present when          | Description                                        |
| ------- | ------------ | --------------------- | -------------------------------------------------- |
| code    | int          | Always                | `1000` = success; other values indicate an error   |
| message | string       | Error or explicit set | Human-readable description; omitted if not set     |
| result  | object/array | Success with payload  | Response payload; omitted when `null`              |

---

## 9. API Classification

### 9.1. Member API

Requires a Bearer Token with role `MEMBER` (checked via `JwtSecurityUtils.hasRole("ROLE_MEMBER")`):

```txt
POST   /api/bookings
GET    /api/bookings/me
GET    /api/bookings/{bookingId}
PATCH  /api/bookings/{bookingId}/cancel
```

### 9.2. Employee API

> **Not yet implemented.** Planned for a future sprint.

```txt
GET    /api/bookings/search
PATCH  /api/bookings/{bookingId}/confirm
POST   /api/bookings/counter-sale
GET    /api/tickets/{ticketId}
```

### 9.3. Admin API

Inherits all Member and Employee API access. Admin role is checked via `JwtSecurityUtils.hasRole("ROLE_ADMIN")` — allows viewing any booking, not just own.

---

## 10. Endpoint Summary

| Method | Endpoint                            | Access                    | Status          | Purpose                              |
| ------ | ----------------------------------- | ------------------------- | --------------- | ------------------------------------ |
| POST   | `/api/bookings`                     | Member                    | ✅ Implemented  | Create booking and hold seats        |
| GET    | `/api/bookings/me`                  | Member                    | ✅ Implemented  | Get own booking history (paginated)  |
| GET    | `/api/bookings/{bookingId}`         | Member / Admin            | ✅ Implemented  | Get booking detail                   |
| PATCH  | `/api/bookings/{bookingId}/cancel`  | Member / Admin            | ✅ Implemented  | Cancel a booking                     |
| GET    | `/api/bookings/search`              | Employee / Admin          | ⬜ Not yet impl | Search all bookings                  |
| PATCH  | `/api/bookings/{bookingId}/confirm` | Employee / Admin          | ⬜ Not yet impl | Confirm a booking and issue tickets  |
| POST   | `/api/bookings/counter-sale`        | Employee / Admin          | ⬜ Not yet impl | Sell tickets directly at the counter |
| GET    | `/api/tickets/{ticketId}`           | Member / Employee / Admin | ⬜ Not yet impl | Get ticket detail                    |

---

# 11. Member Booking APIs

## 11.1. Create Booking

### Endpoint

```http
POST /api/bookings
```

### Headers

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Request Body

```json
{
  "showtimeId": 1,
  "seatIds": [101, 102],
  "pointsUsed": 0
}
```

### Field Definitions

| Field      | Type          | Required | Validation                                      |
| ---------- | ------------- | -------- | ----------------------------------------------- |
| showtimeId | long          | Yes      | `@NotNull`, `@Min(1)`                           |
| seatIds    | array\<long\> | Yes      | `@NotEmpty`, max 8 seats (`@Size(max=8)`)       |
| pointsUsed | integer       | No       | `@Min(0)`, defaults to `0`                      |

### Processing Rules

1. Only `MEMBER` role is allowed (`MEMBER_ONLY_ACTION` error if not).
2. Duplicate seat IDs in request are rejected (`DUPLICATE_SEATS_IN_REQUEST`).
3. Seats already booked/confirmed are rejected (`SEATS_ALREADY_TAKEN`).
4. Expired seat locks for other accounts are released; active locks raise `SEAT_ALREADY_LOCKED`.
5. If the caller already holds an active lock on a seat: `SEAT_ALREADY_HELD_BY_YOU`.
6. New `seat_lock` rows are inserted for each seat with `expires_at = now + 10 minutes`.
7. A `Booking` with `status = PENDING` is persisted.
8. Seat price is currently hardcoded at `85,000 VND` per seat (Movie Service integration pending).

### Response Success

Status: `201 Created`

```json
{
  "code": 1000,
  "message": "Booking created successfully",
  "result": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "showtimeId": 1,
    "status": "PENDING",
    "totalPrice": 170000,
    "items": [
      {
        "seatId": 101,
        "seatLabel": "101",
        "price": 85000
      },
      {
        "seatId": 102,
        "seatLabel": "102",
        "price": 85000
      }
    ],
    "lockedUntil": "2026-07-01T13:25:00"
  }
}
```

### Response DTO — `CreateBookingResponse`

| Field       | Type                      | Description                                 |
| ----------- | ------------------------- | ------------------------------------------- |
| bookingId   | string (UUID)             | Created booking ID                          |
| showtimeId  | long                      | The requested showtime                      |
| status      | string                    | Always `PENDING` on creation                |
| totalPrice  | decimal                   | Sum of all seat prices                      |
| items       | array\<BookingItemResponse\> | One entry per seat                       |
| lockedUntil | datetime                  | Seat lock expiry (`now + 10 minutes`)       |

### Response DTO — `BookingItemResponse`

| Field     | Type    | Description                       |
| --------- | ------- | --------------------------------- |
| seatId    | long    | `showtime_seat_id` from request   |
| seatLabel | string  | Seat code (currently same as ID)  |
| price     | decimal | Unit price for this seat          |

### Error Responses

| Scenario             | HTTP | code | message                                                       |
| -------------------- | ---- | ---- | ------------------------------------------------------------- |
| Not a member         | 403  | 2010 | Only registered members can create a booking and hold seats   |
| Duplicate seat IDs   | 400  | 2009 | Duplicate seat IDs found in the request                       |
| Seats already booked | 400  | 2006 | The selected seats are already locked or booked by another user |
| Seat locked by other | 409  | 2011 | The seat is already locked or reserved by another user        |
| You already hold it  | 400  | 2012 | You have already held this seat and the lock is still valid   |
| Unauthenticated      | 401  | 1008 | Unauthenticated                                               |

---

## 11.2. Get My Bookings

### Endpoint

```http
GET /api/bookings/me
```

### Headers

```http
Authorization: Bearer <accessToken>
```

### Query Parameters

| Parameter | Type | Required | Default | Description     |
| --------- | ---- | -------- | ------- | --------------- |
| page      | int  | No       | 0       | Page index (0-based) |
| size      | int  | No       | 10      | Page size       |

### Response Success

Status: `200 OK`

```json
{
  "code": 1000,
  "result": {
    "content": [
      {
        "bookingId": "550e8400-e29b-41d4-a716-446655440000",
        "accountId": "acc-001",
        "memberId": null,
        "movieName": "Avengers: Endgame",
        "showDate": "2026-07-01",
        "startTime": "14:00:00",
        "cinemaRoomName": "Room 1",
        "totalSeats": 2,
        "finalAmount": 170000,
        "bookingType": null,
        "status": "PENDING",
        "createdAt": "2026-07-01T13:15:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 1,
    "totalPages": 1,
    "isLast": true
  }
}
```

### Response DTO — `BookingListResponse`

| Field         | Type                        | Description                      |
| ------------- | --------------------------- | -------------------------------- |
| content       | array\<BookingDetailResponse\> | Bookings for current page     |
| pageNumber    | int                         | Current page index (0-based)     |
| pageSize      | int                         | Items per page                   |
| totalElements | long                        | Total number of bookings         |
| totalPages    | int                         | Total pages                      |
| isLast        | boolean                     | Whether this is the last page    |

> Note: In the list view, each `BookingDetailResponse` entry does **not** include the `items` sub-array (seat detail). Only the top-level booking fields are populated.

---

## 11.3. Get Booking Detail

### Endpoint

```http
GET /api/bookings/{bookingId}
```

### Headers

```http
Authorization: Bearer <accessToken>
```

### Path Parameter

| Field     | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| bookingId | string | Yes      | Booking UUID |

### Access Rule

Members may only retrieve their own bookings. Admins may retrieve any booking. Non-owners receive `BOOKING_NOT_FOUND` (same as not-found to avoid leaking existence).

### Response Success

Status: `200 OK`

```json
{
  "code": 1000,
  "result": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "acc-001",
    "memberId": null,
    "movieName": "Avengers: Endgame",
    "showDate": "2026-07-01",
    "startTime": "14:00:00",
    "cinemaRoomName": "Room 1",
    "totalSeats": 2,
    "finalAmount": 170000,
    "bookingType": null,
    "status": "PENDING",
    "createdAt": "2026-07-01T13:15:00",
    "items": [
      {
        "seatId": 101,
        "seatLabel": "101",
        "price": 85000
      },
      {
        "seatId": 102,
        "seatLabel": "102",
        "price": 85000
      }
    ]
  }
}
```

### Response DTO — `BookingDetailResponse`

| Field         | Type                         | Description                            |
| ------------- | ---------------------------- | -------------------------------------- |
| bookingId     | string (UUID)                | Booking ID                             |
| accountId     | string                       | Account that created the booking       |
| memberId      | string / null                | Member ID if applicable                |
| movieName     | string / null                | Snapshot from booking record           |
| showDate      | date                         | Snapshot                               |
| startTime     | time                         | Snapshot                               |
| cinemaRoomName| string / null                | Snapshot                               |
| totalSeats    | int                          | Not stored separately — derived from items count |
| finalAmount   | decimal / null               | Final charged amount                   |
| bookingType   | string / null                | `ONLINE` / `COUNTER` / null            |
| status        | string                       | `PENDING` / `CONFIRMED` / `CANCELLED`  |
| createdAt     | datetime                     | Booking creation time                  |
| items         | array\<BookingItemResponse\> / null | Seat details; null in list view  |

### Error Responses

| Scenario              | HTTP | code | message              |
| --------------------- | ---- | ---- | -------------------- |
| Booking not found     | 404  | 2004 | Booking not found    |
| Not owner (non-admin) | 404  | 2004 | Booking not found    |
| Unauthenticated       | 401  | 1008 | Unauthenticated      |

---

## 11.4. Cancel Booking

### Endpoint

```http
PATCH /api/bookings/{bookingId}/cancel
```

### Headers

```http
Authorization: Bearer <accessToken>
```

### Path Parameter

| Field     | Type   | Required |
| --------- | ------ | -------- |
| bookingId | string | Yes      |

### Business Rules

1. Member may only cancel their own booking; Admin may cancel any booking.
2. Non-owner member receives `CANCEL_PERMISSION_DENIED`.
3. Only bookings in `PENDING` or `CONFIRMED` status can be cancelled.
4. Cancellation is blocked if `now + minsBeforeShowtime >= showtime start` (`CANCEL_TIME_EXPIRED`).
5. If booking was `CONFIRMED`, all associated tickets are transitioned to `CANCELLED`.
6. `seat_lock` rows for the cancelled booking's seats are deleted.
7. Booking `status` is set to `CANCELLED`.

### Response Success

Status: `200 OK`

```json
{
  "code": 1000,
  "message": "Booking cancelled successfully",
  "result": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "CANCELLED",
    "updatedAt": "2026-07-01T13:30:00"
  }
}
```

### Response DTO — `CancelBookingResponse`

| Field     | Type          | Description                 |
| --------- | ------------- | --------------------------- |
| bookingId | string (UUID) | The cancelled booking ID    |
| status    | string        | Always `CANCELLED`          |
| updatedAt | datetime      | Timestamp of cancellation   |

### Error Responses

| Scenario                     | HTTP | code | message                                            |
| ---------------------------- | ---- | ---- | -------------------------------------------------- |
| Booking not found            | 404  | 2004 | Booking not found                                  |
| Not owner (non-admin)        | 403  | 2002 | You do not have permission to cancel this booking  |
| Invalid status               | 400  | 2001 | Booking cannot be cancelled in its current state   |
| Too close to showtime        | 400  | 2003 | Cancellation time has expired for this showtime    |
| Unauthenticated              | 401  | 1008 | Unauthenticated                                    |

---

# 12. Planned — Employee / Admin APIs

> The following endpoints are **not yet implemented**. They are documented here as the intended contract for future sprints.

## 12.1. Search Bookings (planned)

```http
GET /api/bookings/search
```

Requires `EMPLOYEE` or `ADMIN` role. Supports filtering by keyword, status, date range, and pagination.

---

## 12.2. Confirm Booking (planned)

```http
PATCH /api/bookings/{bookingId}/confirm
```

Transitions a `PENDING` booking to `CONFIRMED` and issues tickets. Requires `EMPLOYEE` or `ADMIN` role.

---

## 12.3. Counter Sale (planned)

```http
POST /api/bookings/counter-sale
```

Creates a booking and issues tickets immediately (no PENDING step). Requires `EMPLOYEE` or `ADMIN` role.

---

## 12.4. Get Ticket Detail (planned)

```http
GET /api/tickets/{ticketId}
```

Returns full ticket data including QR code. Accessible to Members (own tickets only), Employees, and Admins.

---

# 13. Enum Definitions

## 13.1. BookingStatus

```txt
PENDING     Seats are held; awaiting confirmation
CONFIRMED   Booking has been confirmed; tickets issued
CANCELLED   Cancelled by the member, admin, or scheduled expiry job
```

## 13.2. BookingType

```txt
ONLINE     Created by a member through the application
COUNTER    Created by an employee at the ticket counter (planned)
```

## 13.3. TicketStatus

```txt
VALID      Ticket is active and has not been used
USED       Ticket has been scanned at the entrance
CANCELLED  Ticket has been voided
```

## 13.4. SeatStatus (in `seat_lock` context)

```txt
AVAILABLE    No active lock for this seat
LOCKED       An active seat_lock exists and has not expired
BOOKED       A confirmed BookingItem exists for this seat
```

---

# 14. Booking Status Transitions

| From       | To         | Actor                          | Implementation Status |
| ---------- | ---------- | ------------------------------ | --------------------- |
| PENDING    | CONFIRMED  | Employee / Admin               | ⬜ Planned             |
| PENDING    | CANCELLED  | Member / Admin                 | ✅ Implemented         |
| CONFIRMED  | CANCELLED  | Admin                          | ✅ Implemented         |
| CONFIRMED  | —          | No other transition allowed    |                       |
| CANCELLED  | —          | No transition allowed          |                       |

---

# 15. Ticket Status Transitions

| From      | To        | Actor    |
| --------- | --------- | -------- |
| VALID     | USED      | Employee |
| VALID     | CANCELLED | Admin    |
| USED      | —         | No transition allowed |
| CANCELLED | —         | No transition allowed |

---

# 16. Seat Reservation / Lock Flow

When a Member creates a booking:

```txt
→ seat_lock row inserted per seat: expires_at = now + 10 minutes
→ Booking record created with status = PENDING
```

When a booking is cancelled (PENDING or CONFIRMED):

```txt
→ seat_lock rows for that booking's seats are deleted
→ Booking status → CANCELLED
```

When a PENDING booking expires (scheduled job — not yet implemented):

```txt
→ seat_lock rows deleted
→ Booking status → CANCELLED
```

---

# 17. Concurrency and Double-Booking Prevention

Two mechanisms work together:

1. **Pessimistic Lock (`SELECT ... FOR UPDATE`)**: `seatLockRepository.findByShowtimeIdAndSeatIdInForUpdate()` locks existing rows before update.
2. **Unique Constraint** on `seat_lock(showtime_id, seat_id)`: Prevents two concurrent insert transactions from inserting a lock for the same seat simultaneously. A `DataIntegrityViolationException` on insert is caught and mapped to `SEAT_ALREADY_LOCKED`.
3. **Optimistic Locking** (`@Version` on `booking_detail.version`): Prevents double-booking at the detail level.

---

# 18. Delete Policy

Hard deletion is not supported for:

```txt
booking
booking_detail
ticket
```

Use status fields to represent lifecycle end-states (`CANCELLED`). `seat_lock` rows are deleted when the lock is released (expiry or cancellation).

---

# 19. Authorization Rules

| API                       | Required Role             | Implemented |
| ------------------------- | ------------------------- | ----------- |
| Create booking            | MEMBER                    | ✅           |
| View own booking history  | MEMBER                    | ✅           |
| Cancel own booking        | MEMBER                    | ✅           |
| View booking by ID        | MEMBER (own) / ADMIN (any)| ✅           |
| Cancel any booking        | ADMIN                     | ✅           |
| Search all bookings       | EMPLOYEE / ADMIN          | ⬜ Planned   |
| Confirm a booking         | EMPLOYEE / ADMIN          | ⬜ Planned   |
| Counter sale              | EMPLOYEE / ADMIN          | ⬜ Planned   |
| View ticket detail        | MEMBER / EMPLOYEE / ADMIN | ⬜ Planned   |

---

# 20. Error Code Catalog

Actual values from `BookingErrorCode` enum:

| Enum Name                  | code | HTTP Status | Message                                                          |
| -------------------------- | ---- | ----------- | ---------------------------------------------------------------- |
| `INVALID_BOOKING_STATE`    | 2001 | 400         | Booking cannot be cancelled in its current state                 |
| `CANCEL_PERMISSION_DENIED` | 2002 | 403         | You do not have permission to cancel this booking                |
| `CANCEL_TIME_EXPIRED`      | 2003 | 400         | Cancellation time has expired for this showtime                  |
| `BOOKING_NOT_FOUND`        | 2004 | 404         | Booking not found                                                |
| `INVALID_SEAT_SELECTION`   | 2005 | 400         | Selected seats are invalid or do not exist                       |
| `SEATS_ALREADY_TAKEN`      | 2006 | 400         | The selected seats are already locked or booked by another user  |
| `SHOWTIME_NOT_AVAILABLE`   | 2007 | 400         | The requested showtime does not exist or is not open for booking |
| `INSUFFICIENT_POINTS`      | 2008 | 400         | The member does not have enough points to complete this booking  |
| `DUPLICATE_SEATS_IN_REQUEST` | 2009 | 400       | Duplicate seat IDs found in the request                          |
| `MEMBER_ONLY_ACTION`       | 2010 | 403         | Only registered members can create a booking and hold seats      |
| `SEAT_ALREADY_LOCKED`      | 2011 | 409         | The seat is already locked or reserved by another user           |
| `SEAT_ALREADY_HELD_BY_YOU` | 2012 | 400         | You have already held this seat and the lock is still valid      |

Common error codes from `common` module:

| Scenario             | code | HTTP Status | message               |
| -------------------- | ---- | ----------- | --------------------- |
| Unauthenticated      | 1008 | 401         | Unauthenticated       |
| Uncategorized error  | 1003 | 500         | Uncategorized error!  |
| Validation failed    | 1005 | 400         | (first failing field message) |

---

# 21. Cross-Service Integration

## 21.1. Movie Service

Booking Service calls Movie Service via OpenFeign (`ShowtimeClient`):

```txt
GET /api/showtimes/{showtimeId}/seats    → Fetch seat availability for a showtime
```

Currently used to check `SeatAvailabilityResponse` per showtime.

## 21.2. User Service

Booking Service calls User Service via OpenFeign (`MemberClient`):

```txt
GET /api/users/{accountId}    → Fetch member's current loyalty point balance
```

Used for point validation during booking (currently `default 0` on failure — safe fallback).

## 21.3. Notification Service

Not yet implemented. Events planned for future sprint:

```txt
BOOKING_CREATED     → Send booking confirmation
BOOKING_CANCELLED   → Send cancellation confirmation
```

Protocol: Kafka (async).

---

# 22. Frontend Notes

Frontend must only communicate through:

```txt
http://localhost:8080/api/...
```

Frontend must:

* Display a countdown timer derived from `lockedUntil` after a PENDING booking is created (10 minutes).
* Disable the booking button while a request is in flight to prevent duplicate submissions.
* Retrieve seat availability from Movie Service seat map endpoint — do not infer availability from booking data.
* Expect `null` fields to be omitted from JSON responses (not serialized as `null`).

---

# 23. Out of Scope (Sprint 2)

* Ticket scanning / check-in.
* Booking expiry Scheduled Job.
* Kafka event integration with Notification Service.
* Online payment (Payment Service).
* Loyalty point history (User Service).
* Revenue reporting and analytics.
* Bulk booking cancellation when a showtime is cancelled.
* Hard delete endpoints.
* Employee Search, Confirm, and Counter Sale endpoints.

---

# 24. Open Questions for Reviewer

1. Is a 10-minute seat lock window appropriate for the business? (Currently hardcoded in service.)
2. What is the `minsBeforeShowtime` value that blocks cancellation? (Configured via `application.yml`.)
3. Should `GET /api/bookings/me` filter by status? Currently returns all statuses.
4. Should non-owner members receive `403 Forbidden` or `404 Not Found` on `GET /api/bookings/{id}`? (Current implementation returns 404 to avoid leaking existence.)
5. What is the loyalty point earning rate (points per VND spent)?
6. Should Counter Sale always create a `booking` record, or issue tickets directly?
7. Are Employees authorized to view tickets belonging to any member?
8. Should COUNTER bookings appear in the Member's `GET /api/bookings/me` response?

---

# 25. Acceptance Criteria

The contract is considered complete when:

* [x] Implemented endpoints are fully documented with correct request/response shapes.
* [x] Planned (not yet implemented) endpoints are clearly marked.
* [x] Response envelope format matches `ApiResponse<T>` from `common` module.
* [x] Error codes match `BookingErrorCode` enum values.
* [x] `BookingStatus` enum reflects actual implementation (`PENDING / CONFIRMED / CANCELLED`).
* [x] Schema reflects actual entities including `seat_lock` table.
* [x] Pagination fields match actual `BookingListResponse` (`pageNumber`, `pageSize`, `isLast`).
* [x] Cancel business rules reflect actual code (PENDING + CONFIRMED allowed).
* [ ] Backend Owner confirms the contract is feasible against current codebase.
* [ ] MR targets the `develop` branch.
