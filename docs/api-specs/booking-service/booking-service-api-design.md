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
| Last Updated   | 23/06/2026                                      |

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
```

Booking Service is responsible for:

* Creating and managing online booking orders placed by Members.
* Handling counter sales processed by Employees.
* Temporarily reserving seats (RESERVED state) during the confirmation window.
* Confirming bookings and issuing tickets.
* Managing booking and ticket lifecycle states.
* Calculating total price, loyalty point usage, and point-based discounts.
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

The schema below reflects the current database structure and is provided solely as a reference for the API contract. Final schema, constraints, indexes, and migrations are to be confirmed by the Booking Service Owner. If the current schema cannot satisfy the contract, both the contract and implementation must be aligned during review.

### 4.1. Table `booking`

| Column           | Type          | Notes                                                      |
| ---------------- | ------------- | ---------------------------------------------------------- |
| booking_id       | varchar(36)   | Primary key, UUID                                          |
| account_id       | varchar(36)   | Logical reference → auth_db.account                        |
| member_id        | varchar(10)   | Nullable — walk-in customers without a membership          |
| showtime_id      | bigint        | Logical reference → movie_db.show_time                     |
| movie_name       | varchar(255)  | Snapshot at time of booking                                |
| show_date        | date          | Snapshot                                                   |
| start_time       | time          | Snapshot                                                   |
| cinema_room_name | varchar(100)  | Snapshot                                                   |
| total_amount     | decimal(10,2) | Total price before discount                                |
| points_used      | int           | Total loyalty points applied                               |
| points_discount  | decimal(10,2) | Monetary discount derived from points                      |
| final_amount     | decimal(10,2) | Amount actually charged to customer                        |
| booking_type     | varchar(20)   | ONLINE \| COUNTER                                          |
| status           | varchar(20)   | PENDING \| CONVERTED \| CANCELLED \| EXPIRED               |
| created_by       | varchar(36)   | account_id of the creator                                  |
| created_at       | timestamp     | Creation timestamp                                         |
| updated_at       | timestamp     | Last update timestamp                                      |
| expires_at       | timestamp     | PENDING bookings auto-expire after 15 minutes              |

### 4.2. Table `booking_detail`

| Column           | Type          | Notes                                              |
| ---------------- | ------------- | -------------------------------------------------- |
| detail_id        | bigint        | Primary key, auto-increment                        |
| booking_id       | varchar(36)   | FK → booking.booking_id                            |
| showtime_seat_id | bigint        | Logical reference → movie_db.showtime_seat         |
| seat_code        | varchar(10)   | Snapshot                                           |
| seat_type        | varchar(20)   | Snapshot — NORMAL \| VIP                           |
| unit_price       | decimal(10,2) | Price for this individual seat                     |
| points_redeemed  | int           | Points applied specifically to this seat           |
| is_from_points   | boolean       | true = this seat was paid entirely with points     |
| version          | bigint        | Optimistic locking field — prevents double-booking |

### 4.3. Table `ticket`

| Column           | Type          | Notes                                          |
| ---------------- | ------------- | ---------------------------------------------- |
| ticket_id        | varchar(36)   | Primary key, UUID                              |
| booking_id       | varchar(36)   | Nullable FK → booking                          |
| detail_id        | bigint        | Nullable FK → booking_detail                   |
| showtime_id      | bigint        | Logical reference → movie_db.show_time         |
| movie_name       | varchar(255)  | Snapshot                                       |
| cinema_room_name | varchar(100)  | Snapshot                                       |
| show_date        | date          | Snapshot                                       |
| start_time       | time          | Snapshot                                       |
| seat_code        | varchar(10)   | Snapshot                                       |
| seat_type        | varchar(20)   | Snapshot                                       |
| price            | decimal(10,2) | Ticket price at time of issuance               |
| is_from_points   | boolean       | Ticket was paid with loyalty points            |
| member_id        | varchar(10)   | Nullable                                       |
| account_id       | varchar(36)   | Logical reference → auth_db.account            |
| qr_code          | varchar(500)  | QR code used for ticket scanning               |
| status           | varchar(20)   | VALID \| USED \| CANCELLED                     |
| issued_at        | timestamp     | Ticket issuance timestamp                      |
| used_at          | timestamp     | Nullable — timestamp when ticket was scanned   |
| issued_by        | varchar(36)   | account_id of the issuing employee             |

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

Example:

```txt
When creating a booking:
→ Booking Service calls Movie Service to fetch showtime, seat, and pricing data
→ Stores the data as a snapshot in booking and booking_detail
→ No physical foreign key is created against movie_db
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
→ API Gateway
→ Booking Service
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

