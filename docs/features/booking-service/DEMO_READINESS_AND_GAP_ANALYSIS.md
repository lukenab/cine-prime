# Booking & Booking-Management — Demo Readiness & Gap Analysis

> Ngày viết: 29/07/2026
> Phạm vi: luồng đặt vé cho customer, luồng quản lý booking cho admin/employee, in vé, promotion, concession — đối chiếu với thông lệ ngành rạp chiếu phim đa chi nhánh (VN + quốc tế).
> Tài liệu liên quan: [P0_P1_IMPLEMENTATION_STATUS.md](P0_P1_IMPLEMENTATION_STATUS.md) (tình trạng backend/payment core), [BOOKING_SERVICE_PRODUCT_ISSUES.md](BOOKING_SERVICE_PRODUCT_ISSUES.md) (thiết kế lại booking-service), [BUSINESS_RULES.md](BUSINESS_RULES.md).
> Cách dùng tài liệu: mỗi gap có checkbox `- [ ]`. Khi fix xong, tick và ghi ngày/PR. Không xoá mục đã fix — giữ lại làm changelog.

## 1. Trả lời thẳng câu hỏi demo

| Luồng | Demo được không | Ghi chú |
|---|---|---|
| Customer: browse → chọn ghế → giữ ghế → thanh toán → nhận vé | **Có** | Đây là phần chín nhất của hệ thống. Hold ghế atomic, thanh toán qua VNPAY Sandbox, xác nhận webhook có verify chữ ký, vé cấp dưới dạng token mã hoá (`ctp_...`) hiển thị QR trên màn hình. |
| Admin: xem danh sách booking theo cụm rạp | **Có** | [ManageBookingPage.tsx](../../../client/src/pages/admin/ManageBookingPage.tsx) gọi API thật (`bookingApi.getClusterBookings`), lọc theo cluster, hiển thị trạng thái booking/payment/inventory. |
| Admin: **thao tác** trên booking (huỷ, hoàn tiền, gửi lại vé, check-in) | **Không** | Màn hình tự ghi chú "This screen is read-only. Confirmation, cancellation and refund transitions must be executed through their authoritative payment or cancellation workflow." — tức là admin hiện **không có nút bấm nào** để huỷ/hoàn/check-in; các API đó tồn tại ở backend nhưng chưa có UI gọi tới. |
| Bán vé tại quầy (nhân viên) | **Không** | [TicketSalePage.tsx](../../../client/src/pages/admin/TicketSalePage.tsx) không import bất kỳ module API nào — toàn bộ dữ liệu là mock cứng trong file, bấm "bán vé" không tạo booking thật. |
| In / xuất thông tin vé | **Một phần** | Có QR hiển thị trên trình duyệt (client-side render từ `passToken`), nhưng không có bản in PDF/HTML riêng, không có "in tại quầy" cho nhân viên. |
| Promotion (mã giảm giá) | **Không** | Không tồn tại trên bất kỳ layer nào theo cách hoạt động được — xem mục 4. |
| Concession (bắp nước, combo) | **Không** | Không tồn tại — không có UI, không có bảng dữ liệu sản phẩm, chỉ có 1 bảng DB rỗng chưa ai dùng. |

**Kết luận ngắn gọn:** luồng đặt vé **customer core** đủ chín để demo trực tiếp end-to-end (chọn ghế → thanh toán → nhận vé QR). Luồng **quản lý booking cho admin** chỉ demo được phần "xem", chưa demo được phần "quản lý" (không có thao tác thay đổi trạng thái nào từ UI). Ticket in ấn, promotion, concession đều **chưa sẵn sàng demo** vì thiếu ở nhiều lớp cùng lúc (không chỉ thiếu UI — promotion và concession thiếu cả business logic backend nối vào booking).

## 2. Thông lệ ngành rạp chiếu phim đa chi nhánh (VN + quốc tế) và đối chiếu

Các hãng vận hành nhiều cụm rạp (CGV, Lotte Cinema, Galaxy, BHD ở VN; AMC, Cinemark, Cineworld/Regal ở quốc tế) đều hội tụ về một số pattern kiến trúc/nghiệp vụ, vì chúng giải quyết đúng bài toán "một hệ thống, nhiều chi nhánh, tồn kho không dùng chung":

