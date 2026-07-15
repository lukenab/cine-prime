# TMDB Ingestion — Bug Fix GitLab Issue Pack

> Format source: `docs/issues/ISSUE_TEMPLATE.md`  
> Code baseline reviewed: **2026-07-15**  
> Scope: TMDB browse/details/import, movie draft creation, genre mapping, media assets, Vietnam release metadata, safe re-sync and automated tests.

## 1. Danh sách issue cần tạo hoặc cập nhật

| Thứ tự | ID | GitLab action | Priority | Size | Phụ thuộc |
|---:|---|---|---|---|---|
| 1 | `TMDB-FIX-01` | Create new | High | M | Không |
| 2 | `TMDB-FIX-02` | Create new | High | L | `TMDB-FIX-01` |
| 3 | `TMDB-FIX-03` | Create new | High | M | `TMDB-FIX-02` |
| 4 | `TMDB-FIX-04` | Create new | High | M | `TMDB-FIX-02` |
| 5 | `TMDB-FIX-05` | Create new | High | L | `TMDB-FIX-02`, `#152` |
| 6 | `TMDB-FIX-06` | Create new | High | XL | `TMDB-FIX-02` |
| 7 | `TMDB-FIX-07` | Create new | High | L | `TMDB-FIX-02` |
| 8 | `TMDB-FIX-08` | Create new | Medium | M | Không |
| 9 | `TMDB-FIX-09` | Create new | High | L | Các issue backend liên quan |
| 10 | `TMDB-FIX-10` | Create new | High | L | `TMDB-FIX-03..07` |
| 11 | `#150` | Update existing | Medium | M | `TMDB-FIX-02` |
| 12 | `#151` | Update existing | High | L | `TMDB-FIX-02` |
| 13 | `#152` | Update existing | Medium | S | Trước `TMDB-FIX-05` |

> Tổng cộng: **10 issue mới + 3 issue cập nhật**. Không tạo issue mới thay cho `#150–#152`.

---

# TMDB-FIX-01 — [Backend] Make TMDB movie details preview read-only

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

`GET /api/movies/tmdb/{tmdbId}/details` hiện gọi `upsertCompany()` và `upsertPerson()`, làm phát sinh dữ liệu trong database ngay khi admin chỉ xem preview. Chuyển endpoint này thành truy vấn thuần, không tạo hoặc cập nhật bất kỳ entity nào trước khi command create/import được xác nhận.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Gọi details preview không thực hiện `save`, `update`, `delete` trên bất kỳ repository nào.
- [ ] Preview trả external company/person/genre DTO thay vì yêu cầu local database ID đã được tạo trước.
- [ ] Đóng modal sau khi preview không làm thay đổi số lượng record trong `production_company`, `person`, `genre`, `movie` hoặc junction tables.
- [ ] Method được đánh dấu read-only phù hợp hoặc không mở write transaction.
- [ ] Audit log không ghi hành động import/create khi mới xem preview.
- [ ] Có test xác minh repository write methods không được gọi.
- [ ] Có integration test so sánh database snapshot trước và sau request preview.

---

## API Specifications (if applicable)

