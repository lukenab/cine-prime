## Overview / Objective

MR trước (`fix/remove-movie-editor-end-date`, xem `docs/issues/mr-remove-movie-editor-end-date.md`) đã gỡ `endDate` khỏi Movie Editor UI/payload nhưng **cố ý giữ nguyên cột `movie.end_date`** ở DB, đúng Technical Notes của issue frontend gốc (việc xoá cột được ghi nhận là thuộc `#173`).

MR này hoàn tất phần còn lại: xoá hẳn cột `end_date` khỏi bảng `movie`, và dọn toàn bộ phần backend + frontend còn đọc/ghi field này (mà MR trước không chạm tới vì lúc đó cột DB còn tồn tại) — bao gồm `MovieReadinessValidator`'s date-range gate (vốn build trên `releaseDate`/`endDate`) và một ô "End Date" bị bỏ sót trong form chính của `MovieEditorPage.tsx` (khác với `MovieEditorWorkflow.tsx`/`buildMoviePayload.ts` mà MR trước đã xử lý).

Related Issue: Follow-up của `[Frontend] Remove exhibition end date from Movie Editor` (`#173`)

---

## Changes Introduced

**Controllers / Routes:**
- Không đổi.

**Services / Logic:**
- `MovieReadinessValidator.java` — xoá hẳn `requireValidDateRange(releaseDate, endDate)` (không còn được gọi ở đâu vì premise của nó — "inverted release/end date range" — không còn tồn tại). Xoá 2 chỗ đọc `movie.getEndDate()` còn sót trong `collectReviewViolations()` và `collectReleaseOnlyViolations()` (hàm sau là dead code — `requireReadyForRelease()` không được `MovieService` gọi ở đâu cả — nhưng vẫn sửa để code compile được, không mở rộng phạm vi xoá luôn phần release-gate cũ).
- `MovieService.java` — xoá 2 lời gọi `movieReadinessValidator.requireValidDateRange(...)` trong `createMovie()` và `updateMovie()`.

**DTOs / Mappers / Components:**
- `Movie.java`, `CreateMovieRequest.java`, `UpdateMovieRequest.java`, `MovieResponse.java` — xoá field `endDate`/`end_date`. MapStruct mapping tự động theo tên field, không cần sửa `MovieMapper.java`.
- `MovieErrorCode.java` — xoá `INVALID_MOVIE_DATE_RANGE` (không còn nơi nào throw nữa).
- `client/src/api/movieApi.ts` — xoá `endDate` khỏi `MovieApiResponse`, `MovieV2`, `CreateMovieRequest` (frontend type) và khỏi hàm map `movie.endDate` sang response object.
- `client/src/layouts/MovieTable.tsx` — xoá block hiển thị read-only "ends {date}" (chỉ đọc, không có UI nhập liệu, nên MR trước để nguyên vì ngoài phạm vi — nay xoá luôn vì field nguồn không còn tồn tại).
- `client/src/pages/admin/MovieEditorPage.tsx` — xoá ô input "End Date" còn sót trong form chính (label, state field, `emptyForm`, `movieToForm()`, payload builder) — MR trước chỉ tách/dọn `buildMoviePayload.ts` dùng bởi `MovieEditorWorkflow.tsx`, không phải form chính này, nên field vẫn còn hiển thị (không hoạt động thật vì payload gửi lên đã bị backend bỏ qua) cho tới MR này.

**Database / JPA / Migration:**
- **`V8__drop_movie_end_date.sql`** — `ALTER TABLE movie DROP COLUMN IF EXISTS end_date;`

**Exception Handling / Error Codes:**
- Xoá `INVALID_MOVIE_DATE_RANGE` (2036).

---

## API contract

| Trước MR | Sau MR |
|---|---|
| `CreateMovieRequest`/`UpdateMovieRequest`/`MovieResponse` có field `endDate` (đã không còn hiển thị ở UI từ MR trước, nhưng vẫn tồn tại trong contract và DB) | Field `endDate` biến mất hoàn toàn khỏi contract; gửi thêm key này trong request body sẽ bị bỏ qua (Jackson mặc định không fail trên unknown property) |
| `POST/PUT /api/movies` có thể trả lỗi `INVALID_MOVIE_DATE_RANGE` (2036) nếu `releaseDate` sau `endDate` | Lỗi này không còn tồn tại — không còn khái niệm "inverted range" để kiểm tra |

---

## Key Architectural Decisions

