# API Contract — Movie Service

> **Source of Truth:** Đây là tài liệu chính thức định nghĩa toàn bộ API của Movie Service.
> Mọi thay đổi schema (thêm field, đổi tên, thay đổi kiểu dữ liệu) **phải được cập nhật tại đây và thống nhất với team trước khi sửa code**.

**Version:** v2.0.0
**Last Updated:** July 12, 2026
**Base URL (local):** `http://localhost:8082` (qua API Gateway: `http://localhost:8080`)

---

## 1. Tài nguyên tham chiếu

| Tài nguyên | Đường dẫn |
|---|---|
| OpenAPI YAML | `docs/api-specs/movie-service/movie-service.yaml` |
| Swagger UI (local) | `http://localhost:8082/swagger-ui` |
| API Docs JSON | `http://localhost:8082/v3/api-docs` |

---

## 2. Quy tắc phối hợp

**Frontend:** Không đợi backend. Dùng YAML file trong Swagger Editor để hiểu schema và mock data.

**Backend:** API-first. Mọi thay đổi schema phải cập nhật YAML và thông báo team trước khi sửa Java code.

---

## 3. Định dạng response chuẩn

```json
{
  "code": 200,
  "message": "...",
  "result": { }
}
```

- `code`: HTTP status code số nguyên
- `message`: Mô tả kết quả (optional)
- `result`: Payload chính — object, array, hoặc null

### Seat-hold checkout context

`POST /api/showtimes/{showtimeId}/seat-holds` additionally returns `movieId` and `clusterId`.
Both values are derived by Movie Service from the authoritative `ShowTime` record (`ShowTime.movie` and
`ShowTime.cinemaRoom.cluster`), not accepted from the client. Booking Service consumes this context when it calls
Promotion Service, so a client cannot apply a movie/showtime promotion to a different showtime.

`GET /api/showtimes/{showtimeId}/seat-map` also returns this read-only `movieId` and `clusterId` context for checkout
quote creation. Booking Service still creates the authoritative hold only through `POST /seat-holds` when it materializes
the booking.

---

## 4. Danh sách toàn bộ API

### 4.1 Movies — `/api/movies`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/movies` | Lấy danh sách phim có phân trang, filter theo `status`, `genreId`, `date` | Public |
| `GET` | `/api/movies/{id}` | Lấy chi tiết phim theo ID, hỗ trợ `?lang=vi\|en` | Public |
| `GET` | `/api/movies/{id}?lang=vi` | Lấy chi tiết phim với translations filter theo ngôn ngữ | Public |
| `GET` | `/api/movies/all` | Lấy toàn bộ phim (kể cả DRAFT) — dùng cho admin | ADMIN / EMPLOYEE |
| `GET` | `/api/movies/public` | Lấy phim đang chiếu và sắp chiếu — dùng cho trang khách | Public |
| `POST` | `/api/movies` | Tạo phim mới (status mặc định = DRAFT) | ADMIN / EMPLOYEE |
| `PUT` | `/api/movies/{id}` | Cập nhật thông tin phim | ADMIN / EMPLOYEE |
| `DELETE` | `/api/movies/{id}` | Xoá mềm phim (chuyển sang ENDED, chặn nếu còn suất chiếu tương lai) | ADMIN |
| `POST` | `/api/movies/images` | Upload ảnh lên Cloudinary, trả về URL | ADMIN / EMPLOYEE |

**Movie Status Transitions (POST commands):**

| Method | Endpoint | Chuyển trạng thái | Auth |
|--------|----------|-------------------|------|
| `POST` | `/api/movies/{id}/submit` | DRAFT → PENDING_REVIEW | ADMIN / EMPLOYEE |
| `POST` | `/api/movies/{id}/approve` | PENDING_REVIEW → COMING_SOON | ADMIN |
| `POST` | `/api/movies/{id}/reject` | PENDING_REVIEW → REJECTED | ADMIN |
| `POST` | `/api/movies/{id}/rework` | REJECTED → DRAFT | ADMIN / EMPLOYEE |
| `POST` | `/api/movies/{id}/release` | COMING_SOON → NOW_SHOWING | ADMIN |
| `POST` | `/api/movies/{id}/suspend` | NOW_SHOWING / COMING_SOON → SUSPENDED | ADMIN |
| `POST` | `/api/movies/{id}/reinstate` | SUSPENDED → NOW_SHOWING | ADMIN |
| `POST` | `/api/movies/{id}/end` | Bất kỳ → ENDED (trừ DRAFT, PENDING_REVIEW, REJECTED) | ADMIN |

