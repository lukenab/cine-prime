# Dữ liệu rạp chiếu phim thực tế — để tạo thủ công trên Admin UI

Data lấy từ tên/địa chỉ thật của các cụm rạp CGV, Lotte Cinema, Galaxy Cinema, BHD Star đang hoạt động tại Việt Nam (tra cứu qua web, tháng 7/2026), khớp đúng danh sách **province được validate cứng** trong `ProvinceValidator.java` (`movie-service`). Ghi chú rõ ở cột "Nguồn" để bạn biết field nào là dữ liệu thật, field nào là số hợp lệ nhưng không phải hotline thật.

⚠️ **Lưu ý quan trọng về `phoneNumber` (đã đổi quy tắc):** regex validate của dự án (`CinemaClusterRequest.phoneNumber`) giờ chỉ chấp nhận **định dạng hotline tổng đài**: `1900xxxx` hoặc `1800xxxx` (4-6 chữ số sau đầu số, regex `^1(900|800)[0-9]{4,6}$`). Số di động/số bàn thông thường (`0[35789]xxxxxxxx`, `02xxxxxxxxx`) **không còn hợp lệ**. Các số hotline bên dưới đều **đúng định dạng nhưng là số giả lập để test**, không phải hotline thật của từng rạp (hotline thật của các chuỗi CGV/Lotte/Galaxy/BHD dùng chung một đầu số tổng đài cho cả chuỗi, không theo từng cụm rạp).

---

## 1. Cinema Clusters (10 cụm, trải khắp 10/19 province được phép)

| # | Tên cụm rạp (clusterName) | Province (phải nhập **chính xác** chuỗi này) | Address | Phone number | Nguồn |
|---|---|---|---|---|---|
| 1 | CGV Vincom Bà Triệu | `Hà Nội` | Tầng 6, Vincom Bà Triệu, 191 Bà Triệu, Quận Hai Bà Trưng, Hà Nội | 19001001 | Địa chỉ thật (Foody); SĐT hotline định dạng hợp lệ, giả lập để test |
| 2 | CGV Crescent Mall | `TP. Hồ Chí Minh` | Tầng 5 Crescent Mall, 101 Tôn Dật Tiên, P. Tân Phú, Quận 7, TP. HCM | 19001002 | Địa chỉ thật (Foody); SĐT hotline định dạng hợp lệ, giả lập để test |
| 3 | Lotte Cinema Cần Thơ Ninh Kiều | `Cần Thơ` | TTTM Lotte Mart, 84 Đ. Mậu Thân, P. Cái Khế, Cần Thơ | 19001003 | **Địa chỉ thật** (Trustpilot VN); SĐT hotline định dạng hợp lệ, giả lập để test |
| 4 | Lotte Cinema Đà Nẵng | `Đà Nẵng` | Tầng 5&6 tòa nhà Lotte Mart Đà Nẵng, số 06 Nại Nam, P. Hoà Cường, Đà Nẵng | 19001004 | Địa chỉ thật; SĐT hotline định dạng hợp lệ, giả lập để test |
| 5 | Galaxy Nha Trang Center | `Khánh Hòa` | Nha Trang Center, 20 Trần Phú, P. Lộc Thọ, TP. Nha Trang, Khánh Hòa | 19001005 | Địa chỉ thật (79khanhhoa.com); SĐT hotline định dạng hợp lệ, giả lập để test |
| 6 | BHD Vincom Huế | `Huế` | 50A đường Hùng Vương, tổ 10, P. Phú Nhuận, TP. Huế | 19001006 | Địa chỉ thật (rapchieuphim.com); SĐT hotline định dạng hợp lệ, giả lập để test |
| 7 | CGV Vincom Dĩ An Bình Dương | `Bình Dương` | Lầu 3, Vincom Plaza Dĩ An, 1 đường DT743, KP. Thống Nhất, P. Dĩ An, TP. Dĩ An, Bình Dương | 19001007 | Địa chỉ thật (thelandmark81.com.vn); SĐT hotline định dạng hợp lệ, giả lập để test |
| 8 | Lotte Cinema Vincom Biên Hòa | `Đồng Nai` | Lầu 5, TTTM Vincom, 1096 Phạm Văn Thuận, P. Tân Mai, TP. Biên Hòa, Đồng Nai | 19001008 | Địa chỉ thật (Foody); SĐT hotline định dạng hợp lệ, giả lập để test |
| 9 | Lotte Cinema Vũng Tàu | `Bà Rịa - Vũng Tàu` | Tầng 3, TTTM Lotte Vũng Tàu, P. 8, TP. Vũng Tàu | 19001009 | Địa chỉ thật (MoMo); SĐT hotline định dạng hợp lệ, giả lập để test |
| 10 | CGV Vincom Plaza Imperia Hải Phòng | `Hải Phòng` | Tầng 4, TTTM Vincom Plaza Imperia, Khu đô thị Vinhomes Imperia, P. Thượng Lý, Q. Hồng Bàng, Hải Phòng | 19001010 | Địa chỉ thật (MoMo); SĐT hotline định dạng hợp lệ, giả lập để test |

