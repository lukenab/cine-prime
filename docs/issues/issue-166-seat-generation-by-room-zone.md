# [Backend] Sinh ghế tự động theo vùng hàng (Standard / VIP / Couple) thay vì toàn bộ Standard

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`, `Review/ QA`

---

## Summary / Objective

`SeatService.generateSeatsForRoom()` hiện tại sinh MỌI ghế trong phòng là `SeatType.STANDARD`, dùng 1 giá duy nhất (`defaultPrice`) cho toàn bộ phòng — dù enum `SeatType` đã có sẵn 4 giá trị (STANDARD, VIP, COUPLE, SWEETBOX). Muốn có ghế VIP/Couple, admin phải tự tay sửa từng ghế một bằng `PUT /api/seats/{id}` sau khi phòng đã tạo xong.

Đây không đúng practice của các rạp thực tế (CGV/Lotte/Galaxy): theo khảo sát cách bố trí hàng ghế rạp chiếu phim VN, các hàng đầu gần màn hình luôn là Standard, từ khoảng hàng thứ 5 trở đi là VIP, và hàng cuối cùng sát tường sau là Couple/Sweetbox (ghế đôi liền khối, chiếm 2 chỗ vật lý). MR này sinh ghế tự động đúng theo mô hình phân vùng này ngay khi tạo phòng, thay vì bắt admin phải sửa tay từng ghế.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [x] Tạo phòng mới tự động sinh ghế theo 3 vùng: Standard (đầu) → VIP (giữa-sau) → Couple (hàng cuối, nếu RoomType cho phép)
- [x] Tỉ lệ số hàng mỗi vùng và hệ số giá theo loại ghế được cấu hình cố định theo từng `RoomType` (không cần thêm input ở form tạo phòng)
- [x] Ghế Couple sinh ra chiếm đúng 2 cột vật lý (`SeatType.colSpan = 2`) — số bản ghi Seat ít hơn số cột thông thường của hàng đó, không phải 1-đối-1 với Standard/VIP
- [x] Phòng quá nhỏ (< 3 hàng) hoặc hàng Couple bị cắt ngắn (không đủ 1 cặp) thì tự động hạ về Standard, không sinh ghế lỗi/bỏ trắng hàng
- [x] `colSpan` được truyền xuyên suốt: `Seat` → `SeatResponse` (trang quản lý phòng admin) và `Seat` → `ShowtimeSeat` → `ShowtimeSeatDto` (trang đặt vé thật của khách)
- [x] Trang admin (`RoomDetailPage.tsx`) và trang đặt vé khách (`SeatBookingPage.tsx`) hiển thị đúng cả 4 loại ghế (trước đây trang đặt vé chỉ phân biệt nhị phân VIP/không-VIP, ghế Couple sẽ bị hiển thị/đếm nhầm thành Standard nếu không sửa)
- [ ] Build backend thật bằng Maven/JDK thật (môi trường viết code này không có Maven, chỉ verify được bằng cân bằng ngoặc thủ công)
- [ ] Test bằng browser thật trên cả dark/light mode

---

## API Specifications

Không có API endpoint mới. Thay đổi nằm trong response body của các API đã có sẵn:

### API 1 — Cinema Room Seats (không đổi endpoint, thêm field)

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/seats/room/{roomId}` |
| Description | Response `SeatResponse` giờ có thêm field `colSpan` (Integer, mặc định 1, = 2 cho Couple/Sweetbox) |
| Auth Required | Yes |

### API 2 — Showtime Seats (không đổi endpoint, thêm field)

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/showtimes/{id}/seats` (qua `ShowtimeSeatDto`) |
| Description | Response giờ có thêm field `colSpan`, `type` có thể là `COUPLE`/`SWEETBOX` thay vì chỉ `STANDARD`/`VIP` |
| Auth Required | Yes |

---

## Technical Notes / Constraints

- `colSpan` là trường tính toán thuần túy theo `SeatType` (`STANDARD`/`VIP` = 1, `COUPLE`/`SWEETBOX` = 2), không thêm cột mới vào bảng `seat`/`showtime_seat` — tránh phải viết migration.
- Tỉ lệ vùng hàng và hệ số giá hiện đang HARDCODE trong `RoomType`/`SeatType` enum (theo lựa chọn của team là "cố định theo RoomType" thay vì cho admin tự cấu hình lúc tạo phòng). Nếu sau này muốn linh hoạt hơn, cần thêm field vào `CinemaRoomRequest` + form tạo phòng.
- Giả định riêng: phòng IMAX (`seatsPerRow = 15`, số lẻ) được cấu hình **0 hàng Couple** — vì seatsPerRow lẻ khó chia cặp gọn và thực tế ít rạp bố trí ghế đôi trong phòng IMAX. Đây là giả định nghiệp vụ, chưa có nguồn xác nhận chính thức, reviewer có thể điều chỉnh lại `RoomType.IMAX` nếu team có thông tin khác.
- `totalSeatCapacity` của `CinemaRoom` vẫn giữ nguyên ý nghĩa là sức chứa (đầu người), không đổi theo số bản ghi `Seat` thực tế sinh ra (vì ghế Couple gộp 2 chỗ thành 1 bản ghi) — đã xác nhận không có chỗ nào trong code hiện tại assert `seats.size() == totalSeatCapacity`.
- Phát hiện thêm ngoài scope ban đầu: `RoomDetailPage.tsx` (admin) đã có sẵn style cho `COUPLE` nhưng thiếu `SWEETBOX` trong danh sách `SEAT_TYPES` — đã bổ sung tiện thể trong MR này vì liên quan trực tiếp đến enum `SeatType` đang sửa.

---

## Related

- Branch: `feat/seat-generation-by-room-zone`
- Depends on: không (độc lập với #164/#165, chỉ dùng chung entity `Seat`/`RoomType`)
- Docs: `docs/issues/mr-166-seat-generation-by-room-zone.md` (MR mô tả chi tiết thay đổi)

