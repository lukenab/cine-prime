# P1 — Hướng dẫn demo giữ ghế real-time

## 1. Mục tiêu demo

Chứng minh bốn giá trị chính:

1. hai khách không thể giữ cùng một ghế;
2. thay đổi ghế được đồng bộ gần real-time;
3. countdown và expiry do server quyết định;
4. hệ thống có retry, quan sát và đối soát để vận hành ổn định.

---

## 2. Tiền điều kiện

- PostgreSQL đã chạy migration `V51__seat_hold_realtime_operations.sql`.
- Kafka, discovery service, API Gateway, movie-service và client đang chạy.
- API Gateway có route `/ws/seat-inventory/**`.
- Có một customer account đăng nhập.
- Có showtime trạng thái `ON_SALE`.
- Showtime đã materialize `showtime_seat` từ active room layout.
- Giá của từng `showtime_seat` đã là final price snapshot.

Kiểm tra nhanh:

```http
GET http://localhost:8080/api/showtimes/{showtimeId}/seat-map
```

Nếu response không có seat inventory thì phải sửa bước publish/materialize showtime trước khi demo P1.

---

## 3. Demo bằng UI

### Kịch bản A — Countdown từ server

1. Đăng nhập customer.
2. Chọn một showtime `ON_SALE`.
3. Chọn 1–2 ghế.
4. Quan sát Order Summary và countdown.
5. Mở Network, kiểm tra response tạo hold có `expiresAt`.
6. Reload trang.

Kết quả mong đợi:

- countdown được tính lại từ cùng `expiresAt`;
- reload không tạo thêm TTL mới;
- quá hạn thì UI không cho tiếp tục thanh toán và tải lại seat map.

### Kịch bản B — Concurrent hold

1. Mở cùng showtime ở hai trình duyệt hoặc một cửa sổ thường và một cửa sổ ẩn danh.
2. Tài khoản A giữ ghế A1.
3. Tài khoản B đang mở cùng seat map.
4. Quan sát B nhận update và tải lại seat map.
5. Nếu B gửi hold A1 trước khi UI kịp cập nhật, backend vẫn phải từ chối.

Kết quả mong đợi:

- chỉ một hold thành công;
- request còn lại nhận conflict;
- không có hai owner cho cùng một `showtime_seat`.

### Kịch bản C — Hủy và đổi ghế

1. A giữ A1 và A2.
2. Nhấn **Change seats**.
3. Hold cũ được release, seat map reload.
4. Chọn B1 và B2, tạo hold mới.
5. Nhấn **Cancel selection**.

Kết quả mong đợi:

- hold cũ không bị tái sử dụng;
- selection mới có hold ID và idempotency key mới;
- trình duyệt còn lại thấy `seat.released`;
- các ghế trở lại trạng thái available.

### Kịch bản D — Reconnect

1. Giữ một ghế.
2. Trong DevTools chuyển Network sang Offline.
3. Ở trình duyệt khác, giữ hoặc release ghế khác.
4. Bật Network Online.

Kết quả mong đợi:

- UI hiển thị `Reconnecting`;
- sau reconnect, UI tải lại toàn bộ seat map từ REST;
- không chỉ replay thay đổi nhận qua socket;
- state cuối trùng database.

### Kịch bản E — Giới hạn số ghế

1. Gọi policy API và ghi nhận `maxSeatsPerBooking`.
2. Chọn nhiều hơn giới hạn.

Kết quả mong đợi:

- UI ngăn selection vượt giới hạn;
- nếu bypass UI thì backend vẫn từ chối.

---

## 4. Demo bằng Postman

### 4.1 Policy

```http
GET http://localhost:8080/api/showtimes/seat-hold-policy
X-Booking-Channel: WEB
```

Mong đợi:

```json
{
  "code": 1000,
  "result": {
    "channel": "WEB",
    "ttlSeconds": 600,
    "maxSeatsPerBooking": 8
  }
}
```

Đổi channel thành `MOBILE` hoặc `COUNTER` để chứng minh TTL không hard-code.

### 4.2 Tạo hold

```http
POST http://localhost:8080/api/showtimes/{{showtimeId}}/seat-holds
Authorization: Bearer {{customerToken}}
Idempotency-Key: demo-hold-001
X-Booking-Channel: WEB
Content-Type: application/json
```

```json
{
  "seatIds": [{{seatId1}}, {{seatId2}}]
}
```

Lưu:

- `result.holdId`;
- `result.expiresAt`;
- `result.totalPrice`.

### 4.3 Chứng minh idempotency

Gửi lại đúng request và cùng:

```http
Idempotency-Key: demo-hold-001
```

Mong đợi:

```json
"replayed": true
```

