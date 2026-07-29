# Booking & Payment — P0/P1 Implementation Status

> Cập nhật: 29/07/2026  
> Mục đích: bảng bàn giao ngắn gọn, phân biệt rõ phạm vi đã triển khai, mức sẵn sàng demo và phần còn phải harden trước production.

## 1. Kết luận

- **P0:** đã hoàn thiện ở mức demo tích hợp và kiểm thử module.
- **P1:** đã hoàn thiện các capability chính ở backend; customer payment/history UI đã có. Counter sale và check-in hiện cung cấp operations API, chưa phải một POS UI hoàn chỉnh.
- **Production-ready:** chưa tuyên bố cho đến khi chạy full Docker E2E/race/load, cấu hình production merchant và hoàn tất observability tập trung.

## 2. P0

| Hạng mục | Trạng thái | Bằng chứng triển khai |
|---|---|---|
| Chỉ public `ON_SALE` | Hoàn thành | Public showtime contract và customer flow chỉ dùng sales status hợp lệ |
| Materialize `showtime_seat` | Hoàn thành | Inventory được tạo từ active room layout |
| Một nguồn tồn kho ghế | Hoàn thành | Movie Service sở hữu authoritative seat state |
| Final seat price snapshot | Hoàn thành | Booking lấy và snapshot `showtime_seat.price`, không dùng giá từ browser |
| Atomic hold | Hoàn thành | Owner, expiry, idempotency và all-or-nothing selection |
| Booking orchestration | Hoàn thành | Hold trước; persist `PENDING_PAYMENT`; compensation nếu persist lỗi |
| Payment session | Đủ demo | VNPAY Sandbox URL, attempt ledger và provider return/IPN |
| Payment confirmation | Hoàn thành | Verify signature, inbox dedupe, amount/currency check, confirm seat, issue ticket |
| Expiry/compensation | Hoàn thành | Expiry scheduler, hold release, retry, `DEAD`, reconciliation |
| Customer query | Hoàn thành | Detail, history và ticket pass |

## 3. P1

| Nhóm | Capability | Trạng thái |
|---|---|---|
| Reliability | Transactional outbox/inbox | Hoàn thành |
| Reliability | Retry, `DEAD` state và reconciliation | Hoàn thành |
| Reliability | Active-booking cap và Redis rate limit | Hoàn thành |
| Reliability | Actuator health/info/metrics | Hoàn thành baseline |
| Reliability | Dashboard, alert, tracing, manual re-drive | Cần production hardening |
| After-sales | Pending cancellation/release | Hoàn thành |
| After-sales | Confirmed cancellation/refund orchestration | Đủ demo với sandbox |
| After-sales | Production provider refund/settlement | Chưa hoàn thành |
| Operations | Cluster-scoped query | Hoàn thành |
| Operations | Opaque ticket pass/check-in | Hoàn thành |
| Operations | Counter sale backend | Hoàn thành |
| Operations | Counter-sale POS UI | Chưa nằm trong backend P1 đã triển khai |

## 4. Ranh giới service

| Service | Nguồn sự thật |
|---|---|
| Movie Service | Showtime, room/layout, seat inventory, hold và final seat price |
| Booking Service | Booking aggregate, item snapshot, ticket, cancellation, compensation và reconciliation |
| Payment Service | Payment attempt, provider outcome và refund ledger |

Không service nào được đọc/cập nhật trực tiếp database của service khác.

## 5. Luồng demo chuẩn

```text
ON_SALE showtime
-> authoritative seat map
-> atomic hold
-> PENDING_PAYMENT booking
-> VNPAY Sandbox payment
-> verified outcome
-> SOLD inventory
-> CONFIRMED booking
-> ticket pass
-> employee check-in
```

## 6. Kiểm thử đã chạy

- Booking Service module tests.
- Payment Service clean tests.
- Movie Service targeted inventory, pricing và seat-hold tests.
- Frontend production build.

## 7. Bằng chứng runtime cho demo ngày 29/07/2026

- API Gateway và các service chính đang phản hồi.
- Public schedule API trả `42` suất `ON_SALE`; `34` suất có ngày chiếu từ 29/07/2026 trở đi tại thời điểm kiểm tra.
- Quick Booking hiển thị dữ liệu thật và đã chuyển thành công từ `Obsession → CinePrime Landmark 81 → 20:15 · Room 4` sang trang chọn ghế.
- Seat map được materialize từ active layout, có inventory `AVAILABLE` và final price snapshot trong khoảng `90.000đ–162.000đ`.
- Customer UI hiển thị inventory connection `Live` và hold policy 10 phút.
- Route VNPAY IPN/return đã được expose qua API Gateway/ngrok.

**Cổng kiểm tra còn lại:** phải diễn tập một signed VNPAY Sandbox round-trip hoàn chỉnh trước buổi demo. Gọi endpoint IPN không có chữ ký chỉ kiểm tra được routing, không xác minh được payment confirmation.

## 8. Exit criteria trước production

- Full Docker E2E theo luồng ở mục 5.
- Hai customer giữ cùng ghế trong môi trường tích hợp: chỉ một request thắng.
- Race test expiry/payment và cancellation/payment.
- Duplicate provider callback và duplicate confirmation test.
- Production VNPAY merchant, production refund adapter và secret management.
- Employee JWT có cluster claims đúng từ Identity Service.
- Metrics dashboard, alert, tracing và manual re-drive cho `DEAD`.