---

### 4.2 Movie Images — `/api/movies/{movieId}/images`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/movies/{movieId}/images` | Lấy danh sách ảnh của phim (sắp xếp theo displayOrder) | Public |
| `POST` | `/api/movies/{movieId}/images` | Thêm ảnh vào phim | Public |
| `DELETE` | `/api/movies/{movieId}/images/{imageId}` | Xoá ảnh khỏi phim | Public |

---

### 4.3 Genres — `/api/genres`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/genres` | Lấy toàn bộ thể loại phim | Public |
| `GET` | `/api/genres/{id}` | Lấy thể loại theo ID | Public |
| `POST` | `/api/genres` | Tạo thể loại mới | ADMIN |

---

### 4.4 Age Ratings — `/api/age-ratings`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/age-ratings` | Lấy toàn bộ phân loại độ tuổi | Public |
| `GET` | `/api/age-ratings/{id}` | Lấy phân loại theo ID | Public |
| `POST` | `/api/age-ratings` | Tạo phân loại mới | ADMIN |
| `PUT` | `/api/age-ratings/{id}` | Cập nhật phân loại | ADMIN |
| `DELETE` | `/api/age-ratings/{id}` | Xoá phân loại | ADMIN |

---

### 4.5 Screening Formats — `/api/screening-formats`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/screening-formats` | Lấy toàn bộ định dạng chiếu (2D, 3D, IMAX...) | Public |
| `GET` | `/api/screening-formats/{id}` | Lấy định dạng theo ID | Public |
| `POST` | `/api/screening-formats` | Tạo định dạng mới | ADMIN |
| `PUT` | `/api/screening-formats/{id}` | Cập nhật định dạng | ADMIN |
| `DELETE` | `/api/screening-formats/{id}` | Xoá định dạng | ADMIN |

---

### 4.6 Production Companies — `/api/companies`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/companies` | Lấy danh sách công ty, hỗ trợ `?q=` tìm kiếm theo tên | Public |
| `GET` | `/api/companies/{id}` | Lấy công ty theo ID | Public |
| `POST` | `/api/companies` | Tạo công ty mới | ADMIN |
| `PUT` | `/api/companies/{id}` | Cập nhật thông tin công ty | ADMIN |
| `DELETE` | `/api/companies/{id}` | Xoá công ty | ADMIN |

---

### 4.7 Persons (Diễn viên / Đạo diễn) — `/api/persons`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/persons` | Lấy danh sách, hỗ trợ `?q=` tìm kiếm theo tên | Public |
| `GET` | `/api/persons/search?q=` | Alias tìm kiếm (backward compat) | Public |
| `GET` | `/api/persons/{id}` | Lấy person theo ID | Public |
| `POST` | `/api/persons` | Tạo person mới | Public |
| `PUT` | `/api/persons/{id}` | Cập nhật thông tin person | Public |
| `DELETE` | `/api/persons/{id}` | Xoá person | Public |

---

### 4.8 Cinema Clusters — `/api/cinema-clusters`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/cinema-clusters` | Lấy toàn bộ cụm rạp | Public |
| `GET` | `/api/cinema-clusters/{id}` | Lấy cụm rạp theo ID | Public |
| `POST` | `/api/cinema-clusters` | Tạo cụm rạp mới; ADMIN tạo `ACTIVE`, EMPLOYEE tạo `DRAFT`; lưu `createdBy` từ authenticated JWT principal | ADMIN / EMPLOYEE |
| `PUT` | `/api/cinema-clusters/{id}` | Cập nhật thông tin cụm rạp; lưu `updatedBy` từ authenticated JWT principal | ADMIN / EMPLOYEE |
| `DELETE` | `/api/cinema-clusters/{id}` | Xoá cụm rạp | ADMIN |
| `POST` | `/api/cinema-clusters/{id}/submit` | DRAFT → PENDING_REVIEW | ADMIN / EMPLOYEE |
| `POST` | `/api/cinema-clusters/{id}/approve` | PENDING_REVIEW → ACTIVE | ADMIN |
| `POST` | `/api/cinema-clusters/{id}/reject` | PENDING_REVIEW → DRAFT + rejectionNote | ADMIN |

**Audit actor (POST / PUT):** Service lấy actor từ authenticated JWT principal, không đọc `X-User-Name` do client gửi. `POST` set `createdBy`; `PUT` set `updatedBy` và giữ nguyên `createdBy`.

