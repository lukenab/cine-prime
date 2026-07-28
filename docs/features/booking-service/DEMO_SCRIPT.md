# DEMO_SCRIPT.md

## 1. Demo Mục Tiêu (Objective)

Kịch bản này mô tả target end-to-end của Booking Service theo `BOOKING_SERVICE_PRODUCT_ISSUES.md`: giữ ghế authoritative, tạo booking chờ thanh toán, xác nhận ghế đúng một lần, phát hành QR ticket và xử lý các nhánh lỗi quan trọng.

Demo nhằm chứng minh:

* Không thể double-book cùng một ghế khi có request đồng thời.
* Retry không tạo booking/payment/ticket/refund trùng.
* Frontend không quyết định giá, owner, TTL hoặc trạng thái thanh toán.
* Payment success chỉ thành booking confirmed sau khi inventory `SOLD`.
* Expiry/cancellation/late payment có compensation hoặc reconciliation rõ ràng.
* Member, employee và service-to-service được phân quyền đúng namespace.

> Đây là demo script cho target design/backlog. Chỉ chạy phase nào khi issue tương ứng đã được implement và test environment đã có Movie/Payment contract phù hợp.

## 2. Các Vai Trò Tham Gia (Actors)

* `MEMBER`: Chọn ghế, tạo booking, thanh toán, xem/hủy booking và lấy QR ticket.
* `EMPLOYEE`: Tra cứu booking đúng cluster và check-in ticket.
* `ADMIN / OPERATOR`: Override cancellation và xử lý reconciliation theo permission.
* `MOVIE_SERVICE`: Sở hữu seat inventory, price, hold TTL và transition `RESERVED/SOLD`.
* `PAYMENT_SERVICE`: Sở hữu payment/refund ledger và phát normalized result event.
* `BOOKING_SERVICE`: Sở hữu order/snapshot/state machine/ticket và orchestration.

## 3. Dữ Liệu Chuẩn Bị

* Showtime `55` đang mở bán, chưa qua cutoff, tại “CinePrime Quận 1 — Phòng IMAX 1”.
* Ghế `901/G7` và `902/G8` đang `AVAILABLE`, giá authoritative `120.000 VND/ghế`.
* Member `acc-001` có JWT hợp lệ và chưa vượt active hold limit.
* Employee `emp-q1` có permission `TICKET_CHECK_IN` tại đúng cluster Quận 1.
* Movie và Payment Service chấp nhận service credential của Booking Service.

## 4. Kịch Bản Demo P0 — Happy Path Online Booking

### Phase 1: Tạo Hold Và Pending Booking

1. **Member bấm “Tiếp tục”** và gọi `POST /api/bookings` với header `Idempotency-Key: demo-booking-001`:

   ```json
   { "showtimeId": 55, "showtimeSeatIds": [901, 902] }
   ```

2. **Kiểm tra request tối thiểu**:
   * Request không có `accountId`, movie/cinema, price hoặc TTL.
   * Booking lấy owner từ JWT và gọi Movie Service reserve all-or-nothing.
3. **Kết quả mong đợi**:
   * HTTP success, trả một `bookingId`, `status=PENDING_PAYMENT`, `finalAmount=240000` và `expiresAt`.
   * DB lưu showtime/movie/cluster/room/seat/price snapshot cùng internal hold reference/token.
   * Movie inventory là `RESERVED`, chưa phải `SOLD`.
   * Raw hold token không xuất hiện trong public response/log.

### Phase 2: Chứng Minh Idempotency

