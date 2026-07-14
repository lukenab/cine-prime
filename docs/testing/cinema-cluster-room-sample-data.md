# Dữ liệu rạp chiếu phim thực tế — để tạo thủ công trên Admin UI

Data lấy từ tên/địa chỉ thật của các cụm rạp CGV, Lotte Cinema, Galaxy Cinema, BHD Star đang hoạt động tại Việt Nam (tra cứu qua web, tháng 7/2026), khớp đúng danh sách **province được validate cứng** trong `ProvinceValidator.java` (`movie-service`). Ghi chú rõ ở cột "Nguồn" để bạn biết field nào là dữ liệu thật, field nào là số hợp lệ nhưng không phải hotline thật.

⚠️ **`phoneNumber` không còn nhập thủ công (V8):** thực tế các chuỗi CGV/Lotte/Galaxy/BHD dùng chung **một** hotline tổng đài cho toàn chuỗi, không cấu hình riêng theo từng cụm rạp — nên form tạo/sửa cluster đã **bỏ hẳn ô nhập Hotline**. Backend tự gán cố định `19001000` cho mọi cluster khi tạo (`CinemaClusterController.DEFAULT_HOTLINE`) và không cho sửa qua API nữa. Dữ liệu cũ (seed từ V6, mỗi cluster một số khác nhau) đã được chuẩn hoá về cùng giá trị này qua `V8__unify_cluster_hotline.sql`.

---

## 1. Cinema Clusters (10 cụm, trải khắp 10/19 province được phép)

| # | Tên cụm rạp (clusterName) | Province (phải nhập **chính xác** chuỗi này) | Address | Nguồn |
|---|---|---|---|---|
| 1 | CGV Vincom Bà Triệu | `Hà Nội` | Tầng 6, Vincom Bà Triệu, 191 Bà Triệu, Quận Hai Bà Trưng, Hà Nội | Địa chỉ thật (Foody) |
| 2 | CGV Crescent Mall | `TP. Hồ Chí Minh` | Tầng 5 Crescent Mall, 101 Tôn Dật Tiên, P. Tân Phú, Quận 7, TP. HCM | Địa chỉ thật (Foody) |
| 3 | Lotte Cinema Cần Thơ Ninh Kiều | `Cần Thơ` | TTTM Lotte Mart, 84 Đ. Mậu Thân, P. Cái Khế, Cần Thơ | **Địa chỉ thật** (Trustpilot VN) |
| 4 | Lotte Cinema Đà Nẵng | `Đà Nẵng` | Tầng 5&6 tòa nhà Lotte Mart Đà Nẵng, số 06 Nại Nam, P. Hoà Cường, Đà Nẵng | Địa chỉ thật |
| 5 | Galaxy Nha Trang Center | `Khánh Hòa` | Nha Trang Center, 20 Trần Phú, P. Lộc Thọ, TP. Nha Trang, Khánh Hòa | Địa chỉ thật (79khanhhoa.com) |
| 6 | BHD Vincom Huế | `Huế` | 50A đường Hùng Vương, tổ 10, P. Phú Nhuận, TP. Huế | Địa chỉ thật (rapchieuphim.com) |
| 7 | CGV Vincom Dĩ An Bình Dương | `Bình Dương` | Lầu 3, Vincom Plaza Dĩ An, 1 đường DT743, KP. Thống Nhất, P. Dĩ An, TP. Dĩ An, Bình Dương | Địa chỉ thật (thelandmark81.com.vn) |
| 8 | Lotte Cinema Vincom Biên Hòa | `Đồng Nai` | Lầu 5, TTTM Vincom, 1096 Phạm Văn Thuận, P. Tân Mai, TP. Biên Hòa, Đồng Nai | Địa chỉ thật (Foody) |
| 9 | Lotte Cinema Vũng Tàu | `Bà Rịa - Vũng Tàu` | Tầng 3, TTTM Lotte Vũng Tàu, P. 8, TP. Vũng Tàu | Địa chỉ thật (MoMo) |
| 10 | CGV Vincom Plaza Imperia Hải Phòng | `Hải Phòng` | Tầng 4, TTTM Vincom Plaza Imperia, Khu đô thị Vinhomes Imperia, P. Thượng Lý, Q. Hồng Bàng, Hải Phòng | Địa chỉ thật (MoMo) |

