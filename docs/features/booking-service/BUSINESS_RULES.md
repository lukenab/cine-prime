# Booking Service — Business Rules

> Cập nhật: 30/07/2026

## 1. Nguồn sự thật

### BR-INV-01 — Seat inventory

`showtime_seat` tại Movie Service là nguồn tồn kho ghế duy nhất.

- Booking Service không duy trì trạng thái ghế authoritative.
- Booking Service chỉ lưu snapshot và external hold reference.
- Một ghế tại một showtime chỉ ở một trong các trạng thái nghiệp vụ:

```text
AVAILABLE -> HELD -> SOLD
          \-> AVAILABLE khi expiry/release
```

### BR-INV-02 — Public showtime

Customer chỉ được đặt showtime có sales status `ON_SALE`. Draft, scheduled nội bộ, suspended, cancelled hoặc completed không được public để booking.

### BR-INV-03 — Materialization

Khi publish/tạo showtime từ active room layout, Movie Service phải materialize toàn bộ vị trí có thể bán thành `showtime_seat`. Booking không được tự sinh ghế từ layout.

### BR-INV-04 — Final price

`showtime_seat.price` là final price snapshot tại thời điểm materialization/pricing.

- Frontend không gửi giá authoritative.
- Booking item lưu lại `unitPrice` và `finalPrice`.
- Payment amount phải bằng booking total và cùng currency.

## 2. Tạo booking và giữ ghế

### BR-BKG-01 — Hold trước, booking sau

Booking Service phải hold toàn bộ selection tại Movie Service trước khi persist booking. Nếu persist thất bại sau khi hold thành công, hệ thống phải release hold hoặc tạo compensation task.

### BR-BKG-02 — Atomic selection

Một request chỉ thành công khi tất cả ghế:

- tồn tại;
- thuộc đúng showtime;
- đang `AVAILABLE`;
- hợp lệ theo seat group/couple rule.

Một ghế lỗi làm rollback toàn bộ selection; không partial success.

### BR-BKG-03 — Ownership

Hold phải gắn với owner/caller identity. Customer A không được confirm hoặc release hold của Customer B thông qua public API.

### BR-BKG-04 — Idempotency

`POST /api/bookings` yêu cầu `Idempotency-Key`.

- Cùng caller + key + canonical request: trả lại kết quả đã tạo.
- Cùng caller + key nhưng request khác: trả `409`.
- Retry không được tạo hold hoặc booking thứ hai.

### BR-BKG-05 — Snapshot

Booking phải lưu snapshot giao dịch cần thiết để lịch sử không thay đổi khi catalog, room name hoặc price book thay đổi sau đó.

### BR-BKG-06 — Resume một hold đang hoạt động

Idempotency key của một hold phải sống sót qua reload trang (client lưu lại theo `showtimeId`, không chỉ giữ trong bộ nhớ runtime). Khi client gửi lại đúng `(owner, idempotencyKey, seatIds)` trong lúc hold gốc còn hiệu lực, hệ thống phải trả về hold đang có (replay), không được từ chối bằng lỗi seat-not-available chỉ vì ghế đang `RESERVED` bởi chính owner đó dưới một idempotency key cũ đã mất. Seat map trả cho owner đang giữ ghế đó phải phân biệt được "ghế do chính mình giữ" với "ghế người khác đang giữ", để client có thể cho chọn lại thay vì khoá cứng.

### BR-BKG-07 — Đếm giới hạn số ghế theo ghế vật lý

`maximumSeatsPerBooking` phải được áp dụng trên số ghế vật lý sau khi mở rộng seat group (ví dụ ghế đôi/sofa tính là 2), không phải theo số đơn vị khách chọn trên UI. Client và server phải đếm theo cùng quy tắc; nếu không, UI có thể cho một lựa chọn hợp lệ ở phía client nhưng server từ chối ở bước cuối cùng.

## 3. State machines

Booking, payment và inventory dùng enum riêng:

```text
Booking:
PENDING_PAYMENT -> CONFIRM_PENDING -> CONFIRMED
                -> EXPIRED
                -> CANCELLED
CONFIRMED -> REFUND_PENDING -> REFUNDED

Payment:
NOT_STARTED -> PENDING -> PROCESSING -> SUCCEEDED
                                  \-> FAILED / UNKNOWN

Seat:
AVAILABLE -> HELD -> SOLD
          \-> AVAILABLE
```

Transition phải được kiểm tra theo current state; không cho client gửi target state tùy ý.

## 4. Payment và confirmation

### BR-PAY-01 — Xác thực webhook

Booking Service chỉ xử lý payment outcome có HMAC signature hợp lệ. Payload phải được verify trên raw body.

### BR-PAY-02 — Inbox idempotency

Mỗi payment event được lưu theo `source + eventId`. Provider gửi lặp lại cùng event không được:

- confirm inventory lần hai;
- phát hành ticket lần hai;
- tạo outbox/reconciliation trùng.

### BR-PAY-03 — Amount và currency

`amount` và `currency` từ verified outcome phải khớp snapshot của booking. Mismatch không được confirm; phải ghi nhận lỗi hoặc reconciliation.

### BR-PAY-04 — Confirm order

Payment success chưa đủ để đánh dấu booking `CONFIRMED`. Hệ thống phải confirm hold tại Movie Service thành công trước, sau đó mới:

1. chuyển booking `CONFIRMED`;
2. tạo ticket;
3. phát hành ticket pass;
4. ghi outbox event.

### BR-PAY-05 — Late success

Payment success đến sau expiry không tự động chiếm lại ghế. Hệ thống tạo reconciliation case để xác minh ghế và quyết định refund/manual recovery.

## 5. Expiry và compensation

### BR-EXP-01

