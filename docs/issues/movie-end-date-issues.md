# Issues — Movie End Date Feature
> Thêm `end_date` cho phim: DB migration · backend scheduler · frontend form/table  
> Tổng: **3 issues** | Database: 1 · Backend: 1 · Frontend: 1

---

## Issue 1

**Title:** `[Database] Add end_date column to movie table`

**Labels:** `Layer::Database` · `Type::Feature` · `Priority::Medium`

```markdown
## Summary / Objective

Hiện tại bảng `movie` chưa có cột `end_date` để ghi nhận ngày kết thúc chiếu phim.
Cần thêm cột `end_date DATE NULL` vào schema để backend scheduler có thể tự động
chuyển trạng thái `NOW_SHOWING → ENDED` khi phim đến ngày hết hạn, thay vì admin
phải thủ công.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Cột `end_date DATE NULL` tồn tại trong bảng `movie` (có thể để trống)
- [ ] Index `idx_movie_end_date` được tạo trên `(end_date) WHERE end_date IS NOT NULL`
      để tối ưu query của scheduler
- [ ] Schema `postgres-init/movie_db.sql` cập nhật — chạy `docker compose down -v && docker compose up -d` thành công
- [ ] `end_date` cho phép NULL (phim không bắt buộc phải có ngày kết thúc)
- [ ] `end_date` phải >= `release_date` (validate ở service layer, không phải DB constraint)

---

## Technical Notes / Constraints

- Dùng `ALTER TABLE` nếu volume đã tồn tại:
  ```sql
  ALTER TABLE movie ADD COLUMN IF NOT EXISTS end_date DATE;
  CREATE INDEX IF NOT EXISTS idx_movie_end_date ON movie(end_date) WHERE end_date IS NOT NULL;
  ```
- Nếu DB còn trống (dev mới): `docker compose down -v && docker compose up -d` là đủ.
- Không thêm CHECK constraint `end_date > release_date` ở DB vì một số phim import từ
  TMDB có thể thiếu `release_date`.

---

## Related

- Branch: `feat/movie-end-date`
- Depends on: —
- Docs: `docs/database/movie-service/movie_db.sql`
```

---

## Issue 2

**Title:** `[Backend] Add endDate field to Movie entity and implement auto-end scheduler`

**Labels:** `Layer::Backend` · `Type::Feature` · `Priority::Medium`

```markdown
## Summary / Objective

Sau khi DB có cột `end_date`, cần cập nhật Movie entity, các DTO (request/response),
và repository để expose field này qua API. Đồng thời tạo `MovieScheduler` — một
Spring `@Scheduled` job chạy lúc 00:05 mỗi đêm — tự động chuyển tất cả phim
`NOW_SHOWING` có `endDate < today` sang trạng thái `ENDED`.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `Movie.java` có field `LocalDate endDate` với `@Column(name = "end_date")`
- [ ] `CreateMovieRequest.java` và `UpdateMovieRequest.java` có field `LocalDate endDate`
- [ ] `MovieResponse.java` có field `LocalDate endDate` — API trả về `endDate` trong JSON
- [ ] `MovieRepository` có method `findByStatusAndEndDateBefore(MovieStatus, LocalDate)`
- [ ] `MovieScheduler.java` tạo mới trong package `movieservice.scheduler`:
  - Annotation `@Scheduled(cron = "0 5 0 * * *")` (00:05 mỗi đêm)
  - Query phim `NOW_SHOWING` có `endDate < LocalDate.now()`
  - Bulk update sang `ENDED`, set `updatedBy = "SYSTEM"`, log kết quả
- [ ] `PUT /api/movies/{id}` nhận và lưu `endDate` từ request body
- [ ] `GET /api/movies/{id}` và `/api/movies/all` trả về `endDate` trong response

---

## API Specifications (if applicable)

### API — Update Movie (updated)

| Field | Details |
|---|---|
| Method | `PUT` |
| Endpoint | `/api/movies/{id}` |
| Description | Cập nhật thông tin phim, bao gồm `endDate` |
| Auth Required | Yes (ADMIN hoặc EMPLOYEE) |

**Request Body (thêm field mới):**
```json
{
  "originalTitle": "Avengers: Endgame",
  "releaseDate": "2026-04-26",
  "endDate": "2026-06-30"
}
```

**Response 200 OK:**
```json
{
  "code": 200,
  "result": {
    "movieId": 1,
    "originalTitle": "Avengers: Endgame",
    "releaseDate": "2026-04-26",
    "endDate": "2026-06-30",
    "status": "NOW_SHOWING"
  }
}
```

---

## Technical Notes / Constraints

- MapStruct (`@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE)`) tự map `endDate`
  vì tên field khớp hoàn toàn — **không cần thêm `@Mapping` vào `MovieMapper.java`**.
- `@EnableScheduling` đã có trên `MovieServiceApplication.java` — không cần thêm.
- Scheduler dùng `movieRepository.saveAll(expired)` thay vì `updateStatus()` vì cần
  đặt `updatedBy = "SYSTEM"` (bulk update query hiện tại không nhận param này).
- Scheduler cần `@Transactional` để tránh lazy-loading issues khi load entity list.

---

## Related

- Branch: `feat/movie-end-date`
- Depends on: Issue 1 — `[Database] Add end_date column to movie table`
- Docs: —
```

---

## Issue 3

**Title:** `[Frontend] Add End Date field to Movie form and display in table`

**Labels:** `Layer::Frontend` · `Type::Feature` · `Priority::Medium`

```markdown
## Summary / Objective

Cập nhật frontend để hỗ trợ `endDate` sau khi backend đã expose field. Cụ thể:
thêm input "End Date" vào `MovieModal` (form tạo/sửa phim), hiển thị ngày kết thúc
bên dưới status badge trong `MovieTable`, và cập nhật TypeScript types trong `movieApi.ts`.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `MovieV2`, `MovieApiResponse`, `CreateMovieRequest` trong `movieApi.ts` có field `endDate?: string`
- [ ] `toLegacyMovie()` mapper truyền `endDate` từ `MovieV2` sang `MovieApiResponse`
- [ ] `MovieModal` form có input date "End Date" ngay sau "Release Date"
  - `min` attribute bằng `releaseDate` để tránh chọn ngày trước ngày phát hành
  - Label hint: *(auto-ends showing)* để người dùng hiểu tác dụng
  - `endDate` được gửi trong payload `CreateMovieRequest` / `UpdateMovieRequest`
- [ ] `MovieTable` hiển thị "ends YYYY-MM-DD" nhỏ bên dưới status badge cho phim có `endDate`
- [ ] Khi edit phim đã có `endDate`, form prefill đúng giá trị
- [ ] Không có TypeScript error liên quan đến `endDate`

---

## UI Reference / Mockup

**MovieModal — End Date field** (ngay dưới Release Date):
```
Release Date   [  2026-04-26  ]
End Date       [  2026-06-30  ]   (auto-ends showing)
Country        [  USA          ]
```

**MovieTable — Status cell** (có endDate):
```
● NOW_SHOWING
  ends 2026-06-30
```

---

## Technical Notes / Constraints

- `endDate` là optional — form không validate required, chỉ validate min date.
- `form.endDate || undefined` khi build payload để tránh gửi empty string lên backend.
- `FormState` type và `emptyForm` constant đều cần thêm `endDate: ""`.
- `movieToForm()` prefill từ `mv.endDate ?? ""`.

---

## Related

- Branch: `feat/movie-end-date`
- Depends on: Issue 2 — `[Backend] Add endDate field to Movie entity and implement auto-end scheduler`
- Docs: —
```
