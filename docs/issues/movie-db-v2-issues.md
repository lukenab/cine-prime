# Issues — Movie DB v2 Redesign
> Tất cả issues phát sinh sau khi redesign `movie_db.sql` → `movie_db_v2.sql`
> Tổng: **9 issues** | DB: 1 · Backend: 6 · Frontend: 1 · Docs: 1

---

## Issue 1

**Title:** `[Database] Replace movie_db schema with enterprise-grade v2`

**Labels:** `Layer::Database` · `Type::Chore` · `Priority::High`

```markdown
## Summary / Objective

Schema v1 có nhiều lỗ hổng nghiệp vụ: status dạng BOOLEAN/INTEGER không kiểm soát được vòng
đời phim, diễn viên/đạo diễn/hãng phim lưu free-text gây trùng lặp, không hỗ trợ đa ngôn
ngữ, thiếu audit fields và lịch sử bảo trì phòng chiếu. v2 giải quyết toàn bộ các vấn đề
này theo chuẩn enterprise cinema.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] File `server/postgres-init/movie_db_v2.sql` thay thế `movie_db.sql` và chạy thành công
      khi `docker-compose up` (postgres-init container)
- [ ] Extension `btree_gist` được enable (cần cho EXCLUDE constraint chống trùng giờ)
- [ ] 16 bảng được tạo đúng thứ tự dependency (lookup tables trước, junction tables sau)
- [ ] Seed data cho `genre` (15 thể loại), `age_rating` (6 mức), `screening_format` (6 định dạng)
      được insert thành công
- [ ] `EXCLUDE USING GIST` trên `show_time` hoạt động: thử INSERT 2 suất cùng phòng trùng giờ
      → DB trả lỗi constraint violation
- [ ] Trigger `set_updated_at()` hoạt động: UPDATE bất kỳ bảng có `updated_at` → cột tự cập nhật

---

## Technical Notes / Constraints

- Chạy `CREATE EXTENSION IF NOT EXISTS btree_gist;` TRƯỚC khi tạo bảng `show_time`
- Bảng `type` (reserved SQL word) được đổi thành `genre` — Java entity `MovieType` cần
  update `@Table(name = "genre")`
- `movie_movie_types` → `movie_genre` — cần update `@JoinTable` trong Movie entity
- Tham khảo Migration Notes cuối file `movie_db_v2.sql` để biết câu lệnh UPDATE data khi
  migrate từ v1

---

## Related

- Branch: `chore/movie-db-v2-schema`
- Depends on: Không
- Docs: `server/postgres-init/movie_db_v2.sql`, `docs/db/movie_db_v2.dbml`
```

---

## Issue 2

**Title:** `[Backend] Refactor Movie entity and related lookup entities to match DB v2`

**Labels:** `Layer::Backend` · `Type::Chore` · `Priority::High`

```markdown
## Summary / Objective

DB v2 tách `actor`/`director`/`movie_production_company` (free-text) và `version` (string)
thành các bảng riêng. Cần tạo mới các entity tương ứng và refactor `Movie` entity để phản
ánh đúng schema mới, bao gồm status enum, audit fields, và quan hệ với các bảng lookup.

---

## Estimate

- [ ] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo mới entity: `Genre`, `AgeRating`, `ScreeningFormat`, `ProductionCompany`
- [ ] Tạo mới entity: `Person`, `MovieCast`, `MovieTranslation`, `MovieFormat`, `MovieGenre`
- [ ] `Movie` entity:
  - [ ] `Boolean status` → `String status` (hoặc enum `MovieStatus`)
  - [ ] Xóa field `actor`, `director`, `movieProductionCompany`, `version`
  - [ ] Xóa field `movieNameVn`, `movieNameEnglish` (chuyển sang `MovieTranslation`)
  - [ ] Thêm: `originalTitle`, `originalLanguage`, `tmdbId`, `imdbId`, `releaseDate`
  - [ ] Thêm: `ageRating` (FK), `company` (FK), `suspendedReason`
  - [ ] Thêm: `createdBy`, `updatedBy`
  - [ ] Sửa typo: `createAt` → `createdAt`
  - [ ] `@SQLRestriction("status = true")` → `@SQLRestriction("status NOT IN ('DRAFT','ENDED','SUSPENDED')")`
- [ ] `@Table(name = "type")` → `@Table(name = "genre")` trong `Genre` entity
- [ ] `@JoinTable(name = "movie_movie_types")` → `@JoinTable(name = "movie_genre")`
- [ ] Tất cả repository/service compile không lỗi sau refactor

---

## Technical Notes / Constraints

- Dùng `@Enumerated(EnumType.STRING)` cho status — KHÔNG dùng ORDINAL
- `MovieTranslation` dùng `@EmbeddedId` với `MovieTranslationId(movieId, languageCode)`
- `MovieCast` có `billingOrder` để sort theo thứ tự credit
- `@SQLRestriction` mới cần test kỹ — đảm bảo admin query (không filter status) dùng
  `EntityManager.createNativeQuery` hoặc tắt filter

---

## Related

- Branch: `feat/movie-entity-refactor-v2`
- Depends on: Issue #1 (DB schema)
- Docs: `server/postgres-init/movie_db_v2.sql`
```

