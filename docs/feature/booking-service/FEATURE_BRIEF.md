# FEATURE_BRIEF.md

## 1. Source Document Reviewed

* `docs/feature/booking-service/BOOKING_SERVICE_PRODUCT_ISSUES.md`

> Tài liệu nguồn là product-oriented backlog đề xuất ngày 20/07/2026, không phải mô tả implementation hiện tại. Các capability, API và trạng thái dưới đây là target design cần được triển khai và kiểm chứng theo thứ tự P0 → P1 → P2.

## 2. Assumptions / Missing Information

* Movie Service là nguồn tồn kho ghế có thẩm quyền duy nhất và phải cung cấp reserve/confirm/release idempotent.
* Payment Service sở hữu payment/refund ledger; Booking Service chỉ cung cấp payment context, nhận kết quả chuẩn hóa và điều phối bước tiếp theo.
* User, Promotion, Concession và Notification Service đã có owner khác; Booking Service chỉ lưu snapshot/reference và gọi contract tương ứng.
* Chính sách hủy/hoàn, cutoff, giới hạn giữ ghế, tỷ lệ dùng điểm và quyền theo cluster vẫn cần Product Owner/Leader chốt trước khi triển khai đầy đủ.
* Tên controller/handler Java chưa được khẳng định vì tài liệu nguồn là backlog, không phải source-code inventory.

## 3. Online Booking & Seat Reservation (P0)

### Purpose

Cho phép member chọn một suất chiếu và danh sách ghế, giữ toàn bộ ghế atomically rồi tạo order chờ thanh toán bằng một thao tác duy nhất.

### Actors / Roles

* **MEMBER**: Tạo booking online và chỉ thao tác trên booking của chính mình.
* **Booking Service**: Điều phối, lưu order/snapshot/idempotency và compensation.
* **Movie Service**: Quyết định ghế có thể bán, giá, TTL và trạng thái `AVAILABLE/RESERVED/SOLD`.

### Current Target Flow

1. Member gọi `POST /api/bookings` với `showtimeId`, `showtimeSeatIds` và `Idempotency-Key`.
2. Booking Service lấy `accountId` từ JWT, tạo trước `bookingId/holdReference` và durable operation.
3. Booking Service gọi Movie Service reserve toàn bộ lựa chọn.
4. Movie Service trả authoritative showtime/seat/price snapshot, `holdToken` và `expiresAt`.
5. Booking Service lưu booking `PENDING_PAYMENT`; không đánh dấu ghế `SOLD` tại bước này.
6. Nếu lưu DB thất bại sau reserve, Booking Service release hold; nếu release lỗi thì tạo durable compensation task.

### Main Entity Fields

* Booking identity: `bookingId`, `bookingCode`, `bookingType`, `accountId`.
* Inventory orchestration: `holdReference`, `inventoryHoldToken`, `inventoryStatus`, `expiresAt`.
* Snapshot: movie, cluster, room, showtime, seat code/type và unit price.
* Amount: `totalAmount`, `discountAmount`, `finalAmount`, `currency`.
* Reliability: `idempotencyKey`, canonical request hash, operation state và response snapshot.

### Key Rules

* Frontend không gửi movie/cinema/price/TTL authoritative.
* Reserve phải all-or-nothing; một ghế bận làm toàn request thất bại.
* Cùng idempotency key và cùng payload trả cùng kết quả; khác payload trả `409`.
* Một account bị giới hạn số active hold và rate limit theo cấu hình.

## 4. Payment Confirmation, Expiry & Compensation (P0)

### Purpose

Hoàn tất booking sau thanh toán mà không double-confirm, không mất tiền khi service lỗi và không để ghế bị giữ vô thời hạn.

### Actors / Roles

* **MEMBER**: Khởi tạo thanh toán tại Payment Service bằng `bookingId`.
* **Payment Service**: Đọc payment context authoritative và phát kết quả thanh toán chuẩn hóa.
* **Booking Service**: Deduplicate event, xác thực snapshot, confirm inventory và issue ticket.
* **Movie Service**: Chuyển hold `RESERVED -> SOLD` đúng một lần.

