# Issues — Sprint 3: Content Management & Scheduling Layer
> Tổng: **18 issues** | Backend: 12 · Frontend: 4 · Database: 2  
> Issue numbers: #134 – #154

---

## Issue #134

**Title:** `[Backend] Implement release-date scheduler — auto-transition COMING_SOON → NOW_SHOWING`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

**Milestone:** Sprint 3

---

## Summary / Objective

Hiện tại `MovieScheduler.java` chỉ xử lý `NOW_SHOWING → ENDED` (endDate scheduler). Cần bổ sung job nightly chạy lúc 00:10 để tự động chuyển phim `COMING_SOON` sang `NOW_SHOWING` khi `releaseDate = today`. Đây là bước hoàn thiện vòng đời phim tự động, đồng thời là cặp đôi logic với endDate scheduler đã có.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Method `autoReleaseMovies()` trong `MovieScheduler` chạy cron `0 10 0 * * *` (00:10 mỗi đêm)
- [ ] Query `findByStatusAndReleaseDateLessThanEqual(COMING_SOON, today)` trả đúng danh sách phim
- [ ] Mỗi phim tìm được → chuyển `status = NOW_SHOWING`, `updatedBy = "SYSTEM"`
- [ ] Log `[MovieScheduler] → NOW_SHOWING: [id] title` cho từng phim
- [ ] Không ảnh hưởng đến `autoEndExpiredMovies()` đang chạy ở 00:05
- [ ] `@EnableScheduling` đã có sẵn trong `MovieServiceApplication` — không cần thêm

---

## Technical Notes / Constraints

- Thêm method mới vào `MovieScheduler.java` hiện tại, **không** tạo class mới.
- Repository method cần thêm: `List<Movie> findByStatusAndReleaseDateLessThanEqual(MovieStatus status, LocalDate date)`
- Dùng `LocalDate.now()` — scheduler chạy ngay sau nửa đêm nên điều kiện là `releaseDate <= today` (không phải `< today`) để bắt đúng phim release hôm nay.
- Đảm bảo `@Transactional` trên method mới giống `autoEndExpiredMovies()`.
- Cron order: 00:05 endDate job chạy trước, 00:10 releaseDate job chạy sau — không xung đột.

---

## Related

- Branch: `feat/movie-release-scheduler`
- Depends on: `MovieScheduler.java` (đã có), `MovieRepository.java`
- Closes: #134
- Liên quan: #132 (endDate scheduler đã implement)

---
---

## Issue #135

**Title:** `[Backend] Seat pricing per showtime — add ShowTime.basePrice and fix hardcoded 100,000 VND`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 3

---

## Summary / Objective

Hai vấn đề liên quan đến pricing cần giải quyết trong cùng một issue:
1. `ShowTime` entity thiếu field `basePrice` — không có cách lưu giá tổng quát per showtime (giá VIP tối, suất đặc biệt...).
2. `ShowTimeService.getSeatsByShowtime()` lazy-init `showtime_seat` hardcode giá `100000.00` thay vì dùng `seat.getPrice()` hoặc `showTime.basePrice`.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `ShowTime` entity có field `basePrice DECIMAL(12,2)` (nullable — nếu null, fallback về `seat.getPrice()`)
- [ ] DB schema: thêm cột `base_price` vào bảng `show_time` (`ALTER TABLE IF NOT EXISTS`)
- [ ] `CreateShowTimeRequest` có field `basePrice` (optional, `BigDecimal`)
- [ ] `UpdateShowTimeRequest` có field `basePrice` (optional)
- [ ] `ShowTimeResponse` trả về `basePrice`
- [ ] Lazy-init trong `getSeatsByShowtime()` dùng `showTime.basePrice ?? seat.getPrice() ?? 85000`
- [ ] `ShowtimeSeatDto` trả đúng giá trong response của `GET /api/showtimes/{id}/seats`
- [ ] `POST /api/schedules` lưu `basePrice` nếu được truyền vào

---

## API Specifications (if applicable)

### API — Create Showtime (thêm basePrice)

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/schedules` |
| Auth Required | Yes (ADMIN) |

**Request Body:**
```json
{
  "movieId": 1,
  "cinemaRoomId": 3,
  "showDate": "2026-07-20",
  "startTime": "14:30",
  "languageCode": "vi",
  "basePrice": 120000
}
```

**Response 201 Created:**
```json
{
  "code": 1000,
  "result": {
    "showTimeId": 55,
    "movieId": 1,
    "movieName": "Avengers",
    "cinemaRoomId": 3,
    "cinemaRoomName": "Phòng IMAX 1",
    "showDate": "2026-07-20",
    "startTime": "14:30",
    "endTime": "16:48",
    "status": "SCHEDULED",
    "basePrice": 120000
  }
}
```

---

## Technical Notes / Constraints

- DB migration: `ALTER TABLE show_time ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2) NULL;`
- Pricing priority trong lazy-init:
  ```java
  BigDecimal price = showTime.getBasePrice() != null
      ? showTime.getBasePrice()
      : (seat.getPrice() != null ? seat.getPrice() : new BigDecimal("85000.00"));
  ```
- `ShowTimeResponse` đã không có `basePrice` — cần thêm field vào DTO và mapper.

---

## Related

- Branch: `feat/showtime-seat-pricing`
- Depends on: `ShowTimeService.java`, `ShowTime.java`, `Seat.java`
- Closes: #135

---
---

## Issue #136

**Title:** `[Backend] Expose seat status management endpoint — PATCH /api/seats/{id}/status`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Low`

**Milestone:** Sprint 3

---

## Summary / Objective