### API 1 — Preview TMDB movie details

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/tmdb/{tmdbId}/details` |
| Description | Trả dữ liệu preview từ TMDB mà không ghi local database |
| Auth Required | Yes — `ADMIN` |

**Response 200 OK:**

```json
{
  "code": 200,
  "result": {
    "tmdbId": 693134,
    "originalTitle": "Dune: Part Two",
    "companies": [
      { "tmdbId": 923, "name": "Legendary Pictures", "localCompanyId": null }
    ],
    "genres": [
      { "tmdbId": 878, "name": "Science Fiction", "localGenreId": 6, "mappingStatus": "MAPPED" }
    ],
    "warnings": []
  }
}
```

---

## Technical Notes / Constraints

- Tách external preview DTO khỏi JPA entity và local response DTO.
- `GET` phải safe/idempotent theo HTTP semantics.
- Không sửa dữ liệu lookup để chỉ lấy được local IDs cho frontend.

---

## Related

- Branch: `fix/tmdb-details-read-only`
- Depends on: `TmdbService.getDetails()`
- Docs: `docs/issues/tmdb-ingestion-bug-fix-issue-pack.md`

---

# TMDB-FIX-02 — [Backend] Unify TMDB preview and import mapping pipeline

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Frontend hiện dùng details preview rồi gọi create movie thông thường, trong khi `POST /tmdb/import` dùng một mapping path khác. Chuẩn hóa về một pipeline lấy dữ liệu và mapping duy nhất để preview, create-from-preview và direct import không tạo ra hai movie draft khác nhau từ cùng một `tmdbId`.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có một pure mapper tạo `TmdbMovieDraft`/equivalent từ TMDB payload, không truy cập repository.
- [ ] Preview và import command dùng cùng mapper và cùng validation/warning rules.
- [ ] Direct import và create-from-preview cho cùng `tmdbId` tạo metadata tương đương.
- [ ] Không fallback runtime về `90` phút mà không cảnh báo; missing runtime được trả trong `warnings` hoặc chặn submit theo policy.
- [ ] Không mặc định screening format `2D` từ movie master; format được admin/release-version xác nhận.
- [ ] Duplicate được kiểm tra bằng `tmdbId`, `imdbId` và database unique constraint; race condition trả domain error `409` rõ ràng.
- [ ] Import command chạy trong một transaction: lỗi ở company/person/genre/cast/translation làm rollback toàn bộ draft.
- [ ] Movie import luôn tạo `DRAFT`, không tự publish hoặc tự approve.
- [ ] API contract và frontend types dùng chung response shape được document.

---

## API Specifications (if applicable)

### API 1 — Import TMDB movie draft

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/movies/tmdb/import` |
| Description | Tạo local movie DRAFT từ preview đã xác nhận |
| Auth Required | Yes — `ADMIN` |

**Request Body:**

```json
{
  "tmdbId": 693134,
  "selectedGenreMappings": { "878": 6 },
  "confirmedAgeRatingId": 4
}
```

**Response 200 OK:**

```json
{
  "code": 200,
  "result": {
    "movieId": 42,
    "tmdbId": 693134,
    "status": "DRAFT",
    "warnings": []
  }
}
```

**Response 409 Conflict:**

```json
{
  "code": 2021,
  "message": "Movie with TMDB ID 693134 already exists"
}
```

---

## Technical Notes / Constraints

- Không truyền toàn bộ payload TMDB từ browser trở lại server làm nguồn tin cậy; server refetch hoặc dùng signed short-lived preview token.
- Tách fetch, normalize, map, validate và persist thành các bước riêng để test độc lập.
- Giữ local overrides ngoài mapper TMDB.

---

## Related

- Branch: `fix/unify-tmdb-import-pipeline`
- Depends on: `TMDB-FIX-01`
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# TMDB-FIX-03 — [Backend] Stop silently dropping unmapped TMDB genres

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

`resolveGenres()` hiện chỉ giữ genre tìm thấy theo code/name và âm thầm bỏ genre chưa có trong local database. Thêm mapping theo TMDB genre ID, trạng thái review và warning rõ ràng để movie không mất classification metadata mà người nhập không biết.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Mapping chính dùng stable TMDB genre ID; name matching chỉ là migration/fallback có cảnh báo.
- [ ] Genre local hoặc bảng mapping có unique external key `source=TMDB + externalGenreId`.
- [ ] Genre TMDB chưa map được trả với `mappingStatus=UNMAPPED`; không bị bỏ khỏi preview.
- [ ] Import không tự tạo genre `ACTIVE` từ dữ liệu ngoài.
- [ ] Admin có thể map vào genre hiện có, tạo genre `PENDING_REVIEW`, hoặc ignore với reason.
- [ ] Submit movie for review bị chặn nếu còn genre unmapped chưa được xử lý.
- [ ] Có sync/admin action đối chiếu local taxonomy với `/genre/movie/list`.
- [ ] Concurrent sync/import không tạo duplicate genre hoặc duplicate mapping.
- [ ] Tests cover mapped, unmapped, renamed external label và duplicate mapping.

