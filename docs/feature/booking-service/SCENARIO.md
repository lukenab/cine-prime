# SCENARIO.md

## 1. Mục đích

Tài liệu này tổng hợp các scenario nghiệp vụ của Booking Service để Product Owner, Backend, Frontend và QA dùng chung khi phân tích, triển khai và kiểm thử.

Các tài liệu nguồn đã đọc:

* `docs/feature/booking-service/BOOKING_SERVICE_PRODUCT_ISSUES.md`
* `docs/feature/booking-service/FEATURE_BRIEF.md`
* `docs/feature/booking-service/BUSINESS_RULES.md`
* `docs/feature/booking-service/API_LIST.md`
* `docs/feature/booking-service/DEMO_SCRIPT.md`

> Các scenario mô tả target design trong backlog. Scenario chỉ được coi là chạy được khi issue/API/contract tương ứng đã được triển khai.

## 2. Phạm vi và mức ưu tiên

| Priority | Phạm vi |
|---|---|
| P0 | Tạo booking online, giữ ghế, payment result, confirm inventory, expiry, compensation và concurrency |
| P1 | Cancellation/refund, ticket QR/check-in, lịch sử, employee operations, counter sale, reconciliation và outbox |
| P2 | Promotion, loyalty, concession, observability và abuse control |

## 3. Actors và ownership

| Actor / Service | Trách nhiệm |
|---|---|
| `MEMBER` | Tạo, thanh toán, xem và hủy booking của mình; lấy QR ticket |
| `EMPLOYEE` | Tra cứu booking theo cluster, bán vé tại quầy và check-in theo permission |
| `ADMIN/OPERATOR` | Override cancellation, theo dõi và retry reconciliation theo policy |
| Booking Service | Sở hữu booking/order, snapshot, state machine, ticket, orchestration, inbox/outbox và compensation |
| Movie Service | Sở hữu showtime, seat inventory, price, hold TTL và trạng thái `AVAILABLE/RESERVED/SOLD` |
| Payment Service | Sở hữu payment/refund ledger, provider integration và kết quả thanh toán authoritative |
| User Service | Sở hữu member và loyalty balance |
| Promotion Service | Sở hữu promotion rule/quota |
| Notification Service | Nhận booking event và thực hiện email/SMS/push |

## 4. Dữ liệu dùng chung cho scenario

| Dữ liệu | Giá trị mẫu |
|---|---|
| Member chính | `acc-001` |
| Member cạnh tranh | `acc-002` |
| Showtime | `55`, đang mở bán, chưa qua cutoff |
| Cluster | `cluster-q1` — CinePrime Quận 1 |
| Room | Phòng IMAX 1 |
| Seat 1 | `showtimeSeatId=901`, code `G7`, type `VIP`, giá `120000 VND` |
| Seat 2 | `showtimeSeatId=902`, code `G8`, type `VIP`, giá `120000 VND` |
| Employee đúng scope | `emp-q1`, có cluster `cluster-q1` |
| Gate đúng scope | `Q1-GATE-02` |
| POS đúng scope | `Q1-POS-03` |

## 5. State model dùng trong scenario

| Dimension | Trạng thái chính |
|---|---|
| Booking | `PENDING_PAYMENT`, `CONFIRM_PENDING`, `CONFIRMED`, `CANCEL_REQUESTED`, `CANCELLED`, `EXPIRED` |
| Payment | `NOT_STARTED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| Refund | `NOT_REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| Inventory | `HELD`, `RELEASE_PENDING`, `RELEASED`, `CONFIRM_PENDING`, `SOLD`, `CANCEL_SALE_PENDING`, `CANCELLED` |
| Cancellation | `REQUESTED`, `PROCESSING`, `COMPLETED`, `FAILED`, `MANUAL_REVIEW` |
| Ticket | `VALID`, `USED`, `CANCELLED` |

## 6. SC-01 — Đặt vé online thành công (P0)

### Given

* Member `acc-001` đã đăng nhập.
* Showtime `55` đang mở bán và ghế `901`, `902` đang `AVAILABLE`.
* Member chưa vượt giới hạn active hold.

### When

1. Member gọi `POST /api/bookings` với `Idempotency-Key: booking-create-001`:

   ```json
   {
     "showtimeId": 55,
     "showtimeSeatIds": [901, 902]
   }
   ```