`SeatService.setSeatStatus()` đã tồn tại nhưng chưa được expose qua HTTP. Admin cần khả năng chuyển ghế sang `MAINTENANCE` hoặc `INACTIVE` (ví dụ: ghế bị hỏng) mà không cần restart server. Endpoint này cũng là tiền đề cho trang Cinema Rooms admin UI (issue #138).

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `PATCH /api/seats/{id}/status?status=MAINTENANCE` hoạt động, trả `SeatResponse` với status mới
- [ ] Chỉ ADMIN mới gọi được (`@PreAuthorize("hasRole('ADMIN')")`)
- [ ] Validate status hợp lệ: `ACTIVE`, `INACTIVE`, `MAINTENANCE` — trả 400 nếu sai
- [ ] Seat không tồn tại → trả `MovieErrorCode.SEAT_NOT_FOUND` (hoặc error code phù hợp)
- [ ] `SeatController` được update thêm endpoint mới

---

## API Specifications (if applicable)

### API — Set Seat Status

| Field | Details |
|---|---|
| Method | `PATCH` |
| Endpoint | `/api/seats/{id}/status` |
| Auth Required | Yes (ADMIN) |

**Query Param:** `?status=MAINTENANCE`

**Response 200 OK:**
```json
{
  "code": 1000,
  "result": {
    "seatId": 42,
    "seatCode": "C5",
    "seatType": "STANDARD",
    "status": "MAINTENANCE",
    "price": 90000
  }
}
```

**Response (Error — invalid status):**
```json
{ "code": 4001, "message": "Invalid seat status" }
```

---

## Technical Notes / Constraints

- `setSeatStatus(Long seatId, SeatStatus status)` đã có trong `SeatService` — chỉ cần thêm endpoint vào `SeatController`.
- Enum `SeatStatus`: `ACTIVE`, `INACTIVE`, `MAINTENANCE` (đã có trong `movieservice.enums`).
- Cân nhắc: nếu ghế đang `RESERVED` ở một showtime sắp tới, không nên cho phép chuyển sang `INACTIVE`/`MAINTENANCE` — thêm guard check nếu cần, hoặc để Sprint 4.

---

## Related

- Branch: `feat/seat-status-api`
- Depends on: `SeatController.java`, `SeatService.java`
- Closes: #136
- Liên quan: #138 (Cinema Rooms seat map UI)

---
---

## Issue #137

**Title:** `[Frontend] Fix showtimeApi — migrate from /api/showtimes to /api/schedules`

**Labels:** `Layer::Frontend`, `Type::Bug`, `Priority::High`

**Milestone:** Sprint 3

---

## Summary / Objective

`showtimeApi.ts` đang gọi `/api/showtimes` và `/api/showtimes/assign` — các endpoint cũ không còn mapping trên backend. Backend Sprint 2 đã tạo `ScheduleController` tại `/api/schedules` với đầy đủ CRUD. `ManageShowTimePage` hiện tại sẽ bị lỗi 404 khi fetch danh sách và tạo showtime. Cần update API client và align DTO types.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `showtimeApi.getShowtimes()` gọi `GET /api/schedules`
- [ ] `showtimeApi.createShowtime()` gọi `POST /api/schedules` với body theo `CreateShowTimeRequest`
- [ ] `showtimeApi.updateShowtime()` gọi `PUT /api/schedules/{id}`
- [ ] `showtimeApi.deleteShowtime()` gọi `DELETE /api/schedules/{id}`
- [ ] `showtimeApi.getByMovie()` gọi `GET /api/schedules/movie/{movieId}?date=...`
- [ ] `ShowtimeResponse` type align với backend: `showTimeId`, `showDate`, `startTime`, `endTime`, `status`, `movieId`, `movieName`, `cinemaRoomId`, `cinemaRoomName`
- [ ] `ManageShowTimePage` load danh sách showtime thành công (không còn 404)

---

## Technical Notes / Constraints

- File cần sửa: `client/src/api/showtimeApi.ts`
- Backend `ShowTimeResponse` fields: `showTimeId` (không phải `showtimeId`), không có `cinemaId`/`cinemaName` riêng — chỉ có `cinemaRoomId`, `cinemaRoomName`.
- `CreateShowTimeRequest` backend: `movieId`, `cinemaRoomId`, `showDate`, `startTime`, `languageCode`, `subtitleCode` — **không có** `endTime` (tính tự động từ movie duration) và **không có** `basePrice` (cho đến khi #135 xong).
- Xóa field `basePrice` khỏi `ShowtimeAssignPayload` tạm thời nếu backend chưa hỗ trợ.

---

## Related

- Branch: `fix/showtime-api-endpoint`
- Depends on: `ScheduleController.java` (đã có backend)
- Closes: #137
- Liên quan: Sprint 2 #57 (Showtime Management UI đã build)

---
---

## Issue #138

**Title:** `[Frontend] Admin — Cinema Rooms seat map visualizer`

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 3

---

## Summary / Objective

`ManageCinemaRoomsPage.tsx` đã có danh sách phòng và modal thêm phòng, nhưng chưa có seat map visualizer. Admin cần nhìn thấy layout ghế thực tế (grid A1–ZN) để kiểm tra cấu hình phòng trước khi kích hoạt. Trang `RoomDetailPage.tsx` tồn tại nhưng chưa hiển thị seat grid — issue này bổ sung component seat map cho trang đó.

---

## Estimate

- [ ] S (< 2h) / M (2–4h) / **L (4–8h)** / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Nhấn vào một phòng trong danh sách → navigate đến `RoomDetailPage` hoặc mở drawer
- [ ] `GET /api/cinema-rooms/{id}/seats` được gọi và seats được render dưới dạng grid
- [ ] Mỗi ghế hiển thị: `seatCode`, màu theo `SeatType` (STANDARD / VIP / COUPLE / SWEETBOX), icon nếu `status = MAINTENANCE`
- [ ] Seat map responsive, scroll ngang nếu phòng nhiều cột
- [ ] Admin có thể click ghế để đổi status (`ACTIVE` / `MAINTENANCE`) — gọi `PATCH /api/seats/{id}/status` (issue #136)
- [ ] Trạng thái loading và empty state được xử lý

---

## UI Reference / Mockup

Grid layout (ví dụ phòng STANDARD 50 ghế — 5 hàng × 10 cột):

```
     1   2   3   4   5   6   7   8   9   10
A  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
B  [ ]  [ ]  [ ]  [V]  [V]  [V]  [V]  [ ]  [ ]  [ ]
C  [ ]  [M]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [M]  [ ]
D  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
E  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]

Legend: [ ] = STANDARD   [V] = VIP   [M] = MAINTENANCE
```

---

## Technical Notes / Constraints

- API đã có: `GET /api/cinema-rooms/{id}/seats` (trong `CinemaRoomController`)
- `PATCH /api/seats/{id}/status` cần issue #136 hoàn thành trước.
- Group ghế theo `rowLabel` (A, B, C...) và sort theo `colNumber` để render đúng grid.
- Màu theo seat type: STANDARD = xám, VIP = vàng, COUPLE = hồng, SWEETBOX = tím, MAINTENANCE = đỏ.
- Depends on: issue #136 cho tính năng click-to-toggle status.

---

## Related

- Branch: `feat/cinema-room-seat-map`
- Depends on: #136 (seat status API), `CinemaRoomController` (đã có `GET /api/cinema-rooms/{id}/seats`)
- Closes: #138

---
---

## Issue #139

**Title:** `[Frontend] Admin — Movie pending review panel with approve/reject and rejection note`

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::High`

**Milestone:** Sprint 3

---

## Summary / Objective

`ManageMoviePage.tsx` đã có tab "Pending Review" và inline approve/reject buttons, nhưng thiếu flow rejection note (lý do từ chối). Khi admin reject một phim, cần nhập lý do để employee hiểu cần sửa gì. Issue này thêm một modal/drawer dedicated cho pending review với input field cho rejection note và batch review capability.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Khi ở tab "Pending Review", mỗi movie card có button "Review" mở `PendingReviewModal`
- [ ] Modal hiển thị: poster, title, genre, duration, release date, age rating, synopsis
- [ ] Nút **Approve** → gọi `movieApi.approveMovie(id)`, đóng modal, refresh list
- [ ] Nút **Reject** → yêu cầu nhập rejection note (required, min 10 chars) → gọi `movieApi.rejectMovie(id, note)`
- [ ] Rejection note field hiển thị khi click "Reject" (không hiện ngay từ đầu)
- [ ] Loading state trên cả 2 nút trong khi API đang gọi
- [ ] Toast thông báo kết quả (success / error)
- [ ] Sau approve/reject, movie biến khỏi tab Pending Review

---

## Technical Notes / Constraints

- API đã có: `movieApi.approveMovie(id)` và `movieApi.rejectMovie(id, note)` — chỉ cần build UI.
- Tạo component mới: `client/src/layouts/PendingReviewModal.tsx`
- Import vào `ManageMoviePage.tsx` và thay thế inline approve/reject buttons ở tab PENDING_REVIEW.
- Rejection note nên dùng `<textarea>` với `minLength={10}` và counter hiển thị số ký tự.
- Có thể giữ inline approve button nhanh, nhưng reject **bắt buộc** mở modal để nhập note.

---

## Related

- Branch: `feat/admin-pending-review-panel`
- Depends on: `movieApi.ts` (approveMovie, rejectMovie — đã có), `ManageMoviePage.tsx`
- Closes: #139

---
---

## Issue #140

**Title:** `[Frontend] Customer — Movie listing: tách section NOW_SHOWING và COMING_SOON`

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 3

---

## Summary / Objective

`MoviesPage.tsx` hiện render tất cả phim có poster thành một grid duy nhất, không phân biệt phim đang chiếu và phim sắp chiếu. Customer cần thấy rõ hai section riêng biệt: "Đang Chiếu" (NOW_SHOWING) và "Sắp Chiếu" (COMING_SOON) — đây là UI pattern chuẩn của các trang rạp chiếu phim.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Section "Đang Chiếu" hiển thị tất cả phim `status = NOW_SHOWING` (có poster)
- [ ] Section "Sắp Chiếu" hiển thị tất cả phim `status = COMING_SOON` (có poster)
- [ ] Phim `ENDED`, `DRAFT`, `PENDING_REVIEW` không hiển thị trên trang customer
- [ ] Mỗi section có heading rõ ràng và số lượng phim (ví dụ: "Đang Chiếu (8)")
- [ ] Nếu một section không có phim → ẩn section đó (không hiện heading trống)
- [ ] Genre filter và search vẫn hoạt động đúng trong từng section
- [ ] Phim COMING_SOON hiển thị release date thay vì nút "Mua vé"
- [ ] Responsive trên cả mobile và desktop

---

## Technical Notes / Constraints

- Sửa `MoviesPage.tsx` — tách `filtered` useMemo hiện tại thành `nowShowing` và `comingSoon`.
- `MovieApiResponse` đã có field `status` — dùng trực tiếp để filter.
- COMING_SOON card: thay `<button>Mua vé</button>` bằng badge "Ra mắt {releaseDate}".
- Giữ nguyên `MoviePreviewModal` — chỉ thay đổi cách render danh sách.
- Thứ tự ưu tiên: NOW_SHOWING section trên (xem ngay), COMING_SOON section dưới.

---

## Related

- Branch: `feat/customer-movie-sections`
- Depends on: `movieApi.ts` (field `status` đã có), `MoviesPage.tsx`
- Closes: #140

---
---

## Issue #141

**Title:** `[Backend] Add actionType enum field to MovieActionLog entity`

**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::Low`

**Milestone:** Sprint 3

---

## Summary / Objective

`MovieActionLog` entity hiện tại chỉ có `actionDescription` (String tự do) và thiếu `actionType` enum có cấu trúc. Không có enum field thì không thể query log theo loại hành động (e.g. "lấy tất cả log APPROVE trong tháng"), và audit trail không có semantics rõ ràng.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo enum `MovieActionType`: `CREATE`, `UPDATE`, `SUBMIT_REVIEW`, `APPROVE`, `REJECT`, `SUSPEND`, `RESTORE`, `DELETE`, `STATUS_AUTO_CHANGE`
- [ ] `MovieActionLog` entity có field `@Enumerated(EnumType.STRING) MovieActionType actionType`
- [ ] DB: thêm cột `action_type VARCHAR(30)` vào bảng `movie_action_log`
- [ ] `AuditLogService.logAction()` (hoặc method tương đương) cập nhật signature để nhận `MovieActionType`
- [ ] Tất cả call site của `logAction()` trong `MovieService` truyền đúng enum value
- [ ] `MovieScheduler.autoEndExpiredMovies()` log với `MovieActionType.STATUS_AUTO_CHANGE`

---

## Technical Notes / Constraints

- DB migration: `ALTER TABLE movie_action_log ADD COLUMN IF NOT EXISTS action_type VARCHAR(30) NULL;`
- Sau khi migrate, có thể backfill từ `actionDescription` nếu cần, hoặc để NULL cho records cũ.
- Hiện tại `auditLogService.logAction("SYSTEM", "Admin", "movie:"+id, "Created movie: ...")` — cần thêm tham số `actionType` hoặc overload method.
- `actionDescription` vẫn giữ lại cho human-readable detail.

---

## Related

- Branch: `chore/movie-action-log-type`
- Depends on: `MovieActionLog.java`, `AuditLogService.java` (hoặc `MovieService.java`)
- Closes: #141

---
---

## Issue #142

**Title:** `[Backend] Refactor MovieCast.roleType from String to Enum`

**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::Medium`

**Milestone:** Sprint 3

---

## Summary / Objective

`MovieCast.roleType` hiện là `String` tự do — không enforce domain values, không có validation, và có thể bị typo ("DIRECTO" thay vì "DIRECTOR"). Cần chuyển sang Enum `CastRoleType` để đảm bảo tính nhất quán, cho phép filter/query có cấu trúc, và giảm lỗi runtime.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo enum `CastRoleType`: `DIRECTOR`, `ACTOR`, `PRODUCER`, `WRITER`, `CINEMATOGRAPHER`, `COMPOSER`, `EDITOR`
- [ ] `MovieCast.roleType` đổi từ `String` sang `@Enumerated(EnumType.STRING) CastRoleType`
- [ ] `CastRequest` DTO dùng `CastRoleType roleType` (hoặc `String` với validation `@Pattern`)
- [ ] DB column `role_type` giữ nguyên VARCHAR(20) — không cần migration nếu giá trị hiện tại match enum names
- [ ] `MovieMapper` / `MovieService.saveCast()` compile và hoạt động đúng sau refactor
- [ ] Unique constraint `(movie_id, person_id, role_type)` vẫn hoạt động

---

## Technical Notes / Constraints

- Kiểm tra data hiện tại trong DB: `SELECT DISTINCT role_type FROM movie_cast;` — đảm bảo tất cả values match enum names trước khi migrate.
- Nếu có value không match → cần data migration script hoặc thêm value vào enum.
- `CastRequest` có thể giữ `String roleType` và parse thành enum trong service để tránh breaking API contract.
- UniqueConstraint trên entity: `columnNames = {"movie_id", "person_id", "role_type"}` — không đổi.

---

## Related

- Branch: `chore/movie-cast-role-type-enum`
- Depends on: `MovieCast.java`, `MovieService.saveCast()`, `CastRequest.java`
- Closes: #142

---
---

## Issue #143

**Title:** `[Backend] Fix updateMovie() — replace delete-all/re-insert with upsert for Translations and Cast`

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

**Milestone:** Sprint 3

---

## Summary / Objective

`MovieService.updateMovie()` hiện xử lý Translations và Cast theo pattern delete-all-then-re-insert: xóa toàn bộ records, rồi insert lại từ đầu. Đây là anti-pattern nguy hiểm: nếu `saveCast()` ném exception sau khi `deleteByMovie_MovieId()` đã commit (hoặc transaction không được wrap đúng), movie sẽ bị mất toàn bộ cast. Ngoài ra, IDs thay đổi mỗi lần update — phá vỡ external references.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `updateMovie()` được annotate `@Transactional` (nếu chưa có)
- [ ] Translations: dùng `saveAll()` với composite key `(movie_id, language_code)` — JPA merge nếu tồn tại, insert nếu mới; xóa chỉ những translations có language_code không còn trong request
- [ ] Cast: dùng upsert dựa trên `(movie_id, person_id, role_type)` unique constraint — update `characterName` nếu đã tồn tại, insert nếu mới; xóa chỉ những cast entries không còn trong request
- [ ] Không mất dữ liệu nếu `saveAll()` ném exception ở giữa — transaction rollback toàn bộ
- [ ] Existing cast IDs không thay đổi khi chỉ update `characterName`

---

## Technical Notes / Constraints

- Kiểm tra `@Transactional` trên method `updateMovie()` — hiện tại không có, cần thêm.
- Pattern đúng cho Translations (composite key):
  ```java
  // Xóa translations không còn trong request
  Set<String> incomingLangs = request.getTranslations().stream()
      .map(TranslationRequest::getLanguageCode).collect(Collectors.toSet());
  existing.removeIf(t -> !incomingLangs.contains(t.getId().getLanguageCode()));
  movieTranslationRepository.deleteAll(toDelete);
  // Upsert: movieTranslationRepository.save() sẽ merge nếu composite key exists
  ```
- Pattern đúng cho Cast: dùng `findByMovie_MovieIdAndPersonPersonIdAndRoleType()` để check trước insert.
- Cần thêm `findByMovie_MovieId()` vào `MovieCastRepository` nếu chưa có.

---

## Related

- Branch: `fix/update-movie-upsert`
- Depends on: `MovieService.java`, `MovieTranslationRepository.java`, `MovieCastRepository.java`
- Closes: #143

---
---

## Issue #144

**Title:** `[Database] Fix CinemaRoom.cinemaRoomName unique constraint — scope to cluster level`

**Labels:** `Layer::Database`, `Type::Bug`, `Priority::Medium`

**Milestone:** Sprint 3

---

## Summary / Objective

`CinemaRoom.cinemaRoomName` có `unique = true` ở mức global — không thể có hai phòng tên "Phòng 1" ở hai cụm rạp khác nhau. Constraint đúng phải là unique trong phạm vi cùng một `cluster_id` (hoặc `cinema_cluster_id`). Đây là lỗi schema ảnh hưởng production khi mở rộng thêm cụm rạp mới.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Xóa `unique = true` trên column `cinema_room_name` trong `CinemaRoom.java`
- [ ] Thêm `@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"cluster_id", "cinema_room_name"}))` vào entity
- [ ] DB migration: `ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS <unique_constraint_name>; ALTER TABLE cinema_room ADD CONSTRAINT uq_room_name_per_cluster UNIQUE (cluster_id, cinema_room_name);`
- [ ] Hai phòng tên "Phòng IMAX 1" ở hai cluster khác nhau có thể tạo thành công
- [ ] Hai phòng trùng tên trong cùng cluster vẫn bị reject với lỗi rõ ràng

---

## Technical Notes / Constraints

- Tìm tên constraint hiện tại: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'cinema_room' AND constraint_type = 'UNIQUE';`
- Kiểm tra `CinemaRoom` entity có field `cluster` (ManyToOne FK `cluster_id`) — nếu có thì `columnNames = {"cluster_id", "cinema_room_name"}` là đúng.
- Nếu dùng `docker compose down -v` để reset DB dev, chỉ cần sửa `movie_db.sql`. Nếu volume đang chạy, cần chạy SQL migration thủ công qua `docker exec`.
- Sửa cả `movie_db.sql` (init script) để schema mới được áp dụng khi recreate.