Các field khác khi tạo cluster:
- **latitude/longitude**: optional, có thể để trống — nếu muốn điền, dùng toạ độ trung tâm thành phố tương ứng là đủ (không cần chính xác tới toà nhà cho mục đích test).
- **status**: không set được lúc tạo — backend tự quyết theo role người tạo: ADMIN → thẳng `ACTIVE`, EMPLOYEE → `DRAFT` (phải Submit + được ADMIN Approve mới thành `ACTIVE`). Xem Bước 0 ở mục 3.
- **phoneNumber**: không nhập — backend tự gán `19001000` cho mọi cluster (xem lưu ý ⚠️ ở trên).

---

## 2. Cinema Rooms mẫu (mỗi cụm gợi ý 2 phòng — 1 Standard + 1 Large/IMAX)

Sau khi tạo xong 10 cluster ở trên và có `clusterId` thật (do DB tự sinh), tạo phòng theo mẫu dưới — áp giá vé tham khảo theo mặt bằng chung CGV/Lotte 2026 (vé thường ngày trong tuần, chưa gồm ưu đãi).

⚠️ **Không còn nhập `totalSeatCapacity` trực tiếp (xem mục 3 bước 3).** Form giờ yêu cầu `numberOfRows` + `seatsPerRow` — bấm chọn `roomType` sẽ tự điền sẵn 2 field này theo mặc định của loại phòng (`Math.round(maxSeats / seatsPerRow)` hàng, VD IMAX = round(300/15) = 20 hàng), admin chỉnh tay nếu muốn khác. Cột "Estimated seats" dưới đây = `numberOfRows × seatsPerRow`, đúng bằng `totalSeatCapacity` backend sẽ tính — không nhập số này ở đâu cả. Phân vùng ghế cũng dùng số hàng chính xác `standardRowCount` / `vipRowCount` / `coupleRowCount`; `roomType` không còn áp tỷ lệ hard-code.