### Target Flow

1. Payment Service gọi `GET /internal/bookings/{bookingId}/payment-context` để lấy owner, amount, currency và expiry.
2. Booking Service nhận event `PAYMENT_SUCCEEDED` hoặc `PAYMENT_FAILED`, lưu inbox unique theo `eventId`.
3. Với success hợp lệ, booking sang `CONFIRM_PENDING` và gọi Movie Service confirm hold.
4. Sau khi inventory thành `SOLD`, Booking Service chuyển booking thành `CONFIRMED`, phát hành ticket và ghi outbox event.
5. Scheduler chuyển booking hết hạn `PENDING_PAYMENT -> EXPIRED` và release hold theo batch an toàn nhiều instance.
6. Late payment, timeout hoặc partial failure đi vào refund/compensation/reconciliation; không tự suy diễn timeout là thất bại.

### Status / Lifecycle

* **Booking**: `PENDING_PAYMENT`, `CONFIRM_PENDING`, `CONFIRMED`, `CANCEL_REQUESTED`, `CANCELLED`, `EXPIRED`.
* **Payment**: `NOT_STARTED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`.
* **Refund**: `NOT_REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`.
* **Inventory**: `HELD`, `RELEASE_PENDING`, `RELEASED`, `CONFIRM_PENDING`, `SOLD`, `CANCEL_SALE_PENDING`, `CANCELLED`.

## 5. Cancellation & Refund Orchestration (P1)

### Purpose

Hủy booking theo policy, phân biệt booking chưa thanh toán, payment chưa rõ kết quả, booking đã xác nhận, hủy bởi khách và hủy do vận hành rạp.

### Actors / Roles

* **MEMBER**: Tạo và theo dõi cancellation của booking mình sở hữu.
* **EMPLOYEE / ADMIN**: Override theo permission và cluster scope, bắt buộc reason/audit.
* **Movie Service / Payment Service**: Thực hiện cancel-sale/release và refund theo contract riêng.

### Target Flow

1. Member tạo cancellation resource qua `POST /api/bookings/{bookingId}/cancellations`.
2. Booking chưa thanh toán và chưa gửi provider có thể release hold rồi hoàn tất đồng bộ (`201`).
3. Payment `UNKNOWN/PROCESSING`, booking `CONFIRM_PENDING` hoặc booking đã trả tiền chuyển sang workflow bất đồng bộ (`202`).
4. Booking đã `SOLD` không dùng release; phải refund rồi gọi cancel-sale nếu policy cho phép.
5. Ticket bị revoke/cancel khi workflow hoàn tất; ticket `USED` chặn customer auto-cancel.

### Status / Lifecycle

* **Cancellation**: `REQUESTED`, `PROCESSING`, `COMPLETED`, `FAILED`, `MANUAL_REVIEW`.
* Chỉ có tối đa một cancellation workflow active cho mỗi booking.

## 6. Ticket Pass & Check-in (P1)

### Purpose

Cung cấp một QR pass opaque cho cả booking và cho phép nhân viên/trusted gate check-in toàn bộ hoặc một phần ticket theo cách idempotent.

### Main Rules

* Ticket chỉ được phát hành sau payment success và inventory `SOLD`.
* Mỗi booking detail có đúng một ticket; QR không chứa PII, giá hay permission.
* Chỉ lưu lookup hash và ciphertext; raw token không xuất hiện trong log/audit.
* `ALL` cập nhật atomically tất cả ticket `VALID`; `SELECTED` chỉ cập nhật ticket thuộc booking trong QR.
* Scan lặp trả trạng thái cũ, không tạo side effect mới.
* Check-in phải đúng cluster, permission và cửa sổ thời gian; cancel/refund làm QR vô hiệu.

### Ticket Status

* `VALID`, `USED`, `CANCELLED`.

## 7. Customer History & Employee Operations (P1)