- **Branch riêng, tách khỏi MR Movie Editor trước đó.** MR trước đã merge/pushed như một thay đổi frontend-only, độc lập và tự đầy đủ. Việc xoá cột DB là một quyết định vận hành riêng biệt (không thể revert dễ dàng), nên được tách thành branch/MR của chính nó thay vì gộp chung hoặc amend lại MR đã pushed.
- **Xoá toàn bộ chuỗi phụ thuộc, không chỉ cột DB.** Không thể chỉ chạy migration `DROP COLUMN` trong khi Java entity vẫn map `@Column(name = "end_date")` — sẽ vỡ ngay khi Hibernate query. Nên MR này đi từ trong ra ngoài: entity → DTOs → validator → error code → tests, rồi mới tới migration.
- **`collectReleaseOnlyViolations()` (dead code) vẫn được sửa, không xoá luôn.** Đã xác nhận qua grep rằng `requireReadyForRelease()` không được gọi từ `MovieService` (tàn dư từ lifecycle cũ có `COMING_SOON`/`NOW_SHOWING`) — nhưng xoá cả cụm release-gate là một cleanup lớn hơn, không thuộc phạm vi issue này, nên chỉ sửa đủ để compile.
- **Cập nhật `docs/MOVIE_SERVICE_BUSINESS_RULES.md` với `MOV-P1-009` mới** (branch này không có rule `MOV-P1-009` cũ từ MR trước, vì được tạo từ `develop` trước khi MR đó merge) — ghi rõ `Movie.endDate` không còn tồn tại và exhibition window nằm ở `MovieAvailability.showingEndDate`. Khi 2 branch merge vào `develop`, có thể cần đối chiếu lại nếu cả hai đều thêm rule cùng ID.
- **Sửa `FlywayMigrationIntegrationTest`** — test này assert cứng số lượng migration chạy trên DB rỗng (`8` → `9` sau khi thêm `V8`).

---

## How to Test

1. Backend: `./mvnw.cmd -pl movie-service test-compile -q` rồi `./mvnw.cmd -pl movie-service test -q`. Kết quả: 239 test chạy, 0 failure liên quan tới thay đổi này. Có 1 lỗi tiền tồn tại không liên quan (`MovieImageRepositoryIntegrationTest.save_NativeQuery_LegacyMixedCase_UppercaseEnum`, lỗi check-constraint trên `movie_image.image_type`) — đã xác nhận lỗi này xảy ra giống hệt trên `develop` gốc (chưa có thay đổi nào của MR này), qua `git stash` rồi chạy lại test đơn lẻ.
2. Frontend: `npx tsc --noEmit` (không có lỗi mới liên quan tới `movieApi.ts`/`MovieTable.tsx`/`MovieEditorPage.tsx`) và `npx vitest run --pool=forks` (dùng `--pool=forks` vì pool `threads` mặc định lỗi môi trường Windows không liên quan). Kết quả: 198/198 pass.
3. Thủ công: chạy migration trên DB dev/local → xác nhận `\d movie` trong `psql` không còn cột `end_date`.
4. Thủ công: mở Add/Edit Movie → xác nhận không còn field "End Date" ở đâu (kể cả trong form chính lẫn sticky action bar) → xác nhận Movie Table không còn hiển thị "ends {date}".

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (Maven `test-compile` + `tsc --noEmit`)

**Backend**
- [x] Migration `V8` idempotent (`DROP COLUMN IF EXISTS`)
- [x] Test suite cập nhật, không còn tham chiếu `endDate`/`requireValidDateRange`
- [x] Đã xác minh lỗi test còn lại là tiền tồn tại, không do MR này gây ra

**Frontend**
- [x] `tsc --noEmit` sạch (không lỗi mới)
- [x] `npx vitest run --pool=forks` — 198/198 pass
- [ ] Chưa test thủ công migration + UI trên môi trường thật trong phiên này

---

## Reviewer Notes

- **Đây là follow-up của một MR đã pushed trước đó**, không phải amend — cả 2 MR có thể merge độc lập, nhưng MR này nên merge sau (hoặc sau khi review xác nhận) MR Movie Editor kia, để tránh 2 MR cùng sửa `docs/MOVIE_SERVICE_BUSINESS_RULES.md` gây conflict khó đọc.
- **`MovieEditorWorkflow.tsx` có 1 thay đổi nhỏ khác đang dở dang trong working tree (không thuộc MR này)** — đã kiểm tra kỹ và KHÔNG đưa vào commit, tránh lẫn với công việc song song khác (sticky actions).
- File migration đặt tên `V8` — nếu có migration khác đã được thêm song song trên branch khác chưa merge, cần đổi số version trước khi merge để tránh trùng.