Example:

```txt
2026-07-01
```

### 7.4. Datetime Format

ISO-8601:

```txt
YYYY-MM-DDTHH:mm:ss
```

Example:

```txt
2026-07-01T14:00:00
```

### 7.5. Timezone

Default business timezone:

```txt
Asia/Ho_Chi_Minh
```

Backend must handle timezone consistently when persisting and returning data.

### 7.6. Currency

```txt
VND
```

Monetary values are returned as plain numbers:

```json
{
  "finalAmount": 200000
}
```

Currency symbols must not appear in API values.

### 7.7. Pagination

* `page` is zero-based (starts at `0`).
* `size` defaults to `10`.
* Maximum `size` is `50`.

### 7.8. Sorting

Format:

```txt
sort=<field>,<direction>
```

Example:

```txt
sort=createdAt,desc
```

Valid directions:

```txt
asc
desc
```

---

## 8. Common Response Contract

All responses from this system use the shared `ApiResponse<T>` wrapper defined in the `common` module:

```java
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    int code;
    String message;
    T result;
}
```

`@JsonInclude(NON_NULL)` means any field that is `null` is **omitted entirely** from the JSON output — it will not appear as `null`.

### 8.1. Success Response — with payload

Returned when the operation succeeds and there is data to return.

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

### 8.2. Success Response — no payload

Returned for operations that produce no data (e.g. cancel, delete).

```json
{
  "code": 1000,
  "message": "Booking cancelled successfully"
}
```

`result` is omitted because it is `null`.

### 8.3. Error Response

Returned when `AppException` is thrown. HTTP status is derived from the error code's `statusCode` field.

```json
{
  "code": 1008,
  "message": "Unauthenticated"
}
```

`result` is omitted because it is `null`.

### 8.4. Validation Error

Returned when `@Valid` constraint fails (`MethodArgumentNotValidException`). Current implementation returns the `defaultMessage` of the first failing field — there is no per-field error array.

```json
{
  "code": 1005,
  "message": "Seat list must not be empty"
}
```

### 8.5. Uncategorized Server Error

Returned for unhandled `RuntimeException`.

```json
{
  "code": 1003,
  "message": "Uncategorized error!"
}
```

### 8.6. Response Field Definitions

| Field   | Type              | Present when          | Description                                      |
| ------- | ----------------- | --------------------- | ------------------------------------------------ |
| code    | int               | Always                | `1000` = success; other values indicate an error |
| message | string            | Error or explicit set | Human-readable description; omitted on success if not set |
| result  | object/array      | Success with payload  | Response payload; omitted when `null`            |

> **Note for Booking Service implementation:** Always set `code = 1000` on success responses. Never set `result` to a non-null value on error responses. Rely on `@JsonInclude(NON_NULL)` to clean up the output automatically.

---

## 9. API Classification

### 9.1. Member API

Requires a Bearer Token with role `MEMBER`:

```txt
POST   /api/bookings
GET    /api/bookings/my
GET    /api/bookings/{bookingId}
PATCH  /api/bookings/{bookingId}/cancel
GET    /api/bookings/my-tickets
GET    /api/tickets/{ticketId}
```

### 9.2. Employee API

Requires a Bearer Token with role `EMPLOYEE` or `ADMIN`:

```txt
GET    /api/bookings/search
PATCH  /api/bookings/{bookingId}/confirm
POST   /api/bookings/counter-sale
GET    /api/tickets/{ticketId}
```

### 9.3. Admin API

Inherits all Employee API access. Additionally authorized to view all bookings and tickets across the system.

---

## 10. Endpoint Summary

