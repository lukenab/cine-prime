## Overview / Objective

Viết lại `SeatService.generateSeatsForRoom()` để sinh ghế tự động theo 3 vùng hàng (Standard → VIP → Couple) mô phỏng đúng cách bố trí thực tế của các rạp (CGV/Lotte/Galaxy), thay vì sinh đồng loạt Standard rồi bắt admin tự sửa tay từng ghế. Ghế Couple/Sweetbox chiếm đúng 2 cột vật lý (không phải 1-đối-1 như Standard/VIP), và thay đổi được truyền xuyên suốt tới cả trang quản lý phòng (admin) lẫn trang đặt vé thật (khách).

Related Issue: Closes #166
Depends on: không có (độc lập với #164/#165)

---

## Changes Introduced

**Controllers / Routes:**
- Không có route mới — toàn bộ thay đổi nằm trong response body của các endpoint đã tồn tại.

**Services / Logic:**
- `SeatService.generateSeatsForRoom()`: viết lại hoàn toàn. Tính `totalRows` từ `totalSeatCapacity`/`seatsPerRow`, chia thành `standardRows` (đầu) / `vipRows` (giữa-sau, tỉ lệ theo `RoomType.vipRowRatio`) / `coupleRows` (hàng cuối, theo `RoomType.coupleRowCount`, tối đa 1 hàng). Với hàng Couple, số ghế sinh ra = `physicalSeatsInRow / colSpan` (chiếm 2 cột/ghế) thay vì bằng `seatsPerRow`. 2 edge case được xử lý: phòng < 3 hàng thì bỏ hẳn vùng Couple/VIP (toàn bộ Standard); hàng Couple bị cắt ngắn không đủ 1 cặp thì tự hạ về Standard thay vì bỏ trắng hàng.
- `ShowTimeService.toDto()`: thêm `.colSpan(...)` khi build `ShowtimeSeatDto`, lấy từ `seat.getSeatType().getColSpan()` — đảm bảo ghế Couple hiển thị đúng ở cả suất chiếu thật, không chỉ ở trang quản lý phòng.

**DTOs / Mappers / Components:**
- `RoomType.java` (enum): thêm `vipRowRatio` (double) và `coupleRowCount` (int) — cấu hình cố định theo từng loại phòng: STANDARD (0.30, 1 hàng Couple), LARGE (0.35, 1 hàng Couple), IMAX (0.30, **0 hàng Couple** — xem Reviewer Notes).
- `SeatType.java` (enum): thêm `priceMultiplier` (double, áp lên `defaultPrice` của phòng — STANDARD ×1.0, VIP ×1.25, COUPLE/SWEETBOX ×1.8) và `colSpan` (int — 1 cho Standard/VIP, 2 cho Couple/Sweetbox).
- `SeatResponse.java` + `MovieMapper.toSeatResponse()`: thêm field `colSpan`, map bằng expression `seat.getSeatType().getColSpan()`.
- `ShowtimeSeatDto.java`: thêm field `colSpan` tương ứng.
- `movieApi.ts`: `SeatResponse` type thêm `colSpan?: number`; `SeatTypeValue` thêm `"SWEETBOX"` (trước đây thiếu, dù backend đã có enum này từ lâu).
- `bookingApi.ts`: `Seat.type` union mở rộng từ `"STANDARD" | "VIP"` thành thêm `"COUPLE" | "SWEETBOX"`; thêm `colSpan?: number`.
- `RoomDetailPage.tsx` (admin): thêm `SWEETBOX` vào `SEAT_TYPES` và `seatTypeStyle` (màu hồng, tách biệt với Couple màu tím đã có sẵn).
- `SeatBookingPage.tsx` (trang đặt vé khách): thay hàm `isVip`/`isVipRow` nhị phân bằng hàm `seatAccent()` tổng quát theo loại ghế. Ghế Couple/Sweetbox giờ có màu accent riêng (hồng), nút rộng gấp đôi (`w-[4.75rem]` so với `w-9` mặc định) để phản ánh đúng việc ghế này chiếm 2 chỗ, có badge riêng ở đầu hàng, và phần tóm tắt đơn (order summary) tách 3 nhóm Standard/VIP/Couple thay vì chỉ 2 nhóm Standard/VIP như trước.

**Database / JPA / Migration:**
- Không áp dụng — `colSpan` là trường tính toán thuần túy từ `SeatType` (không lưu DB), không cần migration nào.

**Exception Handling / Error Codes:**
- Không có thay đổi.

---

## Key Architectural Decisions

- **`colSpan` không lưu DB, chỉ tính từ `SeatType`** — vì colSpan luôn là hàm thuần của loại ghế (Couple/Sweetbox luôn = 2, còn lại luôn = 1), lưu thêm cột vào bảng `seat` sẽ tạo ra dữ liệu trùng lặp/có thể lệch nhau, và tránh phải viết migration trong 1 project OJT không có sẵn công cụ migration chuyên dụng.
- **Cấu hình tỉ lệ vùng hàng cố định theo `RoomType` thay vì cho admin tự chọn lúc tạo phòng** — quyết định theo yêu cầu của team (đơn giản hơn, không cần sửa form/validation `CinemaRoomRequest`). Admin vẫn có thể sửa tay loại/giá từng ghế riêng lẻ sau khi phòng được tạo qua `PUT /api/seats/{id}` như cũ.
- **IMAX được cấu hình 0 hàng Couple** — vì `seatsPerRow = 15` là số lẻ (khó chia cặp gọn gàng, sẽ luôn dư 1 ghế lẻ ở cuối hàng), và theo hiểu biết chung thì các phòng IMAX thực tế ít khi có ghế đôi (đã là hạng ghế cao cấp sẵn). Đây là giả định nghiệp vụ, không có nguồn xác nhận chính thức — reviewer có thể yêu cầu đổi lại nếu team có thông tin khác về IMAX tại VN.
- **Mở rộng scope sang `SeatBookingPage.tsx` dù ban đầu chỉ định sửa backend** — vì đây là điều kiện bắt buộc để tính năng hoạt động đúng, không phải cải tiến tùy chọn: nếu chỉ sửa backend, ghế Couple mới sinh ra sẽ hiển thị y hệt ghế Standard cho khách hàng thật (trang này vốn chỉ phân biệt nhị phân VIP/không-VIP) và bị đếm nhầm nhóm trong tóm tắt đơn — tức là khách trả đúng giá Couple nhưng giao diện không phản ánh đúng loại ghế họ đã chọn.

---

## How to Test

1. `cd client && npm run dev`; backend `movie-service` cần đang chạy (không bắt buộc dữ liệu cluster/room có sẵn, tạo phòng mới để test tính năng này).
2. Login ADMIN → **Cinema Clusters** → vào 1 cluster bất kỳ → **Add Room**, tạo phòng STANDARD với `seatQuantity` đủ lớn (vd. 90, 10 ghế/hàng → 9 hàng).
3. Vào **Room Detail** của phòng vừa tạo → xác nhận: các hàng đầu (A–F khoảng 6 hàng) là Standard (xanh dương), 2 hàng tiếp theo (G, H) là VIP (vàng), hàng cuối (I) là Couple (tím) với số ghế bằng phân nửa các hàng khác (vd hàng I chỉ có 5 ghế thay vì 10) — xác nhận giá hàng VIP ×1.25 và Couple ×1.8 so với `defaultPrice` đã nhập.
4. Tạo phòng LARGE tương tự — xác nhận tỉ lệ VIP cao hơn STANDARD một chút (0.35 vs 0.30).
5. Tạo phòng IMAX — xác nhận **không có hàng Couple nào**, chỉ Standard + VIP.
6. Tạo phòng rất nhỏ (`seatQuantity` = 10–15, dưới 3 hàng) — xác nhận toàn bộ ghế là Standard, không có VIP/Couple.
7. Vào **Edit Seat** (modal sửa ghế trong Room Detail) — xác nhận dropdown loại ghế giờ có đủ 4 lựa chọn (Standard/VIP/Couple/Sweetbox), có thể tự tay đổi 1 ghế bất kỳ sang Sweetbox.
8. Tạo 1 showtime cho phòng có ghế Couple → vào trang đặt vé của khách (`/booking/{showtimeId}` hoặc đường dẫn tương ứng) → xác nhận hàng ghế Couple hiển thị màu hồng, nút rộng gấp đôi so với ghế thường, có badge "Couple" ở đầu hàng; chọn 1 ghế Couple → xác nhận phần tóm tắt đơn hiện đúng nhóm "Couple" (không bị gộp vào "Standard") và giá đúng ×1.8.
9. `cd client && node_modules/.bin/tsc --noEmit -p tsconfig.json` — xác nhận không phát sinh lỗi mới so với baseline.

---

## Checklist

**General**
- [x] Follows project coding conventions (tái sử dụng pattern enum có `@Getter`/`@AllArgsConstructor`, cấu trúc mapper MapStruct hiện có)
- [x] No debug / console.log code left
- [ ] Code compiles, no errors — **chưa build được bằng Maven/JDK thật trong môi trường viết code này**, chỉ verify thủ công bằng cân bằng ngoặc + không có byte null ở mọi file đã sửa. Cần reviewer tự `mvn compile` trước khi merge.

**Backend**
- [ ] No N+1 query issues (check Hibernate console output) — chưa chạy được backend thật để kiểm tra
- [x] Exception handling uses correct error codes — không có exception mới, không đổi error code nào
- [ ] Endpoints tested via Postman / API client — chưa test được vì không có backend chạy trong môi trường này
- [ ] API contract / Postman collection updated

**Frontend**
- [x] Loading and error states handled — không đổi logic loading/error, chỉ đổi styling/logic hiển thị loại ghế
- [x] axiosClient attaches Bearer token correctly — không đổi interceptor
- [x] `tsc --noEmit -p tsconfig.json`: baseline 86 lỗi có sẵn không đổi, **0 lỗi mới** từ 4 file frontend đã sửa (`movieApi.ts`, `bookingApi.ts`, `RoomDetailPage.tsx`, `SeatBookingPage.tsx`)
- [ ] Tested on both dark and light mode — chưa tự mở trình duyệt kiểm tra trực quan trong môi trường viết code này — **reviewer nên tự kiểm tra trực quan**, đặc biệt màu hồng mới thêm cho Couple/Sweetbox

---

## Reviewer Notes

- **Chưa build backend thật** — môi trường viết code này không có Maven/JDK, toàn bộ phần Java chỉ được verify bằng soát cân bằng ngoặc `{}`/`()` thủ công và đọc lại từng file sau khi sửa, chưa có compiler thật xác nhận. Đây là rủi ro lớn nhất của MR này — **bắt buộc chạy `mvn compile`/`mvn test` ở máy có JDK trước khi merge**.
- **Giả định IMAX không có ghế Couple** (`RoomType.IMAX.coupleRowCount = 0`) là quyết định chủ quan của người viết MR, dựa trên hiểu biết chung chứ không có số liệu chính thức từ CGV/Lotte cho riêng phòng IMAX. Nếu team có thông tin khác, chỉ cần đổi 1 số trong `RoomType.java`.
- Tỉ lệ hàng (VIP 30–35%, Couple tối đa 1 hàng) và hệ số giá (VIP ×1.25, Couple ×1.8) đều là số ước lượng hợp lý dựa trên khảo sát chung ngành rạp chiếu phim, không phải số liệu chính xác của CGV/Lotte/Galaxy cụ thể — có thể cần điều chỉnh sau khi team có dữ liệu giá vé thật.
- Hàng Couple luôn được đặt tối đa 1 hàng (`Math.min(roomType.getCoupleRowCount(), 1)`) dù `RoomType.coupleRowCount` hiện đang set là 1 cho STANDARD/LARGE — nếu sau này muốn tăng lên nhiều hàng Couple hơn, cần bỏ `Math.min(..., 1)` này trong `SeatService.generateSeatsForRoom()`.
- Phòng đã tạo TRƯỚC MR này (ghế đã sinh sẵn toàn bộ Standard) sẽ không tự động cập nhật lại — thuật toán mới chỉ áp dụng cho phòng tạo MỚI sau khi merge. Nếu cần áp dụng ngược cho dữ liệu cũ, cần viết thêm 1 script/migration riêng để xóa và sinh lại ghế cho các phòng hiện có (rủi ro: có thể ảnh hưởng tới ghế đã có trong `ShowtimeSeat`/booking đang hoạt động, cần cân nhắc kỹ trước khi làm).