2. Booking Service lấy `accountId` từ JWT và tạo durable booking operation.
3. Booking Service gọi Movie Service reserve toàn bộ selection.
4. Movie Service trả hold token, expiry và authoritative showtime/seat/price snapshot.
5. Booking Service lưu booking `PENDING_PAYMENT`.
6. Member tạo payment tại Payment Service bằng `bookingId`.
7. Payment Service đọc `GET /internal/bookings/{bookingId}/payment-context`.
8. Booking Service nhận authenticated event `PAYMENT_SUCCEEDED`.
9. Booking Service gọi Movie Service confirm hold.
10. Movie Service chuyển hai ghế `RESERVED -> SOLD`.
11. Booking Service chuyển booking thành `CONFIRMED`, phát hành ticket và ghi outbox event.

### Then

* Chỉ có một booking và một inventory hold.
* Booking snapshot có movie, cluster, room, showtime, seat và giá authoritative.
* `totalAmount=240000`, `finalAmount=240000`, currency `VND`.
* Booking lần lượt đi qua `PENDING_PAYMENT -> CONFIRM_PENDING -> CONFIRMED`.
* Payment là `SUCCEEDED`, inventory là `SOLD`.
* Có đúng một ticket cho mỗi booking item.
* Có outbox `BOOKING_PENDING_PAYMENT`, `BOOKING_CONFIRMED` và `TICKET_ISSUED` theo bước commit tương ứng.
* Public response/log không chứa raw inventory hold token.

## 7. Booking creation scenarios (P0)

### SC-02 — Retry cùng idempotency key và cùng payload

**Given:** `SC-01` đã tạo booking bằng key `booking-create-001`.  
**When:** Member gửi lại cùng key và cùng body.  
**Then:** Trả cùng booking/result; không reserve, persist hoặc publish lần hai.

### SC-03 — Tái sử dụng idempotency key với payload khác

**Given:** Key `booking-create-001` đã dùng cho ghế `[901,902]`.  
**When:** Member gửi cùng key nhưng body có ghế `[901]`.  
**Then:** HTTP `409`, error `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`; không có mutation mới.

### SC-04 — Danh sách ghế không hợp lệ

**Given:** Member đã đăng nhập.  
**When:** Gọi create booking với danh sách rỗng, trùng seat ID hoặc ghế không thuộc showtime.  
**Then:** HTTP `400`, `INVALID_SEAT_SELECTION`; không gọi reserve inventory.

### SC-05 — Showtime không thể bán

**Given:** Showtime đã hủy, chưa mở bán, đã bắt đầu hoặc qua cutoff.  
**When:** Member tạo booking.  
**Then:** HTTP `400`, `SHOWTIME_NOT_AVAILABLE`; không tạo booking/hold.

### SC-06 — Hai member giữ cùng ghế đồng thời

**Given:** Ghế `901` đang `AVAILABLE`.  
**When:** `acc-001` và `acc-002` đồng thời tạo booking cho ghế `901` bằng hai key khác nhau.  
**Then:** Đúng một request thành công; request còn lại nhận `409 SEATS_ALREADY_TAKEN`; không có partial hold hoặc double-booking.

### SC-07 — Một ghế trong selection đã bận

**Given:** Ghế `901` available nhưng `902` đã `RESERVED/SOLD`.  
**When:** Member chọn `[901,902]`.  
**Then:** Toàn bộ reserve rollback; `901` vẫn available; response `409` chứa `unavailableShowtimeSeatIds=[902]`.

### SC-08 — Vượt active hold limit

**Given:** Member đã đạt số booking/hold active tối đa.  
**When:** Member tạo booking mới.  
**Then:** HTTP `429 ACTIVE_HOLD_LIMIT_EXCEEDED`; không tạo hold mới.

### SC-09 — Movie Service unavailable

**Given:** Inventory API timeout/unavailable.  
**When:** Booking Service reserve và bounded retry bằng cùng downstream key nhưng vẫn thất bại.  
**Then:** Không tạo booking hoàn chỉnh; trả `503 INVENTORY_SERVICE_UNAVAILABLE`; operation được lưu ở trạng thái retryable/terminal phù hợp.

### SC-10 — Movie đã reserve nhưng response bị mất