| Method | Endpoint                            | Access                    | Purpose                              |
| ------ | ----------------------------------- | ------------------------- | ------------------------------------ |
| POST   | `/api/bookings`                     | Member                    | Create an online booking             |
| GET    | `/api/bookings/my`                  | Member                    | Get own booking history              |
| GET    | `/api/bookings/{bookingId}`         | Member / Employee / Admin | Get booking detail                   |
| PATCH  | `/api/bookings/{bookingId}/cancel`  | Member                    | Cancel a booking                     |
| GET    | `/api/bookings/search`              | Employee / Admin          | Search bookings                      |
| PATCH  | `/api/bookings/{bookingId}/confirm` | Employee / Admin          | Confirm a booking and issue tickets  |
| POST   | `/api/bookings/counter-sale`        | Employee / Admin          | Sell tickets directly at the counter |
| GET    | `/api/bookings/my-tickets`          | Member                    | Get own ticket history               |
| GET    | `/api/tickets/{ticketId}`           | Member / Employee / Admin | Get ticket detail                    |

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

| Field      | Type          | Required | Validation                                    |
| ---------- | ------------- | -------- | --------------------------------------------- |
| showtimeId | integer       | Yes      | > 0; showtime must exist and be in OPEN state |
| seatIds    | array<number> | Yes      | Non-empty; max 8 seats; no duplicates         |
| pointsUsed | integer       | No       | >= 0; must not exceed member's current points |

### Processing Rules

* Verify showtime exists and is in OPEN status.
* Verify all requested seats belong to the showtime and are in AVAILABLE status.
* Transition seat status: AVAILABLE → RESERVED.
* Set `expires_at = now + 15 minutes`.
* Fetch and snapshot showtime, seat, and pricing data from Movie Service.
* Compute `total_amount`, `points_discount`, and `final_amount`.
* All of the above must execute within a single database transaction.

### Response Success

Status: `201 Created`

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "movieName": "Avengers: Endgame",
    "showDate": "2026-07-01",
    "startTime": "14:00:00",
    "cinemaRoomName": "Room 1",
    "seats": [
      {
        "seatCode": "A1",
        "seatType": "NORMAL",
        "unitPrice": 100000,
        "isFromPoints": false
      },
      {
        "seatCode": "A2",
        "seatType": "NORMAL",
        "unitPrice": 100000,
        "isFromPoints": false
      }
    ],
    "totalAmount": 200000,
    "pointsUsed": 0,
    "pointsDiscount": 0,
    "finalAmount": 200000,
    "bookingType": "ONLINE",
    "status": "PENDING",
    "expiresAt": "2026-07-01T13:30:00",
    "createdAt": "2026-07-01T13:15:00"
  }
}
```

### Response Error: Showtime Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Showtime not found",
  "errorCode": "SHOWTIME_NOT_FOUND",
  "data": null,
  "errors": null
}
```

### Response Error: Showtime Not Open

Status: `409 Conflict`

```json
{
  "success": false,
  "message": "Showtime is not available for booking",
  "errorCode": "SHOWTIME_NOT_OPEN",
  "data": null,
  "errors": null
}
```

### Response Error: Seat Not Available

Status: `409 Conflict`

```json
{
  "success": false,
  "message": "One or more seats are not available",
  "errorCode": "SEAT_NOT_AVAILABLE",
  "data": null,
  "errors": null
}
```

### Response Error: Insufficient Points

Status: `409 Conflict`

```json
{
  "success": false,
  "message": "Member does not have enough loyalty points",
  "errorCode": "INSUFFICIENT_POINTS",
  "data": null,
  "errors": null
}
```