Các field khác khi tạo cluster:
- **latitude/longitude**: optional, có thể để trống — nếu muốn điền, dùng toạ độ trung tâm thành phố tương ứng là đủ (không cần chính xác tới toà nhà cho mục đích test).
- **status**: cứ để backend tự set `DRAFT` khi tạo (theo code hiện tại, không cho set status lúc create).

---

## 2. Cinema Rooms mẫu (mỗi cụm gợi ý 2 phòng — 1 Standard + 1 Large/IMAX)

Sau khi tạo xong 10 cluster ở trên và có `clusterId` thật (do DB tự sinh), tạo phòng theo mẫu dưới — áp giá vé tham khảo theo mặt bằng chung CGV/Lotte 2026 (vé thường ngày trong tuần, chưa gồm ưu đãi):

| Cluster (map theo # ở bảng trên) | cinemaRoomName | roomType | totalSeatCapacity | defaultPrice (VND) |
|---|---|---|---|---|
| 1. CGV Vincom Bà Triệu | Room 1 | STANDARD | 90 | 85000 |
| 1. CGV Vincom Bà Triệu | Room 2 (IMAX) | IMAX | 220 | 160000 |
| 2. CGV Crescent Mall | Room 1 | STANDARD | 95 | 85000 |
| 2. CGV Crescent Mall | Room 2 | LARGE | 150 | 100000 |
| 3. Lotte Cần Thơ Ninh Kiều | Room 1 | STANDARD | 80 | 70000 |
| 3. Lotte Cần Thơ Ninh Kiều | Room 2 | LARGE | 130 | 85000 |
| 4. Lotte Đà Nẵng | Room 1 | STANDARD | 85 | 75000 |
| 4. Lotte Đà Nẵng | Room 2 | LARGE | 140 | 90000 |
| 5. Galaxy Nha Trang Center | Room 1 | STANDARD | 88 | 75000 |
| 5. Galaxy Nha Trang Center | Room 2 | LARGE | 145 | 90000 |
| 6. BHD Vincom Huế | Room 1 | STANDARD | 75 | 65000 |
| 6. BHD Vincom Huế | Room 2 | LARGE | 120 | 80000 |
| 7. CGV Dĩ An Bình Dương | Room 1 | STANDARD | 90 | 75000 |
| 7. CGV Dĩ An Bình Dương | Room 2 | LARGE | 150 | 90000 |
| 8. Lotte Vincom Biên Hòa | Room 1 | STANDARD | 85 | 75000 |
| 8. Lotte Vincom Biên Hòa | Room 2 | LARGE | 135 | 90000 |
| 9. Lotte Vũng Tàu | Room 1 | STANDARD | 80 | 70000 |
| 9. Lotte Vũng Tàu | Room 2 | LARGE | 125 | 85000 |
| 10. CGV Vincom Imperia Hải Phòng | Room 1 | STANDARD | 90 | 75000 |
| 10. CGV Vincom Imperia Hải Phòng | Room 2 | IMAX | 200 | 150000 |

Giới hạn ghế theo `RoomType` (đúng theo `ROOM_TYPE_CONFIG` trong `ManageCinemaRoomsPage.tsx`): STANDARD tối đa 100, LARGE tối đa 200, IMAX tối đa 300 — các số ghế ở trên đều nằm trong giới hạn, tránh lỗi `SEAT_QUANTITY_EXCEEDS_LIMIT`.

---

## 3. Thứ tự thao tác trên UI (đúng luồng vừa fix ở #164)

1. **Admin → Cinema Clusters → Add Cluster**: nhập lần lượt 10 dòng ở Bảng 1. Cluster tạo xong sẽ ở trạng thái `DRAFT`.
2. Với mỗi cluster: bấm **Submit** (chuyển `PENDING_REVIEW`) → **Approve** (chuyển `ACTIVE`) — theo đúng workflow đã có sẵn trong `CinemaClusterController`. Chỉ cluster `ACTIVE` mới hiện public cho khách.
3. **Admin → Cinema Rooms → Add Room**: chọn đúng cluster tương ứng trong dropdown (tính năng vừa fix), nhập theo Bảng 2.
4. Vào lại **Cinema Cluster Detail** của từng cluster để xác nhận `totalRooms`/`totalSeats` hiển thị đúng — đây chính là phần trước đây luôn hiện `0` do bug #164.

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

### 4.1 Cinema Cluster — Validation (`POST /api/cinema-clusters`)

| # | Input sai | Kỳ vọng |
|---|---|---|
| 1 | `clusterName` rỗng hoặc 1 ký tự | 400 — "Cluster name is required" / "must be between 2 and 100" |
| 2 | `province` không nằm trong danh sách cho phép (`ProvinceValidator.java`) | 400 |
| 3 | `address` < 10 ký tự | 400 — "Address must be at least 10 characters" |
| 4 | `phoneNumber` không đúng dạng hotline `1900xxxx`/`1800xxxx` — thử số di động thường `0901234567` | 400 |
| 5 | `latitude` ngoài [-90,90] hoặc `longitude` ngoài [-180,180] | 400 |

Lưu ý: **không có check trùng `clusterName`** trong code hiện tại — 2 cluster cùng tên vẫn tạo được.

### 4.2 Cinema Cluster — Happy path & role khởi tạo status

| # | Actor | Kỳ vọng |
|---|---|---|
| 6 | Login EMPLOYEE, tạo cluster hợp lệ | Status = `DRAFT` |
| 7 | Login ADMIN, tạo cluster hợp lệ | Status = `ACTIVE` ngay (tự approve, bỏ qua review) |

### 4.3 Cinema Cluster — Workflow (`/submit`, `/approve`, `/reject`)

| # | Case | Kỳ vọng |
|---|---|---|
| 8 | EMPLOYEE bấm Submit trên cluster `DRAFT` | → `PENDING_REVIEW` |
| 9 | Submit lại 1 cluster đang `PENDING_REVIEW`/`ACTIVE` | 400 `CLUSTER_INVALID_TRANSITION` |
| 10 | ADMIN Approve cluster `PENDING_REVIEW` | → `ACTIVE` |
| 11 | ADMIN Reject cluster `PENDING_REVIEW` kèm note | → `DRAFT`, `rejectionNote` được lưu |
| 12 | EMPLOYEE gọi thẳng `/approve` hoặc `/reject` | 403 |
| 13 | Approve/Reject cluster không phải `PENDING_REVIEW` (VD đang `DRAFT`) | 400 `CLUSTER_INVALID_TRANSITION` |
| 14 | EMPLOYEE sửa lại cluster đang bị reject (`DRAFT` + có rejectionNote) rồi save | `rejectionNote` tự xóa |

### 4.4 Cinema Cluster — Quyền edit / toggle status / delete

| # | Case | Kỳ vọng |
|---|---|---|
| 15 | EMPLOYEE sửa cluster đang `PENDING_REVIEW` hoặc `ACTIVE` | 400 `CLUSTER_INVALID_TRANSITION` (chỉ sửa được khi `DRAFT`) |
| 16 | ADMIN đổi status `ACTIVE↔INACTIVE` qua PUT | OK |
| 17 | ADMIN đổi status trực tiếp thành `DRAFT`/`PENDING_REVIEW` qua PUT | 400 (2 status này chỉ đi qua workflow endpoint) |
| 18 | EMPLOYEE gửi `status` bất kỳ trong PUT | 400 |
| 19 | ADMIN xóa cluster đang có room bên trong | 409 `CLUSTER_HAS_ROOMS` |
| 20 | ADMIN xóa cluster rỗng (0 room) | 200 |
| 21 | EMPLOYEE gọi DELETE | 403 |

### 4.5 Cinema Room — Validation (`POST /api/cinema-rooms`)

| # | Input sai | Kỳ vọng |
|---|---|---|
| 22 | `cinemaRoomName` rỗng / 1 ký tự | 400 |
| 23 | `totalSeatCapacity` < 10 | 400 (`@Min(10)`) |
| 24 | `defaultPrice` = 0 hoặc âm | 400 |
| 25 | `clusterId` trỏ tới cluster không tồn tại | 404 `CLUSTER_NOT_FOUND` |
| 26 | `totalSeatCapacity` vượt `maxSeats` theo `roomType`: STANDARD > 100, LARGE > 200, IMAX > 300 | 409 `SEAT_QUANTITY_EXCEEDS_LIMIT` |

### 4.6 Cinema Room — Uniqueness theo cluster (fix #144, migration V7)

| # | Case | Kỳ vọng |
|---|---|---|
| 27 | Tạo "Room 1" ở cluster A, rồi "Room 1" ở **cluster B khác** | ✅ Thành công cả 2 — chính là pattern dùng ở Bảng 2 (mọi cluster đều có "Room 1"/"Room 2"), trước khi fix #144 bước này sẽ bị 409 ngay từ cluster thứ 2 |
| 28 | Tạo "Room 1" ở cluster A, rồi "Room 1" ở **cùng cluster A** | 409 `CINEMA_ROOM_NAME_EXISTED` |

### 4.7 Cinema Room — Sinh ghế tự động theo zone (issue #166)

Verify bằng `GET /api/seats/room/{roomId}` sau khi tạo (theo `SeatService.generateSeatsForRoom`):

| # | Input | Kỳ vọng |
|---|---|---|
| 29 | STANDARD, `totalSeatCapacity=50` | 5 hàng (A-E): A,B,C = Standard (10/hàng); D = VIP (10); E = Couple 5 bản ghi (`colSpan=2`) → tổng 45 bản ghi Seat dù capacity=50 |
| 30 | STANDARD, `totalSeatCapacity=10` (nhỏ nhất) | 1 hàng, `totalRows=1 < 3` → không có vùng Couple, toàn bộ Standard |
| 31 | STANDARD, `totalSeatCapacity=21` | 3 hàng: A=Standard(10), B=VIP(10), C định là Couple nhưng dư 1 ghế < colSpan(2) → tự hạ xuống Standard (C1), tổng đúng 21 bản ghi |
| 32 | IMAX, bất kỳ capacity nào | Không bao giờ có hàng Couple (`coupleRowCount=0` với IMAX) |
| 33 | Giá ghế | VIP = `defaultPrice × 1.25`, Couple/Sweetbox = `defaultPrice × 1.8` |
| 34 | Ghế `SWEETBOX` | Không bao giờ tự sinh — chỉ gán thủ công qua `PUT /api/seats/{id}` (EditSeatModal) |

### 4.8 Cinema Room — Quyền

| # | Case | Kỳ vọng |
|---|---|---|
| 35 | EMPLOYEE tạo room | ✅ Cho phép — room không có workflow duyệt, tạo xong `ACTIVE` luôn |
| 36 | `GET /api/cinema-rooms` (cả 2 role) | Public, không cần auth |
