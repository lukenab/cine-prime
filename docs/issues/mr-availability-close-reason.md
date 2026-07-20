## Overview / Objective

Trong thực tế vận hành rạp chiếu, "huỷ suất chiếu trước khi nó lên sóng" (distributor rút phim, rạp huỷ vì đặt trước ế...) và "đóng vì đã chiếu xong theo kế hoạch" là 2 tình huống khác nhau, quan trọng cho báo cáo doanh thu sau này. Trước MR này, cả 2 đều chỉ ra cùng 1 trạng thái `CLOSED` mà không có cách nào phân biệt lại được, vì lệnh `close` (khác với `suspend`) chưa từng nhận `reason`.

Related: phát hiện khi viết Mục 23 (Movie Availability) của `docs/testing/MOVIE_CREATION_FLOW_TEST_SPEC.md` — trao đổi trực tiếp với user về best practice ngành rạp chiếu.

---

## Changes Introduced

**Controllers / Routes:**
- `MovieAvailabilityController.close()` — nhận thêm `@RequestBody(required = false) CloseRequest`, giữ nguyên tương thích ngược với request không kèm body (POST rỗng vẫn hoạt động, `reason = null`).

**Services / Logic:**
- `MovieAvailabilityService.close(Long id, String reason, String actor)` — đổi chữ ký, truyền `reason` thẳng vào `transitionTo()` để ghi lại trong `movie_availability_history.reason` thay vì luôn `null`.

**DTOs / Mappers / Components:**
- Thêm `CloseRequest` (field `reason`, không có `@NotBlank` — khác `SuspendRequest`, vì đóng không bắt buộc phải giải thích).
- `movieApi.ts`: `closeAvailability(id, reason?)` — tham số optional, chỉ gửi `{ reason }` trong body khi có giá trị.
- `MovieAvailabilityPanel.tsx`: thêm component `ClosePrompt` (giống `SuspendPrompt` nhưng `reason` optional, nút "Close window" luôn bấm được dù để trống) — nút Close giờ mở prompt này thay vì gọi API ngay lập tức.

---

## Key Architectural Decisions

- **Không thêm cột `close_reason` vào bảng `movie_availability`.** Khác với `suspension_reason` (cần hiển thị "sống" trên UI trong lúc đang suspended, và bị xoá khi resume), lý do đóng chỉ cần tồn tại trong lịch sử — `movie_availability_history.reason` đã có sẵn cột này (dùng chung cho mọi transition), không cần migration mới.
- **`reason` optional, không bắt buộc như `suspend`.** Business rule thực tế: suspend luôn cần lý do vận hành (ai đó phải biết vì sao đang tạm dừng bán), nhưng close là hành động chấm dứt — admin có thể chỉ đơn giản đóng khi hết hạn chiếu bình thường, không có gì bất thường cần giải thích.
- **`@RequestBody(required = false)`** thay vì bắt buộc — giữ nguyên hành vi cho mọi caller cũ (kể cả nếu có Postman collection/script nào gọi `close` không kèm body).

---

## How to Test

1. `./mvnw -pl movie-service test -Dtest=MovieAvailabilityServiceTest` — 13/13 pass (gồm test mới `closeAcceptsOptionalReasonAndRecordsIt`).
2. `./mvnw -pl movie-service clean test` — 256/257 pass (1 lỗi có sẵn không liên quan, `MovieImageRepositoryIntegrationTest`, đã xác nhận tồn tại từ trước trên `develop` sạch).
3. `npx tsc --noEmit` (client) — không lỗi.
4. Thủ công: mở `MovieDetailModal` cho 1 movie `APPROVED` có release plan, bấm icon "Close" → xác nhận modal `ClosePrompt` hiện ra với ô lý do **để trống vẫn bấm "Close window" được** → verify `movie_availability.status = CLOSED`, `movie_availability_history` có dòng mới với `reason = NULL` (nếu để trống) hoặc đúng text đã nhập.
5. Test Postman: `POST /api/movie-availabilities/{id}/close` không kèm body → vẫn `200` như cũ (regression check).

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Exception handling không đổi (vẫn `AVAILABILITY_INVALID_TRANSITION` khi đã `CLOSED`)
- [x] Endpoint vẫn tương thích ngược (body optional)

**Frontend**
- [x] Loading/error state không đổi (`runCommand` vẫn xử lý như cũ, chỉ thêm bước xác nhận trước khi gọi)

---

## Reviewer Notes

- Đây là thay đổi nhỏ, tách biệt hoàn toàn khỏi luồng Movie content — chỉ động vào `close` command của Availability, không đụng `open`/`suspend`/`resume`.
- Không có migration DB nào — tận dụng cột `reason` có sẵn trên `movie_availability_history`.
