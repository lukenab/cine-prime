## Overview / Objective

Hoàn thiện issue `[Backend] Add tagline field to Movie and MovieTranslation entities` (đóng `#150`). `Movie` và `MovieTranslation` trước đây hoàn toàn không có field tagline, dù TMDB movie details và translations đều cung cấp dữ liệu này — admin không có cách nào lưu câu tagline (catchphrase ngắn) của phim, dù nhập tay hay import từ TMDB.

MR này thêm tagline ở cả 2 cấp (gốc trên `Movie`, theo locale trên `MovieTranslation`), dẫn qua đúng pipeline TMDB chung (`TMDB-FIX-02`) thay vì viết thêm 1 đường mapping TMDB thứ hai, và áp dụng cùng cơ chế provenance TMDB/MANUAL đã có ở `trailer_url` để một tagline admin tự sửa không bị resync ghi đè sau này.

Related Issue: Closes `[Backend] Add tagline field to Movie and MovieTranslation entities`
Closes: `#150`
Depends on: `TMDB-FIX-02` (pipeline dùng chung cho preview/import, đã có sẵn từ MR trước)

---

## Changes Introduced

**Controllers / Routes:**
- Không có route mới — `POST/PUT /api/movies`, `GET /api/movies/{id}` (đã tồn tại) chỉ thêm field trong request/response body.

**Services / Logic:**
- `TmdbService.getDetails()` / `importMovie()` — cả 2 đều lấy tagline qua `TmdbDraftMapper.toDraft()` dùng chung (không thêm mapping TMDB thứ hai trong controller/service, đúng Technical Notes của issue).
- `importMovie()` — set `Movie.tagline` + `taglineSource = "TMDB"` nếu TMDB có tagline, ngược lại `taglineSource = "MANUAL"` (không có gì để bảo vệ).
- `MovieService.updateMovie()` — nếu request có `tagline` (khác null), đánh dấu `taglineSource = "MANUAL"` — cùng pattern đã dùng cho `trailerUrl`, để một tagline admin tự sửa không bị 1 lần resync tương lai (chưa tồn tại) ghi đè.
- `MovieService.saveTranslations()` / `reconcileTranslations()` — reconcile tagline theo locale cùng lúc với title/synopsis (không tách luồng riêng).

**DTOs / Mappers / Components:**
- `TmdbMovieDetail` (raw TMDB `/movie/{id}` DTO) — thêm `tagline` (field JSON tên đúng, TMDB trả thật).
- `TmdbTranslationsResponse.TranslationData` (raw TMDB `/translations` DTO) — thêm `tagline` (TMDB translations API cũng trả field này).
- `TmdbMovieDraft`, `TranslationDraft` — thêm `tagline`.
- `TmdbDraftMapper.toDraft()` — map tagline gốc vào draft; `buildTranslations()` — bản EN fallback về tagline gốc nếu TMDB không có bản dịch EN (giống hệt cách title/overview đã fallback), bản VI chỉ thêm nếu TMDB thật sự có. Thêm helper `blankToNull()` vì TMDB trả `""` thay vì bỏ field khi phim không có tagline — không được lưu chuỗi rỗng làm giá trị thật.
- `CreateMovieRequest` / `UpdateMovieRequest` / `TranslationRequest` — thêm `tagline` (`@Size(max = 500)`).
- `MovieResponse` — thêm `tagline` + `taglineSource` (`TMDB`/`MANUAL`, cùng ý nghĩa với `trailerSource` đã có).
- `TranslationResponse` — thêm `tagline`.
- `TmdbMovieDetailsResponse` (preview) — thêm `tagline` (gốc; bản theo locale nằm trong từng phần tử `translations`).
- **Frontend:** `movieApi.ts` — thêm `tagline`/`taglineSource` vào các type liên quan (`MovieV2`, `CreateMovieRequest`, `TranslationRequest`/`Response`, `TmdbMovieDetails`).
- **Frontend:** `MovieEditorPage.tsx` — thêm ô "Tagline" riêng cho từng ngôn ngữ (VI/EN), đặt trước Synopsis, có ghi chú rõ "short catchphrase, not a synopsis"; tagline gốc được suy ra từ 2 ô này giống hệt cách `synopsis` gốc hiện đang được suy ra (không thêm ô thứ 3 lệch convention).
- **Frontend:** `MovieDetailModal.tsx` — hiển thị tagline (in nghiêng) phía trên Synopsis khi xem chi tiết phim.