**Given:** Movie Service đã commit hold nhưng response timeout.  
**When:** Booking Service retry bằng cùng hold reference và idempotency key.  
**Then:** Movie trả hold cũ; Booking tiếp tục tạo đúng một `PENDING_PAYMENT`.

### SC-11 — Booking DB lỗi sau khi reserve

**Given:** Reserve thành công nhưng local transaction tạo booking thất bại.  
**When:** Booking Service xử lý lỗi.  
**Then:** Gọi release bằng hold token/reference; nếu release timeout thì tạo durable compensation task; không để lỗi chỉ tồn tại trong log.

## 8. Payment và confirmation scenarios (P0)

### SC-12 — Payment Service đọc context hợp lệ

**Given:** Booking là `PENDING_PAYMENT` và chưa hết hạn.  
**When:** Payment Service gọi internal payment-context bằng service credential hợp lệ.  
**Then:** Trả đúng owner, amount, currency và expiry từ snapshot; không lấy amount từ frontend.

### SC-13 — Payment context bị từ chối

| Điều kiện | Kết quả |
|---|---|
| Booking không tồn tại | `404 BOOKING_NOT_FOUND` |
| Booking đã confirmed/cancelled, không còn payable | `409 BOOKING_NOT_PAYABLE` |
| Booking đã hết hạn | `410 BOOKING_EXPIRED` |
| Caller không phải Payment Service | `403 PAYMENT_CONTEXT_FORBIDDEN` |

### SC-14 — Duplicate payment success event

**Given:** `PAYMENT_SUCCEEDED` đã được xử lý thành công.  
**When:** Cùng `eventId` hoặc cùng provider event được gửi lại.  
**Then:** Inbox deduplicate; không confirm inventory, issue ticket hoặc publish domain event lần hai.

### SC-15 — Payment event không khớp snapshot

**Given:** Event có booking ID, amount, currency hoặc payment reference không khớp.  
**When:** Booking consume event.  
**Then:** Không sửa booking theo payload; ghi inbox/audit và tạo reconciliation case.

### SC-16 — Payment failed

**Given:** Booking đang `PENDING_PAYMENT`, inventory `HELD`.  
**When:** Nhận `PAYMENT_FAILED` authoritative.  
**Then:** Cập nhật payment `FAILED`, release hold/resources đúng một lần và kết thúc booking theo cancel/expiry policy; không issue ticket.

### SC-17 — Payment timeout/chưa rõ kết quả

**Given:** Provider/network timeout và chưa có kết quả authoritative.  
**When:** Booking cập nhật trạng thái payment.  
**Then:** Giữ `paymentStatus=UNKNOWN`, không tự coi là failed, không tạo payment/key mới; query/reconcile bằng reference hiện tại.

### SC-18 — Confirm inventory timeout sau payment success

**Given:** Payment đã `SUCCEEDED`; Movie confirm timeout hoặc mất response.  
**When:** Booking xử lý event.  
**Then:** Giữ `CONFIRM_PENDING`, chưa issue ticket; retry/query bằng cùng key. Nếu Movie đã `SOLD`, forward-recover local state và không release ghế.

### SC-19 — Payment success nhưng hold đã hết hạn/released

**Given:** Payment success authoritative nhưng hold không còn confirm được.  
**When:** Movie trả `HOLD_EXPIRED/HOLD_ALREADY_RELEASED`.  
**Then:** Không chiếm ghế khác; không issue ticket; đặt refund pending và tạo refund/reconciliation bằng stable key.

## 9. Expiry và late-payment scenarios (P0)

### SC-20 — Booking hết hạn khi chưa thanh toán

**Given:** Booking `PENDING_PAYMENT` đã đến `expiresAt`, chưa có payment success.  
**When:** Expiry scheduler claim booking.  
**Then:** Conditional transition sang `EXPIRED`, release hold đúng một lần và publish `BOOKING_EXPIRED`.

### SC-21 — Scheduler chạy lặp/nhiều instance

**Given:** Một booking hết hạn được nhiều worker nhìn thấy.  
**When:** Các worker đồng thời claim/process.  
**Then:** Chỉ một transition thắng; release/outbox không trùng; worker còn lại nhận terminal state hiện có.

### SC-22 — Payment success thắng race với expiry

