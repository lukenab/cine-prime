## Overview / Objective

Hoàn thiện issue `#260 - [Backend] Integrate Provider Refund API` trên Payment Service. Sau khi Booking Service gửi yêu cầu hoàn tiền qua Internal Refund API, Payment Service không còn tự động đánh dấu thành công trong cấu hình mặc định mà tạo request refund đúng contract VNPay, ký HMAC-SHA512, gửi sang Provider Refund API, xác thực response và cập nhật kết quả vào payment ledger.

Related Issue: `#260`

---

## Changes Introduced

### Provider integration

- Thêm `ProviderRefundGateway` để tách contract provider khỏi application service.
- Thêm `VnpayRefundGateway` gửi `POST` JSON đến VNPay Transaction API với `vnp_Command=refund`.
- Hỗ trợ full refund (`vnp_TransactionType=02`) và partial refund (`03`).
- `vnp_Amount` được đổi sang đơn vị VNPay bằng cách nhân `100`.
- `vnp_RequestId` được sinh ổn định từ idempotency key, giúp retry cùng request không tạo request provider khác.
- Lưu `provider_created_at` tại thời điểm tạo payment để gửi đúng `vnp_TransactionDate` của giao dịch gốc.

### Signing and response verification

- Ký request bằng HMAC-SHA512 theo đúng thứ tự field riêng của VNPay Refund API.
- Xác minh chữ ký response bằng thứ tự field response riêng.
- Sau khi chữ ký hợp lệ, kiểm tra response vẫn thuộc đúng merchant, transaction reference và refund amount trước khi tin cậy kết quả.
- Response sai chữ ký, sai binding hoặc lỗi HTTP không bị đánh dấu thất bại/chấp nhận sớm; ledger chuyển `MANUAL_REVIEW` và tạo reconciliation case.

### Ledger transitions

| Provider result | `payment_refund.status` | `payment_attempt.status` | Xử lý |
|---|---|---|---|
| Thành công (`00`/`00`) | `SUCCEEDED` | `REFUNDED` | Lưu provider refund reference và `completedAt` |
| Đang xử lý (`00`/`05`, `00`/`06`, hoặc `94`) | `PENDING` | `REFUND_PENDING` | Không báo hoàn tất sớm |
| Provider từ chối | `FAILED` | `PAID` | Lưu failure code/message và `completedAt` |
| Timeout, lỗi HTTP, chữ ký sai hoặc response mismatch | `MANUAL_REVIEW` | `REFUND_PENDING` | Mở reconciliation case `REFUND_PROVIDER_RESULT_UNKNOWN` |

### Idempotency and concurrency

- Dùng PostgreSQL transaction advisory lock theo refund idempotency key trước khi đọc/tạo ledger row.
- Retry cùng key và cùng payload trả lại row cũ với `replayed=true`, không gọi VNPay lần hai.
- Cùng key nhưng payload khác trả `409` với error code `5107`.

### Configuration

Các biến cấu hình mới/được chuẩn hóa:

```dotenv
PAYMENT_REFUND_SANDBOX_AUTO_APPROVE=false
VNPAY_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_TMN_CODE=YOUR_VNPAY_SANDBOX_TMN_CODE
VNPAY_HASH_SECRET=YOUR_VNPAY_SANDBOX_HASH_SECRET
VNPAY_REFUND_CREATE_BY=CinePrime
VNPAY_REFUND_IP_ADDRESS=127.0.0.1
```

`PAYMENT_REFUND_SANDBOX_AUTO_APPROVE` mặc định là `false`. Chỉ bật `true` khi cố ý dùng local/demo flow không gọi provider.

---

## API Contract

Endpoint Internal Refund đã có sẵn và được giữ nguyên:

```http
POST http://localhost:8083/api/payments/internal/refunds
X-Internal-Service-Key: 7A479S6n/60k7IM9Tpjq3Mu/25j6EzBba+rTOtzih7y6QEjO7j58m7O2NCJdiJxV
Content-Type: application/json
```

```json
{
  "bookingId": "refund-provider-booking-001",
  "paymentReference": "REFUND-VNPAY-TXN-001",
  "amount": 100000.00,
  "currency": "VND",
  "reasonCode": "CUSTOMER_CANCELLATION",
  "reason": "Customer cancelled the booking",
  "idempotencyKey": "postman-refund-success-001"
}
```

Response khi provider hoàn tiền thành công:

```json
{
  "code": 1000,
  "message": "Refund request processed.",
  "result": {
    "refundId": "7b55d7be-47d7-4d8b-9ed6-8a8ba01c0260",
    "bookingId": "refund-provider-booking-001",
    "providerRefundReference": "260000000001",
    "status": "SUCCEEDED",
    "amount": 100000.00,
    "currency": "VND",
    "completedAt": "2026-08-02T22:00:00+07:00",
    "replayed": false
  }
}
```

Response khi VNPay vẫn đang xử lý:

Request (VNPay trả `vnp_ResponseCode=94` hoặc transaction status `05`/`06`):

```http
POST http://localhost:8083/api/payments/internal/refunds
X-Internal-Service-Key: 7A479S6n/60k7IM9Tpjq3Mu/25j6EzBba+rTOtzih7y6QEjO7j58m7O2NCJdiJxV
Content-Type: application/json
```

```json
{
  "bookingId": "refund-provider-booking-001",
  "paymentReference": "REFUND-VNPAY-TXN-001",
  "amount": 100000.00,
  "currency": "VND",
  "reasonCode": "CUSTOMER_CANCELLATION",
  "reason": "Postman provider pending test",
  "idempotencyKey": "postman-refund-pending-001"
}
```

```json
{
  "code": 1000,
  "message": "Refund request processed.",
  "result": {
    "refundId": "85b5a542-2728-4f9c-91d0-51d3468f0260",
    "bookingId": "refund-provider-booking-001",
    "providerRefundReference": "260000000002",
    "status": "PENDING",
    "amount": 100000.00,
    "currency": "VND",
    "completedAt": null,
    "replayed": false
  }
}
```

Response khi provider từ chối:

Request (VNPay trả response code từ chối, ví dụ `95`):

```http
POST http://localhost:8083/api/payments/internal/refunds
X-Internal-Service-Key: 7A479S6n/60k7IM9Tpjq3Mu/25j6EzBba+rTOtzih7y6QEjO7j58m7O2NCJdiJxV
Content-Type: application/json
```

```json
{
  "bookingId": "refund-provider-booking-001",
  "paymentReference": "REFUND-VNPAY-TXN-001",
  "amount": 100000.00,
  "currency": "VND",
  "reasonCode": "CUSTOMER_CANCELLATION",
  "reason": "Postman provider rejection test",
  "idempotencyKey": "postman-refund-failed-001"
}
```

```json
{
  "code": 1000,
  "message": "Refund request processed.",
  "result": {
    "refundId": "e54b77a2-9d80-441b-bda9-58b69b230260",
    "bookingId": "refund-provider-booking-001",
    "providerRefundReference": "260000000003",
    "status": "FAILED",
    "amount": 100000.00,
    "currency": "VND",
    "completedAt": "2026-08-02T22:01:00+07:00",
    "replayed": false
  }
}
```

Response khi không xác định được kết quả authoritative:

Request (dùng khi provider timeout, lỗi HTTP, thiếu cấu hình hoặc response sai chữ ký):

```http
POST http://localhost:8083/api/payments/internal/refunds
X-Internal-Service-Key: 7A479S6n/60k7IM9Tpjq3Mu/25j6EzBba+rTOtzih7y6QEjO7j58m7O2NCJdiJxV
Content-Type: application/json
```

```json
{
  "bookingId": "refund-provider-booking-001",
  "paymentReference": "REFUND-VNPAY-TXN-001",
  "amount": 100000.00,
  "currency": "VND",
  "reasonCode": "CUSTOMER_CANCELLATION",
  "reason": "Postman provider unknown result test",
  "idempotencyKey": "postman-refund-unknown-001"
}
```

```json
{
  "code": 1000,
  "message": "Refund request processed.",
  "result": {
    "refundId": "b820341e-aae3-4a8e-9931-c5d2b3c00260",
    "bookingId": "refund-provider-booking-001",
    "providerRefundReference": null,
    "status": "MANUAL_REVIEW",
    "amount": 100000.00,
    "currency": "VND",
    "completedAt": null,
    "replayed": false
  }
}
```

---

## Postman Manual Test Cases

### Phân biệt rõ dữ liệu nào cho kết quả nào