| Pattern ngành | Lý do | Hiện trạng hệ thống này |
|---|---|---|
| **1 database logic, phân biệt bằng `cluster_id`/branch discriminator** — không tách DB riêng theo từng rạp | Chi nhánh mở/đóng liên tục, cần báo cáo tổng hợp toàn hệ thống theo thời gian thực; tách DB theo rạp làm báo cáo tập trung và swap ca làm việc giữa nhân viên các rạp trở nên phức tạp không cần thiết | **Đúng pattern.** `cinema_cluster` là discriminator xuyên suốt movie-service lẫn booking-service (`BookingClusterAccessPolicy` giới hạn nhân viên theo `cinemaClusterIds` trong JWT). |
| **Tồn kho ghế scope theo từng suất chiếu (showtime), không phải theo phòng vật lý dùng chung** | Một phòng chiếu nhiều suất/ngày, nên "ghế trống" chỉ có nghĩa trong ngữ cảnh 1 suất chiếu cụ thể | **Đúng pattern.** `showtime_seat` được materialize theo từng showtime từ room layout đang active. |
| **Bảng giá đa chiều (Price Book)**: chi nhánh × ngày trong tuần × khung giờ × định dạng (2D/3D/IMAX/4DX) × loại ghế × loại khách | Chi nhánh trung tâm thường giá cao hơn ngoại thành; suất tối/cuối tuần giá cao hơn; định dạng đặc biệt phụ phí | **Đúng pattern**, đã có `price-books` module + `ManagePriceBooksPage`. Giá được snapshot vào booking tại thời điểm hold (không lấy giá từ browser) — đúng thông lệ chống gian lận giá. |
| **Promotion được "giữ chỗ" (reserve) tại thời điểm tạo quote, trừ quota ngay khi áp dụng — không phải trừ sau khi thanh toán xong** | Tránh over-redeem khi nhiều khách cùng dùng 1 mã có giới hạn số lượng trong lúc đang thanh toán song song | **Chưa làm.** Bảng `promotion_reservation` đã tồn tại trong schema booking-service nhưng **không có repository/service/controller nào tham chiếu tới nó** — đúng thiết kế đã được nghĩ tới nhưng chưa triển khai. |
| **Concession là order-line-item độc lập, không gắn với ghế** — khách có thể mua bắp nước không kèm vé (pickup tại quầy riêng), hoặc thêm vào giỏ cùng vé | Concession có luồng vận hành riêng (kho, quầy pha chế) tách khỏi rạp chiếu | **Chưa làm.** Bảng `concession_item` tồn tại, rỗng, không có logic. Không có bất kỳ UI nào (customer lẫn admin). |
| **Vé điện tử = QR/barcode xác thực một lần tại cửa, quét bằng máy nhân viên hoặc kiosk tự phục vụ** | Chống soát vé thủ công, chống dùng lại vé | **Đã có phần lõi**: `TicketPassService`/`TicketPassCodec` tạo token AES-256-GCM, có API check-in ở backend. **Thiếu**: không có màn hình quét/nhập mã cho nhân viên — API check-in tồn tại nhưng chưa có UI nào gọi. |
| **Huỷ vé có cửa sổ thời gian (cutoff) và có thể áp phí/hoàn 1 phần theo tầng (tier)**, không phải nhị phân "huỷ được/không" | Cân bằng giữa trải nghiệm khách và giữ doanh thu suất chiếu sắp diễn ra | **Một phần.** Có cutoff time (`booking.cancel.mins-before-showtime`), nhưng hoàn tiền hiện là toàn phần hoặc không có, chưa có tier phí theo thời điểm huỷ. |
| **Đối soát cuối ngày (reconciliation)** giữa sổ nội bộ và cổng thanh toán, theo từng chi nhánh | Phát hiện giao dịch treo, chênh lệch tiền thật với ghi nhận hệ thống | **Một phần.** Có ghi nhận reconciliation attempt, nhưng chưa có màn hình/luồng "resolve/đóng" — chỉ dừng ở mức ghi log. |
| **Điểm thành viên/loyalty là tài nguyên dùng chung toàn hệ thống**, thường do 1 service trung tâm (không phải booking) sở hữu số dư; booking chỉ "giữ tạm" điểm sắp dùng trong lúc giao dịch | Khách tích/dùng điểm ở bất kỳ chi nhánh nào, không phải theo từng rạp | **Đúng hướng thiết kế nhưng chưa triển khai.** Có bảng `loyalty_reservation` dự phòng trong booking-service, không có logic nối vào user-service. |

**Tóm lại:** kiến trúc nền tảng (cluster discriminator, seat inventory theo showtime, price book đa chiều, snapshot giá, ticket pass mã hoá) đã đi đúng hướng thông lệ ngành. Khoảng cách chủ yếu nằm ở các **tính năng thương mại/vận hành phụ trợ** (promotion, concession, refund có tier, đối soát có luồng đóng, loyalty) — đây đều là các bảng/entity đã được "đặt chỗ trước" trong schema nhưng logic chưa được xây, cho thấy đội đã thiết kế đúng nhưng chưa kịp triển khai hết.