Đổi `seatIds` nhưng giữ key cũ. Mong đợi code `2128`.

### 4.4 Hủy hold

```http
DELETE http://localhost:8080/api/showtimes/{{showtimeId}}/seat-holds/{{holdId}}
Authorization: Bearer {{customerToken}}
```

### 4.5 Xác nhận SOLD

Chỉ dùng để demo inventory hoặc gọi từ backend booking:

```http
POST http://localhost:8080/api/showtimes/{{showtimeId}}/seat-holds/{{holdId}}/confirm
Authorization: Bearer {{customerToken}}
Content-Type: application/json
```

```json
{
  "bookingId": "demo-booking-001"
}
```

Trong production, customer UI không được gọi trực tiếp bước này.

---

## 5. Demo WebSocket

Kết nối:

```text
ws://localhost:8080/ws/seat-inventory?showtimeId={{showtimeId}}
```

Thực hiện hold, release và confirm từ Postman.

Chỉ được thấy:

```text
seat.held
seat.released
seat.sold
```

Điểm cần nói khi demo:

> Socket chỉ báo “inventory đã thay đổi”. UI vẫn gọi REST để lấy trạng thái cuối cùng, nên mất event hoặc nhận event lặp không làm sai ghế.

---

## 6. Demo rate limit và retry

### Rate limit

Gửi liên tiếp request tạo hold trong cùng rate window.

Mong đợi khi vượt quota:

- HTTP `429`;
- error code `2143`;
- database không tạo thêm hold.

### Lock timeout/deadlock

Kịch bản kỹ thuật:

1. giữ transaction lock trên cùng `showtime_seat`;
2. gửi request hold cạnh tranh;
3. chờ lock timeout.

Mong đợi:

- HTTP `503`;
- code `2144`;
- header `Retry-After: 1`;
- payload có `retryable: true`;
- retry dùng lại idempotency key ban đầu.

---

## 7. Demo metrics

Prometheus endpoint:

```http
GET http://localhost:8081/actuator/prometheus
```

Tìm:

```text
seat_holds_created_total
seat_holds_released_total
seat_holds_expired_total
seat_hold_conflicts_total
seat_holds_sold_total
seat_hold_reconciliation_mismatches_total
seat_holds_active
seat_hold_conversion_to_paid_ratio
```

Trình tự dễ demo:

1. ghi lại metric ban đầu;
2. tạo hold;
3. tạo conflict ở trình duyệt thứ hai;
4. release hoặc chờ expiry;
5. tạo hold khác và confirm;
6. tải lại metrics và so sánh.

---

## 8. Demo outbox

Sau khi hold:

```sql
SELECT id, event_id, event_type, showtime_id, published_at, retry_count
FROM seat_inventory_outbox
ORDER BY created_at DESC;
```

Mong đợi:

- event được ghi cùng business operation;
- publisher điền `published_at`;
- khi Kafka tạm dừng, record vẫn còn để retry;
- khi Kafka hoạt động lại, event được publish.

Topic:

```text
seat.inventory.events.v1
```

---

## 9. Demo reconciliation

Trong môi trường demo riêng, có thể chuẩn bị một record RESERVED thiếu owner hoặc expiry rồi chạy job.

Mong đợi:

- record được trả về AVAILABLE;
- phát `seat.released`;
- mismatch metric tăng.

Với SOLD thiếu `bookingId`:

- job chỉ log/manual review;
- không tự release ghế;
- tránh bán trùng ghế có thể đã thanh toán.

---

## 10. Kịch bản báo cáo ngắn

> Khi khách chọn ghế, frontend gửi REST request có account, channel và idempotency key. Movie-service lock toàn bộ selection trong một transaction, kiểm tra ownership và availability rồi trả `expiresAt` do server quyết định. Mọi thay đổi inventory được ghi cùng transactional outbox và phát ba event `held`, `released`, `sold`. Socket chỉ báo thay đổi; client luôn tải lại seat map từ REST, kể cả sau reconnect. Hệ thống có giới hạn ghế, rate limit ba chiều, stable retry contract, metrics và reconciliation. Phần inventory P1 đã hoàn tất; bước tiếp theo là nối consumer nghiệp vụ ở booking và payment để hoàn thiện saga thanh toán end-to-end.

---

## 11. Giới hạn cần công bố

Không demo như production-complete nếu chưa có:

- booking-service tạo pending booking từ hold;
- payment-service xác nhận/thất bại;
- compensation release hold;
- consumer idempotent cho outbox events;
- cross-service reconciliation;
- integration test thật từ hold đến PAID.

Cho đến lúc đó, endpoint confirm chỉ chứng minh inventory transition, không thay thế luồng thanh toán.