---

## API Specifications (if applicable)

### API 1 — Synchronize TMDB genre taxonomy

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/movies/tmdb/genres/sync` |
| Description | So sánh taxonomy TMDB với mapping local và trả các genre cần review |
| Auth Required | Yes — `ADMIN` |

**Response 200 OK:**

```json
{
  "code": 200,
  "result": {
    "mapped": 18,
    "unmapped": [
      { "tmdbGenreId": 99999, "name": "New Genre", "status": "PENDING_REVIEW" }
    ]
  }
}
```

---

## Technical Notes / Constraints

- Với scope nhỏ có thể thêm `tmdbGenreId` vào `Genre`; nếu dự kiến nhiều provider, dùng `external_genre_mapping`.
- Không ghi đè `genreName` local đã được biên tập chỉ vì tên TMDB thay đổi hoặc khác ngôn ngữ.
- Cập nhật readiness gate để kiểm tra unresolved mapping.

---

## Related

- Branch: `fix/tmdb-genre-mapping`
- Depends on: `TMDB-FIX-02`, `Genre`, `GenreRepository`
- Docs: [TMDB movie genre list](https://developer.themoviedb.org/reference/genre-movie-list)

---

# TMDB-FIX-04 — [Backend] Fetch and select an official TMDB trailer

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

`Movie.trailerUrl` đã tồn tại nhưng TMDB integration không gọi videos API nên trailer luôn trống. Lấy video metadata, áp dụng selection policy có tính ngôn ngữ/official status và lưu trailer mặc định có provenance thay vì chọn tùy ý phần tử đầu tiên.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] TMDB details fetch bao gồm `videos` bằng `append_to_response` hoặc endpoint tương đương.
- [ ] Selection ưu tiên `site=YouTube`, `type=Trailer`, `official=true`.
- [ ] Ưu tiên locale Việt Nam, sau đó English; fallback Teaser chỉ khi không có Trailer và phải có warning.
- [ ] Lưu tối thiểu provider, external video key, locale, type, official flag và selected/default state.
- [ ] `trailerUrl` được build từ allow-listed provider/key; không nhận URL tùy ý từ TMDB payload.
- [ ] Không làm import thất bại chỉ vì không có trailer; trả warning `TRAILER_NOT_FOUND`.
- [ ] Admin có thể thay trailer và local override không bị re-sync ghi đè.
- [ ] Tests cover nhiều trailer, trailer không official, VI/EN priority, teaser fallback và không có video.

---

## Technical Notes / Constraints

- MVP có thể tiếp tục expose `Movie.trailerUrl`, nhưng source fields nên lưu có cấu trúc để re-sync an toàn.
- Không embed/autoplay video chưa qua provider allow-list.
- Dùng cùng media selection policy cho preview và import.

---

## Related

- Branch: `feat/tmdb-trailer-ingestion`
- Depends on: `TMDB-FIX-02`, `TMDB-FIX-06`
- Docs: [TMDB movie videos](https://developer.themoviedb.org/reference/movie-videos)

---

# TMDB-FIX-05 — [Backend] Import selected TMDB posters backdrops and stills

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

TMDB integration hiện chỉ lưu một `poster_path`, còn frontend gán cùng URL cho cả poster và thumbnail. Import media có chọn lọc vào `movie_image`, phân biệt poster/backdrop/still và lưu metadata cần thiết để chọn đúng asset cho website, mobile và marketing.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] TMDB details fetch bao gồm `images` và hỗ trợ `include_image_language=vi,en,null`.
- [ ] Preview trả riêng posters, backdrops và stills; không gọi cùng một URL là hai asset khác nhau.
- [ ] Import mặc định tối đa 1 poster, 1 backdrop và số stills cấu hình được, đề xuất tối đa 10.
- [ ] Asset selection xét locale, resolution, aspect ratio, vote score và duplicate file path.
- [ ] `MovieImage` lưu source, external file path, language, width, height, aspect ratio, display order và default flag cần thiết.
- [ ] `thumbnailUrl` là CDN derivative hoặc explicit fallback; frontend không tự copy poster một cách không minh bạch.
- [ ] Image URL dùng TMDB configuration/base URL và size profile phù hợp; không hard-code toàn bộ media ở `w500`.
- [ ] Re-import không tạo duplicate `movie_image` cho cùng source/external path.
- [ ] Không có ảnh vẫn tạo được DRAFT nhưng trả warning; readiness rule quyết định điều kiện submit/publish.
- [ ] Tests cover language filtering, asset limits, duplicates, missing poster và invalid image metadata.

---

## API Specifications (if applicable)

### API 1 — TMDB movie details with media preview

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/tmdb/{tmdbId}/details` |
| Description | Trả media candidates đã normalize và recommendation mặc định |
| Auth Required | Yes — `ADMIN` |