---

## Related

- Branch: `fix/cinema-room-name-unique-constraint`
- Depends on: `CinemaRoom.java`, `movie_db.sql`
- Closes: #144

---
---

## Issue #145

**Title:** `[Backend] Add pessimistic locking to ShowtimeSeat.lockSeats() — prevent race condition`

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

**Milestone:** Sprint 3

---

## Summary / Objective

`ShowTimeService.lockSeats()` dùng plain `showtimeSeatRepository.findById()` không có database-level locking. Trong môi trường concurrent, hai request đồng thời có thể cùng đọc seat là `AVAILABLE`, cùng chuyển sang `RESERVED`, và cùng save — request sau ghi đè request trước (lost update). `SeatLockRepository` trong booking-service đã implement `@Lock(PESSIMISTIC_WRITE)` đúng — cần apply pattern tương tự cho `ShowtimeSeat`.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `ShowtimeSeatRepository` có method `findByShowtimeSeatIdWithLock(Long id)` với `@Lock(LockModeType.PESSIMISTIC_WRITE)`
- [ ] `ShowTimeService.lockSeats()` dùng method lock thay vì `findById()`
- [ ] `ShowtimeSeat` entity có `@Version Long version` để bắt optimistic lock conflict nếu lock bị bypass
- [ ] DB: thêm cột `version BIGINT DEFAULT 0` vào bảng `showtime_seat`
- [ ] Concurrent test: hai thread lock cùng seatId trong cùng showtime → một thành công, một nhận exception "Seat is not available"
- [ ] `@Transactional` trên `lockSeats()` — đảm bảo lock released đúng sau transaction

