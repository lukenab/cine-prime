## Overview / Objective

Hoàn thiện issue `[Frontend] Show TMDB import warnings mappings and media preview`. Issue gốc tham chiếu `MovieModal.tsx` — file này đã bị xóa và thay bằng `MovieEditorPage.tsx` (trang riêng, không còn modal) trong một MR trước đó cùng đợt làm việc. MR này xây review step tương đương trên kiến trúc mới: trước đây `MovieEditorPage` áp dữ liệu TMDB thẳng vào form, genre unmapped chỉ hiện đúng 1 toast bảo "tự chọn genre thủ công", item đã import chỉ bị disable không giải thích, không phân biệt severity cho bất kỳ warning nào, release date/age rating lấy từ TMDB nhìn giống hệt dữ liệu admin đã xác nhận, và trailer TMDB chọn được (từ issue trailer trước đó) chưa từng được hiển thị ở đâu cả.

Related Issue: Closes `[Frontend] Show TMDB import warnings mappings and media preview`
Depends on: `TMDB-FIX-03`, `TMDB-FIX-05`, `TMDB-FIX-07` (đã có sẵn ở backend từ các MR trước). `TMDB-FIX-06` (resync) **không** được implement — chưa có backend nào cho tính năng này, xem phần Key Architectural Decisions.

---

## Changes Introduced

**Controllers / Routes:**
- Không có route mới. `GET /api/movies/tmdb/now-playing`, `/upcoming`, `/search` (đã tồn tại) trả thêm 1 field trong response.

**Services / Logic:**
- `TmdbService.mapToResultItems()` — thay `findExistingTmdbIds()` (chỉ trả về Set tmdbId) bằng `findExistingTmdbIdsWithMovieId()` (trả cả cặp tmdbId↔movieId, vẫn 1 truy vấn bulk duy nhất, không N+1) để mỗi item "đã import" mang theo `localMovieId` thật.

**DTOs / Mappers / Components:**
- `MovieRepository` — thêm `findExistingTmdbIdsWithMovieId()` (projection interface `TmdbIdAndMovieId`), xóa `findExistingTmdbIds()` cũ (không còn nơi nào dùng).
- `TmdbSearchResultItem` — thêm `localMovieId` (null nếu chưa import).
- **Frontend:** `client/src/utils/tmdbWarnings.ts` (mới) — phân loại warning từ backend (`warnings: string[]`) thành `{severity, group, label}` theo đúng code prefix (`GENRE_UNMAPPED:`, `POSTER_NOT_AVAILABLE`, `TRAILER_NOT_FOUND`, `TRAILER_FALLBACK_TEASER:`, `RUNTIME_MISSING`, ...), **không** parse message text. 3 mức severity: `INFO`/`WARNING`/`BLOCKING`; 6 nhóm: required-metadata, genre-mapping, release-rating, trailer, poster-backdrop, upstream.
- `client/src/api/movieApi.ts` — thêm `localMovieId?: number` vào `TmdbSearchItem`; thêm các field trailer (`trailerUrl`, `trailerProvider`, `trailerExternalKey`, `trailerLanguageCode`, `trailerVideoType`, `trailerOfficial`) vào `TmdbMovieDetails` — các field này backend đã trả từ MR trailer trước đó nhưng type phía frontend chưa từng được cập nhật theo, nên trước MR này TypeScript không hề biết `details.trailerUrl` tồn tại.
- `MovieEditorPage.tsx` — thêm section "TMDB Import Review" (chi tiết ở dưới) và cập nhật browse-list item đã import.

**Database / JPA / Migration:**
- Không có.

**Exception Handling / Error Codes:**
- Không thêm mã lỗi nào — toàn bộ tính năng này chỉ đọc dữ liệu preview (`GET /tmdb/{id}/details`, vốn read-only) và các API tạo genre/movie đã tồn tại (`POST /api/genres`, `POST/PUT /api/movies`), không có endpoint mới.

---

## API contract

Không có contract mới. Field bổ sung trên response đã tồn tại:

`GET /api/movies/tmdb/{now-playing|upcoming|search}` — mỗi item thêm:
```json
{
  "tmdbId": 1368337,
  "alreadyImported": true,
  "localMovieId": 42
}
```
`localMovieId` là `null` khi `alreadyImported = false`.

---

## Key Architectural Decisions