## 3. Gap list — ưu tiên P0/P1/P2/P3

Quy ước: **P0** = chặn demo hoặc sai lệch nghiệp vụ nghiêm trọng; **P1** = quan trọng cho một luồng quản lý/vận hành hoàn chỉnh nhưng không chặn demo core; **P2** = hoàn thiện trải nghiệm/production-hardening; **P3** = mở rộng tương lai.

### P0 — Chặn demo hoặc sai lệch nghiêm trọng

- [ ] **Admin không có thao tác quản lý booking nào từ UI** — [ManageBookingPage.tsx](../../../client/src/pages/admin/ManageBookingPage.tsx) chỉ gọi `bookingApi.getClusterBookings` (read-only, tự ghi chú trong UI). Không có nút huỷ, hoàn tiền, gửi lại vé, hay check-in — dù các API tương ứng đã tồn tại ở backend. **Ảnh hưởng**: không thể demo "luồng quản lý booking cho admin" như yêu cầu — chỉ demo được "xem danh sách".
- [ ] **Bán vé tại quầy (Ticket Sale) hoàn toàn là mock** — [TicketSalePage.tsx](../../../client/src/pages/admin/TicketSalePage.tsx) không có import nào tới `api/`, dữ liệu phim/suất/ghế là mock cứng trong file (`// ── Mock Data ──`). Bấm "bán vé" không tạo booking, không trừ ghế thật.
- [ ] **Promotion không tồn tại ở bất kỳ layer nào theo cách hoạt động được**:
  - 4 trang admin (`ManagePromotionPage`, `CreatePromotionPage`, `EditPromotionPage`, `PromotionDetailPage`) không import `api/` — toàn bộ là UI rỗng.
  - Trang checkout khách hàng ([BookingCheckoutPage.tsx](../../../client/src/pages/customer/BookingCheckoutPage.tsx)) không có ô nhập mã giảm giá.
  - `booking.discount_amount` tồn tại trong schema nhưng không service nào ghi giá trị vào đó.
  - Bảng `promotion_reservation` (đúng ý tưởng thiết kế theo thông lệ ngành ở mục 2) tồn tại nhưng zero code tham chiếu.
- [ ] **Concession không tồn tại ở bất kỳ layer nào** — không route, không trang, không component, không API. Chỉ có bảng `concession_item` rỗng trong DB. Nếu cần demo "khách mua thêm bắp nước khi đặt vé", tính năng này phải xây từ đầu (DB đã có), không phải chỉnh sửa cái có sẵn.
- [ ] **Không có màn hình check-in/quét vé cho nhân viên tại cửa rạp** — backend đã có API check-in (dùng `TicketPassService`) nhưng không UI nào trong `client/src/pages/admin` gọi tới nó. Không demo được cảnh "nhân viên quét QR cho khách vào rạp".
- [ ] **Báo cáo (Reports) là dữ liệu ngẫu nhiên/hardcode** — [ReportPage.tsx](../../../client/src/pages/admin/ReportPage.tsx) không import `api/`. Số liệu đổi mỗi lần load lại trang nếu dùng `Math.random`-kiểu mock — rủi ro cao khi demo trực tiếp vì số liệu không nhất quán giữa các lần xem.

### P1 — Quan trọng để hoàn thiện vận hành, không chặn demo core

- [ ] **In vé / xuất vé dạng in được** — hiện chỉ có QR render phía client từ `passToken` khi khách xem trên web/app. Chưa có phiên bản in (PDF/khổ in nhiệt tại quầy) cho khách mua tại quầy hoặc muốn giữ vé giấy — đúng như câu hỏi gốc của bạn về "in thông tin vé".
- [ ] **Hoàn tiền chỉ nhị phân (toàn phần/không), chưa có tier theo thời điểm huỷ** — khác với thông lệ ngành (CGV, BHD đều áp mức hoàn khác nhau theo thời gian trước suất chiếu). `booking.cancel.mins-before-showtime` mới chỉ quyết định "được huỷ hay không", chưa quyết định "hoàn bao nhiêu %".
- [ ] **Đối soát (reconciliation) không có luồng đóng/resolve** — có ghi nhận attempt nhưng không có màn hình cho admin xác nhận "đã đối soát khớp" hoặc đánh dấu lệch cần xử lý thủ công.
- [ ] **Test coverage cho booking-service còn mỏng** (theo audit: rất ít file test so với độ phức tạp của saga/state machine). Rủi ro khi sửa code sau này dễ vỡ luồng compensation mà không phát hiện kịp.
- [ ] **Xác thực service-to-service dùng shared static key** (`X-Internal-Service-Key`, giá trị mặc định `local-dev-only-change-me`) thay vì mTLS/credential xoay vòng — đủ cho demo/nội bộ nhưng là nợ kỹ thuật cần xử lý trước khi lên production thật.
- [ ] **Loyalty/điểm thành viên chưa nối vào booking** — bảng `loyalty_reservation` tồn tại nhưng chưa có service nào ghi/đọc; `booking.points_used` không bao giờ được set.