---

## Issue 3

**Title:** `[Backend] Refactor CinemaRoom and Seat entities to match DB v2`

**Labels:** `Layer::Backend` · `Type::Chore` · `Priority::High`

```markdown
## Summary / Objective

`CinemaRoom.status` đang là `Boolean`, không phân biệt được MAINTENANCE vs TEMPORARILY_UNAVAILABLE.
`Seat.seatStatus` đang là `Integer`. Cần chuyển cả hai sang VARCHAR enum và tạo thêm entity
`CinemaRoomMaintenance` để track lịch sử sự cố phòng chiếu.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `CinemaRoom` entity:
  - [ ] `Boolean status` → `String status` với giá trị: `ACTIVE | MAINTENANCE | TEMPORARILY_UNAVAILABLE | CLOSED`
  - [ ] Thêm field: `roomType` (map từ `RoomType` enum — đã có trong Java nhưng thiếu trong SQL cũ)
  - [ ] Thêm field: `maintenanceNote`, `createdBy`, `updatedBy`
  - [ ] `seat_quantity` → `totalSeatCapacity`
- [ ] Tạo mới entity `CinemaRoomMaintenance` với các field:
      `reason`, `severity`, `startedAt`, `resolvedAt`, `resolved`, `resolutionNote`, `createdBy`
- [ ] `Seat` entity:
  - [ ] `Integer seatStatus` → `String status` với giá trị: `ACTIVE | INACTIVE | MAINTENANCE`
  - [ ] Thêm field: `rowLabel`, `colNumber` (dùng để render layout map trên frontend)
  - [ ] `seat_code VARCHAR(255)` → `VARCHAR(10)`
  - [ ] `seat_type VARCHAR(255)` → CHECK constraint: `STANDARD | VIP | COUPLE | SWEETBOX`
- [ ] Service layer: khi tạo `CinemaRoomMaintenance` mới → tự động set `cinema_room.status`
      thành `TEMPORARILY_UNAVAILABLE`

---

## Technical Notes / Constraints

- `rowLabel` + `colNumber` là composite unique key trong DB — dùng `@Table(uniqueConstraints)`
- `severity` enum: `LOW | MEDIUM | HIGH | CRITICAL` — dùng `@Enumerated(EnumType.STRING)`

---

## Related

- Branch: `feat/cinema-room-seat-refactor-v2`
- Depends on: Issue #1 (DB schema)
- Docs: `server/postgres-init/movie_db_v2.sql`
```

---

## Issue 4

**Title:** `[Backend] Refactor ShowTime and ShowtimeSeat entities to match DB v2`

**Labels:** `Layer::Backend` · `Type::Chore` · `Priority::High`