**CinemaCluster response:** có thêm `createdBy` và `updatedBy` (có thể `null` với record cũ hoặc trước lần cập nhật đầu tiên).

**Operational profile (V25):** request/response gồm `clusterCode`, `venueType`, `openingDate`,
`publicEmail`, `countryCode`, `district`, `ward`, `postalCode`, `buildingName`,
`floorLocation`, `timezone` và `operatingHours` đủ bảy ngày. `clusterCode` unique
không phân biệt hoa/thường và không được đổi sau khi cluster rời `DRAFT`.

Mỗi phần tử `operatingHours` có `dayOfWeek`, `opensAt`, `closesAt`,
`closesNextDay`, `closed`. Ngày đóng cửa không được mang giờ; ngày mở cửa phải có
đủ giờ mở/đóng. Hotline `19001000` tiếp tục được quản lý tập trung ở backend và
không phải input của form. Section Tiện ích chưa thuộc contract hiện tại.

---

### 4.9 Cinema Rooms — `/api/cinema-rooms`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/cinema-rooms` | Lấy toàn bộ phòng, hỗ trợ `?clusterId=` — response đã bao gồm các field wizard (roomCode, dimensions, master-data flat fields, activeLayout) | Public |
| `POST` | `/api/cinema-rooms` | Tạo phòng mới. Payload legacy (không có `wizardMode`) → tự generate seats, status `ACTIVE` ngay, hành vi y hệt trước đây. Payload `wizardMode: true` → tạo phòng `DRAFT` + layout v1 rỗng, không generate seat | ADMIN / EMPLOYEE |
| `GET` | `/api/cinema-rooms/{id}` | Lấy chi tiết 1 phòng (mới) — dùng để resume wizard draft sau khi reload | Public |
| `PUT` | `/api/cinema-rooms/{id}` | Cập nhật field bước 1/2 của wizard (roomCode, tên, auditoriumClassId, kích thước, presentationSystem, projection/resolution/screen/audio/2D/3D) — chỉ khi phòng đang `DRAFT` (mới) | ADMIN / EMPLOYEE |
| `GET` | `/api/cinema-rooms/{id}/seats` | Lấy danh sách ghế của phòng | Public |
| `POST` | `/api/cinema-rooms/{id}/maintenance` | Báo sự cố → phòng tự chuyển TEMPORARILY_UNAVAILABLE | Public |
| `POST` | `/api/cinema-rooms/maintenance/{maintenanceId}/resolve` | Resolve sự cố → phòng tự trở về ACTIVE | Public |
| `PATCH` | `/api/cinema-rooms/{id}/status` | Đặt thủ công trạng thái phòng | Public |

**Wizard-mode `POST` body (`wizardMode: true`):** `cinemaRoomName`, `roomCode`,
`clusterId`, `auditoriumClassId`, `lengthM`, `widthM`, `clearHeightM` bắt buộc;
`projectionTechnologyId`, `presentationSystem`, `resolutionId`, `screenWidthM`, `screenHeightM`,
`supports2d`, `supports3d`, `audioFormatId` optional (điền ở bước 2 qua `PUT`).
Các field legacy (`roomType`, `numberOfRows`, `seatsPerRow`,
`standardRowCount`, `vipRowCount`, `coupleRowCount`, `defaultPrice`) vẫn phải
gửi (DTO dùng chung) nhưng bị bỏ qua ở backend khi `wizardMode: true` — gửi giá
trị placeholder (`roomType: "STANDARD"`, `numberOfRows: 1`, `seatsPerRow: 1`,
`standardRowCount: 1`, `vipRowCount: 0`, `coupleRowCount: 0`,
`defaultPrice: 1`).

**`CinemaRoomResponse` field mới (null nếu phòng tạo qua flow nhanh cũ):**
`roomCode`, `lengthM`, `widthM`, `clearHeightM`, `areaSqm` (tính = length×width),
`auditoriumClassId/Code/Name`, `projectionTechnologyId/Code/Name`, `presentationSystem`,
`resolutionId/Code`, `screenWidthM`, `screenHeightM`, `screenAspectRatio` (tính),
`supports2d`, `supports3d`, `audioFormatId/Code`, `activeLayout` (summary của
layout ACTIVE, hoặc layout mới nhất nếu chưa có bản ACTIVE nào).

---

