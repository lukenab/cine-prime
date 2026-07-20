## Overview / Objective

**Bug nghiêm trọng**: lưu phim (`PUT /api/movies/{id}`) báo lỗi 500 bất cứ khi nào request đụng tới cả `translations` và `cast` cùng lúc — tức là gần như MỌI lần lưu phim bình thường (phim nào cũng có tiêu đề đa ngôn ngữ + dàn diễn viên). Console log: `Failed to load resource: ... /api/movies/{id} ... 500`.

Related Issue: Phát hiện khi verify lỗi "TMDB import: SCREENING_FORMAT_NOT_SET" + console 500 trên `/api/movies/38` (yêu cầu trực tiếp từ user kèm ảnh chụp lỗi)

---

## Changes Introduced

**Services:**
- `MovieService.reconcileTranslations()` và `.reconcileCast()` — không còn gọi `movie.setTranslations(newList)`/`movie.setCast(newList)` (thay thế toàn bộ collection), mà sửa trực tiếp trên collection hiện có (`clear()` + `addAll()`), qua helper mới `replaceInPlace()`.

**Không có thay đổi schema/DTO/frontend** — bug thuần ở tầng service, cách JPA/Hibernate quản lý collection.

---

## Key Architectural Decisions

- **Nguyên nhân gốc**: `Movie.translations` và `Movie.cast` đều là `@OneToMany(..., orphanRemoval = true)`. Khi 1 collection kiểu này bị THAY THẾ bằng 1 List mới (`movie.setTranslations(result)`) thay vì được sửa tại chỗ trên instance Hibernate đang quản lý, Hibernate mất khả năng theo dõi orphan-removal cho collection đó. Lỗi chỉ lộ ra khi có 1 thao tác KHÁC trong CÙNG transaction ép Hibernate flush (ở đây là `reconcileCast()` tự gọi `movieCastRepository.findByMovie_MovieId(...)`, và JPA tự động flush các thay đổi đang chờ trước khi chạy query) — lúc đó Hibernate phát hiện `translations` (đã bị thay thế trước đó bởi `reconcileTranslations()`) không còn được theo dõi đúng, ném `JpaSystemException`.
- **Vì sao ảnh hưởng gần như mọi lần lưu**: `updateMovie()` luôn gọi `reconcileTranslations()` rồi `reconcileCast()` trong cùng 1 request nếu cả 2 field có trong payload — đúng trường hợp thông thường của mọi lần "Save Draft"/"Submit for Review" từ `MovieEditorPage` (luôn gửi kèm `translations` và `cast`).
- **`replaceInPlace()` fallback về gán tham chiếu khi collection là `null`** — để không phá vỡ các unit test hiện có dùng `Movie` POJO thuần (không qua Hibernate, `getTranslations()`/`getCast()` trả về `null` mặc định) — trường hợp `null` không có gì để orphan nên gán thẳng vẫn an toàn.
- **Không sửa `createMovie()`** — hàm này gọi `saved.setTranslations(...)`/`saved.setCast(...)` ngay sau lần lưu ĐẦU TIÊN của 1 phim hoàn toàn mới, không có bản ghi con nào tồn tại từ trước để bị "orphan" — rủi ro không áp dụng ở đây, giữ nguyên để tránh sửa những chỗ không cần thiết.

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 250 test pass (loại trừ lỗi có sẵn không liên quan).
2. Thủ công (đã test qua Playwright + app thật): mở Edit Movie cho 1 phim đã có cả cast và multilingual titles → sửa 1 field bất kỳ → Save Draft → lưu thành công, không còn lỗi 500 (trước MR: crash với `JpaSystemException: A collection with orphan deletion was no longer referenced...`).

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Đã test thủ công qua app thật (Playwright), tái hiện đúng lỗi gốc trước khi sửa và xác nhận hết lỗi sau khi sửa
- [x] Không đổi hành vi nghiệp vụ (vẫn add/update/xóa translation & cast đúng như trước, chỉ khác cách JPA quản lý collection)

---

## Reviewer Notes

- **Ưu tiên merge sớm** — bug này chặn việc lưu phim ở gần như mọi trường hợp thông thường, không phải edge case.
- Không liên quan tới các MR khác đang mở song song (backfill company/image, carousel, company/person authorization) — bug này tồn tại độc lập trong `MovieService`, chỉ tình cờ được phát hiện khi verify 1 luồng khác.
