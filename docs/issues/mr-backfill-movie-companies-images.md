## Overview / Objective

Chuẩn hóa dữ liệu bảng `movie`: 10 phim có `tmdb_id` thật nhưng chỉ được gắn đúng 1 production company và 0-1 ảnh, trong khi TMDB có sẵn nhiều company và cả bộ poster/backdrop/stills cho từng phim. Trong lúc tra dữ liệu, phát hiện thêm `tmdb_id` của "Bố Già" bị sai (gắn nhầm sang phim khác), đã sửa luôn.

Related Issue: "chuẩn hóa dữ liệu của bảng movie... không lấy được nhiều company và chỉ lấy được 1 hình" (yêu cầu trực tiếp từ user)

---

## Changes Introduced

**Database / Migration:**
- `V15__backfill_movie_companies_and_images.sql`:
  - Sửa `tmdb_id` của "Bố Già" (24137 → 787459) — xem "Key Architectural Decisions" để biết vì sao đây là lỗi thật.
  - Thêm 6 production company mới TMDB có nhưng DB chưa có (Scott Free Productions, Brandywine Productions, TSG Entertainment, Seven Bucks Productions, Flynn Picture Company, 5000 Broadway Productions).
  - Gắn đầy đủ company cho 10 phim theo đúng dữ liệu TMDB (khớp theo `movie.tmdb_id` ↔ `production_company.tmdb_company_id`).
  - Thêm poster + backdrop + tối đa 5 still cho mỗi phim (tổng ~60 dòng `movie_image` mới).

**Không có thay đổi code (controller/service/frontend)** — MR này thuần dữ liệu.

---

## Key Architectural Decisions

- **Nguyên nhân gốc:** các phim này được tạo qua luồng "Browse TMDB → Save" thông thường của `MovieEditorPage` (không phải lệnh `POST /tmdb/import` đầy đủ), nơi company/ảnh phải được admin chọn thủ công thay vì tự động lấy hết — với ảnh, đây là bước riêng (`POST /images/tmdb-import`) admin phải chủ động làm, dễ bị bỏ qua khi tạo dữ liệu dev.
- **Phát hiện phụ ngoài dự kiến — `tmdb_id` sai của "Bố Già":** trong lúc tra TMDB theo `tmdb_id = 24137` đang lưu, phát hiện ID này thực ra là phim "An Ideal Husband" (1999), không liên quan. Xác minh: company đang gắn sẵn cho "Bố Già" (HK Film) lại khớp đúng với phim Việt Nam thật (`tmdb_id = 787459`) — chứng tỏ lúc tạo dữ liệu, company được chọn tay đúng, chỉ riêng field `tmdb_id` bị gán nhầm. Sửa bằng cách khớp theo `original_title = 'Bố Già' AND tmdb_id = 24137` (an toàn, tự động thành no-op sau khi đã sửa 1 lần).
- **Khớp theo `movie.tmdb_id` / `production_company.tmdb_company_id`**, không theo `movie_id`/`company_id` (auto-increment, khác nhau giữa môi trường) — cùng nguyên tắc đã dùng ở các migration dữ liệu trước trong repo này.
- **"Stills" = backdrop TMDB ngoài cái đầu tiên** — TMDB không có endpoint "stills" riêng cho phim, đúng theo convention đã ghi chú sẵn trong `MovieImageService`/`application.yml` (`max-stills`).
- **Idempotent 2 lớp:** company insert dùng `ON CONFLICT (tmdb_company_id) WHERE tmdb_company_id IS NOT NULL` (khớp đúng unique index partial hiện có), ảnh dùng `ON CONFLICT (movie_id, source, external_path) WHERE source IS NOT NULL AND external_path IS NOT NULL` — cả 2 đều là index, không phải constraint đặt tên, nên phải dùng cú pháp suy luận theo cột + WHERE khớp chính xác index gốc, không dùng được `ON CONFLICT ON CONSTRAINT`.
- **Không sửa qua API (`PUT /api/movies/{id}`)** — hầu hết 10 phim này đang ở trạng thái APPROVED/PENDING_REVIEW, mà `MovieService.updateMovie()` chỉ cho sửa khi `status = DRAFT` (đúng luật vòng đời nội dung). Vì đây là bổ sung dữ liệu tham chiếu/media, không phải sửa nội dung cần duyệt lại, nên ghi thẳng qua migration SQL — giống cách các migration dữ liệu trước trong repo này đã xử lý (genre, person, production_company).

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 248 test pass (loại trừ lỗi có sẵn không liên quan).
2. Xác nhận dữ liệu dev:
   ```sql
   SELECT m.movie_id, m.original_title, m.tmdb_id, COUNT(DISTINCT mpc.company_id) c, COUNT(DISTINCT mi.image_id) i
   FROM movie m
   LEFT JOIN movie_production_company mpc ON mpc.movie_id = m.movie_id
   LEFT JOIN movie_image mi ON mi.movie_id = m.movie_id
   WHERE m.movie_id IN (21,24,25,26,27,28,29,32,33,34)
   GROUP BY 1,2,3 ORDER BY 1;
   ```
   → cả 10 phim đều có ≥1 company (기생충 đúng chỉ có 1 company thật trên TMDB) và 4-8 ảnh (trước MR: 1 company, 0-1 ảnh).
3. Mở modal "View details" cho "Alien: Romulus" hoặc "Spider-Man: No Way Home" trên Manage Movies → tab Overview hiện đủ nhiều company ở mục Production, tab Media có 7 ảnh để lướt qua.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Migration idempotent, đã test trên DB dev thực tế (before/after query)
- [x] Không cần error code mới (thao tác dọn/bổ sung dữ liệu thuần túy)

---

## Reviewer Notes

- **Việc sửa `tmdb_id` của "Bố Già" không nằm trong yêu cầu gốc** (yêu cầu chỉ nói về company/ảnh) — phát hiện ngoài dự kiến trong lúc tra cứu, đã disclose rõ ở đây để reviewer biết đây là 1 thay đổi có chủ đích, không phải nhầm lẫn.
- Dữ liệu company/ảnh trong migration này lấy từ 1 lần gọi TMDB API thủ công (không phải tính toán trong migration) — nếu môi trường khác có `movie.tmdb_id` khác cho các phim cùng tên, các dòng UPDATE/INSERT tương ứng sẽ không khớp gì (an toàn, không lỗi, chỉ đơn giản không backfill được).
