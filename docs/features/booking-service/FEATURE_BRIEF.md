# Booking Service — Feature Brief

> Cập nhật: 30/07/2026
> Phạm vi: P0 và P1 của luồng đặt vé, thanh toán, hậu mãi và vận hành tại cụm rạp.

## 1. Mục tiêu

Booking Service điều phối giao dịch đặt vé giữa Customer, Movie Service và Payment Service:

1. Customer chọn một showtime `ON_SALE` và ghế đang khả dụng.
2. Movie Service giữ toàn bộ ghế atomically.
3. Booking Service tạo booking `PENDING_PAYMENT` và lưu snapshot giao dịch.
4. Payment Service tạo phiên thanh toán VNPAY Sandbox và xử lý callback đã xác thực.
5. Booking Service xác nhận seat hold, chuyển booking thành `CONFIRMED` và phát hành ticket pass.
6. Expiry, cancellation, refund, compensation và reconciliation bảo vệ các nhánh lỗi.
7. Employee thao tác theo phạm vi cinema cluster: tra cứu, counter sale và check-in.

## 2. Ranh giới trách nhiệm

| Service | Nguồn sự thật |
|---|---|
| Movie Service | Showtime, room/layout, `showtime_seat`, seat hold, trạng thái ghế và final seat price |
| Booking Service | Booking aggregate, booking item snapshot, lịch sử khách hàng, ticket, check-in, compensation và reconciliation |
| Payment Service | Payment attempt, provider outcome và refund ledger |
| Promotion Service | Promotion eligibility, reservation và redemption |
| Loyalty Service | Point reservation, earn và reversal |
| Notification Service | Email, SMS và push delivery |

Booking Service không đọc hoặc cập nhật database của Movie Service. Các service giao tiếp qua API hoặc event.

## 3. Actor

- **Customer:** tạo booking, thanh toán, xem lịch sử/chi tiết, lấy ticket pass và yêu cầu hủy.
- **Employee:** tra cứu booking, counter sale và check-in trong các cluster được gán.
- **Admin/Super Admin:** tra cứu toàn hệ thống, hỗ trợ cancellation/refund và reconciliation.
- **Payment Service:** gửi payment outcome qua internal webhook có chữ ký.
- **Background worker:** expiry booking, retry compensation, publish outbox và rà soát payment chưa chắc chắn.

## 4. Luồng nghiệp vụ chính

```text
ON_SALE showtime
    -> load authoritative showtime seats
    -> atomic seat hold
    -> PENDING_PAYMENT booking
    -> VNPAY Sandbox payment session
    -> verified provider callback
    -> confirm seat inventory
    -> CONFIRMED booking
    -> tickets + ticket pass
    -> employee check-in
```

### Snapshot được lưu tại thời điểm đặt vé

- `showtimeId`, `movieId`, `cinemaClusterId`, `cinemaRoomId`
- Tên phim, cụm rạp, phòng, ngày và giờ chiếu
- `holdId`, hold reference/token và thời điểm hết hạn
- `showtimeSeatId`, mã ghế, loại ghế và final seat price
- Subtotal, service fee, discount, total và currency

Frontend không được gửi giá authoritative. Booking chỉ dùng giá Movie Service trả về.

## 5. Trạng thái P0

| Nhóm | Trạng thái | Nội dung |
|---|---|---|
| P0.1 Inventory prerequisites | **Hoàn thành** | Chỉ public `ON_SALE`; materialize `showtime_seat`; một nguồn tồn kho; final price snapshot; atomic hold có owner, expiry và idempotency |
| P0.2 Booking orchestration | **Hoàn thành** | Hold trước, persist booking sau; snapshot đầy đủ; compensation khi persist lỗi; không truy cập chéo database |
| P0.3 Payment & confirmation | **Đủ demo tích hợp** | Payment session VNPAY Sandbox, chữ ký callback, inbox chống trùng, confirm inventory, late-payment reconciliation và sandbox refund |
| P0.4 Expiry & compensation | **Hoàn thành** | Expiry worker, release hold, retry compensation, trạng thái `DEAD` và reconciliation |
| P0.5 Query & verification | **Hoàn thành ở mức module** | Customer detail/history/ticket pass; operations query; unit/module tests cho inventory, pricing, hold, idempotency guard, access policy và signing |

