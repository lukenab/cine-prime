## Overview / Objective

Phát hiện trong `docs/testing/MOVIE_CREATION_FLOW_TEST_SPEC.md` (Gap #1, mức P1): backend có sẵn `POST /api/movies/tmdb/import` (`TmdbService.importMovie`) implement rất đầy đủ — idempotent theo `tmdbId`/`imdbId`, resolve genre chưa map (`selectedGenreMappings`/`createPendingGenres`/`ignoredGenres`), xác nhận runtime khi TMDB thiếu (`confirmedRuntimeMinutes`), ghi đè age rating (`confirmedAgeRatingId`) — nhưng **không có UI nào gọi nó**. `TmdbCatalogPage.tsx`'s "Use this movie" chỉ điều hướng sang Manual Editor kèm prefill qua `router state`; lưu thật luôn đi qua `createMovie()` (route thủ công), có unit test tường minh xác nhận điều này (`TmdbCatalogPage.test.tsx`: `expect(mocks.tmdbImport).not.toHaveBeenCalled()`).

MR này wire luồng lưu thật của Movie Editor sang endpoint import thật, tận dụng UI resolve-genre đã có sẵn trong `MovieEditorPage` ("TMDB Import Review" panel) thay vì xây màn hình mới.

Related: Gap #1 trong `docs/testing/MOVIE_CREATION_FLOW_TEST_SPEC.md`.

---

## Changes Introduced

**Controllers / Routes / Services:**
- Không đổi — `TmdbController`/`TmdbService` đã đầy đủ từ trước, MR này thuần frontend.

**DTOs / Mappers / Components:**
- `client/src/api/movieApi.ts`:
  - Thêm type `TmdbImportPayload` (đầy đủ field của `TmdbImportRequest` backend) và `TmdbImportResult` (đầy đủ field của `TmdbImportResponse`).
  - `tmdbImport()` đổi signature từ `(tmdbId: number)` (chỉ gửi `{tmdbId}`) sang `(payload: TmdbImportPayload)`.
- `client/src/pages/admin/MovieEditorPage.tsx`:
  - Thêm `buildTmdbImportPayload()` — chuyển đổi state `genreResolutions` (đã có sẵn từ trước, dùng cho panel "TMDB Import Review") sang đúng shape `TmdbImportPayload` (`selectedGenreMappings`/`createPendingGenres`/`ignoredGenres`).
  - `persistCurrentDraft()`: khi lưu lần đầu 1 draft **mới** có `form.tmdbId` (nghĩa là bắt nguồn từ TMDB catalog), gọi `movieApi.tmdbImport(...)` thật trước, sau đó `GET` lại movie để lấy đúng danh sách genre đã được import gắn vào (mapped + pending-review mới tạo), merge với `payload.genreIds` hiện có, rồi `updateMovie()` để áp thêm bất kỳ chỉnh sửa thủ công nào admin đã làm trên form sau khi prefill. Movie đã tồn tại (kể cả có `tmdbId` từ lần import trước) vẫn đi qua `updateMovie()` như bình thường.
  - `resolveGenreCreateNew()`: **không còn gọi `POST /api/genres` ngay lập tức** — chỉ ghi nhận quyết định cục bộ (`{action: "created"}`); genre thật sự được tạo (dạng `PENDING_REVIEW`) ở server khi `tmdbImport()` chạy, qua `createPendingGenres`.
  - `resolveGenreMapExisting()`: lưu thêm `localGenreId` vào `genreResolutions` để build `selectedGenreMappings` sau này (trước đây chỉ push thẳng vào `form.genreIds`, không giữ lại mapping).
  - Thêm state `tmdbMissingRuntime` (set trong `applyTmdb()` khi TMDB không trả `durationMinutes`) + badge "TMDB HAD NO RUNTIME — CONFIRM" cạnh label Duration — giá trị form hiện tại được gửi làm `confirmedRuntimeMinutes` khi import.
  - `validateDraft()`: genre check giờ tính cả genre đang chờ tạo (`action: "created"`), tránh chặn oan "Select at least 1 genre" khi genre duy nhất là 1 genre TMDB chưa map vừa được chọn "Create new".

**Database / JPA / Migration:**
- Không có.

**Exception Handling / Error Codes:**
- Không có thay đổi — lỗi từ `/tmdb/import` (`TMDB_MOVIE_ALREADY_EXISTS`, `MISSING_RUNTIME`, `UNRESOLVED_GENRE_MAPPING`...) surface qua cùng cơ chế `errorMessage()`/toast đã có sẵn trong `handleSaveDraft`/`handleSubmitForReview`.

---

## API contract

| Trước MR | Sau MR |
|---|---|
| `POST /api/movies/tmdb/import` tồn tại ở backend, chỉ gọi được qua Postman | Được gọi thật từ `MovieEditorPage` khi lưu lần đầu 1 draft nguồn gốc TMDB |
| `movieApi.tmdbImport(tmdbId: number)` chỉ gửi `{tmdbId}` | `movieApi.tmdbImport(payload: TmdbImportPayload)` gửi đầy đủ `confirmedAgeRatingId`/`confirmedRuntimeMinutes`/`selectedGenreMappings`/`createPendingGenres`/`ignoredGenres` |
| Genre TMDB chưa map, chọn "Create new" → tạo `ACTIVE` ngay qua `POST /api/genres` | Genre được tạo `PENDING_REVIEW` qua `createPendingGenres` của `/tmdb/import`, đúng theo cơ chế review đã thiết kế |

---

## Key Architectural Decisions

- **Không xây màn hình mới, không đổi tương tác "Use this movie" hiện có** — điểm gọi API chỉ chuyển từ lúc bấm "Save Draft" (không phải lúc bấm "Use this movie"), tận dụng toàn bộ UI resolve-genre/warnings/media-picker đã có sẵn và đã được test trong `MovieEditorPage`. Cân nhắc phương án "xây màn hình xác nhận riêng trước khi vào editor" nhưng chọn phương án này vì rẻ hơn nhiều và không phá vỡ khả năng admin chỉnh sửa nội dung trước khi lưu lần đầu.
- **2 lời gọi (`tmdbImport` rồi `updateMovie`) thay vì 1** — `TmdbImportRequest` không nhận field tự do như title/synopsis/translations/cast tuỳ chỉnh (nó luôn dùng nguyên draft TMDB), nên nếu admin đã sửa gì đó trên form sau khi prefill (đổi tên bản dịch, thêm cast, đổi poster...), bắt buộc phải có bước `updateMovie()` tiếp theo để áp đúng những gì admin thực sự muốn lưu, không phải nguyên bản TMDB.
- **Merge genreIds thay vì để `updateMovie()` ghi đè** — `UpdateMovieRequest.genreIds` khi có giá trị sẽ **thay thế toàn bộ** danh sách genre hiện tại (không phải cộng dồn). Vì genre vừa được `/tmdb/import` gắn vào (kể cả genre `PENDING_REVIEW` mới tạo) chưa được biết ở phía client, MR này gọi thêm `GET /api/movies/{id}` ngay sau import để lấy đúng danh sách rồi hợp nhất (`Set` union) với `payload.genreIds` trước khi update — tránh vô tình xoá mất genre vừa import.
- **Sửa luôn bug "Create new genre" tạo thẳng `ACTIVE`** — đây là tác dụng phụ hợp lý của việc wire endpoint thật: trước đây `resolveGenreCreateNew()` gọi `POST /api/genres` ngay khi bấm nút, tạo genre `ACTIVE` tức thì, hoàn toàn bỏ qua cơ chế `PENDING_REVIEW` mà backend cố tình thiết kế cho đúng tình huống này (`TmdbService.createPendingReviewGenre()`, `GENRE_PENDING_REVIEW` gate ở submit). Không tách MR riêng vì fix này chỉ có ý nghĩa khi đi cùng việc wire endpoint thật.
- **`confirmedAgeRatingId` luôn gửi giá trị hiện tại của form (nếu có), không chỉ khi khác với TMDB** — an toàn vì backend chỉ override khi field này có giá trị; admin đổi dropdown Age Rating trước khi save vẫn được tôn trọng đúng ý.

---

## How to Test

1. Frontend: `npx tsc --noEmit` sạch; `npx vitest run --pool=forks` — 202/202 pass (không cần sửa test nào, kể cả `TmdbCatalogPage.test.tsx` — assertion "Use this movie không gọi tmdbImport" vẫn đúng vì API call giờ nằm ở bước Save, không phải bước "Use this movie").
2. Backend: không có thay đổi, không cần chạy lại riêng cho MR này (đã chạy đầy đủ ở MR `fix/movie-rejection-note-visibility` mà branch này build trên).
3. Thủ công (cần TMDB API key hợp lệ):
   - Vào Import from catalog → chọn 1 phim có genre TMDB chưa map trong hệ thống → "Use this movie".
   - Ở Movie Editor, thấy panel "TMDB Import Review" với genre chưa map — thử cả 3 lựa chọn (map existing / create new / ignore + reason).
   - Bấm "Save Draft" → mở Network tab xác nhận có gọi `POST /api/movies/tmdb/import` (không phải `POST /api/movies` với body thường), theo sau bởi `PUT /api/movies/{id}`.
   - Với genre chọn "Create new": vào Manage Genres (ADMIN), xác nhận genre mới ở trạng thái `PENDING_REVIEW`, không phải `ACTIVE` ngay lập tức.
   - Thử 1 phim TMDB không có runtime (nếu tìm được) → xác nhận badge "TMDB HAD NO RUNTIME" hiện cạnh Duration, và Save vẫn thành công (không bị `MISSING_RUNTIME`).
4. Thủ công: sửa 1 movie **đã tồn tại** (kể cả có `tmdbId` từ trước) → xác nhận vẫn chỉ gọi `PUT`, không gọi lại `/tmdb/import`.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (`tsc --noEmit`)

**Backend**
- Không áp dụng — không có thay đổi backend.

**Frontend**
- [x] `tsc --noEmit` sạch
- [x] `npx vitest run --pool=forks` — 202/202 pass
- [ ] Chưa test thủ công đầy đủ trên môi trường thật với TMDB API key trong phiên này (cần TMDB API key hợp lệ + Docker services chạy, ngoài khả năng của phiên làm việc này)
- [ ] Chưa test thủ công trên cả dark mode và light mode

---

## Reviewer Notes

- **Branch này build trên `fix/movie-rejection-note-visibility`** (chứa rename `MovieV2→MovieResponse`, `createMovieV2/updateMovieV2→createMovie/updateMovie` đang dở dang từ trước, cộng thêm field `rejectionNote`) — nên merge branch đó trước.
- **Rủi ro chính cần review kỹ:** logic merge `genreIds` trong `persistCurrentDraft()` (đoạn gọi `getMovieById` rồi hợp nhất trước khi `updateMovie`) — đây là phần tinh tế nhất của MR, nếu sai sẽ âm thầm làm mất genre vừa import.
- **Chưa test thủ công với TMDB API key thật** trong phiên làm việc này (môi trường không có sẵn) — cần QA xác nhận trước khi merge, đặc biệt case "Create new" genre thật sự ra `PENDING_REVIEW`.
- Test spec `docs/testing/MOVIE_CREATION_FLOW_TEST_SPEC.md` đã được cập nhật đánh dấu Gap #1 là đã fix, nhưng **Mục 7 (Flow B) và Mục 9/12 (API/Postman catalogue liên quan TMDB) chưa được viết lại đầy đủ theo hành vi mới** — ghi rõ trong tài liệu là việc cần làm tiếp theo, không thuộc phạm vi MR nhỏ này.
