# MR Description — [Feature] Add endDate to Movie with auto-end scheduler

> Copy nội dung bên dưới vào GitLab MR description.  
> Branch: `feat/movie-end-date` → target: `develop`

---

## Overview / Objective

Thêm `end_date` (ngày kết thúc chiếu) cho phim trên toàn hệ thống — từ DB schema đến
backend API đến frontend UI. Khi admin/employee set `endDate` cho một phim đang
`NOW_SHOWING`, Spring `@Scheduled` job sẽ tự động chuyển phim sang `ENDED` lúc 00:05
mỗi đêm — không cần thao tác thủ công.

Related Issue: Closes #[DB-issue] · Closes #[Backend-issue] · Closes #[Frontend-issue]

---

## Changes Introduced

**Database / JPA / Migration:**
- `server/postgres-init/movie_db.sql` — thêm cột `end_date DATE NULL` vào bảng `movie`,
  thêm index `idx_movie_end_date ON movie(end_date) WHERE end_date IS NOT NULL`

**DTOs / Mappers / Components:**
- `Movie.java` — thêm `@Column(name = "end_date") LocalDate endDate`
- `CreateMovieRequest.java` — thêm `LocalDate endDate`
- `UpdateMovieRequest.java` — thêm `LocalDate endDate`
- `MovieResponse.java` — thêm `LocalDate endDate`
- `MovieMapper.java` — **không thay đổi** (MapStruct tự map vì tên field khớp)

**Services / Logic:**
- `MovieRepository.java` — thêm derived query `findByStatusAndEndDateBefore(MovieStatus, LocalDate)`
- `movieservice/scheduler/MovieScheduler.java` *(file mới)* — `@Scheduled(cron = "0 5 0 * * *")`,
  tự động chuyển `NOW_SHOWING + endDate < today → ENDED`, log kết quả

**Controllers / Routes:**
- Không thay đổi controller — `PUT /api/movies/{id}` và `GET /api/movies/{id}` tự nhận/trả
  `endDate` thông qua DTO đã cập nhật

**Frontend:**
- `client/src/api/movieApi.ts` — thêm `endDate?: string` vào `MovieV2`, `MovieApiResponse`,
  `CreateMovieRequest`; map qua `toLegacyMovie()`
- `client/src/layouts/MovieModal.tsx` — thêm field "End Date" vào `FormState`, `emptyForm`,
  `movieToForm()`, submit payload, và JSX (ngay sau "Release Date", có `min` attribute)
- `client/src/layouts/MovieTable.tsx` — hiển thị `ends YYYY-MM-DD` bên dưới status badge
  cho phim có `endDate`

---

## Key Architectural Decisions

- **NULL cho endDate** — Phim không bắt buộc phải có `endDate`. Scheduler chỉ xử lý
  phim có `endDate` rõ ràng, tránh ảnh hưởng phim đang chiếu không giới hạn thời gian.

- **Scheduler thay vì webhook/trigger** — Spring `@Scheduled` đơn giản hơn DB trigger,
  dễ test, dễ disable khi cần, và log được kết quả. Trade-off: có thể trễ tối đa ~24h
  so với trigger realtime — chấp nhận được cho business requirement rạp chiếu phim.

- **`saveAll()` thay vì `updateStatus()` query** — Cần set `updatedBy = "SYSTEM"` trên
  từng entity. Bulk JPQL query hiện tại không nhận param này. Với lượng phim hết hạn
  mỗi ngày rất nhỏ (thường < 10), `saveAll()` không gây performance issue.

- **MapStruct IGNORE policy** — `MovieMapper` dùng `ReportingPolicy.IGNORE`, nên `endDate`
  được map tự động mà không cần `@Mapping` explicit. Đây là quyết định đúng cho scalar
  fields có tên khớp giữa entity và DTO.

---

## How to Test

**1. Apply DB migration:**
```bash
# Option A — DB còn trống (dev)
docker compose down -v && docker compose up -d

# Option B — Giữ data, chỉ thêm cột
docker exec -it postgres psql -U postgres -d movie_db -c "
  ALTER TABLE movie ADD COLUMN IF NOT EXISTS end_date DATE;
  CREATE INDEX IF NOT EXISTS idx_movie_end_date ON movie(end_date) WHERE end_date IS NOT NULL;
"
```

**2. Rebuild và khởi động service:**
```bash
docker compose up -d --build movie-service
```

**3. Test API — Set endDate khi tạo/edit phim:**
```bash
# Tạo phim với endDate
POST /api/movies
Authorization: Bearer <ADMIN_TOKEN>
Body:
{
  "originalTitle": "Test Movie",
  "originalLanguage": "en",
  "durationMinutes": 120,
  "releaseDate": "2026-07-01",
  "endDate": "2026-07-10",
  "genreIds": [1],
  "formatIds": [1]
}
→ 201: response có "endDate": "2026-07-10"

# GET để verify
GET /api/movies/{id}
→ 200: "endDate": "2026-07-10"
```

**4. Test Scheduler (trigger thủ công):**
```bash
# Tạo phim NOW_SHOWING với endDate = hôm qua
# Sau đó gọi tạm endpoint hoặc chờ 00:05
# Xem log container:
docker logs movie-service --tail 50 | grep MovieScheduler
# Expect: "[MovieScheduler] → ENDED: [X] Test Movie"
```

**5. Test Frontend:**
- Vào Admin → Movie List → Add New Movie
- Kiểm tra field "End Date" xuất hiện sau "Release Date"
- Chọn end date < release date → không cho phép (min constraint)
- Save → reload → edit lại → end date prefill đúng
- Kiểm tra cột Status trong bảng có hiển thị "ends 2026-07-10"

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] Không còn debug / console.log code
- [x] Follows project conventions (AppException, ApiResponse, MapStruct, useRole)

**Backend**
- [x] `endDate` NULL-safe — không break phim hiện có không có end date
- [x] `@Scheduled` cron expression đúng: `"0 5 0 * * *"` (giây phút giờ ngày tháng thứ)
- [x] Scheduler có `@Transactional` để tránh lazy-loading issues
- [x] Log đủ thông tin: số phim bị end, tên + ID từng phim
- [x] `updatedBy = "SYSTEM"` cho bulk transition từ scheduler

**Database**
- [x] `end_date DATE NULL` — không phá schema hiện có
- [x] Index partial `WHERE end_date IS NOT NULL` — hiệu quả hơn full index
- [x] Migration idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)

**Frontend**
- [x] Loading và error states không ảnh hưởng (endDate optional)
- [x] `endDate` submit là `undefined` khi field trống (không gửi empty string)
- [x] `min` attribute ngăn chọn end date trước release date
- [x] Tested: prefill khi edit, display trong table, dark/light mode

---

## Reviewer Notes

- **Scheduler chạy 00:05 múi giờ server** — nếu server chạy UTC, cần xem xét offset so
  với giờ Việt Nam (UTC+7). Có thể cấu hình `spring.task.scheduling.pool.size` nếu cần.
- **Phim đang NOW_SHOWING không có endDate** — scheduler bỏ qua hoàn toàn, không ảnh hưởng.
- **endDate trong past khi import** — nếu TMDB import phim cũ với endDate < today và status
  COMING_SOON/DRAFT, scheduler không xử lý vì chỉ query `NOW_SHOWING`. An toàn.
- MapStruct version hiện tại có `ReportingPolicy.IGNORE` — cần kiểm tra `endDate` thực sự
  được map bằng cách log response của `GET /api/movies/{id}` sau khi set.
