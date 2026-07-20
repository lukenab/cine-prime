## Overview / Objective

Kiểm tra database `person` (đạo diễn/diễn viên/quay phim...) theo yêu cầu, phát hiện 5 người thật đang bị tách thành 2 dòng `person_id` riêng biệt (credit bị phân mảnh), gốc rễ từ 1 batch 25 dòng hand-seed cũ không có `tmdb_id`, và phát hiện thêm việc `POST/PUT/DELETE /api/persons` hoàn toàn không có bảo vệ chống trùng tên hay xóa nhầm người còn được tham chiếu. MR này gộp dữ liệu đã bị phân mảnh và vá 2 lỗ hổng khiến việc này có thể tái diễn.

Related Issue: Dọn dữ liệu person (yêu cầu trực tiếp từ user: "kiểm tra xem database hiện tại có bị quá nhiều dòng rác đối với việc quản lí person không")

---

## Changes Introduced

**Controllers / Routes:**
- `PersonController.create()` — kiểm tra `existsByFullNameIgnoreCase()` trước khi lưu, 409 `PERSON_NAME_ALREADY_EXISTS` nếu trùng.
- `PersonController.update()` — kiểm tra `existsByFullNameIgnoreCaseAndPersonIdNot()` (loại trừ chính nó) trước khi đổi tên, cùng lỗi 409 nếu đổi tên trùng với người khác.
- `PersonController.delete()` — kiểm tra `movieCastRepository.existsByPerson_PersonId()` trước khi xóa, 409 `PERSON_STILL_REFERENCED` nếu người này còn credit ở phim nào đó (trước đây sẽ ném `DataIntegrityViolationException` thô từ constraint `ON DELETE RESTRICT` của `movie_cast.person_id`).

