# Technical Module Specification: `movie-service`

> **Project:** CinePrime — Hệ thống quản lý rạp chiếu phim  
> **Service:** `movie-service` (Spring Boot, port 8082)  
> **Version:** Sprint 3 — 07/2026  
> **Status:** Internal Technical Document

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Business Context](#2-business-context)
3. [Module Architecture](#3-module-architecture)
4. [Class Specification](#4-class-specification)
   - 4.1 [MovieController](#41-moviecontroller)
   - 4.2 [MovieService](#42-movieservice)
   - 4.3 [TmdbController](#43-tmdbcontroller)
   - 4.4 [TmdbService](#44-tmdbservice)
   - 4.5 [ScheduleController](#45-schedulecontroller)
   - 4.6 [ShowTimeService](#46-showtimeservice)
   - 4.7 [CinemaClusterController](#47-cinemaclustercontroller)
   - 4.8 [CinemaRoomController & CinemaRoomService](#48-cinemaroomcontroller--cinemaroomservice)
   - 4.9 [SeatController & SeatService](#49-seatcontroller--seatservice)
   - 4.10 [GenreService & GenreController](#410-genreservice--genrecontroller)
   - 4.11 [AgeRatingController](#411-ageratingcontroller)
   - 4.12 [ScreeningFormatController](#412-screeningformatcontroller)
   - 4.13 [PersonController](#413-personcontroller)
   - 4.14 [ProductionCompanyController](#414-productioncompanycontroller)
   - 4.15 [AuditLogService](#415-auditlogservice)
   - 4.16 [MovieScheduler](#416-moviescheduler)
   - 4.17 [MovieMapper](#417-moviemapper)
   - 4.18 [CloudinaryImageStorageService](#418-cloudinaryimagestorageservice)
5. [Entity / Model Analysis](#5-entity--model-analysis)
6. [DTO Analysis](#6-dto-analysis)
7. [Business Flow](#7-business-flow)
8. [Sequence of Operations](#8-sequence-of-operations)
9. [Validation Rules](#9-validation-rules)
10. [Error Handling](#10-error-handling)
11. [Security Considerations](#11-security-considerations)
12. [Design Decisions](#12-design-decisions)
13. [Business Rules Summary](#13-business-rules-summary)
14. [Dependency Summary](#14-dependency-summary)
15. [Key Takeaways](#15-key-takeaways)

---

## 1. Module Overview

### Mục đích

`movie-service` là microservice trung tâm của hệ thống CinePrime, chịu trách nhiệm quản lý toàn bộ dữ liệu liên quan đến nội dung chiếu phim và cơ sở vật chất rạp. Đây là nguồn dữ liệu chủ (single source of truth) cho mọi thông tin về phim, lịch chiếu, và trạng thái ghế ngồi trong toàn hệ thống.

### Module giải quyết vấn đề gì

Trong một hệ thống rạp chiếu phim, các thực thể nghiệp vụ (phim, phòng chiếu, suất chiếu, ghế) có vòng đời phức tạp và liên hệ chặt chẽ với nhau. Nếu không có module tập trung:

- Không có cơ chế kiểm soát chất lượng nội dung phim trước khi công khai (ai cũng có thể tạo phim giả, thông tin sai).
- Không có luồng phê duyệt → vi phạm quy định kiểm duyệt điện ảnh Việt Nam.
- Không đảm bảo tính nhất quán dữ liệu khi nhiều service cùng truy cập.
- Không thể kiểm tra trùng lịch chiếu giữa các suất trong cùng phòng.

### Vị trí trong hệ thống

```
[Frontend / Admin Portal]
        │
        ▼
[API Gateway / Auth Service]
        │
        ▼
[movie-service] ◄──── booking-service (gọi lock-seat API)
        │
        ▼
[MySQL DB: movie_db] + [Cloudinary CDN] + [TMDB External API]
```

### Actors

| Actor | Quyền truy cập | Mục đích sử dụng |
|---|---|---|
| ADMIN | Full access | Phê duyệt phim, quản lý rạp, cấu hình hệ thống |
| EMPLOYEE | Read + Create/Update (có giới hạn) | Nhập phim, quản lý suất chiếu |
| Customer (ẩn danh) | Read-only (endpoint public) | Xem lịch chiếu, sơ đồ ghế |
| booking-service | Internal API | Lock ghế khi khách đặt vé |

### Các service phụ thuộc vào module này

- **booking-service**: Gọi `GET /api/showtimes/{id}/seats` để xem ghế và `PUT /api/showtimes/{id}/seats/lock` để đặt ghế.
- **Frontend SPA**: Gọi toàn bộ API công khai (lịch chiếu, phim đang chiếu, sơ đồ ghế).
- **Admin Portal**: Gọi toàn bộ API quản trị (CRUD phim, rạp, suất chiếu).

---

## 2. Business Context

### Tại sao cần module này?

Theo quy định của Cục Điện ảnh Việt Nam (DCAV), mọi bộ phim chiếu thương mại phải được phân loại độ tuổi và qua quy trình kiểm duyệt nội bộ trước khi bán vé. `movie-service` hiện thực hóa quy trình này thông qua workflow phê duyệt nhiều bước.

Ngoài ra, việc quản lý cơ sở vật chất (rạp, phòng, ghế) yêu cầu tính nhất quán cao — một phòng chiếu không thể đồng thời phục vụ hai suất chiếu chồng giờ, và ghế không thể bị bán hai lần.

### Nếu không có module này

- **Không có kiểm soát nội dung**: Nhân viên có thể đăng phim trực tiếp mà không cần phê duyệt.
- **Dữ liệu không nhất quán**: Nhiều service lưu bản sao dữ liệu phim → mâu thuẫn khi cập nhật.
- **Không có audit trail**: Không biết ai tạo/sửa/xóa phim khi có tranh chấp.
- **Không kiểm soát trùng lịch**: Hai suất chiếu có thể xếp vào cùng phòng, cùng giờ.

### Business Rules chính

| Nhóm | Rule |
|---|---|
| Phim | Chỉ DRAFT mới được submit; chỉ PENDING_REVIEW mới được approve/reject |
| Phim | Soft-delete: phim không bị xóa vật lý — chuyển sang ENDED |
| Phim | Không thể xóa phim còn suất chiếu trong tương lai |
| Suất chiếu | Giờ bắt đầu phải trong khung 08:00–23:00 |
| Suất chiếu | Phải lên lịch trước ít nhất 3 ngày |
| Suất chiếu | endTime tính tự động = startTime + movie.durationMinutes |
| Suất chiếu | Không được trùng giờ trong cùng phòng |
| Rạp | Cluster phải qua approval workflow trước khi ACTIVE |
| Rạp | Phòng chiếu chỉ được tạo mới khi cluster đang ACTIVE |
| Độ tuổi | Phim phải có mã phân loại DCAV (P, K, T13, T16, T18, C) |
| Ghế | ShowtimeSeat chỉ tạo khi lần đầu có request xem sơ đồ ghế (lazy init) |

### Constraints quan trọng

- Chỉ ADMIN mới được approve/reject phim, rạp.
- Chỉ ADMIN mới được tạo thể loại (genre) mới.
- Phim có trạng thái SUSPENDED không xuất hiện ở endpoint public.
- `bookingId` trong `ShowtimeSeat` là UUID string — không phải DB foreign key — vì booking-service dùng database riêng.
- Ảnh phim lưu trên Cloudinary, không lưu binary trong DB.

---

## 3. Module Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Layer                           │
│  MovieController  TmdbController  ScheduleController   │
│  CinemaClusterController  CinemaRoomController         │
│  GenreController  AgeRatingController  SeatController  │
│  PersonController  ScreeningFormatController           │
│  ProductionCompanyController  MovieImageController     │
└───────────────────────┬─────────────────────────────────┘
                        │ Delegate (no business logic in controller)
┌───────────────────────▼─────────────────────────────────┐
│                  Service Layer                          │
│  MovieService  TmdbService  ShowTimeService            │
│  CinemaRoomService  SeatService  GenreService          │
│  AuditLogService  CloudinaryImageStorageService        │
└───────────────────────┬─────────────────────────────────┘
                        │ JPA
┌───────────────────────▼─────────────────────────────────┐
│               Repository Layer                         │
│  MovieRepository  ShowTimeRepository                   │
│  ShowtimeSeatRepository  CinemaRoomRepository          │
│  GenreRepository  PersonRepository  ...                │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  MySQL (movie_db)                       │
└─────────────────────────────────────────────────────────┘

Các thành phần ngang (cross-cutting):
  MovieMapper (MapStruct)   — compile-time DTO ↔ Entity mapping
  MovieScheduler (@Scheduled) — nightly job 00:05
  @PreAuthorize              — endpoint-level RBAC
  @ValidProvince             — custom JSR-380 validator
  MovieErrorCode (enum)      — tập trung mã lỗi
```

**Trách nhiệm của từng layer:**

- **Controller**: Nhận HTTP request, parse input, gọi service, serialize response. Không chứa business logic.
- **Service**: Toàn bộ business logic, validation nghiệp vụ, orchestration giữa nhiều repository.
- **Repository**: Truy vấn DB. Custom JPQL query chỉ khi Spring Data method naming không đủ biểu đạt.
- **Mapper**: Chuyển đổi Entity ↔ DTO. Không chứa logic, chỉ mapping thuần.
- **Scheduler**: Tác vụ định kỳ, không được gọi từ controller.

---

## 4. Class Specification

---

### 4.1 MovieController

**Purpose**

Điểm vào duy nhất (single entry point) cho mọi HTTP request liên quan đến phim. Định tuyến request đến `MovieService` và trả kết quả về client.

**Responsibility**

- Khai báo route mapping (`@RequestMapping("/api/movies")`).
- Apply security annotation (`@PreAuthorize`) ở cấp endpoint.
- Nhận `@RequestBody`, `@PathVariable`, `@RequestParam` và forward sang service.
- Không validate nghiệp vụ — chỉ validate cú pháp request (Bean Validation `@Valid`).

**Dependencies**

| Dependency | Lý do inject |
|---|---|
| `MovieService` | Duy nhất — toàn bộ logic phim nằm trong service |

**Public Methods**

#### `createMovie(CreateMovieRequest)`
- **Purpose**: Tạo bộ phim mới vào hệ thống.
- **Business Logic**: Delegate hoàn toàn sang `MovieService.createMovie()`.
- **Input**: `CreateMovieRequest` (validated bởi `@Valid`).
- **Output**: `MovieResponse` với HTTP 201.
- **Security**: `ADMIN` hoặc `EMPLOYEE`.

#### `getMovie(id, lang)`
- **Purpose**: Lấy chi tiết một phim, tùy chọn lọc theo ngôn ngữ.
- **Business Logic**: Nếu `lang` không null → gọi `getMovieByLang()`; ngược lại → `getMovie()`.
- **Output**: `MovieResponse` với toàn bộ translations hoặc chỉ translation khớp với `lang`.
- **Security**: Public (không yêu cầu auth).

#### `findAllPublic()`
- **Purpose**: Trả danh sách phim cho trang chủ khách hàng.
- **Business Logic**: Chỉ trả `COMING_SOON` và `NOW_SHOWING` — không bao giờ trả `DRAFT`, `PENDING_REVIEW`, `REJECTED`, `SUSPENDED`, `ENDED`.
- **Security**: Public.

#### `findAll()`
- **Purpose**: Trả toàn bộ phim không lọc — dành cho trang admin.
- **Security**: `ADMIN` hoặc `EMPLOYEE`.

#### `findPage(page, size, status, genreId, releaseDate)`
- **Purpose**: Phân trang với 3 bộ lọc tùy chọn.
- **Business Logic**: Ba filter có thể kết hợp tùy ý (0–3 filter cùng lúc).
- **Output**: `Page<MovieResponse>`.

#### `updateMovie(id, UpdateMovieRequest)`
- **Purpose**: Cập nhật thông tin phim.
- **Security**: `ADMIN` hoặc `EMPLOYEE`.

#### `deleteMovie(id)`
- **Purpose**: Soft-delete: chuyển phim sang `ENDED`.
- **Business Rule**: Bị chặn nếu còn suất chiếu trong tương lai.
- **Security**: `ADMIN`.

#### Các endpoint lifecycle (submit, approve, reject, rework, release, suspend, reinstate, end)
- **Pattern chung**: `POST /api/movies/{id}/{action}` → gọi `MovieService.{action}Movie()`.
- **Security**: `approve`, `reject`, `suspend`, `reinstate`, `end`, `release` → chỉ `ADMIN`. `submit`, `rework` → `ADMIN` hoặc `EMPLOYEE`.

#### `uploadImage(MultipartFile)`
- **Purpose**: Upload ảnh phim lên Cloudinary, nhận URL.
- **Business Rule**: File ≤ 5MB, chỉ JPEG/PNG/WebP.
- **Lưu ý**: Endpoint này không gắn URL vào phim — chỉ trả URL để client tự điền vào form.

---

### 4.2 MovieService

**Purpose**

Trung tâm toàn bộ business logic của phim. Mọi rule nghiệp vụ về phim đều được kiểm tra tại đây trước khi persist vào DB.

**Responsibility**

- Validate nghiệp vụ (tên phim trùng, trạng thái hợp lệ khi transition, còn suất chiếu không...).
- Orchestrate giữa `MovieRepository`, `GenreRepository`, `AgeRatingRepository`, `ScreeningFormatRepository`, `CompanyRepository`.
- Quản lý cascade save của `MovieTranslation` và `MovieCast` (private methods).
- Ghi audit log sau mỗi thao tác quan trọng.
- Upload ảnh qua `ImageStorageService`.

**Dependencies**

| Dependency | Lý do |
|---|---|
| `MovieRepository` | CRUD và custom status-transition queries |
| `GenreRepository` | Resolve genre ID → Genre entity khi tạo/cập nhật phim |
| `AgeRatingRepository` | Resolve ageRating ID → AgeRating entity |
| `ScreeningFormatRepository` | Resolve format ID → ScreeningFormat entity |
| `ProductionCompanyRepository` | Resolve company ID → ProductionCompany entity |
| `ShowTimeRepository` | Kiểm tra còn suất chiếu tương lai trước khi xóa/kết thúc |
| `AuditLogService` | Ghi log mỗi hành động quan trọng |
| `ImageStorageService` | Upload ảnh lên Cloudinary |
| `MovieMapper` | Entity ↔ DTO conversion |

**Public Methods**

#### `createMovie(CreateMovieRequest)`
- **Business Logic**:
  1. Kiểm tra `title` chưa tồn tại trong DB (unique check).
  2. Resolve `ageRatingId` → entity; throw `AGE_RATING_NOT_FOUND` nếu không có.
  3. Resolve `companyId` → entity (nullable — công ty SX có thể null).
  4. Build `Movie` entity với `status = DRAFT`.
  5. Gọi `saveTranslations()` và `saveCast()` (private, xem bên dưới).
  6. `movieRepository.save()`.
  7. `auditLogService.logAction()`.
- **Transaction**: `@Transactional` — toàn bộ bước 1–7 là atomic.
- **Exception**: `MOVIE_TITLE_ALREADY_EXISTS`, `AGE_RATING_NOT_FOUND`.

#### `updateMovie(id, UpdateMovieRequest)`
- **Business Logic**:
  1. Load movie, kiểm tra tồn tại.
  2. Cập nhật từng field chỉ khi không null trong request (partial update pattern).
  3. Nếu request có `translations` → xóa hết translations cũ + insert mới (delete-all + re-insert).
  4. Nếu request có `castList` → xóa hết cast cũ + insert mới.
- **Lưu ý thiết kế**: Pattern delete-all + re-insert cho translations/cast đơn giản hóa code nhưng xóa audit history của từng cast entry. Đây là gap #143 trong sprint-3-issues.
- **Transaction**: `@Transactional`.

#### `uploadMovieImage(MultipartFile)`
- **Business Logic**:
  1. Validate MIME type: chỉ chấp nhận `image/jpeg`, `image/png`, `image/webp`.
  2. Validate size ≤ 5MB.
  3. Gọi `imageStorageService.upload()` → nhận URL.
  4. **Không lưu URL vào DB** — trả URL cho client.
- **Lý do không lưu DB**: Một phim có thể có nhiều ảnh (poster, backdrop, still). Client tự quyết định gắn URL nào vào field nào trong `CreateMovieRequest`/`UpdateMovieRequest`.

#### Các transition methods (`submitForReview`, `approveMovie`, `rejectMovie`, `reworkMovie`, `releaseMovie`, `suspendMovie`, `reinstateMovie`, `endMovie`)
- **Pattern chung**: Mỗi method gọi `requireStatus(movie, expectedStatus)` trước khi thực hiện.
- **`requireStatus()`** (private): Kiểm tra `movie.status == expectedStatus`; nếu không → throw `INVALID_STATUS_TRANSITION`.
- **`suspendMovie()`**: Nhận thêm `reason` → lưu vào `movie.suspendedReason`.
- **`rejectMovie()`**: Nhận thêm `note` → lưu vào `movie.rejectionNote`.
- **Transaction**: Tất cả dùng `@Transactional`.

#### `deleteMovie(id)`
- **Business Logic**:
  1. Load movie.
  2. Gọi `showTimeRepository.existsByMovieMovieIdAndFutureShowTime(id)`.
  3. Nếu còn suất tương lai → throw `MOVIE_HAS_ACTIVE_SHOWTIMES`.
  4. Nếu không → `movie.status = ENDED` (soft delete).
- **Lý do soft-delete**: `MovieCast`, `MovieTranslation`, `ShowtimeSeat` đã liên kết với movie — xóa vật lý phá vỡ referential integrity và mất lịch sử.

---

### 4.3 TmdbController

**Purpose**

Cung cấp các endpoint phục vụ quy trình browse và import phim từ The Movie Database (TMDB). Quyền `ADMIN` hoặc `EMPLOYEE` được phép browse/search/details/import; đồng bộ taxonomy genre vẫn chỉ dành cho `ADMIN`.

**Responsibility**

- Nhận `tmdbId` hoặc keyword tìm kiếm.
- Delegate sang `TmdbService`.
- Không cache kết quả từ TMDB.

**Dependencies**: `TmdbService`.

**Public Methods**

| Method | Endpoint | Mục đích |
|---|---|---|
| `search(q)` | `GET /api/movies/tmdb/search` | Tìm kiếm phim trên TMDB, chưa lưu DB |
| `getDetails(tmdbId)` | `GET /api/movies/tmdb/{tmdbId}/details` | Xem preview chi tiết 1 phim, upsert Person/Company |
| `importMovie(tmdbId)` | `POST /api/movies/tmdb/import` | Import vào DB với status DRAFT |

---

### 4.4 TmdbService

**Purpose**

Orchestrate toàn bộ quá trình giao tiếp với TMDB API và chuyển đổi dữ liệu sang domain model của CinePrime.

**Responsibility**

- Gọi 5 TMDB endpoint: `movie/{id}`, `movie/{id}/credits`, `movie/{id}/translations`, `movie/{id}/release_dates`, `search/movie`.
- Ánh xạ dữ liệu nước ngoài (TMDB genre ID, MPAA rating) sang dữ liệu nội địa (local genre_code, DCAV rating).
- Upsert `Person` và `ProductionCompany` để tránh tạo trùng lặp.
- Sinh preview DTO cho bước "xem trước trước khi import".

**Dependencies**

| Dependency | Lý do |
|---|---|
| `RestTemplate` | HTTP client để gọi TMDB REST API |
| `PersonRepository` | Upsert diễn viên/đạo diễn |
| `ProductionCompanyRepository` | Upsert công ty sản xuất |
| `AgeRatingRepository` | Resolve mã DCAV → AgeRating entity |
| `GenreRepository` | Resolve local genre_code → Genre entity |
| `ScreeningFormatRepository` | Gán định dạng 2D mặc định khi import |
| `MovieRepository` | Kiểm tra phim đã được import trước đó chưa (by tmdb_id) |
| `MovieMapper` | Map preview DTO |

**Public Methods**

#### `search(query)`
- **Business Logic**: Gọi `GET https://api.themoviedb.org/3/search/movie?query={q}&language=vi-VN`.
- **Output**: List `TmdbSearchResult` — chỉ gồm `tmdbId`, `title`, `posterUrl`, `overview`, `releaseYear`.
- **Không lưu DB**.

#### `getDetails(tmdbId)`
- **Business Logic**:
  1. Gọi đồng thời 4 TMDB endpoint (detail, credits, translations, release_dates).
  2. Gọi `upsertPerson()` cho từng cast/crew member.
  3. Gọi `upsertCompany()` cho từng production company.
  4. Gọi `resolveAgeRating()` và `resolveGenres()`.
  5. Gọi `buildTranslationPreview()` và `buildCastPreview()`.
  6. Trả về `TmdbMoviePreview` DTO.
- **Side effect**: Upsert Person/Company vào DB — dữ liệu này được giữ lại ngay cả khi admin không import phim.
- **Transaction**: Bước upsert là `@Transactional`.

#### `importMovie(tmdbId)`
- **Business Logic**:
  1. `movieRepository.existsByTmdbId(tmdbId)` — nếu đã import → throw `MOVIE_ALREADY_IMPORTED`.
  2. Fetch đầy đủ từ 5 TMDB endpoint.
  3. Upsert Person/Company.
  4. Gán `ScreeningFormat` = `2D` mặc định (format phổ thông nhất, admin có thể thêm sau).
  5. `resolveAgeRating()`: ưu tiên Việt Nam, fallback MPAA Mỹ → map sang DCAV.
  6. `resolveGenres()`: map TMDB genre ID → local genre qua bảng `TMDB_GENRE_CODES`. Fallback so sánh tên (case-insensitive) nếu chưa có mapping.
  7. Tạo `Movie` với `status = DRAFT`.
  8. Lưu tối đa 2 translations: `vi` và `en`.
  9. Lưu tối đa 15 diễn viên đầu danh sách + đạo diễn.
- **Transaction**: `@Transactional` toàn bộ.

#### `resolveAgeRating(releaseDataFromTmdb)` (private)
- **Logic**:
  1. Tìm `certification` của Việt Nam (`"VN"`) trong `release_dates`.
  2. Nếu không có → tìm `"US"` và map qua `US_CERT_TO_LOCAL`: `G→P`, `PG→K`, `PG-13→T13`, `R→T18`, `NC-17→T18`.
  3. Tìm `AgeRating` entity theo `code` kết quả.
  4. Nếu không tìm được → trả `null` (phim được tạo không có ageRating).

#### `resolveGenres(tmdbGenreList)` (private)
- **Logic**: Duyệt từng TMDB genre → tra cứu `TMDB_GENRE_CODES` map (19 entries hardcoded). Nếu không có trong map → so sánh `genreName.equalsIgnoreCase()` với tên genre trong DB.
- **Lý do hardcode**: TMDB genre ID ổn định, không thay đổi theo thời gian. Mapping tĩnh là đủ và tránh dependency vào naming.

#### `upsertPerson(tmdbPersonId, name, photoPath)` (private)
- **Logic**: `personRepository.findByTmdbId(tmdbPersonId)`. Nếu không có → tạo mới với `photoUrl = buildPosterUrl(photoPath)`. Nếu có → return existing (không update để bảo toàn chỉnh sửa thủ công của admin).

---

### 4.5 ScheduleController

**Purpose**

Thay thế endpoint suất chiếu cũ từ `ShowTimeController` (legacy). Từ Sprint 2, toàn bộ quản lý lịch chiếu chuyển sang `/api/schedules`. `ShowTimeController` (`/api/showtimes`) vẫn tồn tại cho compatibility nhưng không nên dùng mới.

**Responsibility**

- Nhận request tạo/cập nhật/xóa suất chiếu.
- Delegate sang `ShowTimeService`.

**Dependencies**: `ShowTimeService`.

**Public Methods**

| Method | HTTP | Path | Auth | Mục đích |
|---|---|---|---|---|
| `createSchedule()` | POST | `/api/schedules` | ADMIN/EMPLOYEE | Tạo 1 suất chiếu |
| `getAllSchedules()` | GET | `/api/schedules` | All | Danh sách suất chiếu |
| `getScheduleById()` | GET | `/api/schedules/{id}` | All | Chi tiết 1 suất |
| `getByMovieId()` | GET | `/api/schedules/movie/{id}` | All | Suất chiếu theo phim (tùy chọn lọc ngày) |
| `updateSchedule()` | PUT | `/api/schedules/{id}` | ADMIN/EMPLOYEE | Cập nhật suất |
| `deleteSchedule()` | DELETE | `/api/schedules/{id}` | ADMIN | Xóa suất |

---

### 4.6 ShowTimeService

**Purpose**

Quản lý toàn bộ vòng đời của suất chiếu: từ validation nghiệp vụ khi tạo mới đến quản lý ghế ngồi lazy-init.

**Responsibility**

- Validate ngày giờ chiếu (khung giờ, trước bao nhiêu ngày, không trùng).
- Tính `endTime` tự động.
- Orchestrate lazy-init của `ShowtimeSeat`.
- Xử lý lock ghế cho booking-service.

**Dependencies**

| Dependency | Lý do |
|---|---|
| `ShowTimeRepository` | CRUD và overlap-check queries |
| `ShowtimeSeatRepository` | Tạo/query ghế suất chiếu |
| `SeatRepository` | Lấy danh sách ghế vật lý của phòng để tạo ShowtimeSeat |
| `MovieRepository` | Kiểm tra movie tồn tại, lấy `durationMinutes` |
| `CinemaRoomRepository` | Kiểm tra phòng tồn tại và đang ACTIVE |
| `MovieMapper` | Map ShowTime entity → response DTO |

**Public Methods**

#### `getSeatsByShowtime(showtimeId)`
- **Purpose**: Trả sơ đồ ghế cho 1 suất chiếu.
- **Lazy-init Logic**:
  1. `showtimeSeatRepository.findByShowTimeId(showtimeId)`.
  2. Nếu danh sách rỗng (lần đầu gọi): load danh sách `Seat` từ phòng chiếu → tạo `ShowtimeSeat` cho mỗi ghế với `status = AVAILABLE`.
  3. Lưu batch, trả về danh sách.
- **Lý do lazy-init**: Tránh tạo hàng trăm `ShowtimeSeat` cho mỗi suất chiếu ngay khi tạo. Chỉ materialized khi thực sự cần.

#### `lockSeats(showtimeId, seatIds)`
- **Purpose**: Đặt ghế vào trạng thái `RESERVED` khi khách hàng chọn ghế.
- **Business Logic**:
  1. Với mỗi `seatId`: kiểm tra `ShowtimeSeat.status == AVAILABLE`. Nếu không → throw `SEAT_NOT_AVAILABLE`.
  2. Đặt `status = RESERVED`, lưu `reservedAt = now()`.
  3. Ghế tự giải phóng sau 15 phút (thực hiện phía booking-service, không phải scheduler trong module này).
- **Thiếu sót hiện tại (Gap #145)**: Không dùng pessimistic lock → race condition khi 2 request đồng thời lock cùng ghế. Cần thêm `@Lock(LockModeType.PESSIMISTIC_WRITE)` vào `ShowtimeSeatRepository`.

#### `createStandalone(CreateShowTimeRequest)`
- **Business Logic**:
  1. Validate `movieId` tồn tại → lấy `durationMinutes`.
  2. Validate `cinemaRoomId` tồn tại và đang `ACTIVE`.
  3. Gọi `validateStartTimes()` — kiểm tra 08:00–23:00.
  4. Gọi `validateShowDates()` — kiểm tra ≥ ngày hôm nay + 3.
  5. Gọi `validateLocalRequests()` — kiểm tra các suất trong batch không trùng nhau.
  6. Tính `endTime = startTime + durationMinutes`.
  7. Gọi `validateWithDatabase()` — kiểm tra overlap với DB.
  8. Save với `status = SCHEDULED`.
- **Transaction**: `@Transactional`.

#### `update(id, UpdateShowTimeRequest)`
- **Business Logic**: Tái chạy toàn bộ validation sau khi áp dụng thay đổi, sử dụng query `existsByCinemaRoomAndOverlappingTimeExcluding(id)` để bỏ qua chính suất đang cập nhật.

#### `deleteById(id)`
- **Business Rule**: Chỉ xóa được suất chiếu đã diễn ra (trong quá khứ). Nếu còn trong tương lai → throw `CANNOT_DELETE_FUTURE_SHOWTIME`.

---

### 4.7 CinemaClusterController

**Purpose**

Quản lý vòng đời của cụm rạp chiếu (một địa điểm vật lý). Tích hợp approval workflow tương tự phim.

**Responsibility**

- CRUD cụm rạp.
- Approval workflow (submit → approve/reject).
- Expose audit log của cluster.
- Validate tỉnh/thành phố qua `@ValidProvince`.

**Dependencies**: Repository trực tiếp (không có ClusterService riêng — logic đơn giản hơn MovieService).

**Public Methods**

| Method | Auth | Đặc điểm |
|---|---|---|
| `getAll(q, status)` | Public | Khách thấy `ACTIVE` only; ADMIN/EMPLOYEE thấy tất cả trạng thái |
| `create()` | ADMIN/EMPLOYEE | Status = DRAFT, validate `@ValidProvince` |
| `update(id)` | ADMIN/EMPLOYEE | EMPLOYEE chỉ sửa được DRAFT cluster |
| `delete(id)` | ADMIN | Chỉ xóa được cluster chưa có phòng chiếu nào |
| `submit(id)` | ADMIN/EMPLOYEE | DRAFT → PENDING_REVIEW |
| `approve(id)` | ADMIN | PENDING_REVIEW → ACTIVE |
| `reject(id)` | ADMIN | PENDING_REVIEW → DRAFT (kèm lý do) |
| `getAuditLog(clusterId)` | ADMIN | Lịch sử toàn bộ thao tác |

**Ghi chú**: `ClusterStatus` có 4 giá trị: `DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `INACTIVE`. Transition `ACTIVE ↔ INACTIVE` cho phép admin tắt/bật rạp mà không xóa dữ liệu.

---

### 4.8 CinemaRoomController & CinemaRoomService

**Purpose**

Quản lý phòng chiếu vật lý trong một cluster. Phòng có vòng đời riêng (trạng thái hoạt động/bảo trì) và liên kết với ghế ngồi.

**CinemaRoomService — Public Methods**

#### `createCinemaRoom(request)`
- **Business Logic**:
  1. Kiểm tra `clusterId` tồn tại và đang `ACTIVE`.
  2. Kiểm tra tên phòng chưa tồn tại trong hệ thống (global unique, không chỉ per-cluster).
  3. Kiểm tra số ghế ≤ giới hạn của `RoomType` (xem `RoomType` enum).
  4. Tạo `CinemaRoom` với `status = ACTIVE`.
  5. Gọi `SeatService.generateSeatsForRoom()`.
  6. Ghi audit log.
- **Transaction**: `@Transactional` — tạo phòng và sinh ghế là atomic.

#### `reportMaintenance(roomId, request, createdBy)`
- **Business Logic**:
  1. Tạo `CinemaRoomMaintenance` record với `status = OPEN`, `severity`, `description`.
  2. Chuyển `CinemaRoom.status = TEMPORARILY_UNAVAILABLE`.
- **Business Reason**: Phòng đang bảo trì không được tạo suất chiếu mới.

#### `resolveMaintenance(maintenanceId, note, resolvedBy)`
- **Business Logic**:
  1. Tìm maintenance record, đặt `status = RESOLVED`, lưu `resolvedNote`.
  2. Kiểm tra còn maintenance OPEN nào khác cho cùng phòng không.
  3. Nếu không còn → `CinemaRoom.status = ACTIVE`.
- **Lý do kiểm tra tất cả**: Một phòng có thể có nhiều sự cố đồng thời (điều hoà hỏng + máy chiếu lỗi). Chỉ phục hồi khi TẤT CẢ sự cố được giải quyết.

---

### 4.9 SeatController & SeatService

**Purpose**

Quản lý ghế vật lý của phòng chiếu (khác với `ShowtimeSeat` — ghế trong một suất cụ thể).

**SeatService — Public Methods**

#### `generateSeatsForRoom(room, defaultPrice)` (được gọi bởi CinemaRoomService)
- **Business Logic**: Sinh sơ đồ ghế dạng lưới dựa trên `room.roomType.seatsPerRow`.
  - Hàng: A, B, C, D, ... (tự động tính từ `totalSeats / seatsPerRow`).
  - Cột: 1, 2, 3, ... theo `seatsPerRow`.
  - Ví dụ: STANDARD (10 ghế/hàng) → A1–A10, B1–B10, ...
  - Tất cả ghế được tạo với `SeatType = STANDARD`, `price = defaultPrice`, `status = ACTIVE`.
- **Lý do**: Admin cần có điểm khởi đầu nhất quán. Sau đó có thể tùy chỉnh từng ghế (đổi thành VIP, thay giá).

#### `updateSeat(seatId, request)`
- **Purpose**: Admin điều chỉnh loại ghế và giá từng ghế riêng lẻ sau khi phòng được tạo.

#### `setSeatStatus(seatId, status)`
- **Purpose**: Đánh dấu ghế vào `MAINTENANCE` khi hỏng hóc.

---

### 4.10 GenreService & GenreController

**Purpose**

Quản lý danh mục thể loại phim — dữ liệu tham chiếu được dùng ở toàn bộ hệ thống.

**GenreService — Public Methods**

#### `create(genreName)`
- **Business Logic**:
  1. Sinh `genreCode` từ tên: chuẩn hóa Unicode NFD → loại bỏ dấu → uppercase → replace khoảng trắng bằng `_`.
  2. Ví dụ: `"Hành động"` → `"HANH_DONG"`.
  3. Kiểm tra `genreCode` chưa tồn tại → save.
- **Lý do sinh code từ tên**: `genreCode` dùng để ánh xạ với TMDB, phải ổn định. Việc sinh tự động từ tên (có chuẩn hóa) đảm bảo tính nhất quán.
- **Security**: Chỉ `ADMIN`.

#### `getAll()`, `getById(id)`
- Public, không yêu cầu auth.

---

### 4.11 AgeRatingController

**Purpose**

Quản lý danh mục phân loại độ tuổi theo chuẩn DCAV (Cục Điện ảnh Việt Nam): P, K, T13, T16, T18, C.

Không có service riêng — controller gọi trực tiếp repository (CRUD đơn giản, không có business rule phức tạp).

| Endpoint | Auth | Mô tả |
|---|---|---|
| `GET /api/age-ratings` | Public | Danh sách tất cả xếp hạng |
| `GET /api/age-ratings/{id}` | Public | Chi tiết 1 xếp hạng |
| `POST /api/age-ratings` | ADMIN | Tạo mới |
| `PUT /api/age-ratings/{id}` | ADMIN | Cập nhật |
| `DELETE /api/age-ratings/{id}` | ADMIN | Xóa |

---

### 4.12 ScreeningFormatController

**Purpose**

Quản lý danh mục định dạng chiếu (2D, 3D, IMAX, 4DX...). Mỗi định dạng có `surcharge` (phụ phí) so với giá cơ bản.

Không có service riêng — CRUD thuần.

---

### 4.13 PersonController

**Purpose**

Quản lý thông tin diễn viên/đạo diễn. Thường được tạo tự động khi import từ TMDB. Admin có thể tạo/sửa thủ công.

**Public Methods đáng chú ý**

- `search(q)` và `searchPerson(q)`: Hai endpoint tìm kiếm trả kết quả giống nhau. `/api/persons/search` được giữ lại vì `MovieModal` ở frontend đang dùng URL này. Đây là technical debt do refactor không đồng bộ Frontend/Backend.

---

### 4.14 ProductionCompanyController

**Purpose**

Quản lý thông tin công ty sản xuất phim. Được upsert tự động khi import TMDB.

**Lưu ý gap**: Hiện tại `Movie` chỉ có quan hệ `@ManyToOne` với `ProductionCompany` (1 công ty duy nhất). Thực tế 1 phim có thể có nhiều công ty đồng sản xuất. Đây là Gap #151 — cần đổi sang `@ManyToMany`.

---

### 4.15 AuditLogService

**Purpose**

Ghi nhật ký mọi hành động quan trọng lên bảng `movie_action_log`.

**Responsibility**

- Cung cấp một điểm duy nhất để ghi log, tránh logic lặp trong mỗi service.

**Public Methods**

#### `logAction(accountId, actor, note, content)`
- **Input**: `accountId` (ID người thực hiện), `actor` (tên/role, ví dụ `"SYSTEM"`), `note` (mô tả hành động), `content` (JSON snapshot nếu cần).
- **Không throw exception**: Log failure không được ảnh hưởng business flow chính.
- **Lưu ý**: Hiện tại không phân loại log theo `actionType` enum — mọi log đều có cùng cấu trúc. Gap #141.

---

### 4.16 MovieScheduler

**Purpose**

Tự động hóa các tác vụ định kỳ không cần tương tác người dùng.

**Responsibility**

- Chạy mỗi đêm lúc 00:05 AM để kết thúc các phim đã hết hạn.

**Public Methods**

#### `autoEndExpiredMovies()` — `@Scheduled(cron = "0 5 0 * * *")`
- **Business Logic**:
  1. `movieRepository.findByStatusAndEndDateBefore(NOW_SHOWING, LocalDate.now())`.
  2. Với mỗi phim: `movie.status = ENDED`.
  3. `auditLogService.logAction(null, "SYSTEM", "Auto-ended expired movie", ...)`.
- **Lý do chạy 00:05 thay vì 00:00**: Tránh xung đột với các batch job hệ thống khác thường chạy đúng nửa đêm.
- **`actor = "SYSTEM"`**: Phân biệt với hành động thủ công của admin trong audit log.

---

### 4.17 MovieMapper

**Purpose**

Compile-time mapping giữa Entity và DTO, sử dụng MapStruct. Không chứa business logic.

**Responsibility**

- Tạo code mapping tại build time (annotation processor).
- Xử lý các mapping phức tạp qua `@Mapping(source, target)`.

**Các mapping quan trọng**

| Mapping | Đặc điểm |
|---|---|
| `Movie → MovieResponse` | Flatten `company.name` → `companyName`; enum `status` → String |
| `CreateMovieRequest → Movie` | Bỏ qua `genres`, `formats`, `cast` (được set riêng trong service) |
| `UpdateMovieRequest → Movie` | `@BeanMapping(nullValuePropertyMappingStrategy = IGNORE)` — chỉ ghi đè non-null |
| `MovieCast → CastResponse` | Flatten `cast.person.personId`, `cast.person.fullName`, `cast.person.photoUrl` |
| `ShowTime → ShowTimeResponse` | Flatten movie info + room info từ nested entity |

**Lý do dùng MapStruct thay vì thủ công**

- Compile-time: lỗi mapping bị phát hiện khi build, không phải runtime.
- Không dùng reflection (khác ModelMapper) → hiệu năng tốt hơn.
- Code sinh ra dễ debug.

---

### 4.18 CloudinaryImageStorageService

**Purpose**

Implementation của `ImageStorageService` interface cho Cloudinary CDN.

**Lý do dùng Interface**

`ImageStorageService` là abstraction — `MovieService` không biết cụ thể đang dùng Cloudinary, AWS S3, hay local storage. Nếu sau này chuyển sang S3, chỉ cần tạo `S3ImageStorageService` và swap bean, không sửa `MovieService`.

**Public Methods**

#### `upload(MultipartFile)`
- Xác thực file type và size (layer 2 — layer 1 ở controller).
- Gọi Cloudinary SDK để upload.
- Trả về URL public của ảnh.

---

## 5. Entity / Model Analysis

### `Movie`

**Ý nghĩa nghiệp vụ**: Đại diện cho một bộ phim trong hệ thống. Là entity trung tâm của module.

| Field | Kiểu | Ý nghĩa nghiệp vụ |
|---|---|---|
| `tmdbId` | Long | ID trên TMDB. `@Column(unique=true)` — ngăn import trùng phim. |
| `imdbId` | String | ID trên IMDB. Lưu để reference, không dùng trong logic hiện tại. |
| `originalTitle` | String | Tên gốc (thường tiếng Anh hoặc ngôn ngữ sản xuất). |
| `originalLanguage` | String | ISO 639-1 (ví dụ: `"en"`, `"ko"`). |
| `durationMinutes` | Integer | Thời lượng — dùng để tính `endTime` của suất chiếu. |
| `releaseDate` | LocalDate | Ngày phát hành toàn cầu. |
| `endDate` | LocalDate | Ngày kết thúc chiếu tại Việt Nam. Scheduler dùng để auto-end. |
| `ageRating` | FK → AgeRating | Xếp hạng DCAV. Bắt buộc theo quy định pháp lý. |
| `company` | FK → ProductionCompany | Công ty sản xuất (hiện tại chỉ 1 — gap #151). |
| `posterUrl`, `thumbnailUrl`, `trailerUrl` | String | URL trên Cloudinary/YouTube. Không lưu binary. |
| `synopsis` | Text | Tóm tắt nội dung. |
| `status` | `MovieStatus` enum | 7-state lifecycle. |
| `suspendedReason` | String | Lý do tạm dừng — null khi không bị suspend. |
| `rejectionNote` | String | Lý do từ chối — null khi chưa bị reject. |
| `genres` | `@ManyToMany` → Genre | Một phim có nhiều thể loại. Join table `movie_genre`. |
| `formats` | `@ManyToMany` → ScreeningFormat | Định dạng chiếu. Join table `movie_format`. |
| `translations` | `@OneToMany(cascade=ALL)` → MovieTranslation | Bản dịch đa ngôn ngữ. Cascade ALL: xóa phim → xóa translations. |
| `cast` | `@OneToMany(cascade=ALL)` → MovieCast | Diễn viên/đạo diễn của phim. |
| `images` | `@OneToMany(cascade=ALL, @OrderBy displayOrder)` | Ảnh phim, sắp xếp theo `displayOrder`. |
| `createdBy`, `updatedBy` | String | Audit field — ID của người tạo/cập nhật cuối. |

**Tại sao `genres` dùng `@ManyToMany`**: Một phim có nhiều thể loại (Action + Thriller + Sci-Fi). Một thể loại thuộc nhiều phim. Không có business attribute trên join nên `@ManyToMany` là đúng.

**Tại sao `translations` dùng `cascade=ALL`**: Translation chỉ có ý nghĩa trong context của phim. Khi phim bị xóa (ENDED), translation không còn cần thiết. Cascade ALL đảm bảo không có orphan record.

---

### `MovieTranslation`

**Ý nghĩa**: Lưu thông tin phim theo từng ngôn ngữ (tiêu đề địa phương, mô tả).

| Field | Ý nghĩa |
|---|---|
| `id` | Composite PK: `MovieTranslationId(movie_id, language_code)` |
| `language_code` | ISO 639-1, length 2 (ví dụ: `"vi"`, `"en"`). `@Column(length=2)` enforce constraint. |
| `localTitle` | Tên phim trong ngôn ngữ đó (ví dụ: `"Người Nhện"` cho `vi`). |
| `overview` | Tóm tắt nội dung theo ngôn ngữ đó. |

**Tại sao composite PK**: Không cần surrogate key — cặp `(movie_id, language_code)` đã đảm bảo uniqueness. Thiết kế này phản ánh đúng semantics: mỗi phim chỉ có 1 bản dịch mỗi ngôn ngữ.

---

### `ShowTime`

**Ý nghĩa**: Đại diện cho 1 suất chiếu cụ thể — phim X chiếu tại phòng Y vào thời điểm Z.

| Field | Ý nghĩa |
|---|---|
| `movie` | `@ManyToOne` → Movie |
| `cinemaRoom` | `@ManyToOne` → CinemaRoom |
| `startTime` | LocalDateTime — do admin nhập |
| `endTime` | LocalDateTime — **tự động tính** = startTime + durationMinutes |
| `status` | `ShowTimeStatus` enum: SCHEDULED, ON_SALE, CANCELLED, COMPLETED, SUSPENDED |
| `format` | FK → ScreeningFormat (định dạng chiếu của suất này) |

**Tại sao `endTime` được persist**: Dù có thể tính từ `startTime + movie.durationMinutes`, việc persist `endTime` giúp overlap query đơn giản hơn và tránh JOIN phức tạp. Trade-off: nếu `durationMinutes` thay đổi, `endTime` cũ không tự cập nhật (acceptable — thay đổi thời lượng phim sau khi lên lịch là edge case hiếm).

---

### `ShowtimeSeat`

**Ý nghĩa**: Trạng thái của một ghế trong một suất chiếu cụ thể. Không phải ghế vật lý (đó là `Seat`).

| Field | Ý nghĩa |
|---|---|
| `showTime` | FK → ShowTime |
| `seat` | FK → Seat (ghế vật lý) |
| `status` | `ShowtimeSeatStatus`: AVAILABLE, RESERVED, SOLD, MAINTENANCE |
| `bookingId` | **VARCHAR (UUID string)** — ID từ booking-service. Không phải DB FK. |
| `reservedAt` | Timestamp khi ghế được RESERVED. Dùng để tính hết hạn 15 phút. |

**Tại sao `bookingId` là String**: booking-service và movie-service dùng database riêng biệt. Cross-database FK không được hỗ trợ. Lưu UUID string là pattern phổ biến trong microservices để cross-reference mà không tạo coupling DB.

**Tại sao không tạo ShowtimeSeat ngay**: Một suất chiếu có thể 100–300 ghế. Nếu tạo ngay khi lên lịch, với hàng chục suất mỗi ngày, sẽ tạo hàng nghìn rows không cần thiết (nhiều suất không bao giờ được truy cập để đặt vé).

---

### `CinemaCluster`

**Ý nghĩa**: Một địa điểm rạp chiếu phim vật lý (ví dụ: "CGV Hà Đông").

| Field | Ý nghĩa |
|---|---|
| `name` | Tên thương mại của cụm rạp |
| `province` | Tỉnh/thành phố — validated bởi `@ValidProvince` |
| `address` | Địa chỉ đầy đủ |
| `latitude`, `longitude` | Tọa độ để tích hợp bản đồ |
| `status` | `ClusterStatus`: DRAFT → PENDING_REVIEW → ACTIVE ↔ INACTIVE |
| `rooms` | `@OneToMany` → CinemaRoom |

---

### `CinemaRoom`

**Ý nghĩa**: Một phòng chiếu trong cluster.

| Field | Ý nghĩa |
|---|---|
| `cluster` | `@ManyToOne` → CinemaCluster |
| `roomName` | Tên phòng (unique trong hệ thống) |
| `roomType` | `RoomType` enum: STANDARD, LARGE, IMAX — quyết định giới hạn ghế và seatsPerRow |
| `totalSeats` | Tổng số ghế, phải ≤ giới hạn của `roomType` |
| `status` | `CinemaRoomStatus` |
| `seats` | `@OneToMany(cascade=ALL)` → Seat |
| `maintenanceRecords` | `@OneToMany` → CinemaRoomMaintenance |

---

### `Seat`

**Ý nghĩa**: Ghế vật lý trong phòng chiếu. Tồn tại độc lập với suất chiếu.

| Field | Ý nghĩa |
|---|---|
| `room` | FK → CinemaRoom |
| `seatRow` | Hàng ghế (A, B, C...) |
| `seatNumber` | Số thứ tự trong hàng (1, 2, 3...) |
| `seatType` | `SeatType` enum: STANDARD, VIP, COUPLE |
| `price` | Giá cơ bản của ghế. `ShowtimeSeat` kế thừa hoặc override giá này. |
| `status` | `SeatStatus`: ACTIVE, MAINTENANCE, INACTIVE |

---

### `Person`

**Ý nghĩa**: Diễn viên, đạo diễn hoặc thành viên đoàn làm phim.

| Field | Ý nghĩa |
|---|---|
| `tmdbId` | ID trên TMDB — dùng để upsert (tránh tạo trùng). `@Column(unique=true)`. |
| `fullName` | Tên đầy đủ |
| `photoUrl` | URL ảnh đại diện (từ TMDB hoặc upload thủ công) |

---

### `MovieCast`

**Ý nghĩa**: Bản ghi thành viên đoàn làm phim trong một bộ phim cụ thể.

| Field | Ý nghĩa |
|---|---|
| `movie` | FK → Movie |
| `person` | FK → Person |
| `characterName` | Tên nhân vật (nullable cho đạo diễn/nhà sản xuất) |
| `roleType` | String: "ACTOR", "DIRECTOR", "PRODUCER"... — Gap #142: nên là enum |
| `castOrder` | Thứ tự xuất hiện trong danh sách. TMDB trả theo billing order. |

---

### `ClusterAuditLog`

**Ý nghĩa**: Nhật ký kiểm toán cho mọi thao tác trên `CinemaCluster`.

| Field | Ý nghĩa |
|---|---|
| `cluster` | FK → CinemaCluster |
| `action` | `ClusterAction` enum: CREATED, SUBMITTED, APPROVED, REJECTED, ACTIVATED, DEACTIVATED |
| `performedBy` | ID người thực hiện |
| `note` | Ghi chú (lý do từ chối, lý do tạm ngưng...) |
| `createdAt` | Timestamp |

---

## 6. DTO Analysis

### `CreateMovieRequest`

**Use case**: Tạo phim mới (thủ công hoặc qua import TMDB).

| Field | Validation | Business Rule |
|---|---|---|
| `title` | `@NotBlank` | Tên phim không được rỗng. Kiểm tra unique trong service. |
| `originalTitle` | `@NotBlank` | Tên gốc bắt buộc cho phim ngoại. |
| `durationMinutes` | `@Min(1)` | Thời lượng phải dương — dùng để tính endTime. |
| `releaseDate` | `@NotNull` | Bắt buộc để lên lịch suất chiếu. |
| `endDate` | Nullable | Không có endDate → phim không bao giờ tự kết thúc qua scheduler. |
| `ageRatingId` | Nullable (UI) | Phim import TMDB có thể không resolve được rating. |
| `genreIds` | List | Có thể rỗng nhưng khuyến khích có ít nhất 1. |
| `castList` | List `CastRequest` | Danh sách diễn viên — mỗi item gồm `personId`, `characterName`, `roleType`, `castOrder`. |
| `translations` | List `TranslationRequest` | Bản dịch — gồm `languageCode`, `localTitle`, `overview`. |

**Tại sao không dùng Entity trực tiếp**: Entity chứa `@OneToMany` collections — serialize thẳng Entity gây vòng lặp vô hạn (Jackson). Entity cũng chứa các field nội bộ (`status`, `createdAt`) không nên nhận từ client.

---

### `UpdateMovieRequest`

**Use case**: Cập nhật thông tin phim.

Giống `CreateMovieRequest` nhưng mọi field đều nullable — partial update. `MovieMapper` dùng `nullValuePropertyMappingStrategy = IGNORE` để chỉ ghi đè non-null field.

---

### `MovieResponse`

**Use case**: Trả về chi tiết phim cho mọi GET request.

| Field đặc biệt | Nguồn gốc |
|---|---|
| `companyName` | Flatten từ `movie.company.name` (tránh nested object) |
| `ageRatingCode` | Flatten từ `movie.ageRating.code` (ví dụ: `"T13"`) |
| `genres` | List `GenreResponse` (id + name + code) |
| `cast` | List `CastResponse` (personId + name + photo + character + role) |
| `translations` | List `TranslationResponse` — có thể bị filter theo `lang` param |
| `images` | List `MovieImageResponse` (url + imageType + displayOrder) |

---

### `CreateShowTimeRequest`

**Use case**: Tạo suất chiếu mới.

| Field | Validation | Business Rule |
|---|---|---|
| `movieId` | `@NotNull` | Phim phải tồn tại. |
| `cinemaRoomId` | `@NotNull` | Phòng phải ACTIVE. |
| `startTime` | `@NotNull`, `@Future` | Không tạo suất trong quá khứ. |
| `formatId` | `@NotNull` | Định dạng chiếu bắt buộc (ảnh hưởng giá vé). |

**`endTime` không có trong request** — tính tự động server-side.

---

### `CreateCinemaClusterRequest`

| Field | Validation | Business Rule |
|---|---|---|
| `name` | `@NotBlank` | Tên rạp |
| `province` | `@ValidProvince` | Phải là 1 trong 63 tỉnh/thành phố Việt Nam |
| `address` | `@NotBlank` | Địa chỉ đầy đủ |
| `latitude`, `longitude` | `@NotNull` | Tọa độ bắt buộc để hiển thị bản đồ |

---

## 7. Business Flow

### Flow 1: Vòng đời phim (Movie Lifecycle)

```
[EMPLOYEE] Nhập thông tin phim
          POST /api/movies
              │
              ▼
        Movie.status = DRAFT
        (không hiện với khách)
              │
    [EMPLOYEE] Submit để duyệt
    POST /api/movies/{id}/submit
              │
              ▼
     Movie.status = PENDING_REVIEW
              │
      ┌───────┴────────┐
      │                │
[ADMIN] Approve    [ADMIN] Reject (kèm lý do)
      │                │
      ▼                ▼
COMING_SOON         REJECTED
(hiện với khách,     (lưu rejectionNote)
 chưa bán vé)            │
      │          [EMPLOYEE] Rework
      │                │
      │                ▼
      │              DRAFT
      │          (sửa → submit lại)
      │
[ADMIN] Release (khi ngày chiếu đến)
      │
      ▼
 NOW_SHOWING
 (bán vé được)
      │
  ┌───┴────────┐
  │            │
[ADMIN]    [Scheduler 00:05]
Suspend    endDate < today
  │            │
  ▼            ▼
SUSPENDED    ENDED
  │       (soft delete)
[ADMIN]
Reinstate
  │
  ▼
NOW_SHOWING
```

---

### Flow 2: Import phim từ TMDB

```
[ADMIN] Tìm kiếm
GET /api/movies/tmdb/search?q=keyword
    │
    ▼
TmdbService gọi TMDB /search/movie
    │ Trả danh sách preview (chưa lưu DB)
    ▼
[ADMIN] Chọn 1 kết quả → Xem chi tiết
GET /api/movies/tmdb/{tmdbId}/details
    │
    ▼
TmdbService gọi 4 TMDB endpoints
+ Upsert Person, ProductionCompany vào DB
+ Resolve AgeRating (VN → US fallback)
+ Resolve Genres (TMDB ID → local code)
    │ Trả TmdbMoviePreview DTO
    ▼
[ADMIN] Xác nhận → Import
POST /api/movies/tmdb/import
    │
    ▼
Kiểm tra tmdbId chưa import
    │
    ▼
Tạo Movie (status=DRAFT)
+ Lưu translations (vi + en)
+ Lưu cast (top 15 + directors)
+ Gán format 2D mặc định
    │
    ▼
[ADMIN] Tiếp tục workflow phê duyệt
```

---

### Flow 3: Thiết lập cơ sở vật chất

```
[ADMIN] Tạo Cluster
POST /api/cinema-clusters
    │ status=DRAFT
    ▼
[ADMIN] Submit → Approve
    │ status=ACTIVE
    ▼
[ADMIN] Tạo phòng chiếu
POST /api/cinema-rooms
    │
    ▼
CinemaRoomService.createCinemaRoom()
    ├── Kiểm tra cluster ACTIVE
    ├── Kiểm tra tên phòng unique
    ├── Kiểm tra totalSeats ≤ limit
    ├── Tạo CinemaRoom (status=ACTIVE)
    └── SeatService.generateSeatsForRoom()
            │ Sinh ghế tự động theo lưới
            ▼
[ADMIN] Tùy chỉnh từng ghế (nếu cần)
PUT /api/seats/{id}
```

---

### Flow 4: Đặt ghế (từ góc nhìn movie-service)

```
[CUSTOMER] Vào trang chọn ghế
GET /api/showtimes/{id}/seats
    │
    ▼
ShowtimeSeatRepository.findByShowTimeId()
    │
    ├── [Có data] → Trả danh sách trực tiếp
    │
    └── [Rỗng - lần đầu] → Lazy-init:
            Load Seat[] từ phòng chiếu
            → Tạo ShowtimeSeat cho mỗi ghế (AVAILABLE)
            → Save batch
            → Trả danh sách
    │
    ▼
[Frontend] Render sơ đồ ghế
    │
[CUSTOMER] Chọn ghế → gửi booking-service
    │
[booking-service] Lock ghế
PUT /api/showtimes/{id}/seats/lock
    │
    ▼
ShowTimeService.lockSeats()
    ├── Kiểm tra từng ghế: status == AVAILABLE?
    │       └── Nếu không: throw SEAT_NOT_AVAILABLE
    └── Đặt status = RESERVED
        reservedAt = now()
    │
    ▼
[booking-service] Xử lý thanh toán
    │
    ├── [Thanh toán thành công]
    │   → Cập nhật bookingId, status = SOLD
    │
    └── [Quá 15 phút / thất bại]
        → Ghế tự động AVAILABLE khi query lần sau
          (dựa trên reservedAt + 15 phút)
```

---

## 8. Sequence of Operations

### 8.1 Tạo phim mới (createMovie)

1. Client gửi `POST /api/movies` với `CreateMovieRequest`.
2. Spring Security kiểm tra token JWT, xác nhận role `ADMIN` hoặc `EMPLOYEE`.
3. `@Valid` kiểm tra constraint annotation trên DTO (NotBlank, Min, ...).
4. `MovieController.createMovie()` gọi `MovieService.createMovie(request)`.
5. `MovieService` gọi `movieRepository.existsByTitle(title)` — throw nếu trùng.
6. `MovieService` resolve `ageRatingId` → `AgeRating` entity.
7. `MovieService` resolve `companyId` → `ProductionCompany` entity (nếu không null).
8. `MovieService` resolve danh sách `genreIds` → List`<Genre>`.
9. `MovieService` resolve danh sách `formatIds` → List`<ScreeningFormat>`.
10. `MovieMapper.toEntity(request)` tạo `Movie` object với `status = DRAFT`.
11. Set `genres`, `formats`, `ageRating`, `company` vào entity.
12. `movieRepository.save(movie)` — JPA trigger `@PrePersist` → set `createdAt`, `updatedAt`.
13. `saveTranslations(movie, request.translations)` — lưu từng `MovieTranslation`.
14. `saveCast(movie, request.castList)` — lưu từng `MovieCast`.
15. `auditLogService.logAction(actorId, actorName, "Created movie", ...)`.
16. `MovieMapper.toResponse(movie)` → `MovieResponse`.
17. Controller trả `ResponseEntity.status(201).body(response)`.

---

### 8.2 Import phim từ TMDB (importMovie)

1. Client gửi `POST /api/movies/tmdb/import` với `{ tmdbId: 12345 }`.
2. `TmdbService.importMovie(12345)`.
3. `movieRepository.existsByTmdbId(12345)` — nếu đã import → throw `MOVIE_ALREADY_IMPORTED`.
4. `fetchMovieDetail(12345)` — gọi TMDB `/movie/12345`.
5. `fetchCredits(12345)` — gọi TMDB `/movie/12345/credits`.
6. `fetchTranslations(12345)` — gọi TMDB `/movie/12345/translations`.
7. `fetchReleaseDates(12345)` — gọi TMDB `/movie/12345/release_dates`.
8. `upsertCompany()` cho từng production company trong kết quả.
9. `upsertPerson()` cho từng cast/crew trong credits.
10. `resolveAgeRating(releaseDates)` — ưu tiên `"VN"`, fallback `"US"` + convert.
11. `resolveGenres(tmdbGenres)` — map TMDB ID → local Genre entity.
12. Tạo `Movie` entity, set `status = DRAFT`, `tmdbId`, `format = [2D]`.
13. `saveTranslations()` — lưu bản dịch `"vi"` và `"en"`.
14. `saveCast()` — lưu top 15 diễn viên (ordered by `castOrder`) + các `DIRECTOR`.
15. `movieRepository.save(movie)`.
16. Return `ImportMovieResponse { movieId, translationCount, castCount, companiesUpserted }`.

---

### 8.3 Tạo suất chiếu (createStandalone)

1. Client gửi `POST /api/schedules` với `CreateShowTimeRequest`.
2. `ShowTimeService.createStandalone(request)`.
3. Kiểm tra `movieId` tồn tại → lấy `durationMinutes`.
4. Kiểm tra `movie.status` ∈ {`COMING_SOON`, `NOW_SHOWING`} — phim phải được approve.
5. Kiểm tra `cinemaRoomId` tồn tại, `status == ACTIVE`.
6. `validateStartTimes([request])`: `startTime.toLocalTime()` phải ∈ [08:00, 23:00].
7. `validateShowDates([request])`: `startTime.toLocalDate()` ≥ `today + 3 days`.
8. Tính `endTime = startTime + durationMinutes minutes`.
9. `validateLocalRequests([request], durationMinutes)`: nếu batch nhiều suất → kiểm tra chéo.
10. `validateWithDatabase([request], durationMinutes)`: gọi `showTimeRepository.existsByCinemaRoomAndOverlappingTime(roomId, startTime, endTime)`.
11. Nếu overlap → throw `SHOWTIME_OVERLAPPING`.
12. Build `ShowTime` entity, save với `status = SCHEDULED`.
13. Return `ShowTimeResponse`.

---

## 9. Validation Rules

### 9.1 Phim

| Field | Rule | Lý do nghiệp vụ |
|---|---|---|
| `title` | NotBlank | Tên phim là định danh chính |
| `title` | Unique (service-level) | Tránh nhập nhầm/trùng phim |
| `originalTitle` | NotBlank | Bắt buộc theo chuẩn nhận diện phim quốc tế |
| `durationMinutes` | Min(1) | Âm hoặc 0 không có ý nghĩa. Dùng để tính endTime. |
| `releaseDate` | NotNull | Bắt buộc để lên lịch suất chiếu |
| `ageRating` | Không validate null (service accept null) | Phim import TMDB có thể chưa có rating |
| MIME type ảnh | JPEG / PNG / WebP only | Định dạng web-safe, Cloudinary optimize tốt |
| Kích thước ảnh | ≤ 5MB | Giới hạn upload hợp lý cho poster phim |

### 9.2 Suất chiếu

| Field | Rule | Lý do nghiệp vụ |
|---|---|---|
| `startTime` | @Future | Không tạo suất đã qua |
| `startTime` | `toLocalTime()` ∈ [08:00, 23:00] | Khung giờ hoạt động của rạp |
| `startTime` | `toLocalDate()` ≥ today + 3 | Đủ thời gian chuẩn bị và thông báo khách hàng |
| Room + Time | No overlap với DB | Phòng không thể chiếu 2 phim cùng lúc |
| `cinemaRoom.status` | == ACTIVE | Phòng bảo trì không được nhận suất mới |
| `movie.status` | ∈ {COMING_SOON, NOW_SHOWING} | Phim chưa approve không được lên lịch |

### 9.3 Cụm rạp

| Field | Rule | Lý do nghiệp vụ |
|---|---|---|
| `province` | @ValidProvince | Đảm bảo dữ liệu địa lý nhất quán, tránh typo |
| `totalSeats` | ≤ RoomType limit | Ràng buộc vật lý của loại phòng |
| Xóa cluster | Không có phòng | Tránh orphan CinemaRoom |

### 9.4 @ValidProvince

- Annotation custom JSR-380, validator class `ProvinceValidator`.
- So sánh không phân biệt hoa/thường với danh sách 63 tỉnh/thành phố hardcoded.
- Lý do hardcode: Danh sách tỉnh Việt Nam ổn định (thay đổi rất hiếm — cần update code khi có tỉnh mới).

---

## 10. Error Handling

Tất cả exception được định nghĩa trong `MovieErrorCode` enum. Pattern: `throw new MovieException(MovieErrorCode.XYZ)`.

### Nhóm Phim (2001–2010)

| Code | Khi nào | Business Impact |
|---|---|---|
| `MOVIE_NOT_FOUND` (2001) | Tìm phim không tồn tại | Client gọi sai ID |
| `MOVIE_TITLE_ALREADY_EXISTS` (2002) | Title trùng khi tạo mới | Tránh nhập trùng phim |
| `INVALID_STATUS_TRANSITION` (2003) | Chuyển trạng thái sai thứ tự | Bảo vệ workflow |
| `MOVIE_HAS_ACTIVE_SHOWTIMES` (2004) | Xóa phim còn suất tương lai | Tránh mất lịch chiếu |
| `MOVIE_ALREADY_IMPORTED` (2005) | Import TMDB phim đã có | Tránh duplicate TMDB import |

### Nhóm Suất chiếu (2011–2018)

| Code | Khi nào | Business Impact |
|---|---|---|
| `SHOWTIME_NOT_FOUND` (2011) | Suất không tồn tại | |
| `SHOWTIME_OVERLAPPING` (2012) | Trùng giờ với suất khác trong phòng | Ràng buộc vật lý phòng chiếu |
| `SHOWTIME_OUTSIDE_BUSINESS_HOURS` (2013) | Ngoài khung 08:00–23:00 | |
| `SHOWTIME_TOO_SOON` (2014) | Lịch chiếu < 3 ngày tới | |
| `SEAT_NOT_AVAILABLE` (2015) | Lock ghế đã RESERVED/SOLD | Race condition booking |
| `CANNOT_DELETE_FUTURE_SHOWTIME` (2016) | Xóa suất chưa diễn ra | |

### Nhóm Rạp (2019–2026)

| Code | Khi nào | Business Impact |
|---|---|---|
| `CLUSTER_NOT_FOUND` (2019) | Cluster không tồn tại | |
| `ROOM_NOT_FOUND` (2020) | Phòng không tồn tại | |
| `ROOM_NAME_ALREADY_EXISTS` (2021) | Tên phòng trùng | |
| `SEATS_EXCEED_ROOM_CAPACITY` (2022) | Số ghế > giới hạn loại phòng | |
| `CLUSTER_NOT_ACTIVE` (2023) | Tạo phòng trong cluster chưa active | |
| `ROOM_NOT_ACTIVE` (2024) | Tạo suất trong phòng bảo trì | |

### Nhóm External (5000–5002)

| Code | Khi nào |
|---|---|
| `TMDB_API_ERROR` (5000) | TMDB API trả lỗi hoặc không kết nối được |
| `CLOUDINARY_UPLOAD_ERROR` (5001) | Upload ảnh thất bại |
| `INVALID_IMAGE_FORMAT` (5002) | MIME type không hợp lệ |

---

## 11. Security Considerations

### Authentication

Tất cả endpoint bảo vệ được xác thực qua JWT token. Token được parse và inject bởi `auth-service` (không trong module này). `movie-service` nhận `accountId` và `roles` từ token đã được xác thực.

### Authorization — RBAC tại endpoint level

```java
@PreAuthorize("hasRole('ADMIN')")
@PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
```

| Nhóm endpoint | ADMIN | EMPLOYEE | Public |
|---|---|---|---|
| Phê duyệt/từ chối phim | ✅ | ❌ | ❌ |
| Tạo/sửa phim | ✅ | ✅ | ❌ |
| Xem phim công khai | ✅ | ✅ | ✅ |
| Quản lý rạp | ✅ | ✅ (giới hạn) | ❌ |
| Tạo thể loại | ✅ | ❌ | ❌ |
| Import TMDB | ✅ | ❌ | ❌ |
| Xem lịch chiếu | ✅ | ✅ | ✅ |

### Data Visibility

- `GET /api/movies/public`: Chỉ trả `COMING_SOON` và `NOW_SHOWING` — khách hàng không bao giờ thấy `DRAFT`, `SUSPENDED`, `REJECTED`, `ENDED`.
- `GET /api/cinema-clusters?status=`: Khách hàng chỉ thấy `ACTIVE` cluster; ADMIN/EMPLOYEE thấy tất cả trạng thái.

### Input Validation

- Bean Validation (`@Valid`) ở tầng controller cho tất cả request body.
- Custom validator (`@ValidProvince`) cho trường địa lý.
- File upload: kiểm tra MIME type + size trước khi upload lên Cloudinary (tránh lãng phí storage).

### Potential Security Gaps

- **Không có rate limiting** trên TMDB search endpoint — có thể bị lạm dụng để gọi TMDB API vượt quota.
- **Không có ownership check** trên entity: bất kỳ EMPLOYEE nào đều có thể sửa phim của EMPLOYEE khác. Chỉ được giới hạn bởi role, không có object-level permission.

---

## 12. Design Decisions

### D1: Tại sao dùng 7-state Enum cho Movie lifecycle?

Boolean `isActive` không đủ biểu diễn: một phim có thể ở DRAFT, chờ duyệt, bị từ chối, sắp chiếu, đang chiếu, tạm dừng, hoặc kết thúc. Enum buộc code phải xử lý từng trạng thái rõ ràng, không thể bỏ qua. Nếu thêm trạng thái mới → compiler báo lỗi tại mọi `switch` statement chưa handle.

### D2: Tại sao soft-delete (ENDED) thay vì xóa vật lý?

`Movie` có quan hệ `@OneToMany` với `ShowtimeSeat`, và `ShowtimeSeat.bookingId` trỏ về booking-service. Xóa `Movie` → xóa cascade `ShowTime` → xóa `ShowtimeSeat` → booking-service mất tham chiếu. Soft-delete bảo toàn toàn bộ lịch sử transaction.

### D3: Tại sao MapStruct thay vì viết mapper thủ công hoặc ModelMapper?

- **vs thủ công**: Code mapping Entity ↔ DTO lặp đi lặp lại, dễ quên field khi thêm column mới.
- **vs ModelMapper**: ModelMapper dùng reflection → lỗi xảy ra runtime. MapStruct sinh code tại compile time → lỗi xuất hiện khi build.
- **Performance**: MapStruct sinh code Java thuần, không reflection → nhanh hơn ModelMapper.

### D4: Tại sao ShowtimeSeat được khởi tạo lazy?

Mỗi suất chiếu có 100–300 ghế. Nếu tạo ngay khi lên lịch (với vài chục suất/ngày) → tạo hàng nghìn rows không cần thiết. Lazy-init chỉ materialized khi có request thực sự vào trang chọn ghế — thực tế nhiều suất (giờ chiếu ít người, suất đặc biệt) không bao giờ được truy cập để đặt vé.

### D5: Tại sao endTime được persist thay vì tính on-the-fly?

Nếu không persist, overlap check phải JOIN với `movie` để lấy `durationMinutes` mỗi lần query — phức tạp và chậm. Trả về `endTime` trong response cũng trực tiếp hơn là để client tự tính. Trade-off: nếu `durationMinutes` thay đổi, `endTime` của suất cũ không tự cập nhật — acceptable vì thời lượng phim hiếm khi thay đổi sau khi lên lịch.

### D6: Tại sao bookingId trong ShowtimeSeat là String (không phải FK)?

Cross-database FK không khả thi trong microservices architecture. `booking-service` có database riêng. Lưu UUID string là pattern phổ biến để cross-reference giữa services mà không tạo coupling DB. Nếu cần join data → application-level join hoặc event sourcing.

### D7: Tại sao `ImageStorageService` là Interface?

Dependency Inversion Principle: `MovieService` phụ thuộc vào abstraction, không phụ thuộc Cloudinary. Nếu sau này chuyển sang AWS S3 → implement `S3ImageStorageService`, swap `@Primary` bean, không cần sửa `MovieService`.

### D8: Tại sao upsert (không phải insert) cho Person/Company khi import TMDB?

Hai phim khác nhau có thể có cùng diễn viên. Nếu insert mới mỗi lần → database đầy bản ghi trùng. Upsert theo `tmdbId` đảm bảo mỗi person chỉ tồn tại 1 lần, tất cả phim cùng trỏ về entity đó.

---

## 13. Business Rules Summary

| Mã | Tên | Mô tả | Lý do | Ảnh hưởng |
|---|---|---|---|---|
| BR-01 | Movie Status Machine | Phim chỉ được chuyển trạng thái theo thứ tự định nghĩa | Đảm bảo quy trình kiểm duyệt không bị bypass | Exception `INVALID_STATUS_TRANSITION` khi vi phạm |
| BR-02 | Soft Delete Only | Phim không bị xóa vật lý — luôn chuyển sang ENDED | Bảo toàn lịch sử booking và audit | DELETE endpoint không xóa row khỏi DB |
| BR-03 | No Delete With Future Showtimes | Không được kết thúc/xóa phim còn suất tương lai | Tránh mất lịch chiếu khách đã mua vé | Exception `MOVIE_HAS_ACTIVE_SHOWTIMES` |
| BR-04 | Auto-End Expired Movies | Scheduler tự động ENDED phim hết endDate | Admin không cần theo dõi thủ công từng phim | Job chạy 00:05 daily |
| BR-05 | Showtime Business Hours | Suất chiếu phải bắt đầu trong 08:00–23:00 | Khung giờ hoạt động thực tế của rạp | Exception `SHOWTIME_OUTSIDE_BUSINESS_HOURS` |
| BR-06 | Showtime 3-Day Lead | Suất phải lên lịch ≥ 3 ngày trước | Đủ thời gian chuẩn bị và marketing | Exception `SHOWTIME_TOO_SOON` |
| BR-07 | No Room Overlap | Không 2 suất chiếu chồng giờ trong cùng phòng | Ràng buộc vật lý | Exception `SHOWTIME_OVERLAPPING` |
| BR-08 | Auto EndTime | endTime = startTime + durationMinutes (server-side) | Tránh nhập sai, đảm bảo nhất quán | Client không nhập endTime |
| BR-09 | Cluster Approval | Cluster phải qua DRAFT → PENDING_REVIEW → ACTIVE | Kiểm soát chất lượng địa điểm | Phòng chỉ tạo được trong ACTIVE cluster |
| BR-10 | Province Validation | Tỉnh/thành phải thuộc 63 đơn vị hành chính VN | Nhất quán dữ liệu địa lý | Exception validation |
| BR-11 | Room Capacity Limit | `totalSeats` ≤ giới hạn của `RoomType` | Ràng buộc vật lý phòng chiếu | Exception `SEATS_EXCEED_ROOM_CAPACITY` |
| BR-12 | Lazy Seat Init | ShowtimeSeat chỉ tạo khi lần đầu có request xem ghế | Tối ưu hiệu năng | `getSeatsByShowtime()` có side effect |
| BR-13 | DCAV Age Rating | Phim phải có mã phân loại DCAV khi công chiếu | Quy định pháp lý VN | Import TMDB tự động resolve, có thể null |
| BR-14 | No Duplicate TMDB Import | Không import 2 lần cùng 1 phim TMDB | Tránh duplicate data | Check `tmdbId` unique trước import |
| BR-15 | Upsert Person/Company | Tìm trước khi tạo Person/Company từ TMDB | Tránh duplicate diễn viên | `upsertPerson()`, `upsertCompany()` |

---

## 14. Dependency Summary

| Dependency | Version | Sử dụng để làm gì trong module này |
|---|---|---|
| **Spring Boot Web** | 3.x | HTTP layer, REST controller, request/response serialization |
| **Spring Data JPA** | 3.x | ORM, Repository pattern, JPQL custom queries |
| **Spring Security** | 6.x | `@PreAuthorize`, JWT filter, RBAC tại endpoint |
| **MapStruct** | 1.5.x | Compile-time Entity ↔ DTO mapping |
| **Bean Validation (Hibernate Validator)** | 8.x | `@NotBlank`, `@Min`, `@Valid`, custom `@ValidProvince` |
| **MySQL Connector** | 8.x | Driver kết nối MySQL `movie_db` |
| **Cloudinary SDK** | — | Upload ảnh phim lên Cloudinary CDN |
| **Spring RestTemplate** | — | Gọi TMDB external API (5 endpoints) |
| **Spring Scheduling** | Built-in | `@Scheduled` cho nightly job `autoEndExpiredMovies` |
| **Lombok** | — | Giảm boilerplate (constructor, getter, builder) |

---

## 15. Key Takeaways

### Module này làm gì

`movie-service` là nguồn dữ liệu chủ (single source of truth) cho toàn bộ nội dung phim và cơ sở vật chất rạp trong hệ thống CinePrime. Nó không chỉ là CRUD — nó enforce một quy trình nghiệp vụ phức tạp: phim phải qua phê duyệt, suất chiếu không được trùng giờ, ghế chỉ materialized khi cần.

### Điểm khó nhất

1. **Movie lifecycle state machine**: 7 trạng thái với các transition hợp lệ khác nhau. `requireStatus()` là guard trung tâm — bỏ sót sẽ dẫn đến phim bypass quy trình kiểm duyệt.
2. **Showtime overlap detection**: Bài toán interval intersection trong DB — cần đúng cả 4 case: `[A overlaps B]`, `[A trong B]`, `[B trong A]`, `[B overlaps A]`. Query JPQL custom trong `ShowTimeRepository` là điểm cốt lõi.
3. **TMDB import với resolve logic**: Ánh xạ MPAA rating → DCAV và TMDB genre ID → local genre cần hiểu rõ 2 hệ thống phân loại khác nhau.

### Điểm dễ gây bug

1. **`updateMovie()` dùng delete-all + re-insert** cho translations/cast: Nếu request không gửi `castList` (null) nhưng code không kiểm tra null trước khi delete → có thể xóa hết cast của phim. Cần kiểm tra `if (request.getCastList() != null)` trước khi delete.
2. **`getSeatsByShowtime()` có side effect**: Là GET request nhưng có thể INSERT hàng trăm rows (lazy-init). Log monitoring và performance testing cần lưu ý điều này.
3. **Race condition khi lock seat**: Không có pessimistic lock (Gap #145). Hai request đồng thời vào `lockSeats()` với cùng seatId có thể cả hai đều thấy `AVAILABLE` và cùng RESERVE — dẫn đến double-booking. Cần `@Lock(PESSIMISTIC_WRITE)` trên repository method.
4. **`bookingId` không có FK constraint**: Nếu booking bị xóa bên booking-service mà không thông báo, `ShowtimeSeat.bookingId` trỏ về entity không tồn tại — cần event-driven sync hoặc periodic reconciliation.

### Điểm cần lưu ý khi maintain

- **Thêm trạng thái mới vào `MovieStatus`**: Phải cập nhật `requireStatus()` và tất cả `switch` statement. Cũng phải cập nhật `findAllPublic()` nếu trạng thái mới không nên hiện với khách.
- **Thêm trường vào `Movie`**: Nếu trường có trong `UpdateMovieRequest`, phải đảm bảo `MovieMapper` (patch mode) đã bao gồm trong `@Mapping`.
- **Thêm TMDB genre mới**: Cập nhật `TMDB_GENRE_CODES` map trong `TmdbService`.
- **Thêm tỉnh/thành phố**: Cập nhật list trong `ProvinceValidator`.

### Điểm cần lưu ý khi mở rộng

- **Multi-company per movie** (Gap #151): Đổi `Movie.company` từ `@ManyToOne` sang `@ManyToMany`. Cần migration DB và update tất cả mapper.
- **Enum hóa `MovieCast.roleType`** (Gap #142): Hiện là String. Thêm enum `CastRole` và migrate data.
- **Pessimistic locking cho ghế** (Gap #145): Thêm `@Lock(PESSIMISTIC_WRITE)` vào `findById` trong `ShowtimeSeatRepository`. Cần test tải.
- **Rate limiting cho TMDB search**: Nếu nhiều admin dùng đồng thời, có thể vượt TMDB API quota. Cân nhắc thêm `@RateLimiter` hoặc cache kết quả tìm kiếm.
- **Audit log phân loại** (Gap #141): Thêm `actionType` enum vào `MovieActionLog` để filter log theo loại hành động.
