## Overview / Objective

Kiểm tra bảng `movie` phát hiện 10 cột tồn tại trong DB nhưng không được `Movie.java` entity map, không được đọc/ghi ở bất kỳ đâu trong `movie-service`, và luôn `NULL` trên toàn bộ dữ liệu thật hiện có:

| Cột chết | Loại | Đã được thay thế bởi |
|---|---|---|
| `actor` | varchar(255) | bảng `movie_cast` (role-based, chuẩn hoá) |
| `director` | varchar(255) | bảng `movie_cast` |
| `content` | varchar(255) | `movie.synopsis` (TEXT) |
| `movie_name_vn` | varchar(255) | bảng `movie_translation` |
| `movie_name_english` | varchar(255) | bảng `movie_translation` |
| `movie_production_company` | varchar(255) | bảng junction `movie_production_company` (ManyToMany qua `ProductionCompany`) |
| `large_image` | varchar(255) | `movie.poster_url` |
| `small_image` | varchar(255) | `movie.thumbnail_url` |
| `create_at` | timestamp(6) | `movie.created_at` (lỗi chính tả cũ) |
| `duration` | bigint | `movie.duration_minutes` (smallint, có CHECK 1–600) |

`postgres-init/movie_db.sql` (dòng ~152–161) ghi rõ đây là kết quả của "v1→v2 redesign" đã thay thế các cột này, nhưng cột cũ chưa từng được `DROP` khỏi DB thật — `V1__baseline_schema.sql` (migration Flyway đầu tiên) không hề tạo lại các cột này, nên chúng chỉ còn sót lại từ trạng thái DB trước khi chuẩn hoá.

MR này dọn dứt điểm: xoá cả 10 cột khỏi schema thật.

Related: phát hiện trong lúc audit theo yêu cầu "kiểm tra bảng movie còn trường nào không dùng"; độc lập với `fix/drop-movie-end-date-column` (đang chờ review riêng).

---

## Changes Introduced

**Controllers / Routes / Services / DTOs / Mappers / Components:**
- Không đổi — không có field Java nào map tới các cột này để mà xoá, nên không có thay đổi ở tầng entity/DTO/mapper/frontend.

**Database / JPA / Migration:**
- **`V8__drop_legacy_movie_columns.sql`** — 10 câu `ALTER TABLE movie DROP COLUMN IF EXISTS <col>;`, idempotent.

**Exception Handling / Error Codes:**
- Không có thay đổi.

---

## API contract

Không có thay đổi contract. Các cột này chưa bao giờ được serialize ra JSON response (`MovieResponse`/`MovieV2` không có field nào tên trùng), nên không client nào — kể cả frontend legacy `MovieApiResponse`/`toLegacyMovie()` — thực sự đọc trực tiếp các cột DB này. Field cùng tên bên frontend (`movieNameVn`, `director`, `actor`, `movieProductionCompany`, `largeImage`, `smallImage`...) đều được `toLegacyMovie()` tính toán từ model chuẩn hoá (`translations`, `cast`, `companies`, `posterUrl`...), không phải đọc thẳng từ các cột chết này.

---

## Key Architectural Decisions

- **Không đụng tới bất kỳ code Java/TypeScript nào** — vì không có field nào map tới các cột này, phạm vi thay đổi chỉ gói gọn trong 1 file migration.
- **Idempotent `DROP COLUMN IF EXISTS`** — theo đúng convention migration hiện có trong repo (`V8__drop_movie_end_date.sql` ở branch khác cũng theo mẫu này), an toàn khi chạy lại hoặc trên DB đã dọn sẵn.
- **Đã xác minh kỹ trước khi xoá**, không chỉ dựa vào tên cột giống thư mục cũ:
  - Đọc toàn bộ `Movie.java` — xác nhận không field nào map các cột này.
  - Grep toàn bộ `movie-service` (kể cả `@Query(nativeQuery = true)` — không có native query nào trong service) — không nơi nào tham chiếu tên cột.
  - Grep test suite — các chỗ khớp `actor`/`director` đều là biến/role-type cho `movie_cast` (ví dụ `roleType("DIRECTOR")`), không liên quan cột cũ.
  - Query trực tiếp dữ liệu thật (`SELECT actor, director, ... FROM movie`) — toàn bộ đều `NULL`.
- **Cập nhật `FlywayMigrationIntegrationTest`** — assert số migration chạy trên DB rỗng từ `8` lên `9` (thêm `V8`).

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -q` — 245 test chạy, 0 failure liên quan tới thay đổi này. Có 1 lỗi tiền tồn tại không liên quan (`MovieImageRepositoryIntegrationTest.save_NativeQuery_LegacyMixedCase_UppercaseEnum`, lỗi check-constraint trên `movie_image.image_type`, xảy ra giống hệt trên `develop` gốc).
2. Thủ công: chạy migration trên DB dev/local → `\d movie` trong `psql` xác nhận không còn 10 cột này, toàn bộ chức năng CRUD/TMDB import/Movie Editor vẫn hoạt động bình thường (vì code chưa bao giờ đụng tới các cột này).

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (Maven `test-compile`)

**Backend**
- [x] Migration `V8` idempotent (`DROP COLUMN IF EXISTS`)
- [x] Test suite cập nhật (`FlywayMigrationIntegrationTest`)
- [x] Đã xác minh không có code nào (kể cả native query) tham chiếu các cột bị xoá

**Frontend**
- Không áp dụng — MR này không chạm frontend.

---

## Reviewer Notes

- **Trùng số version `V8` với branch `fix/drop-movie-end-date-column`** (đang chờ review riêng, cũng thêm `V8__drop_movie_end_date.sql`). Khi merge cả 2 MR vào `develop`, MR merge sau cần đổi tên file migration của mình thành `V9` để tránh trùng version — nhắc reviewer lưu ý thứ tự merge.
- **Phát hiện thêm (ngoài phạm vi MR này, không xử lý):** frontend có 2 type `CreateMoviePayload`/`UpdateMoviePayload` trong `movieApi.ts` (chứa các field tên giống cột cũ: `movieNameVn`, `director`, `actor`, `duration`, `content`...) nhưng không được import/dùng ở bất kỳ component nào — có vẻ là dead code còn sót lại từ trước khi `MovieEditorPage` chuyển sang dùng `CreateMovieRequest`/`UpdateMovieRequest`. Có thể dọn ở 1 MR nhỏ riêng nếu team muốn.
- Không cần rollback plan phức tạp — nếu cần khôi phục cột (không nên, vì luôn `NULL`), chỉ cần thêm lại bằng 1 migration `ALTER TABLE ADD COLUMN`.
