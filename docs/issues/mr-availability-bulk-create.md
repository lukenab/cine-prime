## Overview / Objective

Theo practice thực tế của các chuỗi rạp chiếu, một phim "phát hành rộng" (wide release) được cấp phép khai thác ở **tất cả** rạp cùng lúc bằng 1 quyết định, không phải admin lặp lại thao tác tạo release plan cho từng cụm rạp một. Trước MR này, `CreatePlanDialog` chỉ tạo được đúng 1 `MovieAvailability` mỗi lần submit — admin phải mở dialog N lần cho N cụm rạp.

Related: đề xuất từ trao đổi trực tiếp với user về best practice ngành rạp chiếu cho luồng Availability.

---

## Changes Introduced

**Controllers / Routes:**
- `MovieAvailabilityController` — thêm `POST /api/movie-availabilities/bulk`, cùng role với `create()` hiện có (`ADMIN`/`EMPLOYEE`).

**Services / Logic:**
- `MovieAvailabilityService.bulkCreate()` — best-effort theo từng cụm rạp, **không phải all-or-nothing**: cụm không `ACTIVE`, hoặc đã có sẵn window cho đúng `(movie, cluster, showingStartDate)`, bị skip kèm lý do thay vì làm hỏng cả batch.
- Pre-check cụm đã có window sẵn qua query mới (`findClusterIdsWithExistingWindow`) **thay vì** dựa vào bắt `DataIntegrityViolationException` từng item trong vòng lặp — vì PostgreSQL sẽ "poison" transaction sau lỗi constraint đầu tiên, khiến các insert sau đó trong cùng `@Transactional` cũng fail theo dù được catch.

**DTOs / Mappers / Components:**
- `BulkCreateMovieAvailabilityRequest` (`movieId`, `clusterIds` hoặc `allActiveClusters`, ngày, `salesStartAt`).
- `BulkCreateMovieAvailabilityResponse` (`created[]`, `skipped[]` kèm lý do từng cụm bị skip).
- Frontend `movieApi.bulkCreateAvailability()` + type tương ứng.
- `CreatePlanDialog` (`MovieAvailabilityPanel.tsx`): đổi dropdown 1 cụm → danh sách checkbox nhiều cụm + toggle "Release wide — all active clusters". Luôn gọi endpoint bulk (chọn 1 cụm = bulk call kích thước 1, không cần nhánh riêng).

---

## Key Architectural Decisions

- **Pre-check thay vì catch-per-item.** Đã cân nhắc pattern "mỗi cluster 1 transaction riêng" (qua `TransactionTemplate` hoặc `REQUIRES_NEW`) để cô lập lỗi từng item hoàn toàn, nhưng phức tạp hơn cần thiết cho 1 thao tác admin tần suất thấp. Chọn: pre-check bằng 1 query, loại trừ trước những cụm chắc chắn trùng, insert phần còn lại bằng `saveAll()` 1 lần. Trade-off chấp nhận: nếu có race hiếm gặp (2 admin cùng bulk-create trùng lúc), cả batch fail với lỗi rõ ràng, yêu cầu retry — không silent partial-corrupt.
- **`create()` đơn lẻ vẫn giữ nguyên, không xoá.** Không migrate `create()` thành wrapper gọi `bulkCreate()` với 1 phần tử — 2 endpoint độc lập, tránh risk regression cho endpoint đã có test/production traffic.
- **Kết quả partial success hiển thị rõ ràng, không tự đóng dialog.** Nếu có cụm bị skip, dialog chuyển sang màn hình kết quả (created/skipped kèm lý do) thay vì đóng luôn — tránh admin tưởng nhầm "đã tạo cho tất cả" khi thực ra có cụm bị bỏ qua.

---

## How to Test

1. `./mvnw -pl movie-service test -Dtest=MovieAvailabilityServiceTest` — 17/17 pass (4 test mới cho `bulkCreate`).
2. `./mvnw -pl movie-service clean test` — 260/261 pass (1 lỗi có sẵn không liên quan, `MovieImageRepositoryIntegrationTest`).
3. `npx tsc --noEmit` (client) — không lỗi.
4. Thủ công: mở `MovieDetailModal` cho 1 movie `APPROVED` → tab Availability → "New release plan" → tick "Release wide — all active clusters" → Create → verify tất cả cụm `ACTIVE` đều có `PLANNED` row mới.
5. Thủ công (partial success): bulk-create lần 2 cho cùng ngày → verify màn hình kết quả hiện đúng "Skipped" với lý do "already exists" cho các cụm đã có từ lần trước.
6. Postman: `POST /api/movie-availabilities/bulk` với `clusterIds` chứa 1 cụm `INACTIVE` + 1 cụm hợp lệ → verify `created.length=1`, `skipped[0].reason` chứa "not ACTIVE".

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Không N+1: `findAllById`/`findByStatus` 1 lần, pre-check 1 query, `saveAll()` 1 lần — không loop query trong loop insert
- [x] Exception handling dùng đúng error code có sẵn (`AVAILABILITY_MOVIE_NOT_APPROVED`, `CLUSTER_NOT_FOUND`, `AVAILABILITY_WINDOW_ALREADY_EXISTS`)
- [x] Endpoint mới đã test qua unit test service layer

**Frontend**
- [x] Loading/error state giữ nguyên pattern cũ
- [x] Không đổi hành vi `open`/`suspend`/`resume`/`close` — chỉ đổi phần `create`

---

## Reviewer Notes

- Trọng tâm review: logic pre-check trong `bulkCreate()` (đảm bảo không bỏ sót cụm nào, không double-skip) và phần hiển thị "partial success" ở frontend.
- Không có migration DB nào — tái sử dụng bảng `movie_availability` và constraint unique có sẵn.
