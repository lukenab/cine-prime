## Overview / Objective

Hoàn thiện issue `[Backend] Refactor Movie.company to support multiple production companies (ManyToMany)` (đóng issue `#151`). Trước đây `Movie` chỉ liên kết đúng 1 `ProductionCompany` (`movie.company_id`), trong khi TMDB trả về nhiều production company cho mỗi phim — import chỉ lấy phần tử đầu tiên. Việc upsert company cũng dùng exact/case-sensitive name làm identity chính, nên một company bị đổi tên/đổi cách viết hoa sẽ bị tạo trùng ở lần import sau thay vì được nhận diện lại.

MR này chuyển `Movie` sang liên kết nhiều `ProductionCompany` qua bảng trung gian, thêm `tmdbCompanyId` làm external identity ổn định cho upsert, và đảm bảo enrich company hiện có không bao giờ xoá mất dữ liệu local (logo/country) chỉ vì TMDB không trả field đó lần này.

Related Issue: Closes `#151` — `[Backend] Refactor Movie.company to support multiple production companies (ManyToMany)`
Depends on: không phụ thuộc MR nào khác trong nhánh đang mở

---

## Changes Introduced

**Controllers / Routes:**
- Không đổi route nào. `POST /api/movies`, `PUT /api/movies/{id}`, `GET /api/movies/{id}` giữ nguyên endpoint/method, chỉ đổi field trong request/response body.

**Services / Logic:**
- `TmdbService.upsertCompany()` — viết lại theo thứ tự ưu tiên: match theo `tmdbCompanyId` (ổn định) trước, fallback theo tên chính xác (chỉ dành cho company tạo trước khi có field này, hoặc company tạo tay từ trang admin chưa gắn TMDB id). Company tìm thấy được **enrich**, không tạo mới: field nào TMDB không cung cấp (null/blank) thì giữ nguyên giá trị local đang có, không ghi đè thành null.
- Thêm `enrichCompany()` / `findExistingCompany()` dùng chung giữa `upsertCompany()` (thật sự ghi) và `previewCompany()` (chỉ đọc, không đổi).
- `importMovie()`: liên kết **toàn bộ** company hợp lệ từ TMDB (dedup theo reference identity bằng `LinkedHashSet`, giữ đúng thứ tự TMDB trả về) thay vì `companies.get(0)` như trước. Race concurrent-import bắt qua `DataIntegrityViolationException`, fallback tái sử dụng bản ghi mà transaction khác vừa tạo.
- `MovieService.createMovie()` / `updateMovie()` — thêm `resolveCompanies()`: distinct ID trước khi validate (tránh false NOT_FOUND khi request gửi trùng ID, cùng pattern với genres/formats), `companyIds = null` giữ nguyên quan hệ hiện tại, `companyIds = []` xoá hết company của phim, ID không tồn tại → `COMPANY_NOT_FOUND`.

**DTOs / Mappers / Components:**
- `ProductionCompany` entity — thêm `tmdbCompanyId` (nullable, unique).
- `ProductionCompanyRepository` — thêm `findByTmdbCompanyId()`, `findAllByCompanyIdIn()`.
- `ProductionCompanyResponse` — thêm `tmdbCompanyId`.
- `CreateMovieRequest` / `UpdateMovieRequest.companyId` (Long) → `companyIds` (`List<Long>`).
- `MovieResponse.companyName` (String) → `companies` (`List<ProductionCompanyResponse>`).
- `MovieMapper` — `@Mapping(target = "company", ...)` đổi thành `@Mapping(target = "companies", ...)`; `toMovieResponse` map trực tiếp `companies`.
- **Frontend:** `movieApi.ts` — cập nhật type tương ứng (`companyIds`, `companies`, `tmdbCompanyId`); hàm bridge `toLegacyMovie()` join tên các company bằng dấu phẩy thay vì đọc `companyName`.
- **Frontend:** `MovieEditorPage.tsx` — ô chọn company từ single-combobox (gõ tên → chọn 1) đổi thành multi-select dạng chip: tìm & thêm nhiều company, mỗi chip có nút xoá riêng; công ty lấy từ TMDB preview chưa từng import (`localCompanyId == null`) được đánh dấu "(new)" và tạo thật khi bấm Save (`resolveCompanyIds()`), giống cơ chế cũ nhưng áp dụng cho toàn bộ danh sách thay vì chỉ company đầu tiên.
- **Frontend:** `MovieDetailModal.tsx` — hiển thị `movie.companies.map(c => c.name).join(", ")` thay vì `movie.companyName`.