> Full container E2E và race suite đa service vẫn cần chạy trong môi trường tích hợp trước khi coi là production-ready.

## 6. Trạng thái P1

### P1-A — Reliability

- Đã có transactional outbox/inbox, retry, trạng thái `DEAD`, reconciliation record/query.
- Đã có giới hạn số booking pending đang hoạt động và request rate bằng Redis, với DB cap làm safety net.
- Đã expose Actuator `health`, `info`, `metrics`; `metrics` vẫn yêu cầu JWT.
- Còn production hardening: dashboard/alert, manual re-drive cho bản ghi `DEAD`, distributed tracing và load test.

### P1-B — After-sales

- Pending booking có thể hủy và release hold.
- Confirmed booking đi qua cancellation policy và refund orchestration.
- Sandbox có thể auto-approve refund để demo đầy đủ.
- Production cần provider refund adapter/settlement thật và quy trình xử lý manual review.
- UI phân biệt "Cancel booking" (chưa thanh toán) và "Request a refund" (đã thanh toán) theo đúng thuật ngữ ngành, với danh sách lý do riêng cho từng trường hợp — xem BR-CAN-06.

### P1-C — Cinema operations

- Cluster-scoped booking/reconciliation query.
- Opaque QR ticket pass và idempotent check-in.
- Auditable counter sale với `CASH`, `CARD`, `QR` hoặc `BANK_TRANSFER`.
- Backend kiểm tra cluster claim; hệ thống phát hành JWT phải cung cấp đúng cluster assignment cho Employee.

## 7. Làm giàu thông tin vé tại checkout

Trang checkout/ticket của customer hiển thị thêm các trường không thuộc snapshot của Booking Service, lấy trực tiếp từ service khác tại thời điểm đọc (best-effort, độc lập với nhau):

| Trường | Nguồn | Ghi chú |
|---|---|---|
| Thời lượng phim, age rating, thể loại | Movie Service — `GET /api/movies/public/{movieId}` | Dùng để tính giờ kết thúc suất chiếu phía client |
| Địa chỉ đầy đủ cụm rạp | Movie Service — `GET /api/cinema-clusters/{clusterId}` | `cinemaClusterName` trong snapshot chỉ có tên, không có địa chỉ |
| Tên người đặt vé | User Service — `GET /api/users/{accountId}` | Fallback về username trong JWT nếu chưa có hồ sơ |
| Phương thức thanh toán (ngân hàng/loại thẻ) | Payment Service — `GET /api/payments/by-booking/{bookingId}` | Xem `bankCode`/`cardType` trong [API_LIST.md](API_LIST.md) |

Đây là các lệnh gọi best-effort tại frontend; lỗi ở bất kỳ lệnh nào không được chặn hiển thị booking/ticket chính — trường tương ứng chỉ hiển thị "—".

## 8. Tiêu chí demo

- Hai request đồng thời không thể giữ thành công cùng một ghế.
- Retry cùng `Idempotency-Key` không tạo booking hoặc counter sale thứ hai.
- Giá booking khớp `showtime_seat.price`.
- Duplicate callback không confirm hoặc phát hành ticket lần hai.
- Booking hết hạn giải phóng hold và chuyển `EXPIRED`.
- Late payment hoặc inventory confirmation thất bại tạo reconciliation case.
- Customer chỉ đọc booking/ticket của mình.
- Employee ngoài cluster bị từ chối.
- Luồng chạy được: `ON_SALE -> seats -> hold -> pending -> VNPAY -> confirmed -> ticket -> check-in`.

## 9. Ngoài phạm vi P0/P1

- Promotion-aware checkout.
- Loyalty reservation lifecycle.
- Concession-aware checkout.
- Rating & Review.
- Production VNPAY merchant credentials, production refund settlement và hạ tầng observability tập trung.