1. Gửi lại đúng header `demo-booking-001` và đúng body.
2. **Kết quả mong đợi**: Trả lại cùng booking/result; không tạo hold hoặc booking thứ hai.
3. Gửi lại cùng key nhưng đổi seat thành `[901]`.
4. **Kết quả mong đợi**: HTTP `409`, `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.

### Phase 3: Khởi Tạo Thanh Toán

1. Member gọi Payment Service `POST /api/payments` bằng `bookingId` vừa tạo.
2. Payment Service gọi Booking `GET /internal/bookings/{bookingId}/payment-context` bằng service credential.
3. **Kết quả mong đợi**:
   * Booking trả owner `acc-001`, amount `240000`, currency `VND`, status và expiry authoritative.
   * Frontend không gửi/ghi đè payment amount.
   * Gọi payment-context bằng member token hoặc invalid service token bị `403`.

### Phase 4: Nhận Payment Success Và Confirm Inventory

1. Payment Service phát event authenticated `PAYMENT_SUCCEEDED` với `eventId=evt-demo-001`, payment ID, booking ID, amount/currency khớp.
2. Booking Service persist inbox, chuyển sang `CONFIRM_PENDING` và gọi Movie Service confirm bằng stable idempotency key.
3. Movie Service chuyển hold `RESERVED -> SOLD` đúng một lần.
4. Booking Service commit:
   * `bookingStatus=CONFIRMED`;
   * `paymentStatus=SUCCEEDED`;
   * `inventoryStatus=SOLD`;
   * một ticket cho mỗi booking detail;
   * outbox `BOOKING_CONFIRMED` và `TICKET_ISSUED`.
5. Gửi lại cùng payment event.
6. **Kết quả mong đợi**: Event bị deduplicate; không tăng sold counter, không tạo ticket/outbox side effect lần hai.

### Phase 5: Xem Booking Và Ticket

1. Member gọi `GET /api/bookings/{bookingId}`.
2. **Kết quả mong đợi**: Trả snapshot đầy đủ, `canPay=false`, `canViewTicket=true`.
3. Member gọi `GET /api/bookings/{bookingId}/ticket-pass`.
4. **Kết quả mong đợi**: Một opaque QR token cho booking và hai ticket `VALID`; QR không chứa PII/price có thể sửa.

## 5. Kịch Bản Concurrency — Hai Người Chọn Cùng Ghế

1. Chuẩn bị ghế `903/H1` là `AVAILABLE`.
2. Cho `acc-001` và `acc-002` đồng thời gọi `POST /api/bookings` cho seat `903`, mỗi request dùng key riêng.
3. **Kết quả mong đợi**:
   * Đúng một request tạo hold/booking thành công.
   * Request còn lại nhận `409 SEATS_ALREADY_TAKEN` với seat ID không khả dụng.
   * Không có partial booking và không có hai authoritative hold cho cùng ghế.

## 6. Kịch Bản Expiry — Không Thanh Toán

1. Tạo một booking mới và không thanh toán đến đúng `expiresAt`.
2. Chạy/đợi expiry worker claim booking theo batch.
3. **Kết quả mong đợi**:
   * Booking `PENDING_PAYMENT -> EXPIRED` đúng một lần.
   * Hold được release và ghế trở lại `AVAILABLE` theo Movie Service.
   * Scheduler chạy lại không release hoặc phát event trùng.
   * Payment-context sau expiry trả `410 BOOKING_EXPIRED`.

## 7. Kịch Bản Failure Recovery — Mất Response Sau Commit

### Case A: Movie Reserve Commit Nhưng Response Bị Mất

1. Mô phỏng Movie Service commit hold rồi timeout response.
2. Booking retry bằng đúng downstream idempotency key.
3. **Kết quả mong đợi**: Nhận lại hold cũ và tiếp tục tạo đúng một booking.

### Case B: Booking DB Fail Sau Reserve

1. Mô phỏng reserve thành công nhưng local booking transaction fail.
2. **Kết quả mong đợi**: Booking gọi release bằng hold token/reference.
3. Nếu release cũng timeout, kiểm tra có durable compensation task; không chỉ log lỗi rồi bỏ qua.

### Case C: Payment Success Nhưng Confirm Inventory Chưa Rõ

1. Mô phỏng Movie confirm timeout sau khi payment đã success.
2. **Kết quả mong đợi**:
   * Booking giữ `CONFIRM_PENDING`, không issue ticket sớm.
   * Worker retry/query bằng cùng key.
   * Nếu Movie đã `SOLD`, local state được forward-recover; tuyệt đối không release ghế `SOLD`.

### Case D: Late Payment Sau Expiry

1. Expire booking trước, sau đó phát `PAYMENT_SUCCEEDED` hợp lệ.
2. **Kết quả mong đợi**: Không revive booking và không chiếm ghế khác; tạo refund/compensation hoặc reconciliation có audit.

## 8. Kịch Bản P1 — Check-in QR

1. Employee `emp-q1` scan QR bằng `POST /api/ticket-check-ins`, mode `SELECTED`, ticket `G7`, gate `Q1-GATE-02`.
2. **Kết quả mong đợi**: G7 `VALID -> USED`, G8 vẫn `VALID`, có actor/gate/time audit.
3. Scan lại cùng request/key.
4. **Kết quả mong đợi**: Trả trạng thái/`checkedInAt` cũ, không check-in lần hai.
5. Thử scan tại gate cluster khác.
6. **Kết quả mong đợi**: `403 WRONG_CINEMA_SCOPE`.
7. Thử token đã revoke do cancellation.
8. **Kết quả mong đợi**: `410 QR_TOKEN_REVOKED`.

## 9. Kịch Bản P1 — Cancellation & Refund

### Case A: Hủy Trước Thanh Toán

1. Tạo booking `PENDING_PAYMENT`, payment chưa vào `PROCESSING`.
2. Member gọi `POST /api/bookings/{bookingId}/cancellations` với idempotency key và reason.
3. **Kết quả mong đợi**: HTTP `201`, booking `CANCELLED`, inventory `RELEASED`, refund `NOT_REQUESTED`.

### Case B: Hủy Booking Đã Thanh Toán

1. Dùng booking `CONFIRMED`, mọi ticket còn `VALID` và còn trong cutoff.
2. Member tạo cancellation.
3. **Kết quả mong đợi ban đầu**: HTTP `202`, `CANCEL_REQUESTED`, refund `PENDING`, không báo hoàn tất sớm.
4. Payment Service trả `REFUND_SUCCEEDED`; Movie Service hoàn tất cancel-sale theo policy.
5. **Kết quả cuối**: Booking `CANCELLED`, refund `SUCCEEDED`, ticket `CANCELLED`, QR revoked, outbox tương ứng.

### Case C: Hủy Sau Check-in

1. Dùng booking có ít nhất một ticket `USED`.
2. Member yêu cầu hủy.
3. **Kết quả mong đợi**: HTTP `409 TICKET_ALREADY_USED`; không refund/cancel-sale tự động.

### Case D: Cancel Race Với Payment Success

1. Gửi cancellation cùng lúc với `PAYMENT_SUCCEEDED`.
2. **Kết quả mong đợi**: Conditional transition tạo một kết quả xác định; nếu payment authoritative success thì workflow tiếp tục refund, không mất tiền và không tạo hai cancellation.

## 10. Kịch Bản P1 — Employee Operations

1. Employee gọi `GET /api/bookings?scope=CLUSTER...`.
2. **Kết quả mong đợi**: Chỉ thấy booking trong cluster được phân công; response không lộ PII quá mức.
3. Employee tạo counter booking qua `POST /api/bookings` với `bookingType=COUNTER`, cash và terminal hợp lệ.
4. **Kết quả mong đợi**: Dùng cùng inventory/confirmation/ticket flow, có receipt reference và audit cashier/terminal.
5. Thử terminal hoặc showtime thuộc cluster khác.
6. **Kết quả mong đợi**: `403 TERMINAL_NOT_AUTHORIZED` hoặc `EMPLOYEE_OUTSIDE_CLUSTER_SCOPE`.

## 11. End of Demo — Checklist

* [ ] Một inventory owner duy nhất; Booking DB không có competing authoritative seat lock.
* [ ] Create booking, payment event, confirm, release, cancellation và scan đều retry an toàn.
* [ ] Không có amount/owner/TTL/trạng thái authoritative do frontend quyết định.
* [ ] Không có booking confirmed trước inventory `SOLD`.
* [ ] Không release ghế đã `SOLD`.
* [ ] Không có ticket trước confirmation hoặc ticket/QR side effect trùng.
* [ ] Expiry, late payment và partial failure có durable recovery state.
* [ ] Ownership, cluster scope và service credential được kiểm tra.

## 12. Q&A Tiềm Năng Cho Mentor / Leader

**Q: Vì sao Booking Service không tự tạo bảng khóa ghế?**  
**A:** Vì Movie Service đã sở hữu showtime seat inventory. Hai nguồn lock độc lập có thể lệch TTL/trạng thái và gây double-book hoặc ghế kẹt. Booking chỉ lưu hold token/reference và snapshot.

**Q: Vì sao chỉ có một `POST /api/bookings`, không cho frontend gọi hold trước?**  
**A:** “Tiếp tục” là một use case sản phẩm. Booking Service điều phối reserve và persist order, đồng thời chịu trách nhiệm compensation nếu một bước thất bại.

**Q: Payment success có đồng nghĩa booking confirmed không?**  
**A:** Chưa. Booking chỉ `CONFIRMED` sau khi Movie Service xác nhận hold thành `SOLD` và local ticket transaction hoàn tất.

**Q: Idempotency có làm service đang down hoạt động lại không?**  
**A:** Không. Nó làm retry an toàn. Khả năng chịu lỗi còn cần timeout, bounded retry, circuit breaker, durable operation, TTL, compensation và reconciliation.

**Q: Vì sao payment timeout không chuyển ngay sang failed?**  
**A:** Provider có thể đã thu tiền nhưng response bị mất. Trạng thái phải là `UNKNOWN`, sau đó query/reconcile bằng cùng reference/key để tránh charge hoặc refund trùng.

**Q: Tại sao không release ghế sau khi đã `SOLD`?**  
**A:** Release chỉ dành cho hold `RESERVED`. Sale đã xác nhận cần cancel-sale contract và refund policy riêng để tránh mở bán lại ghế sai.

**Q: Vì sao QR là một token opaque cho cả booking?**  
**A:** Token không để lộ PII/giá, có thể revoke tập trung và vẫn hỗ trợ check-in tất cả hoặc một phần ticket trong booking.