| Dữ liệu/điều kiện test | Request sử dụng | Kết quả đúng | Giải thích |
|---|---|---|---|
| Chạy nguyên file `payment-provider-refund-fixtures.sql` với `REFUNDTEST260001` và `REFUND-VNPAY-TXN-001` | `postman-refund-failed-001` | `FAILED`, DB có `failure_code=91` | Đây là mã local giả, VNPay không tìm thấy giao dịch |
| Dùng đúng `provider_txn_ref`, `provider_transaction_id`, `provider_created_at` của giao dịch VNPay sandbox đã thanh toán thật | `postman-refund-success-001` | `SUCCEEDED` | Provider chấp nhận hoàn tiền thật |
| VNPay trả `vnp_ResponseCode=94` hoặc transaction status `05`/`06` | `postman-refund-pending-001` | `PENDING` | Yêu cầu đã được nhận nhưng provider/ngân hàng vẫn đang xử lý |
| VNPay trả response từ chối, ví dụ `95` | `postman-refund-failed-001` | `FAILED` | Provider xác nhận không thực hiện refund |
| Timeout, lỗi HTTP, response sai chữ ký/sai transaction binding hoặc thiếu cấu hình | `postman-refund-unknown-001` | `MANUAL_REVIEW` | Không có kết quả authoritative nên không được báo thành công/thất bại sớm |

Với dữ liệu đang có trong repository, case có thể chạy ngay và có kết quả authoritative là `FAILED/91`. Case `SUCCEEDED` không dùng dữ liệu giả trong SQL; phải thay bằng giao dịch VNPay sandbox thật. `PENDING` và `MANUAL_REVIEW` cũng không được quyết định bởi nội dung JSON request mà phụ thuộc response/lỗi thực tế từ provider.

Ba request `PENDING`, `FAILED` và `MANUAL_REVIEW` ở trên minh họa payload ứng với từng kết quả, nhưng payload không thể ép VNPay trả một trạng thái cụ thể; kết quả authoritative do provider quyết định. Nếu dùng chung payment fixture, chạy lại `scripts/testing/payment-provider-refund-fixtures.sql` trước mỗi case để xóa refund/reconciliation của case trước và đưa payment về `PAID`.

Trước khi test, chạy file sau trên database `payment_db`:

```text
scripts/testing/payment-provider-refund-fixtures.sql
```

Fixture tạo payment `PAID` cố định cho account `15fcb315-bcc3-4c91-a4d6-c3449ffc1928`:

```text
paymentId=refund-provider-payment-001
bookingId=refund-provider-booking-001
paymentReference=REFUND-VNPAY-TXN-001
providerTxnRef=REFUNDTEST260001
amount=100000.00
currency=VND
status=PAID
```

Fixture trên loại bỏ lỗi `5103 Payment attempt was not found` và cho phép kiểm tra bước lookup/idempotency. `REFUNDTEST260001`/`REFUND-VNPAY-TXN-001` không phải giao dịch do VNPay sandbox phát hành, vì vậy không được kỳ vọng provider trả `SUCCEEDED`; sau khi chữ ký response được xác minh đúng, VNPay thường trả `FAILED` với code `91` (không tìm thấy giao dịch). Không thể tạo giao dịch VNPay hợp lệ chỉ bằng cách insert SQL. Để nhận `SUCCEEDED` từ Provider Refund API thật, trước tiên phải thanh toán thành công qua VNPay sandbox, sau đó dùng đúng `provider_txn_ref`, `provider_transaction_id` và `provider_created_at` của giao dịch đó.

Tạo các environment variables:

```text
paymentUrl=http://localhost:8083
internalServiceKey=7A479S6n/60k7IM9Tpjq3Mu/25j6EzBba+rTOtzih7y6QEjO7j58m7O2NCJdiJxV
paidBookingId=refund-provider-booking-001
paymentReference=REFUND-VNPAY-TXN-001
refundAmount=100000.00
```

Các `refundId`, `providerRefundReference` và timestamp trong response mẫu là giá trị cụ thể để mô tả đầy đủ response; khi chạy thật, Payment Service và VNPay sẽ sinh giá trị khác.

`internalServiceKey` phía trên là key của môi trường local hiện tại. Không sử dụng hoặc đưa key này lên môi trường production.

### 1. Provider refund thành công

```http
POST {{paymentUrl}}/api/payments/internal/refunds
X-Internal-Service-Key: {{internalServiceKey}}
Content-Type: application/json
```

```json
{
  "bookingId": "refund-provider-booking-001",
  "paymentReference": "REFUND-VNPAY-TXN-001",
  "amount": 100000.00,
  "currency": "VND",
  "reasonCode": "CUSTOMER_CANCELLATION",
  "reason": "Postman provider refund success test",
  "idempotencyKey": "postman-refund-success-001"
}
```

