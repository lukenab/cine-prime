# Booking Service — Product-oriented issue plan

> Ngày rà soát: 20/07/2026  
> Phạm vi: thiết kế lại toàn bộ `server/booking-service` từ database, domain, API đến orchestration  
> Mẫu issue áp dụng: `docs/issues/ISSUE_TEMPLATE.md`  
> Quy ước ưu tiên: **P0 = phải có để bán vé an toàn**, **P1 = hoàn thiện vận hành**, **P2 = tối ưu sản phẩm/thương mại**
>
> Các issue dưới đây là backlog đề xuất, chưa phải issue đã được tạo/assign. Vì vậy tài liệu không gắn status `In Progress`; status chỉ được thêm khi issue chính thức được nhận. Movie, Payment, User, Promotion và Notification Service là dependency đã có owner khác. Tài liệu chỉ mô tả contract mà Booking Service tiêu thụ, không giao việc triển khai cho các service đó.

## 1. Kết luận ngắn

`booking-service` sẽ được viết lại theo luồng production-oriented, không giữ tương thích ngược với implementation/schema hiện tại. Booking Service sở hữu order, snapshot giao dịch, state machine, ticket và orchestration; không sở hữu seat inventory, payment ledger, loyalty balance hay promotion quota.

Nguyên tắc bắt buộc là chỉ có **một nguồn tồn kho ghế có thẩm quyền**: Movie Service. Booking Service không tạo bảng lock cạnh tranh; chỉ lưu `inventoryHoldToken`, snapshot và trạng thái orchestration. Mọi reserve/confirm/release/cancel-sale được gọi qua contract do Movie Service cung cấp.

## 2. Baseline thiết kế lại

### 2.1. Ownership

| Dữ liệu/capability | Owner | Trách nhiệm của Booking Service |
|---|---|---|
| Showtime, seat availability, price, hold TTL, `RESERVED/SOLD` | Movie Service | Gọi contract, lưu snapshot/token/expiry; không tự lock ghế |
| Booking/order, state machine, ticket, orchestration | Booking Service | Sở hữu database và lifecycle |
| Payment/refund ledger và provider integration | Payment Service | Cung cấp payment context, consume kết quả và yêu cầu refund bằng `bookingId/paymentId` |
| Loyalty balance | User Service | Reserve/commit/release qua contract khi scope loyalty được triển khai |
| Promotion quota/rule | Promotion Service | Validate/reserve/commit/release qua contract khi scope promotion được triển khai |
| Notification delivery | Notification Service | Publish booking events đáng tin cậy; không gửi email trong booking transaction |

### 2.2. Invariants bắt buộc

- Một ghế chỉ có một inventory owner; Booking Service không có `seat_lock` authoritative.
- Giá, seat code/type và showtime metadata lấy từ authoritative response rồi snapshot vào booking.
- Hold/payment/confirm/release và event consumption đều idempotent.
- Timeout payment là kết quả chưa xác định, không tự động đồng nghĩa thất bại.
- Mọi partial failure phải có forward recovery, compensation hoặc reconciliation state rõ ràng.
- Internal service API và API dành cho admin/employee dùng namespace và cơ chế authorization khác nhau.
- Timestamp kỹ thuật dùng UTC (`TIMESTAMPTZ`, `Instant`/`OffsetDateTime`); timezone nghiệp vụ chỉ dùng tính cutoff và hiển thị.

## 3. Học từ luồng booking ngoài thị trường

Các nguồn dưới đây được dùng để suy ra capability sản phẩm, không sao chép chính sách của hãng khác thành yêu cầu pháp lý của dự án:

- [CGV Việt Nam FAQ](https://www.cgv.vn/default/faq/) mô tả luồng đăng nhập → chọn phim/rạp/suất/ghế → thanh toán trong cửa sổ giữ ghế 5 phút → nhận mã vé qua màn hình/email; CGV cũng dừng bán online sát giờ chiếu. Điều này củng cố nhu cầu hold có TTL, cutoff bán vé, payment confirmation và ticket retrieval.
- [Galaxy Cinema](https://www.galaxycine.vn/) cho phép bắt đầu theo phim, rạp hoặc ngày; sau thanh toán gửi tin nhắn/email và hỗ trợ QR vào rạp. Điều này gợi ý read model theo nhiều chiều, notification và QR check-in.
- [Chính sách hoàn vé CGV](https://www.cgv.vn/default/tnc-refund/) cho thấy refund phụ thuộc thời gian trước suất chiếu, phương thức thanh toán, trạng thái đã in vé và hạn mức theo thành viên. Đây là lý do cancellation cần policy/config và refund state riêng, không chỉ đổi booking thành `CANCELLED`.
- [Điều khoản thanh toán BHD Star](https://www.bhdstar.vn/dieu-khoan-thanh-toan/) cho thấy chính sách có thể khác theo nhà vận hành và trường hợp rạp không thể cung cấp suất chiếu. Vì vậy rule hoàn/hủy phải cấu hình được và phân biệt customer cancellation với cinema cancellation.
- [Stripe — idempotency](https://docs.stripe.com/error-low-level) và [Stripe — webhooks](https://docs.stripe.com/webhooks) được dùng như tham chiếu kỹ thuật: thao tác tạo thanh toán cần retry an toàn; kết quả thanh toán bất đồng bộ phải được xác thực, deduplicate và xử lý idempotent.

### Luồng mục tiêu đề xuất

```text
Browse movie/cinema/date
  -> chọn showtime đang mở bán
  -> đọc seat inventory + giá thật
  -> tạo hold atomic (TTL + owner + holdToken)
  -> tạo booking PENDING + price snapshot
  -> khởi tạo payment
  -> payment success event/webhook
  -> confirm booking + mark seats SOLD + issue ticket
  -> email/app hiển thị ticket/QR

Timeout/failure
  -> expire booking
  -> release hold
  -> payment late-success đi vào compensation/reconciliation
```

## 4. Roadmap và thứ tự triển khai

| Thứ tự | ID | Priority | Estimate | Mục tiêu |
|---:|---|---|---|---|
| 1 | BK-P0-00 | P0 | L | Tạo Booking database schema và migration baseline |
| 2 | BK-P0-01 | P0 | L | Tích hợp Booking với authoritative inventory contract đã có |
| 3 | BK-P0-02 | P0 | XL | Một public API tự hold ghế và tạo pending booking |
| 4 | BK-P0-03 | P0 | XL | Payment orchestration và confirm idempotent |
| 5 | BK-P0-04 | P0 | XL | Expire/compensate booking và release ghế |
| 6 | BK-P0-05 | P0 | XL | Test concurrency/integration cho happy path P0 |
| 7 | BK-P1-01 | P1 | XL | Cancellation/refund orchestration theo policy |
| 8 | BK-P1-02 | P1 | XL | Booking QR pass và check-in ticket idempotent |
| 9 | BK-P1-03A | P1 | M | Employee booking query theo cluster scope |
| 10 | BK-P1-03B | P1 | XL | Counter sale và payment ledger tại quầy |
| 11 | BK-P1-03C | P1 | L | Booking reconciliation case workflow |
| 12 | BK-P1-04 | P1 | XL | Outbox event và notification đáng tin cậy |
| 13 | BK-P1-05 | P1 | M | Booking history/detail hoàn chỉnh cho khách hàng |
| 14 | BK-P2-01A | P2 | L | Promotion-aware checkout orchestration |
| 15 | BK-P2-01B | P2 | L | Loyalty reservation/commit/release orchestration |
| 16 | BK-P2-01C | P2 | L | Concession-aware checkout orchestration |
| 17 | BK-P2-02 | P2 | XL | Observability, reconciliation và chống abuse |

---

# BK-P0-00 — [Database] Create Booking database schema and migration baseline

**Labels:** `Layer::Database`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tạo mới canonical schema cho Booking Service trước khi viết domain/service. Database chỉ lưu order snapshot, orchestration, idempotency, payment inbox, compensation và ticket; không tạo authoritative seat inventory/seat lock.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Dùng versioned migration (Flyway hoặc cơ chế thống nhất của dự án); production không phụ thuộc `ddl-auto=update`.
- [ ] P0 có tối thiểu `booking`, `booking_item`, `booking_operation`, `payment_event_inbox`, `compensation_task`; ticket/outbox/refund/reconciliation có migration theo issue sở hữu nếu chưa cần ở P0 đầu tiên.
- [ ] `booking` lưu `bookingId`, account/owner, showtime/movie/cluster/room snapshot, amount/currency, inventory hold/reference/status, payment reference/status, booking status và expiry.
- [ ] `booking_item` lưu `showtimeSeatId`, seat code/type, unit price và snapshot discount allocation; unique `(booking_id, showtime_seat_id)`.
- [ ] Idempotency unique theo `(caller_scope, operation, idempotency_key)` và lưu canonical request hash, operation state, response snapshot, retention expiry.
- [ ] Payment inbox unique `event_id`; payment reference không được gắn với hai booking bằng constraint phù hợp.
- [ ] Compensation task có operation, target, state, attempts, `nextAttemptAt`, last error và correlation ID.
- [ ] Tất cả technical timestamp dùng PostgreSQL `TIMESTAMPTZ`; Java mapping dùng `Instant`/`OffsetDateTime`; amount dùng `NUMERIC`, không dùng floating point.
- [ ] Có check constraint/index cho booking/payment/inventory status, `(status, expires_at)`, owner history và scheduler claim.
- [ ] Không có cross-database foreign key sang Movie/Payment/User; chỉ lưu external reference + snapshot.
- [ ] Migration chạy được trên PostgreSQL database rỗng, rollback/rebuild trong test và schema validation fail khi entity drift.

## Technical Notes / Constraints

- Không trộn toàn bộ lifecycle vào một enum. Baseline tối thiểu tách `bookingStatus` (`PENDING_PAYMENT`, `CONFIRM_PENDING`, `CONFIRMED`, `CANCEL_REQUESTED`, `CANCELLED`, `EXPIRED`), `paymentStatus` (`NOT_STARTED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`), `refundStatus` (`NOT_REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`) và `inventoryStatus`; transition từng dimension phải có DB constraint/guard phù hợp.
- Không tạo `booking_db.seat_lock` như nguồn truth. `inventoryHoldToken` là secret nội bộ, không expose/log.
- PII/contact snapshot phải tối thiểu, có length/index hợp lý và retention policy.

## Related

- Branch: `feat/booking-db-baseline`
- Blocks: `BK-P0-01`, `BK-P0-02`, `BK-P0-03`, `BK-P0-04`

---

# BK-P0-01 — [Backend] Integrate Booking with authoritative Movie inventory lifecycle

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Xây booking-side client và orchestration adapter để tiêu thụ ba operation đã được Movie Service cung cấp: reserve toàn bộ selection, confirm thành `SOLD`, hoặc release về `AVAILABLE`. Issue này không sửa database/code Movie Service và không tạo public `/api/seat-holds`.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Booking database mới không tạo authoritative `seat_lock`; chỉ lưu `inventoryHoldToken`, `holdReference` và `expiresAt`.
- [ ] Có typed client cho reserve/confirm/release, dùng service credential và không forward member JWT như credential nội bộ.
- [ ] Booking generate `bookingId` và `holdReference` trước reserve để có stable reference kể cả khi persist booking thất bại.
- [ ] Mỗi operation truyền `Idempotency-Key` ổn định theo booking operation; retry giữ nguyên key và payload.
- [ ] Reserve response được validate envelope/schema và snapshot đầy đủ trước khi Booking persist order.
- [ ] TTL do Movie Service quyết định; Booking không gửi TTL tùy ý và dùng nguyên `expiresAt` authoritative từ response.
- [ ] Nếu persist booking thất bại sau reserve, Booking gọi release bằng `holdToken + holdReference`; release failure được ghi durable compensation task.
- [ ] Payment được Booking Service xác minh trước confirm; Movie confirm không được dùng làm nơi xác minh quan hệ payment-booking.
- [ ] Timeout/network error không được coi ngay là operation thất bại; retry cùng key hoặc query/reconcile trạng thái.
- [ ] Mapping rõ lỗi Movie contract sang Booking error contract mà không làm mất unavailable seat IDs/correlation ID.
- [ ] Có integration/contract tests cho success, conflict, invalid seat, timeout, lost response và duplicate retry.

## Consumed API contract

> Các API dưới đây do Movie Service sở hữu và đã có owner khác. Issue chỉ implement Booking client, mapping, retry và compensation theo contract; mọi thay đổi contract phải được thống nhất với owner Movie Service.

### Internal API 1 — Reserve authoritative inventory

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/internal/showtimes/{showtimeId}/inventory-reservations` |
| Auth Required | Service-to-service |
| Header | `Idempotency-Key` |

```json
{
  "holdReference": "booking-op-8f29",
  "ownerAccountId": "acc-001",
  "showtimeSeatIds": [901, 902]
}
```

```json
{
  "code": 1000,
  "result": {
    "holdToken": "inventory-hold-123",
    "status": "ACTIVE",
    "expiresAt": "2026-07-20T17:15:00+07:00",
    "showtime": {
      "showtimeId": 55,
      "movieId": 1,
      "movieName": "Avengers",
      "clusterId": 1,
      "clusterName": "CinePrime Quận 1",
      "cinemaRoomId": 3,
      "cinemaRoomName": "Phòng IMAX 1",
      "showDate": "2026-07-20",
      "startTime": "19:00:00"
    },
    "seats": [
      { "showtimeSeatId": 901, "seatCode": "G7", "seatType": "VIP", "price": 120000 },
      { "showtimeSeatId": 902, "seatCode": "G8", "seatType": "VIP", "price": 120000 }
    ]
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /internal/showtimes/55/inventory-reservations`<br>`Body: {"holdReference":"booking-123","ownerAccountId":"acc-001","showtimeSeatIds":[901,902]}` | Showtime `55` đã `CANCELLED`, qua cutoff hoặc chưa mở bán | 409 | `{"code":3102,"message":"SHOWTIME_NOT_BOOKABLE"}` |
| `POST /internal/showtimes/55/inventory-reservations`<br>`Body: {"holdReference":"booking-123","ownerAccountId":"acc-001","showtimeSeatIds":[901,999]}` | Seat `999` không thuộc showtime `55` | 400 | `{"code":3103,"message":"SEATS_NOT_IN_SHOWTIME","result":{"invalidShowtimeSeatIds":[999]}}` |
| `POST /internal/showtimes/55/inventory-reservations`<br>`Body: {"holdReference":"booking-123","ownerAccountId":"acc-001","showtimeSeatIds":[901,902]}` | Seat `902` đang `RESERVED/SOLD/BLOCKED` | 409 | `{"code":3104,"message":"SEATS_NOT_AVAILABLE","result":{"unavailableShowtimeSeatIds":[902]}}` |
| `POST /internal/showtimes/55/inventory-reservations`<br>`Idempotency-Key: reserve-key-1`<br>`Body lần đầu: {"showtimeSeatIds":[901]}`<br>`Body retry: {"showtimeSeatIds":[902]}` | Cùng key nhưng request hash khác | 409 | `{"code":3105,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |
| `POST /internal/showtimes/55/inventory-reservations`<br>`Authorization: Bearer invalid-token`<br>`Body: {"holdReference":"booking-123","ownerAccountId":"acc-001","showtimeSeatIds":[901]}` | Caller không được nhận diện là Booking Service | 403 | `{"code":3106,"message":"UNAUTHORIZED_SERVICE"}` |

### Internal API 2 — Confirm authoritative inventory

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/internal/inventory-confirmations` |
| Auth Required | Service-to-service |
| Header | `Idempotency-Key` |

```json
{ "holdToken": "inventory-hold-123", "bookingId": "booking-123" }
```

```json
{
  "code": 1000,
  "result": {
    "holdToken": "inventory-hold-123",
    "bookingId": "booking-123",
    "status": "CONFIRMED",
    "soldSeatIds": [901, 902],
    "confirmedAt": "2026-07-20T17:10:00+07:00"
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /internal/inventory-confirmations`<br>`Body: {"holdToken":"missing-hold","bookingId":"booking-123"}` | Không tồn tại `missing-hold` | 404 | `{"code":3110,"message":"HOLD_NOT_FOUND"}` |
| `POST /internal/inventory-confirmations`<br>`Body: {"holdToken":"expired-hold","bookingId":"booking-123"}` | `expired-hold.expiresAt` đã qua | 409 | `{"code":3111,"message":"HOLD_EXPIRED"}` |
| `POST /internal/inventory-confirmations`<br>`Body: {"holdToken":"released-hold","bookingId":"booking-123"}` | `released-hold.status=RELEASED` | 409 | `{"code":3112,"message":"HOLD_ALREADY_RELEASED"}` |
| `POST /internal/inventory-confirmations`<br>`Body: {"holdToken":"inventory-hold-123","bookingId":"booking-999"}` | Hold đã confirm cho `booking-123` | 409 | `{"code":3113,"message":"HOLD_CONFIRMED_BY_ANOTHER_BOOKING"}` |
| `POST /internal/inventory-confirmations`<br>`Authorization: Bearer invalid-token`<br>`Body: {"holdToken":"inventory-hold-123","bookingId":"booking-123"}` | Caller không phải Booking Service | 403 | `{"code":3106,"message":"UNAUTHORIZED_SERVICE"}` |

### Internal API 3 — Release authoritative inventory

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/internal/inventory-releases` |
| Auth Required | Service-to-service |
| Header | `Idempotency-Key` |

```json
{ "holdToken": "inventory-hold-123", "holdReference": "booking-123", "reason": "PAYMENT_EXPIRED" }
```

```json
{
  "code": 1000,
  "result": {
    "holdToken": "inventory-hold-123",
    "status": "RELEASED",
    "releasedSeatIds": [901, 902],
    "releasedAt": "2026-07-20T17:15:00+07:00"
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /internal/inventory-releases`<br>`Body: {"holdToken":"missing-hold","holdReference":"booking-123","reason":"PAYMENT_EXPIRED"}` | Không tồn tại `missing-hold` | 404 | `{"code":3110,"message":"HOLD_NOT_FOUND"}` |
| `POST /internal/inventory-releases`<br>`Body: {"holdToken":"sold-hold","holdReference":"booking-123","reason":"PAYMENT_EXPIRED"}` | `sold-hold.status=CONFIRMED`, ghế đã `SOLD` | 409 | `{"code":3115,"message":"HOLD_ALREADY_CONFIRMED"}` |
| `POST /internal/inventory-releases`<br>`Body: {"holdToken":"inventory-hold-123","holdReference":"booking-999","reason":"PAYMENT_EXPIRED"}` | Hold thuộc `booking-123`, không phải `booking-999` | 409 | `{"code":3116,"message":"BOOKING_REFERENCE_MISMATCH"}` |
| `POST /internal/inventory-releases`<br>`Authorization: Bearer invalid-token`<br>`Body: {"holdToken":"inventory-hold-123","holdReference":"booking-123","reason":"PAYMENT_EXPIRED"}` | Caller không phải Booking Service | 403 | `{"code":3106,"message":"UNAUTHORIZED_SERVICE"}` |

Release lặp lại cùng `holdToken`, `holdReference` và idempotency key phải trả lại response `RELEASED` trước đó, không trả lỗi.

## Technical Notes / Constraints

- Không sửa Movie Service trong issue này; contract mismatch phải được ghi integration blocker và trao đổi với owner tương ứng.
- Không log/đưa `holdToken` ra public response.
- Dùng timeout, bounded retry cùng idempotency key và circuit breaker; không retry mutation bằng key mới.
- Persist compensation task khi không thể release sau lỗi Booking DB.
- Lưu thời điểm kỹ thuật bằng UTC: PostgreSQL `TIMESTAMPTZ`, Java `Instant`/`OffsetDateTime`.

## Related

- Branch: `feat/booking-inventory-integration`
- Depends on: Movie Service inventory contract đã thống nhất
- Blocks: `BK-P0-02`
- Docs: xem `Phụ lục B — Movie Service inventory contract` trong file này.

---

# BK-P0-02 — [Backend] Orchestrate seat reservation and create a pending booking

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Khi người dùng bấm **“Tiếp tục”**, frontend gọi duy nhất `POST /api/bookings`. Booking Service lấy account từ JWT, gọi internal reserve của Movie Service, dùng response authoritative để tạo booking `PENDING_PAYMENT` và trả `bookingId/expiresAt`. Frontend không gọi public seat-hold API và không gửi movie/cinema/price.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Public request P0 chỉ nhận `showtimeId` và `showtimeSeatIds`; không nhận movie/cinema/price/TTL. Loyalty được tách sang `BK-P2-01B`.
- [ ] Booking Service lấy `accountId` từ JWT, generate trước `bookingId/holdReference` và tạo durable idempotency/orchestration record trước cross-service call.
- [ ] Booking Service gọi `BK-P0-01` reserve; chỉ tạo booking khi reserve toàn selection thành công.
- [ ] Idempotency scope theo `accountId + operation + key`; lưu canonical request hash, trạng thái `IN_PROGRESS/SUCCEEDED/FAILED_RETRYABLE`, response và retention expiry.
- [ ] Retry cùng `Idempotency-Key` và payload trả cùng booking/operation; khác payload bị reject; request đến khi operation đang chạy nhận cùng trạng thái/poll reference thay vì chạy lần hai.
- [ ] Booking lưu internal `holdToken/reference`, showtime/movie/cluster/room/date/time và toàn bộ seat/price snapshot từ Movie Service.
- [ ] `totalAmount`, discount/points và `finalAmount` được tính server-side; không tin amount từ client.
- [ ] `expiresAt` của booking không vượt quá hold expiry.
- [ ] Nếu DB tạo booking fail sau reserve, Booking Service release bằng `holdToken + holdReference`; nếu release lỗi thì ghi durable compensation task để retry và TTL là lớp bảo vệ cuối.
- [ ] State ban đầu là `PENDING_PAYMENT`; tạo booking không tự đánh dấu ghế `SOLD`.
- [ ] Một account có configurable limit/rate limit active booking/hold.
- [ ] Test seat conflict, Movie Service unavailable/timeout, DB failure after reserve, duplicate retry và concurrent create.

## API Specifications (if applicable)

### API — Continue checkout: reserve seats and create pending booking

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/bookings` |
| Auth Required | Yes (`MEMBER`) |
| Header | `Idempotency-Key` |

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
    "bookingId": "a4a8779d-4e94-4f31-88fc-71d96c545e99",
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

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /api/bookings`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[]}` | Danh sách ghế rỗng | 400 | `{"code":2005,"message":"INVALID_SEAT_SELECTION"}` |
| `POST /api/bookings`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[901,902]}` | Showtime `55` đã hủy/qua cutoff/chưa mở bán | 400 | `{"code":2007,"message":"SHOWTIME_NOT_AVAILABLE"}` |
| `POST /api/bookings`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[901,902]}` | Seat `902` đã được hold/sold | 409 | `{"code":2011,"message":"SEATS_ALREADY_TAKEN","result":{"unavailableShowtimeSeatIds":[902]}}` |
| `POST /api/bookings`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[901,902]}` | Movie/Inventory Service timeout sau retry | 503 | `{"code":2014,"message":"INVENTORY_SERVICE_UNAVAILABLE"}` |
| `POST /api/bookings`<br>`Idempotency-Key: booking-key-1`<br>`Body lần đầu: {"showtimeId":55,"showtimeSeatIds":[901]}`<br>`Body retry: {"showtimeId":55,"showtimeSeatIds":[902]}` | Cùng key nhưng request hash khác | 409 | `{"code":2015,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |
| `POST /api/bookings`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[901]}` | Account trong JWT đã có số active hold tối đa | 429 | `{"code":2016,"message":"ACTIVE_HOLD_LIMIT_EXCEEDED"}` |

## Technical Notes / Constraints

- P0 không nhận loyalty/promotion/concession để giữ contract tối thiểu và không triển khai nửa vời.
- Không confirm/release inventory hold khi vừa tạo booking; hold được confirm `SOLD` sau payment success hoặc release khi expiry/cancel.
- Mọi timestamp persisted dùng UTC (`TIMESTAMPTZ`); response dùng RFC 3339 có offset.

## Related

- Branch: `feat/booking-create-with-seat-hold`
- Depends on: `BK-P0-01`
- Blocks: `BK-P0-03`, `BK-P0-04`
- Docs: xem `Phụ lục A — Giải thích quyết định kiến trúc` trong file này.

---

# BK-P0-03 — [Backend] Consume payment results and confirm paid bookings idempotently

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Hoàn thiện booking-side happy path sau khi giữ ghế: cung cấp payment context cho Payment Service, consume kết quả thanh toán đáng tin cậy, chuyển booking sang confirmed đúng một lần, chuyển hold thành sold và phát hành ticket. Issue không triển khai provider/payment ledger và không xác nhận booking dựa vào redirect của trình duyệt.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] State machine tối thiểu tách `bookingStatus`, `paymentStatus`, `refundStatus` và `inventoryStatus` theo baseline; transition trái phép trong từng dimension hoặc tổ hợp bất hợp lệ bị reject.
- [ ] Frontend tạo payment tại Payment Service bằng `bookingId`; Payment Service lấy amount, currency, owner và expiry authoritative qua internal Booking API, không nhận amount từ frontend.
- [ ] Payment result chỉ đến từ authenticated internal event/contract; Booking deduplicate và validate amount/currency/booking, không tin payload/redirect từ frontend.
- [ ] Lưu `paymentId/paymentReference`, `paymentStatus`, `paidAt`; một payment không gắn với hai booking.
- [ ] Deduplicate event bằng unique `providerEventId`/inbox record.
- [ ] Duplicate success không tạo thêm ticket, không tăng `soldSeats` lần hai và vẫn trả thành công idempotent.
- [ ] Provider/network timeout giữ `bookingStatus=PENDING_PAYMENT`, `paymentStatus=UNKNOWN`; không tự chuyển payment sang `FAILED` nếu chưa có authoritative failure.
- [ ] Chỉ chuyển `CONFIRM_PENDING` khi amount/currency/booking khớp và bắt đầu confirm hold còn hợp lệ.
- [ ] Confirm inventory `SOLD` và issue một ticket cho mỗi booking detail; lưu booking snapshot trên ticket.
- [ ] Nếu Movie đã trả confirm `SOLD` nhưng Booking DB/ticket commit thất bại, giữ durable `CONFIRM_PENDING`, retry/query cùng idempotency key và forward-recover; không release ghế `SOLD`.
- [ ] Nếu payment success nhưng hold expired/released hoặc inventory confirm terminal-fail, giữ trạng thái booking có audit/compensation rõ ràng, đặt `refundStatus=PENDING` và tạo refund/reconciliation task; không im lặng mất tiền.
- [ ] Phát `BOOKING_CONFIRMED` bằng outbox sau commit.

## API Specifications (if applicable)

### External contract reference — Payment Service create payment

`POST /api/payments` do Payment Service và owner tương ứng triển khai. Booking Service không tạo controller/provider adapter này; chỉ cung cấp `GET /internal/bookings/{bookingId}/payment-context` và consume normalized payment result. Contract Payment phải dùng `bookingId` để đọc authoritative owner/amount/currency/expiry thay vì nhận các giá trị đó từ frontend.

### Internal API — Read authoritative payment context

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/internal/bookings/{bookingId}/payment-context` |
| Auth Required | Payment Service credential |

```json
{
  "code": 1000,
  "result": {
    "bookingId": "a4a8779d-4e94-4f31-88fc-71d96c545e99",
    "accountId": "acc-001",
    "status": "PENDING_PAYMENT",
    "amount": 240000,
    "currency": "VND",
    "expiresAt": "2026-07-20T17:15:00+07:00"
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `GET /internal/bookings/missing-booking/payment-context`<br>`Authorization: Bearer payment-service-token` | Booking không tồn tại | 404 | `{"code":2004,"message":"BOOKING_NOT_FOUND"}` |
| `GET /internal/bookings/confirmed-booking/payment-context`<br>`Authorization: Bearer payment-service-token` | Booking đang `CONFIRMED` | 409 | `{"code":2020,"message":"BOOKING_NOT_PAYABLE"}` |
| `GET /internal/bookings/expired-booking/payment-context`<br>`Authorization: Bearer payment-service-token` | Booking đã qua `expiresAt` | 410 | `{"code":2018,"message":"BOOKING_EXPIRED"}` |
| `GET /internal/bookings/booking-123/payment-context`<br>`Authorization: Bearer invalid-token` | Caller không phải Payment Service | 403 | `{"code":2021,"message":"PAYMENT_CONTEXT_FORBIDDEN"}` |

### Internal event — Payment result

```json
{
  "eventId": "evt-123",
  "eventType": "PAYMENT_SUCCEEDED",
  "eventVersion": 1,
  "paymentId": "pay-123",
  "bookingId": "a4a8779d-4e94-4f31-88fc-71d96c545e99",
  "amount": 240000,
  "currency": "VND",
  "paidAt": "2026-07-20T17:08:00+07:00",
  "occurredAt": "2026-07-20T17:08:00+07:00",
  "correlationId": "a4a8779d-4e94-4f31-88fc-71d96c545e99"
}
```

## Technical Notes / Constraints

- Payment processing/provider/webhook adapter vẫn thuộc Payment Service; issue này chỉ implement Booking payment-context, inbox/dedup, state transition, inventory confirm và compensation request.
- Dùng inbox/outbox hoặc cơ chế tương đương để xử lý at-least-once delivery.
- Tạo unique constraints cho `payment_id`, inbox `event_id`, `(booking_id, detail_id)` trên ticket.
- Không log token, card data hoặc full payment payload nhạy cảm.

## Related

- Branch: `feat/booking-payment-confirmation`
- Depends on: `BK-P0-02`, payment-service contract
- Blocks: `BK-P1-01`, `BK-P1-02`, `BK-P1-04`
- Docs: xem `Phụ lục C — Payment Service integration` trong file này.

---

# BK-P0-04 — [Backend] Expire abandoned bookings and compensate late payment outcomes

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tự động kết thúc booking chưa thanh toán khi hết hold, release inventory và xử lý race giữa scheduler với payment success. Hệ thống không được để ghế kẹt hoặc xác nhận booking đã hết hạn một cách ngẫu nhiên.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Create booking luôn set `expiresAt` bằng expiry authoritative của hold.
- [ ] Scheduler claim theo batch các booking hết hạn bằng DB lock/skip-locked hoặc update có điều kiện.
- [ ] Transition `PENDING_PAYMENT -> EXPIRED` idempotent; release đúng hold token.
- [ ] Không expire booking có `bookingStatus=CONFIRMED/CANCEL_REQUESTED/CANCELLED` hoặc đang có `refundStatus=PENDING`.
- [ ] Race payment success vs expiry có một kết quả xác định bởi conditional state transition.
- [ ] Late payment success sau expiry tạo compensation/refund command và trạng thái audit được.
- [ ] Retry release an toàn khi movie-service tạm unavailable.
- [ ] Có metric active holds, expired bookings, release failures, late successes.
- [ ] Test boundary tại đúng `expiresAt`, duplicate scheduler run và concurrent payment event.

## API Specifications (if applicable)

Không thêm public hoặc internal HTTP API. Scheduler chạy trong Booking Service, claim booking hết hạn theo batch và ghi audit/metric. Test kích hoạt job qua component/service test thay vì mở endpoint điều khiển nghiệp vụ.

## Technical Notes / Constraints

- Không quét toàn bảng mỗi 30 giây; index `(status, expires_at)` và xử lý batch.
- Job phải safe khi nhiều instance booking-service cùng chạy.
- Booking dùng `expiresAt` authoritative và hold token từ Movie contract; Movie-side expiry implementation nằm ngoài scope issue.

## Related

- Branch: `feat/booking-expiry-compensation`
- Depends on: `BK-P0-01`, `BK-P0-02`, `BK-P0-03`, Movie inventory expiry/release contract

---

# BK-P0-05 — [Backend] Add booking concurrency and end-to-end contract tests

**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::High`

## Summary / Objective

Tạo test suite chứng minh các invariant quan trọng của booking thay vì chỉ compile. Trọng tâm là double-booking, retry, payment/expiry race và contract giữa booking/movie/payment.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Unit tests cho validation, pricing, state transitions, owner authorization và cancellation cutoff.
- [ ] Repository integration tests chạy PostgreSQL thật qua Testcontainers; không dùng H2 cho locking semantics.
- [ ] Concurrent test hai account giữ cùng seat: đúng một hold thành công, không partial rows.
- [ ] Retry cùng idempotency key không tạo booking/payment/ticket trùng.
- [ ] Contract tests verify `ApiResponse` và DTO của movie/payment Feign clients.
- [ ] E2E happy path: browse seats → hold → create pending → payment success → sold → ticket.
- [ ] E2E failure paths: invalid seat, hold expiry, payment failure, late success, release retry.
- [ ] Security tests cover member ownership, employee/admin endpoints và internal service auth.
- [ ] Test data độc lập, chạy lại được và CI fail khi migration/schema drift.

## API Specifications (if applicable)

N/A — test issue; dùng các API trong `BK-P0-01` đến `BK-P0-04`.

## Technical Notes / Constraints

- Thêm Testcontainers PostgreSQL/Kafka khi capability tương ứng được triển khai.
- WireMock/MockWebServer phù hợp cho lỗi mạng; ít nhất một suite phải chạy integration thật giữa booking và movie contract.
- Không đóng P0 chỉ bằng test happy path tuần tự.

## Related

- Branch: `chore/booking-critical-flow-tests`
- Depends on: `BK-P0-01` đến `BK-P0-04`

---

# BK-P1-01 — [Backend] Implement policy-driven booking cancellation and refund orchestration

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Xây workflow hủy booking có lưu trạng thái, retry an toàn và phân biệt rõ:

- booking chưa thanh toán có thể hủy ngay;
- payment đang xử lý hoặc chưa xác định kết quả phải chờ đối soát;
- booking đã thanh toán phải đi qua refund workflow;
- customer cancellation, staff/admin override và cinema/showtime cancellation áp dụng policy khác nhau;
- mọi race giữa cancel, payment, expiry, inventory confirm và ticket check-in có kết quả xác định.

Booking Service chỉ orchestration và lưu snapshot/trạng thái. Payment ledger/refund vẫn thuộc Payment Service; trạng thái ghế vẫn thuộc Movie Service. Issue này chỉ định nghĩa contract Booking phải gọi/consume, không yêu cầu triển khai hai service đó.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Mỗi booking có tối đa một cancellation workflow đang active; lưu `cancellationId`, `source`, `reasonCode`, `reason`, `actorId`, `requestedAt`, `completedAt` và version để optimistic concurrency.
- [ ] Theo dõi riêng ít nhất `bookingStatus`, `paymentStatus`, `refundStatus`, `inventoryStatus` và trạng thái từng ticket; không suy ra refund/inventory chỉ từ một enum booking.
- [ ] `PENDING_PAYMENT` chưa có payment đang xử lý được cancel ngay: chặn payment context mới, release hold và mọi promotion/loyalty/concession reservation, sau đó chuyển `CANCELLED`.
- [ ] `paymentStatus=FAILED` được cancel/release idempotent; `bookingStatus=EXPIRED` trả terminal state hiện tại và không release lần hai.
- [ ] `paymentStatus=UNKNOWN/PROCESSING` chuyển booking sang `CANCEL_REQUESTED`, không release ghế cho tới khi nhận kết quả authoritative: failure thì release/cancel; success thì đi refund workflow.
- [ ] `CONFIRM_PENDING` nhận cancel phải lưu `CANCEL_REQUESTED` và serialize với inventory confirm. Nếu ghế chưa `SOLD` thì refund/release; nếu đã `SOLD` thì refund và gọi cancel-sale, tuyệt đối không gọi release cho ghế `SOLD`.
- [ ] `CONFIRMED` kiểm tra policy rồi thực hiện: conditional transition → request refund → nhận kết quả refund → cancel-sale/reopen inventory nếu policy cho phép → cancel ticket/revoke QR → terminal state.
- [ ] Customer cancellation kiểm tra owner, cutoff, showtime chưa bắt đầu, ticket chưa `USED`, payment method, promotion/loyalty/concession và refund eligibility.
- [ ] Booking có bất kỳ ticket `USED` nào không được customer auto-cancel toàn phần. MVP không hỗ trợ partial cancellation; request hủy một phần trả `PARTIAL_CANCELLATION_NOT_SUPPORTED`.
- [ ] Staff/admin override dùng operations API và permission riêng, bị giới hạn cluster theo policy, bắt buộc reason và audit actor; không dùng credential MEMBER để gọi internal/operations API.
- [ ] Cinema/showtime cancellation consume authenticated event, deduplicate bằng `eventId`, bỏ qua customer cutoff theo policy và tạo một cancellation idempotent cho từng booking.
- [ ] Refund amount được tính từ booking/payment/promotion/loyalty/concession snapshot; client không được gửi refund amount hoặc refund method authoritative.
- [ ] Release chỉ áp dụng hold `RESERVED`; ghế `SOLD` chỉ được xử lý qua cancel-sale contract của Movie Service.
- [ ] Refund/cancel-sale timeout giữ workflow ở trạng thái pending/unknown, ghi durable retry hoặc reconciliation case và retry/query bằng cùng idempotency key; không báo hoàn tất sớm.
- [ ] Duplicate cancellation, payment/refund event, showtime cancellation event và callback đều trả/kết thúc idempotent, không refund, release, cancel-sale hoặc revoke ticket hai lần.
- [ ] API trả `201` khi cancellation hoàn tất đồng bộ và `202` khi đã nhận nhưng còn chờ payment/refund/inventory; response luôn trả trạng thái từng phần thay vì chỉ báo “cancel success”.
- [ ] Transaction/state transition dùng aggregate lock hoặc conditional update theo `version`; kiểm tra trạng thái ở application mà không có DB guard là không đạt.
- [ ] Outbox phát `BOOKING_CANCEL_REQUESTED`, `BOOKING_CANCELLED` và `REFUND_COMPLETED` sau commit; inbox deduplicate mọi event external.
- [ ] Integration/concurrency tests cover toàn bộ transition matrix và race matrix bên dưới bằng PostgreSQL thật.

## Cancellation state model

Các dimension logic tối thiểu:

| Dimension | Giá trị liên quan cancellation |
|---|---|
| `bookingStatus` | `PENDING_PAYMENT`, `CONFIRM_PENDING`, `CONFIRMED`, `CANCEL_REQUESTED`, `CANCELLED`, `EXPIRED` |
| `paymentStatus` | `NOT_STARTED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| `refundStatus` | `NOT_REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| `inventoryStatus` | `HELD`, `RELEASE_PENDING`, `RELEASED`, `CONFIRM_PENDING`, `SOLD`, `CANCEL_SALE_PENDING`, `CANCELLED` |
| `ticketStatus` | `VALID`, `USED`, `CANCELLED` theo từng ticket |

`cancellationStatus` của resource: `REQUESTED`, `PROCESSING`, `COMPLETED`, `FAILED`, `MANUAL_REVIEW`.

## Transition matrix bắt buộc

| Trạng thái/điều kiện lúc nhận cancel | Kết quả API ban đầu | Xử lý bắt buộc | Kết quả cuối |
|---|---|---|---|
| `PENDING_PAYMENT` + `paymentStatus=NOT_STARTED/PENDING`, chưa gửi provider | `201` | Chặn payment context, release hold và resource reservation | `booking=CANCELLED`, `refund=NOT_REQUESTED`, `inventory=RELEASED` |
| `paymentStatus=FAILED` | `201` hoặc trả terminal result cũ | Release idempotent nếu chưa release | `bookingStatus=CANCELLED` |
| `paymentStatus=UNKNOWN/PROCESSING` | `202` | Không release; query/reconcile Payment bằng reference hiện tại | Failure → `CANCELLED`; success → refund workflow |
| `CONFIRM_PENDING` | `202` | Serialize với confirm; query trạng thái inventory nếu response trước bị mất | Chưa SOLD → refund/release; đã SOLD → refund/cancel-sale |
| `CONFIRMED`, ticket đều `VALID` | `202` | Validate policy, request refund, cancel-sale, cancel ticket, revoke QR | `CANCELLED` + `refund=SUCCEEDED` |
| `CONFIRMED`, có ticket `USED` | `409` với customer | Không tự refund/cancel | Giữ nguyên; staff/admin có thể tạo manual review nếu policy cho phép |
| `EXPIRED` | `200` terminal result | Không tạo cancellation/refund/release mới | Giữ `EXPIRED` |
| `CANCEL_REQUESTED`/workflow đang xử lý | `200/202` | Trả cùng cancellation resource | Không tạo workflow thứ hai |
| `CANCELLED`/refund hoàn tất | `200` nếu cùng intent | Trả terminal result | Không thao tác external lần hai |
| `REFUND_FAILED/UNKNOWN` | `202` | Retry/query cùng refund idempotency key hoặc mở reconciliation | `PROCESSING`, `COMPLETED` hoặc `MANUAL_REVIEW` |

## API Specifications (if applicable)

### API 1 — Customer creates a booking cancellation

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/bookings/{bookingId}/cancellations` |
| Auth Required | Owner của booking |
| Header | `Idempotency-Key` bắt buộc |

```json
{
  "reasonCode": "CHANGE_OF_PLAN",
  "reason": "Không thể đến rạp"
}
```

Client không gửi `refundAmount`, `refundMethod` hoặc trạng thái đích. Booking Service tính các giá trị này từ snapshot và policy.

**Response `201 Created` — booking chưa thanh toán, hủy hoàn tất đồng bộ:**

```json
{
  "code": 1000,
  "result": {
    "cancellationId": "cancel-001",
    "bookingId": "booking-123",
    "cancellationStatus": "COMPLETED",
    "bookingStatus": "CANCELLED",
    "paymentStatus": "NOT_STARTED",
    "refundStatus": "NOT_REQUESTED",
    "inventoryStatus": "RELEASED",
    "refundAmount": 0
  }
}
```

**Response `202 Accepted` — đã thanh toán hoặc kết quả payment/inventory chưa chắc chắn:**

```json
{
  "code": 1000,
  "result": {
    "cancellationId": "cancel-002",
    "bookingId": "booking-456",
    "cancellationStatus": "PROCESSING",
    "bookingStatus": "CANCEL_REQUESTED",
    "paymentStatus": "SUCCEEDED",
    "refundStatus": "PENDING",
    "inventoryStatus": "SOLD",
    "refundAmount": 240000,
    "refundMethod": "ORIGINAL_OR_CREDIT",
    "requestedAt": "2026-07-21T10:30:00+07:00"
  }
}
```

### API 2 — Get cancellation status

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/bookings/{bookingId}/cancellations/{cancellationId}` |
| Auth Required | Owner; operations caller theo scope |

API trả lại cùng các trường `cancellationStatus`, `bookingStatus`, `paymentStatus`, `refundStatus`, `inventoryStatus`, `refundAmount`, `requestedAt`, `completedAt` và safe retry guidance. API không query đồng bộ các service ngoài chỉ để dựng response; nó đọc trạng thái orchestration đã persist.

### API 3 — Staff/admin override cancellation

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/operations/bookings/{bookingId}/cancellations` |
| Auth Required | `BOOKING_CANCEL_OVERRIDE`; employee đúng cluster hoặc admin theo policy |
| Header | `Idempotency-Key` bắt buộc |

```json
{
  "reasonCode": "CINEMA_OPERATION_EXCEPTION",
  "reason": "Suất chiếu gặp sự cố kỹ thuật",
  "overrideCutoff": true
}
```

`overrideCutoff` chỉ là yêu cầu; server quyết định theo permission/policy. Caller không được gửi `actorId`, cluster hoặc refund amount authoritative; các giá trị này lấy từ principal và snapshot.

### Internal event 1 — Showtime cancelled

Booking Service consume event do Movie Service phát; đây không phải API dành cho member:

```json
{
  "eventId": "evt-showtime-cancelled-001",
  "eventType": "SHOWTIME_CANCELLED",
  "eventVersion": 1,
  "showtimeId": 55,
  "reasonCode": "TECHNICAL_FAILURE",
  "occurredAt": "2026-07-21T10:20:00+07:00",
  "correlationId": "showtime-55-cancel"
}
```

Booking inbox unique theo `eventId`. Worker tìm booking active của showtime, tạo cancellation với stable key `showtime-cancel:{eventId}:{bookingId}` và xử lý từng booking độc lập; một booking lỗi không rollback toàn bộ batch.

### Internal events 2 — Payment/refund results

Booking consume các kết quả authenticated `PAYMENT_SUCCEEDED`, `PAYMENT_FAILED`, `REFUND_SUCCEEDED`, `REFUND_FAILED`. Mỗi event phải có `eventId`, `bookingId`, `paymentId/refundId`, amount, currency, occurredAt và correlationId; deduplicate bằng inbox. Payload redirect hoặc trạng thái do frontend gửi không được dùng để quyết định cancel/refund.

## Race-condition matrix

Không tạo endpoint riêng cho từng race. Mỗi dòng dưới đây là concurrency/integration test bắt buộc của API cancellation và các event handler dùng chung state machine.

| Race | Request/event cụ thể | DB guard và kết quả bắt buộc |
|---|---|---|
| Customer cancel vs payment success | `POST /api/bookings/booking-123/cancellations` đồng thời inbox nhận `PAYMENT_SUCCEEDED` | Conditional transition theo booking version. Nếu cancel thắng trước khi provider xử lý: block payment mới/release. Nếu success là authoritative: không mất tiền, cancellation tiếp tục thành refund; kết quả hội tụ về đúng một workflow. |
| Customer cancel vs payment failure | POST cancel đồng thời `PAYMENT_FAILED` | Cả hai đường hội tụ về một release và `CANCELLED`; release dùng stable idempotency key. |
| Cancel vs expiry scheduler | POST cancel đồng thời worker `PENDING_PAYMENT -> EXPIRED` | Chỉ một conditional update thắng. Kết quả `CANCELLED` hoặc `EXPIRED`; hold/resource chỉ release một lần. |
| Cancel vs inventory confirm | POST cancel đồng thời worker confirm `RESERVED -> SOLD` | Lock/version và query authoritative inventory. Nếu đã `SOLD`, dùng refund + cancel-sale; không gọi release. Nếu chưa SOLD, ngăn confirm mới và release. |
| Cancel vs ticket check-in | POST cancel đồng thời `POST /api/ticket-check-ins` | Lock/conditional update ticket. Check-in thắng → customer cancel bị `TICKET_ALREADY_USED`; cancel thắng → check-in nhận `TICKET_CANCELLED/QR_TOKEN_REVOKED`. |
| Hai customer cancel cùng lúc | Hai POST với cùng hoặc khác `Idempotency-Key` | Unique active cancellation per booking + request hash. Cùng intent trả cùng resource; không tạo hai refund. |
| Customer cancel vs staff override | Customer POST đồng thời operations POST | Một active cancellation. Staff override chỉ bổ sung audit/policy decision theo quyền, không tạo refund thứ hai. |
| Showtime cancel vs customer cancel | `SHOWTIME_CANCELLED` đồng thời customer POST | Merge vào một workflow; cinema policy có thể override cutoff. Lưu cả originating event và customer request trong audit. |
| Refund callback đến trước response tạo refund | Refund command timeout nhưng inbox đã nhận `REFUND_SUCCEEDED` | Persist inbox và correlate bằng `refundId/paymentId/bookingId`; apply sau khi local workflow row có thể lock/claim. Không gửi refund mới. |
| Refund callback bị gửi lặp | Cùng `eventId` hoặc cùng provider event gửi nhiều lần | Inbox unique + conditional refund transition; chỉ một `REFUND_COMPLETED`, một cancel-sale. |
| Cancel-sale success nhưng Booking DB commit fail | Movie trả success, local transaction rollback/mất response | Retry/query Movie bằng cùng operation/idempotency key; forward-recover local state, không reopen/cancel ghế lần hai. |
| Booking DB commit trước, external call timeout | Local state/outbox đã commit, Payment/Movie timeout | Durable worker retry/query bằng stable key; API trả `202 PROCESSING`, không báo completed. |
| Service restart giữa workflow | Process chết sau bất kỳ committed step nào | Worker claim durable pending task/outbox và tiếp tục từ persisted step; không dựa vào in-memory state. |
| Late payment sau `CANCELLED/EXPIRED` | Inbox nhận `PAYMENT_SUCCEEDED` sau terminal transition | Không revive booking/chiếm ghế khác; tạo refund/reconciliation idempotent và audit `LATE_PAYMENT_SUCCESS`. |

## Error cases

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /api/bookings/missing-booking/cancellations`<br>`Body: {"reasonCode":"CHANGE_OF_PLAN","reason":"Không thể đến rạp"}` | Booking không tồn tại/không thuộc member | 404 | `{"code":2004,"message":"BOOKING_NOT_FOUND"}` |
| `POST /api/bookings/refunded-booking/cancellations`<br>`Body: {"reasonCode":"CHANGE_OF_PLAN"}` | Booking đã refund/cancel bởi workflow khác và request không cùng intent | 409 | `{"code":2101,"message":"CANCELLATION_NOT_ALLOWED"}` |
| `POST /api/bookings/booking-123/cancellations`<br>`Body: {"reasonCode":"CHANGE_OF_PLAN"}` | Request gửi sau cancellation cutoff | 409 | `{"code":2102,"message":"CANCELLATION_CUTOFF_PASSED"}` |
| `POST /api/bookings/booking-123/cancellations`<br>`Body: {"reasonCode":"CHANGE_OF_PLAN"}` | Booking có ticket `USED` | 409 | `{"code":2103,"message":"TICKET_ALREADY_USED"}` |
| `POST /api/bookings/booking-123/cancellations`<br>`Body: {"reasonCode":"CHANGE_OF_PLAN"}` | Payment/promotion không đạt refund policy | 409 | `{"code":2104,"message":"REFUND_POLICY_NOT_APPLICABLE"}` |
| `POST /api/bookings/booking-123/cancellations`<br>`Body: {"reasonCode":"CHANGE_OF_PLAN"}` | Không hỗ trợ partial cancellation nhưng request chỉ định một phần ticket/item | 409 | `{"code":2106,"message":"PARTIAL_CANCELLATION_NOT_SUPPORTED"}` |
| `POST /api/operations/bookings/booking-123/cancellations`<br>`Body: {"reasonCode":"CINEMA_OPERATION_EXCEPTION","overrideCutoff":true}` | Caller thiếu permission override hoặc ngoài cluster | 403 | `{"code":2107,"message":"CANCELLATION_OVERRIDE_FORBIDDEN"}` |
| `POST /api/bookings/booking-123/cancellations`<br>`Body: {"reasonCode":"UNKNOWN"}` | `reasonCode` không thuộc allowlist | 400 | `{"code":2108,"message":"INVALID_CANCELLATION_REASON"}` |
| `POST /api/bookings/booking-123/cancellations`<br>`Idempotency-Key: cancel-key-1`<br>`Body lần đầu: {"reasonCode":"CHANGE_OF_PLAN"}`<br>`Body retry: {"reasonCode":"DUPLICATE_BOOKING"}` | Cùng key nhưng request hash khác | 409 | `{"code":2015,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |

Payment/Movie timeout sau khi cancellation workflow đã được persist không trả lỗi đồng bộ kiểu “cancel thất bại”. API trả `202 PROCESSING`; worker retry/reconcile. Chỉ trả `503` nếu Booking chưa thể persist/accept cancellation request an toàn.

## Technical Notes / Constraints

- Policy CGV/BHD chỉ là tham khảo sản phẩm; Product Owner phải duyệt policy riêng của hệ thống.
- Loại bỏ/deprecate contract hủy kiểu action path cũ; canonical contract duy nhất là tạo cancellation resource bằng `POST /api/bookings/{bookingId}/cancellations`.
- Unique constraint đề xuất: một cancellation active trên mỗi `bookingId`; inbox unique theo `(source, eventId)`; idempotency record scope theo `(principal, route, idempotencyKey)` và lưu request hash/result.
- External operation key phải ổn định theo workflow, ví dụ `refund:{cancellationId}` và `cancel-sale:{cancellationId}`; retry không sinh key mới.
- Worker claim pending workflow bằng lock/skip-locked hoặc lease có timeout; mọi step phải resume được sau restart.
- API customer không expose lý do booking của account khác và không nhận secret inventory/payment reference.

## Related

- Branch: `feat/booking-cancellation-refund`
- Depends on: `BK-P0-03`, `BK-P0-04`, Payment refund/query contract, Movie release/query/cancel-sale contract (nếu product cho phép reopen ghế), showtime cancellation event

---

# BK-P1-02 — [Backend] Add secure booking QR pass and idempotent ticket check-in

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Mở rộng ticket records đã được phát hành tại `BK-P0-03` bằng **một QR pass chung cho booking** và luồng check-in. Khi quét QR, nhân viên/trusted gate có thể check-in toàn bộ ghế chưa dùng hoặc chọn một số ticket; trạng thái từng ticket được cập nhật độc lập và idempotent. QR không chứa PII hoặc dữ liệu có thể tự sửa.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Tái sử dụng ticket records unique theo booking detail từ `BK-P0-03`; không có đường phát hành ticket thứ hai.
- [ ] Từ khi feature được bật, local confirmation transaction tạo ticket pass cùng ticket records sau inventory `SOLD`; migration/backfill xử lý booking `CONFIRMED` cũ, GET ticket-pass không lazy-create dữ liệu.
- [ ] Một opaque random `bookingQrToken` đại diện cho booking và resolve ra danh sách ticket; không tạo một QR công khai riêng cho từng ghế.
- [ ] Database lưu lookup hash và token ciphertext được mã hóa at-rest; không lưu plaintext. Encryption key nằm ngoài DB; raw token chỉ trả cho owner qua ticket-pass response và không chứa booking/account/price/permission.
- [ ] Confirm/pass retry trả ticket records và ticket pass cũ, không tạo ticket hoặc QR token mới.
- [ ] Ticket pass có `ACTIVE/REVOKED`, issued/revoked timestamps và rotation strategy; partial check-in không revoke pass khi vẫn còn ticket `VALID`.
- [ ] Migration tạo ticket, booking ticket pass (`token_hash`, `token_ciphertext`, key version), check-in audit và idempotency constraints; raw token không xuất hiện trong log/audit table.
- [ ] Member chỉ xem ticket của mình; employee scan theo cluster/permission; admin theo policy.
- [ ] Check-in `ALL` chuyển atomically các ticket `VALID -> USED`; `SELECTED` chỉ cập nhật các `ticketIds` thuộc booking trong QR.
- [ ] Scan lặp trả lại trạng thái và `checkedInAt` hiện có, không tạo side effect mới.
- [ ] Cancel/refund vô hiệu hóa ticket.
- [ ] Không log QR raw token; có audit actor/device/time cho scan.
- [ ] Có tests tampered token, wrong cinema, too early/late và concurrent scan.

## API Specifications (if applicable)

### API 1 — Get booking ticket pass

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/bookings/{bookingId}/ticket-pass` |
| Auth Required | Booking owner (`MEMBER`) |

```json
{
  "code": 1000,
  "result": {
    "bookingId": "booking-123",
    "bookingCode": "BK260720001",
    "qrToken": "opaque-random-booking-token",
    "movieName": "Avengers",
    "showtimeId": 55,
    "startAt": "2026-07-20T19:00:00+07:00",
    "cinemaRoomName": "Phòng IMAX 1",
    "tickets": [
      { "ticketId": "ticket-901", "showtimeSeatId": 901, "seatCode": "G7", "status": "VALID" },
      { "ticketId": "ticket-902", "showtimeSeatId": 902, "seatCode": "G8", "status": "VALID" }
    ]
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `GET /api/bookings/missing-booking/ticket-pass`<br>`Authorization: Bearer member-token` | Booking không tồn tại/không thuộc member | 404 | `{"code":2004,"message":"BOOKING_NOT_FOUND"}` |
| `GET /api/bookings/pending-booking/ticket-pass`<br>`Authorization: Bearer owner-token` | Booking đang `PENDING_PAYMENT` | 409 | `{"code":2201,"message":"BOOKING_NOT_CONFIRMED"}` |
| `GET /api/bookings/cancelled-booking/ticket-pass`<br>`Authorization: Bearer owner-token` | QR đã bị revoke do cancel/refund | 410 | `{"code":2202,"message":"TICKET_PASS_REVOKED"}` |

### API 2 — List own tickets

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/tickets?scope=SELF&view=UPCOMING&status=VALID&page=0&size=10` |
| Auth Required | MEMBER |

```json
{
  "code": 1000,
  "result": {
    "content": [
      { "ticketId": "ticket-901", "bookingId": "booking-123", "seatCode": "G7", "status": "VALID", "startAt": "2026-07-20T19:00:00+07:00" }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `GET /api/tickets?scope=SELF&view=UPCOMING&page=0&size=10`<br>`Authorization: <missing>` | Không có access token | 401 | `{"code":1008,"message":"UNAUTHENTICATED"}` |
| `GET /api/tickets?scope=SELF&view=UNKNOWN&status=INVALID&page=0&size=10` | `view/status` không thuộc enum hỗ trợ | 400 | `{"code":2203,"message":"INVALID_TICKET_FILTER"}` |
| `GET /api/tickets?scope=SELF&view=UPCOMING&page=0&size=1000` | `size=1000` vượt giới hạn | 400 | `{"code":2204,"message":"PAGE_SIZE_EXCEEDED"}` |

### API 3 — Check in booking tickets

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/ticket-check-ins` |
| Auth Required | `TICKET_CHECK_IN` permission; employee đúng cluster, admin theo policy, hoặc trusted gate device |
| Header | `Idempotency-Key` |

```json
{
  "qrToken": "opaque-random-booking-token",
  "checkInMode": "SELECTED",
  "ticketIds": ["ticket-901"],
  "gateId": "Q1-GATE-02"
}
```

Với `checkInMode=ALL`, bỏ `ticketIds`; backend check-in toàn bộ ticket `VALID` thuộc booking.

```json
{
  "code": 1000,
  "result": {
    "bookingId": "booking-123",
    "checkInMode": "SELECTED",
    "gateId": "Q1-GATE-02",
    "tickets": [
      { "ticketId": "ticket-901", "seatCode": "G7", "status": "USED", "checkedInAt": "2026-07-20T18:45:12+07:00" },
      { "ticketId": "ticket-902", "seatCode": "G8", "status": "VALID", "checkedInAt": null }
    ]
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /api/ticket-check-ins`<br>`Body: {"qrToken":"invalid-token","checkInMode":"ALL","gateId":"Q1-GATE-02"}` | QR token sai format/không tồn tại | 400 | `{"code":2210,"message":"INVALID_QR_TOKEN"}` |
| `POST /api/ticket-check-ins`<br>`Body: {"qrToken":"revoked-token","checkInMode":"ALL","gateId":"Q1-GATE-02"}` | QR đã bị revoke | 410 | `{"code":2211,"message":"QR_TOKEN_REVOKED"}` |
| `POST /api/ticket-check-ins`<br>`Body: {"qrToken":"booking-123-token","checkInMode":"SELECTED","ticketIds":["ticket-other"],"gateId":"Q1-GATE-02"}` | `ticket-other` không thuộc booking trong QR | 400 | `{"code":2212,"message":"TICKET_NOT_IN_BOOKING"}` |
| `POST /api/ticket-check-ins`<br>`Body: {"qrToken":"booking-123-token","checkInMode":"ALL","gateId":"Q2-GATE-01"}` | Employee/gate thuộc cluster khác | 403 | `{"code":2213,"message":"WRONG_CINEMA_SCOPE"}` |
| `POST /api/ticket-check-ins`<br>`Body: {"qrToken":"booking-123-token","checkInMode":"ALL","gateId":"Q1-GATE-02"}` | Request trước cửa sổ check-in | 409 | `{"code":2214,"message":"CHECK_IN_TOO_EARLY"}` |
| `POST /api/ticket-check-ins`<br>`Body: {"qrToken":"booking-123-token","checkInMode":"ALL","gateId":"Q1-GATE-02"}` | Request sau khi cửa sổ check-in đóng | 409 | `{"code":2215,"message":"CHECK_IN_WINDOW_CLOSED"}` |
| `POST /api/ticket-check-ins`<br>`Body: {"qrToken":"booking-123-token","checkInMode":"SELECTED","ticketIds":["cancelled-ticket"],"gateId":"Q1-GATE-02"}` | Ticket đã cancel/refund | 409 | `{"code":2216,"message":"TICKET_CANCELLED"}` |
| `POST /api/ticket-check-ins`<br>`Idempotency-Key: scan-key-1`<br>`Body lần đầu: {"checkInMode":"SELECTED","ticketIds":["ticket-901"]}`<br>`Body retry: {"checkInMode":"SELECTED","ticketIds":["ticket-902"]}` | Cùng key nhưng request hash khác | 409 | `{"code":2015,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |

## Technical Notes / Constraints

- QR là credential; không nhúng `accountId`, giá hoặc permission và không cho MEMBER tự gọi check-in từ xa.
- `gateId` từ request phải được validate thuộc trusted device/cluster của principal; không dùng trực tiếp làm authorization evidence.
- Time window phải dùng timezone business đã thống nhất.

## Related

- Branch: `feat/booking-ticket-checkin`
- Depends on: `BK-P0-03`, employee permission/cluster scope
- Blocks: notification ticket delivery

---

# BK-P1-03A — [Backend] Add employee booking query by authorized cluster scope

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Cho phép nhân viên lọc booking bằng query parameters trên collection resource trong đúng cluster được phân công. Issue chỉ xây read/query authorization; counter sale và reconciliation được tách sang `BK-P1-03B` và `BK-P1-03C`.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Search theo booking code, member/contact, showtime, status, date range; pagination/sort có giới hạn.
- [ ] Employee chỉ thao tác trong cluster được phân công; admin có scope rộng hơn.
- [ ] Không expose PII quá mức trong search response.
- [ ] Security/integration tests cover member denial, cross-cluster access, invalid filters và page-size limit.

## API Specifications (if applicable)

### API 1 — Query bookings for employee operations

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/bookings?scope=CLUSTER&bookingCode=&showtimeId=&status=&fromDate=&toDate=&page=0&size=20` |
| Auth Required | EMPLOYEE/ADMIN |

Mọi filter là query parameter trên collection `/api/bookings`. Cluster scope lấy từ JWT/permission, không tin `clusterId` tùy ý từ employee.

```json
{
  "code": 1000,
  "result": {
    "content": [
      {
        "bookingId": "booking-123",
        "bookingCode": "BK260720001",
        "bookingType": "ONLINE",
        "status": "CONFIRMED",
        "showtimeId": 55,
        "movieName": "Avengers",
        "seatCodes": ["G7", "G8"],
        "finalAmount": 240000,
        "createdAt": "2026-07-20T17:05:00+07:00"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `GET /api/bookings?scope=CLUSTER&page=0&size=20`<br>`Authorization: <missing>` | Không có access token | 401 | `{"code":1008,"message":"UNAUTHENTICATED"}` |
| `GET /api/bookings?scope=CLUSTER&page=0&size=20`<br>`Authorization: Bearer member-token` | Account chỉ có role MEMBER | 403 | `{"code":2301,"message":"EMPLOYEE_SCOPE_REQUIRED"}` |
| `GET /api/bookings?scope=CLUSTER&status=UNKNOWN&sort=invalid&page=0&size=20` | Filter/sort không hợp lệ | 400 | `{"code":2302,"message":"INVALID_BOOKING_FILTER"}` |
| `GET /api/bookings?scope=CLUSTER&fromDate=2026-07-20&toDate=2026-07-10&page=0&size=20` | `fromDate` sau `toDate` | 400 | `{"code":2303,"message":"INVALID_DATE_RANGE"}` |
| `GET /api/bookings?scope=CLUSTER&page=0&size=1000` | `size=1000` vượt giới hạn | 400 | `{"code":2204,"message":"PAGE_SIZE_EXCEEDED"}` |

## Related

- Branch: `feat/booking-employee-query`
- Depends on: employee authorization/cluster scope contract

---

# BK-P1-03B — [Backend] Orchestrate auditable counter sale

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Tạo booking tại quầy qua cùng collection resource, dùng authoritative inventory/price và lưu payment ledger/receipt đủ để audit, retry và refund. Không cho controller đặt thẳng `PAID/CONFIRMED` mà không qua service policy.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Counter sale dùng hold atomic và giá authoritative; lưu `bookingType=COUNTER`, cashier, terminal và customer/contact snapshot tối thiểu.
- [ ] Mỗi cash/approved counter payment có immutable ledger/reference, amount, method, collectedBy và collectedAt.
- [ ] Counter confirmation dùng cùng inventory confirm/ticket issuance state machine; không bypass bằng controller override.
- [ ] Có receipt/reference và retry idempotent khi POS mất kết nối.
- [ ] Employee chỉ bán trong cluster được phân công; terminal phải thuộc employee/cluster.
- [ ] Tests cover concurrent online-vs-counter purchase, duplicate retry, terminal denial và failure sau khi thu tiền.

## API Specifications (if applicable)

### API — Create a counter booking

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/bookings` |
| Auth Required | EMPLOYEE/ADMIN |
| Header | `Idempotency-Key` |

```json
{
  "bookingType": "COUNTER",
  "showtimeId": 55,
  "showtimeSeatIds": [901, 902],
  "customer": { "name": "Nguyễn Văn A", "phone": "0900000000" },
  "paymentMethod": "CASH",
  "terminalId": "Q1-POS-03"
}
```

```json
{
  "code": 1000,
  "result": {
    "bookingId": "booking-counter-456",
    "bookingCode": "BK260720002",
    "bookingType": "COUNTER",
    "status": "CONFIRMED",
    "paymentStatus": "PAID",
    "seatCodes": ["G7", "G8"],
    "finalAmount": 240000,
    "receiptReference": "Q1-POS-03-000018",
    "ticketPassUrl": "/api/bookings/booking-counter-456/ticket-pass"
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /api/bookings`<br>`Body: {"bookingType":"COUNTER","showtimeId":55,"showtimeSeatIds":[],"paymentMethod":"CASH","terminalId":"Q1-POS-03"}` | Danh sách ghế rỗng | 400 | `{"code":2005,"message":"INVALID_SEAT_SELECTION"}` |
| `POST /api/bookings`<br>`Body: {"bookingType":"COUNTER","showtimeId":55,"showtimeSeatIds":[901,902],"paymentMethod":"CASH","terminalId":"Q1-POS-03"}` | Seat `902` đã hold/sold | 409 | `{"code":2011,"message":"SEATS_ALREADY_TAKEN","result":{"unavailableShowtimeSeatIds":[902]}}` |
| `POST /api/bookings`<br>`Body: {"bookingType":"COUNTER","showtimeId":55,"showtimeSeatIds":[901],"paymentMethod":"CRYPTO","terminalId":"Q1-POS-03"}` | `CRYPTO` không được phép tại quầy | 400 | `{"code":2304,"message":"COUNTER_PAYMENT_METHOD_NOT_ALLOWED"}` |
| `POST /api/bookings`<br>`Body: {"bookingType":"COUNTER","showtimeId":55,"showtimeSeatIds":[901],"paymentMethod":"CASH","terminalId":"Q9-POS-99"}` | Terminal không thuộc employee | 403 | `{"code":2305,"message":"TERMINAL_NOT_AUTHORIZED"}` |
| `POST /api/bookings`<br>`Body: {"bookingType":"COUNTER","showtimeId":99,"showtimeSeatIds":[1901],"paymentMethod":"CASH","terminalId":"Q1-POS-03"}` | Showtime `99` thuộc cluster khác | 403 | `{"code":2306,"message":"EMPLOYEE_OUTSIDE_CLUSTER_SCOPE"}` |
| `POST /api/bookings`<br>`Body: {"bookingType":"COUNTER","showtimeId":55,"showtimeSeatIds":[901],"paymentMethod":"CASH","terminalId":"Q1-POS-03"}` | Inventory Service timeout | 503 | `{"code":2014,"message":"INVENTORY_SERVICE_UNAVAILABLE"}` |
| `POST /api/bookings`<br>`Idempotency-Key: counter-key-1`<br>`Body lần đầu: {"showtimeSeatIds":[901]}`<br>`Body retry: {"showtimeSeatIds":[902]}` | Cùng key nhưng request hash khác | 409 | `{"code":2015,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |

## Technical Notes / Constraints

- Counter sale vẫn tạo booking và payment ledger record để audit/refund/reporting nhất quán.
- Nếu tiền đã thu nhưng inventory confirm thất bại, chuyển reconciliation/refund state; không trả success giả.

## Related

- Branch: `feat/booking-counter-sale`
- Depends on: `BK-P0-01`, `BK-P0-03`, employee authorization scope

---

# BK-P1-03C — [Backend] Create auditable booking reconciliation cases

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Cho phép nhân viên được phân quyền ghi nhận mismatch booking/payment/inventory để worker hoặc operator policy xử lý. API chỉ tạo case và evidence; không trực tiếp confirm/refund/unsell từ controller.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Case có type, severity, status, booking/payment/hold reference, evidence, actor, cluster scope và audit timestamps.
- [ ] Duplicate request dùng idempotency key không tạo case trùng.
- [ ] Chỉ worker/policy được duyệt mới thực thi retry/compensation; controller không bypass state machine.
- [ ] Không nhận payment evidence từ client làm authoritative nếu chưa đối chiếu Payment contract.
- [ ] Tests cover consistent booking, mismatched evidence, cross-cluster denial và duplicate retry.

## API Specifications (if applicable)

### API — Create a booking reconciliation case

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/booking-reconciliations` |
| Auth Required | Authorized EMPLOYEE/ADMIN |
| Header | `Idempotency-Key` |

```json
{
  "bookingId": "booking-123",
  "reasonCode": "PAYMENT_CAPTURED_BOOKING_PENDING",
  "paymentReference": "pay-123",
  "note": "Đã đối chiếu biên nhận tại quầy"
}
```

```json
{
  "code": 1000,
  "result": {
    "caseId": "recon-789",
    "bookingId": "booking-123",
    "status": "OPEN",
    "reasonCode": "PAYMENT_CAPTURED_BOOKING_PENDING",
    "createdAt": "2026-07-20T17:20:00+07:00"
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /api/booking-reconciliations`<br>`Body: {"bookingId":"missing-booking","reasonCode":"PAYMENT_CAPTURED_BOOKING_PENDING","paymentReference":"pay-123"}` | Booking không tồn tại | 404 | `{"code":2004,"message":"BOOKING_NOT_FOUND"}` |
| `POST /api/booking-reconciliations`<br>`Body: {"bookingId":"booking-123","reasonCode":"PAYMENT_CAPTURED_BOOKING_PENDING","paymentReference":"pay-123"}` | Booking/payment/inventory đã nhất quán | 409 | `{"code":2310,"message":"RECONCILIATION_NOT_REQUIRED"}` |
| `POST /api/booking-reconciliations`<br>`Body: {"bookingId":"booking-123","reasonCode":"UNKNOWN","paymentReference":"pay-123"}` | `UNKNOWN` không được hỗ trợ | 400 | `{"code":2311,"message":"INVALID_RECONCILIATION_REASON"}` |
| `POST /api/booking-reconciliations`<br>`Body: {"bookingId":"booking-123","reasonCode":"PAYMENT_CAPTURED_BOOKING_PENDING","paymentReference":"wrong-pay"}` | Payment reference không khớp | 409 | `{"code":2312,"message":"PAYMENT_EVIDENCE_MISMATCH"}` |
| `POST /api/booking-reconciliations`<br>`Body: {"bookingId":"other-cluster-booking","reasonCode":"PAYMENT_CAPTURED_BOOKING_PENDING","paymentReference":"pay-999"}` | Booking ngoài cluster nhân viên | 403 | `{"code":2306,"message":"EMPLOYEE_OUTSIDE_CLUSTER_SCOPE"}` |
| `POST /api/booking-reconciliations`<br>`Idempotency-Key: recon-key-1`<br>`Body lần đầu: {"bookingId":"booking-123","reasonCode":"PAYMENT_CAPTURED_BOOKING_PENDING"}`<br>`Body retry: {"bookingId":"booking-123","reasonCode":"INVENTORY_MISMATCH"}` | Cùng key nhưng request hash khác | 409 | `{"code":2015,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |

## Technical Notes / Constraints

- Không tái sử dụng `isAdmin` boolean rải trong controller; dùng method authorization/policy component.
- Reconciliation API dành cho authenticated employee/admin qua public gateway policy, không đặt dưới `/internal/**`.

## Related

- Branch: `feat/booking-reconciliation-cases`
- Depends on: `BK-P0-03`, employee authorization scope, Payment/Movie read contract

---

# BK-P1-04 — [Backend] Publish reliable booking events for notifications and downstream services

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Phát sự kiện booking sau commit để notification/user/reporting có thể phản ứng mà không coupling trực tiếp vào transaction đặt vé. Đảm bảo event không mất khi DB commit nhưng Kafka tạm lỗi.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Transactional outbox lưu cùng transaction với state change.
- [ ] Event tối thiểu: `BOOKING_PENDING_PAYMENT`, `BOOKING_CONFIRMED`, `BOOKING_EXPIRED`, `BOOKING_CANCELLED`, `REFUND_COMPLETED`, `TICKET_ISSUED`.
- [ ] Event envelope có `eventId`, `eventType`, `aggregateId`, `version`, `occurredAt`, `correlationId` và schema version.
- [ ] Publisher retry/backoff và dead-letter/failed status có operation để replay.
- [ ] Consumer downstream có thể deduplicate bằng `eventId`.
- [ ] Payload chứa đủ snapshot để gửi message nhưng không chứa secret/QR raw token ngoài channel an toàn.
- [ ] Booking transaction không rollback chỉ vì email/SMS provider lỗi.
- [ ] Metrics cho pending/failed outbox và delivery latency.

## API Specifications (if applicable)

N/A — Kafka event contract cần được document bằng JSON schema/AsyncAPI.

## Technical Notes / Constraints

- Kafka dependency đã có nhưng chưa có publisher flow hoàn chỉnh.
- Email/Thymeleaf trong booking-service nên được chuyển sang notification-service theo scope đã document, hoặc đánh dấu rõ transitional implementation.

## Related

- Branch: `feat/booking-transactional-outbox`
- Depends on: `BK-P0-03`, Kafka infrastructure, notification-service contract

---

# BK-P1-05 — [Backend] Complete customer booking history and status retrieval

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Hoàn thiện “Vé của tôi/Lịch sử giao dịch”: response hiện có nhiều snapshot null, sort theo booking UUID và chưa phân biệt upcoming/past/actionable. Cung cấp read model ổn định cho frontend và trạng thái thanh toán/refund/ticket.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Sort mặc định theo `createdAt DESC`, không theo UUID.
- [ ] Filter `UPCOMING/PAST`, booking status, payment status và date range.
- [ ] Detail trả snapshot movie/cluster/room/showtime/seats/amount/discount/payment/refund/tickets.
- [ ] Trả `expiresAt` và action flags như `canPay`, `canCancel`, `canRefund`, `canViewTicket` do backend policy tính.
- [ ] Member chỉ đọc booking/ticket của mình; không phân biệt 403/404 làm lộ booking người khác.
- [ ] Pagination contract đồng nhất với common API.
- [ ] Empty page, expired pending và cancelled/refunded booking được test.

## API Specifications (if applicable)

| Action | Method | Endpoint |
|---|---|---|
| List mine | `GET` | `/api/bookings?scope=SELF&view=UPCOMING&status=&page=0&size=10` |
| Detail | `GET` | `/api/bookings/{bookingId}` |

List success response:

```json
{
  "code": 1000,
  "result": {
    "content": [
      {
        "bookingId": "booking-123",
        "bookingCode": "BK260720001",
        "status": "CONFIRMED",
        "movieName": "Avengers",
        "startAt": "2026-07-20T19:00:00+07:00",
        "seatCodes": ["G7", "G8"],
        "finalAmount": 240000,
        "canPay": false,
        "canCancel": true,
        "canViewTicket": true
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

Detail success response:

```json
{
  "code": 1000,
  "result": {
    "bookingId": "booking-123",
    "bookingCode": "BK260720001",
    "status": "CONFIRMED",
    "paymentStatus": "PAID",
    "movieName": "Avengers",
    "clusterName": "CinePrime Quận 1",
    "cinemaRoomName": "Phòng IMAX 1",
    "startAt": "2026-07-20T19:00:00+07:00",
    "seats": [
      { "ticketId": "ticket-901", "seatCode": "G7", "seatType": "VIP", "unitPrice": 120000, "ticketStatus": "VALID" },
      { "ticketId": "ticket-902", "seatCode": "G8", "seatType": "VIP", "unitPrice": 120000, "ticketStatus": "VALID" }
    ],
    "totalAmount": 240000,
    "discountAmount": 0,
    "finalAmount": 240000,
    "canPay": false,
    "canCancel": true,
    "canViewTicket": true
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `GET /api/bookings?scope=SELF&view=UPCOMING&page=0&size=10`<br>`Authorization: <missing>` | Không có access token | 401 | `{"code":1008,"message":"UNAUTHENTICATED"}` |
| `GET /api/bookings?scope=SELF&view=UNKNOWN&status=INVALID&page=0&size=10` | `view/status` không hợp lệ | 400 | `{"code":2320,"message":"INVALID_HISTORY_FILTER"}` |
| `GET /api/bookings?scope=SELF&view=UPCOMING&page=0&size=1000` | `size=1000` vượt giới hạn | 400 | `{"code":2204,"message":"PAGE_SIZE_EXCEEDED"}` |
| `GET /api/bookings/missing-or-foreign-booking`<br>`Authorization: Bearer member-token` | Booking không tồn tại hoặc thuộc member khác | 404 | `{"code":2004,"message":"BOOKING_NOT_FOUND"}` |

## Technical Notes / Constraints

- Read model dùng transaction snapshot, không gọi movie-service để dựng lại dữ liệu lịch sử.
- Có thể enrich poster URL như non-authoritative display data, nhưng booking snapshot vẫn phải đủ khi movie bị sửa/xóa.

## Related

- Branch: `feat/booking-customer-history`
- Depends on: `BK-P0-02`, `BK-P0-03`, `BK-P1-01`, `BK-P1-02`

---

# BK-P2-01A — [Backend] Integrate promotion-aware checkout

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Low`

## Summary / Objective

Mở rộng checkout seat-only để Booking Service consume Promotion Service contract, lưu promotion snapshot và điều phối reserve/commit/release quota theo kết quả payment. Issue không triển khai rule/quota master trong Booking Service.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Quote API trả seat line items, promotion discount, fees và final amount có expiry.
- [ ] Promotion được validate theo movie/showtime/cluster/channel/time/member và usage limit.
- [ ] Promotion quota được reserve trước payment, commit khi confirmed, release khi failed/expired/cancelled.
- [ ] Idempotency ngăn reserve/commit promotion hai lần khi retry.
- [ ] Booking lưu breakdown đủ cho refund một phần/toàn phần và audit.
- [ ] Total/final amount không âm; rounding VND thống nhất.
- [ ] Tests cover expired promotion, exhausted quota race, duplicate retry và compensation.

## API Specifications (if applicable)

| Action | Method | Endpoint |
|---|---|---|
| Quote checkout | `POST` | `/api/booking-quotes` |
| Create from quote | `POST` | `/api/bookings` với `quoteId` |

```json
{
  "showtimeId": 55,
  "showtimeSeatIds": [901, 902],
  "promotionCode": "SUMMER26"
}
```

```json
{
  "code": 1000,
  "result": {
    "quoteId": "quote-123",
    "lineItems": [
      { "type": "SEAT", "referenceId": "901", "quantity": 1, "unitPrice": 120000, "amount": 120000 },
      { "type": "SEAT", "referenceId": "902", "quantity": 1, "unitPrice": 120000, "amount": 120000 }
    ],
    "subTotal": 240000,
    "discountAmount": 35000,
    "finalAmount": 205000,
    "expiresAt": "2026-07-20T17:05:00+07:00"
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /api/booking-quotes`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[901],"promotionCode":"INVALID"}` | Promotion không áp dụng | 409 | `{"code":2501,"message":"PROMOTION_NOT_APPLICABLE"}` |
| `POST /api/booking-quotes`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[901],"promotionCode":"SOLDOUT26"}` | Promotion đã hết quota | 409 | `{"code":2502,"message":"PROMOTION_QUOTA_EXHAUSTED"}` |
| `POST /api/booking-quotes`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[]}` | Ghế rỗng | 400 | `{"code":2505,"message":"INVALID_QUOTE_REQUEST"}` |
| `POST /api/booking-quotes`<br>`Body: {"showtimeId":55,"showtimeSeatIds":[901]}` | Inventory Service timeout | 503 | `{"code":2014,"message":"INVENTORY_SERVICE_UNAVAILABLE"}` |

Create-from-quote request:

```json
{ "quoteId": "quote-123" }
```

```json
{
  "code": 1000,
  "result": {
    "bookingId": "booking-quote-123",
    "quoteId": "quote-123",
    "status": "PENDING_PAYMENT",
    "showtimeId": 55,
    "seatCodes": ["G7", "G8"],
    "subTotal": 240000,
    "discountAmount": 35000,
    "finalAmount": 205000,
    "expiresAt": "2026-07-20T17:15:00+07:00"
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /api/bookings`<br>`Body: {"quoteId":"missing-quote"}` | Quote không tồn tại | 404 | `{"code":2506,"message":"QUOTE_NOT_FOUND"}` |
| `POST /api/bookings`<br>`Body: {"quoteId":"expired-quote"}` | Quote đã qua `expiresAt` | 410 | `{"code":2507,"message":"QUOTE_EXPIRED"}` |
| `POST /api/bookings`<br>`Authorization: Bearer other-member-token`<br>`Body: {"quoteId":"quote-123"}` | Quote thuộc account khác | 403 | `{"code":2508,"message":"QUOTE_OWNER_MISMATCH"}` |
| `POST /api/bookings`<br>`Body: {"quoteId":"quote-123"}` | Ghế trong quote không còn available | 409 | `{"code":2011,"message":"SEATS_ALREADY_TAKEN"}` |
| `POST /api/bookings`<br>`Idempotency-Key: quote-booking-key-1`<br>`Body lần đầu: {"quoteId":"quote-123"}`<br>`Body retry: {"quoteId":"quote-456"}` | Cùng key nhưng request hash khác | 409 | `{"code":2015,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |

## Technical Notes / Constraints

- Phụ thuộc Promotion Service contract; Booking Service không tự sở hữu rule/quota master.
- Tách quote khỏi booking giúp validate giá trước khi hold/payment nhưng quote không được thay thế inventory hold.

## Related

- Branch: `feat/booking-promotion-checkout`
- Depends on: `BK-P0-03`, Promotion Service contract

---

# BK-P2-01B — [Backend] Integrate loyalty reservation lifecycle

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Low`

## Summary / Objective

Cho phép Booking Service consume User/Loyalty contract để reserve điểm trước payment, commit khi booking confirmed và release khi payment fail/expire/cancel. Booking chỉ lưu redemption snapshot/reference, không sở hữu balance master.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Request/quote nhận `pointsToUse` theo policy đã được Product Owner chốt; frontend không gửi discount amount.
- [ ] Booking reserve điểm bằng idempotency key trước payment và lưu `loyaltyReservationId/expiresAt`.
- [ ] Confirm booking commit reservation đúng một lần; payment fail/expiry/cancel release đúng một lần.
- [ ] Retry/lost response query hoặc retry cùng key, không reserve/commit/release lần hai.
- [ ] `finalAmount` không âm; rounding VND và giới hạn tỷ lệ thanh toán bằng điểm được cấu hình.
- [ ] Refund khôi phục điểm theo snapshot/policy, không tự cộng balance trong Booking DB.
- [ ] Tests cover insufficient/expired points, duplicate retry, payment failure và compensation.

## API Specifications (if applicable)

Booking public quote/create contract mở rộng bằng `pointsToUse`; internal User/Loyalty API là consumed contract do owner User Service quản lý và không được triển khai trong issue này.

## Related

- Branch: `feat/booking-loyalty-orchestration`
- Depends on: `BK-P0-03`, User/Loyalty Service contract

---

# BK-P2-01C — [Backend] Integrate concession-aware checkout

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Low`

## Summary / Objective

Mở rộng booking order bằng combo/bắp nước thông qua catalog/inventory/fulfillment contract đã có owner khác. Booking lưu line-item snapshot và orchestration reference; không sở hữu concession stock master.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Quote nhận SKU/quantity và trả snapshot name, quantity, unit price, amount, fulfillment cluster/time.
- [ ] Validate SKU bán được tại đúng cluster/showtime/channel và reserve stock nếu contract hỗ trợ inventory reservation.
- [ ] Commit concession reservation khi confirmed; release khi payment fail/expire/cancel.
- [ ] Idempotency ngăn reserve/commit/release stock hai lần.
- [ ] Booking lưu breakdown đủ cho receipt, fulfillment và refund; không dựng lịch sử bằng cách gọi catalog hiện tại.
- [ ] Tests cover invalid/out-of-stock SKU, cluster mismatch, duplicate retry và compensation.

## API Specifications (if applicable)

Booking quote/create contract mở rộng bằng `concessions`; external concession contract chỉ được tham chiếu như dependency, không triển khai trong Booking Service.

## Related

- Branch: `feat/booking-concession-checkout`
- Depends on: `BK-P0-03`, concession catalog/inventory contract

---

# BK-P2-02 — [Backend] Add booking observability, reconciliation, and abuse controls

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Low`

## Summary / Objective

Cho phép team phát hiện ghế kẹt, payment lệch, ticket trùng và hành vi giữ ghế hàng loạt. Cung cấp reconciliation có audit và rate limit theo action, không auto-fix dữ liệu nguy hiểm một cách mù quáng.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Structured log có correlation/booking/payment/hold IDs nhưng mask PII/token.
- [ ] Metrics: create success/failure, hold conflict, active/expired hold, payment latency/failure, late success, refund failure, outbox lag, ticket scan conflict.
- [ ] Reconciliation so sánh booking confirmed, payment success, ticket count và movie inventory SOLD.
- [ ] Mismatch được ghi case có severity/status/owner; auto-fix chỉ cho rule đã chứng minh idempotent.
- [ ] Admin operation xem/retry failed compensation/outbox với permission và audit.
- [ ] Human operation API dùng employee/admin JWT + permission/cluster scope dưới `/api/operations/**`; `/internal/**` chỉ dành service credential và không route public.
- [ ] Rate limit hold/create/payment retry theo account/IP/device signal; giới hạn không khóa nhầm retry hợp lệ.
- [ ] Alert cho stuck pending/refund, inventory mismatch và scheduler không chạy.
- [ ] Có runbook tối thiểu cho payment success nhưng ghế chưa SOLD, ghế RESERVED quá TTL và duplicate ticket.

## API Specifications (if applicable)

Employee/admin operation API (đi qua gateway với permission rõ ràng, không phải service-to-service internal API):

| Action | Method | Endpoint |
|---|---|---|
| List reconciliation cases | `GET` | `/api/operations/booking-reconciliations?status=OPEN&page=0&size=20` |
| Create retry attempt | `POST` | `/api/operations/booking-reconciliation-attempts` |

List success response:

```json
{
  "code": 1000,
  "result": {
    "content": [
      { "caseId": "recon-789", "bookingId": "booking-123", "type": "PAYMENT_INVENTORY_MISMATCH", "severity": "HIGH", "status": "OPEN", "createdAt": "2026-07-20T17:20:00+07:00" }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

Retry request:

```json
{ "caseId": "recon-789", "reason": "MOVIE_SERVICE_RECOVERED" }
```

```json
{
  "code": 1000,
  "result": { "attemptId": "recon-attempt-001", "caseId": "recon-789", "status": "QUEUED" }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `GET /api/operations/booking-reconciliations?status=UNKNOWN&page=-1&size=20` | Filter/page không hợp lệ | 400 | `{"code":2400,"message":"INVALID_RECONCILIATION_FILTER"}` |
| `GET /api/operations/booking-reconciliations?status=OPEN&page=0&size=20`<br>`Authorization: Bearer member-token` | Caller không có operation permission | 403 | `{"code":2404,"message":"OPERATION_PERMISSION_REQUIRED"}` |
| `POST /api/operations/booking-reconciliation-attempts`<br>`Body: {"caseId":"missing-case","reason":"SERVICE_RECOVERED"}` | Case không tồn tại | 404 | `{"code":2401,"message":"RECONCILIATION_CASE_NOT_FOUND"}` |
| `POST /api/operations/booking-reconciliation-attempts`<br>`Body: {"caseId":"resolved-case","reason":"SERVICE_RECOVERED"}` | Case đã resolve | 409 | `{"code":2402,"message":"RECONCILIATION_ALREADY_RESOLVED"}` |
| `POST /api/operations/booking-reconciliation-attempts`<br>`Body: {"caseId":"manual-only-case","reason":"SERVICE_RECOVERED"}` | Rule không cho retry tự động | 409 | `{"code":2403,"message":"UNSAFE_AUTOMATIC_COMPENSATION"}` |
| `POST /api/operations/booking-reconciliation-attempts`<br>`Idempotency-Key: retry-key-1`<br>`Body lần đầu: {"caseId":"case-1"}`<br>`Body retry: {"caseId":"case-2"}` | Cùng key nhưng request hash khác | 409 | `{"code":2015,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |
| `POST /api/operations/booking-reconciliation-attempts`<br>`Authorization: Bearer member-token`<br>`Body: {"caseId":"case-1","reason":"SERVICE_RECOVERED"}` | Caller không có operation permission | 403 | `{"code":2404,"message":"OPERATION_PERMISSION_REQUIRED"}` |

## Technical Notes / Constraints

- Prefer metrics/Actuator cho aggregate. Operation API có route gateway riêng và permission chặt; internal worker/service API không expose public.
- Manual fix phải lưu before/after, actor, reason và correlation ID.

## Related

- Branch: `feat/booking-observability-reconciliation`
- Depends on: P0 lifecycle, outbox, payment/movie contracts

---

## 5. Definition of product-ready cho booking-service

Chỉ xem luồng online booking đạt P0 khi demo/test chứng minh được đồng thời:

- Hai user không thể mua/giữ cùng một ghế, kể cả request đồng thời hoặc retry.
- Giá, seat code/type và thông tin suất chiếu trong booking lấy từ nguồn thật và được snapshot.
- Payment success xác nhận booking/ticket/inventory đúng một lần; authoritative payment failure trả ghế; timeout giữ `PAYMENT_UNKNOWN` cho tới khi query/reconcile có kết quả.
- Booking hết hạn tự động, không để lock vĩnh viễn.
- Service restart/retry/event duplicate không tạo booking, charge hoặc ticket trùng.
- Schema/constraint khớp entity và được kiểm tra trong CI; secret không hardcode; contract giữa service có test.
- Customer xem được booking/ticket của mình; người khác không đọc/hủy được.

## 6. Nội dung cần Product Owner/Leader chốt trước khi implement

1. Xác nhận TTL authoritative và expiry semantics từ Movie contract; Booking không tự chọn TTL khác.
2. Cutoff bán online trước giờ chiếu và timezone chuẩn.
3. Chính sách cancel/refund riêng: cutoff, refund về nguồn hay credit, hạn mức, phí, trường hợp cinema cancel.
4. Một record `COUPLE/SOFA` map thành bao nhiêu physical seat ticket; dù UI dùng một QR/booking, backend vẫn cần trạng thái check-in theo từng ghế.
5. Payment methods/MVP provider và event contract với payment-service.
6. Có bắt buộc MEMBER cho online booking hay hỗ trợ guest checkout.
7. Employee được thao tác trong cluster nào và ai được tạo reconciliation/refund/check-in exception.
8. Thứ tự áp dụng promotion/voucher/points và cách hoàn lại từng loại.

## 7. Kế hoạch báo cáo cá nhân đề xuất

- Báo cáo 1 — **Hiểu service:** ownership, entity/state machine, target API, dependency Movie/Payment/User và 5 rủi ro lớn nhất.
- Báo cáo 2 — **Plan:** issue nhận, priority, estimate, dependency, API/schema thay đổi và test strategy.
- Báo cáo 3 — **Demo P0:** concurrent hold, payment retry, expiry/release và ticket retrieval bằng request/response thực tế.
- Mỗi MR phải link đúng issue, chỉ cover một outcome, có migration/test/contract update tương ứng và nêu rõ phần phụ thuộc chưa merge.

---

## 8. Phụ lục A — Giải thích quyết định kiến trúc

### A.1. Quyết định cuối cùng

Người dùng bấm **“Tiếp tục”** một lần. Frontend gọi duy nhất:

```http
POST /api/bookings
```

Không có public `/api/seat-holds`. Booking Service tự gọi internal Movie API để reserve inventory, sau đó lưu booking `PENDING_PAYMENT`.

```text
Frontend                  Booking Service               Movie Service              Payment Service
   | POST /api/bookings          |                           |                           |
   |---------------------------->| internal reserve          |                           |
   |                             |-------------------------->|                           |
   |                             | ACTIVE hold + snapshot    |                           |
   |                             |<--------------------------|                           |
   |                             | save PENDING_PAYMENT      |                           |
   | bookingId + expiresAt       |                           |                           |
   |<----------------------------|                           |                           |
   | POST /api/payments ----------------------------------------------------->|
   |                             |<------------ PAYMENT_SUCCEEDED event -----------------|
   |                             | save CONFIRM_PENDING    |                           |
   |                             | confirm inventory         |                           |
   |                             |-------------------------->| RESERVED -> SOLD          |
   |                             | save CONFIRMED + tickets  |                           |
```

### A.2. Vì sao không gửi `movieId`, `cinemaId` và giá?

`showtimeId` đã xác định movie, cluster, room, ngày và giờ. `showtimeSeatId` xác định seat code/type/price của suất đó. Nếu frontend gửi thêm dữ liệu, request có thể mâu thuẫn hoặc bị sửa giá. Backend chỉ tin snapshot trả từ Movie Service.

Public request:

```json
{
  "showtimeId": 55,
  "showtimeSeatIds": [901, 902]
}
```

### A.3. Vì sao không dùng public hold API riêng?

Public hold riêng phù hợp checkout rất phức tạp, nhưng làm frontend phải điều phối thêm request/resource. Dự án chọn mô hình lai:

- UX/public boundary: một nút, một `POST /api/bookings`.
- Internal boundary: reserve inventory và persist booking vẫn là hai operation riêng.
- Booking Service chịu trách nhiệm compensation nếu reserve thành công nhưng lưu booking thất bại.

### A.4. BK-P0-01 là gì?

Đây là contract nội bộ Booking Service tiêu thụ, không phải endpoint frontend và không phải issue triển khai Movie Service:

1. Reserve: `AVAILABLE -> RESERVED`.
2. Confirm: `RESERVED -> SOLD` sau payment success.
3. Release: `RESERVED -> AVAILABLE` khi hủy/lỗi/hết hạn.

Selection phải all-or-nothing. Nếu một ghế không available thì toàn bộ request rollback.

### A.5. Vì sao không giữ hai bảng lock độc lập?

Nếu `booking_db.seat_lock` và `movie_db.showtime_seat` cùng là nguồn truth, chúng có thể lệch TTL/trạng thái. Ownership cuối cùng:

| Dữ liệu | Owner |
|---|---|
| Showtime, seat inventory, hold TTL | Movie Service |
| Booking/order và transaction snapshot | Booking Service |
| Payment/refund | Payment Service |
| Ticket | Booking Service |

Booking Service chỉ lưu `inventoryHoldToken`, không duy trì một lock cạnh tranh với Movie Service.

### A.6. Idempotency có chống được service sập không?

Không. Idempotency không làm service đang down hoạt động lại. Nó đảm bảo retry không tạo thêm hold/booking/payment.

Trường hợp Movie đã commit hold nhưng response bị mất, Booking retry cùng key và nhận lại hold cũ. Để chịu lỗi cần kết hợp:

- timeout;
- retry giới hạn bằng cùng idempotency key;
- circuit breaker;
- durable idempotency record;
- DB transaction;
- TTL;
- compensation/reconciliation;
- health check và nhiều instance khi triển khai production.

Nếu Movie Service không khả dụng sau retry, Booking không tạo order và trả:

```json
{ "code": 2014, "message": "INVENTORY_SERVICE_UNAVAILABLE" }
```

### A.7. Confirm inventory là gì?

Sau `PAYMENT_SUCCEEDED`, Booking Service gọi Movie Service confirm hold. Movie chuyển ghế `RESERVED -> SOLD`, gắn `bookingId` và cập nhật counter đúng một lần. Chỉ sau confirm thành công, Booking mới chuyển `CONFIRMED` và issue ticket.

Payment Service không gọi Movie Service trực tiếp. Nếu tiền đã thu nhưng hold expired/released, Booking tạo compensation/refund request.

### A.8. Release inventory là gì?

Booking gọi release khi create booking thất bại sau reserve, user hủy pending, payment fail hoặc booking expire. Movie chuyển `RESERVED -> AVAILABLE`. Release lặp lại phải trả cùng terminal result; không dùng release để đổi ghế `SOLD` về available.

### A.9. BK-P0-02 là gì?

Đây là orchestration của nút “Tiếp tục”:

1. Validate request/JWT.
2. Generate `bookingId/holdReference` và persist durable idempotency operation.
3. Gọi Movie reserve bằng stable reference.
4. Nhận showtime/seat/price snapshot.
5. Lưu booking/details `PENDING_PAYMENT`.
6. Nếu DB lỗi, release bằng `holdToken + holdReference`; nếu release lỗi, enqueue durable compensation.
7. Trả `bookingId`, amount và `expiresAt`.

Chưa charge tiền, chưa `SOLD` và chưa issue ticket ở bước này.

### A.10. Quy ước error contract

Không lập bảng lỗi rút gọn chỉ có endpoint. Test case lỗi đầy đủ nằm ngay dưới từng API:

- `BK-P0-01`: Booking client/mapping/retry cho reserve, confirm và release inventory.
- `BK-P0-02`: tạo online booking.
- `BK-P0-03`: đọc payment context, consume payment result và confirm booking.
- Các P1/P2: cancellation, ticket/check-in, employee operations, history, quote và reconciliation.

Mỗi test case phải chứa path/query, request body hoặc header gây lỗi, trạng thái dữ liệu tiền đề, HTTP status và error response.

Canonical error:

```json
{
  "code": 2011,
  "message": "SEATS_ALREADY_TAKEN",
  "result": { "unavailableShowtimeSeatIds": [902] }
}
```

Tất cả error response trong tài liệu dùng cùng envelope `code/message/result`; `result` có thể bỏ hoặc để `null` nếu lỗi không có chi tiết. Mỗi bảng lỗi phải ghi trực tiếp request, điều kiện gây lỗi, HTTP status và response; không dùng một danh sách lỗi chung cho nhiều API.

Các mã `2xxx` trong file là Booking-owned proposal. Mã `3xxx/4xxx` chỉ là external code Booking cần map từ Movie/Payment contract, không được định nghĩa lại trong `BookingErrorCode`. Trước khi code, cập nhật error-code registry chung để khóa dải và tránh trùng; việc chia dải là governance contract, không thay thế HTTP status hay invariant nghiệp vụ.

### A.11. Quy ước idempotency của Booking Service

- Scope unique: `callerScope + operation + idempotencyKey`.
- Canonicalize request rồi lưu hash; cùng key khác hash trả `409`.
- Operation state tối thiểu: `IN_PROGRESS`, `SUCCEEDED`, `FAILED_RETRYABLE`, `FAILED_TERMINAL`.
- Domain mutation và idempotency response được commit cùng local DB transaction khi có thể.
- Request trùng khi operation đang chạy không được khởi động orchestration thứ hai; trả operation reference/trạng thái hiện có.
- Stable downstream key được derive từ booking/operation, không generate key mới khi retry timeout.
- Retention phải dài hơn cửa sổ retry/payment/refund tương ứng và có cleanup job/audit policy.

### A.12. Namespace và authentication

| Namespace | Caller | Authentication/authorization | Gateway |
|---|---|---|---|
| `/api/bookings`, `/api/tickets` | Member/customer | User JWT + ownership policy | Public route |
| `/api/operations/**` | Employee/admin UI | User JWT + permission + cluster scope | Protected operation route |
| `/internal/**` | Service/worker | Service credential + allowlisted audience/scope | Không route public |

Không forward member JWT để giả service credential. Internal endpoint không dùng `permitAll`; admin endpoint không trả `UNAUTHORIZED_SERVICE` cho lỗi user permission.

---

## 9. Phụ lục B — Movie inventory contract Booking Service tiêu thụ

> Các endpoint trong phần này do Movie Service sở hữu và đã có owner khác. Booking Service chỉ implement client/orchestration theo contract; không tạo schema, scheduler hoặc controller Movie trong backlog này.

### B.1. Assumptions Booking cần từ contract

- Reserve selection all-or-nothing và trả authoritative showtime/seat/price snapshot.
- Movie quyết định TTL và trả `expiresAt`; Booking không gửi `ttlSeconds` tùy ý.
- Reserve/confirm/release hỗ trợ idempotency key và stable `holdReference`.
- Confirm chỉ cần inventory identity (`holdToken`, `bookingId`); Booking tự xác minh payment trước khi gọi.
- Release hỗ trợ `holdToken + holdReference` kể cả khi booking record chưa persist thành công.
- Service credential, timeout và error envelope được thống nhất giữa hai owner.

Nếu contract thực tế thiếu assumption nào, ghi integration blocker và trao đổi owner Movie Service; không tự thêm logic inventory vào Booking DB.

### B.2. Booking-side fields cần persist

```text
booking(booking_id, hold_reference, inventory_hold_token,
        inventory_status, expires_at, ...snapshot fields)
booking_operation(operation_id, booking_id, operation, idempotency_key,
                  request_hash, status, response_snapshot, expires_at)
compensation_task(task_id, booking_id, operation, target_service,
                  status, attempt_count, next_attempt_at, last_error)
```

### B.3. Internal API 1 — Reserve

```http
POST /internal/showtimes/55/inventory-reservations
Authorization: Bearer <booking-service-token>
Idempotency-Key: booking-create-5596bf9c
```

```json
{
  "holdReference": "booking-op-8f29",
  "ownerAccountId": "acc-001",
  "showtimeSeatIds": [901, 902]
}
```

Success response và seat/showtime snapshot đầy đủ được định nghĩa tại `BK-P0-01`.

Các request lỗi đầy đủ của reserve — gồm body/header cụ thể, trạng thái dữ liệu và response — được định nghĩa tại `BK-P0-01 / Internal API 1`; không lặp bảng lỗi rút gọn tại phụ lục.

```json
{
  "code": 3104,
  "message": "SEATS_NOT_AVAILABLE",
  "result": { "unavailableShowtimeSeatIds": [902] }
}
```

### B.4. Internal API 2 — Confirm

```http
POST /internal/inventory-confirmations
Idempotency-Key: confirm-booking-123
```

```json
{ "holdToken": "inventory-hold-123", "bookingId": "booking-123" }
```

Các request lỗi đầy đủ của confirm được định nghĩa tại `BK-P0-01 / Internal API 2`. Booking xử lý `HOLD_NOT_FOUND/MISMATCH` bằng reconciliation và xử lý hold expired/released bằng refund/compensation.

```json
{
  "code": 3111,
  "message": "HOLD_EXPIRED",
  "result": { "expiredAt": "2026-07-20T17:15:00+07:00" }
}
```

Confirm retry cùng hold/booking trả success cũ và không tăng `soldSeats` lần hai.

### B.5. Internal API 3 — Release

```http
POST /internal/inventory-releases
Idempotency-Key: release-booking-123
```

```json
{ "holdToken": "inventory-hold-123", "holdReference": "booking-123", "reason": "PAYMENT_EXPIRED" }
```

Các request lỗi đầy đủ của release được định nghĩa tại `BK-P0-01 / Internal API 3`; không lặp bảng lỗi rút gọn tại phụ lục.

Release một hold đã `RELEASED/EXPIRED` trả lại success state hiện tại.

### B.6. Invariants Booking dùng để viết contract test

- `expiresAt` lưu trong DB, không chỉ memory/Redis.
- Sau restart scheduler catch up expired holds.
- Reserve mới có thể reclaim expired seat atomically.
- Availability không báo locked cho reservation đã expired.
- Confirm/release đồng thời chỉ một terminal transition thắng.
- Release không thể đổi `SOLD -> AVAILABLE`.
- Hold token/reference/idempotency key có unique index.

---

## 10. Phụ lục C — Payment contract Booking Service tiêu thụ

> Payment Service/provider/refund ledger đã có owner khác. Phần này chỉ xác định input/output Booking cần cung cấp hoặc consume; không tạo backlog triển khai Payment Service.

### C.1. Quy tắc Confirm inventory

**Payment Service không gọi Movie Service và không tự confirm ghế.** Payment publish kết quả; Booking Service mới gọi Movie confirm.

```text
Payment Service -> PAYMENT_SUCCEEDED
Booking Service -> Movie confirm RESERVED -> SOLD
Movie success   -> Booking CONFIRMED + issue ticket
Movie failure   -> bookingStatus=CANCEL_REQUESTED, refundStatus=PENDING + request refund
```

Payment success không đồng nghĩa booking chắc chắn confirmed. Nếu hold expired sau khi thu tiền, Payment phải hỗ trợ refund idempotent.

### C.2. External reference — Create payment

```http
POST /api/payments
Authorization: Bearer <member-access-token>
Idempotency-Key: booking-123-payment-attempt-1
```

```json
{
  "bookingId": "booking-123",
  "paymentMethod": "VNPAY",
  "returnUrl": "https://app.example/bookings/booking-123"
}
```

```json
{
  "code": 1000,
  "result": {
    "paymentId": "payment-456",
    "bookingId": "booking-123",
    "status": "PENDING",
    "checkoutUrl": "https://provider.example/checkout/payment-456",
    "expiresAt": "2026-07-20T17:15:00+07:00"
  }
}
```

Contract/error của `/api/payments` do owner Payment Service quản lý. Booking chỉ cung cấp payment context authoritative và không nhận amount từ frontend.

Payment Service gọi `GET /internal/bookings/{bookingId}/payment-context` để lấy `accountId`, amount, currency và expiry authoritative. Frontend không gửi các field này.

### C.3. Normalized payment event Booking consume

Booking không nhận raw provider webhook và không verify provider-specific signature. Booking chỉ consume normalized authenticated event contract từ Payment Service:

```json
{
  "eventId": "evt-789",
  "eventType": "PAYMENT_SUCCEEDED",
  "eventVersion": 1,
  "paymentId": "payment-456",
  "bookingId": "booking-123",
  "amount": 240000,
  "currency": "VND",
  "paidAt": "2026-07-20T17:10:00+07:00",
  "occurredAt": "2026-07-20T17:10:02+07:00",
  "correlationId": "booking-123"
}
```

Booking lưu inbox unique theo `eventId`; duplicate event không chạy confirm/refund/ticket lần hai. Event amount/currency/booking không khớp snapshot được đưa vào reconciliation thay vì sửa booking theo payload.

### C.4. Consumed internal API — Refund/compensation

Endpoint dưới đây do Payment Service sở hữu. Booking chỉ implement typed client, idempotency, mapping và retry/reconciliation.

```http
POST /internal/payments/payment-456/refunds
Idempotency-Key: refund-booking-123-inventory-expired
```

```json
{
  "bookingId": "booking-123",
  "amount": 240000,
  "reason": "INVENTORY_CONFIRM_FAILED",
  "metadata": { "inventoryErrorCode": "HOLD_EXPIRED" }
}
```

```json
{
  "code": 1000,
  "result": {
    "refundId": "refund-001",
    "paymentId": "payment-456",
    "bookingId": "booking-123",
    "status": "REFUND_PENDING",
    "amount": 240000
  }
}
```

| Request cụ thể gây lỗi | Trạng thái/điều kiện dữ liệu | HTTP | Error response |
|---|---|---:|---|
| `POST /internal/payments/missing-payment/refunds`<br>`Body: {"bookingId":"booking-123","amount":240000,"reason":"INVENTORY_CONFIRM_FAILED"}` | Payment không tồn tại | 404 | `{"code":4120,"message":"PAYMENT_NOT_FOUND"}` |
| `POST /internal/payments/payment-failed/refunds`<br>`Body: {"bookingId":"booking-123","amount":240000,"reason":"INVENTORY_CONFIRM_FAILED"}` | Payment chưa từng `SUCCEEDED` | 409 | `{"code":4121,"message":"PAYMENT_NOT_REFUNDABLE"}` |
| `POST /internal/payments/payment-456/refunds`<br>`Body: {"bookingId":"booking-123","amount":300000,"reason":"INVENTORY_CONFIRM_FAILED"}` | Chỉ còn `240000` có thể refund | 400 | `{"code":4122,"message":"REFUND_AMOUNT_EXCEEDS_PAID_AMOUNT"}` |
| `POST /internal/payments/payment-456/refunds`<br>`Body: {"bookingId":"booking-123","amount":240000,"reason":"INVENTORY_CONFIRM_FAILED"}` | Refund tương ứng đã `COMPLETED` | 409 | `{"code":4123,"message":"REFUND_ALREADY_COMPLETED"}` |
| `POST /internal/payments/payment-456/refunds`<br>`Idempotency-Key: refund-key-1`<br>`Body lần đầu: {"amount":240000}`<br>`Body retry: {"amount":120000}` | Cùng key nhưng request hash khác | 409 | `{"code":4102,"message":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"}` |
| `POST /internal/payments/payment-456/refunds`<br>`Body: {"bookingId":"booking-123","amount":240000,"reason":"INVENTORY_CONFIRM_FAILED"}` | Provider refund unavailable | 502 | `{"code":4124,"message":"REFUND_PROVIDER_UNAVAILABLE"}` |
| `POST /internal/payments/payment-456/refunds`<br>`Authorization: Bearer invalid-token`<br>`Body: {"bookingId":"booking-123","amount":240000,"reason":"INVENTORY_CONFIRM_FAILED"}` | Caller không phải Booking Service | 403 | `{"code":4106,"message":"UNAUTHORIZED_SERVICE"}` |

### C.5. Booking-side reliability requirements

- Booking payment context trả owner, amount, currency, state và expiry authoritative; chỉ service credential hợp lệ được gọi.
- Booking inbox/dedup theo `eventId`; consumer transition dùng conditional update/version.
- Không log raw payment payload, token, signature hoặc provider secret.
- Payment timeout/mất event giữ `bookingStatus=PENDING_PAYMENT`, `paymentStatus=UNKNOWN` và được query/reconcile; không tự coi là failed.
- Late payment success sau booking expiry giữ booking terminal, đặt `refundStatus=PENDING` và gọi refund bằng stable idempotency key.
- Refund timeout giữ `refundStatus=PENDING/UNKNOWN`; retry/query cùng key, không tạo refund mới bằng key khác.

---

## 11. Phụ lục D — Failure matrix xuyên service

| Failure point | Booking result | Inventory action | Payment/response |
|---|---|---|---|
| Reserve rejected | Không tạo booking | Rollback toàn selection | 400/409 |
| Movie timeout trước commit | Không tạo booking | Retry cùng key | 503 nếu hết retry |
| Movie commit nhưng mất response | Chưa tạo booking | Retry trả hold cũ | Tiếp tục khi phục hồi |
| Booking DB fail sau reserve | Không có booking hoàn chỉnh | Release/enqueue compensation | 500 |
| Payment fail | `bookingStatus=PENDING_PAYMENT`, `paymentStatus=FAILED` | Release | Failure event |
| Payment/provider timeout chưa rõ kết quả | `bookingStatus=PENDING_PAYMENT`, `paymentStatus=UNKNOWN` | Giữ hold tới expiry; query/reconcile | Không tự coi failed, không tạo payment/key mới |
| Hold/booking expire | `bookingStatus=EXPIRED` | Release/reclaim | Không cho payment mới |
| Payment success + confirm success | `bookingStatus=CONFIRMED`, `paymentStatus=SUCCEEDED` | `SOLD` | Issue ticket |
| Payment success + hold expired | booking terminal, `refundStatus=PENDING` | Không chiếm ghế khác | Refund/ops case |
| Confirm timeout sau payment | `bookingStatus=CONFIRM_PENDING`, `paymentStatus=SUCCEEDED` | Retry cùng key/query state | Chưa issue ticket |
| Movie đã `SOLD`, Booking DB/ticket commit fail | `bookingStatus=CONFIRM_PENDING`, `inventoryStatus=SOLD` | Không release `SOLD`; forward-recover | Retry local commit/query inventory; reconciliation nếu kẹt |
| Refund provider timeout | `refundStatus=PENDING/UNKNOWN` | Không đổi SOLD tùy policy | Retry/reconcile |
