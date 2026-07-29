# Kịch bản demo luồng đặt vé CinePrime

> Cập nhật: 30/07/2026
> Phạm vi: integration demo cho customer booking happy path trên môi trường local + VNPAY Sandbox.

## 1. Kết luận sẵn sàng demo

Luồng hiện tại đủ để demo:

```text
Chọn phim/rạp
→ chọn suất ON_SALE
→ chọn ghế
→ giữ ghế atomically
→ tạo PENDING_PAYMENT booking
→ thanh toán VNPAY Sandbox
→ CONFIRMED
→ xem vé/QR pass
```

Đã xác minh trên môi trường tích hợp:

- API Gateway và các service chính đang phản hồi.
- Public schedule API chỉ trả suất `ON_SALE`.
- Tại thời điểm kiểm tra có `42` suất `ON_SALE`, trong đó `34` suất từ ngày 29/07/2026 trở đi.
- Quick Booking lấy phim và suất chiếu thật từ API.
- Luồng `Obsession → CinePrime Landmark 81 → 20:15 · Room 4` đã mở thành công trang chọn ghế.
- Seat map được materialize từ active room layout, không dùng fallback 10x10.
- Ghế có trạng thái live và final price snapshot trong khoảng `90.000đ–162.000đ`.
- Hold policy của customer có thời hạn 10 phút.

> Lưu ý: showtime ID có thể thay đổi sau khi seed hoặc publish lại. Không nên phụ thuộc cố định vào `/booking/354`; hãy chọn suất `ON_SALE` đang có ghế từ UI hoặc kết quả preflight.

### Cổng kiểm tra bắt buộc trước buổi demo

Phải diễn tập ít nhất một lượt VNPAY Sandbox hoàn chỉnh:

```text
Create payment session
→ redirect sang VNPAY
→ thanh toán thành công
→ signed return/IPN
→ booking CONFIRMED
→ seat SOLD
→ ticket được phát hành
```

Việc endpoint IPN phản hồi khi gọi không có chữ ký chỉ chứng minh route đã mở, chưa chứng minh round-trip thanh toán hợp lệ.

## 2. Checklist chuẩn bị

### 2.1. Hạ tầng và service

- [ ] PostgreSQL đang chạy.
- [ ] Redis đang chạy.
- [ ] Discovery Server đang chạy.
- [ ] API Gateway đang chạy tại `http://localhost:8080`.
- [ ] Frontend đang chạy tại `http://localhost:3000`.
- [ ] `movie-service`, `booking-service`, `payment-service`, `auth-service` đều healthy.
- [ ] Không bật mock booking/payment fallback.

Chạy preflight không làm thay đổi dữ liệu:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\demo\verify-booking-demo.ps1
```

Nếu muốn kiểm tra cả đường public qua ngrok:

```powershell
powershell -ExecutionPolicy Bypass `
  -File .\scripts\demo\verify-booking-demo.ps1 `
  -NgrokBaseUrl "https://delouse-lather-ferry.ngrok-free.dev"