Expected khi đã thay fixture bằng giao dịch VNPay sandbox thật: HTTP `200`, `result.status=SUCCEEDED`, `result.replayed=false`, có `providerRefundReference` và `completedAt`. Trong DB, `payment_refund.status=SUCCEEDED`, `payment_attempt.status=REFUNDED`.

Điều kiện: phải dùng VNPay sandbox credentials và một giao dịch sandbox đã thanh toán thành công, còn đủ số tiền để hoàn.

### 2. Retry đúng cùng request

Gửi lại nguyên request case 1, bao gồm cùng `idempotencyKey`.

Expected: HTTP `200`, cùng `refundId`, `result.replayed=true`; VNPay không bị gọi thêm lần nữa và DB không có refund row thứ hai.

### 3. Tái sử dụng key với payload khác

Giữ `idempotencyKey=postman-refund-success-001` nhưng thay `reason` hoặc `amount`.

Expected: HTTP `409`.

```json
{
  "code": 5107,
  "message": "Idempotency key was reused for a different payment request."
}
```

### 4. Payment không tồn tại

```json
{
  "bookingId": "missing-booking",
  "paymentReference": "missing-payment",
  "amount": 100000.00,
  "currency": "VND",
  "reasonCode": "CUSTOMER_CANCELLATION",
  "reason": "Payment not found test",
  "idempotencyKey": "postman-refund-missing-001"
}
```

Expected: HTTP `404`.

```json
{
  "code": 5103,
  "message": "Payment attempt was not found."
}
```

### 5. Payment không đủ điều kiện hoặc sai reference

Dùng booking tồn tại nhưng `paymentReference` sai, hoặc payment không ở `PAID`/`REFUND_PENDING`/`REFUNDED`.

Expected: HTTP `409`.

```json
{
  "code": 5113,
  "message": "This payment is not eligible for refund."
}
```

### 6. Refund amount vượt payment amount

Dùng payment hợp lệ nhưng gửi `amount` lớn hơn `payment_attempt.amount`.

Expected: HTTP `409`.

```json
{
  "code": 5114,
  "message": "Refund amount exceeds the paid amount."
}
```

### 7. Provider timeout/mất kết nối

Đặt `VNPAY_API_URL` thành URL không truy cập được, restart Payment Service, sau đó gửi một request mới với payment hợp lệ và idempotency key mới.

Expected: HTTP `200`, `result.status=MANUAL_REVIEW`, `completedAt=null`. Trong DB, refund có `failure_code=HTTP_ERROR`, payment chuyển `REFUND_PENDING`, đồng thời có reconciliation case reason `REFUND_PROVIDER_RESULT_UNKNOWN`.

Không gửi lại case này bằng key mới khi chưa đối soát, vì provider có thể đã nhận request trước lúc kết nối bị ngắt.

### 8. Provider configuration thiếu

Để trống `VNPAY_TMN_CODE` hoặc `VNPAY_HASH_SECRET`, restart service và gửi request mới.

Expected: HTTP `200`, `result.status=MANUAL_REVIEW`; refund ledger có `failure_code=NOT_CONFIGURED`, không bị đánh dấu `SUCCEEDED` giả.

---

## Automated Tests

```powershell
cd server
mvn.cmd -pl payment-service clean test
```

Kết quả: `13 tests`, `0 failures`, `0 errors`.

- `VnpayRefundSignerTest`: thứ tự canonical fields, HMAC response validation và response có optional field `null` được canonicalize thành chuỗi rỗng theo contract.
- `VnpayRefundGatewayTest`: signed success, provider rejection và invalid signature.
- `PaymentProviderRefundServiceTest`: ledger success, pending, failure, unknown/manual reconciliation và idempotent replay không gọi provider lần hai.
- `VnpaySignerTest`: payment signing regression tests vẫn pass.

---

## Checklist

- [x] Gửi HTTP request theo contract VNPay Refund API.
- [x] Ký request và xác thực response bằng HMAC-SHA512 riêng cho refund.
- [x] Cập nhật refund/payment ledger cho success, pending, failed và unknown.
- [x] Duplicate retry không gọi provider hoặc tạo ledger row lần hai.
- [x] Migration giữ tương thích dữ liệu payment cũ.
- [x] Docker Compose và `.env.example` có đủ provider refund configuration.
- [x] Unit/component tests pass.
- [ ] Chưa gọi refund thật trên VNPay sandbox trong phiên làm việc này vì không sử dụng merchant credentials hoặc giao dịch thật của người dùng.