### P2 — Hoàn thiện trải nghiệm / production-hardening

- [ ] Dropdown chọn cụm rạp trong các trang admin (Ticket Sale, Booking Management) không tự lọc theo quyền nhân viên — backend đã chặn đúng qua `BookingClusterAccessPolicy` (nhân viên chọn cụm không thuộc quyền sẽ bị từ chối), nhưng UI không ẩn trước các lựa chọn không hợp lệ, gây trải nghiệm "chọn xong mới báo lỗi".
- [ ] `BookingAuditLog`, `BookingQuote`/`BookingQuoteItem` là entity + bảng tồn tại nhưng zero code sử dụng — nên hoặc triển khai (nếu vẫn cần audit trail độc lập với outbox event) hoặc dọn bỏ để tránh gây hiểu nhầm khi code sau này đọc schema.
- [ ] Không có cơ chế xuất/generate vé dạng ảnh hoặc PDF phía server cho các luồng không phải trình duyệt (ví dụ gửi qua email, in tại quầy).

### P3 — Mở rộng tương lai

- [ ] Quy tắc promotion nâng cao (mua-1-tặng-1, combo, stacking nhiều mã, giới hạn theo hạng thành viên).
- [ ] Pre-order concession để lấy tại quầy riêng theo giờ hẹn (pattern phổ biến ở AMC/Cinemark).
- [ ] Dashboard/alerting/tracing tập trung cho reconciliation và compensation worker (đã ghi nhận là "cần production hardening" trong [P0_P1_IMPLEMENTATION_STATUS.md](P0_P1_IMPLEMENTATION_STATUS.md) mục 3).

## 4. Điều đã đúng, không cần sửa (để tránh làm lại nhầm)

- Seat-hold contract giữa booking-service và movie-service (`MovieInventoryClient` ↔ `InternalShowtimeSeatController`) đã khớp đầy đủ 4 thao tác (hold/confirm/release/reverse-sale), có xác thực bằng `X-Internal-Service-Key` so sánh hằng-thời-gian (`MessageDigest.isEqual`). Đây từng là nghi vấn gap trong buổi trước, nay xác nhận **đã triển khai đúng**.
- Saga thanh toán (PENDING_PAYMENT → webhook HMAC → CONFIRM_PENDING → CONFIRMED) cùng 3 scheduler nền (expiry 30s, outbox publisher 1s, compensation worker 5s) đã chạy thật, không phải mock.
- Giá được snapshot tại thời điểm hold, không tin giá gửi từ client — đúng thông lệ chống gian lận giá của ngành.
- Phân quyền theo cụm rạp cho nhân viên (JWT claim `cinemaClusterIds` + `BookingClusterAccessPolicy`) đã enforce đúng ở backend.

## 5. Đề xuất thứ tự xử lý

1. Nối các thao tác quản lý (huỷ/hoàn/check-in) vào `ManageBookingPage` — API đã có sẵn ở backend, đây là việc nối UI, không phải xây mới, nên có thể xong nhanh và mở khoá demo "luồng quản lý booking cho admin".
2. Xây UI + luồng check-in bằng API đã có, để demo được cảnh soát vé tại cửa.
3. Nối `TicketSalePage` vào API thật (booking-service đã có "Counter sale backend — Hoàn thành" theo [P0_P1_IMPLEMENTATION_STATUS.md](P0_P1_IMPLEMENTATION_STATUS.md)) — cũng là việc nối UI vào backend có sẵn.
4. Thiết kế và xây promotion end-to-end (backend logic áp mã + reserve quota, rồi mới tới UI) — đây là tính năng thiếu cả 2 lớp nên cần nhiều công sức nhất trong nhóm P0.
5. Thiết kế và xây concession từ đầu (DB đã có, chưa có gì khác) — làm sau promotion vì mức độ ưu tiên nghiệp vụ thường thấp hơn trong demo "luồng đặt vé".
6. Thêm bản in vé (PDF/khổ in nhiệt) sau khi luồng quầy (TicketSalePage) đã nối API thật, vì in vé phần lớn phục vụ ngữ cảnh bán tại quầy.