---

## Technical Notes / Constraints

- Method cần thêm vào `ShowtimeSeatRepository`:
  ```java
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT s FROM ShowtimeSeat s WHERE s.showtimeSeatId = :id")
  Optional<ShowtimeSeat> findByIdForUpdate(@Param("id") Long id);
  ```
- `lockSeats()` cần `@Transactional` — nếu không có lock chỉ tồn tại trong transaction.
- `@Version` là optional nhưng được khuyến nghị như lớp bảo vệ thứ hai (optimistic locking fallback).
- Pattern giống booking-service: `findForUpdate` → check status → `flush()` trước khi save batch.
- DB migration cho `version`: `ALTER TABLE showtime_seat ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;`

---

## Related

- Branch: `fix/showtime-seat-pessimistic-lock`
- Depends on: `ShowtimeSeatRepository.java`, `ShowTimeService.lockSeats()`, `ShowtimeSeat.java`
- Closes: #145

---
---

## Issue #149

**Title:** `[Backend] Add keyword search to GET /api/movies — ?q= filter by title`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

**Milestone:** Sprint 3

---

## Summary / Objective

`GET /api/movies` hiện chỉ filter theo `status`, `genreId`, `date` — không có full-text search theo tên phim. Admin không thể tìm phim nhanh theo tiêu đề trong `ManageMoviePage`, và customer cũng không thể search trên `MoviesPage`. Đây là tính năng cơ bản của mọi CMS phim.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `GET /api/movies?q=avenger` trả về các phim có `originalTitle` chứa keyword (case-insensitive)
- [ ] Search cũng match `MovieTranslation.title` (tiêu đề dịch) — ví dụ search "biệt đội" tìm được "Avengers"
- [ ] `q` kết hợp được với các filter khác: `?q=avenger&status=NOW_SHOWING&genreId=1`
- [ ] `q` rỗng hoặc không truyền → không filter, trả tất cả (hành vi hiện tại)
- [ ] Response vẫn dùng `Page<MovieResponse>` (có phân trang)

