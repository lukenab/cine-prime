# Movie Service — Module Overview (Sprint 3)

> Tài liệu đặc tả kỹ thuật chi tiết: từng package, từng class, từng hàm, DB diff vs Sprint 1, BR diff.
> Cập nhật lần cuối: Sprint 3 (07/2026)

---

## 1. Mục đích module

`movie-service` là microservice trung tâm của hệ thống CinePrime. Chịu trách nhiệm:

- Quản lý vòng đời phim: tạo → phê duyệt → chiếu → kết thúc (7 trạng thái).
- Import phim từ TMDB API.
- Quản lý lookup data: Genre, AgeRating, ScreeningFormat, Person, ProductionCompany.
- Quản lý cơ sở vật chất: CinemaCluster, CinemaRoom, Seat, bảo trì.
- Tạo và quản lý suất chiếu (ShowTime) và ghế suất chiếu (ShowtimeSeat).
- Upload ảnh phim lên Cloudinary.
- Cung cấp API cho booking-service (lock ghế, kiểm tra suất tương lai).

Port mặc định: **8082** · Base path: `/api` · Giao tiếp: REST (đồng bộ), không dùng message broker.

---

## 2. Cấu trúc package

```
movieservice/
├── config/
│   ├── AuditConfig.java              — Bật @EnableJpaAuditing
│   ├── CloudinaryConfig.java         — Bean Cloudinary từ application.yml
│   └── SecurityConfig.java           — Spring Security: JWT filter, endpoint rules
│
├── controller/                        — REST layer (13 controllers)
│   ├── MovieController.java
│   ├── ScheduleController.java
│   ├── ShowTimeController.java        — Seat lock/view (legacy path /api/showtimes)
│   ├── TmdbController.java
│   ├── CinemaClusterController.java
│   ├── CinemaRoomController.java
│   ├── MovieImageController.java
│   ├── PersonController.java
│   ├── ProductionCompanyController.java
│   ├── AgeRatingController.java
│   ├── GenreController.java
│   ├── ScreeningFormatController.java
│   └── SeatController.java
│
├── dto/
│   ├── request/                       — 17 request DTOs
│   ├── response/                      — 19 response DTOs
│   └── tmdb/                          — 5 TMDB API response DTOs
│
├── entity/                            — 19 JPA entities
├── enums/                             — 10 enums
├── exception/                         — MovieErrorCode (27 codes) + wrappers
├── mapper/                            — MovieMapper (MapStruct)
├── repository/                        — 16 JPA repositories
├── scheduler/                         — MovieScheduler (@Scheduled)
├── service/                           — 8 service classes
│   └── impl/
│       └── CloudinaryImageStorageService.java
└── validator/                         — @ValidProvince + ProvinceValidator
```

---

## 3. Entity Catalog

### 3.1 Movie

**Bảng:** `movie`

