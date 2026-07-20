## Overview / Objective

Toàn bộ 77 dòng trong `production_company` có `tmdb_company_id = NULL`, kể cả những công ty rõ ràng đến từ phim import TMDB thật (timestamp khớp với batch import cast của phim đó). MR này sửa đúng chỗ hổng khiến việc này xảy ra ở luồng đang hoạt động, để company tạo mới từ nay về sau giữ đúng liên kết TMDB.

Related Issue: "trong bảng production_company cột tmdb_company_id sao null hết" (câu hỏi trực tiếp từ user)

---

## Changes Introduced

**Controllers / Routes:**
- `ProductionCompanyController.create()` — nhận và set `tmdbCompanyId` từ request; nếu đã có company với `tmdb_company_id` đó, trả về company có sẵn thay vì insert (tránh vi phạm unique constraint khi 2 request tạo cùng 1 công ty TMDB gần như đồng thời).

**DTOs / Mappers / Components:**
- `ProductionCompanyRequest` — thêm field `tmdbCompanyId`.
- **Frontend:** `SelectedCompany` (state type trong `MovieEditorPage.tsx`) — thêm field `tmdbId`. Trước đây field này hoàn toàn không tồn tại trong type, nên dù `TmdbCompanyPreview` (dữ liệu preview từ TMDB) đã có sẵn `tmdbId`, nó bị rơi mất ngay khi map sang state form.
- `movieApi.ts` — thêm `tmdbCompanyId?: number` vào `ProductionCompanyRequest`.

**Services / Logic / Database:** Không có.

**Exception Handling / Error Codes:** Không có (dùng lại `findByTmdbCompanyId` sẵn có).

---

## Key Architectural Decisions

- **So sánh với Person để xác định gốc rễ:** luồng cast (`CastRow.tmdbPersonId`) đã làm đúng — giữ tmdb id xuyên suốt từ preview đến lúc gọi `createPerson()`. Company thiếu đúng bước tương đương này. MR này chỉ đưa Company về cùng chuẩn với Person, không đổi kiến trúc.
- **`POST /api/companies` trở thành idempotent theo `tmdbCompanyId`:** trước đây company được set `tmdbCompanyId` chỉ có ở `TmdbService.upsertCompany()` (dùng bởi `POST /tmdb/import` thật) — endpoint `POST /api/companies` (dùng bởi `MovieEditorPage.resolveCompanyIds()`, luồng chính khi thêm phim) chưa từng nhận `tmdbCompanyId`. Sau khi thêm khả năng nhận, phải thêm luôn bước tái sử dụng company đã có (giống `findExistingCompany()` của `upsertCompany()`), nếu không sẽ tạo lỗi mới (vi phạm unique constraint) thay vì lỗi cũ (mất tmdb id).
- **Không đụng đến 77 dòng cũ đang NULL** — đây là sửa code cho tương lai; dữ liệu lịch sử cần tra cứu lại từng tên qua TMDB API, xử lý riêng (xem "Backfill" bên dưới).

---

## Backfill (xử lý riêng, không nằm trong code MR này)

Đã tra cứu cả 77 tên qua TMDB `/search/company` và tạo bảng review (Artifact) để duyệt thủ công trước khi ghi — không tự động ghi thẳng vì có rủi ro khớp nhầm tên (nhiều công ty trùng tên thật trên TMDB, vd 3 công ty tên "Pathé" khác nhau).

- 74/77: khớp tự tin (tên khớp chính xác, hoặc khớp chính xác + phân biệt được bằng country khi có nhiều bản ghi trùng tên).
- 1/77 (Pixar Animation Studios): TMDB chỉ có "Pixar" — cùng công ty thật nhưng không khớp chuỗi tuyệt đối, cần xác nhận.
- 2/77 (A24, Pathé): nhiều bản ghi TMDB trùng tên chính xác, không tự phân biệt được — cần người chọn.

Sau khi user duyệt, sẽ viết 1 migration riêng (UPDATE theo `name` cho từng dòng đã duyệt) trong 1 MR khác, tách biệt với fix code này.

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 248 test pass (loại trừ lỗi có sẵn không liên quan). 3 test mới: `ProductionCompanyControllerTest` (tạo mới có tmdbCompanyId, tái sử dụng khi tmdbCompanyId đã tồn tại, tạo thủ công không có tmdbCompanyId).
2. `npm test` (client) — 206/206 pass. `tsc --noEmit` — không phát sinh lỗi mới ở `movieApi.ts`/`MovieEditorPage.tsx`.
3. Thủ công: Add Movie → Browse TMDB → chọn phim có 1 production company chưa từng import trước đó → Save → kiểm tra `production_company.tmdb_company_id` của công ty vừa tạo không còn NULL.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] No N+1 query issues (1 câu `findByTmdbCompanyId` đơn giản)
- [x] Exception handling uses correct error codes (không cần mã mới)

**Frontend**
- [x] Loading and error states handled (không đổi hành vi lỗi hiện có)
- [x] axiosClient attaches Bearer token correctly (không đổi phần auth)

---

## Reviewer Notes

- File `MovieAvailabilityPanel.tsx` có thể xuất hiện là "modified" trong working tree khi review branch này cục bộ — đó là thay đổi không liên quan, đang dở dang từ trước, **không thuộc phạm vi MR này** và không được stage/commit ở đây.
- Backfill 77 dòng cũ cố tình để MR riêng — xem mục "Backfill" ở trên.