### Customer Experience

* “Vé của tôi/Lịch sử giao dịch” hỗ trợ `UPCOMING/PAST`, status, date range và pagination.
* Detail đọc hoàn toàn từ transaction snapshot và trả các action flag `canPay`, `canCancel`, `canRefund`, `canViewTicket` do backend tính.
* Member không thể phân biệt booking không tồn tại với booking thuộc người khác.

### Employee / Admin Operations

* Query booking bằng collection `/api/bookings?scope=CLUSTER...`; cluster lấy từ principal, không tin `clusterId` client gửi.
* Counter sale dùng cùng inventory confirm/ticket state machine, có cashier, terminal, payment ledger và receipt để audit.
* Reconciliation case ghi mismatch/evidence; controller không trực tiếp confirm/refund/unsell.
* Operations API nằm dưới `/api/operations/**`; internal service API nằm dưới `/internal/**` và không route public.

## 8. Reliable Events & Downstream Integration (P1)

* Transactional outbox ghi cùng transaction với state change.
* Event tối thiểu: `BOOKING_PENDING_PAYMENT`, `BOOKING_CONFIRMED`, `BOOKING_EXPIRED`, `BOOKING_CANCELLED`, `REFUND_COMPLETED`, `TICKET_ISSUED`.
* Notification lỗi không rollback booking transaction.
* Event có `eventId`, aggregate/version, `occurredAt`, `correlationId` và schema version; consumer deduplicate theo `eventId`.

## 9. Commercial Extensions (P2)

### Promotion-aware Checkout

Tạo quote có expiry, reserve/commit/release promotion quota và lưu discount breakdown. Quote không thay thế inventory hold.

### Loyalty

Reserve điểm trước payment, commit khi confirmed, release khi fail/expire/cancel; Booking không sở hữu balance.

### Concession

Lưu combo/bắp nước như line-item snapshot, validate cluster/showtime, reserve/commit/release stock qua owner tương ứng.

### Observability & Abuse Control

Theo dõi hold conflict, stuck payment/refund, outbox lag, ticket scan conflict; tạo reconciliation có audit và rate limit theo account/IP/device signal.

## 10. Ownership / Relationships

| Capability / Data | Owner | Booking Service lưu gì? |
|---|---|---|
| Showtime, seat, price, hold TTL | Movie Service | Reference, token, expiry và snapshot |
| Booking, state machine, ticket | Booking Service | Canonical domain data |
| Payment/refund ledger | Payment Service | Payment/refund reference và status snapshot |
| Loyalty balance | User Service | Reservation reference và redemption snapshot |
| Promotion quota/rule | Promotion Service | Reservation reference và discount snapshot |
| Notification delivery | Notification Service | Chỉ publish outbox event |

## 11. High-level Flow

1. Browse showtime/seat ở Movie Service.
2. `POST /api/bookings` → reserve ghế atomic → tạo `PENDING_PAYMENT`.
3. Payment Service lấy payment context và xử lý thanh toán.
4. `PAYMENT_SUCCEEDED` → confirm inventory `SOLD` → booking `CONFIRMED` → issue ticket/outbox.
5. Không thanh toán đúng hạn → booking `EXPIRED` → release hold.
6. Hủy sau thanh toán → cancellation policy → refund/cancel-sale → revoke ticket.
7. Mismatch hoặc kết quả chưa xác định → durable retry, compensation hoặc reconciliation; không sửa trạng thái mù quáng.

## 12. Missing / Recommended Decisions

* Chốt cancellation cutoff, refund method/fee/SLA và cinema-cancellation policy.
* Chốt active hold limit, booking/payment timeout, scheduler interval và retention của idempotency/inbox/outbox.
* Chốt permission model cho employee/admin, cluster scope, terminal và trusted gate.
* Khóa error-code registry chung để các dải `2xxx`, `3xxx`, `4xxx` không trùng.
* Thống nhất schema/versioning của Movie, Payment và Kafka event trước khi code P0.