**Response 200 OK:**

```json
{
  "code": 200,
  "result": {
    "tmdbId": 693134,
    "media": {
      "recommendedPosterPath": "/poster.jpg",
      "recommendedBackdropPath": "/backdrop.jpg",
      "posters": [],
      "backdrops": [],
      "stills": []
    }
  }
}
```

---

## Technical Notes / Constraints

- Hoàn tất `#152` trước để `imageType` dùng enum nhất quán.
- Chỉ lưu URL/path và metadata cần thiết; không bắt buộc tải binary về Cloudinary trong issue này.
- Nếu mirror asset sang Cloudinary/CDN, phải lưu cả upstream provenance.

---

## Related

- Branch: `feat/tmdb-movie-media-ingestion`
- Depends on: `TMDB-FIX-02`, `TMDB-FIX-06`, `#152`
- Docs: [TMDB movie images](https://developer.themoviedb.org/reference/movie-images), [TMDB image basics](https://developer.themoviedb.org/docs/image-basics)

---

# TMDB-FIX-06 — [Backend] Add TMDB metadata provenance and safe re-sync

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Movie hiện chỉ lưu `tmdbId`, không biết dữ liệu được import khi nào, field nào đã được admin chỉnh hoặc lần sync gần nhất thay đổi gì. Thêm provenance và re-sync có preview/diff để cập nhật metadata ngoài mà không ghi đè dữ liệu local đã xác minh.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Lưu tối thiểu `metadataSource`, `sourceId`, `importedAt`, `lastSyncedAt`, `sourcePayloadHash/version` và actor.
- [ ] Hệ thống phân biệt field theo source: upstream value, effective value và local override state.
- [ ] Có dry-run/diff endpoint cho biết field sẽ thêm, thay đổi, giữ local hoặc bỏ qua.
- [ ] Re-sync mặc định không ghi đè local override đã được admin xác nhận.
- [ ] TMDB null/missing field không tự xóa local value; delete cần explicit policy.
- [ ] Re-sync idempotent; cùng payload hash không tạo update/audit event thừa.
- [ ] Mọi applied/rejected field change được audit với before/after/source/actor.
- [ ] Re-sync không thay đổi movie lifecycle status hoặc tự publish.
- [ ] Concurrent edit và re-sync dùng optimistic version/conflict handling, không silent last-write-wins.
- [ ] Có policy rõ cho movie đang có showtime/public content.

---

## API Specifications (if applicable)

### API 1 — Preview TMDB re-sync

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/movies/{movieId}/tmdb-sync/preview` |
| Description | Fetch TMDB và trả field-level diff, chưa ghi database |
| Auth Required | Yes — `ADMIN` |

### API 2 — Apply TMDB re-sync

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/movies/{movieId}/tmdb-sync/apply` |
| Description | Áp dụng các field change đã chọn với optimistic version |
| Auth Required | Yes — `ADMIN` |

**Request Body:**

```json
{
  "expectedMovieVersion": 7,
  "acceptedFields": ["poster", "trailer", "cast"],
  "preserveLocalOverrides": true
}
```

---

## Technical Notes / Constraints

- Không lưu nguyên payload vô thời hạn nếu không cần; có thể lưu hash + normalized source snapshot.
- Tránh một boolean override toàn movie; cần field-level policy cho dữ liệu thường thay đổi độc lập.
- Distributor/local rating vẫn có precedence cao hơn TMDB.

---

## Related

- Branch: `feat/tmdb-safe-resync`
- Depends on: `TMDB-FIX-02`, movie audit/versioning
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# TMDB-FIX-07 — [Backend] Verify Vietnam theatrical release metadata before publishing

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Import hiện dùng top-level release date và lấy certification đầu tiên của VN/US mà không lọc theatrical release type. Chuẩn hóa dữ liệu theo territory Việt Nam và yêu cầu xác minh trước publish vì TMDB chỉ là metadata tham khảo, không thay thế distributor slate hoặc quyết định phân loại tại Việt Nam.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Parse `release_dates` theo country `VN` và phân biệt Premiere, Theatrical Limited, Theatrical, Digital, Physical, TV.
- [ ] VN theatrical date ưu tiên type `3`, sau đó type `2` theo policy; không dùng digital date làm cinema release date.
- [ ] Preview hiển thị source country/type/date thay vì chỉ một ngày không có provenance.
- [ ] Certification candidate được trả riêng; không tự coi US-to-VN mapping là kết quả pháp lý cuối cùng.
- [ ] Admin phải xác nhận local age rating và theatrical release date trước Submit/Approve theo readiness rule.
- [ ] Production company không được dùng thay cho Vietnam distributor.
- [ ] Missing VN release/rating tạo warning rõ ràng, không âm thầm fallback rồi publish.
- [ ] Thay đổi rating/release date sau khi có showtime phải qua policy/audit và validation ảnh hưởng lịch chiếu.
- [ ] Tests cover VN theatrical, limited theatrical, digital-only, missing VN, multiple certifications và US fallback candidate.

---

## Technical Notes / Constraints

- Có thể giữ `Movie.releaseDate` cho MVP nhưng nên lưu source/type/verified state; dài hạn tách `TerritoryRelease`.
- Screening format, dub/subtitle và sound format thuộc Release Version/Showtime, không suy ra từ movie detail.
- Không tự động approve dựa trên TMDB certification.

---

## Related

- Branch: `fix/tmdb-vn-release-verification`
- Depends on: `TMDB-FIX-02`, movie readiness gate
- Docs: [TMDB release dates](https://developer.themoviedb.org/reference/movie-release-dates)

---

# TMDB-FIX-08 — [Backend] Harden TMDB client timeout rate-limit and cache handling

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::Medium`

## Summary / Objective

TMDB client hiện tạo `RestTemplate` mặc định, chưa cấu hình connect/read timeout, retry policy, `429` handling hoặc cache. Bổ sung resilience để request admin không treo lâu, không gây retry storm và trả lỗi có thể xử lý khi upstream unavailable.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] HTTP client được inject/configure tập trung; không `new RestTemplate()` trực tiếp trong service.
- [ ] Có connect timeout và read/response timeout cấu hình bằng environment/property.
- [ ] Xử lý `429 Too Many Requests` theo `Retry-After`; retry có giới hạn và jitter/backoff.
- [ ] Không retry vô điều kiện cho `4xx` không transient.
- [ ] Browse/search/details có cache TTL ngắn phù hợp; cache key gồm endpoint, ID/query, page, region, language.
- [ ] Upstream timeout/5xx/invalid payload được map sang domain error ổn định, không lộ API key hoặc internal URL.
- [ ] Có metrics/log cho latency, cache hit, rate limit, timeout và failure; không log credential.
- [ ] Circuit breaker/bulkhead hoặc concurrency limit ngăn TMDB outage làm cạn request threads.
- [ ] Tests cover timeout, 429, 404, 5xx, malformed payload và successful retry.

---

## Technical Notes / Constraints

- Chọn Spring `RestClient`/`WebClient` hoặc configured `RestTemplate` phù hợp stack hiện tại; không cần reactive end-to-end chỉ để gọi TMDB.
- API key phải lấy từ secret/environment và không đặt trong query log.
- TMDB developer API không có SLA; local draft/read operations không được phụ thuộc tuyệt đối vào upstream availability.

---

## Related

- Branch: `fix/tmdb-client-resilience`
- Depends on: movie-service configuration
- Docs: [TMDB FAQ](https://developer.themoviedb.org/docs/faq)

---

# TMDB-FIX-09 — [Backend] Add TMDB ingestion regression and contract tests

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::High`

## Summary / Objective

Movie-service hiện có test tổng quát nhưng chưa có test cho `TmdbService`, nên trailer, image, genre, duplicate, rollback và upstream failure có thể regress mà pipeline vẫn xanh. Tạo test suite dùng mock HTTP server, không gọi TMDB thật và không phụ thuộc API key cá nhân.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Unit tests cover pure normalization/mapping của details, translations, credits, release dates, videos và images.
- [ ] Preview test chứng minh không repository write nào được gọi.
- [ ] Integration test cover atomic import và rollback khi một persistence step thất bại.
- [ ] Tests cover duplicate `tmdbId`/`imdbId` và concurrent import conflict.
- [ ] Tests cover mapped/unmapped genre và không silent drop.
- [ ] Tests cover trailer/media selection, missing media và duplicate image path.
- [ ] Tests cover VN release type/certification candidates và verification warning.
- [ ] Tests cover timeout, 429, 404, 5xx, malformed JSON và partial optional endpoint failure.
- [ ] Re-sync tests chứng minh local override không bị ghi đè và stale version bị conflict.
- [ ] Tests chạy bằng WireMock/MockWebServer/equivalent, không outbound internet và không cần real TMDB credential.
- [ ] CI publish test report và fail khi TMDB regression xảy ra.

---

## Technical Notes / Constraints

- Fixture JSON nên nhỏ nhưng phản ánh field names thật của TMDB.
- Tách contract fixture theo endpoint để biết chính xác optional sub-request nào lỗi.
- Không coi Postman manual test là thay thế cho automated regression suite.

---

## Related

- Branch: `test/tmdb-ingestion-regression`
- Depends on: `TMDB-FIX-01..08`
- Docs: `docs/testing/movie-service-postman-test-cases.md`

---

# TMDB-FIX-10 — [Frontend] Show TMDB import warnings mappings and media preview

**GitLab action:** Create new  
**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

TMDB modal hiện auto-fill trực tiếp nhưng không cho admin biết field nào thiếu, genre nào unmapped, rating/release date nào cần xác minh hoặc asset nào được chọn. Thêm review step trước Save/Import để người vận hành quyết định có kiểm soát thay vì tin toàn bộ metadata ngoài.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Modal có bước Preview/Review trước khi apply dữ liệu vào form hoặc import DRAFT.
- [ ] Hiển thị warnings theo nhóm: required metadata, genre mapping, Vietnam release/rating, trailer, poster/backdrop và upstream partial failure.
- [ ] Unmapped genre cho phép map existing, request create pending genre hoặc ignore với reason theo quyền.
- [ ] Hiển thị poster, backdrop, still và trailer được đề xuất; admin có thể đổi default asset.
- [ ] Release date/rating từ TMDB được gắn source và trạng thái `UNVERIFIED`; không hiển thị như dữ liệu local đã duyệt.
- [ ] Missing trailer/image không bị che bằng silent fallback; thumbnail fallback có label rõ.
- [ ] Item `alreadyImported` mở action View/Sync thay vì chỉ disable không giải thích.
- [ ] Re-sync UI hiển thị field-level diff và giữ local overrides mặc định.
- [ ] Loading, empty, partial error, 429 và retry states được phân biệt.
- [ ] Submit button bị disable khi còn blocking warning; UI chỉ dựa trên error/warning codes, không parse message text.
- [ ] Có component/API tests cho mapping, warning và conflict states.

---

## UI Reference / Mockup

TMDB overlay hiện tại trong `client/src/layouts/MovieModal.tsx`. Bổ sung flow:

```text
Browse/Search → Select title → Review metadata and mappings → Apply to draft → Save
```

---

## Technical Notes / Constraints

- Không tự gửi toàn bộ raw TMDB payload như trusted import command.
- Giữ browse tabs Now Playing/Upcoming/Search hiện có.
- Tách warning severity: `INFO`, `WARNING`, `BLOCKING`.

---

## Related

- Branch: `feat/tmdb-import-review-ui`
- Depends on: `TMDB-FIX-03`, `TMDB-FIX-04`, `TMDB-FIX-05`, `TMDB-FIX-06`, `TMDB-FIX-07`
- Docs: `docs/issues/tmdb-ingestion-bug-fix-issue-pack.md`

---

# Update #150 — [Backend] Add localized movie tagline and import it from TMDB

**GitLab action:** Update existing issue `#150`; do not create duplicate  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Movie và MovieTranslation thiếu tagline dù TMDB details/translations có thể cung cấp dữ liệu này. Mở rộng issue hiện có để tagline được import qua pipeline chung, hỗ trợ locale và không bị re-sync ghi đè khi admin đã sửa.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `Movie` có original tagline nullable, giới hạn độ dài được thống nhất trong DB/entity/DTO.
- [ ] `MovieTranslation` có localized tagline theo language/locale.
- [ ] Create/Update request và Movie response expose tagline nhất quán.
- [ ] TMDB details mapper map original/default tagline vào preview draft.
- [ ] TMDB translations mapper map tagline cho EN/VI khi có.
- [ ] Missing/blank tagline không làm import thất bại.
- [ ] Safe re-sync không ghi đè local tagline override.
- [ ] Frontend hiển thị/chỉnh sửa tagline và không dùng tagline thay synopsis.
- [ ] Migration, mapper, API contract và tests được cập nhật.

---

## Technical Notes / Constraints

- Không chỉ sửa entity; composite translation flow và mapper phải được test.
- Chọn max length đủ cho upstream nhưng vẫn có server validation.
- Dùng pipeline tại `TMDB-FIX-02`, không thêm mapping TMDB thứ hai trong controller.

---

## Related

- Branch: `feat/movie-tagline-field`
- Depends on: `TMDB-FIX-02`, `TMDB-FIX-06`
- Closes: `#150`

---

# Update #151 — [Backend] Support multiple production companies with stable TMDB identity

**GitLab action:** Update existing issue `#151`; do not create duplicate  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

TMDB trả nhiều production companies nhưng Movie hiện chỉ liên kết company đầu tiên; lookup company lại dùng exact name và không lưu TMDB company ID. Hoàn thiện issue `#151` bằng Many-to-Many relation, stable external identity và upsert chỉ trong import command đã xác nhận.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `Movie` liên kết nhiều ProductionCompany qua `movie_production_company` với unique composite key.
- [ ] Migration backfill company hiện tại vào junction table trước khi drop/retire `movie.company_id`.
- [ ] `ProductionCompany` lưu nullable unique `tmdbCompanyId` hoặc external identity mapping tương đương.
- [ ] Upsert ưu tiên TMDB company ID; exact/case-sensitive name không còn là identity chính.
- [ ] Existing company được enrich có kiểm soát; upstream null không xóa logo/country/website local.
- [ ] Preview details không upsert company; persistence chỉ xảy ra trong create/import command.
- [ ] Create/Update request dùng `companyIds`; response trả danh sách companies.
- [ ] Import liên kết toàn bộ companies hợp lệ và không chỉ lấy phần tử đầu tiên.
- [ ] Production company không bị gọi nhầm là Vietnam distributor.
- [ ] Concurrent import không tạo duplicate company hoặc junction rows.
- [ ] Frontend đổi single company selector sang multi-select hoặc read-only imported chips phù hợp.
- [ ] Migration, mapper, API contract và tests được cập nhật.

---

## Technical Notes / Constraints

- Không hard-delete company khi một phim bị xóa hoặc re-sync bỏ association.
- Cân nhắc tách `Distributor`/`TerritoryRelease` trong issue khác; không mở rộng ProductionCompany để chứa rights data.
- Upsert phải nằm trong transaction của `TMDB-FIX-02`.

---

## Related

- Branch: `feat/movie-multi-company`
- Depends on: `TMDB-FIX-01`, `TMDB-FIX-02`, database migration
- Closes: `#151`

---

# Update #152 — [Backend] Replace MovieImage image type strings with a media enum

**GitLab action:** Update existing issue `#152`; do not create duplicate  
**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::Medium`

## Summary / Objective

`MovieImage.imageType` đang dùng String tự do, làm TMDB media ingestion có thể tạo giá trị sai hoặc không nhất quán. Hoàn tất enum migration trước khi import poster/backdrop/still và thống nhất validation giữa entity, request, response và mapper.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có enum tối thiểu `POSTER`, `BACKDROP`, `STILL`, `PROMOTIONAL`; quyết định rõ có cần `LOGO` trước khi migration.
- [ ] Entity dùng `@Enumerated(EnumType.STRING)` và column length phù hợp.
- [ ] Request validation từ chối unknown value bằng `400` domain error, không phát sinh `500`.
- [ ] Response serialize enum thành canonical uppercase string.
- [ ] Existing mixed-case/invalid data được audit và normalize trước khi enable strict mapping.
- [ ] Database có CHECK constraint hoặc equivalent nếu migration strategy cho phép.
- [ ] TMDB media mapper dùng enum, không hard-code String tại nhiều nơi.
- [ ] Tests cover valid types, invalid type, legacy mixed case và JSON serialization.

---

## Technical Notes / Constraints

- Nếu import TMDB logo thì thêm `LOGO` theo migration/API contract; không map logo thành `PROMOTIONAL` tùy tiện.
- Giữ enum domain độc lập với raw type từ external provider.
- Đây là dependency bắt buộc trước `TMDB-FIX-05`.

---

## Related

- Branch: `chore/movie-image-type-enum`
- Depends on: current `movie_image` data audit
- Blocks: `TMDB-FIX-05`
- Closes: `#152`

---

## 2. Thứ tự triển khai đề xuất

1. `TMDB-FIX-01` — loại bỏ write side effect khỏi GET preview.
2. `TMDB-FIX-02` — hợp nhất mapping/import pipeline.
3. `TMDB-FIX-03` — không silent-drop genre.
4. Update `#151`, `#152` — chuẩn hóa company và media schema.
5. `TMDB-FIX-04`, `TMDB-FIX-05`, update `#150` — hoàn thiện trailer, image và tagline.
6. `TMDB-FIX-07` — xác minh release/rating Việt Nam.
7. `TMDB-FIX-06` — provenance và safe re-sync.
8. `TMDB-FIX-08` — client resilience.
9. `TMDB-FIX-10` — frontend review workflow.
10. `TMDB-FIX-09` được bổ sung theo từng MR và hoàn tất trước khi đóng epic.

## 3. Quy tắc trạng thái

- Issue mới giữ `Open` khi mới tạo/assign.
- Assignee tự chuyển `In Progress` khi đã đọc Acceptance Criteria, tạo branch và bắt đầu code.
- Chỉ chuyển `Review/ QA` khi có MR, self-review và bằng chứng test.
- Chỉ `Closed` khi toàn bộ Acceptance Criteria pass và thay đổi đã merge.
- Issue `#150–#152` đang tồn tại thì cập nhật description; không tạo bản sao chỉ vì scope được làm rõ.

## 4. Verification baseline

- `mvnw.cmd -pl movie-service -am test -DskipTests`: pass ngày 2026-07-15.
- `mvnw.cmd -pl movie-service -am test`: 4 tests pass ngày 2026-07-15.
- Chưa có test class cho `TmdbService`; trạng thái test xanh hiện tại không chứng minh TMDB ingestion đúng.