Booking `PENDING_PAYMENT` hết hạn trước khi thanh toán phải:

- release hold;
- chuyển inventory snapshot về released;
- chuyển booking `EXPIRED`.

### BR-EXP-02

Payment failed/cancelled phải release hold nếu hold chưa được confirm.

### BR-EXP-03

Scheduler và compensation worker phải idempotent. Chạy lại không được release/confirm/refund lặp.

### BR-EXP-04

Timeout downstream là kết quả chưa chắc chắn, không mặc định coi là failed. Hệ thống phải retry bằng cùng identity hoặc tạo reconciliation case.

## 6. Hủy và refund

### BR-CAN-01

Pending booking có thể hủy bằng cách release hold và chuyển `CANCELLED`.

### BR-CAN-02

Confirmed booking không được xóa hoặc đổi thẳng thành cancelled. Phải kiểm tra cancellation policy, tạo refund request và chuyển `REFUND_PENDING`.

### BR-CAN-03

Refund amount do server tính từ booking snapshot và policy; client không gửi amount authoritative.

### BR-CAN-04

Payment Service phải xử lý refund idempotently.

- Profile local/demo có thể auto-approve sandbox refund để chạy hết flow.
- Production phải dùng provider refund adapter và settlement/reconciliation thật.
- Kết quả `MANUAL_REVIEW` không được giả lập thành refund thành công.

### BR-CAN-05 — Không hủy/đổi ghế bằng cách gọi thẳng Movie Service

Client không được gọi trực tiếp API release hold public của Movie Service (`DELETE /api/showtimes/{showtimeId}/seat-holds/{holdId}`) để hủy hoặc đổi ghế sau khi đã có booking. Mọi thao tác hủy/đổi phải đi qua `POST /api/bookings/{bookingId}/cancellations` của Booking Service, để tránh để lại booking `PENDING_PAYMENT`/`CONFIRMED` mồ côi không còn hold tương ứng cho tới khi expiry scheduler dọn dẹp.

### BR-CAN-06 — Ngôn ngữ hiển thị theo trạng thái thanh toán

Giao diện phải phân biệt "Cancel booking" (booking chưa thanh toán, hủy hold miễn phí, không liên quan tới tiền) với "Request a refund" (booking `CONFIRMED`/`CONFIRM_PENDING`, đã có tiền cần hoàn theo BR-CAN-02/BR-CAN-03) — không dùng chung một nhãn hoặc một danh sách lý do cho cả hai trường hợp.

## 7. Ticket và check-in

### BR-TKT-01

Ticket chỉ được phát hành sau khi booking confirmed và inventory đã sold.

### BR-TKT-02

Ticket pass là opaque token; database lưu hash/encrypted payload phù hợp, không dùng booking ID thuần làm QR.

### BR-TKT-03

Check-in:

- chỉ áp dụng cho booking confirmed, pass active và đúng cluster;
- consume toàn bộ ticket trong pass atomically;
- cùng `Idempotency-Key` có thể replay kết quả;
- key mới trên ticket đã dùng trả conflict;
- mọi lần scan được audit.

## 8. Phân quyền nhiều cụm rạp

### BR-AUTH-01

Customer chỉ đọc và thao tác booking của chính mình.

### BR-AUTH-02

Employee chỉ tra cứu/check-in booking thuộc cluster được gán. Admin/Super Admin có quyền theo policy toàn hệ thống.

### BR-AUTH-03

Backend phải kiểm tra cluster scope từ verified claim hoặc internal employee lookup. Chỉ ẩn UI không phải authorization.

Policy đọc các verified claim `cinemaClusterIds`, `clusterIds`, `cinemaClusterId` hoặc `clusterId`. Hệ thống phát hành JWT có trách nhiệm cung cấp assignment đúng; thiếu claim phải bị từ chối mặc định.

## 9. Reliability và event

### BR-REL-01 — Transactional outbox

Business state và outbox event phải được persist trong cùng transaction. Publisher có thể gửi lặp; consumer phải idempotent.

### BR-REL-02 — Reconciliation

Các case tối thiểu:

- payment success sau booking expiry;
- payment success nhưng confirm inventory thất bại;
- amount/currency mismatch;
- trạng thái payment và booking không khớp;
- compensation hết số lần retry.

Reconciliation record phải query được theo cluster cho operations.

### BR-REL-03 — Audit

State transition, cancellation, refund, ticket issuance và check-in phải có actor, timestamp, reason và correlation/idempotency reference.

### BR-REL-04 — Abuse control

- Giới hạn số booking `PENDING_PAYMENT` chưa hết hạn trên mỗi customer.
- Giới hạn số lần thử tạo booking theo cửa sổ thời gian.
- Redis được dùng cho rate window; nếu Redis lỗi, DB active-booking cap vẫn là safety net.
- Vi phạm trả `429`, không tiếp tục tạo hold.

## 10. Counter sale

### BR-CTR-01

Employee chỉ bán vé tại cluster được phân quyền. Showtime phải `ON_SALE` và thuộc đúng cluster.

### BR-CTR-02

Counter sale vẫn phải dùng cùng atomic inventory hold/confirm; không được ghi thẳng seat thành sold.

### BR-CTR-03

`receiptReference` và `Idempotency-Key` phải chống bán trùng. Booking chỉ confirmed khi inventory đã sold và counter payment đã được ghi nhận.

### BR-CTR-04

Counter payment hỗ trợ `CASH`, `CARD`, `QR`, `BANK_TRANSFER`. Đây là payment record tại quầy, tách biệt với online payment attempt.

## 11. P2

Promotion, loyalty và concession phải dùng reservation/commit/release lifecycle riêng; không nhét trực tiếp vào seat state machine. Rating và Review chỉ mở cho customer có ticket hợp lệ sau showtime.