**Given:** Payment success event và expiry worker chạy đồng thời.  
**When:** Payment conditional transition thắng trước.  
**Then:** Booking sang `CONFIRM_PENDING`; expiry không release hold; flow tiếp tục confirm inventory.

### SC-23 — Expiry thắng race, payment đến muộn

**Given:** Expiry transition/release đã commit trước khi `PAYMENT_SUCCEEDED` đến.  
**When:** Booking consume late success.  
**Then:** Không revive booking, không reserve ghế thay thế, không issue ticket; xác minh event rồi tạo refund/reconciliation; booking giữ terminal `EXPIRED`.

### SC-24 — Booking ở `CONFIRM_PENDING` qua `expiresAt`

**Given:** Payment success đã được ghi nhận nhưng confirm chưa chắc chắn.  
**When:** Expiry scheduler chạy.  
**Then:** Không chuyển booking thành `EXPIRED`; confirm worker tiếp tục retry/query hoặc mở reconciliation.

## 10. Cancellation và refund scenarios (P1)

### SC-25 — Customer hủy trước thanh toán

**Given:** Booking `PENDING_PAYMENT`, provider chưa xử lý payment.  
**When:** Owner gọi `POST /api/bookings/{bookingId}/cancellations` với reason và idempotency key.  
**Then:** Chặn payment context, release hold/resource reservations, trả `201`; booking `CANCELLED`, refund `NOT_REQUESTED`, inventory `RELEASED`.

### SC-26 — Customer hủy khi payment `FAILED`

**Given:** Payment đã thất bại authoritative.  
**When:** Owner hủy booking.  
**Then:** Release idempotent nếu cần, hoàn tất `CANCELLED`; không gửi refund.

### SC-27 — Customer hủy khi payment `UNKNOWN/PROCESSING`

**Given:** Kết quả payment chưa rõ.  
**When:** Owner tạo cancellation.  
**Then:** Trả `202`, booking `CANCEL_REQUESTED`; chưa release hold; query/reconcile Payment. Failure dẫn tới release/cancel, success dẫn tới refund workflow.

### SC-28 — Customer hủy khi booking `CONFIRM_PENDING`

**Given:** Payment success nhưng trạng thái inventory confirm chưa rõ.  
**When:** Owner tạo cancellation hợp lệ.  
**Then:** Serialize cancellation với confirm và query inventory. Chưa `SOLD` thì refund/release; đã `SOLD` thì refund/cancel-sale; không release ghế `SOLD`.

### SC-29 — Customer hủy booking confirmed

**Given:** Booking `CONFIRMED`, trong cutoff, tất cả ticket `VALID` và policy cho phép refund.  
**When:** Owner tạo cancellation.  
**Then:** Trả `202`; request refund bằng amount tính từ snapshot. Sau `REFUND_SUCCEEDED`, gọi cancel-sale theo policy, cancel ticket, revoke QR và chuyển cancellation `COMPLETED`, booking `CANCELLED`.

### SC-30 — Hủy sau cutoff

**Given:** Booking confirmed nhưng đã qua customer cancellation cutoff.  
**When:** Owner yêu cầu hủy.  
**Then:** HTTP `409 CANCELLATION_CUTOFF_PASSED`; không tạo refund/cancel-sale.

### SC-31 — Hủy booking đã check-in

**Given:** Ít nhất một ticket là `USED`.  
**When:** Owner yêu cầu hủy toàn booking.  
**Then:** HTTP `409 TICKET_ALREADY_USED`; không auto-refund/cancel-sale; operation override chỉ được đưa vào manual review theo policy.

### SC-32 — Yêu cầu hủy một phần

**Given:** MVP chưa hỗ trợ partial cancellation.  
**When:** Client chỉ định một số ticket/item cần hủy.  
**Then:** HTTP `409 PARTIAL_CANCELLATION_NOT_SUPPORTED`.

### SC-33 — Hủy booking đã expired

**Given:** Booking đã `EXPIRED`.  
**When:** Owner gửi cancellation.  
**Then:** Trả terminal state hiện có; không tạo cancellation, refund hoặc release mới.

### SC-34 — Hai cancellation đồng thời

**Given:** Chưa có active cancellation.  
**When:** Hai request cùng/khác idempotency key đến đồng thời.  
**Then:** Unique active workflow đảm bảo chỉ một cancellation/refund; cùng intent nhận cùng resource, key cùng nhưng payload khác nhận `409`.