| Cluster (map theo # ở bảng trên) | cinemaRoomName | roomType | numberOfRows | seatsPerRow | Estimated seats | defaultPrice (VND) |
|---|---|---|---|---|---|---|
| 1. CGV Vincom Bà Triệu | Room 1 | STANDARD | 9 | 10 | 90 | 85000 |
| 1. CGV Vincom Bà Triệu | Room 2 | IMAX | 15 | 15 | 225 | 160000 |
| 2. CGV Crescent Mall | Room 1 | STANDARD | 9 | 10 | 90 | 85000 |
| 2. CGV Crescent Mall | Room 2 | LARGE | 14 | 10 | 140 | 100000 |
| 3. Lotte Cần Thơ Ninh Kiều | Room 1 | STANDARD | 8 | 10 | 80 | 70000 |
| 3. Lotte Cần Thơ Ninh Kiều | Room 2 | LARGE | 13 | 10 | 130 | 85000 |
| 4. Lotte Đà Nẵng | Room 1 | STANDARD | 8 | 10 | 80 | 75000 |
| 4. Lotte Đà Nẵng | Room 2 | LARGE | 14 | 10 | 140 | 90000 |
| 5. Galaxy Nha Trang Center | Room 1 | STANDARD | 9 | 10 | 90 | 75000 |
| 5. Galaxy Nha Trang Center | Room 2 | LARGE | 15 | 10 | 150 | 90000 |
| 6. BHD Vincom Huế | Room 1 | STANDARD | 8 | 10 | 80 | 65000 |
| 6. BHD Vincom Huế | Room 2 | LARGE | 12 | 10 | 120 | 80000 |
| 7. CGV Dĩ An Bình Dương | Room 1 | STANDARD | 9 | 10 | 90 | 75000 |
| 7. CGV Dĩ An Bình Dương | Room 2 | LARGE | 15 | 10 | 150 | 90000 |
| 8. Lotte Vincom Biên Hòa | Room 1 | STANDARD | 9 | 10 | 90 | 75000 |
| 8. Lotte Vincom Biên Hòa | Room 2 | LARGE | 14 | 10 | 140 | 90000 |
| 9. Lotte Vũng Tàu | Room 1 | STANDARD | 8 | 10 | 80 | 70000 |
| 9. Lotte Vũng Tàu | Room 2 | LARGE | 13 | 10 | 130 | 85000 |
| 10. CGV Vincom Imperia Hải Phòng | Room 1 | STANDARD | 9 | 10 | 90 | 75000 |
| 10. CGV Vincom Imperia Hải Phòng | Room 2 | IMAX | 14 | 15 | 210 | 150000 |

Giới hạn ghế theo `RoomType` (đúng theo `ROOM_TYPE_CONFIG` trong `movieApi.ts`): STANDARD tối đa 100, LARGE tối đa 200, IMAX tối đa 300 — cột "Estimated seats" ở trên đều nằm trong giới hạn, tránh lỗi `SEAT_QUANTITY_EXCEEDS_LIMIT` (kiểm tra ở backend theo `numberOfRows × seatsPerRow`, không phải theo số nhập trực tiếp nữa).

**Naming convention (Room Name):** đánh số liên tục trong 1 cluster, không tách dãy số theo loại phòng (khớp thực tế CGV/Lotte — xem Bảng 2, "Room 1" rồi "Room 2" dù đổi từ STANDARD sang LARGE/IMAX). Modal "Add Room" tự gợi ý số tiếp theo dựa trên các room hiện có trong cluster (`nextRoomName()` trong `AddCinemaRoomModal.tsx`, match pattern `Room {N}`) — vẫn sửa tay được nếu cần tên riêng (VD "Gold Class").

---

## 3. Thứ tự thao tác trên UI (làm lại từ đầu, DB trống)

**Bước 0 — Đăng nhập:** chỉ có duy nhất tài khoản `admin` / `admin` được seed sẵn (xem lưu ý ⚠️ ở mục 4) — dùng tài khoản này cho toàn bộ các bước dưới. Vào bằng ADMIN thì cluster tạo ra **thẳng `ACTIVE`** (tự duyệt, bỏ qua `DRAFT`/`PENDING_REVIEW`) nên **không cần** bấm Submit/Approve — bỏ qua hẳn workflow đó khi chỉ đang nhập data mẫu (workflow đó chỉ cần test riêng khi vào tài khoản EMPLOYEE, xem mục 4.3).

1. **Admin → Cinema Clusters → Add Cluster**: nhập lần lượt 10 dòng ở Bảng 1 (chỉ cần Cluster Name / Province / Address — không còn ô Hotline, và Latitude/Longitude để trống cũng được). Vì đang login ADMIN, mỗi cluster tạo xong đã ở thẳng trạng thái `ACTIVE`, không cần thao tác gì thêm.
2. Click vào từng cluster vừa tạo → **Cluster Detail → Add Room** (trang phẳng "Cinema Rooms" cũ đã bị gỡ khỏi routing, đây là chỗ tạo room duy nhất). Vì cluster đã `ACTIVE` ngay từ bước 1 nên nút Add Room hiện sẵn, không bị chặn `CLUSTER_NOT_ACTIVE`.
3. Với mỗi room: field "Room Name" **tự điền sẵn** đúng theo thứ tự trong Bảng 2 (`Room 1` cho room đầu tiên của cluster, `Room 2` cho room thứ hai — khớp tự động nếu tạo đúng thứ tự trên/dưới của bảng, không cần gõ tay). Chọn `roomType` → "Number of Rows"/"Seats per Row" tự điền mặc định theo loại phòng, chỉnh lại theo Bảng 2 nếu khác mặc định — khối "Estimated seats" hiện ngay bên dưới để đối chiếu trước khi submit. Kiểm tra tiếp khối "Seat Zone Allocation": tổng số hàng Standard + VIP + Couple phải bằng Number of Rows. Cuối cùng nhập `defaultPrice` theo Bảng 2.
4. Kiểm tra `totalRooms`/`totalSeats` ngay trên Cluster Detail để xác nhận hiển thị đúng sau mỗi room.

Nhập sai/nhầm giữa chừng: room chưa từng có showtime thì **xóa được** (nút thùng rác trên dòng room, xem mục 4.9) rồi tạo lại — không cần xóa nguyên cluster.

---

Sources:
- [CGV - Vincom Bà Triệu (Foody)](https://www.foody.vn/ha-noi/cgv-vincom-ba-trieu)
- [CGV Cinemas - Crescent Mall (Foody)](https://www.foody.vn/ho-chi-minh/cgv-cinemas-crescent-mall)
- [Lotte Cinema Cần Thơ Ninh Kiều (Trustpilot VN)](https://trustpilot.com.vn/co-so/lotte-cinema-can-tho-ninh-kieu)
- [Lotte Cinema Đà Nẵng (danang360.net)](https://danang360.net/post/lotte-cinema-da-nang)
- [Galaxy Nha Trang Center (79khanhhoa.com)](https://79khanhhoa.com/xem/rap-chieu-phim/galaxy-nha-trang-center/)
- [BHD Vincom Huế (rapchieuphim.com)](https://rapchieuphim.com/rap/bhd-vincom-hue)
- [CGV Vincom Dĩ An Bình Dương (thelandmark81.com.vn)](https://thelandmark81.com.vn/cgv-vincom-di-an-binh-duong/)
- [Lotte Cinema - Vincom Biên Hòa (Foody)](https://www.foody.vn/dong-nai/lotte-cinema-vincom-bien-hoa)
- [Lotte Vũng Tàu (MoMo)](https://www.momo.vn/cinema/rap/lotte-cinema/lotte-vung-tau-177)
- [CGV Vincom Hải Phòng (MoMo)](https://www.momo.vn/cinema/rap/cgv/cgv-vincom-hai-phong-7)

---

## 4. Test cases — Validation / Workflow / Permission

Bộ case dưới đây bám sát code thật (`CinemaClusterRequest`, `CinemaClusterController`, `CinemaRoomRequest`, `CinemaRoomController`, `SeatService`), không phải checklist chung chung. Dùng kèm dữ liệu mẫu ở mục 1-2 khi cần input hợp lệ.

⚠️ **Không còn tài khoản EMPLOYEE seed sẵn** — chỉ `admin`/`admin` được tự tạo lúc khởi động (`ApplicationInitConfig`). Trước khi chạy các case cần role EMPLOYEE, đăng nhập `admin` rồi vào **Admin → Employees → Create** để tạo 1 tài khoản EMPLOYEE test trước.

### 4.1 Cinema Cluster — Validation (`POST /api/cinema-clusters`)

| # | Input sai | Kỳ vọng |
|---|---|---|
| 1 | `clusterName` rỗng hoặc 1 ký tự | 400 — "Cluster name is required" / "must be between 2 and 100" |
| 2 | `province` không nằm trong danh sách cho phép (`ProvinceValidator.java`) | 400 |
| 3 | `address` < 10 ký tự | 400 — "Address must be at least 10 characters" |
| 4 | `latitude` ngoài [-90,90] hoặc `longitude` ngoài [-180,180] | 400 |
| 5 | Tạo cluster tên trùng (kể cả khác hoa/thường, VD "cgv vincom bà triệu" trùng "CGV Vincom Bà Triệu" đã có) | 409 `CLUSTER_NAME_EXISTED` (fix — migration V9, check case-insensitive) |
| 6 | PUT sửa cluster A, đổi tên trùng với cluster B đang có sẵn | 409 `CLUSTER_NAME_EXISTED` |
| 7 | PUT sửa cluster A, giữ nguyên tên cũ của chính nó (không đổi) | ✅ OK — không tự đụng chính mình (`existsByClusterNameIgnoreCaseAndClusterIdNot`) |

### 4.2 Cinema Cluster — Happy path & role khởi tạo status

| # | Actor | Kỳ vọng |
|---|---|---|
| 8 | Login EMPLOYEE, tạo cluster hợp lệ | Status = `DRAFT`, `phoneNumber` tự động = `19001000` dù request không gửi field này |
| 9 | Login ADMIN, tạo cluster hợp lệ | Status = `ACTIVE` ngay (tự approve, bỏ qua review), `phoneNumber` = `19001000` |
| 10 | ADMIN sửa (PUT) cluster, thử truyền `phoneNumber` khác trong body | Bị bỏ qua — DB vẫn giữ `19001000` (field không còn được đọc từ request ở cả `create` lẫn `update`) |

### 4.3 Cinema Cluster — Workflow (`/submit`, `/approve`, `/reject`)

| # | Case | Kỳ vọng |
|---|---|---|
| 11 | EMPLOYEE bấm Submit trên cluster `DRAFT` | → `PENDING_REVIEW` |
| 12 | Submit lại 1 cluster đang `PENDING_REVIEW`/`ACTIVE` | 400 `CLUSTER_INVALID_TRANSITION` |
| 13 | ADMIN Approve cluster `PENDING_REVIEW` | → `ACTIVE` |
| 14 | ADMIN Reject cluster `PENDING_REVIEW` kèm note | → `DRAFT`, `rejectionNote` được lưu |
| 15 | EMPLOYEE gọi thẳng `/approve` hoặc `/reject` | 403 |
| 16 | Approve/Reject cluster không phải `PENDING_REVIEW` (VD đang `DRAFT`) | 400 `CLUSTER_INVALID_TRANSITION` |
| 17 | EMPLOYEE sửa lại cluster đang bị reject (`DRAFT` + có rejectionNote) rồi save | `rejectionNote` tự xóa |

### 4.4 Cinema Cluster — Quyền edit / toggle status / delete

| # | Case | Kỳ vọng |
|---|---|---|
| 18 | EMPLOYEE sửa cluster đang `PENDING_REVIEW` hoặc `ACTIVE` | 400 `CLUSTER_INVALID_TRANSITION` (chỉ sửa được khi `DRAFT`) |
| 19 | ADMIN đổi status `ACTIVE↔INACTIVE` qua PUT | OK |
| 20 | ADMIN đổi status trực tiếp thành `DRAFT`/`PENDING_REVIEW` qua PUT | 400 (2 status này chỉ đi qua workflow endpoint) |
| 21 | EMPLOYEE gửi `status` bất kỳ trong PUT | 400 |
| 22 | ADMIN xóa cluster đang có room bên trong | 409 `CLUSTER_HAS_ROOMS` |
| 23 | ADMIN xóa cluster rỗng (0 room) | 200 |
| 24 | EMPLOYEE gọi DELETE | 403 |

### 4.5 Cinema Room — Validation (`POST /api/cinema-rooms`)

⚠️ **`totalSeatCapacity` không còn là field request** — thay bằng `numberOfRows` + `seatsPerRow`, backend tự tính `totalSeatCapacity = numberOfRows × seatsPerRow` và validate trên giá trị tính ra đó (`CinemaRoomService.createCinemaRoom`), không nhận trực tiếp từ client. Request phải có thêm `standardRowCount`, `vipRowCount`, `coupleRowCount`.

| # | Input sai | Kỳ vọng |
|---|---|---|
| 25 | `cinemaRoomName` rỗng / 1 ký tự | 400 |
| 26 | `numberOfRows` hoặc `seatsPerRow` < 1 (VD 0 hoặc âm) | 400 (`@Min(1)` trên cả 2 field) |
| 27 | `defaultPrice` = 0 hoặc âm | 400 |
| 28 | `clusterId` trỏ tới cluster không tồn tại | 404 `CLUSTER_NOT_FOUND` |
| 29 | `numberOfRows × seatsPerRow` vượt `maxSeats` theo `roomType`: STANDARD > 100, LARGE > 200, IMAX > 300 (VD STANDARD, `numberOfRows=11, seatsPerRow=10` → 110 > 100) | 400 `SEAT_QUANTITY_EXCEEDS_LIMIT` |
| 30 | `clusterId` trỏ tới cluster đang `DRAFT`/`PENDING_REVIEW`/`INACTIVE` (chưa `ACTIVE`) | 400 `CLUSTER_NOT_ACTIVE` (fix — trước đây tạo được, room lộ ra public qua `GET /api/cinema-rooms` dù cluster mẹ chưa duyệt) |
| 30b | `numberOfRows` > 50 (VD STANDARD, `numberOfRows=60, seatsPerRow=1` → estimate 60 vẫn dưới maxSeats nhưng quá nhiều hàng) | 400 `SEAT_ROW_LIMIT_EXCEEDED` — check riêng ở `CinemaRoomService` trước khi lưu room (tránh tạo record rồi mới fail lúc sinh ghế) |
| 30c | Tổng `standardRowCount + vipRowCount + coupleRowCount` khác `numberOfRows`, hoặc tất cả hàng đều là Couple | 400 `SEAT_ROW_ALLOCATION_INVALID` |
| 30d | `coupleRowCount > 0` nhưng `seatsPerRow` là số lẻ | 400 `COUPLE_ROW_REQUIRES_EVEN_SEATS` |

### 4.6 Cinema Room — Uniqueness theo cluster (fix #144, migration V7)

| # | Case | Kỳ vọng |
|---|---|---|
| 31 | Tạo "Room 1" ở cluster A (đã `ACTIVE`), rồi "Room 1" ở **cluster B khác** (đã `ACTIVE`) | ✅ Thành công cả 2 — chính là pattern dùng ở Bảng 2 (mọi cluster đều có "Room 1"/"Room 2"), trước khi fix #144 bước này sẽ bị 409 ngay từ cluster thứ 2 |
| 32 | Tạo "Room 1" ở cluster A, rồi "Room 1" ở **cùng cluster A** | 409 `CINEMA_ROOM_NAME_EXISTED` |

### 4.7 Cinema Room — Sinh ghế tự động theo zone (issue #166)

Verify bằng `GET /api/seats/room/{roomId}` sau khi tạo (theo `SeatService.generateSeatsForRoom`) — nhớ approve cluster (`ACTIVE`) trước khi tạo room theo case #30 ở trên:

| # | Input (`numberOfRows` × `seatsPerRow`) | Kỳ vọng |
|---|---|---|
| 33 | STANDARD, `numberOfRows=5, seatsPerRow=10`, allocation `3/1/1` | 5 hàng (A-E): A,B,C = Standard (10/hàng); D = VIP 8 ghế + 2 ghế Accessible (D3, D7 — sát 2 lối đi); E = Couple 5 bản ghi (`colSpan=2`) → tổng 45 bản ghi Seat dù capacity=50 |
| 34 | Bất kỳ RoomType, allocation `numberOfRows/0/0` | Toàn bộ là Standard, không có VIP/Couple; RoomType không tự chèn zone |
| 35 | Cùng một RoomType nhưng tạo hai room với allocation hợp lệ khác nhau | Hai sơ đồ ghế khác nhau đúng theo số hàng request; không còn tỷ lệ lấy từ RoomType |
| 36 | IMAX với `seatsPerRow=16` và `coupleRowCount > 0` | Hợp lệ và có hàng Couple; IMAX không còn bị ép `coupleRowCount=0` |
| 37 | Giá ghế | VIP = `defaultPrice × 1.25`, Couple = `defaultPrice × 1.8` |
| 38 | `SeatType` hiện có | Chỉ 4 loại: STANDARD, VIP, COUPLE, ACCESSIBLE — không còn hạng ghế đôi cao cấp riêng ("Sweetbox" đổi tên thành "Premium Couple" ở V11 rồi bị bỏ hẳn ở V12, gộp lại về COUPLE) |

### 4.8 Cinema Room — Quyền

| # | Case | Kỳ vọng |
|---|---|---|
| 39 | EMPLOYEE tạo room trong cluster đã `ACTIVE` | ✅ Cho phép — room không có workflow duyệt riêng, tạo xong `ACTIVE` luôn (miễn cluster mẹ đã `ACTIVE`, xem case #30) |
| 40 | `GET /api/cinema-rooms` (cả 2 role) | Public, không cần auth |

### 4.9 Cinema Room — Xóa (`DELETE /api/cinema-rooms/{id}`)

| # | Case | Kỳ vọng |
|---|---|---|
| 41 | Xóa room vừa tạo, chưa từng có showtime nào | ✅ 200 — room + toàn bộ seat của nó bị xóa cứng khỏi DB |
| 42 | Tạo 1 showtime cho room (bất kỳ status nào: SCHEDULED/CANCELLED/đã qua), rồi thử xóa room đó | 409 `CINEMA_ROOM_HAS_SHOWTIMES` — kể cả showtime đã hủy/đã qua cũng chặn, không chỉ showtime sắp tới |
| 43 | Xóa room không tồn tại (`id` sai) | 404 `CINEMA_ROOM_NOT_FOUND` |
| 44 | Sau khi xóa room (case #41), xóa luôn cluster mẹ nếu đó là room cuối cùng | ✅ 200 — `CLUSTER_HAS_ROOMS` không còn chặn nữa vì `roomCount` đã về 0 |
| 45 | Room đã có showtime, muốn "gỡ" khỏi vận hành | Dùng `PATCH /api/cinema-rooms/{id}/status?status=CLOSED` thay vì xóa — đây là đường chính thức, giữ nguyên lịch sử vé/doanh thu |

### 4.10 Cinema Room — Gợi ý tên phòng (naming convention)

| # | Case | Kỳ vọng |
|---|---|---|
| 46 | Cluster chưa có room nào, mở modal Add Room | Field "Room Name" tự điền sẵn `Room 1` |
| 47 | Cluster đã có "Room 1", "Room 2", mở modal Add Room | Tự điền `Room 3` (max số hiện có + 1, không quan tâm loại phòng của "Room 1"/"Room 2") |
| 48 | Cluster có room tên tùy ý không khớp pattern (VD "Gold Class", "Phòng VIP") xen giữa "Room 1"/"Room 2" | Vẫn tự điền `Room 3` — field tự do đoán chỉ dựa trên tên khớp đúng `Room {N}`, tên lệch pattern bị bỏ qua khi tính số tiếp theo, không gây lỗi |
| 49 | Sửa tay tên gợi ý thành tên khác trước khi submit | ✅ Cho phép — gợi ý chỉ là default value, không khóa field |

### 4.11 Cinema Room — Lối đi (aisle) & Ghế Accessible

Cả 2 tính năng đều thuần tính toán (`SeatLayoutUtil`), không thêm cột DB mới — giống cách `colSpan` đã làm với `SeatType` trước đó. Verify qua field `aisleAfter` trong `GET /api/seats/room/{roomId}` (admin) và `GET /api/showtimes/{id}/seats` (khách, field `seatType=ACCESSIBLE`, `aisleAfter`).

| # | Case | Kỳ vọng |
|---|---|---|
| 50 | STANDARD/LARGE tạo với `seatsPerRow=10` — mọi hàng đều đúng 10 ghế (không còn hàng cuối bị "cắt ngắn" như model cũ, vì capacity giờ luôn = `numberOfRows × seatsPerRow` chẵn) | `aisleAfter=true` ở cột 3 và cột 7 — chia hàng thành khối 3-4-3 (trái-giữa-phải) |
| 51 | IMAX tạo với `seatsPerRow=15` | `aisleAfter=true` ở cột 4 và cột 11 — khối 4-7-4 |
| 52 | Hàng Couple (`colSpan=2`, `seatsPerRow=10` → chỉ 5 "đơn vị" cặp ghế) | Không có `aisleAfter` nào — hàng quá hẹp (< 6 đơn vị) để chia 3 khối rõ ràng, giữ nguyên 1 khối liền |
| 53 | Trang admin (`RoomDetailPage.tsx`) và trang đặt vé khách (`SeatBookingPage.tsx`) | Cả 2 đều hiển thị đúng cùng 1 vị trí lối đi (dùng chung `aisleAfter` từ backend) — trước đây trang khách tự đoán layout 2-6-2 riêng, không khớp với admin |
| 54 | STANDARD `numberOfRows=5, seatsPerRow=10` (capacity=50, case #33) | 2 ghế Accessible xuất hiện ở hàng D (hàng VIP ngay trước hàng Couple), tại đúng vị trí sát 2 lối đi (cột 3 và cột 7) |
| 55 | `numberOfRows=1, seatsPerRow=10` (capacity=10, nhỏ nhất hợp lệ, không có Couple) | Ghế Accessible vẫn được đặt ở hàng cuối cùng (không có hàng VIP/trước-Couple để ưu tiên) |
| 56 | Số ghế Accessible | `max(2, round(capacity × 1%))` với `capacity = numberOfRows × seatsPerRow` — VD capacity=300 (IMAX max) → round(3) = 3 ghế; capacity=100 → round(1) = 1 → làm tròn lên tối thiểu 2 |
| 57 | Ghế Accessible không bao giờ nằm trong hàng Couple | Đúng theo thiết kế — ghế đôi (`colSpan=2`) không phù hợp cho xe lăn, logic chỉ chọn hàng có `colSpan == 1` |
| 58 | Giá ghế Accessible | = `defaultPrice × 1.0` (giống Standard, không phụ phí) |

### 4.12 Cinema Room — Luồng tạo phòng mới và cấu hình Seat Zone

Đổi hẳn model tạo phòng: `POST /api/cinema-rooms` không còn nhận `totalSeatCapacity` — thay bằng `numberOfRows` + `seatsPerRow`, backend tự tính `totalSeatCapacity = numberOfRows × seatsPerRow` (`CinemaRoomService.createCinemaRoom`) và đây là giá trị lưu DB duy nhất được tin cậy. `RoomType` giờ chỉ còn 2 vai trò: cấp `maxSeats` (trần trên) và gợi ý giá trị mặc định cho form. Ba field `standardRowCount`, `vipRowCount`, `coupleRowCount` là cấu hình thật được lưu theo từng phòng; tổng của chúng phải bằng `numberOfRows`.

| # | Case | Kỳ vọng |
|---|---|---|
| 59 | Mở modal Add Room, chọn `Room Type = IMAX` | Number of Rows tự điền `20`, Seats per Row tự điền `15`; Seat Zone gợi ý `14 Standard / 6 VIP / 0 Couple` vì chiều rộng 15 là số lẻ |
| 60 | Đổi `Room Type` giữa 2 lần chọn (VD STANDARD → IMAX → STANDARD) | Mỗi lần đổi, Number of Rows/Seats per Row đều reset về mặc định của loại mới — không giữ lại giá trị đã chỉnh tay của loại cũ |
| 61 | Sau khi chọn RoomType, tự tay sửa `Number of Rows`/`Seats per Row` | Cho sửa tự do — khối "Estimated seats" cập nhật ngay theo giá trị mới, không khóa lại theo mặc định |
| 62 | `numberOfRows × seatsPerRow` > `maxSeats` của RoomType đang chọn | Frontend: khối ước tính viền đỏ + dòng cảnh báo, nút Create bị vô hiệu hoá client-side. Backend (nếu bypass FE, gọi thẳng API): 400 `SEAT_QUANTITY_EXCEEDS_LIMIT` |
| 63 | `numberOfRows × seatsPerRow` < 10 (VD `numberOfRows=2, seatsPerRow=3` = 6 ghế) | 400 `SEAT_QUANTITY_TOO_SMALL` (mới — thay thế `@Min(10)` cũ vốn áp trực tiếp lên `totalSeatCapacity`, giờ phải check sau khi tính vì capacity không còn là field request) |
| 64 | `numberOfRows` = 0 hoặc âm, hoặc `seatsPerRow` = 0 hoặc âm | 400 (`@Min(1)` trên từng field, tách riêng khỏi check tổng capacity) |
| 65 | Tạo phòng thành công, gọi lại `GET /api/cinema-rooms/{id}` (qua Cluster Detail) | Response có đủ `totalSeatCapacity`, `numberOfRows`, `seatsPerRow`, `standardRowCount`, `vipRowCount`, `coupleRowCount` |
| 66 | Trang **Cinema Cluster Detail**, cột "Rows A–{X} · {seatsPerRow} seats/row" trong bảng room | Tính từ `room.numberOfRows`/`room.seatsPerRow` thật lấy từ API (fix — trước đây hardcode chia cho 10, sai hẳn với phòng IMAX vốn 15 ghế/hàng) |
| 67 | Admin thay đổi ba số Seat Zone | UI hiển thị phần trăm suy ra để tham khảo; chỉ cho submit khi tổng số hàng khớp `numberOfRows` |