```markdown
## Summary / Objective

`ShowTime.status` đang là `Integer` với giá trị không rõ nghĩa. `ShowtimeSeat` thiếu trạng
thái `BLOCKED` và `CANCELLED`. Cần refactor cả hai entity để phản ánh đúng vòng đời suất
chiếu, thêm thông tin ngôn ngữ/phụ đề, tracking hủy suất, và liên kết với booking-service.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `ShowTime` entity:
  - [ ] `Integer status` → `String status`: `SCHEDULED | ON_SALE | CANCELLED | COMPLETED | SUSPENDED`
  - [ ] Sửa typo: `update_at` → `updatedAt`
  - [ ] Thêm: `formatId` (FK → `ScreeningFormat`), `languageCode`, `subtitleCode`
  - [ ] Thêm: `cancellationReason`, `cancelledAt`, `cancelledBy`
  - [ ] Thêm: `createdBy`, `updatedBy`
  - [ ] `ON DELETE CASCADE` trên `movie_id` → `ON DELETE RESTRICT` (đổi ở cả DB và entity)
- [ ] `ShowtimeSeat` entity:
  - [ ] `SeatStatus` enum thêm: `BLOCKED`, `CANCELLED`
  - [ ] Thêm field: `bookingId` (String, cross-service UUID — không phải FK)
  - [ ] Default `seat_type` sửa `'NORMAL'` → `'STANDARD'`
- [ ] Service: khi `ShowTime.status` chuyển `CANCELLED` → tất cả `ShowtimeSeat` liên quan
      tự động chuyển thành `CANCELLED`
- [ ] Service: khi `Movie.status` chuyển `SUSPENDED` → tất cả suất `SCHEDULED/ON_SALE`
      của phim đó chuyển thành `SUSPENDED`

---

## Technical Notes / Constraints

- `bookingId` trong `ShowtimeSeat` là cross-database reference → KHÔNG dùng `@ManyToOne`,
  chỉ lưu UUID dạng String
- DB level đã có EXCLUDE USING GIST chống trùng giờ — service layer thêm validation rõ
  ràng để trả error message thân thiện cho admin thay vì lộ DB constraint error

---

## Related

- Branch: `feat/showtime-entity-refactor-v2`
- Depends on: Issue #1, Issue #3
- Docs: `server/postgres-init/movie_db_v2.sql`
```

---

## Issue 5

**Title:** `[Backend] Implement movie lifecycle management API with review/approval workflow`

**Labels:** `Layer::Backend` · `Type::Feature` · `Priority::High`

```markdown
## Summary / Objective

DB v2 định nghĩa vòng đời phim qua 7 trạng thái có review workflow: EMPLOYEE tạo phim và
submit lên PENDING_REVIEW, ADMIN duyệt hoặc từ chối. Chỉ sau khi được approve, phim mới
được hiển thị và tạo suất chiếu. Cần implement state machine validation chặt chẽ theo
phân quyền EMPLOYEE/ADMIN.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `PATCH /api/movies/{id}/status` — chuyển trạng thái, body: `{status, reason?}`
- [ ] State machine — EMPLOYEE chỉ được:
  - [ ] `DRAFT` → `PENDING_REVIEW` (submit để duyệt)
  - [ ] `REJECTED` → `DRAFT` (kéo về để sửa lại)
- [ ] State machine — ADMIN được:
  - [ ] `PENDING_REVIEW` → `COMING_SOON` hoặc `NOW_SHOWING` (approve)
  - [ ] `PENDING_REVIEW` → `REJECTED` (`rejectionNote` bắt buộc)
  - [ ] `COMING_SOON` → `NOW_SHOWING` hoặc `SUSPENDED`
  - [ ] `NOW_SHOWING` → `SUSPENDED` hoặc `ENDED`
  - [ ] `SUSPENDED` → `NOW_SHOWING` hoặc `ENDED`
  - [ ] `ENDED` → không thể chuyển tiếp (terminal state)
- [ ] Transition không hợp lệ → trả 400 với message rõ ràng (không lộ stack trace)
- [ ] Khi `REJECTED`: field `rejection_note` được lưu vào DB, EMPLOYEE đọc được qua
      `GET /api/movies/{id}`
- [ ] Khi `SUSPENDED`: `suspendedReason` bắt buộc, tất cả suất `SCHEDULED/ON_SALE`
      tự động chuyển thành `SUSPENDED`
- [ ] Khi `ENDED`: tất cả suất `SCHEDULED/ON_SALE` tự động chuyển thành `CANCELLED`
- [ ] Mọi lần thay đổi status đều được ghi vào `movie_action_log`
      (old_status, new_status, account_id, note)
- [ ] EMPLOYEE không thể approve phim của chính mình (validate `created_by != currentUser`
      nếu currentUser không phải ADMIN)

---

## API Specifications

### API 1 — Submit for Review (EMPLOYEE)

| Field | Details |
|---|---|
| Method | `PATCH` |
| Endpoint | `/api/movies/{id}/status` |
| Description | EMPLOYEE submit phim lên để ADMIN duyệt |
| Auth Required | Yes (EMPLOYEE hoặc ADMIN) |

**Request Body:**
```json
{ "status": "PENDING_REVIEW" }
```

**Response 200 OK:**
```json
{
  "movieId": 1,
  "previousStatus": "DRAFT",
  "currentStatus": "PENDING_REVIEW",
  "affectedShowtimes": 0
}
```

### API 2 — Approve (ADMIN)

**Request Body:**
```json
{ "status": "COMING_SOON" }
```

### API 3 — Reject (ADMIN)

**Request Body:**
```json
{
  "status": "REJECTED",
  "reason": "Poster bị mờ, tên phim tiếng Việt bị sai chính tả ở đoạn 2"
}
```

**Response (Error — transition không hợp lệ):**
```json
{
  "code": 3001,
  "message": "Transition DRAFT → NOW_SHOWING không hợp lệ. EMPLOYEE chỉ được submit lên PENDING_REVIEW"
}
```

**Response (Error — thiếu lý do):**
```json
{
  "code": 3005,
  "message": "rejection_note là bắt buộc khi từ chối phim"
}
```

---

## Technical Notes / Constraints

- Implement State Machine bằng `Map<MovieStatus, Map<String, Set<MovieStatus>>>`:
  ```
  ALLOWED_TRANSITIONS = {
    DRAFT:           { EMPLOYEE: [PENDING_REVIEW], ADMIN: [PENDING_REVIEW] },
    PENDING_REVIEW:  { ADMIN: [COMING_SOON, NOW_SHOWING, REJECTED] },
    REJECTED:        { EMPLOYEE: [DRAFT], ADMIN: [DRAFT] },
    COMING_SOON:     { ADMIN: [NOW_SHOWING, SUSPENDED] },
    NOW_SHOWING:     { ADMIN: [SUSPENDED, ENDED] },
    SUSPENDED:       { ADMIN: [NOW_SHOWING, ENDED] },
    ENDED:           {}
  }
  ```
- `suspendedReason` và `rejectionNote` validate ở service layer (không phải DB CHECK)
- Cascade cancel/suspend showtime nên chạy trong cùng 1 transaction

---

## Related

- Branch: `feat/movie-lifecycle-api`
- Depends on: Issue #2
- Docs: `server/postgres-init/movie_db_v2.sql`
```