### Response Error: Validation

Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "data": null,
  "errors": [
    {
      "field": "seatIds",
      "message": "Seat list must not be empty"
    }
  ]
}
```

---

## 11.2. Get My Bookings

### Endpoint

```http
GET /api/bookings/my
```

### Headers

```http
Authorization: Bearer <accessToken>
```

### Query Parameters

| Parameter | Type   | Required | Validation      | Description                 |
| --------- | ------ | -------- | --------------- | --------------------------- |
| page      | int    | No       | >= 0            | Page index, default `0`     |
| size      | int    | No       | 1–50            | Page size, default `10`     |
| status    | string | No       | BookingStatus   | Filter by booking status    |
| sort      | string | No       | field,direction | Sort order                  |

### Response Success

Status: `200 OK`

```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": {
    "content": [
      {
        "bookingId": "550e8400-e29b-41d4-a716-446655440000",
        "movieName": "Avengers: Endgame",
        "showDate": "2026-07-01",
        "startTime": "14:00:00",
        "cinemaRoomName": "Room 1",
        "totalSeats": 2,
        "finalAmount": 200000,
        "bookingType": "ONLINE",
        "status": "PENDING",
        "expiresAt": "2026-07-01T13:30:00",
        "createdAt": "2026-07-01T13:15:00"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1,
    "first": true,
    "last": true
  }
}
```

### Empty Result

Status: `200 OK`

```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": {
    "content": [],
    "page": 0,
    "size": 10,
    "totalElements": 0,
    "totalPages": 0,
    "first": true,
    "last": true
  }
}
```

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

| Field     | Type   | Required | Validation |
| --------- | ------ | -------- | ---------- |
| bookingId | string | Yes      | UUID       |

### Access Rule

Members may only retrieve their own bookings. Employees and Admins may retrieve any booking.

### Response Success

Status: `200 OK`

```json
{
  "success": true,
  "message": "Booking retrieved successfully",
  "data": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "movieName": "Avengers: Endgame",
    "showDate": "2026-07-01",
    "startTime": "14:00:00",
    "cinemaRoomName": "Room 1",
    "seats": [
      {
        "seatCode": "A1",
        "seatType": "NORMAL",
        "unitPrice": 100000,
        "pointsRedeemed": 0,
        "isFromPoints": false
      },
      {
        "seatCode": "A2",
        "seatType": "NORMAL",
        "unitPrice": 100000,
        "pointsRedeemed": 0,
        "isFromPoints": false
      }
    ],
    "totalAmount": 200000,
    "pointsUsed": 0,
    "pointsDiscount": 0,
    "finalAmount": 200000,
    "bookingType": "ONLINE",
    "status": "PENDING",
    "expiresAt": "2026-07-01T13:30:00",
    "createdAt": "2026-07-01T13:15:00"
  }
}
```

### Response Error: Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Booking not found",
  "errorCode": "BOOKING_NOT_FOUND",
  "data": null,
  "errors": null
}
```

### Response Error: Forbidden

Status: `403 Forbidden`

```json
{
  "success": false,
  "message": "Access denied",
  "errorCode": "FORBIDDEN",
  "data": null,
  "errors": null
}
```

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

| Field     | Type   | Required | Validation |
| --------- | ------ | -------- | ---------- |
| bookingId | string | Yes      | UUID       |

### Business Rules

* Only the Member who owns the booking may cancel it.
* Only bookings in PENDING status can be cancelled.
* Upon cancellation, all reserved seats revert to AVAILABLE.

### Response Success

Status: `200 OK`

```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": null
}
```

### Response Error: Invalid Status Transition

Status: `409 Conflict`

```json
{
  "success": false,
  "message": "Only PENDING bookings can be cancelled",
  "errorCode": "BOOKING_INVALID_STATUS_TRANSITION",
  "data": null,
  "errors": null
}
```

### Response Error: Forbidden

Status: `403 Forbidden`

```json
{
  "success": false,
  "message": "Access denied",
  "errorCode": "FORBIDDEN",
  "data": null,
  "errors": null
}
```

---

## 11.5. Get My Tickets

### Endpoint

```http
GET /api/bookings/my-tickets
```

### Headers

```http
Authorization: Bearer <accessToken>
```

### Query Parameters

| Parameter | Type   | Required | Validation   | Description                 |
| --------- | ------ | -------- | ------------ | --------------------------- |
| page      | int    | No       | >= 0         | Page index, default `0`     |
| size      | int    | No       | 1–50         | Page size, default `10`     |
| status    | string | No       | TicketStatus | Filter by ticket status     |

### Response Success

Status: `200 OK`

```json
{
  "success": true,
  "message": "Tickets retrieved successfully",
  "data": {
    "content": [
      {
        "ticketId": "660e8400-e29b-41d4-a716-446655440000",
        "movieName": "Avengers: Endgame",
        "showDate": "2026-07-01",
        "startTime": "14:00:00",
        "cinemaRoomName": "Room 1",
        "seatCode": "A1",
        "seatType": "NORMAL",
        "price": 100000,
        "isFromPoints": false,
        "status": "VALID",
        "issuedAt": "2026-07-01T13:20:00"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1,
    "first": true,
    "last": true
  }
}
```

### Empty Result

Status: `200 OK`

```json
{
  "success": true,
  "message": "Tickets retrieved successfully",
  "data": {
    "content": [],
    "page": 0,
    "size": 10,
    "totalElements": 0,
    "totalPages": 0,
    "first": true,
    "last": true
  }
}
```

---

# 12. Ticket APIs

## 12.1. Get Ticket Detail

### Endpoint

```http
GET /api/tickets/{ticketId}
```