- **Genre mapping có 3 hướng xử lý, đúng theo quyền, không gọi lại `POST /tmdb/import`.** `MovieEditorPage` dùng luồng tạo/sửa phim thông thường (`POST/PUT /api/movies`, không phải `POST /tmdb/import`) để giữ nguyên kiến trúc "1 trang, 1 luồng save" đã quyết định ở MR dựng `MovieEditorPage`. Vì vậy "tạo pending genre" ở đây nghĩa là gọi thẳng `POST /api/genres` (ADMIN-only, tạo genre `ACTIVE` ngay) — **không** phải cơ chế `PENDING_REVIEW` riêng của `TmdbService.createPendingReviewGenre()` (cơ chế đó chỉ tồn tại trong luồng `POST /tmdb/import` không được `MovieEditorPage` sử dụng). Nút "Create new" vì vậy chỉ hiện với ADMIN, đúng theo role gate thật của `POST /api/genres`; EMPLOYEE chỉ thấy "Map to existing" và "Ignore".
- **Phân loại warning tuyệt đối theo code, không parse message.** Đúng yêu cầu AC "UI chỉ dựa trên error/warning codes, không parse message text" — `classifyWarning()` match theo prefix cố định (`GENRE_UNMAPPED:`, `TRAILER_FALLBACK_TEASER:`, ...), có fallback an toàn (severity `WARNING`, nhóm `upstream`) cho bất kỳ code nào chưa biết tới, để một warning code mới từ backend không bao giờ làm UI throw lỗi.
- **Không xây "re-sync UI hiển thị field-level diff".** Đây là 1 bullet trong AC nhưng phụ thuộc `TMDB-FIX-06` — tính năng resync một phim đã import với dữ liệu TMDB mới nhất **chưa hề tồn tại ở backend** (đã disclose rõ ở 2 MR trước: multi-company và trailer-ingestion). Xây UI diff cho một thao tác backend không tồn tại là không thể; bullet này bị bỏ qua có chủ đích, không phải thiếu sót.
- **"Sync" cho item đã import cũng không làm được vì lý do tương tự** — chỉ implement "View" (điều hướng sang trang edit của phim đã import), không có "Sync" thật sự.
- **Badge "TMDB · UNVERIFIED" tự xóa khi admin sửa tay field đó**, không cần nút "Confirm" riêng — sửa giá trị = xác nhận, giữ UX đơn giản đúng tinh thần AC ("Release date/rating từ TMDB được gắn source và trạng thái UNVERIFIED").

---

## How to Test

1. `npm test` (client) — bao gồm test mới `tmdbWarnings.test.ts` (10 case: phân loại severity/nhóm cho từng loại warning, group theo nhóm, `hasBlockingWarning()`, trích xuất genre id từ warning code, fallback an toàn cho code lạ). Kết quả: toàn bộ 175 test client pass.
2. `mvnw.cmd -pl movie-service test` — không có test Java mới trong MR này (thay đổi backend chỉ là đổi 1 query bulk, được test gián tiếp qua các test TMDB hiện có vẫn pass). Kết quả: 216/217 (1 lỗi pre-existing không liên quan).
3. `npm run build` và `tsc --noEmit` — sạch.
4. Thủ công: mở Add Movie → Browse TMDB → chọn 1 phim có genre chưa map (ví dụ phim TMDB có genre "Music" nếu DB local chưa map genre này) → xác nhận section "TMDB Import Review" xuất hiện, hiển thị warning theo nhóm/severity, ô genre-mapping cho phép Map/Create/Ignore → thử bấm Save khi chưa resolve → bị chặn với thông báo rõ ràng → resolve xong → Save thành công.
5. Thủ công: chọn lại 1 phim đã import trước đó trong danh sách Now Showing/Upcoming — xác nhận item hiện nút "View" (không còn bị disable mờ ảo) và điều hướng đúng sang trang edit của phim đó.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (backend `mvn compile`, frontend `tsc` + `npm run build`)

**Backend**
- [x] Không phát sinh N+1 mới (vẫn đúng 1 câu bulk query, chỉ đổi từ trả `Set<Integer>` sang trả cả `movieId`)
- [x] Không thêm mã lỗi (không cần)
- [ ] Chưa test thủ công qua Postman trong phiên này (đã test qua UI thật, xem How to Test #4-5)

**Frontend**
- [x] Loading/empty/error (bao gồm 429 rate-limit) được phân biệt rõ cho cả 3 tab Now Showing/Upcoming/Search, có nút Retry
- [x] `axiosClient` gắn Bearer token đúng (không đổi phần auth)
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên này

---

## Reviewer Notes

- **`TMDB-FIX-06` (resync) và "re-sync UI diff" vẫn chưa tồn tại ở đâu trong codebase** — đã disclose nhất quán ở 3 MR liên tiếp (multi-company, trailer-ingestion, và MR này). Nếu resync được ưu tiên làm sau, phần review UI này (đặc biệt `classifyWarning`/severity/group) có thể tái sử dụng được, không cần viết lại từ đầu.
- **"Create new genre" tạo genre `ACTIVE` ngay lập tức, không phải `PENDING_REVIEW`** — khác với hành vi của `TmdbService.createPendingReviewGenre()` trong luồng `POST /tmdb/import`. Đây là chủ đích (xem Key Architectural Decisions), nhưng reviewer nên lưu ý nếu có kỳ vọng 2 luồng phải giống hệt nhau về governance.
- `movieApi.ts`'s `TmdbMovieDetails` thiếu các field trailer là một khoảng trống có sẵn từ trước (MR trailer chỉ cập nhật DTO backend, quên đồng bộ type phía frontend) — MR này tiện thể vá luôn, không phải thay đổi ngoài phạm vi.