---

## Issue 6

**Title:** `[Backend] Implement TMDB integration — search and import movie data`

**Labels:** `Layer::Backend` · `Type::Feature` · `Priority::Medium`

```markdown
## Summary / Objective

Khi admin tạo phim mới, thay vì nhập tay toàn bộ thông tin, hệ thống cho phép tìm kiếm
phim trên TMDB và import về tự động: tên phim (đa ngôn ngữ), poster, cast, hãng sản xuất,
thời lượng, ngày phát hành. Admin chỉ cần bổ sung age_rating và screening_format.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `GET /api/movies/tmdb/search?q={query}` — tìm phim trên TMDB, trả danh sách kết quả
- [ ] `POST /api/movies/tmdb/import` — nhận `tmdbId`, import phim về DB:
  - [ ] Upsert `ProductionCompany` từ TMDB `production_companies[]`
  - [ ] Upsert `Person` từ TMDB `credits.cast[]` và `credits.crew[]`
  - [ ] Insert `Movie` với `status=DRAFT`, `tmdbId` được set
  - [ ] Insert `MovieTranslation` cho `vi` và `en` (từ TMDB `translations`)
  - [ ] Insert `MovieCast` với `billingOrder` từ TMDB `order` field
  - [ ] Insert `MovieFormat` default: `2D`
- [ ] Nếu `tmdbId` đã tồn tại trong DB → trả error `409 Conflict` thay vì duplicate
- [ ] `TMDB_API_KEY` được đọc từ environment variable, không hardcode

---

## API Specifications

### API 1 — Search TMDB

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/tmdb/search` |
| Description | Tìm kiếm phim trên TMDB API |
| Auth Required | Yes (ADMIN) |

**Response 200 OK:**
```json
{
  "results": [
    {
      "tmdbId": 299536,
      "title": "Avengers: Infinity War",
      "releaseDate": "2018-04-27",
      "posterUrl": "https://image.tmdb.org/t/p/w500/...",
      "overview": "..."
    }
  ]
}
```