| Column | Type | Constraint | Ghi chú |
|--------|------|-----------|---------|
| movie_id | BIGSERIAL | PK | Auto-increment |
| tmdb_id | INTEGER | UNIQUE, nullable | ID từ TMDB |
| imdb_id | VARCHAR(20) | UNIQUE, nullable | ID từ IMDb |
| original_title | VARCHAR(500) | NOT NULL | Tên gốc |
| original_language | VARCHAR(2) | NOT NULL, default `en` | ISO 639-1 |
| duration_minutes | INTEGER | NOT NULL | Thời lượng phút |
| release_date | DATE | nullable | Ngày khởi chiếu |
| end_date | DATE | nullable | Ngày kết thúc chiếu |
| age_rating_id | BIGINT | FK → age_rating, nullable | |
| company_id | BIGINT | FK → production_company, nullable | Chỉ 1 công ty (gap #151) |
| country | VARCHAR(100) | nullable | Quốc gia sản xuất |
| poster_url | VARCHAR(500) | nullable | |
| thumbnail_url | VARCHAR(500) | nullable | |
| trailer_url | VARCHAR(500) | nullable | |
| synopsis | TEXT | nullable | |
| status | VARCHAR(20) | NOT NULL, default DRAFT | Enum MovieStatus |
| suspended_reason | TEXT | nullable | Lý do tạm dừng |
| rejection_note | TEXT | nullable | Ghi chú từ chối |
| created_at | TIMESTAMP | updatable=false | @PrePersist |
| updated_at | TIMESTAMP | | @PreUpdate |
| created_by | VARCHAR(100) | nullable | |
| updated_by | VARCHAR(100) | nullable | |

**Relationships:**
- `@ManyToOne` → `AgeRating` (LAZY)
- `@ManyToOne` → `ProductionCompany` (LAZY)
- `@ManyToMany` → `Genre` (join table `movie_genre`)
- `@ManyToMany` → `ScreeningFormat` (join table `movie_format`)
- `@OneToMany(cascade=ALL, orphanRemoval=true)` → `MovieTranslation`
- `@OneToMany(cascade=ALL, orphanRemoval=true)` → `MovieCast`
- `@OneToMany(cascade=ALL, orphanRemoval=true, @OrderBy displayOrder ASC)` → `MovieImage`
- `@OneToMany(LAZY)` → `ShowTime`

**Lifecycle hooks:**
- `@PrePersist`: set `createdAt = updatedAt = now()`, default `status = DRAFT`
- `@PreUpdate`: set `updatedAt = now()`

---

### 3.2 MovieTranslation

**Bảng:** `movie_translation` · **PK:** composite `(movie_id, language_code)`

| Column | Type | Constraint |
|--------|------|-----------|
| movie_id | BIGINT | PK, FK → movie |
| language_code | VARCHAR(2) | PK — ISO 639-1 (gap #153: nên là BCP-47 length 5) |
| title | VARCHAR(500) | NOT NULL |
| synopsis | TEXT | nullable |
| created_at | TIMESTAMP | @PrePersist |

**Embedded PK:** `MovieTranslationId` implements `Serializable`

---

### 3.3 MovieCast

**Bảng:** `movie_cast`
**Unique constraint:** `(movie_id, person_id, role_type)`

| Column | Type | Constraint |
|--------|------|-----------|
| cast_id | BIGSERIAL | PK |
| movie_id | BIGINT | FK → movie, NOT NULL |
| person_id | BIGINT | FK → person, NOT NULL |
| role_type | VARCHAR(20) | NOT NULL — String, giá trị: ACTOR / DIRECTOR / WRITER / PRODUCER / COMPOSER (gap #142: nên là enum) |
| character_name | VARCHAR(255) | nullable — chỉ điền cho ACTOR |
| billing_order | INTEGER | nullable — thứ tự trong credit |

---

### 3.4 MovieImage

**Bảng:** `movie_image`

| Column | Type | Constraint |
|--------|------|-----------|
| image_id | BIGSERIAL | PK |
| movie_id | BIGINT | FK → movie, NOT NULL |
| image_url | VARCHAR(500) | NOT NULL |
| image_type | VARCHAR(30) | NOT NULL — String, giá trị: POSTER / BACKDROP / STILL / PROMOTIONAL (gap #152: nên là enum) |
| display_order | INTEGER | nullable |
| caption | VARCHAR(255) | nullable |
| created_at | TIMESTAMP | @PrePersist |

---

### 3.5 Genre

**Bảng:** `genre`

| Column | Type | Constraint |
|--------|------|-----------|
| genre_id | BIGSERIAL | PK |
| genre_name | VARCHAR(100) | NOT NULL, UNIQUE |
| genre_code | VARCHAR(50) | NOT NULL, UNIQUE — auto-slug từ tên (NFD normalize + uppercase) |
| created_at | TIMESTAMP | nullable |

**Relationship:** `@ManyToMany(mappedBy="genres")` ← `Movie`

---

### 3.6 AgeRating

**Bảng:** `age_rating`

| Column | Type | Constraint |
|--------|------|-----------|
| rating_id | INTEGER | PK (SERIAL) |
| rating_code | VARCHAR(5) | NOT NULL, UNIQUE — P / K / T13 / T16 / T18 / C |
| min_age | INTEGER | NOT NULL |
| description | VARCHAR(255) | NOT NULL |

---

### 3.7 ScreeningFormat

**Bảng:** `screening_format`

| Column | Type | Constraint |
|--------|------|-----------|
| format_id | INTEGER | PK (SERIAL) |
| format_code | VARCHAR(20) | NOT NULL, UNIQUE — 2D / 3D / IMAX / 4DX / SCREENX / ATMOS |
| format_name | VARCHAR(100) | NOT NULL |
| description | VARCHAR(255) | nullable |
| surcharge | DECIMAL(10,2) | NOT NULL — phụ phí so với giá cơ bản |

---

### 3.8 ProductionCompany

**Bảng:** `production_company`

| Column | Type | Constraint |
|--------|------|-----------|
| company_id | BIGSERIAL | PK |
| name | VARCHAR(255) | NOT NULL, UNIQUE |
| country | VARCHAR(100) | nullable |
| logo_url | VARCHAR(500) | nullable |
| website_url | VARCHAR(500) | nullable |
| created_at | TIMESTAMP | nullable |

**Gap #151:** Movie chỉ có 1 FK `company_id` → chỉ lưu 1 công ty. Thực tế phim có nhiều production company — cần refactor sang `@ManyToMany` với join table `movie_production_company`.

---

### 3.9 Person

**Bảng:** `person`

| Column | Type | Constraint |
|--------|------|-----------|
| person_id | BIGSERIAL | PK |
| full_name | VARCHAR(255) | NOT NULL |
| birth_date | DATE | nullable |
| nationality | VARCHAR(100) | nullable |
| photo_url | VARCHAR(500) | nullable |
| biography | TEXT | nullable |
| tmdb_id | INTEGER | UNIQUE, nullable |
| created_at | TIMESTAMP | updatable=false |
| updated_at | TIMESTAMP | |

**Gap #154:** Thiếu `gender`, `known_for_department`, `death_date`, `place_of_birth` (so với TMDB Person schema chuẩn).

---

### 3.10 CinemaCluster

**Bảng:** `cinema_cluster`

| Column | Type | Constraint |
|--------|------|-----------|
| cluster_id | BIGSERIAL | PK |
| cluster_name | VARCHAR(100) | NOT NULL |
| province | VARCHAR(100) | NOT NULL — validated by @ValidProvince |
| address | VARCHAR(255) | NOT NULL |
| phone_number | VARCHAR(20) | nullable |
| latitude | DECIMAL(10,7) | nullable |
| longitude | DECIMAL(10,7) | nullable |
| status | VARCHAR(20) | NOT NULL, default DRAFT — Enum ClusterStatus |
| rejection_note | TEXT | nullable |
| created_at | TIMESTAMP | updatable=false, @PrePersist |
| updated_at | TIMESTAMP | @PreUpdate |

**Gap #146:** Thiếu `created_by` và `updated_by` (audit trail về actor).

**Relationships:** `@OneToMany(LAZY)` → `CinemaRoom`

**Workflow:** DRAFT → PENDING_REVIEW → ACTIVE / DRAFT. ACTIVE ↔ INACTIVE.

---

### 3.11 CinemaRoom

**Bảng:** `cinema_room`

| Column | Type | Constraint |
|--------|------|-----------|
| cinema_room_id | BIGSERIAL | PK |
| cinema_room_name | VARCHAR(100) | NOT NULL, UNIQUE per cluster (uq_room_name_per_cluster) |
| room_type | VARCHAR(20) | NOT NULL — Enum RoomType: STANDARD / LARGE / IMAX |
| total_seat_capacity | INTEGER | NOT NULL — = number_of_rows × seats_per_row, tính ở server (V13), không nhận trực tiếp từ client |
| number_of_rows | INTEGER | NOT NULL (V13) — admin chọn lúc tạo phòng |
| seats_per_row | INTEGER | NOT NULL (V13) — admin chọn lúc tạo phòng, RoomType chỉ gợi ý mặc định |
| status | VARCHAR(30) | NOT NULL, default ACTIVE — Enum CinemaRoomStatus |
| maintenance_note | TEXT | nullable |
| created_by | VARCHAR(100) | nullable |
| updated_by | VARCHAR(100) | nullable |
| created_at | TIMESTAMP | @PrePersist |
| updated_at | TIMESTAMP | @PreUpdate |
| cluster_id | BIGINT | FK → cinema_cluster, nullable |

**Relationships:**
- `@ManyToOne(LAZY)` → `CinemaCluster`
- `@OneToMany(LAZY)` → `Seat`
- `@OneToMany(LAZY)` → `ShowTime`
- `@OneToMany(cascade=ALL, orphanRemoval=true)` → `CinemaRoomMaintenance`

**Gap #144 (resolved, V7):** `cinema_room_name` giờ UNIQUE theo `(cluster_id, cinema_room_name)` thay vì global.

---

### 3.12 Seat

**Bảng:** `seat`
**Unique constraint:** `uk_seat_room_position (cinema_room_id, row_label, col_number)`

| Column | Type | Constraint |
|--------|------|-----------|
| seat_id | BIGSERIAL | PK |
| seat_code | VARCHAR(10) | NOT NULL — e.g. "A1", "B12" |
| row_label | VARCHAR(3) | NOT NULL — A, B, C... |
| col_number | INTEGER | NOT NULL — 1, 2, 3... |
| seat_type | VARCHAR(20) | NOT NULL, default STANDARD — Enum SeatType |
| status | VARCHAR(20) | NOT NULL, default ACTIVE — Enum SeatStatus |
| cinema_room_id | BIGINT | FK → cinema_room, NOT NULL |
| base_price | DECIMAL(10,2) | NOT NULL |
| created_at | TIMESTAMP | @PrePersist |
| updated_at | TIMESTAMP | @PreUpdate |

---

### 3.13 CinemaRoomMaintenance

**Bảng:** `cinema_room_maintenance`

| Column | Type | Constraint |
|--------|------|-----------|
| maintenance_id | BIGSERIAL | PK |
| cinema_room_id | BIGINT | FK → cinema_room, NOT NULL |
| reason | TEXT | NOT NULL |
| severity | VARCHAR(10) | NOT NULL — Enum MaintenanceSeverity: LOW/MEDIUM/HIGH/CRITICAL |
| started_at | TIMESTAMP | NOT NULL |
| resolved_at | TIMESTAMP | nullable |
| resolved | BOOLEAN | NOT NULL, default false |
| resolution_note | TEXT | nullable |
| created_by | VARCHAR(100) | nullable |
| created_at | TIMESTAMP | @PrePersist |

---

### 3.14 ShowTime

**Bảng:** `show_time`

| Column | Type | Constraint |
|--------|------|-----------|
| showtime_id | BIGSERIAL | PK |
| movie_id | BIGINT | FK → movie, NOT NULL |
| cinema_room_id | BIGINT | FK → cinema_room, NOT NULL |
| format_id | INTEGER | FK → screening_format, nullable |
| show_date | DATE | NOT NULL |
| start_time | TIME | NOT NULL |
| end_time | TIME | NOT NULL — tính tự động: startTime + movie.durationMinutes |
| language_code | VARCHAR(10) | default "vi" |
| subtitle_code | VARCHAR(10) | nullable |
| status | VARCHAR(20) | NOT NULL, default SCHEDULED — Enum ShowTimeStatus |
| total_seats | INTEGER | nullable — snapshot capacity |
| sold_seats | INTEGER | default 0 |
| cancellation_reason | TEXT | nullable |
| cancelled_at | TIMESTAMP | nullable |
| cancelled_by | VARCHAR(100) | nullable |
| created_by | VARCHAR(100) | nullable |
| updated_by | VARCHAR(100) | nullable |
| created_at | TIMESTAMP | @PrePersist |
| updated_at | TIMESTAMP | @PreUpdate |

**Business rule:** `showDate >= today + 3 days` · `startTime ∈ [08:00, 23:00)` · `endTime <= 23:00`

---

### 3.15 ShowtimeSeat

**Bảng:** `showtime_seat`
**Unique:** `uq_showtime_seat (showtime_id, seat_id)`
**Indexes:** `idx_ss_showtime`, `idx_ss_status (showtime_id, status)`, `idx_ss_booking (booking_id)`, `idx_ss_expires (reserved_expires_at)`

| Column | Type | Constraint |
|--------|------|-----------|
| showtime_seat_id | BIGSERIAL | PK |
| showtime_id | BIGINT | FK → show_time, NOT NULL |
| seat_id | BIGINT | FK → seat, NOT NULL |
| seat_code | VARCHAR(10) | NOT NULL — **snapshot** |
| seat_type | VARCHAR(20) | NOT NULL, default STANDARD — snapshot |
| price | DECIMAL(10,2) | NOT NULL — snapshot giá tại thời điểm tạo suất |
| status | VARCHAR(20) | NOT NULL, default AVAILABLE — Enum ShowtimeSeatStatus |
| reserved_at | TIMESTAMP | nullable |
| reserved_expires_at | TIMESTAMP | nullable — lock expire sau 15 phút |
| booking_id | VARCHAR(36) | nullable — UUID từ booking-service (cross-service, KHÔNG phải DB FK) |

**Khởi tạo lazy:** Các `ShowtimeSeat` chỉ được tạo khi client gọi `GET /api/showtimes/{id}/seats` lần đầu.

**Gap #145:** `lockSeats()` không dùng pessimistic lock → race condition khi nhiều user đặt ghế cùng lúc.

---

### 3.16 MovieActionLog

**Bảng:** `movie_action_log`

| Column | Type | Ghi chú |
|--------|------|---------|
| id | VARCHAR(36) | PK, UUID auto-gen |
| account_id | VARCHAR | Actor UUID |
| actor | VARCHAR | Tên actor |
| note | VARCHAR | Target resource, e.g. "movie:42" |
| action_description | VARCHAR | Mô tả hành động |
| timestamp | TIMESTAMP | |

**Gap #141:** Thiếu `action_type` enum — không phân loại được CREATE/UPDATE/DELETE/STATUS_CHANGE để filter log.

---

### 3.17 ClusterAuditLog

**Bảng:** `cluster_audit_log`

| Column | Type | Constraint |
|--------|------|-----------|
| log_id | VARCHAR(36) | PK, UUID |
| cluster_id | BIGINT | NOT NULL (không phải FK — tránh cascade delete xóa log) |
| action | VARCHAR(20) | NOT NULL — Enum ClusterAction |
| performed_by | VARCHAR(255) | nullable |
| old_status | VARCHAR(20) | nullable |
| new_status | VARCHAR(20) | nullable |
| note | TEXT | nullable |
| timestamp | TIMESTAMP | NOT NULL |

---

### 3.18 MovieScheduleConnect *(Embeddable)*

**Không phải entity riêng.** Là `@Embeddable` composite key cũ — hiện không được dùng tích cực trong code Sprint 3. Có thể là artifact từ Sprint 1.

| Field | Column | Type |
|-------|--------|------|
| movieId | movie_id | INTEGER |
| showTimeId | showtime_id | BIGINT |

---

## 4. Enum Catalog

| Enum | Giá trị | Dùng ở |
|------|---------|--------|
| `MovieStatus` | DRAFT, PENDING_REVIEW, REJECTED, COMING_SOON, NOW_SHOWING, SUSPENDED, ENDED | Movie.status |
| `ShowTimeStatus` | SCHEDULED, ON_SALE, CANCELLED, COMPLETED, SUSPENDED | ShowTime.status |
| `ShowtimeSeatStatus` | AVAILABLE, RESERVED, SOLD, BLOCKED, CANCELLED | ShowtimeSeat.status |
| `CinemaRoomStatus` | ACTIVE, MAINTENANCE, TEMPORARILY_UNAVAILABLE, CLOSED | CinemaRoom.status |
| `ClusterStatus` | DRAFT, PENDING_REVIEW, ACTIVE, INACTIVE | CinemaCluster.status |
| `ClusterAction` | CREATE, SUBMIT, APPROVE, REJECT, UPDATE, DEACTIVATE, REACTIVATE | ClusterAuditLog.action |
| `RoomType` | STANDARD(max=100, perRow=10), LARGE(max=200, perRow=10), IMAX(max=300, perRow=15) | CinemaRoom.roomType |
| `SeatType` | STANDARD, VIP, COUPLE, ACCESSIBLE | Seat.seatType / ShowtimeSeat.seatType |
| `SeatStatus` | ACTIVE, INACTIVE, MAINTENANCE | Seat.status |
| `MaintenanceSeverity` | LOW, MEDIUM, HIGH, CRITICAL | CinemaRoomMaintenance.severity |

---

## 5. Service Catalog

### 5.1 MovieService

**Dependencies:** `MovieRepository`, `MovieMapper`, `GenreRepository`, `AgeRatingRepository`, `ScreeningFormatRepository`, `ProductionCompanyRepository`, `PersonRepository`, `MovieCastRepository`, `MovieTranslationRepository`, `CinemaRoomService`, `ShowTimeService`, `AuditLogService`, `ImageStorageService`

| Method | Visibility | @Transactional | Mô tả |
|--------|-----------|---------------|-------|
| `createMovie(CreateMovieRequest)` | public | ✓ | Validate duplicate title → wire FK refs (ageRating, company) → validate genres + formats sizes → save → upsert translations + cast → audit log |
| `getMovie(Long id)` | public | ✓ | findById → force-init LAZY collections (translations, cast, genres, formats) → mapper |
| `getMovieByLang(Long id, String lang)` | public | ✓ | Giống getMovie nhưng filter translations theo lang code |
| `findAllPublic()` | public | ✓ | `findByStatusIn([COMING_SOON, NOW_SHOWING])` |
| `findAll()` | public | ✓ | Admin: `findAll()` không phân trang |
| `findPage(int page, int size)` | public | ✗ | `findAll(PageRequest.of(page, size))` |
| `findPageWithFilters(page, size, status, genreId, releaseDate)` | public | ✗ | JPQL DISTINCT với 3 optional params |
| `updateMovie(Long id, UpdateMovieRequest)` | public | ✓ | Patch non-null fields → **delete-all + re-insert** translations/cast nếu có (gap #143) |
| `submitForReview(Long id, updatedBy)` | public | ✓ | Guard DRAFT → `updateStatus(PENDING_REVIEW)` |
| `approveMovie(Long id, updatedBy)` | public | ✓ | Guard PENDING_REVIEW → `updateStatus(COMING_SOON)` |
| `rejectMovie(Long id, note, updatedBy)` | public | ✓ | Guard PENDING_REVIEW → `rejectMovie(id, note, updatedBy)` |
| `suspendMovie(Long id, reason, updatedBy)` | public | ✓ | Guard NOW_SHOWING/COMING_SOON → `suspendMovie(id, reason, updatedBy)` |
| `endMovie(Long id, updatedBy)` | public | ✓ | Guard không phải DRAFT/PENDING_REVIEW/REJECTED → `updateStatus(ENDED)` |
| `reworkMovie(Long id, updatedBy)` | public | ✓ | Guard REJECTED → `updateStatus(DRAFT)` |
| `releaseMovie(Long id, updatedBy)` | public | ✓ | Guard COMING_SOON → `updateStatus(NOW_SHOWING)` |
| `reinstateMovie(Long id, updatedBy)` | public | ✓ | Guard SUSPENDED → `updateStatus(NOW_SHOWING)` |
| `deleteMovie(Long id)` | public | ✓ | Check `existsMovie(future)` → nếu còn throw → `updateStatus(ENDED, "SYSTEM")` |
| `uploadMovieImage(MultipartFile)` | public | ✗ | Validate size ≤ 5MB + MIME (jpeg/png/webp) → `imageStorageService.uploadImage()` → build response |
| `saveTranslations(Movie, List<TranslationRequest>)` | private | — | Loop upsert `MovieTranslation` via `movieTranslationRepository.save()` |
| `saveCast(Movie, List<CastRequest>)` | private | — | Loop: `personRepository.findById()` → build `MovieCast` → `movieCastRepository.save()` |
| `requireStatus(Long id, MovieStatus)` | private | — | findById → if status != required → throw `INVALID_STATUS_TRANSITION` |

**Bug đã biết (#143):** `updateMovie()` khi `request.getTranslations() != null` → `deleteById_MovieId(id)` rồi gọi `saveTranslations()` insert lại. Không dùng upsert — mất `created_at` của translation cũ.

---

### 5.2 ShowTimeService

**Dependencies:** `ShowTimeRepository`, `ShowtimeSeatRepository`, `SeatRepository`, `MovieRepository`, `CinemaRoomRepository`, `MovieMapper`

| Method | Visibility | @Transactional | Mô tả |
|--------|-----------|---------------|-------|
| `getSeatsByShowtime(Long showtimeId)` | public | ✓ | findById showtime → query seats → nếu empty: lazy-init từ `room.getSeats()` → save → parse seatCode → toDto |
| `lockSeats(Long showtimeId, List<Long> seatIds)` | public | ✓ | Loop: findById seat → check AVAILABLE (hoặc RESERVED expired) → set RESERVED, reservedAt, reservedExpiresAt=now+15m → save. **Không pessimistic lock** (gap #145) |
| `validateStartTimes(List<ShowTimeRequest>)` | public | ✗ | Mỗi request: `startTime ∈ [08:00, 23:00]` |
| `validateLocalRequests(List<ShowTimeRequest>, int duration)` | public | ✗ | O(n²) pairwise: cùng room + date → check interval overlap |
| `validateShowDates(List<ShowTimeRequest>)` | public | ✗ | `showDate >= today + 3` |
| `validateWithDatabase(List<ShowTimeRequest>, int duration)` | public | ✗ | Mỗi request: `existsByCinemaRoomAndOverlappingTime()` |
| `existsMovie(Long movieId, LocalDate, LocalTime)` | public | ✗ | `existsByMovieMovieIdAndFutureShowTime()` → dùng trong `deleteMovie()` |
| `saveSchedule(List<ShowTime>)` | public | ✗ | `saveAll()` |
| `getAll()` | public | ✗ | `findAll()` → mapper |
| `getById(Long id)` | public | ✗ | `findById()` or throw SHOWTIME_NOT_FOUND → mapper |
| `getByMovieId(Long movieId, LocalDate date)` | public | ✗ | Check movie exists → `findByMovieMovieIdAndShowDate()` hoặc `findByMovieMovieId()` |
| `createStandalone(CreateShowTimeRequest)` | public | ✓ | (1) movie exists (2) room exists (3) showDate ≥ today+3 (4) time ∈ [08:00,23:00], endTime=start+duration ≤ 23:00 (5) overlap DB check (6) save với status=SCHEDULED |
| `update(Long id, UpdateShowTimeRequest)` | public | ✓ | findById → patch non-null fields → rerun overlap check exclude self → save |
| `deleteById(Long id)` | public | ✓ | exists check → future check → `deleteById()` vật lý |
| `toShowTimeResponse(ShowTime)` | private | — | Manual mapping (không dùng MapStruct) — set movieId/Name, cinemaRoomId/Name, status.name() |
| `toDto(ShowtimeSeat)` | private | — | Map seat → DTO: parse seatCode regex `([A-Za-z]+)(\d+)`, xử lý RESERVED expired → trả "AVAILABLE" |

---

### 5.3 TmdbService

**Dependencies:** `MovieRepository`, `MovieTranslationRepository`, `MovieCastRepository`, `PersonRepository`, `ProductionCompanyRepository`, `ScreeningFormatRepository`, `GenreRepository`, `AgeRatingRepository`, `RestTemplate`, `@Value("${tmdb.api-key}")`

**Constants:**
- `TMDB_BASE = "https://api.themoviedb.org/3"`
- `POSTER_BASE = "https://image.tmdb.org/t/p/w500"`
- `MAX_CAST = 15`
- `US_CERT_TO_LOCAL`: G→P, PG→K, PG-13→T13, R→T18, NC-17→T18
- `TMDB_GENRE_CODES`: 19 entries (TMDB genre ID → local `genre_code`)

| Method | Visibility | @Transactional | Mô tả |
|--------|-----------|---------------|-------|
| `search(String query)` | public | ✗ | `GET /search/movie?language=vi` → map results → List<TmdbSearchResultItem> |
| `getDetails(Integer tmdbId)` | public | ✓ | Fetch 4 endpoints → upsert companies + persons → build preview DTO (không lưu movie vào DB) |
| `importMovie(Integer tmdbId)` | public | ✓ | Duplicate check → fetch 5 endpoints → upsert companies + genres + ageRating → build + save Movie → saveTranslations → saveCast → return summary |
| `fetchMovieDetail(Integer tmdbId)` | private | — | `GET /movie/{id}?language=en` |
| `fetchCredits(Integer tmdbId)` | private | — | `GET /movie/{id}/credits` |
| `fetchTranslations(Integer tmdbId)` | private | — | `GET /movie/{id}/translations` |
| `fetchReleaseDates(Integer tmdbId)` | private | — | `GET /movie/{id}/release_dates` |
| `upsertCompany(TmdbCompany)` | private | — | `findByName()` hoặc build + save `ProductionCompany` |
| `upsertPerson(tmdbPersonId, name, profilePath)` | private | — | `findByTmdbId()` hoặc build + save `Person` |
| `saveTranslations(Movie, detail, translationsResp)` | private | — | Chỉ lưu "en" và "vi"; en fallback về `originalTitle` nếu TMDB không có |
| `saveOneTranslation(Movie, langCode, title, synopsis)` | private | — | Build `MovieTranslationId` → save |
| `saveCast(Movie, TmdbCreditsResponse)` | private | — | Lưu directors (crew job="Director") + top MAX_CAST actors (sorted by order) |
| `saveCastEntry(Movie, Person, roleType, charName, billingOrder)` | private | — | Build + save `MovieCast` |
| `buildTranslationPreview(detail, translationsResp)` | private | — | Dùng trong `getDetails()`: preview only, không save |
| `buildCastPreview(TmdbCreditsResponse)` | private | — | `getDetails()`: upsert persons + build List<CastResponse> |
| `resolveAgeRating(TmdbReleaseDatesResponse)` | private | — | Priority: (1) VN cert → `findByRatingCode(vnCert)` (2) US MPAA → map → `findByRatingCode(localCode)` |
| `resolveGenres(List<TmdbGenre>)` | private | — | (1) Match TMDB_GENRE_CODES[id] → `findByGenreCode()` (2) fallback: case-insensitive name match |
| `buildPosterUrl(posterPath)` | private | — | null-safe: `POSTER_BASE + posterPath` |
| `parseDate(String)` | private | — | `LocalDate.parse()` với try-catch, trả null nếu fail |

---

### 5.4 CinemaRoomService

**Dependencies:** `CinemaRoomRepository`, `CinemaRoomMaintenanceRepository`, `MovieMapper`, `AuditLogService`, `SeatService`

| Method | Visibility | @Transactional | Mô tả |
|--------|-----------|---------------|-------|
| `createCinemaRoom(CinemaRoomRequest)` | public | ✓ | Check name unique → validate `totalSeatCapacity ≤ roomType.maxSeats` → mapper → set ACTIVE → save → `generateSeatsForRoom()` → audit log |
| `findByCinemaRoom(Long cinemaId)` | public | ✗ | `cinemaRoomRepository.findByCinemaRoomId()` |
| `getAllRooms()` | public | ✗ | `findAll()` → mapper list |
| `reportMaintenance(Long roomId, MaintenanceRequest, String createdBy)` | public | ✓ | findById → build + save `CinemaRoomMaintenance` → set room status=TEMPORARILY_UNAVAILABLE + maintenanceNote |
| `resolveMaintenance(Long maintenanceId, String note, String resolvedBy)` | public | ✓ | findById maintenance → set resolved=true, resolvedAt, resolutionNote → check if no more open maintenances → if clear: set room=ACTIVE, maintenanceNote=null |
| `setRoomStatus(Long roomId, CinemaRoomStatus, String updatedBy)` | public | ✓ | findById → setStatus + setUpdatedBy → save → mapper |

**Note logic:** `resolveMaintenance` — tên biến `hasOpenMaintenance` sai nghĩa: biến đang là `isEmpty()` (true khi không còn open). Đây là potential confusion nhưng logic cuối cùng đúng.

---

### 5.5 SeatService

**Dependencies:** `SeatRepository`, `MovieMapper`

| Method | Visibility | @Transactional | Mô tả |
|--------|-----------|---------------|-------|
| `generateSeatsForRoom(CinemaRoom, BigDecimal defaultPrice)` | public | ✓ | Loop i=0→total-1: `rowLabel = 'A' + i/seatsPerRow`, `colNumber = (i%seatsPerRow)+1`, build `Seat` → `saveAll()` |
| `getSeatsByRoom(Long roomId)` | public | ✗ | `findByCinemaRoomCinemaRoomId()` → mapper list |
| `getSeatById(long seatId)` | public | ✗ | `findById()` or throw SEAT_NOT_FOUND → mapper |
| `updateSeat(long seatId, SeatRequest)` | public | ✓ | findById → setSeatType + setPrice → save → mapper |
| `setSeatStatus(long seatId, SeatStatus)` | public | ✓ | findById → setStatus → save |

**Thuật toán sinh ghế:** Ví dụ STANDARD (seatsPerRow=10), 30 ghế: i=0→A1, i=9→A10, i=10→B1, i=19→B10, i=20→C1.

---

### 5.6 GenreService

**Dependencies:** `GenreRepository`, `MovieMapper`

| Method | Visibility | @Transactional | Mô tả |
|--------|-----------|---------------|-------|
| `getAll()` | public | ✗ | `findAll()` → mapper list |
| `getById(Long id)` | public | ✗ | `findById()` or throw → mapper |
| `create(String genreName)` | public | ✓ | trim → `existsByGenreName()` check → generate `genreCode` → `findByGenreCode()` check → save |

**Slug algorithm:** `Normalizer.normalize(name, NFD)` → strip diacritics `\p{M}` → replace non-alphanumeric → strip leading/trailing `_` → `.toUpperCase(Locale.ROOT)`. Ví dụ: "Hành động" → `HANH_DONG`.

---

### 5.7 AuditLogService

**Dependencies:** `MovieActionLogRepository`

| Method | Visibility | @Transactional | Mô tả |
|--------|-----------|---------------|-------|
| `logAction(String accountId, String actor, String note, String content)` | public | ✗ | Build `MovieActionLog` với timestamp=now() → save. Gap #141: không có actionType. |

---

### 5.8 CloudinaryImageStorageService

**Interface:** `ImageStorageService`
**Dependencies:** `Cloudinary` bean

| Method | Mô tả |
|--------|-------|
| `uploadImage(MultipartFile file)` → `Map<?,?>` | `cloudinary.uploader().upload(file.getBytes(), ObjectUtils.emptyMap())` → trả raw Cloudinary result map (`secure_url`, `url`, `public_id`) |

---

## 6. Controller Catalog

### 6.1 MovieController — `/api/movies`

| Method | Path | Auth | Service call |
|--------|------|------|-------------|
| POST | `/api/movies` | ADMIN / EMPLOYEE | `createMovie()` |
| GET | `/api/movies/{id}?lang=` | Public | `getMovie()` / `getMovieByLang()` |
| GET | `/api/movies?page&size&status&genreId&date` | Public | `findPageWithFilters()` |
| GET | `/api/movies/all` | ADMIN / EMPLOYEE | `findAll()` |
| GET | `/api/movies/public` | Public | `findAllPublic()` |
| PUT | `/api/movies/{id}` | ADMIN / EMPLOYEE | `updateMovie()` |
| DELETE | `/api/movies/{id}` | ADMIN | `deleteMovie()` (soft) |
| POST | `/api/movies/{id}/submit` | ADMIN / EMPLOYEE | `submitForReview()` |
| POST | `/api/movies/{id}/approve` | ADMIN | `approveMovie()` |
| POST | `/api/movies/{id}/reject` | ADMIN | `rejectMovie()` |
| POST | `/api/movies/{id}/suspend` | ADMIN | `suspendMovie()` |
| POST | `/api/movies/{id}/end` | ADMIN | `endMovie()` |
| POST | `/api/movies/{id}/rework` | ADMIN / EMPLOYEE | `reworkMovie()` |
| POST | `/api/movies/{id}/release` | ADMIN | `releaseMovie()` |
| POST | `/api/movies/{id}/reinstate` | ADMIN | `reinstateMovie()` |
| POST | `/api/movies/images` (multipart) | ADMIN / EMPLOYEE | `uploadMovieImage()` |

---

### 6.2 ScheduleController — `/api/schedules`

| Method | Path | Auth | Service call |
|--------|------|------|-------------|
| GET | `/api/schedules` | Public | `getAll()` |
| GET | `/api/schedules/{id}` | Public | `getById()` |
| GET | `/api/schedules/movie/{movieId}?date=` | Public | `getByMovieId()` |
| POST | `/api/schedules` | ADMIN | `createStandalone()` |
| PUT | `/api/schedules/{id}` | ADMIN | `update()` |
| DELETE | `/api/schedules/{id}` | ADMIN | `deleteById()` |

---

### 6.3 ShowTimeController — `/api/showtimes` *(legacy path, seat management)*

| Method | Path | Auth | Service call |
|--------|------|------|-------------|
| GET | `/api/showtimes/{id}/seats` | Public | `getSeatsByShowtime()` |
| PUT | `/api/showtimes/{id}/seats/lock` | Public | `lockSeats()` |

---

### 6.4 TmdbController — `/api/movies/tmdb`

| Method | Path | Auth | Service call |
|--------|------|------|-------------|
| GET | `/api/movies/tmdb/search?q=` | ADMIN, EMPLOYEE | `search()` |
| GET | `/api/movies/tmdb/{tmdbId}/details` | ADMIN, EMPLOYEE | `getDetails()` |
| POST | `/api/movies/tmdb/import` | ADMIN, EMPLOYEE | `importMovie()` |

---

### 6.5 CinemaClusterController — `/api/cinema-clusters`

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/cinema-clusters?q=&status=` | Public / Staff | Public thấy ACTIVE, Staff thấy all |
| GET | `/api/cinema-clusters/{id}` | Public | Kèm `totalRooms`, `totalSeats` |
| POST | `/api/cinema-clusters` | ADMIN / EMPLOYEE | Tạo với status=DRAFT, log audit |
| PUT | `/api/cinema-clusters/{id}` | ADMIN / EMPLOYEE | EMPLOYEE chỉ sửa khi status=DRAFT |
| DELETE | `/api/cinema-clusters/{id}` | ADMIN | Guard: không có rooms mới xóa được |
| POST | `/api/cinema-clusters/{id}/submit` | ADMIN / EMPLOYEE | DRAFT → PENDING_REVIEW |
| POST | `/api/cinema-clusters/{id}/approve` | ADMIN | PENDING_REVIEW → ACTIVE |
| POST | `/api/cinema-clusters/{id}/reject` | ADMIN | PENDING_REVIEW → DRAFT + rejectionNote |
| GET | `/api/cinema-clusters/{id}/audit-log` | ADMIN | List ClusterAuditLog DESC |

---

### 6.6 CinemaRoomController — `/api/cinema-rooms`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/cinema-rooms` | Public |
| POST | `/api/cinema-rooms` | Public *(gap: nên ADMIN)* |
| GET | `/api/cinema-rooms/{id}/seats` | Public |
| POST | `/api/cinema-rooms/{id}/maintenance` | Public *(gap)* |
| POST | `/api/cinema-rooms/maintenance/{id}/resolve` | Public *(gap)* |
| PATCH | `/api/cinema-rooms/{id}/status` | Public *(gap)* |

---

### 6.7 GenreController — `/api/genres`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/genres` | Public |
| GET | `/api/genres/{id}` | Public |
| POST | `/api/genres` | **ADMIN** *(fixed Sprint 3)* |

---

### 6.8 AgeRatingController — `/api/age-ratings`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/age-ratings` | Public |
| GET | `/api/age-ratings/{id}` | Public |
| POST | `/api/age-ratings` | ADMIN |
| PUT | `/api/age-ratings/{id}` | ADMIN |
| DELETE | `/api/age-ratings/{id}` | ADMIN |

---

### 6.9 ScreeningFormatController — `/api/screening-formats`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/screening-formats` | Public |
| GET | `/api/screening-formats/{id}` | Public |
| POST | `/api/screening-formats` | ADMIN |
| PUT | `/api/screening-formats/{id}` | ADMIN |
| DELETE | `/api/screening-formats/{id}` | ADMIN |

---

### 6.10 PersonController — `/api/persons`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/persons?q=` | Public |
| GET | `/api/persons/search?q=` | Public *(alias)* |
| GET | `/api/persons/{id}` | Public |
| POST | `/api/persons` | Public *(gap)* |
| PUT | `/api/persons/{id}` | Public *(gap)* |
| DELETE | `/api/persons/{id}` | Public *(gap)* |

---

### 6.11 ProductionCompanyController — `/api/companies`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/companies?q=` | Public |
| GET | `/api/companies/{id}` | Public |
| POST | `/api/companies` | ADMIN |
| PUT | `/api/companies/{id}` | ADMIN |
| DELETE | `/api/companies/{id}` | ADMIN |

---

### 6.12 MovieImageController — `/api/movies/{movieId}/images`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/movies/{movieId}/images` | Public |
| POST | `/api/movies/{movieId}/images` | Public *(gap)* |
| DELETE | `/api/movies/{movieId}/images/{imageId}` | Public *(gap)* |

---

### 6.13 SeatController — `/api/seats`

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/seats/room/{roomId}` | Public |
| GET | `/api/seats/{id}` | Public |
| PUT | `/api/seats/{id}` | Public *(gap)* |

---

## 7. Repository — Custom Queries

### MovieRepository

| Method | Query type | Mô tả |
|--------|-----------|-------|
| `findByStatusIn(List<MovieStatus>)` | Derived | Public movie list |
| `findWithFilters(status, genreId, releaseDate, pageable)` | JPQL `SELECT DISTINCT m FROM Movie m LEFT JOIN m.genres g WHERE ...` | Admin/public filter |
| `updateStatus(movieId, status, updatedBy)` | `@Modifying @Query UPDATE Movie SET status, updatedBy` | Lifecycle transitions |
| `suspendMovie(movieId, reason, updatedBy)` | `@Modifying @Query UPDATE Movie SET status=SUSPENDED, suspendedReason, updatedBy` | |
| `rejectMovie(movieId, note, updatedBy)` | `@Modifying @Query UPDATE Movie SET status=REJECTED, rejectionNote, updatedBy` | |
| `findByStatusAndEndDateBefore(status, date)` | Derived | Dùng bởi MovieScheduler |
| `existsByOriginalTitleIgnoreCase(title)` | Derived | Duplicate guard create |
| `existsByTmdbId(tmdbId)` | Derived | TMDB duplicate guard |
| `countByMonthAndYear(month, year)` | JPQL aggregate | Stats |

### ShowTimeRepository

| Method | Mô tả |
|--------|-------|
| `existsByCinemaRoomAndOverlappingTime(roomId, date, start, end)` | Interval overlap: `start < s.endTime AND end > s.startTime` |
| `existsByCinemaRoomAndOverlappingTimeExcluding(roomId, date, start, end, excludeId)` | Giống trên nhưng exclude self (khi update) |
| `existsByMovieMovieIdAndFutureShowTime(movieId, date, time)` | `showDate > date OR (showDate = date AND startTime > time)` |
| `existsByShowTimeIdAndFutureShowTime(showtimeId, date, time)` | Kiểm tra trước khi xóa showtime |
| `findByMovieMovieId(Long movieId)` | Derived |
| `findByMovieMovieIdAndShowDate(movieId, date)` | Derived |

### ShowtimeSeatRepository

| Method | Mô tả |
|--------|-------|
| `findByShowTime_ShowTimeId(showtimeId)` | Tất cả ghế của 1 suất |
| `findByShowTime_ShowTimeIdAndSeat_SeatId(showtimeId, seatId)` | 1 ghế cụ thể |

---

## 8. Mapper (MovieMapper)

MapStruct compile-time mapper. `componentModel = "spring"`, `unmappedTargetPolicy = IGNORE`.

| Mapping phương thức | Source → Target | Ghi chú quan trọng |
|--------------------|----------------|-------------------|
| `toMovie(CreateMovieRequest)` | Request → Movie | Ignore: movieId, status, genres, formats, cast, translations, ageRating, company |
| `updateMovieFromRequest(UpdateMovieRequest, @MappingTarget Movie)` | Patch in-place | Same ignores |
| `toMovieResponse(Movie)` | Movie → MovieResponse | `status = movie.getStatus().name()`, `companyName = company.name`, nested list mappings |
| `toCastResponse(MovieCast)` | Cast → CastResponse | `personId/fullName/photoUrl` từ `cast.person.*` |
| `toTranslationResponse(MovieTranslation)` | Translation → DTO | `languageCode = id.languageCode` |
| `toShowTimeResponse(ShowTime)` | ShowTime → DTO | `cinemaRoomId/Name = cinemaRoom.*`, `movieId/Name = movie.*`, `status = .name()` |
| `toSeatResponse(Seat)` | Seat → DTO | `cinemaRoomId/Name` từ nested, `seatType/status` dùng `.name()` expression |
| `toCinemaClusterResponse(CinemaCluster)` | Cluster → DTO | `status = .name()`, `totalRooms/totalSeats = ignore` (set in controller) |
| `toCinemaRoom(CinemaRoomRequest)` | Request → CinemaRoom | Ignore: cinemaRoomId, status, seats, showTimes, maintenanceHistory, cluster |

---

## 9. Scheduler

### MovieScheduler

```
Cron: "0 5 0 * * *"  →  chạy lúc 00:05 mỗi đêm
```

**Method `autoEndExpiredMovies()`** (`@Transactional`):
1. `movieRepository.findByStatusAndEndDateBefore(NOW_SHOWING, LocalDate.now())`
2. Nếu empty → log debug và return sớm
3. Với mỗi phim: `setStatus(ENDED)`, `setUpdatedBy("SYSTEM")`
4. `movieRepository.saveAll(expired)`

**Gap #134 — chưa implement:** Scheduler `COMING_SOON → NOW_SHOWING` khi `releaseDate <= today`. Admin phải gọi `POST /{id}/release` thủ công.

**Gap #145 — chưa implement:** Scheduler giải phóng `ShowtimeSeat` với `status=RESERVED` và `reservedExpiresAt < now()`. Hiện tại `toDto()` trong `ShowTimeService` xử lý in-memory khi client request, nhưng không thực sự release trong DB.

---

## 10. Config & Validator

### Config

| Class | Mô tả |
|-------|-------|
| `AuditConfig` | `@EnableJpaAuditing` — bật Spring Data JPA auditing |
| `CloudinaryConfig` | `@Bean Cloudinary` từ `cloudinary.cloud-name`, `api-key`, `api-secret` trong `application.yml` |
| `SecurityConfig` | JWT filter chain, `@EnableMethodSecurity`, `permitAll` cho GET endpoints công khai |

### Validator

| Class | Mô tả |
|-------|-------|
| `@ValidProvince` | Custom annotation — dùng trên `CinemaClusterRequest.province` |
| `ProvinceValidator implements ConstraintValidator<ValidProvince, String>` | So sánh case-insensitive với danh sách 63 tỉnh/thành phố VN hardcoded |

---

## 11. Exception & Error Codes

| Code | Constant | HTTP Status | Message |
|------|----------|-------------|---------|
| 2001 | `MOVIE_TYPE_NOT_FOUND` | 404 | Movie genre not found |
| 2002 | `MOVIE_NOT_FOUND` | 404 | Movie not found |
| 2003 | `CINEMA_ROOM_NOT_FOUND` | 404 | Cinema room does not exist |
| 2004 | `CINEMA_ROOM_NAME_EXISTED` | 409 | Room name already exists |
| 2005 | `MOVIE_TYPE_NAME_EXISTED` | 409 | Genre name already exists |
| 2006 | `INVALID_SHOWTIME` | 400 | Outside 08:00–23:00 |
| 2007 | `SHOWTIME_CONFLICT_IN_REQUEST` | 409 | Overlap in batch |
| 2008 | `INVALID_SHOWDATE` | 400 | < today + 3 days |
| 2009 | `SHOWTIME_CONFLICT_IN_DATABASE` | 409 | Overlap with DB |
| 2010 | `GENRE_NOT_FOUND` | 404 | |
| 2011 | `ACTIVE_SHOWTIMES_EXIST` | 409 | Cannot delete — future showtimes exist |
| 2012 | `SEAT_NOT_FOUND` | 404 | |
| 2013 | `SEAT_QUANTITY_EXCEEDS_LIMIT` | 400 | Exceeds roomType.maxSeats |
| 2014 | `MOVIE_ALREADY_EXISTS` | 409 | Duplicate originalTitle |
| 2015 | `SHOWTIME_NOT_FOUND` | 404 | |
| 2016 | `AGE_RATING_NOT_FOUND` | 404 | |
| 2017 | `COMPANY_NOT_FOUND` | 404 | |
| 2018 | `FORMAT_NOT_FOUND` | 404 | |
| 2019 | `PERSON_NOT_FOUND` | 404 | |
| 2020 | `INVALID_STATUS_TRANSITION` | 400 | |
| 2021 | `TMDB_MOVIE_ALREADY_EXISTS` | 409 | |
| 2022 | `TMDB_API_ERROR` | 502 | |
| 2023 | `CLUSTER_NOT_FOUND` | 404 | |
| 2024 | `CLUSTER_HAS_ROOMS` | 409 | Cannot delete cluster with rooms |
| 2025 | `INVALID_CLUSTER_STATUS` | 400 | |
| 2026 | `CLUSTER_INVALID_TRANSITION` | 400 | |
| 5000 | `INTERNAL_SERVER_ERROR` | 500 | |
| 5001 | `UPLOAD_IMAGE_FAILED` | 500 | Cloudinary fail |
| 5002 | `INVALID_IMAGE_FILE` | 400 | Wrong MIME/size |

---

## 12. Database Schema — Diff vs Sprint 1

### 12.1 Bảng `movie`

| Sprint 1 | Sprint 3 | Thay đổi |
|----------|----------|---------|
| `movie_name_vn VARCHAR(255)` | ❌ xóa | → `movie_translation.title` |
| `movie_name_english VARCHAR(255)` | ❌ xóa | → `movie_translation.title` |
| `actor VARCHAR(255)` | ❌ xóa | → bảng `movie_cast` |
| `director VARCHAR(255)` | ❌ xóa | → `movie_cast.role_type=DIRECTOR` |
| `content TEXT` | → `synopsis TEXT` | Đổi tên |
| `duration BIGINT` | → `duration_minutes INTEGER` | Đổi tên + kiểu |
| `movie_production_company VARCHAR(255)` | → `company_id BIGINT FK` | Từ string sang FK |
| `version VARCHAR(255)` | ❌ xóa | → `movie_format` ManyToMany |
| `large_image VARCHAR(255)` | → `poster_url VARCHAR(500)` | Đổi tên + length |
| `small_image VARCHAR(255)` | → `thumbnail_url VARCHAR(500)` | Đổi tên + length |
| `status BOOLEAN` | → `status VARCHAR(20)` | Boolean → enum string |
| `create_at TIMESTAMP` | → `created_at TIMESTAMP` | Fix typo |
| ❌ | `tmdb_id INTEGER UNIQUE` | **Thêm mới** |
| ❌ | `imdb_id VARCHAR(20) UNIQUE` | **Thêm mới** |
| ❌ | `original_title VARCHAR(500)` | **Thêm mới** |
| ❌ | `original_language VARCHAR(2)` | **Thêm mới** |
| ❌ | `release_date DATE` | **Thêm mới** |
| ❌ | `end_date DATE` | **Thêm mới** (Sprint 3) |
| ❌ | `age_rating_id BIGINT FK` | **Thêm mới** |
| ❌ | `country VARCHAR(100)` | **Thêm mới** |
| ❌ | `trailer_url VARCHAR(500)` | **Thêm mới** |
| ❌ | `suspended_reason TEXT` | **Thêm mới** |
| ❌ | `rejection_note TEXT` | **Thêm mới** |
| ❌ | `created_by / updated_by VARCHAR(100)` | **Thêm mới** |

### 12.2 Bảng `cinema_room`

| Sprint 1 | Sprint 3 | Thay đổi |
|----------|----------|---------|
| `seat_quantity INTEGER` | → `total_seat_capacity INTEGER` | Đổi tên |
| `status BOOLEAN` | → `status VARCHAR(30)` | Boolean → enum |
| ❌ | `room_type VARCHAR(20)` | **Thêm mới** |
| ❌ | `maintenance_note TEXT` | **Thêm mới** |
| ❌ | `created_by / updated_by VARCHAR(100)` | **Thêm mới** |
| ❌ | `created_at / updated_at TIMESTAMP` | **Thêm mới** |
| ❌ | `cluster_id BIGINT FK` | **Thêm mới** |

### 12.3 Bảng `seat`

| Sprint 1 | Sprint 3 | Thay đổi |
|----------|----------|---------|
| `seat_status INTEGER DEFAULT 1` | → `status VARCHAR(20)` | Integer → enum string |
| `UNIQUE(cinema_room_id, seat_code)` | → `UNIQUE(cinema_room_id, row_label, col_number)` | Đổi constraint |
| ❌ | `row_label VARCHAR(3)` | **Thêm mới** — để render seat map |
| ❌ | `col_number INTEGER` | **Thêm mới** |
| `price DECIMAL(10,2)` | → `base_price DECIMAL(10,2)` | Đổi column name |

### 12.4 Bảng `show_time`

| Sprint 1 | Sprint 3 | Thay đổi |
|----------|----------|---------|
| `status INTEGER DEFAULT 1` | → `status VARCHAR(20)` | Integer → enum string |
| ❌ | `format_id INTEGER FK` | **Thêm mới** |
| ❌ | `language_code VARCHAR(10)` | **Thêm mới** |
| ❌ | `subtitle_code VARCHAR(10)` | **Thêm mới** |
| ❌ | `cancellation_reason TEXT` | **Thêm mới** |
| ❌ | `cancelled_at TIMESTAMP` | **Thêm mới** |
| ❌ | `cancelled_by / created_by / updated_by` | **Thêm mới** |
| ❌ | `created_at TIMESTAMP` | **Thêm mới** |

### 12.5 Bảng `showtime_seat`

| Sprint 1 | Sprint 3 | Thay đổi |
|----------|----------|---------|
| `seat_type DEFAULT 'NORMAL'` | → `DEFAULT 'STANDARD'` | Đổi default |
| ❌ | `booking_id VARCHAR(36)` | **Thêm mới** — cross-service UUID reference |
| 2 indexes | 4 indexes | Thêm `idx_ss_booking`, `idx_ss_expires` |

### 12.6 Bảng xóa

| Bảng Sprint 1 | Lý do |
|--------------|-------|
| `type` (movie types) | → thay bằng `genre` với `genre_code` slug |
| `movie_movie_types` (junction) | → thay bằng `movie_genre` |

### 12.7 Bảng thêm mới hoàn toàn (Sprint 2–3)

`genre`, `age_rating`, `screening_format`, `production_company`, `person`, `movie_cast`, `movie_translation`, `movie_image`, `movie_genre` (join), `movie_format` (join), `movie_action_log`, `cinema_cluster`, `cinema_room_maintenance`, `cluster_audit_log`

---

## 13. Business Rule Changes vs Bản Ban Đầu

### 13.1 Movie Lifecycle

| Sprint 1 | Sprint 3 |
|----------|----------|
| `status BOOLEAN` (true/false) | 7 trạng thái: `DRAFT → PENDING_REVIEW → COMING_SOON/REJECTED → NOW_SHOWING ↔ SUSPENDED → ENDED` |
| Không có approval workflow | EMPLOYEE tạo DRAFT → submit → ADMIN approve/reject |
| Không có rework | REJECTED → rework → DRAFT loop |
| Delete vật lý | Soft-delete: check future showtimes → transition sang ENDED |
| Không có scheduler | `MovieScheduler` 00:05 daily: auto-end phim hết `end_date` |

### 13.2 Movie Data Model

| Sprint 1 | Sprint 3 |
|----------|----------|
| Actor/Director là VARCHAR trên bảng movie | Bảng `person` + `movie_cast` với `roleType` string |
| Genre là bảng `type` — chỉ có `type_name` | Bảng `genre` với `genre_code` (slug), ManyToMany, TMDB ID mapping |
| Production company là VARCHAR | Bảng `production_company` riêng, FK (1 company per movie) |
| Version là VARCHAR ("2D, 3D") | Bảng `screening_format` với surcharge, ManyToMany |
| Chỉ có large_image / small_image | Bảng `movie_image` riêng, nhiều ảnh, displayOrder, imageType |
| Không có i18n | Bảng `movie_translation` composite PK `(movie_id, language_code)` |
| Không có age rating | Bảng `age_rating` với DCAV codes (P/K/T13/T16/T18/C) |
| Không có TMDB integration | Import từ TMDB: 5 endpoints, upsert company + person, map genre + age rating |

### 13.3 ShowTime Business Rules

| Sprint 1 | Sprint 3 |
|----------|----------|
| Không rõ ràng | Phải tạo trước tối thiểu 3 ngày (`showDate >= today + 3`) |
| Không rõ ràng | `startTime ∈ [08:00, 23:00)`, `endTime = startTime + duration ≤ 23:00` |
| Không có overlap check | Overlap check: (1) trong batch request, (2) với DB |
| `endTime` nhập thủ công | `endTime` tự tính: `startTime + movie.durationMinutes` |
| ShowtimeSeat tạo ngay khi tạo showtime | Lazy-init: chỉ tạo khi client request `GET /showtimes/{id}/seats` lần đầu |
| Ghế lock không có timeout | Lock ghế 15 phút (`reservedExpiresAt = now + 15m`) |

### 13.4 Cinema Infrastructure

| Sprint 1 | Sprint 3 |
|----------|----------|
| Chỉ có CinemaRoom đơn giản | CinemaCluster với approval workflow (DRAFT → PENDING_REVIEW → ACTIVE) |
| `status BOOLEAN` | `CinemaRoomStatus` enum 4 giá trị: ACTIVE / MAINTENANCE / TEMPORARILY_UNAVAILABLE / CLOSED |
| Không có maintenance | `CinemaRoomMaintenance` với severity, auto status change |
| Ghế tạo thủ công | Auto-generate seats khi tạo room (row/col grid, `seatsPerRow` từ RoomType) |
| Không có roomType | `RoomType` enum với `maxSeats` và `seatsPerRow` |

### 13.5 Security

| Sprint 1 | Sprint 3 |
|----------|----------|
| Không rõ | JWT `@PreAuthorize` ADMIN/EMPLOYEE tại controller methods |
| GenreController POST không có auth | **Fixed Sprint 3:** `@PreAuthorize("hasRole('ADMIN')")` trên `POST /api/genres` |
| CinemaRoomController không có auth | Gap còn tồn tại — Sprint 3 chưa fix |
| PersonController không có auth | Gap còn tồn tại |

---

## 14. Known Gaps & Pending Issues

| Issue # | Label | Mô tả | Sprint |
|---------|-------|-------|--------|
| #134 | Bug/Backend | Scheduler `COMING_SOON → NOW_SHOWING` chưa implement | Sprint 3 |
| #141 | Chore/Backend | `MovieActionLog` thiếu `actionType` enum | Sprint 3 |
| #142 | Chore/Backend | `MovieCast.roleType` là String — nên là enum | Sprint 3 |
| #143 | Bug/Backend | `updateMovie()` delete-all + re-insert translations/cast (mất `created_at`) | Sprint 3 |
| ~~#144~~ | Bug/Backend | ~~`CinemaRoom.cinema_room_name` UNIQUE global thay vì scope theo cluster~~ — resolved (V7) | Sprint 3 |
| #145 | Bug/Backend | `lockSeats()` không dùng pessimistic lock → race condition | Sprint 3 |
| #149 | Feature/Backend | Thêm `?q=` keyword search cho `GET /api/movies` | Sprint 3 |
| #150 | Chore/Backend | Thêm field `tagline` vào Movie và MovieTranslation | Sprint 3 |
| #151 | Chore/Backend | Refactor `Movie.company` → ManyToMany (`movie_production_company`) | Sprint 3 |
| #152 | Chore/Backend | `MovieImage.imageType` String → enum | Sprint 3 |
| #153 | Chore/DB | `MovieTranslation.languageCode` VARCHAR(2) → BCP-47 VARCHAR(5) | Sprint 3 |
| #154 | Chore/Backend | Person thiếu: `gender`, `knownForDepartment`, `deathDate`, `placeOfBirth` | Sprint 3 |
| #146 | Chore/Backend | `CinemaCluster` thiếu `createdBy` / `updatedBy` | Backlog |
| Auth gap | Bug/Security | `CinemaRoomController`, `PersonController`, `MovieImageController`, `SeatController` thiếu `@PreAuthorize` | Sprint 3 |
| Logic gap | Bug/Backend | `resolveMaintenance()`: tên biến `hasOpenMaintenance` sai nghĩa (là `isEmpty()`) — logic đúng nhưng misleading | Sprint 3 |

---

## 15. Nguồn tham chiếu

| File | Mô tả |
|------|-------|
| `server/movie-service/src/main/java/movieservice/` | Toàn bộ source code |
| `docs/database/movie-service/movie_db.sql` | Schema gốc Sprint 1 |
| `docs/MOVIE_SERVICE_BUSINESS_RULES.md` | Business rules chi tiết (26 rules) |
| `docs/issues/sprint-3-issues.md` | 18 issues Sprint 3 (#134–#154) |
| `docs/issues/backlog-issues.md` | 3 issues Backlog (#146–#148) |