### 4.9a Cinema Room Master Data — `/api/cinema-room-master-data`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/cinema-room-master-data` | Aggregate read-only: 4 danh sách master data, database-managed `roomTemplates`, và các danh sách enum-backed, gồm `presentationSystems = [STANDARD, IMAX, DOLBY_CINEMA, SCREENX]`. `roomTemplates` cung cấp quick-start mặc định cho service tier, projection, resolution, audio, grid và layout rule; không chứa Room Code/Name, kích thước phòng hoặc kích thước màn hình. | Public |

Không có CRUD endpoint riêng cho 4 master table này ở sprint này (seed qua
migration `V18`) — xem [`CINEMA_ROOM_BUSINESS_RULES.md`](../../CINEMA_ROOM_BUSINESS_RULES.md#layout-p1-002--master-data-not-enums-for-configurable-dimensions).

---

### 4.9b Cinema Room Layouts — `/api/cinema-rooms/{roomId}/layouts`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/cinema-rooms/{roomId}/layouts` | Danh sách tất cả version của layout (mới nhất trước), dạng summary | Public |
| `GET` | `/api/cinema-rooms/{roomId}/layouts/{layoutId}` | Chi tiết 1 version, gồm toàn bộ `positions` | Public |
| `PUT` | `/api/cinema-rooms/{roomId}/layouts/{layoutId}` | Ghi đè toàn bộ `positions` + generator meta — chỉ khi layout đang `DRAFT` | ADMIN / EMPLOYEE |
| `POST` | `/api/cinema-rooms/{roomId}/layouts/{layoutId}/submit` | `DRAFT` → `PENDING_APPROVAL` (+ room → `PENDING_APPROVAL`) | ADMIN / EMPLOYEE |
| `POST` | `/api/cinema-rooms/{roomId}/layouts/{layoutId}/approve` | `PENDING_APPROVAL` → `APPROVED` (+ room → `APPROVED`) | ADMIN |
| `POST` | `/api/cinema-rooms/{roomId}/layouts/{layoutId}/reject` | `PENDING_APPROVAL` → `DRAFT` + `rejectionReason` (+ room → `DRAFT`). Body: `{ "note": "..." }` | ADMIN |
| `POST` | `/api/cinema-rooms/{roomId}/layouts/{layoutId}/activate` | `APPROVED` → `ACTIVE`, sync `seat` table, version cũ (nếu có) → `SUPERSEDED`, room → `ACTIVE` | ADMIN |
| `POST` | `/api/cinema-rooms/{roomId}/layouts/{layoutId}/clone` | Clone version bất kỳ (trừ `DRAFT`/`PENDING_APPROVAL`) thành version mới `DRAFT` | ADMIN / EMPLOYEE |

Khi `submit`, backend kiểm tra lại capacity envelope từ kích thước phòng: tối thiểu
`0,80 m²/người`, `4,0 m³/người`, seat module rộng `0,50 m`, row pitch `0,95 m`
và khoảng cách hàng đầu cho màn ảnh rộng. Layout vượt giới hạn trả
`ROOM_LAYOUT_EXCEEDS_ROOM_ENVELOPE (2063)`; kiểm tra này là planning guard và
không thay thế phê duyệt kiến trúc/PCCC.

**`RoomLayoutSaveRequest` body:** `numberOfRows`, `maxPositionsPerRow`,
`firstRowLabel`, `numberingDirection`, `numberingPolicy`
(`CONTIGUOUS_SEATS`/`PHYSICAL_POSITION`), `generatorTemplateCode`,
`generatorTemplateVersion`, `generationConfig` (versioned Layout Assistant JSON)
và `positions`
(bắt buộc, có thể rỗng khi còn nháp — `submit` mới chặn rỗng). Mỗi position:
`rowIndex`, `columnIndex`, `rowLabel`, `positionType`
(`SEAT`/`AISLE`/`EXIT`/`EMPTY_SPACE`), và khi `positionType = SEAT`:
`seatNumber`, `seatCode`, `seatType`
(`STANDARD`/`VIP`/`COUPLE`/`ACCESSIBLE`), `seatGroupId` (bắt buộc + trùng nhau
giữa đúng 2 vị trí liền kề cùng hàng nếu `seatType = COUPLE`), `manualOverride`
(đánh dấu vị trí được operator chỉnh sau khi generate để có thể giữ lại khi regenerate).

`positions` là dữ liệu vật lý có hiệu lực. Generator metadata chỉ phục vụ tái tạo
form/rule set và không được dùng thay thế cho dữ liệu layout đã lưu.

**`personCapacity`/`sellableUnitCount`** trong response luôn do backend tính
lại — client gửi gì cũng bị bỏ qua (xem
[`CINEMA_ROOM_BUSINESS_RULES.md`](../../CINEMA_ROOM_BUSINESS_RULES.md#layout-p0-004--capacity-is-always-backend-derived)).

---

### 4.10 Seats — `/api/seats`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/seats/room/{roomId}` | Lấy danh sách ghế theo phòng | Public |
| `GET` | `/api/seats/{id}` | Lấy ghế theo ID | Public |
| `PUT` | `/api/seats/{id}` | Cập nhật seatType và giá của ghế | Public |

---

### 4.11 Schedules (Showtimes) — `/api/schedules`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/schedules` | Lấy toàn bộ suất chiếu | Public |
| `GET` | `/api/schedules/{id}` | Lấy suất chiếu theo ID | Public |
| `GET` | `/api/schedules/movie/{movieId}` | Lấy suất chiếu theo phim, hỗ trợ `?date=YYYY-MM-DD` | Public |
| `POST` | `/api/schedules` | Tạo suất chiếu mới | ADMIN |
| `PUT` | `/api/schedules/{id}` | Cập nhật suất chiếu | ADMIN |
| `DELETE` | `/api/schedules/{id}` | Xoá suất chiếu | ADMIN |

---

### 4.12 Showtimes (legacy) — `/api/showtimes`

> **Lưu ý:** Controller này (`ShowTimeController`) chỉ expose 1 endpoint dùng nội bộ cho booking-service. Frontend nên dùng `/api/schedules` thay thế.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/showtimes/{id}/seats` | Lấy danh sách showtime_seat theo suất chiếu | Public |

---

### 4.13 TMDB Integration — `/api/movies/tmdb`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/movies/tmdb/search?q=` | Tìm phim trên TMDB theo từ khoá | ADMIN, EMPLOYEE |
| `GET` | `/api/movies/tmdb/{tmdbId}/details` | Lấy chi tiết phim từ TMDB | ADMIN, EMPLOYEE |
| `POST` | `/api/movies/tmdb/import` | Import phim từ TMDB vào DB với status=DRAFT | ADMIN, EMPLOYEE |

---

## 5. Enum Values tham chiếu

| Enum | Giá trị |
|------|---------|
| `MovieStatus` | `DRAFT`, `PENDING_REVIEW`, `COMING_SOON`, `NOW_SHOWING`, `SUSPENDED`, `ENDED`, `REJECTED` |
| `ShowTimeStatus` | `SCHEDULED`, `ON_SALE`, `CANCELLED`, `COMPLETED`, `SUSPENDED` |
| `ClusterStatus` | `DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `INACTIVE` |
| `CinemaRoomStatus` | Legacy: `ACTIVE`, `MAINTENANCE`, `TEMPORARILY_UNAVAILABLE`, `CLOSED`. Wizard-added: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SUSPENDED`, `RETIRED` |
| `SeatType` | `STANDARD`, `VIP`, `COUPLE`, `ACCESSIBLE` |
| `SeatStatus` | `ACTIVE`, `INACTIVE`, `MAINTENANCE` |
| `ShowtimeSeatStatus` | `AVAILABLE`, `RESERVED`, `SOLD`, `BLOCKED`, `CANCELLED` |
| `RoomType` | `STANDARD`, `LARGE`, `IMAX` (legacy quick-create only — wizard rooms use `auditoriumClassId` master data instead) |
| `ImageType` | `POSTER`, `BACKDROP`, `STILL`, `PROMOTIONAL` |
| `LayoutStatus` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `ACTIVE`, `REJECTED`, `SUPERSEDED` |
| `LayoutPositionType` | `SEAT`, `AISLE`, `EXIT`, `EMPTY_SPACE` |
| `NumberingDirection` | `LEFT_TO_RIGHT`, `RIGHT_TO_LEFT` |

---

## 6. Error Codes

Tham chiếu đầy đủ tại `docs/ERROR_CODES.md`. Một số code phổ biến:

| HTTP | Ý nghĩa |
|------|---------|
| `400` | Dữ liệu request không hợp lệ |
| `404` | Không tìm thấy resource |
| `409` | Conflict (phim đã tồn tại, trùng tên...) |
| `422` | Invalid status transition (sai workflow) |
| `500` | Lỗi server nội bộ |