### API 2 — Import from TMDB

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/movies/tmdb/import` |
| Description | Import phim từ TMDB vào DB với status=DRAFT |
| Auth Required | Yes (ADMIN) |

**Request Body:**
```json
{ "tmdbId": 299536 }
```

**Response 201 Created:**
```json
{
  "movieId": 42,
  "tmdbId": 299536,
  "originalTitle": "Avengers: Infinity War",
  "status": "DRAFT",
  "importedCastCount": 15,
  "importedCompanyCount": 2
}
```

---

## Technical Notes / Constraints

- Dùng `WebClient` (reactive) hoặc `RestTemplate` để gọi TMDB API
- Base URL: `https://api.themoviedb.org/3`
- Poster URL: `https://image.tmdb.org/t/p/w500/{poster_path}`
- Rate limit TMDB: 40 requests/10s — không cần xử lý đặc biệt với use case admin

---

## Related

- Branch: `feat/tmdb-integration`
- Depends on: Issue #2
- Docs: `docs/db/movie_db_v2.dbml`, TMDB API docs: https://developer.themoviedb.org/docs
```

---

## Issue 7

**Title:** `[Backend] Refactor CreateMovieRequest and movie CRUD APIs to match DB v2`

**Labels:** `Layer::Backend` · `Type::Chore` · `Priority::High`

```markdown
## Summary / Objective

`CreateMovieRequest` hiện tại nhận `director`, `actor`, `movieProductionCompany`, `version`
dưới dạng free-text String — không còn phù hợp với DB v2. Cần refactor toàn bộ request/
response DTOs và CRUD endpoints để nhận ID references và list thay vì free-text.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `CreateMovieRequest` bỏ: `movieNameVn`, `movieNameEnglish`, `director`, `actor`,
      `movieProductionCompany`, `version`
- [ ] `CreateMovieRequest` thêm:
  - [ ] `originalTitle` (required)
  - [ ] `originalLanguage` (default `"en"`)
  - [ ] `companyId` (Long, optional — FK → production_company)
  - [ ] `ageRatingId` (Integer, optional — FK → age_rating)
  - [ ] `formatIds` (List<Long> — FK → screening_format)
  - [ ] `genreIds` (List<Long> — FK → genre)
  - [ ] `castRequests` (List<CastRequest{personId, roleType, characterName, billingOrder}>)
  - [ ] `translations` (List<TranslationRequest{languageCode, title, synopsis}>)
- [ ] `MovieResponse` trả về đầy đủ: translations, cast list, genre list, format list
- [ ] `GET /api/movies` hỗ trợ filter: `?status=NOW_SHOWING&genreCode=action&date=2026-07-08`
- [ ] `GET /api/movies/{id}` trả về translation theo `Accept-Language` header hoặc
      query param `?lang=vi`

---

## API Specifications

### API 1 — Create Movie (manual)

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/movies` |
| Description | Tạo phim thủ công (không qua TMDB) |
| Auth Required | Yes (ADMIN) |

**Request Body:**
```json
{
  "originalTitle": "Lật Mặt 7",
  "originalLanguage": "vi",
  "durationMinutes": 128,
  "releaseDate": "2024-04-26",
  "ageRatingId": 3,
  "companyId": 5,
  "genreIds": [1, 4],
  "formatIds": [1, 2],
  "translations": [
    { "languageCode": "vi", "title": "Lật Mặt 7: Một Điều Ước", "synopsis": "..." },
    { "languageCode": "en", "title": "Face Off 7", "synopsis": "..." }
  ],
  "castRequests": [
    { "personId": 10, "roleType": "DIRECTOR", "billingOrder": 1 },
    { "personId": 11, "roleType": "ACTOR", "characterName": "Hùng", "billingOrder": 1 }
  ]
}
```

---

## Technical Notes / Constraints

- Validate `genreIds`, `formatIds`, `ageRatingId`, `companyId` tồn tại trong DB trước khi
  insert — trả error rõ ràng nếu không tìm thấy
- `durationMinutes` validate: 1 ≤ value ≤ 600

---

## Related

- Branch: `feat/movie-crud-refactor-v2`
- Depends on: Issue #2, Issue #5
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`
```

---

## Issue 8

**Title:** `[Frontend] Update Create/Edit Movie UI — TMDB search, dropdowns, multi-language`

**Labels:** `Layer::Frontend` · `Type::Feature` · `Priority::Medium`

```markdown
## Summary / Objective

Form tạo/sửa phim hiện tại dùng text input cho diễn viên, đạo diễn, hãng phim, phiên bản.
Cần redesign toàn bộ form để khớp với API v2: tích hợp TMDB search, dùng dropdown cho các
lookup table, và hỗ trợ nhập thông tin đa ngôn ngữ (vi/en).

---

## Estimate