### Headers

```http
Authorization: Bearer <accessToken>
```

### Path Parameter

| Field    | Type   | Required | Validation |
| -------- | ------ | -------- | ---------- |
| ticketId | string | Yes      | UUID       |

### Access Rule

Members may only retrieve their own tickets. Employees and Admins may retrieve any ticket.

### Response Success

Status: `200 OK`

```json
{
  "success": true,
  "message": "Ticket retrieved successfully",
  "data": {
    "ticketId": "660e8400-e29b-41d4-a716-446655440000",
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "movieName": "Avengers: Endgame",
    "cinemaRoomName": "Room 1",
    "showDate": "2026-07-01",
    "startTime": "14:00:00",
    "seatCode": "A1",
    "seatType": "NORMAL",
    "price": 100000,
    "isFromPoints": false,
    "qrCode": "data:image/png;base64,...",
    "status": "VALID",
    "issuedAt": "2026-07-01T13:20:00",
    "issuedBy": "employee-account-id"
  }
}
```

### Response Error: Ticket Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Ticket not found",
  "errorCode": "TICKET_NOT_FOUND",
  "data": null,
  "errors": null
}
```

### Response Error: Forbidden

Status: `403 Forbidden`

```json
{
  "success": false,
  "message": "Access denied",
  "errorCode": "FORBIDDEN",
  "data": null,
  "errors": null
}
```

---

# 13. Employee Booking APIs

## 13.1. Search Bookings

### Endpoint

```http
GET /api/bookings/search
```

### Headers

```http
Authorization: Bearer <accessToken>
```

### Query Parameters

| Parameter | Type   | Required | Validation      | Description                                   |
| --------- | ------ | -------- | --------------- | --------------------------------------------- |
| keyword   | string | No       | Max 255 chars   | Search by booking ID, account ID, phone, or national ID |
| status    | string | No       | BookingStatus   | Filter by booking status                      |
| page      | int    | No       | >= 0            | Page index, default `0`                       |
| size      | int    | No       | 1–50            | Page size, default `10`                       |
| sort      | string | No       | field,direction | Sort order, default `createdAt,desc`          |

### Response Success

Status: `200 OK`

```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": {
    "content": [
      {
        "bookingId": "550e8400-e29b-41d4-a716-446655440000",
        "accountId": "acc-001",
        "memberId": "MEM001",
        "movieName": "Avengers: Endgame",
        "showDate": "2026-07-01",
        "startTime": "14:00:00",
        "cinemaRoomName": "Room 1",
        "totalSeats": 2,
        "finalAmount": 200000,
        "bookingType": "ONLINE",
        "status": "PENDING",
        "createdAt": "2026-07-01T13:15:00"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1,
    "first": true,
    "last": true
  }
}
```

### Empty Result

Status: `200 OK`

```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": {
    "content": [],
    "page": 0,
    "size": 10,
    "totalElements": 0,
    "totalPages": 0,
    "first": true,
    "last": true
  }
}
```

---

## 13.2. Confirm Booking

### Endpoint

```http
PATCH /api/bookings/{bookingId}/confirm
```

### Headers

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Path Parameter

| Field     | Type   | Required | Validation |
| --------- | ------ | -------- | ---------- |
| bookingId | string | Yes      | UUID       |

### Request Body

```json
{
  "pointsUsed": 0
}
```

### Field Definitions

| Field      | Type    | Required | Validation                              |
| ---------- | ------- | -------- | --------------------------------------- |
| pointsUsed | integer | No       | >= 0; must not exceed member's balance  |

### Processing Rules

* Only bookings in PENDING status can be confirmed.
* If `pointsUsed > 0`, verify the member has sufficient points.
* Transition seat status: RESERVED → SOLD.
* Create one ticket per seat in the booking.
* Generate a QR code for each ticket.
* Update `sold_seats` on the corresponding show_time record.
* Transition booking status to CONVERTED upon successful ticket issuance.
* All of the above must execute within a single database transaction.

### Response Success

Status: `200 OK`

```json
{
  "success": true,
  "message": "Booking confirmed and tickets issued successfully",
  "data": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "CONVERTED",
    "tickets": [
      {
        "ticketId": "660e8400-e29b-41d4-a716-446655440000",
        "seatCode": "A1",
        "seatType": "NORMAL",
        "price": 100000,
        "isFromPoints": false,
        "status": "VALID",
        "qrCode": "data:image/png;base64,...",
        "issuedAt": "2026-07-01T13:20:00"
      },
      {
        "ticketId": "770e8400-e29b-41d4-a716-446655440000",
        "seatCode": "A2",
        "seatType": "NORMAL",
        "price": 100000,
        "isFromPoints": false,
        "status": "VALID",
        "qrCode": "data:image/png;base64,...",
        "issuedAt": "2026-07-01T13:20:00"
      }
    ]
  }
}
```

### Response Error: Booking Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Booking not found",
  "errorCode": "BOOKING_NOT_FOUND",
  "data": null,
  "errors": null
}
```