```

Preflight phải kết thúc với `READY`. Cảnh báo “signed VNPAY round-trip chưa được kiểm tra tự động” là bình thường và phải được xử lý bằng diễn tập thủ công.

### 2.2. VNPAY Sandbox

- [ ] `TMN Code` và `Hash Secret` đã được nạp vào `payment-service`.
- [ ] ngrok đang forward đến API Gateway `localhost:8080`.
- [ ] IPN URL:

```text
https://<ngrok-domain>/api/payments/vnpay/ipn
```

- [ ] Return URL:

```text
https://<ngrok-domain>/api/payments/vnpay/return
```

- [ ] Đã thanh toán thử thành công ít nhất một lần trước giờ demo.
- [ ] Đã kiểm tra callback lặp lại không confirm booking hoặc phát hành vé lần hai.
- [ ] Nếu dùng ngrok bản miễn phí: đã bấm "Visit Site" trên trang cảnh báo `ERR_NGROK_6024` ít nhất một lần bằng đúng trình duyệt sẽ dùng để demo (cảnh báo chỉ hiện một lần cho mỗi trình duyệt, không phải một lần vĩnh viễn — Incognito hoặc trình duyệt khác sẽ gặp lại).

### 2.3. Dữ liệu và tài khoản

- [ ] Có tài khoản `CUSTOMER` đã hoàn thiện profile và đăng nhập sẵn.
- [ ] Có ít nhất một phim customer-visible.
- [ ] Có suất chiếu `ON_SALE` trong ngày 29/07 hoặc 30/07.
- [ ] Showtime đã có `showtime_seat`, ghế `AVAILABLE` và giá lớn hơn 0.
- [ ] Mở sẵn `/my-bookings` trong một tab dự phòng.
- [ ] Nếu demo check-in: có tài khoản `EMPLOYEE` được phân quyền đúng cinema cluster.

## 3. Luồng demo chính trên UI

### Bước 1 — Chọn suất chiếu

Tại homepage:

1. Chọn `CinePrime Landmark 81`.
2. Chọn ngày đang có suất mở bán.
3. Chọn phim `Obsession` hoặc một phim khác mà preflight tìm được.
4. Chọn một suất `ON_SALE`, ví dụ `20:15 · Room 4`.
5. Nhấn `Choose seats`.

Có thể giới thiệu hai entry point:

- **Movie-first:** `Now Showing → Buy tickets`.
- **Cinema-first:** chọn cinema cluster rồi xem lịch đang mở bán.

Điểm trình bày:

- Customer chỉ thấy suất đang mở bán, không thấy draft/internal/suspended showtime.
- Ngày, rạp, phim và suất chiếu đều lấy từ API thật.
- Hệ thống nhiều chi nhánh vẫn dùng cùng flow nhưng inventory được tách theo showtime và room.

### Bước 2 — Chọn và giữ ghế

Tại `/booking/{showtimeId}`:

1. Giới thiệu phim, rạp, phòng và thời gian bắt đầu.
2. Chỉ ra inventory connection đang ở trạng thái `Live`.
3. Chọn 1–2 ghế `AVAILABLE`.
4. Kiểm tra Order Summary:
   - mã ghế;
   - loại ghế;
   - giá snapshot;
   - tổng tiền.
5. Nhấn `Confirm Booking`.

Kết quả mong đợi:

- Selection được giữ theo cơ chế all-or-nothing.
- Ghế chuyển `AVAILABLE → HELD`.
- Hold gắn với customer, có `holdId`, thời hạn và idempotency key.
- Booking Service tạo booking `PENDING_PAYMENT`.
- UI hiển thị countdown theo thời gian hết hạn của hold.
- Giá và tổng tiền do server trả về; browser không tự quyết định giá.

Giải thích ngắn khi báo cáo:

> Movie Service là nguồn tồn kho ghế và final seat price duy nhất. Booking Service điều phối việc hold rồi lưu snapshot giao dịch, không đọc hoặc cập nhật trực tiếp database của Movie Service.

### Bước 3 — Thanh toán VNPAY Sandbox

1. Tại checkout, kiểm tra countdown còn hiệu lực.
2. Chọn VNPAY và nhấn thanh toán.
3. Hoàn tất giao dịch bằng tài khoản/thẻ Sandbox.
4. Chờ redirect trở lại CinePrime.
5. Không đóng tab trước khi UI hiển thị kết quả cuối cùng.

Kết quả mong đợi:

| Aggregate | Trước thanh toán | Sau callback hợp lệ |
|---|---|---|
| Payment | `INITIATED` | `PAID` |
| Booking | `PENDING_PAYMENT` | `CONFIRMED` |
| Seat inventory | `HELD` | `SOLD` |

Điểm trình bày:

- Payment Service xác minh chữ ký và số tiền trước khi phát outcome.
- Callback được deduplicate bằng provider event/inbox.
- Gửi lại cùng callback không được confirm inventory hoặc phát hành vé lần hai.

### Bước 4 — Kiểm tra vé

1. Mở `My Bookings`.
2. Chọn booking vừa tạo — trang checkout tự chuyển sang giao diện vé điện tử dạng ngang (boarding-pass) khi booking đã `CONFIRMED`.
3. Kiểm tra trên vé:
   - mã booking, mã vé;
   - phim, poster, age rating, thời lượng và thể loại;
   - tên và địa chỉ đầy đủ cụm rạp, phòng chiếu;
   - giờ bắt đầu **và giờ kết thúc** suất chiếu (tính từ thời lượng phim);
   - ghế, tên người đặt vé, phương thức thanh toán (ví dụ "NCB · Domestic ATM card");
   - QR/ticket pass ở phần "cuống vé" bên phải, ngăn cách bằng đường xé vé.

Giải thích:

> Booking lưu snapshot giao dịch nên lịch sử vé không bị thay đổi nếu catalog phim, tên phòng hoặc bảng giá được cập nhật sau đó. Các trường như thời lượng phim, age rating, địa chỉ rạp, tên người đặt và phương thức thanh toán được làm giàu tại thời điểm đọc từ Movie Service, User Service và Payment Service — xem mục "Làm giàu thông tin vé" trong [FEATURE_BRIEF.md](FEATURE_BRIEF.md).

### Bước 4b — Yêu cầu hoàn vé (tùy chọn)

1. Trên vé vừa xem, bấm **"Request a refund"** (nút này chỉ hiện nhãn này khi booking đã `CONFIRMED`/`CONFIRM_PENDING`; với booking chưa thanh toán nút vẫn là "Cancel booking").
2. Chọn 1 lý do trong dropdown (ví dụ "Booked the wrong showtime or cinema"), có thể ghi thêm chi tiết.
3. Xác nhận gửi yêu cầu.

Kết quả mong đợi:

- Booking chuyển `REFUND_PENDING` theo BR-CAN-02.
- Refund amount do server tính, không nhận từ client.
- Modal hiển thị đúng cảnh báo "A refund may be required" kèm số tiền dự kiến.

### Bước 5 — Check-in tùy chọn

Đăng nhập tài khoản `EMPLOYEE` của đúng cinema cluster và quét QR pass.

Kết quả mong đợi:

- Lần đầu check-in thành công.
- Retry cùng idempotency key trả lại kết quả cũ.
- Check-in lại bằng key mới trả conflict.
- Employee của cluster khác bị từ chối.

## 4. Kịch bản báo cáo ngắn

> “Customer có thể bắt đầu theo movie-first hoặc cinema-first. Public API chỉ hiển thị showtime đang ON_SALE. Khi khách xác nhận lựa chọn, Movie Service giữ toàn bộ ghế atomically trong 10 phút; Booking Service tạo một booking PENDING_PAYMENT và lưu snapshot ghế, giá, phí và tổng tiền. Payment Service tạo phiên VNPAY Sandbox, xác minh signed callback rồi mới phát kết quả thanh toán. Chỉ sau payment outcome hợp lệ, ghế chuyển HELD sang SOLD, booking chuyển CONFIRMED và ticket được phát hành. Idempotency bảo vệ các thao tác retry; expiry và compensation trả ghế về AVAILABLE khi giao dịch không hoàn tất.”

## 5. Nhánh lỗi và cách trình bày

| Tình huống | Kết quả mong đợi | Cách phục hồi khi demo |
|---|---|---|
| Ghế vừa được customer khác giữ | Trả conflict; không hold một phần và không tạo booking lỗi | Refresh seat map và chọn ghế khác |
| Hold hết hạn trước payment | Booking `EXPIRED`; ghế trở lại `AVAILABLE` | Chọn lại ghế và tạo booking mới |
| Thanh toán thất bại | Không bán ghế; hold được release/expire | Quay lại lịch chiếu và thử lại |
| Nhấn xác nhận/thanh toán lặp | Không tạo booking/payment trùng | Hiển thị lại aggregate đã tạo |
| Callback VNPAY gửi lặp | Inbox replay; không confirm/ticket hai lần | Kiểm tra booking vẫn chỉ có một ticket |
| Payment success đến sau expiry | Tạo reconciliation case; không chiếm lại ghế đã bán cho người khác | Không tự động xác nhận; xử lý reconciliation |
| Không thấy suất chiếu | Showtime không `ON_SALE`, sai ngày/rạp hoặc đã hết thời gian bán | Chọn candidate do preflight đề xuất |
| Bị chuyển sang login | Booking yêu cầu customer authenticated | Đăng nhập trước khi bắt đầu demo |
| Lỗi VNPAY | Sai credential/callback, payment-service hoặc ngrok không hoạt động | Kiểm tra TMN Code, Hash Secret, gateway và ngrok |
| Redirect sau OTP dừng ở trang "You are about to visit" của ngrok | Cảnh báo chống-lạm-dụng mặc định của ngrok bản miễn phí trên domain public, không phải lỗi hệ thống | Bấm "Visit Site" để trình duyệt tiếp tục tới `/api/payments/vnpay/return` với các tham số `vnp_*` đã ký còn nguyên; không cần thanh toán lại |

## 6. API minh họa idempotency

### Tạo booking

```http
POST {{baseUrl}}/api/bookings
Authorization: Bearer {{customerToken}}
Idempotency-Key: demo-booking-001
Content-Type: application/json
```

```json
{
  "showtimeId": 354,
  "seatIds": [1001, 1002]
}
```

- Gửi lại cùng key và cùng payload: nhận lại cùng booking.
- Giữ key nhưng đổi payload: nhận `409 Conflict`.
- ID trong ví dụ phải được thay bằng ID thật lấy từ preflight/seat map.

### Duplicate payment callback

Provider gửi lại cùng `source + eventId`.

Kỳ vọng:

- inbox trả lại kết quả xử lý trước;
- inventory không bị confirm lần hai;
- không phát hành thêm ticket.

## 7. Phạm vi có thể tuyên bố

Có thể trình bày:

> “Đây là integration demo hoàn chỉnh của customer booking happy path trên VNPAY Sandbox.”

Chưa nên trình bày hệ thống là production-ready cho đến khi hoàn thành:

- full Docker E2E và race/load suite;
- race test expiry/payment và cancellation/payment;
- signed VNPAY callback rehearsal ổn định;
- production merchant/refund credentials và secret management;
- observability, alert và reconciliation operations đầy đủ;
- promotion, loyalty và concession checkout;
- POS UI hoàn chỉnh.

## 8. Checklist ngay trước khi trình bày

- [ ] Preflight trả `READY`.
- [ ] Có candidate showtime `ON_SALE` và ghế `AVAILABLE`.
- [ ] Customer đã đăng nhập.
- [ ] VNPAY Sandbox round-trip đã diễn tập.
- [ ] Ngrok domain hiện tại khớp cấu hình callback.
- [ ] `/my-bookings` tải được dữ liệu.
- [ ] Có phương án dự phòng dùng một showtime/customer khác.
- [ ] Không sử dụng showtime ID hard-code nếu dữ liệu vừa được seed lại.

## 9. Tài liệu liên quan

- [Booking feature brief](FEATURE_BRIEF.md)
- [Booking business rules](BUSINESS_RULES.md)
- [Booking API list](API_LIST.md)
- [Booking technical specification](TECHNICAL_SPECIFICATION.md)
- [P0/P1 implementation status](P0_P1_IMPLEMENTATION_STATUS.md)