---

## API Specifications (if applicable)

### API — Movie search

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies` |
| Auth Required | No (public) hoặc ADMIN để xem tất cả status |

**Query params:** `?q=avenger&status=NOW_SHOWING&page=1&size=10`

**Response:** không đổi — `Page<MovieResponse>`

---

## Technical Notes / Constraints

- Thêm `@RequestParam(required = false) String q` vào `MovieController.getPage()`.
- `MovieRepository.findWithFilters()` cần thêm điều kiện `q`:
  ```java
  @Query("SELECT m FROM Movie m LEFT JOIN m.translations t WHERE " +
         "(:status IS NULL OR m.status = :status) AND " +
         "(:genreId IS NULL OR :genreId MEMBER OF (SELECT g.genreId FROM m.genres g)) AND " +
         "(:releaseDate IS NULL OR m.releaseDate = :releaseDate) AND " +
         "(:q IS NULL OR LOWER(m.originalTitle) LIKE LOWER(CONCAT('%', :q, '%')) " +
         "   OR LOWER(t.title) LIKE LOWER(CONCAT('%', :q, '%')))")
  Page<Movie> findWithFilters(..., @Param("q") String q, Pageable pageable);
  ```
- LEFT JOIN translations có thể tạo duplicate rows — cần `DISTINCT` hoặc `countQuery` riêng.
- Nếu JPQL JOIN phức tạp quá, có thể dùng `JpaSpecificationExecutor` với `Specification<Movie>`.

---

## Related

- Branch: `feat/movie-keyword-search`
- Depends on: `MovieRepository.java`, `MovieController.java`, `MovieService.findPageWithFilters()`
- Closes: #149

---
---

## Issue #150

**Title:** `[Backend] Add tagline field to Movie and MovieTranslation entities`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 3

---

## Summary / Objective

Hệ thống thiếu field `tagline` — câu slogan ngắn của phim ("Whatever it takes", "Phần kết thúc của mọi thứ"). Đây là field chuẩn trên TMDB, IMDb, CGV, và được hiển thị ngay dưới tiêu đề phim trên trang chi tiết. Cần thêm vào cả `Movie` (ngôn ngữ gốc) và `MovieTranslation` (bản dịch).

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `Movie` entity có field `tagline VARCHAR(300)` (nullable)
- [ ] `MovieTranslation` entity có field `tagline VARCHAR(300)` (nullable)
- [ ] DB migration: `ALTER TABLE movie ADD COLUMN IF NOT EXISTS tagline VARCHAR(300) NULL; ALTER TABLE movie_translation ADD COLUMN IF NOT EXISTS tagline VARCHAR(300) NULL;`
- [ ] `CreateMovieRequest` và `UpdateMovieRequest` có field `tagline` (optional)
- [ ] `TranslationRequest` có field `tagline` (optional)
- [ ] `MovieResponse` và `TranslationResponse` trả về `tagline`
- [ ] `TmdbService.importMovie()` map `tmdbDetail.tagline` → `movie.tagline` khi import
- [ ] `MovieMapper` update để map tagline

---

## Technical Notes / Constraints

- `movie_db.sql` init script cần update thêm 2 cột vào đúng bảng.
- TMDB API trả về `tagline` trực tiếp trên `TmdbMovieDetail` — cần check field name trong `TmdbMovieDetail.java` và map vào `Movie.tagline` khi import.
- `MovieTranslation.tagline` lấy từ TMDB translations — kiểm tra `TmdbTranslationsResponse` có field tagline không.
- Không cần validate format — tagline có thể null, string tự do max 300 ký tự.

---

## Related

- Branch: `feat/movie-tagline-field`
- Depends on: `Movie.java`, `MovieTranslation.java`, `CreateMovieRequest.java`, `TranslationRequest.java`, `TmdbService.java`
- Closes: #150

---
---

## Issue #151

**Title:** `[Backend] Refactor Movie.company to support multiple production companies (ManyToMany)`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 3

---

## Summary / Objective

`Movie.company` hiện là ManyToOne FK — mỗi phim chỉ có một công ty sản xuất. Thực tế co-production rất phổ biến (Disney + Pixar, Warner Bros + Legendary, v.v.). Cần chuyển sang ManyToMany với junction table `movie_production_company` để align với chuẩn TMDB và mô hình thực tế.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Xóa `@ManyToOne company` và `@JoinColumn(name = "company_id")` khỏi `Movie.java`
- [ ] Thêm `@ManyToMany List<ProductionCompany> companies` với junction table `movie_production_company(movie_id, company_id)`
- [ ] DB migration:
  ```sql
  CREATE TABLE IF NOT EXISTS movie_production_company (
      movie_id BIGINT NOT NULL,
      company_id BIGINT NOT NULL,
      PRIMARY KEY (movie_id, company_id),
      FOREIGN KEY (movie_id) REFERENCES movie(movie_id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES production_company(company_id)
  );
  ALTER TABLE movie DROP COLUMN IF EXISTS company_id;
  ```
- [ ] `CreateMovieRequest` và `UpdateMovieRequest`: `companyId` (Long) → `companyIds` (List<Long>)
- [ ] `MovieResponse`: `companyName` (String) → `companies` (List<ProductionCompanyResponse>)
- [ ] `MovieMapper` update để map danh sách companies
- [ ] `TmdbService.importMovie()` map `tmdbDetail.productionCompanies` → tìm hoặc tạo mới `ProductionCompany` records
- [ ] `MovieService.createMovie()` và `updateMovie()` xử lý list companyIds đúng

---

## Technical Notes / Constraints

- **Breaking change** trên API: field `companyId` → `companyIds` trong request; `companyName` → `companies` trong response. Cần update frontend sau.
- Dữ liệu hiện có: nếu có movies đang dùng `company_id`, cần data migration insert vào junction table trước khi drop column.
- `TmdbMovieDetail` có `production_companies: List<{id, name, logo_path, origin_country}>` — map từng item: nếu `tmdbId` tồn tại thì reuse, nếu không thì insert mới vào `production_company`.
- `movie_db.sql` cần update: thêm bảng `movie_production_company`, xóa `company_id` khỏi `movie` table.
- Frontend `MovieModal.tsx` cần đổi company dropdown từ single-select sang multi-select — nhưng có thể làm sau khi backend xong.

---

## Related

- Branch: `feat/movie-multi-company`
- Depends on: `Movie.java`, `ProductionCompany.java`, `MovieService.java`, `MovieMapper.java`, `movie_db.sql`
- Closes: #151

---
---

## Issue #152

**Title:** `[Backend] Refactor MovieImage.imageType from String to Enum`

**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::Low`

**Milestone:** Sprint 3

---

## Summary / Objective

`MovieImage.imageType` là `String` tự do — risk typo và inconsistency ("POSTER" vs "poster" vs "Poster"). Cùng pattern vấn đề như `MovieCast.roleType` (issue #142). Cần chuyển sang enum `MovieImageType` để enforce valid values tại compile-time.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo enum `MovieImageType`: `POSTER`, `BACKDROP`, `STILL`, `PROMOTIONAL`
- [ ] `MovieImage.imageType` đổi từ `String` → `@Enumerated(EnumType.STRING) MovieImageType imageType`
- [ ] `MovieImageRequest` DTO dùng `MovieImageType imageType` (hoặc `String` với `@Pattern` validation)
- [ ] `MovieImageResponse` trả về `imageType` là String (để không break API contract)
- [ ] `MovieMapper` compile và hoạt động đúng sau refactor
- [ ] Kiểm tra data hiện tại: `SELECT DISTINCT image_type FROM movie_image;` — đảm bảo tất cả values đã match enum names

---

## Technical Notes / Constraints

- DB column `image_type VARCHAR(30)` — không cần migration vì enum values giống string hiện tại (`POSTER`, `BACKDROP`, etc.).
- Nếu có data dùng lowercase hoặc mixed case → cần data fix trước: `UPDATE movie_image SET image_type = UPPER(image_type);`
- Kiểm tra `TmdbService` hoặc `ImageStorageService` có đang set `imageType` dạng String không — cần update sang `MovieImageType.POSTER` v.v.

---

## Related

- Branch: `chore/movie-image-type-enum`
- Depends on: `MovieImage.java`, `MovieImageRequest.java`, `MovieMapper.java`
- Closes: #152

---
---

## Issue #153

**Title:** `[Database] Extend MovieTranslation.languageCode to BCP-47 (length 5) for zh-TW / zh-CN distinction`

**Labels:** `Layer::Database`, `Type::Chore`, `Priority::Low`

**Milestone:** Sprint 3

---

## Summary / Objective

`MovieTranslation.languageCode` và `MovieTranslationId.languageCode` hiện dùng ISO 639-1 (length 2: "vi", "en", "ko"). Với length 2, không thể phân biệt tiếng Trung phồn thể ("zh-TW") vs giản thể ("zh-CN"), tiếng Bồ Đào Nha Brazil ("pt-BR") vs châu Âu ("pt-PT"). BCP-47 (length 5, format "ll-CC") là chuẩn quốc tế và là format TMDB dùng trong translations API.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `MovieTranslationId.languageCode` đổi `length = 2` → `length = 5`
- [ ] `MovieTranslation` entity: column `language_code` đổi từ `VARCHAR(2)` → `VARCHAR(5)`
- [ ] DB migration: `ALTER TABLE movie_translation MODIFY COLUMN language_code VARCHAR(5) NOT NULL;`
- [ ] `TranslationRequest.languageCode` validation: `@Pattern(regexp = "^[a-z]{2}(-[A-Z]{2})?$")` — chấp nhận cả "vi" và "vi-VN"
- [ ] `MovieController.getMovieByLang()` filter vẫn hoạt động với cả short ("vi") và long ("vi-VN") format
- [ ] TMDB translations import dùng BCP-47 codes từ TMDB response (e.g. "vi-VN" thay vì "vi")
- [ ] Data hiện tại không bị ảnh hưởng (VARCHAR mở rộng là backward-compatible)

---

## Technical Notes / Constraints

- `ALTER TABLE ... MODIFY COLUMN` (MySQL) hoặc `ALTER TABLE ... ALTER COLUMN ... TYPE VARCHAR(5)` (PostgreSQL).
- Với PostgreSQL: `ALTER TABLE movie_translation ALTER COLUMN language_code TYPE VARCHAR(5);`
- `MovieTranslationId` là `@Embeddable` — composite PK. Thay đổi column length không ảnh hưởng JPA cache nếu dùng `VARCHAR` (không phải CHAR).
- Existing data ("vi", "en", "ko") vẫn valid sau migration — không cần backfill.
- `?lang=vi` query: filter `equalsIgnoreCase("vi")` sẽ không match "vi-VN" — cần update `getMovieByLang()` để hỗ trợ cả prefix match (`languageCode.startsWith("vi")`).

---

## Related

- Branch: `chore/translation-language-code-bcp47`
- Depends on: `MovieTranslationId.java`, `MovieTranslation.java`, `TranslationRequest.java`, `MovieService.getMovieByLang()`
- Closes: #153

---
---

## Issue #154

**Title:** `[Backend] Add missing fields to Person entity — gender, knownForDepartment, deathDate, placeOfBirth`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Low`

**Milestone:** Sprint 3

---

## Summary / Objective

`Person` entity hiện có `fullName`, `birthDate`, `nationality`, `photoUrl`, `biography`, `tmdbId` — đủ cho use case cơ bản. Tuy nhiên thiếu một số fields quan trọng theo chuẩn TMDB và IMDb: `gender` (dùng để filter diễn viên), `knownForDepartment` (phân loại người theo vai trò chính: Directing/Acting/Writing), `deathDate`, `placeOfBirth`. Các fields này giúp trang Person detail phong phú hơn và cần thiết khi import đầy đủ từ TMDB.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `Person` entity có 4 fields mới:
  - `gender VARCHAR(10)` (nullable) — "MALE", "FEMALE", "NON_BINARY", "UNKNOWN"
  - `knownForDepartment VARCHAR(50)` (nullable) — "Acting", "Directing", "Writing", "Production", etc.
  - `deathDate DATE` (nullable)
  - `placeOfBirth VARCHAR(255)` (nullable)
- [ ] DB migration: `ALTER TABLE person ADD COLUMN IF NOT EXISTS ...` cho 4 cột
- [ ] `PersonRequest` DTO thêm 4 fields (tất cả optional)
- [ ] `PersonResponse` DTO trả về 4 fields mới
- [ ] `PersonController.create()` và `update()` lưu 4 fields
- [ ] `TmdbService` (hoặc `TmdbController.importMovie()`) map các fields từ TMDB person response khi import cast
- [ ] `movie_db.sql` init script cập nhật schema

---

## Technical Notes / Constraints

- TMDB `gender` trả về int (0=unknown, 1=female, 2=male, 3=non-binary) — cần convert sang String enum khi import.
- `knownForDepartment` TMDB trả về String: "Acting", "Directing", "Writing", "Production", "Sound", "Camera", "Art", "Costume & Make-Up".
- `gender` có thể là String hoặc Enum `PersonGender {MALE, FEMALE, NON_BINARY, UNKNOWN}`. Recommend String để tránh migration nếu TMDB thêm giá trị mới.
- `deathDate` cần check: nếu `deathdate` trong TMDB response là null → person vẫn sống (không set).
- `PersonController` hiện không dùng service layer (gọi thẳng repository) — không cần thay đổi pattern, chỉ thêm fields.

---

## Related

- Branch: `feat/person-extended-fields`
- Depends on: `Person.java`, `PersonRequest.java`, `PersonResponse.java`, `PersonController.java`
- Closes: #154

---
---

## Out-of-Scope — Ghi chú cho Sprint 4+

> Những điểm sau đã được kiểm tra và xác nhận là vấn đề thật, nhưng **không nằm trong scope Sprint 3**.

### [Backlog] `CinemaCluster` thiếu `createdBy` / `updatedBy`

- **Vấn đề:** Entity có `createdAt/updatedAt` nhưng thiếu `createdBy/updatedBy` — không biết admin nào tạo/sửa cluster.
- **Mức độ:** Low — minor audit gap, không ảnh hưởng business logic Sprint 3.
- **Kế hoạch:** Sprint 4 hoặc backlog. Fix đơn giản: thêm 2 columns + cập nhật service.

### [Sprint 4+] Không có `Rating` / `Review` flow

- **Vấn đề:** Không có entity `Rating`, `Review`, `MovieRating` — customer không thể đánh giá phim.
- **Mức độ:** Medium feature gap — cần thiết cho UX nhưng không blocking Sprint 3/4 booking flow.
- **Kế hoạch:** Sprint 5+ hoặc sau go-live. Cần thiết kế schema riêng (1 review per user per movie, moderation flow).

### [Sprint 4+] `Promotion` không apply được cho Movie cụ thể

- **Vấn đề:** `promotion-service` tồn tại nhưng gần như chưa implement. Không có cơ chế link promotion với movie cụ thể (chỉ áp dụng theo mã code toàn hệ thống).
- **Mức độ:** Medium — cần thiết cho marketing nhưng phụ thuộc promotion-service hoàn thiện.
- **Kế hoạch:** Sprint 4+ — sau khi promotion-service có CRUD cơ bản.

### [Không cần làm] `ShowTime` conflict detection

- **Verdict:** ❌ Vấn đề không tồn tại — đã implement đầy đủ.
- `ShowTimeRepository` có `existsByCinemaRoomAndOverlappingTime()` (cho create) và `existsByCinemaRoomAndOverlappingTimeExcluding()` (cho update, tự loại trừ chính nó).
- Cả hai được gọi trong `ScheduleController` / `ShowTimeService.createStandalone()` và `update()`.

### [Không cần làm] Seat lock trong booking-service

- **Verdict:** ❌ Vấn đề không tồn tại — đã implement đúng.
- `SeatLockRepository.findByShowtimeIdAndSeatIdInForUpdate()` có `@Lock(LockModeType.PESSIMISTIC_WRITE)`.
- `BookingService` dùng pattern: lock existing rows → `flush()` → insert new → `saveAll()`.
- Unique constraint `(showtime_id, seat_id)` làm lớp bảo vệ thứ hai cho concurrent inserts.
- ⚠️ Gap DUY NHẤT là `ShowtimeSeat.lockSeats()` trong **movie-service** — đã tạo issue #145.