### Response Error: Invalid Status Transition

Status: `409 Conflict`

```json
{
  "success": false,
  "message": "Only PENDING bookings can be confirmed",
  "errorCode": "BOOKING_INVALID_STATUS_TRANSITION",
  "data": null,
  "errors": null
}
```

### Response Error: Insufficient Points

Status: `409 Conflict`

```json
{
  "success": false,
  "message": "Member does not have enough loyalty points",
  "errorCode": "INSUFFICIENT_POINTS",
  "data": null,
  "errors": null
}
```

---

## 13.3. Counter Sale

### Endpoint

```http
POST /api/bookings/counter-sale
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
  "memberId": "MEM001",
  "pointsUsed": 0
}
```

### Field Definitions

| Field      | Type          | Required | Validation                                    |
| ---------- | ------------- | -------- | --------------------------------------------- |
| showtimeId | integer       | Yes      | > 0; showtime must exist and be in OPEN state |
| seatIds    | array<number> | Yes      | Non-empty; max 8 seats; no duplicates         |
| memberId   | string        | No       | Nullable — walk-in customers without membership |
| pointsUsed | integer       | No       | >= 0; must not exceed member's current points |

### Processing Rules

* Verify showtime exists and is in OPEN status.
* Verify all seats are in AVAILABLE status.
* Create a booking with `bookingType = COUNTER` and `status = CONVERTED`.
* Issue tickets immediately — no PENDING state.
* Transition seat status: AVAILABLE → SOLD.
* Generate a QR code for each ticket.
* Credit loyalty points to member if `memberId` is provided.
* All of the above must execute within a single database transaction.

### Response Success

Status: `201 Created`

```json
{
  "success": true,
  "message": "Tickets issued successfully",
  "data": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440001",
    "tickets": [
      {
        "ticketId": "660e8400-e29b-41d4-a716-446655440001",
        "movieName": "Avengers: Endgame",
        "showDate": "2026-07-01",
        "startTime": "14:00:00",
        "cinemaRoomName": "Room 1",
        "seatCode": "B1",
        "seatType": "VIP",
        "price": 150000,
        "isFromPoints": false,
        "status": "VALID",
        "qrCode": "data:image/png;base64,...",
        "issuedAt": "2026-07-01T13:25:00"
      }
    ]
  }
}
```

### Response Error: Showtime Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Showtime not found",
  "errorCode": "SHOWTIME_NOT_FOUND",
  "data": null,
  "errors": null
}
```

### Response Error: Seat Not Available

Status: `409 Conflict`

```json
{
  "success": false,
  "message": "One or more seats are not available",
  "errorCode": "SEAT_NOT_AVAILABLE",
  "data": null,
  "errors": null
}
```

### Response Error: Member Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Member not found",
  "errorCode": "MEMBER_NOT_FOUND",
  "data": null,
  "errors": null
}
```

---

# 14. Enum Definitions

## 14.1. BookingStatus

```txt
PENDING     Seats are held; awaiting counter confirmation
CONVERTED   Tickets have been successfully issued
CANCELLED   Cancelled by the member or an employee
EXPIRED     Booking was not confirmed within 15 minutes and was auto-expired
```

## 14.2. BookingType

```txt
ONLINE     Created by a member through the application
COUNTER    Created by an employee at the ticket counter
```

## 14.3. TicketStatus

```txt
VALID      Ticket is active and has not been used
USED       Ticket has been scanned at the entrance
CANCELLED  Ticket has been voided
```

## 14.4. SeatType (snapshot from Movie Service)

```txt
NORMAL
VIP
```

---

# 15. Booking Status Transitions

