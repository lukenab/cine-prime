## Overview / Objective

`POST /api/persons` chặn cứng mọi trùng tên (kể cả khi request có `tmdbId` đủ để xác định đây là cùng 1 người thật) — khiến việc lưu phim thất bại với lỗi "A person with this name already exists" bất cứ khi nào import TMDB gặp 1 diễn viên/đạo diễn mà tên đã tồn tại sẵn trong hệ thống nhưng chưa có `tmdb_id` liên kết.

Related Issue: "A person with this name already exists... trường hợp này thì xử lí như thế nào" (yêu cầu trực tiếp từ user)

---

## Changes Introduced

**Repository:**
- `PersonRepository` — thêm `findByFullNameIgnoreCase(String)` (trả về entity, không chỉ boolean như `existsByFullNameIgnoreCase` cũ).

**Controllers:**
- `PersonController.create()` — khi trùng tên, kiểm tra thêm `tmdbId`:
  - Nếu bản ghi cũ **chưa có** `tmdb_id` (hoặc đã có đúng `tmdb_id` này rồi) → backfill `tmdb_id` (nếu thiếu) và **tái sử dụng** bản ghi cũ thay vì chặn.
  - Nếu bản ghi cũ **đã có** `tmdb_id` khác → vẫn chặn (`PERSON_NAME_ALREADY_EXISTS`) vì đây là trường hợp mơ hồ thật (2 người thật khác nhau trùng tên).
  - Nếu request không có `tmdbId` (tạo tay, không có gì để xác minh) → vẫn chặn như cũ.

**Test:**
- `PersonControllerTest.java` — cập nhật/thêm test cho cả 3 nhánh: trùng tên không có tmdbId (chặn), trùng tên với tmdb_id xung đột (chặn), trùng tên với tmdb_id chưa gắn (backfill + tái sử dụng).

---

## Key Architectural Decisions

- **Cùng pattern đã có sẵn trong chính codebase này** — `TmdbService.enrichCompany()` đã làm y hệt: "if (existing.getTmdbCompanyId() == null && draft.getTmdbId() != null) existing.setTmdbCompanyId(...)". MR này chỉ áp dụng cùng nguyên tắc backfill-khi-khớp cho Person ở đúng chỗ đang chặn (`PersonController.create()`), thay vì phát minh cách xử lý mới.
- **Vì sao an toàn hơn "tự động gộp theo tên"**: nếu chỉ dựa vào tên để merge, sẽ tái diễn đúng lỗi đã dọn ở `V12__merge_duplicate_person_records.sql` (2 người thật khác nhau vô tình trùng tên bị gộp nhầm). Điều kiện `tmdbId` khớp (hoặc bản ghi cũ chưa có `tmdb_id` nào để xung đột) là cách xác minh "đúng là cùng 1 người thật" từ nguồn dữ liệu bên ngoài (TMDB) — không phải suy đoán từ chuỗi tên.
- **Không đổi `update()`** — hàm này không được gọi trong luồng import TMDB (`resolveCastPersonIds()` chỉ gọi `createPerson()`), và đổi tên 1 người có sẵn để trùng với người khác là hành động chủ ý của admin, không nên tự động gộp.

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 252 test pass (loại trừ lỗi có sẵn không liên quan). 3 test case mới cho `create()`: chặn khi không có tmdbId, chặn khi tmdb_id xung đột, backfill+tái sử dụng khi tmdb_id bản ghi cũ đang trống.
2. Thủ công: Add Movie từ TMDB, chọn phim có 1 diễn viên/đạo diễn trùng tên với người đã có sẵn trong "Manage Persons" (nhưng người đó chưa có tmdb_id) → Save → lưu thành công (trước MR: báo lỗi "already exists"), kiểm tra người đó trong Manage Persons giờ đã có tmdb_id.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] No N+1 query issues (1 câu `findByFullNameIgnoreCase` thay cho `existsByFullNameIgnoreCase` cũ, cùng số lượng query)
- [x] Exception handling uses correct error codes (giữ nguyên `PERSON_NAME_ALREADY_EXISTS`, chỉ thu hẹp phạm vi áp dụng)

---

## Reviewer Notes

- Đây là fix nối tiếp trực tiếp của MR gộp person trùng (`fix/merge-duplicate-person-records`) — MR đó đã disclose rõ "20 người còn lại trong batch legacy chưa có tmdb_id vẫn còn nguy cơ bị nhân đôi tiếp"; MR này đóng nốt lỗ hổng đó bằng cách backfill tự động thay vì phải dọn tay từng trường hợp qua migration.