- [ ] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Nút "Import từ TMDB": mở modal search → chọn phim → form auto-fill toàn bộ
- [ ] Dropdown (gọi API lấy options): `Thể loại` (multi-select), `Định dạng chiếu` (multi-select),
      `Phân loại độ tuổi` (single), `Hãng sản xuất` (single + search)
- [ ] Section Cast/Crew: search người theo tên → chọn → gán role (ACTOR/DIRECTOR/WRITER…)
      → kéo thả để sắp xếp billing order
- [ ] Tab ngôn ngữ: Tiếng Việt / English — mỗi tab có `title` và `synopsis` riêng
- [ ] Dropdown Status: chỉ hiển thị các transition hợp lệ từ trạng thái hiện tại
      (DRAFT không có option ENDED)
- [ ] Validate `durationMinutes`: 1–600, hiển thị preview "2 giờ 8 phút"
- [ ] Loading state khi gọi TMDB search (debounce 400ms)
- [ ] Tất cả field bắt buộc được highlight khi submit thiếu

---

## UI Reference / Mockup

Tham khảo layout: MoMo Cinema / CGV admin panel
- Panel trái: thông tin cơ bản + media
- Panel phải: cast, genre, format
- Tab trên cùng: Tiếng Việt | English

---

## Technical Notes / Constraints

- TMDB search gọi qua backend (`/api/movies/tmdb/search`) — không gọi trực tiếp từ FE
  (tránh lộ API key)
- Dùng `react-beautiful-dnd` hoặc `@dnd-kit/core` cho drag-drop billing order
- Dropdown `Hãng sản xuất` dùng async search (gõ ≥ 2 ký tự mới gọi API)

---

## Related

- Branch: `feat/admin-create-movie-ui-v2`
- Depends on: Issue #6, Issue #7
- Docs: `docs/db/movie_db_v2.dbml`
```

---

## Issue 9

**Title:** `[Docs] Update movie-service API_CONTRACT.md to reflect DB v2 and new endpoints`

**Labels:** `Layer::Docs` · `Type::Docs` · `Priority::Medium`

```markdown
## Summary / Objective

API_CONTRACT.md của movie-service (nếu có) hoặc cần tạo mới, phải phản ánh đúng toàn bộ
thay đổi từ DB v2: DTO mới, status enum, lifecycle endpoints, TMDB import endpoints, và
lookup endpoints cho dropdown data.

---

## Estimate

- [ ] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo/cập nhật `docs/api-specs/movie-service/API_CONTRACT.md`
- [ ] Document đầy đủ các endpoint mới:
  - [ ] `GET /api/genres` — list thể loại
  - [ ] `GET /api/age-ratings` — list phân loại độ tuổi
  - [ ] `GET /api/screening-formats` — list định dạng chiếu
  - [ ] `GET /api/companies/search?q=` — tìm hãng phim (local + TMDB)
  - [ ] `GET /api/persons/search?q=` — tìm diễn viên/đạo diễn (local + TMDB)
  - [ ] `GET /api/movies/tmdb/search?q=` — tìm phim trên TMDB
  - [ ] `POST /api/movies/tmdb/import` — import phim từ TMDB
  - [ ] `PATCH /api/movies/{id}/status` — chuyển trạng thái phim
  - [ ] `POST /api/movies` — tạo phim thủ công (DTO mới)
  - [ ] `PUT /api/movies/{id}` — cập nhật phim (DTO mới)
- [ ] Error code table thêm: 3001 (invalid status transition), 3002 (tmdb_id already exists),
      3003 (duration out of range), 3004 (invalid genre/format/rating id)
- [ ] DB Schema section cập nhật theo v2 (16 bảng)
- [ ] Version bump lên v1.0.0 (nếu chưa có contract) hoặc next minor

---

## Technical Notes / Constraints

- Theo format của `auth-service/API_CONTRACT.md` và `user-service/API_CONTRACT.md`

---

## Related

- Branch: `docs/movie-service-api-contract`
- Depends on: Issue #7
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md` (tham khảo format)
```

---

## Thứ tự triển khai

```
Issue #1 (DB Schema)
    ↓
Issue #2 (Movie entities) ──→ Issue #5 (Lifecycle API)
Issue #3 (Room/Seat entities)         ↓
Issue #4 (ShowTime entities)  Issue #6 (TMDB Integration)
    ↓                                 ↓
    └──────────────→ Issue #7 (CRUD DTOs) ──→ Issue #8 (Frontend)
                                      ↓
                               Issue #9 (Docs)
```