**Database / JPA / Migration:**
- `V7__add_movie_tagline.sql` — `movie.tagline` (nullable, `VARCHAR(500)`), `movie.tagline_source` (`NOT NULL DEFAULT 'MANUAL'`, `CHECK IN ('TMDB','MANUAL')`), `movie_translation.tagline` (nullable, `VARCHAR(500)`). Theo đúng convention idempotent đã thiết lập trong repo (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` trước `ADD CONSTRAINT`).

**Exception Handling / Error Codes:**
- Không thêm mã lỗi mới — tagline thiếu/rỗng không bao giờ chặn import hay validate, đúng AC.

---

## API contract

### `GET /api/movies/tmdb/{tmdbId}/details` (đã tồn tại, thêm field)

```json
{
  "code": 200,
  "result": {
    "tagline": "Fear is a choice.",
    "translations": [
      { "languageCode": "en", "title": "...", "synopsis": "...", "tagline": "Fear is a choice." },
      { "languageCode": "vi", "title": "...", "synopsis": "...", "tagline": "Nỗi sợ là một lựa chọn." }
    ]
  }
}
```

### `POST/PUT /api/movies` (đã tồn tại, thêm field)

Request:
```json
{
  "tagline": "Câu tagline gốc",
  "translations": [
    { "languageCode": "vi", "title": "...", "tagline": "Câu tagline tiếng Việt" }
  ]
}
```

Response (`MovieResponse`):
```json
{
  "tagline": "Câu tagline gốc",
  "taglineSource": "MANUAL"
}
```

---

## Key Architectural Decisions

- **Dùng chung pipeline `TMDB-FIX-02`, không thêm mapping TMDB thứ hai.** Cả `getDetails()` (preview) và `importMovie()` đều lấy tagline qua đúng 1 hàm `TmdbDraftMapper.toDraft()` — đúng ràng buộc kỹ thuật issue yêu cầu, tránh 2 luồng preview/import lệch nhau như các field khác từng gặp trước khi có TMDB-FIX-02.
- **Chuẩn hoá `""` thành `null` ngay tại mapper.** TMDB trả tagline rỗng (`""`) thay vì bỏ field khi phim không có tagline — nếu không xử lý sẽ lưu nhầm chuỗi rỗng như một giá trị thật, gây hiển thị sai ở frontend (ô tagline trông như "có nội dung" nhưng thực chất rỗng).
- **`taglineSource` theo đúng pattern `trailerSource` đã có, không phát minh cơ chế mới.** Vì hiện tại chưa có tính năng resync (TMDB-FIX-06 chưa được implement, đã disclose ở các MR trailer/multi-company trước đó), field này mang tính phòng thủ — sẵn sàng cho khi resync được xây, không có logic resync thật nào chạy trong MR này.
- **Không thêm ô "tagline gốc" riêng ở form** — tagline gốc được suy ra từ tagline VI/EN giống hệt cách `synopsis` gốc hiện tại đang được suy ra (`canonicalSynopsis`), giữ nhất quán UI convention thay vì thêm 1 input thứ 3 không có tiền lệ.
- **Tagline dùng ô input riêng biệt, không tái sử dụng textarea Synopsis** — đúng yêu cầu AC "không dùng tagline thay synopsis", tránh nhầm lẫn 2 khái niệm khác nhau (catchphrase ngắn vs. tóm tắt nội dung).

---

## How to Test

1. `mvnw.cmd -pl movie-service test` — bao gồm test mới:
   - `TmdbDraftMapperTest` — 5 case: copy tagline từ detail vào draft, chuẩn hoá tagline rỗng thành null, bản EN fallback về tagline gốc khi TMDB không có bản dịch EN, bản VI chỉ có khi TMDB thật sự cung cấp, tagline thiếu không thêm warning/không chặn mapping.
   - `TmdbServiceTest` — 2 case: `importMovie()` set đúng `tagline`/`taglineSource="TMDB"` khi có; để `tagline=null`/`taglineSource="MANUAL"` khi TMDB không có (và import vẫn thành công, không throw).
   - `MovieServiceTest` — 2 case: sửa tagline qua `updateMovie()` chuyển `taglineSource` sang `MANUAL`; không đụng tới `tagline` trong request thì `taglineSource` giữ nguyên.
   - `FlywayMigrationIntegrationTest` — cập nhật số migration của kịch bản fresh-DB (7 → 8, tính cả `V7` + `R`).
   - Kết quả: 244/245 — 1 lỗi còn lại (`MovieImageRepositoryIntegrationTest`) là lỗi có từ trước, không liên quan.
2. `npm test` (client) — 175/175 pass, không có test nào cần thêm ở tầng UI thuần (logic tagline chủ yếu nằm ở backend + form binding đơn giản).
3. `npm run build` và `tsc --noEmit` — sạch.
4. Thủ công: import 1 phim từ TMDB có tagline (ví dụ "Fear is a choice.") → xác nhận `tagline`/`taglineSource="TMDB"` được lưu đúng, hiển thị đúng ở `MovieDetailModal`. Sau đó sửa tagline thủ công qua `MovieEditorPage` → xác nhận `taglineSource` chuyển thành `"MANUAL"`.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (backend `mvn compile`, frontend `tsc` + `npm run build`)

**Backend**
- [x] Không phát sinh N+1 mới (tagline đi kèm cùng query/save translation đã có sẵn)
- [x] Exception handling không cần mã lỗi mới (tagline thiếu/rỗng không bao giờ throw)
- [ ] Chưa test thủ công qua Postman trong phiên này (đã test qua unit test; import/edit tagline qua UI thật chưa chạy live trong phiên này)
- [ ] Postman collection / `API_CONTRACT.md` chưa cập nhật theo field mới

**Frontend**
- [x] Ô Tagline tách biệt rõ với Synopsis, không tái sử dụng
- [x] `npm run build` + `tsc` sạch
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên này

---

## Reviewer Notes

- **`TMDB-FIX-06` (resync) vẫn chưa tồn tại ở đâu trong codebase** — `taglineSource` chỉ là field phòng thủ, giống các MR trailer/multi-company trước đó đã disclose. Không có logic resync thật nào cần review ở đây.
- **Không có ô "tagline gốc" riêng trong form** — cố ý, xem Key Architectural Decisions. Nếu sau này team muốn tagline gốc được nhập độc lập với VI/EN (không suy ra), đây là thay đổi UI riêng, không phải thiếu sót của MR này.
- Field `tagline` trên cả `Movie` và `MovieTranslation` đều giới hạn `VARCHAR(500)` — cùng độ dài với `title`, đủ cho tagline dài nhất mà TMDB từng thấy nhưng vẫn có validate ở tầng server (`@Size(max = 500)`), không chỉ dựa vào giới hạn DB.
