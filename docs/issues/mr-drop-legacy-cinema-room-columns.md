## Overview / Objective

Rà soát bảng `cinema_room` (28 cột) theo yêu cầu tìm cột dữ liệu thừa, phát hiện 4 cột luôn chỉ chứa dữ liệu placeholder giả từ khi flow tạo phòng "quick create" bị xoá và wizard/RoomLayout trở thành con đường tạo phòng duy nhất: `room_type`, `standard_row_count`, `vip_row_count`, `couple_row_count`.

Related: phát hiện và xác nhận trực tiếp với user qua trao đổi trước đó.

---

## Changes Introduced

**Database / Migration:**
- `V17__drop_legacy_cinema_room_columns.sql` — xoá 5 CHECK constraint liên quan (`chk_room_type`, `chk_room_row_allocation_total`, `chk_room_row_allocation_non_negative`, `chk_room_has_single_seat_row`, `chk_couple_rows_even_width`) rồi xoá 4 cột.

**Entity / DTO:**
- `CinemaRoom.java` — xoá field `roomType`, `standardRowCount`, `vipRowCount`, `coupleRowCount`.
- `CinemaRoomResponse.java` — xoá 4 field tương ứng (MapStruct map ngầm theo tên field, không có `@Mapping` tường minh nào cần sửa).
- `enums/RoomType.java` — xoá hẳn (không còn nơi nào tham chiếu sau cleanup).

**Services / Logic:**
- `CinemaRoomService.createWizardRoom()` — bỏ `.roomType(RoomType.STANDARD)` và 3 dòng row-count placeholder trong builder.
- `RoomLayoutService.activate()` — bỏ 3 dòng `setStandardRowCount/setVipRowCount/setCoupleRowCount` placeholder.
- `SeatService.generateSeatsForRoom()` — xoá hẳn (dead code, không có caller nào từ khi flow "quick create" bị xoá — đã grep xác nhận toàn repo).

**Frontend:**
- `movieApi.ts` — xoá type `RoomType`, `ROOM_TYPE_CONFIG`, 4 field khỏi `RoomResponse`/`RoomApiResponse`, dòng map trong `toLegacyRoom()`.
- `ClusterDetailPage.tsx` — xoá cột "Type" trong bảng danh sách phòng (badge này trước giờ luôn hiện "Standard" cho MỌI phòng, kể cả phòng IMAX thật — tức đang hiển thị SAI thông tin, không chỉ dư thừa).
- `RoomDetailPage.tsx` — xoá badge loại phòng ở header (cùng lý do).
- `ShowTimeModal.tsx` — bỏ "· {roomType}" khỏi label dropdown chọn phòng.

**Tests:**
- Xoá `SeatServiceTest.java` (toàn bộ test chỉ test method đã bị xoá).
- Cập nhật `BulkShowTimeConcurrencyIntegrationTest.java`, `CinemaRoomDeletionConcurrencyIntegrationTest.java` — bỏ set field đã xoá trên fixture.
- `FlywayMigrationIntegrationTest.java` — cập nhật `assertEquals(16 → 17)` cho migration mới.

---

## Key Architectural Decisions

- **Xoá CHECK constraint tường minh trước, không dựa vào CASCADE ngầm.** Một số constraint (`chk_room_row_allocation_total`, `chk_couple_rows_even_width`) tham chiếu cả cột bị xoá lẫn cột giữ lại (`number_of_rows`, `seats_per_row`) — DROP COLUMN không tự động xử lý sạch trường hợp này nếu không drop constraint trước.
- **Không đụng `number_of_rows`/`seats_per_row`** — dù cùng nhóm "legacy" trong comment cũ, 2 cột này vẫn được đọc thật (aisle-detection ở `MovieMapper`, `ShowTimeService`, danh sách phòng ở `ClusterDetailPage`) — đã verify bằng grep trước khi quyết định giữ.
- **Không xoá `movie_db.sql` (docker init script) tương ứng** — file này đã lệch pha nghiêm trọng với schema thật từ trước (thiếu hàng chục cột khác như `cluster_id`, `auditorium_class_id`, `room_code`...), sửa riêng 4 cột ở đây sẽ tạo cảm giác sai là file đã chuẩn. Đây là gap tài liệu-code có sẵn, cần 1 việc dọn dẹp riêng lớn hơn, ngoài phạm vi MR này.
- **Chưa áp migration lên DB dev đang chạy** — đã hỏi và được user xác nhận: chỉ dừng ở code + migration file, không tự chạy `ALTER TABLE` lên DB dev dùng chung, tránh phá vỡ tương thích cho ai đó vẫn đang chạy backend từ `develop` (chưa có migration này) trong lúc branch này còn chờ review.

---

## How to Test

1. `./mvnw -pl movie-service clean test` — 259/260 pass (1 lỗi có sẵn không liên quan, `MovieImageRepositoryIntegrationTest`).
2. `FlywayMigrationIntegrationTest` (nằm trong suite trên) tự verify migration V17 chạy sạch trên DB Testcontainers rỗng.
3. `npx tsc --noEmit` (client) — không lỗi ở các file đã sửa.
4. `npx vitest run` (client) — 210/211 pass (1 lỗi có sẵn không liên quan).
5. Sau khi merge và ai đó restart `movie-service` trên `develop`: verify tạo phòng mới qua wizard vẫn hoạt động bình thường (không còn set 4 field đã xoá); verify danh sách phòng ở Cluster Detail không còn cột "Type".

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Migration có comment giải thích rõ lý do xoá từng cột
- [x] Không còn tham chiếu nào tới `RoomType` enum/4 cột đã xoá (grep toàn repo xác nhận)

**Frontend**
- [x] Không còn badge nào hiển thị thông tin sai (roomType luôn "Standard")

---

## Reviewer Notes

- **Chưa chạy migration lên DB dev** — cần chạy khi merge (Flyway tự áp khi service restart trên `develop`, hoặc admin tự chạy tay qua `docker exec`).
- Nếu có nhánh khác đang mở, còn dùng `roomType`/`standardRowCount`/`vipRowCount`/`coupleRowCount` (builder `CinemaRoom.builder()...`), nhánh đó sẽ conflict/lỗi biên dịch khi rebase lên sau MR này — cần soát các nhánh song song trước khi merge.