**Services / Logic:**
- Không có service layer riêng cho Person (theo Technical Notes gốc của issue #153), toàn bộ logic ở controller.

**DTOs / Mappers / Components:**
- Không có DTO mới.

**Database / JPA / Migration:**
- `PersonRepository` — thêm `existsByFullNameIgnoreCaseAndPersonIdNot(String, Long)`.
- `MovieCastRepository` — thêm `existsByPerson_PersonId(Long)`.
- `V12__merge_duplicate_person_records.sql` — gộp 5 cặp person trùng (Christopher Nolan, Zendaya, Anne Hathaway, Cillian Murphy, Robert Pattinson): repoint `movie_cast.person_id` từ dòng legacy (`tmdb_id IS NULL`) sang dòng đã xác thực TMDB (khớp theo `tmdb_id` — định danh ổn định duy nhất, không dùng `person_id` vì khác nhau giữa môi trường), rồi xóa dòng legacy dư thừa.

**Exception Handling / Error Codes:**
- Thêm `PERSON_NAME_ALREADY_EXISTS(2092, ..., HttpStatus.CONFLICT)`.
- Thêm `PERSON_STILL_REFERENCED(2093, ..., HttpStatus.CONFLICT)`.

---

## Key Architectural Decisions

- **Khớp theo `tmdb_id`, không theo `person_id` hay tên** — cùng nguyên tắc đã dùng ở migration chuẩn hóa genre: `tmdb_id` là định danh thật, ổn định của TMDB, còn `person_id` là auto-increment có thể khác nhau giữa các môi trường (dev/staging/prod).
- **Chỉ liệt kê đích danh 5 cặp đã xác minh** (không viết migration tổng quát "match theo tên giống nhau + 1 bên NULL tmdb_id") — vì khớp theo tên tự động có rủi ro gộp nhầm 2 người thật trùng tên ngẫu nhiên. Migration này an toàn re-run (idempotent: sau khi dòng legacy bị xóa, subquery không còn khớp dòng nào, mọi câu lệnh sau đó là no-op).
- **Chặn trùng tên tuyệt đối ở `POST/PUT /api/persons`** (không cho phép tạo/đổi tên trùng, không có luồng "vẫn tạo nếu admin xác nhận") — theo đúng pattern `GenreService.create()` đã áp dụng cho genre (`existsByGenreName` → chặn thẳng). Đánh đổi đã biết: 2 người thật trùng tên thật (hiếm nhưng có thể xảy ra, vd 2 diễn viên khác nhau cùng tên) sẽ bị chặn tạo — chấp nhận đánh đổi này vì lựa chọn ngược lại (cho phép trùng) chính là nguyên nhân gây ra 5 cặp dữ liệu vừa phải dọn.
- **Không sửa `TmdbService.upsertPerson()`** — hàm này vẫn dedupe đúng theo `tmdb_id` như cũ; sau MR này, nếu TMDB import gặp 1 tên đã tồn tại local nhưng chưa có `tmdb_id` (chính kịch bản gây ra bug), `createPerson()` phía `MovieEditorPage` (gọi khi `resolveCastPersonIds()` gặp `personId == null`, chỉ xảy ra ở luồng TMDB Import Review khi `localPersonId` là null) giờ sẽ bị chặn bởi `PERSON_NAME_ALREADY_EXISTS` thay vì âm thầm tạo dòng trùng — admin sẽ thấy lỗi rõ ràng và cần vào "Manage Persons"/search thủ công để xử lý, thay vì hệ thống tự tạo rác.
- **193 person không được `movie_cast` nào tham chiếu (55% tổng số) không được dọn trong MR này** — đây là hệ quả bình thường của việc xóa phim (`movie_cast.movie_id` có `ON DELETE CASCADE`, `person` được giữ lại vì là dữ liệu dùng chung), không phải lỗi dữ liệu, không có rủi ro tích hợp. Nếu cần dọn định kỳ, đây sẽ là 1 task riêng (job/script xóa person không tham chiếu quá X ngày), cố tình để ngoài phạm vi MR này.

---

## How to Test

1. `./mvnw.cmd -pl movie-service clean test` — 248 test pass, chỉ còn lỗi có sẵn không liên quan `MovieImageRepositoryIntegrationTest.save_NativeQuery_LegacyMixedCase_UppercaseEnum`. Test mới: `PersonControllerTest` (create trùng tên, update trùng tên, delete còn tham chiếu, delete không tham chiếu, delete not-found).
2. Xác nhận dữ liệu dev đã gộp: `docker exec postgres psql -U postgres -d movie_db -c "SELECT LOWER(TRIM(full_name)), COUNT(*) FROM person GROUP BY 1 HAVING COUNT(*) > 1;"` → 0 dòng (trước MR: 5 dòng). Person count 348 → 343.
3. Thủ công: gọi `POST /api/persons` với `fullName` trùng 1 người đã có → 409 `PERSON_NAME_ALREADY_EXISTS`.
4. Thủ công: gọi `DELETE /api/persons/{id}` với 1 người đang có credit ở phim nào đó → 409 `PERSON_STILL_REFERENCED` (thay vì lỗi 500 thô như trước).

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] No N+1 query issues (2 câu `exists` đơn giản, migration là raw SQL)
- [x] Exception handling uses correct error codes
- [x] Migration idempotent, đã test trên DB dev thực tế (before/after query)

---

## Reviewer Notes

- **Trùng số version migration:** file này đặt tên `V12` (không phải `V11`) vì `V11` đã được dùng bởi branch `fix/standardize-genre-names-english` (chưa merge tại thời điểm viết MR này). Nếu branch đó merge trước, không cần đổi gì thêm. Nếu MR này merge trước, reviewer của branch kia sẽ cần đổi tên file V11 của họ nếu có xung đột thứ tự — đã chủ động tránh bằng cách nhảy số thay vì đè lên.
- **193 person "orphan" (không tham chiếu) vẫn còn nguyên** — xem Key Architectural Decisions, đây là quyết định có chủ đích, không phải thiếu sót.
- `existsByFullNameIgnoreCase` trước đây đã tồn tại trong `PersonRepository` nhưng chưa từng được gọi ở đâu — MR này là lần đầu tiên nó thực sự được dùng.
