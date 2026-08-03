# API_LIST.md

## 1. Source Contract Reviewed

* `docs/feature/booking-service/BOOKING_SERVICE_PRODUCT_ISSUES.md`

> Danh sách dưới đây phản ánh API target trong backlog, không khẳng định controller/handler đã tồn tại. Tên DTO/handler ở mức conceptual để tránh bịa tên class Java trước khi implementation được tạo.

## 2. API Summary

* **Customer Booking APIs**: 5 routes/actions
* **Ticket APIs**: 3 routes/actions
* **Employee/Admin Operation APIs**: 6 routes/actions
* **Checkout Quote APIs**: 2 routes/actions (P2)
* **Booking-owned Internal APIs**: 1 route/action
* **Consumed Movie APIs**: 3 routes/actions
* **Consumed Payment APIs**: 2 reference routes/actions
* **Consumed/Published Events**: asynchronous contracts, không tính là HTTP API

## 3. Customer Booking APIs

| Method | Endpoint | Priority | Actor / Role | Request | Response | Purpose | Status Change? | Notes |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/bookings` | P0 | MEMBER | `showtimeId`, `showtimeSeatIds`; header `Idempotency-Key` | Pending booking snapshot | Reserve ghế và tạo booking online | → `PENDING_PAYMENT` | Không nhận price/movie/cinema/TTL |
| GET | `/api/bookings?scope=SELF&view=&status=&page=&size=` | P1 | MEMBER | Query filters | Paginated booking summary | Vé của tôi/lịch sử | Không | Sort mặc định `createdAt DESC` |
| GET | `/api/bookings/{bookingId}` | P1 | Booking owner | Path ID | Full booking snapshot + action flags | Xem chi tiết booking | Không | Foreign booking trả như not found |
| POST | `/api/bookings/{bookingId}/cancellations` | P1 | Booking owner | Reason; header `Idempotency-Key` | Cancellation resource | Yêu cầu hủy/hoàn | Có | `201` nếu xong đồng bộ; `202` nếu đang xử lý |
| GET | `/api/bookings/{bookingId}/cancellations/{cancellationId}` | P1 | Owner / scoped operator | Path IDs | Cancellation status | Theo dõi hủy/hoàn | Không | Đọc persisted orchestration state |

### Create Online Booking Contract

```json
{
  "showtimeId": 55,
  "showtimeSeatIds": [901, 902]
}
```

```json
{
  "code": 1000,
  "result": {
    "bookingId": "booking-123",
    "status": "PENDING_PAYMENT",
    "showtimeId": 55,
    "movieName": "Avengers",
    "cinemaRoomName": "Phòng IMAX 1",
    "totalAmount": 240000,
    "finalAmount": 240000,
    "expiresAt": "2026-07-20T17:15:00+07:00"
  }
}
```

## 4. Ticket APIs

| Method | Endpoint | Priority | Actor / Role | Request | Response | Purpose | Status Change? | Notes |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/bookings/{bookingId}/ticket-pass` | P1 | Booking owner | Path ID | Booking QR pass + tickets | Lấy QR/vé đã xác nhận | Không | Chỉ booking `CONFIRMED`; raw token là credential |
| GET | `/api/tickets?scope=SELF&view=&status=&page=&size=` | P1 | MEMBER | Query filters | Paginated tickets | Liệt kê vé của tôi | Không | Hỗ trợ upcoming/past/status |
| POST | `/api/ticket-check-ins` | P1 | Employee/admin/trusted gate có permission | `qrToken`, mode, optional ticket IDs, gate; idempotency header | Ticket states | Check-in toàn bộ/chọn vé | `VALID -> USED` | Phải đúng cluster và time window |

## 5. Employee / Admin Operation APIs