**Database / JPA / Migration:**
- `V6__movie_multi_production_company.sql`:
  - Tạo bảng `movie_production_company` (`movie_id, company_id` composite PK — chính là unique composite key theo yêu cầu AC), `company_id` có `ON DELETE RESTRICT` (không cho xoá company đang được phim tham chiếu), `movie_id` có `ON DELETE CASCADE` (xoá phim không xoá company, chỉ xoá dòng liên kết).
  - Backfill dữ liệu `movie.company_id` hiện có vào bảng mới **trước khi** drop cột — bọc trong `DO $$ ... IF EXISTS (cột company_id) $$` để migration vẫn idempotent khi chạy lại trên schema đã migrate xong (cột đã bị drop thì bỏ qua bước backfill).
  - `ALTER TABLE movie DROP COLUMN IF EXISTS company_id` — retire cột cũ.
  - `production_company.tmdb_company_id` (nullable) + unique index dạng partial (`WHERE tmdb_company_id IS NOT NULL`) — cho phép nhiều company chưa có TMDB id cùng là NULL mà không vi phạm unique.
  - Theo đúng convention idempotent đã có trong repo (`IF NOT EXISTS`/`DROP CONSTRAINT IF EXISTS` trước khi `ADD`) — bắt buộc vì `FlywayMigrationIntegrationTest` chạy lại toàn bộ migration trên schema đã migrate sẵn để mô phỏng database hand-migrated.

**Exception Handling / Error Codes:**
- Không thêm mã lỗi mới — tái sử dụng `COMPANY_NOT_FOUND` sẵn có cho ID không tồn tại trong `companyIds`.

---

## Key Architectural Decisions

- **Dedup company theo reference identity (`LinkedHashSet<ProductionCompany>`), không theo `companyId`.** `ProductionCompany` không có `@EqualsAndHashCode`, và một company vừa tạo mới trong cùng transaction có thể chưa có `companyId` được gán ngay ở tầng Java trước khi entity thật sự flush — dùng `companyId` làm key dedup sẽ vô tình gộp nhầm 2 company khác nhau (cả hai đều `null`). `upsertCompany()` luôn trả về đúng instance được quản lý bởi persistence context, nên identity-based dedup vừa đúng vừa đơn giản hơn.
- **Enrich chứ không overwrite.** TMDB không phải lúc nào cũng trả đủ `country`/`logoUrl` cho một company đã từng import — nếu ghi đè vô điều kiện sẽ xoá mất dữ liệu do admin bổ sung tay trước đó. `enrichCompany()` chỉ set field khi giá trị TMDB không null/blank.
- **`tmdbCompanyId` là identity chính, tên chỉ là fallback di trú.** Áp dụng đúng tinh thần AC "exact/case-sensitive name không còn là identity chính" — tên vẫn được dùng làm fallback cho company tạo trước khi trường này tồn tại, nhưng không còn là điều kiện match đầu tiên.
- **Không tách `Distributor`/`TerritoryRelease` trong MR này** — đúng theo "Technical Notes" của issue, việc phân biệt nhà sản xuất/nhà phát hành vùng miền là phạm vi của issue khác, `ProductionCompany` không mở rộng thêm field liên quan đến rights/phân phối.
- **Frontend giữ cơ chế "tạo company mới lúc Save" (không tạo ngay khi áp dụng TMDB)** — giống hành vi cũ, chỉ mở rộng cho nhiều công ty thay vì một, tránh tạo rác company nếu admin áp TMDB xong rồi huỷ mà không lưu.

---

## How to Test

