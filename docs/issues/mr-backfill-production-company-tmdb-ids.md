## Overview / Objective

Tiếp nối `mr-tmdb-company-id-not-set.md` (đã sửa bug ở code): backfill `tmdb_company_id` cho 77 dòng `production_company` tồn tại từ trước khi có fix đó. Đã tra cứu TMDB `/search/company` theo tên, tạo bảng review cho user duyệt thủ công (tránh khớp nhầm — TMDB có nhiều công ty khác nhau trùng tên chính xác), rồi mới viết migration này theo quyết định của user.

Related Issue: Backfill tmdb_company_id (tiếp nối trực tiếp từ "trong bảng production_company cột tmdb_company_id sao null hết")

---

## Changes Introduced

**Database / JPA / Migration:**
- `V14__backfill_production_company_tmdb_ids.sql`:
  - 74 `UPDATE ... SET tmdb_company_id = X WHERE name = 'Y' AND tmdb_company_id IS NULL` — khớp theo `name` (định danh duy nhất dùng được ở đây, vì `company_id` tự tăng khác nhau giữa môi trường, còn `tmdb_company_id` chính là cột đang sửa).
  - "Pixar Animation Studios" — đổi tên thành "Pixar" (tên chuẩn trên TMDB) + gán `tmdb_company_id = 3`, **không xóa** vì đang được gắn với phim "Inside Out 2" (`movie_production_company` có `ON DELETE RESTRICT` trên `company_id`).
  - "A24" và "Pathé" — xóa hẳn khỏi `production_company`, guard bằng `NOT EXISTS` trên `movie_production_company` (an toàn nếu môi trường khác lỡ đã gắn 1 trong 2 công ty này vào phim nào đó thì sẽ tự bỏ qua thay vì lỗi).

**Controllers / Routes / Services:** Không có — MR này thuần dữ liệu.

---

## Key Architectural Decisions

- **Khớp theo `name`, không theo `company_id`** — giống pattern đã dùng ở các migration dữ liệu trước (genre, person): `company_id` không ổn định giữa môi trường, `name` là thứ duy nhất còn dùng được để định danh dòng cần sửa.
- **Không tự động hóa việc chọn ứng viên TMDB** — với các tên có nhiều kết quả tìm kiếm trùng khớp tuyệt đối (vd "Pathé" có 3 công ty khác nhau, "A24" có 2), không có cách nào chương trình tự chọn đúng mà không có rủi ro gán nhầm identity thật. Đã dừng lại ở bước tạo bảng review cho user quyết định, không đoán.
- **Pixar: đổi tên + gán id thay vì xóa** — vì đang được tham chiếu bởi 1 phim thật (`movie_production_company` không cho xóa company còn bị tham chiếu). Xóa sẽ hoặc lỗi ràng buộc, hoặc phải gỡ khỏi phim trước (mất dữ liệu credit của phim đó) — cả 2 đều tệ hơn việc chỉ đổi tên cho khớp TMDB.
- **A24/Pathé: xóa hẳn thay vì để null vĩnh viễn** — theo quyết định của user; cả 2 đều chưa được phim nào dùng nên xóa an toàn, không gây mất dữ liệu credit nào.

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 248 test pass (loại trừ lỗi có sẵn không liên quan). Không có test Java mới (migration dữ liệu thuần túy, không có logic nghiệp vụ để unit test).
2. Xác nhận dữ liệu dev: `docker exec postgres psql -U postgres -d movie_db -c "SELECT COUNT(*), COUNT(tmdb_company_id) FROM production_company;"` → 75 dòng, cả 75 đều có `tmdb_company_id` (trước MR: 77 dòng, 0 có `tmdb_company_id`).
3. `SELECT company_id, name, tmdb_company_id FROM production_company WHERE company_id = 3;` → `Pixar | 3`.
4. `SELECT * FROM production_company WHERE name IN ('A24','Pathé');` → 0 dòng.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Migration idempotent (guard `tmdb_company_id IS NULL` / `NOT EXISTS`), đã test trên DB dev thực tế (before/after query)
- [x] Đã user xác nhận từng quyết định trước khi ghi (bảng review + câu hỏi rõ ràng cho 3 trường hợp đặc biệt)

---

## Reviewer Notes

- Dữ liệu nguồn cho migration này (tên → tmdb_company_id) đến từ tra cứu TMDB `/search/company` thủ công, không phải tính toán tự động trong migration — nếu môi trường khác có `production_company.name` khác với dev hiện tại (vd đã sửa tay), các dòng `UPDATE` tương ứng sẽ không khớp gì (an toàn, không lỗi).
- File `MovieAvailabilityPanel.tsx` có thể xuất hiện "modified" khi review branch này cục bộ — thay đổi không liên quan, đang dở dang từ trước, không thuộc phạm vi MR này.