| Method | Endpoint | Priority | Actor / Role | Request | Response | Purpose | Status Change? | Notes |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/bookings?scope=CLUSTER&bookingCode=&showtimeId=&status=&fromDate=&toDate=&page=&size=` | P1 | EMPLOYEE / ADMIN | Query filters | Paginated booking summaries | Tra cứu booking theo cluster | Không | Scope lấy từ principal |
| POST | `/api/bookings` | P1 | EMPLOYEE / ADMIN | Counter booking + payment/terminal; idempotency header | Confirmed booking + receipt | Bán vé tại quầy | → `CONFIRMED` | Cùng collection, phân biệt `bookingType=COUNTER` |
| POST | `/api/operations/bookings/{bookingId}/cancellations` | P1 | `BOOKING_CANCEL_OVERRIDE` | Reason/override request; idempotency header | Cancellation resource | Hủy vận hành/override policy | Có | Bắt buộc audit và cluster scope |
| POST | `/api/booking-reconciliations` | P1 | Authorized EMPLOYEE / ADMIN | Booking/payment evidence; idempotency header | Open reconciliation case | Ghi nhận mismatch | Không trực tiếp | Không confirm/refund ngay trong controller |
| GET | `/api/operations/booking-reconciliations?status=&page=&size=` | P2 | Authorized operator | Query filters | Paginated cases | Xem case đối soát | Không | Operations namespace |
| POST | `/api/operations/booking-reconciliation-attempts` | P2 | Authorized operator | `caseId`, reason; idempotency header | Queued attempt | Retry safe compensation | Có thể | Rule unsafe phải chặn |

> Bảng summary tính counter create và online create là hai action nhưng dùng chung route `POST /api/bookings`.

## 6. Checkout Quote APIs (P2)

| Method | Endpoint | Actor / Role | Request | Response | Purpose | Notes |
|---|---|---|---|---|---|---|
| POST | `/api/booking-quotes` | MEMBER | Showtime, seats, optional promotion/points/concessions | Quote line items, discount, total, expiry | Tính quote trước booking | Quote không giữ ghế |
| POST | `/api/bookings` với `quoteId` | MEMBER | `quoteId`; idempotency header | Pending booking | Tạo booking từ quote | Quote phải còn hạn, đúng owner và ghế vẫn available |

## 7. Booking-owned Internal API

| Method | Endpoint | Caller | Response | Purpose | Notes |
|---|---|---|---|---|---|
| GET | `/internal/bookings/{bookingId}/payment-context` | Payment Service credential | Owner, status, amount, currency, expiry | Cung cấp payment context authoritative | Không route public; expired/terminal booking không payable |

### Payment Context Success

```json
{
  "code": 1000,
  "result": {
    "bookingId": "booking-123",
    "accountId": "acc-001",
    "status": "PENDING_PAYMENT",
    "amount": 240000,
    "currency": "VND",
    "expiresAt": "2026-07-20T17:15:00+07:00"
  }
}
```

## 8. Consumed Movie Service APIs

> Các endpoint này do Movie Service sở hữu. Booking Service chỉ triển khai typed client, mapping, timeout, bounded retry, idempotency và compensation.

| Method | Endpoint | Request | Response | Purpose | Idempotency |
|---|---|---|---|---|---|
| POST | `/internal/showtimes/{showtimeId}/inventory-reservations` | `holdReference`, owner, seat IDs | Hold token, expiry, authoritative snapshot | Reserve all-or-nothing | Bắt buộc |
| POST | `/internal/inventory-confirmations` | `holdToken`, `bookingId` | Sold seat IDs, confirmed time | `RESERVED -> SOLD` | Bắt buộc |
| POST | `/internal/inventory-releases` | `holdToken`, `holdReference`, reason | Released seat IDs/time | `RESERVED -> AVAILABLE` | Bắt buộc |

## 9. Consumed Payment Service APIs

> Các endpoint này do Payment Service sở hữu; không tạo controller/provider adapter trong Booking Service.

| Method | Endpoint | Request | Response | Booking Responsibility |
|---|---|---|---|---|
| POST | `/api/payments` | `bookingId`, method, return URL | Payment ID, checkout URL, expiry | Cung cấp payment context authoritative; không tin amount từ frontend |
| POST | `/internal/payments/{paymentId}/refunds` | Booking ID, amount, reason, metadata | Refund reference/status | Typed client, stable key, retry/query/reconciliation |

## 10. Consumed Internal Events

| Event | Producer | Priority | Booking Action |
|---|---|---|---|
| `PAYMENT_SUCCEEDED` | Payment Service | P0 | Deduplicate, validate amount/currency, confirm inventory, issue ticket |
| `PAYMENT_FAILED` | Payment Service | P0/P1 | Mark failure, release resources/cancel according to state |
| `REFUND_SUCCEEDED` | Payment Service | P1 | Complete refund/cancellation and continue cancel-sale/ticket revoke |
| `REFUND_FAILED` | Payment Service | P1 | Keep pending/failed state, retry/query or open reconciliation |
| `SHOWTIME_CANCELLED` | Movie Service | P1 | Create one cancellation workflow per active booking |

Required event envelope fields: `eventId`, `eventType`, `eventVersion`, aggregate/reference IDs, `occurredAt`, `correlationId`; payment/refund events also carry amount/currency.

## 11. Published Events

| Event | Trigger |
|---|---|
| `BOOKING_PENDING_PAYMENT` | Pending booking committed |
| `BOOKING_CONFIRMED` | Inventory sold and booking confirmation committed |
| `BOOKING_EXPIRED` | Expiry transition committed |
| `BOOKING_CANCEL_REQUESTED` | Cancellation accepted for async processing |
| `BOOKING_CANCELLED` | Cancellation completed |
| `REFUND_COMPLETED` | Refund outcome committed |
| `TICKET_ISSUED` | Ticket records/pass committed |

Events phải đi qua transactional outbox; không có HTTP endpoint riêng cho scheduler/outbox worker.

## 12. API Error Contract

Canonical envelope:

```json
{
  "code": 2011,
  "message": "SEATS_ALREADY_TAKEN",
  "result": { "unavailableShowtimeSeatIds": [902] }
}
```

| API / Condition | HTTP | Error |
|---|---:|---|
| Create booking: seat selection rỗng | 400 | `INVALID_SEAT_SELECTION` |
| Create booking: showtime không bán | 400 | `SHOWTIME_NOT_AVAILABLE` |
| Create booking: ghế bận | 409 | `SEATS_ALREADY_TAKEN` |
| Create booking: inventory timeout | 503 | `INVENTORY_SERVICE_UNAVAILABLE` |
| Mutation: cùng key khác payload | 409 | `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` |
| Payment context: booking không tồn tại | 404 | `BOOKING_NOT_FOUND` |
| Payment context: booking terminal | 409/410 | `BOOKING_NOT_PAYABLE` / `BOOKING_EXPIRED` |
| Cancellation: quá cutoff / ticket đã dùng | 409 | `CANCELLATION_CUTOFF_PASSED` / `TICKET_ALREADY_USED` |
| Ticket pass: chưa confirmed / revoked | 409/410 | `BOOKING_NOT_CONFIRMED` / `TICKET_PASS_REVOKED` |
| Check-in: QR invalid / revoked | 400/410 | `INVALID_QR_TOKEN` / `QR_TOKEN_REVOKED` |
| Employee/operation: ngoài scope | 403 | `EMPLOYEE_OUTSIDE_CLUSTER_SCOPE` hoặc permission-specific error |

## 13. Missing / Open API Contracts

* Movie Service query-hold/query-inventory và cancel-sale contract cần chốt cho forward recovery/cancellation sau `SOLD`.
* Payment Service query-payment/query-refund contract, event transport và authentication cần chốt.
* Promotion, Loyalty và Concession internal contracts chưa được liệt kê cụ thể trong backlog.
* Async event cần JSON Schema/AsyncAPI và versioning policy.
* Controller/handler/DTO class names chỉ được điền sau khi implementation thực tế tồn tại.