1. `mvnw.cmd -pl movie-service test` — bao gồm test mới `TmdbCompanyResolutionTest` (5 case: liên kết nhiều company thay vì chỉ lấy đầu tiên, match theo `tmdbCompanyId` dù tên khác, enrich không xoá field local đã có, tái sử dụng bản ghi khi gặp race concurrent-import, dedupe khi TMDB trả 2 draft cùng company) và các case mới trong `MovieServiceTest` (`companyIds` trùng ID được chuẩn hoá, `companyIds=[]` xoá hết company, ID không tồn tại → `COMPANY_NOT_FOUND`). Kết quả tại thời điểm viết MR: 199/200 — 1 lỗi còn lại (`MovieImageRepositoryIntegrationTest.save_NativeQuery_LegacyMixedCase_UppercaseEnum`) là lỗi có từ trước, không liên quan đến MR này (đã xác nhận tồn tại trước khi bắt đầu).
2. `FlywayMigrationIntegrationTest` — cả 2 kịch bản (fresh DB, hand-migrated DB) đều pass với `V6`; số migration của kịch bản fresh DB đã cập nhật 6 → 7 (`V1..V6` + `R`).
3. Thủ công: import 1 phim từ TMDB có nhiều production company (ví dụ phim của cả Legendary Pictures + Warner Bros.), xác nhận cả 2 company đều được lưu vào `movie_production_company` và trả về đủ trong response. Sau đó sửa phim, xoá bớt 1 company qua `companyIds`, xác nhận công ty đó không còn liên kết với phim nhưng vẫn còn trong bảng `production_company` (không bị xoá cứng).
4. `mvnw.cmd -pl movie-service compile` và `npx tsc --noEmit` (client) đều sạch đối với các file trong MR này (một số lỗi TypeScript khác trong repo là lỗi có sẵn, không liên quan).

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (backend `mvn compile`, frontend `tsc` cho các file đã đổi)

**Backend**
- [x] Không phát sinh N+1 mới (`resolveCompanies()` dùng 1 câu `findAllByCompanyIdIn`, cùng pattern với genres/formats)
- [x] Exception dùng đúng mã lỗi có sẵn (`COMPANY_NOT_FOUND`)
- [ ] Endpoint chưa được test thủ công qua Postman/API client trong phiên làm việc này — reviewer nên smoke-test `POST /api/movies` và `PUT /api/movies/{id}` với `companyIds` trước khi merge
- [ ] Postman collection / `API_CONTRACT.md` chưa cập nhật theo field mới

**Frontend**
- [x] Trạng thái loading/error được xử lý (giữ nguyên cơ chế cũ, chỉ mở rộng cho nhiều company)
- [x] `axiosClient` gắn Bearer token đúng cách (không đổi phần auth)
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên này

---

## Reviewer Notes

- **Cột `movie.company_id` đã bị drop hẳn**, không phải deprecate-rồi-giữ-lại — nếu còn service/báo cáo nào khác đọc trực tiếp cột này qua raw SQL (ngoài JPA), cần rà lại trước khi merge.
- **`uq_company_name` (unique theo tên) trên `production_company` vẫn giữ nguyên**, chưa được nới lỏng — nếu TMDB có 2 công ty khác `tmdbCompanyId` nhưng trùng tên hiển thị, `upsertCompany()` khi tạo mới sẽ bắn `DataIntegrityViolationException` và fallback tìm theo tên/tmdbId; đây là edge case hiếm, không phải lỗi mới do MR này gây ra (constraint đã tồn tại từ trước).
- Trong lúc phát triển, database dev cục bộ dính đúng kiểu lỗi "checksum mismatch" đã gặp ở MR trailer trước đó (dev server tự động reload và áp một bản nháp cũ của `V6` lên Postgres dev trước khi migration được sửa hoàn chỉnh) — đã xử lý bằng cách xoá dòng cũ trong `flyway_schema_history` và `ALTER TABLE` sửa lại đúng kiểu cột trên DB dev, không ảnh hưởng đến nội dung file migration cuối cùng trong MR.
- Không có thay đổi nào liên quan đến `Distributor`/`TerritoryRelease` — đúng như "Technical Notes" của issue yêu cầu để dành cho issue khác.