| From      | To        | Actor                  |
| --------- | --------- | ---------------------- |
| PENDING   | CONVERTED | Employee / Admin       |
| PENDING   | CANCELLED | Member                 |
| PENDING   | EXPIRED   | Scheduled Job (system) |
| CONVERTED | —         | No transition allowed  |
| CANCELLED | —         | No transition allowed  |
| EXPIRED   | —         | No transition allowed  |

---

# 16. Ticket Status Transitions

| From      | To        | Actor    |
| --------- | --------- | -------- |
| VALID     | USED      | Employee |
| VALID     | CANCELLED | Admin    |
| USED      | —         | No transition allowed |
| CANCELLED | —         | No transition allowed |

---

# 17. Seat Reservation Flow

When a Member creates a booking:

```txt
Seat status:  AVAILABLE → RESERVED
expires_at  = now + 15 minutes
```

When an Employee confirms the booking:

```txt
Seat status:  RESERVED → SOLD
```

When a booking is cancelled or expires:

```txt
Seat status:  RESERVED → AVAILABLE
```

A Scheduled Job runs periodically (recommended interval: 1 minute) to scan for PENDING bookings that have passed `expires_at` and expire them automatically.

---

# 18. Concurrency and Double-Booking Prevention

Booking Service must guarantee that two concurrent requests cannot book the same seat.

Mechanism:

* `booking_detail.version` uses Optimistic Locking (`@Version`).
* Seat availability is validated within a database transaction.
* If two concurrent requests target the same seat, only one succeeds; the other receives a `SEAT_NOT_AVAILABLE` error.

---

# 19. Delete Policy

Hard deletion is not supported for:

```txt
booking
booking_detail
ticket
```

Use status fields to represent lifecycle end-states:

```txt
CANCELLED
EXPIRED
```

Rationale:

* Preserves the full transaction history for members.
* Supports future reporting and analytics.
* Prevents loss of financial records.

---

# 20. Idempotency and Duplicate Requests

Sprint 2 does not require support for the `Idempotency-Key` header:

```http
Idempotency-Key: <client-generated-uuid>
```

Clients must:

* Disable the submit button while a request is in flight.
* Not re-send create requests.

Backend must guard against duplicates through:

* Optimistic locking.
* Business rule validation.
* Transactional integrity.

---

# 21. Authorization Rules

| API Group                        | Required Role             |
| -------------------------------- | ------------------------- |
| Create online booking            | MEMBER                    |
| View own booking history         | MEMBER                    |
| Cancel own booking               | MEMBER                    |
| View own ticket history          | MEMBER                    |
| View ticket detail               | MEMBER / EMPLOYEE / ADMIN |
| Search all bookings              | EMPLOYEE / ADMIN          |
| Confirm a booking                | EMPLOYEE / ADMIN          |
| Sell tickets at the counter      | EMPLOYEE / ADMIN          |
| View all bookings in the system  | ADMIN                     |

---

# 22. Error Code Catalog

| Error Code                          | HTTP Status | Meaning                               |
| ----------------------------------- | ----------- | ------------------------------------- |
| `BOOKING_NOT_FOUND`                 | 404         | Booking does not exist                |
| `BOOKING_INVALID_STATUS_TRANSITION` | 409         | Status transition is not permitted    |
| `BOOKING_EXPIRED`                   | 409         | Booking has already expired           |
| `TICKET_NOT_FOUND`                  | 404         | Ticket does not exist                 |
| `TICKET_INVALID_STATUS_TRANSITION`  | 409         | Ticket status transition not permitted|
| `SHOWTIME_NOT_FOUND`                | 404         | Showtime does not exist               |
| `SHOWTIME_NOT_OPEN`                 | 409         | Showtime is not in OPEN status        |
| `SEAT_NOT_FOUND`                    | 404         | Seat does not exist                   |
| `SEAT_NOT_AVAILABLE`                | 409         | Seat is no longer available           |
| `MEMBER_NOT_FOUND`                  | 404         | Member does not exist                 |
| `INSUFFICIENT_POINTS`               | 409         | Member does not have enough points    |
| `VALIDATION_ERROR`                  | 400         | Request failed validation             |
| `UNAUTHORIZED`                      | 401         | Authentication required               |
| `FORBIDDEN`                         | 403         | Insufficient permissions              |
| `INTERNAL_SERVER_ERROR`             | 500         | Unexpected server error               |

---

# 23. Cross-Service Integration

## 23.1. Movie Service

Booking Service calls Movie Service to:

```txt
Create booking      → Fetch showtime, seat, and pricing data for snapshotting
Confirm booking     → Update sold_seats on the show_time record
Counter sale        → Same as create booking
```

Protocol: OpenFeign (synchronous).

## 23.2. User Service

Booking Service calls User Service to:

```txt
Create booking      → Validate loyalty point balance
Confirm booking     → Deduct points / credit earned points post-transaction
Counter sale        → Same as above
```

Protocol: OpenFeign (sync) or Kafka event (async) — to be confirmed during implementation.

## 23.3. Notification Service

Booking Service publishes events to Notification Service when:

```txt
BOOKING_CREATED    → Send booking confirmation email
BOOKING_CONVERTED  → Send ticket issuance email
BOOKING_CANCELLED  → Send cancellation confirmation email
BOOKING_EXPIRED    → Send booking expiry notification
```

Protocol: Kafka (asynchronous) — implementation deferred to a future sprint.

---

# 24. Frontend Notes

Frontend must only communicate through:

```txt
http://localhost:8080/api/...
```

Frontend must not call the Booking Service port directly.

Frontend must:

* Display a countdown timer derived from `expiresAt` after a PENDING booking is created.
* Disable the booking button while a request is in flight to prevent duplicate submissions.
* Retrieve seat availability (AVAILABLE / RESERVED / SOLD) from the Movie Service seat map endpoint — do not infer availability from booking data.

---

# 25. Out of Scope

The following are explicitly excluded from Sprint 2:

* Ticket scanning / check-in at the entrance.
* Refund processing for CONVERTED bookings that are subsequently cancelled.
* Booking expiry Scheduled Job (to be implemented as a separate issue).
* Kafka event integration with Notification Service.
* Online payment (belongs to Payment Service).
* Loyalty point history (belongs to User Service).
* Revenue reporting and analytics.
* Bulk booking cancellation when a showtime is cancelled.
* Hard delete endpoints.

---

# 26. Implementation Issue Direction

Once the contract is approved, the following implementation issues may be created:

```txt
[Backend] Implement Create Booking and Seat Reservation
[Backend] Implement Confirm Booking and Ticket Issuance
[Backend] Implement Counter Sale
[Backend] Implement Booking Expiry Scheduler
[Backend] Implement Employee Booking Search
```

Each implementation issue must conform to this contract.

If implementation requires changes to any endpoint, request shape, response shape, or business rule:

```txt
The contract must be updated in the same merge request.
```

---

# 27. Acceptance Criteria

The contract is considered complete when:

* [x] Full endpoint summary is provided.
* [x] Member / Employee / Admin classification is defined.
* [x] Request headers are specified.
* [x] Path and query parameter definitions are included.
* [x] Field definitions with validation rules are included.
* [x] Success responses are documented for every endpoint.
* [x] Error responses are documented for every endpoint.
* [x] Pagination, filter, and sort conventions are specified.
* [x] Business rules and processing rules are defined.
* [x] Enum and status definitions are included.
* [x] Status transition rules are defined for both booking and ticket.
* [x] Date, time, and timezone conventions are specified.
* [x] Currency convention is specified.
* [x] Logical reference pattern is documented.
* [x] Concurrency and double-booking prevention strategy is defined.
* [x] Seat reservation expiry mechanism is described.
* [x] Idempotency and duplicate request policy is noted.
* [x] Delete policy is defined.
* [x] Cross-service integration notes are included.
* [ ] Backend Owner confirms the contract is feasible against current codebase.
* [ ] Document is sufficiently clear to split into implementation issues.
* [ ] MR targets the `develop` branch.

---

# 28. Open Questions for Reviewer

1. Is the default booking expiry window of 15 minutes appropriate for the business?
2. Is a Scheduled Job polling interval of 1 minute acceptable for expiry processing?
3. What is the loyalty point earning rate (points per VND spent)?
4. Should a Counter Sale always create a `booking` record, or can it issue tickets directly without one?
5. Should QR codes be returned as base64 data URIs or as URLs to a hosted resource?
6. Is the maximum of 8 seats per booking the correct business limit?
7. Should User Service integration use OpenFeign (sync) or Kafka (async)?
8. Are Employees authorized to view tickets belonging to any member?
9. Should COUNTER bookings appear in the Member's `GET /api/bookings/my` response?
10. Confirm that `page` is zero-based — must align with Movie Service convention.
