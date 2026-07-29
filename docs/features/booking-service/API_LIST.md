# Booking & Payment — API List

> Cập nhật: 30/07/2026
> Base path qua API Gateway: `/api`

## 1. Quy ước

- Customer identity lấy từ JWT; không nhận `accountId` authoritative từ body.
- Mutation có thể retry phải gửi `Idempotency-Key`.
- Money dùng số thập phân, currency hiện tại là `VND`.
- Internal API yêu cầu internal service key hoặc chữ ký HMAC theo contract.

## 2. Customer Booking API

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| `POST` | `/api/bookings` | Customer | Atomic hold ghế và tạo booking `PENDING_PAYMENT` |
| `GET` | `/api/bookings/{bookingId}` | Owner | Chi tiết booking |
| `GET` | `/api/bookings?page=&size=&sort=` | Customer | Lịch sử booking của bản thân |
| `GET` | `/api/bookings/{bookingId}/ticket-pass` | Owner | Lấy opaque ticket pass của booking confirmed |
| `POST` | `/api/bookings/{bookingId}/cancellations` | Owner | Hủy pending booking hoặc yêu cầu refund |

### Tạo booking

```http
POST /api/bookings
Authorization: Bearer <customer-jwt>
Idempotency-Key: booking-obsession-A1-A2-001
Content-Type: application/json
```

```json
{
  "showtimeId": 340,
  "seatIds": [9101, 9102]
}
```

Kết quả chứa `bookingId`, `bookingCode`, `holdId`, `holdToken`, `lockedUntil`, snapshot ghế và tiền.

> Frontend customer-facing chỉ được gọi các endpoint `/api/bookings/**` của Booking Service. Không được gọi trực tiếp API hold public của Movie Service (mục 6) để hủy/đổi ghế sau khi đã tạo booking — xem BR-CAN-05 trong [BUSINESS_RULES.md](BUSINESS_RULES.md). Duy nhất `POST /api/bookings/{bookingId}/cancellations` là đường hợp lệ để hủy/hoàn.

## 3. Payment API

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| `POST` | `/api/payments/sessions` | Customer | Tạo payment attempt và URL VNPAY Sandbox |
| `GET` | `/api/payments/{paymentId}` | Authenticated | Query payment theo ID |
| `GET` | `/api/payments/by-booking/{bookingId}` | Authenticated | Query payment của booking |
| `GET` | `/api/payments/vnpay/ipn` | Provider callback | Xử lý IPN có verify checksum |
| `GET` | `/api/payments/vnpay/return` | Public provider return | Xử lý return URL có verify checksum |
| `GET` | `/api/payments/admin/attempts` | Admin | Danh sách payment attempts |
| `GET` | `/api/payments/admin/reconciliation` | Admin | Danh sách payment reconciliation |
| `POST` | `/api/payments/internal/refunds` | Internal service | Tạo refund idempotently |

### Tạo payment session

```http
POST /api/payments/sessions
Authorization: Bearer <customer-jwt>
Idempotency-Key: pay-booking-001
Content-Type: application/json
```

```json
{
  "bookingId": "booking-uuid",
  "returnUrl": "http://localhost:3000/checkout/result"
}
```

Payment Service luôn đọc amount/currency từ Booking Service, không tin tổng tiền do browser gửi.

### Payment session response

`GET /api/payments/{paymentId}` và `GET /api/payments/by-booking/{bookingId}` trả thêm:

- `bankCode`: mã ngân hàng thực tế từ callback VNPAY (`vnp_BankCode`), ví dụ `NCB`.
- `cardType`: phương thức thanh toán (`vnp_CardType`), ví dụ `ATM`, `QRCODE`.

Cả hai chỉ có giá trị sau khi callback thành công; `null` trước đó hoặc khi provider không trả về.

## 4. Payment outcome nội bộ

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| `POST` | `/api/internal/payments/webhooks/outcome` | HMAC signature | Booking Service nhận provider outcome đã chuẩn hóa |

Header:

```http
X-Webhook-Signature: <hmac-sha256-over-raw-body>
```

`source + eventId` là unique inbox key; duplicate delivery không tạo side effect lần hai.

## 5. Cinema Operations API

| Method | Endpoint | Auth | Mục đích |
|---|---|---|---|
| `GET` | `/api/booking-operations/clusters/{clusterId}/bookings` | Admin/Employee | Booking theo cluster |
| `GET` | `/api/booking-operations/clusters/{clusterId}/reconciliation-cases` | Admin/Employee | Sự cố cần đối soát theo cluster |
| `POST` | `/api/booking-operations/clusters/{clusterId}/check-ins` | Admin/Employee | Check-in ticket pass atomically |
| `POST` | `/api/booking-operations/clusters/{clusterId}/counter-sales` | Admin/Employee | Bán vé tại quầy và confirm inventory |

### Counter sale

```http
POST /api/booking-operations/clusters/43/counter-sales
Authorization: Bearer <employee-jwt>
Idempotency-Key: POS-01-RECEIPT-0001
Content-Type: application/json
```

```json
{
  "showtimeId": 340,
  "seatIds": [9101, 9102],
  "terminalId": "POS-01",
  "paymentMethod": "CASH",
  "receiptReference": "L81-20260729-0001"
}
```

Payment method hỗ trợ: `CASH`, `CARD`, `QR`, `BANK_TRANSFER`.

## 6. Movie Service inventory API

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/schedules/{showtimeId}` | Xác minh public `ON_SALE` showtime và snapshot metadata |
| `POST` | `/api/showtimes/{showtimeId}/seat-holds` | Atomic hold selection |
| `POST` | `/api/internal/showtimes/{showtimeId}/seat-holds/{holdId}/confirm` | `HELD -> SOLD` |
| `DELETE` | `/api/internal/showtimes/{showtimeId}/seat-holds/{holdId}` | Release hold |
| `POST` | `/api/internal/showtimes/{showtimeId}/seat-holds/{holdId}/reverse-sale` | Compensation sau khi đã sold |

## 7. Domain errors chính

| HTTP | Trường hợp |
|---|---|
| `400` | Body/header không hợp lệ, duplicate seat ID |
| `401` | Không có identity hợp lệ |
| `403` | Không sở hữu booking hoặc Employee ngoài cluster |
| `404` | Booking, payment, showtime, hold hoặc ticket pass không tồn tại |
| `409` | Seat unavailable, idempotency conflict, state transition không hợp lệ, ticket đã dùng |
| `410` | Hold/pass hết hiệu lực nếu contract áp dụng |
| `422` | Amount/currency hoặc business rule không hợp lệ |
| `429` | Booking request rate hoặc số booking pending vượt giới hạn |
| `503` | Downstream tạm thời không khả dụng; cần retry/compensation |
