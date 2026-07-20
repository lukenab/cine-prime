## Overview / Objective

**Bug nghiêm trọng, chặn toàn bộ tính năng xem chi tiết phim**: `GET /api/movies/{id}` và `GET /api/movies/all` trả về lỗi 500 cho MỌI phim, không riêng phim nào. Phát hiện trong lúc verify lại 1 MR khác (backfill company/ảnh phim) — không liên quan đến MR đó, mà là lỗi có sẵn trong codebase từ trước.

Related Issue: Không có issue số cụ thể — phát hiện ngoài dự kiến trong lúc verify tính năng khác, mức độ nghiêm trọng nên tách MR riêng để merge gấp.

---

## Changes Introduced

**Database / Migration:**
- `V16__add_screening_format_missing_columns.sql` — thêm 3 cột `status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` vào bảng `screening_format`. Backfill dòng cũ với `status='ACTIVE'`, `created_at`/`updated_at = now()`.

**Không có thay đổi code Java** — entity `ScreeningFormat.java` đã đúng từ trước, chỉ thiếu migration tương ứng.

---

## Key Architectural Decisions

- **Nguyên nhân gốc:** `ScreeningFormat.java` đã khai báo field `status`, `createdAt`, `updatedAt` từ commit "refactor Movie entity layer to match DB v2 schema" (Hibernate map các field này vào cột `status`/`created_at`/`updated_at`), nhưng chưa từng có migration nào thêm 3 cột này vào bảng thật — `V1__baseline_schema.sql` tạo bảng `screening_format` chỉ với `format_id/format_code/format_name/description/surcharge`. Mọi truy vấn load đầy đủ entity (`Movie.formats`, dùng bởi `GET /api/movies/{id}` và `/all`) đều fail với `column f1_1.created_at does not exist`.
- **Vì sao ảnh hưởng TOÀN BỘ phim chứ không riêng phim nào:** `movie.formats` là quan hệ many-to-many dùng chung 1 bảng `screening_format` cho tất cả phim — bất kỳ phim nào có gán format (hầu như tất cả) đều kích hoạt câu query lỗi này khi load chi tiết.
- **Backfill `created_at`/`updated_at` = `now()`** thay vì để `NULL` — khớp đúng giá trị mà `@PrePersist` của entity đã tự gán cho dòng mới, tránh dữ liệu cũ/mới không nhất quán dù cột này không bắt buộc NOT NULL ở tầng entity.
- **Không thêm ràng buộc NOT NULL cho `created_at`/`updated_at`** — khớp đúng theo khai báo entity (`@Column` không có `nullable = false` cho 2 field này, chỉ `status` là bắt buộc).

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 248 test pass (loại trừ lỗi có sẵn không liên quan).
2. Gọi trực tiếp API sau khi migration chạy:
   ```
   GET /api/movies/all       → 200 (trước MR: 500 cho mọi phim)
   GET /api/movies/{id}      → 200, field `formats[].status/createdAt/updatedAt` có giá trị hợp lệ
   ```
3. Thủ công: mở trang Manage Movies → bấm "View details" bất kỳ phim nào → modal load được bình thường (trước MR: toàn bộ modal fail vì API lỗi).

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Migration idempotent (`ADD COLUMN IF NOT EXISTS`), đã test trên DB dev thực tế (before/after: 500 → 200)
- [x] Không cần error code mới (thuần sửa schema thiếu sót)

---

## Reviewer Notes

- **Ưu tiên merge sớm** — bug này chặn hoàn toàn tính năng xem chi tiết phim ở Manage Movies cho mọi tài khoản admin/employee, không phải edge case.
- Không liên quan đến bất kỳ MR nào khác đang mở cùng lúc (genre/person/company backfill, redesign modal, carousel) — phát hiện tình cờ trong lúc verify 1 MR khác, đã xác nhận lỗi tồn tại độc lập với các thay đổi đó (tái hiện được cả với phim hoàn toàn chưa đụng tới).