### SC-35 — Showtime bị hủy

**Given:** Movie Service phát authenticated `SHOWTIME_CANCELLED`.  
**When:** Booking consume event.  
**Then:** Deduplicate theo `eventId`, tìm từng active booking và tạo cancellation bằng stable key; cinema policy có thể override customer cutoff; một booking lỗi không rollback toàn batch.

### SC-36 — Staff/admin override cancellation

**Given:** Operator có `BOOKING_CANCEL_OVERRIDE` và đúng cluster.  
**When:** Gọi `POST /api/operations/bookings/{bookingId}/cancellations` với reason bắt buộc.  
**Then:** Server quyết định override theo policy; lưu actor, reason, before/after và correlation ID. Caller thiếu quyền/sai cluster nhận `403`.

### SC-37 — Refund timeout

**Given:** Cancellation đã persist và Payment refund request timeout.  
**When:** Chưa có authoritative refund result.  
**Then:** Giữ `refundStatus=PENDING/UNKNOWN`, cancellation `PROCESSING`, API status `202`; retry/query cùng key; không báo hoàn tất và không tạo refund mới.

### SC-38 — Refund failed

**Given:** Payment Service trả `REFUND_FAILED` authoritative.  
**When:** Booking xử lý event.  
**Then:** Ghi `refundStatus=FAILED`; retry nếu retryable hoặc chuyển `MANUAL_REVIEW`; không che giấu lỗi bằng `CANCELLED/COMPLETED` giả.

### SC-39 — Duplicate refund success

**Given:** Refund đã success và workflow đã tiếp tục cancel-sale.  
**When:** Callback/event success gửi lặp.  
**Then:** Inbox deduplicate; không refund, cancel-sale, revoke QR hoặc publish `REFUND_COMPLETED` lần hai.

## 11. Ticket và check-in scenarios (P1)

### SC-40 — Owner lấy QR ticket pass

**Given:** Booking `CONFIRMED`, ticket `VALID`.  
**When:** Owner gọi `GET /api/bookings/{bookingId}/ticket-pass`.  
**Then:** Trả một opaque QR token cho booking và danh sách ticket; không chứa PII/price/permission trong token; raw token không xuất hiện trong log.

### SC-41 — Không được lấy ticket pass

| Điều kiện | Kết quả |
|---|---|
| Booking không tồn tại hoặc thuộc member khác | `404 BOOKING_NOT_FOUND` |
| Booking chưa confirmed | `409 BOOKING_NOT_CONFIRMED` |
| Booking đã cancel/refund và QR revoked | `410 TICKET_PASS_REVOKED` |

### SC-42 — Check-in toàn bộ ticket

**Given:** QR hợp lệ, employee/gate đúng cluster và đang trong check-in window.  
**When:** Gọi `POST /api/ticket-check-ins` với `checkInMode=ALL`.  
**Then:** Atomically chuyển mọi ticket `VALID -> USED`, lưu actor/gate/time audit.

### SC-43 — Check-in một phần ticket

**Given:** Booking có G7 và G8 đều `VALID`.  
**When:** Gọi check-in `SELECTED` với ticket G7.  
**Then:** G7 thành `USED`, G8 vẫn `VALID`; ticket ID ngoài booking bị `TICKET_NOT_IN_BOOKING`.

### SC-44 — Scan QR lặp

**Given:** Ticket đã check-in.  
**When:** Scan lại cùng key/request.  
**Then:** Trả trạng thái và `checkedInAt` cũ; không tạo side effect/audit nghiệp vụ lần hai.

### SC-45 — Check-in bị từ chối

| Điều kiện | Kết quả |
|---|---|
| Token sai/không tồn tại | `400 INVALID_QR_TOKEN` |
| Token đã revoke | `410 QR_TOKEN_REVOKED` |
| Gate/employee sai cluster | `403 WRONG_CINEMA_SCOPE` |
| Quá sớm | `409 CHECK_IN_TOO_EARLY` |
| Cửa sổ đã đóng | `409 CHECK_IN_WINDOW_CLOSED` |
| Ticket đã cancel | `409 TICKET_CANCELLED` |

### SC-46 — Cancel và check-in đồng thời

**Given:** Ticket đang `VALID`, cancellation và check-in đến đồng thời.  
**When:** Hai transaction cạnh tranh bằng conditional update.  
**Then:** Check-in thắng thì customer cancel nhận `TICKET_ALREADY_USED`; cancel thắng thì check-in nhận `TICKET_CANCELLED/QR_TOKEN_REVOKED`.

## 12. Customer history scenarios (P1)

### SC-47 — Member xem lịch sử

**Given:** Member có upcoming, past, expired và cancelled booking.  
**When:** Gọi `GET /api/bookings?scope=SELF&view=UPCOMING&status=&page=0&size=10`.  
**Then:** Chỉ trả booking của member, sort `createdAt DESC`, pagination đúng và action flags do backend tính.

### SC-48 — Member xem chi tiết

**Given:** Booking thuộc member.  
**When:** Gọi `GET /api/bookings/{bookingId}`.  
**Then:** Trả immutable movie/cluster/room/showtime/seat/price/payment/refund/ticket snapshot mà không cần gọi Movie Service để dựng lịch sử.

### SC-49 — Chống lộ booking người khác

**Given:** Booking thuộc `acc-002`.  
**When:** `acc-001` đọc detail/ticket/cancellation.  
**Then:** Trả cùng dạng `404 BOOKING_NOT_FOUND` như booking không tồn tại.

## 13. Employee và operation scenarios (P1/P2)

### SC-50 — Employee tra cứu booking đúng cluster

**Given:** `emp-q1` được phân công cluster Q1.  
**When:** Gọi `GET /api/bookings?scope=CLUSTER...`.  
**Then:** Chỉ trả booking thuộc cluster Q1, filter/pagination hợp lệ và PII được giảm thiểu.

### SC-51 — Employee vượt cluster scope

**Given:** Booking/showtime thuộc cluster khác.  
**When:** Employee query hoặc thao tác booking.  
**Then:** HTTP `403 EMPLOYEE_OUTSIDE_CLUSTER_SCOPE`; không tin `clusterId` client tự gửi.

### SC-52 — Bán vé tại quầy

**Given:** Employee, terminal và showtime cùng cluster; ghế available; payment method tại quầy hợp lệ.  
**When:** Employee gọi `POST /api/bookings` với `bookingType=COUNTER`.  
**Then:** Reserve/confirm inventory bằng cùng state machine online; lưu cashier, terminal, immutable payment ledger và receipt; trả booking confirmed/ticket. Không cho controller đặt thẳng `PAID/CONFIRMED`.

### SC-53 — Counter sale lỗi sau khi thu tiền

**Given:** Tiền đã được ghi nhận nhưng inventory confirm thất bại/chưa rõ.  
**When:** Counter orchestration xử lý lỗi.  
**Then:** Không trả success giả; chuyển reconciliation/refund state và giữ đầy đủ audit.

### SC-54 — Tạo reconciliation case

**Given:** Booking/payment/inventory thực sự mismatch và operator đúng scope.  
**When:** Gọi `POST /api/booking-reconciliations`.  
**Then:** Tạo một case `OPEN` với evidence/audit; controller không trực tiếp confirm/refund/unsell; duplicate key không tạo case thứ hai.

### SC-55 — Retry reconciliation an toàn

**Given:** Case `OPEN` có rule cho phép auto retry.  
**When:** Operator gọi `POST /api/operations/booking-reconciliation-attempts`.  
**Then:** Tạo attempt `QUEUED`; case resolved/manual-only hoặc caller thiếu quyền bị từ chối; mọi action có before/after audit.

## 14. P2 commercial scenarios

### SC-56 — Tạo quote có promotion

**Given:** Promotion hợp lệ cho member/showtime/cluster/channel.  
**When:** Member gọi `POST /api/booking-quotes`.  
**Then:** Trả line item, subtotal, discount, final amount và quote expiry; quote chưa giữ ghế.

### SC-57 — Tạo booking từ quote

**Given:** Quote còn hạn, đúng owner và ghế vẫn available.  
**When:** Member gọi `POST /api/bookings` với `quoteId`.  
**Then:** Reserve inventory và promotion quota idempotently, tạo `PENDING_PAYMENT` với pricing snapshot. Quote hết hạn/sai owner/ghế bận bị từ chối.

### SC-58 — Loyalty lifecycle

**Given:** Member dùng điểm trong giới hạn policy.  
**When:** Booking đi qua payment lifecycle.  
**Then:** Reserve điểm trước payment; confirmed thì commit; fail/expire/cancel thì release; Booking không tự sửa loyalty balance.

### SC-59 — Concession lifecycle

**Given:** SKU bán được tại đúng cluster/showtime và còn stock.  
**When:** Member thêm concession vào quote/booking.  
**Then:** Lưu line-item snapshot; reserve/commit/release stock idempotently theo kết quả booking.

## 15. Security scenarios

### SC-60 — Namespace đúng loại caller

| Namespace | Caller hợp lệ | Kết quả khi sai caller |
|---|---|---|
| `/api/bookings`, `/api/tickets` | User JWT + ownership | `401/403/404` theo policy, không lộ resource |
| `/api/operations/**` | Employee/admin JWT + permission + cluster scope | Member bị `403` |
| `/internal/**` | Service credential đúng audience/scope | User token/invalid service token bị `403` |

### SC-61 — Dữ liệu nhạy cảm không bị lộ

**Given:** Booking/payment/ticket operations được thực thi.  
**When:** Kiểm tra response, structured log, audit và event payload.  
**Then:** Không có raw hold token, raw QR token, card data, provider secret/signature hoặc PII không cần thiết.

## 16. Reliability và observability scenarios

### SC-62 — Service restart giữa workflow

**Given:** Process dừng sau một bước external/local đã commit.  
**When:** Booking Service khởi động lại.  
**Then:** Worker claim durable operation/task/inbox/outbox và tiếp tục đúng bước; không tạo side effect lặp.

### SC-63 — Kafka/Notification unavailable

**Given:** Booking transaction thành công nhưng Kafka/Notification tạm lỗi.  
**When:** Outbox publisher gửi event.  
**Then:** Booking transaction không rollback; outbox giữ pending/failed state, retry/backoff và có metric/operation replay.

### SC-64 — Metrics và cảnh báo

**Given:** Có hold conflict, expired hold, late payment, refund failure, outbox lag hoặc duplicate scan.  
**When:** Hệ thống xử lý.  
**Then:** Metric/log có correlation ID và reference đã mask; cảnh báo được phát cho stuck workflow/scheduler/reconciliation theo threshold.

## 17. Acceptance checklist tổng

* [ ] Movie Service là nguồn seat inventory duy nhất; Booking Service không có competing authoritative lock.
* [ ] Giá, showtime và seat metadata được snapshot từ authoritative response.
* [ ] Mọi mutation/retry/event đều idempotent và lưu request hash hoặc event ID phù hợp.
* [ ] Hai account giữ cùng ghế chỉ có một người thắng.
* [ ] Payment success không đồng nghĩa booking confirmed trước inventory `SOLD`.
* [ ] Timeout được giữ ở trạng thái chưa xác định và có retry/query/reconciliation.
* [ ] Expiry release hold đúng một lần; late payment không revive booking.
* [ ] Ghế `SOLD` không được xử lý bằng release; cancellation dùng cancel-sale contract.
* [ ] Refund/cancel/check-in không tạo side effect trùng khi callback/request lặp.
* [ ] Ticket chỉ được phát hành sau confirmation và bị revoke khi cancellation hoàn tất.
* [ ] Member ownership, employee cluster scope và service credential được kiểm tra.
* [ ] Transaction snapshot đủ để đọc lịch sử mà không phụ thuộc dữ liệu catalog hiện tại.
* [ ] Partial failure có durable compensation, forward recovery hoặc reconciliation.
* [ ] Outbox/inbox/scheduler resume được sau restart và an toàn nhiều instance.

## 18. Các quyết định còn cần chốt

* Cancellation cutoff, refund fee/method/SLA và policy cho cinema/showtime cancellation.
* Có cho phép reopen ghế sau cancel-sale hay không và Movie Service contract tương ứng.
* Active hold limit, booking/payment timeout, scheduler interval và retry/backoff.
* Permission/cluster scope cho employee/admin, trusted gate và terminal registry.
* Chính sách partial cancellation trong phase sau MVP.
* Promotion/loyalty/concession compensation và refund allocation.
* Error-code registry chung, event schema/versioning và retention cho idempotency/inbox/outbox/audit/PII.
