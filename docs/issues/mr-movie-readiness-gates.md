## Overview / Objective

Thêm validation theo từng workflow gate (MOV-03) thay vì chỉ kiểm tra `MovieStatus` hiện tại trước khi cho phép `submit`/`approve`/`release`. Trước đây một payload tối thiểu (thiếu rating, poster, release date, translation...) vẫn có thể đi hết vòng đời tới `NOW_SHOWING` miễn là status transition đúng thứ tự.

Related Issue: Implements MOV-03 (`docs/issues/movie-service-industry-readiness-checklist.md`), tương ứng thiết kế `MOV-FIX-02` trong `docs/issues/movie-lifecycle-enterprise-fix-plan.md`.

---

## Changes Introduced

**Controllers / Routes:**
- Không đổi signature. `POST /api/movies/{id}/submit`, `/approve`, `/release` giữ nguyên endpoint, chỉ có thêm khả năng trả lỗi 400 mới khi movie chưa sẵn sàng.

**Services / Logic:**
- `MovieService.submitForReview()`: sau check `hasPendingGenre` hiện có (TMDB-FIX-03, giữ nguyên để không đổi behavior/test đã có), gọi thêm `MovieReadinessValidator.requireReadyForReview(movie)`.
- `MovieService.approveMovie()`: gọi `MovieReadinessValidator.requireReadyForApproval(movie)` trước khi chuyển `PENDING_REVIEW -> COMING_SOON`.
- `MovieService.releaseMovie()`: gọi `MovieReadinessValidator.requireReadyForRelease(movie)` trước khi chuyển `COMING_SOON -> NOW_SHOWING`.
- `MovieService.createMovie()`/`updateMovie()`: gọi `MovieReadinessValidator.requireValidDateRange(releaseDate, endDate)` ngay sau khi entity có state cuối cùng (áp dụng cho cả full create và partial update — kiểm tra trên state đã merge, không chỉ field vừa gửi).
- Không động tới `MovieScheduler` (auto-end) trong MR này — việc thêm auto-release scheduler thuộc `MOV-FIX-05`, một issue khác; do đó AC "test chứng minh scheduler không bypass readiness" không áp dụng được cho tới khi scheduler đó tồn tại và được ghi rõ là out-of-scope ở đây (xem Reviewer Notes).

**DTOs / Mappers / Components:**
- Mới `MovieReadinessValidator` (`movieservice.service`) — 3 gate public: `requireReadyForReview`, `requireReadyForApproval`, `requireReadyForRelease`, cộng `requireValidDateRange`. Gom **toàn bộ** rule chưa đạt vào một danh sách thay vì fail-fast ở rule đầu tiên.
- Mới `ReadinessViolation` (`movieservice.dto.response`) — `{ field, rule }`.
- Mới `MovieReadinessException` (`movieservice.exception`) — **không kế thừa `AppException`** (xem Key Architectural Decisions).
- Mới `MovieReadinessExceptionHandler` — `@RestControllerAdvice` cục bộ trong movie-service, chỉ bắt `MovieReadinessException`, build response `result.violations[]`.
- Mới `ClockConfig` (`movieservice.config`) — `@Bean Clock` để business-date logic (release window) test được (`Clock.fixed(...)` trong test) thay vì gọi `LocalDate.now()` trực tiếp.
- `ShowTimeRepository`: thêm `existsByMovieMovieIdAndFutureNonCancelledShowTime` (biến thể loại trừ `CANCELLED` của query hiện có, dùng cho release gate khi policy yêu cầu showtime).

**Database / JPA / Migration:**
- `docs/database/movie-service/V17__add_movie_release_end_date_check.sql` — `CHECK (release_date IS NULL OR end_date IS NULL OR release_date <= end_date)` trên bảng `movie`.

**Exception Handling / Error Codes:**
- `INVALID_MOVIE_DATE_RANGE` (2036, dùng lại slot trống), `MOVIE_NOT_READY_FOR_REVIEW` (2041), `MOVIE_NOT_READY_FOR_APPROVAL` (2042), `MOVIE_NOT_READY_FOR_RELEASE` (2043) — tất cả 400.

**Configuration:**
- `application.yml`: thêm `movie.readiness.require-showtime-for-release` (mặc định `false`, override qua env `MOVIE_REQUIRE_SHOWTIME_FOR_RELEASE`) — policy bật/tắt yêu cầu "ít nhất 1 showtime tương lai chưa cancel" ở release gate.

---

## Key Architectural Decisions

- **`MovieReadinessException` KHÔNG kế thừa `AppException`, và có `MovieReadinessExceptionHandler` riêng trong movie-service, không đụng `server/common`.** AC yêu cầu response trả `result.violations[]` có cấu trúc, nhưng `AppException`/`GlobalExceptionHandler` trong `server/common` (dùng chung cho MỌI service: auth, booking, user...) hiện chỉ mang `code`+`message` cố định theo enum, không có chỗ chứa payload động. Thay vì sửa lớp dùng chung (rủi ro ảnh hưởng service khác, và đã được xác nhận là muốn tránh), giải pháp là một exception + advice **cục bộ** trong movie-service — Spring tự route theo exception type cụ thể nhất nên không xung đột với advice chung. Kết quả JSON đúng y hệt mẫu trong issue (`result: { violations: [...] }`) mà không cần sửa file dùng chung.
- **`genre PENDING_REVIEW` tại `submitForReview()` giữ nguyên là check riêng (`GENRE_PENDING_REVIEW`), không gộp vào gate chung.** Check này đã tồn tại từ trước (TMDB-FIX-03) và có test riêng; gộp vào sẽ đổi error code hiện có (breaking change không cần thiết). Thay vào đó, gate approve/release (`collectApprovalOnlyViolations`) có thêm rule tương đương (`genres: PENDING_REVIEW_GENRE_MUST_BE_RESOLVED`) như một lớp phòng thủ thứ hai — phòng trường hợp genre chuyển sang pending *sau* khi đã submit.
- **`Clock` injectable thay vì `LocalDate.now()` trực tiếp** — chỉ áp dụng cho code mới (`MovieReadinessValidator`); `MovieScheduler` hiện có vẫn dùng `LocalDate.now()` như cũ, không sửa ngoài scope.
- **Không thêm scheduler tự động release.** AC "test chứng minh scheduler không bypass readiness" bị bỏ qua có chủ đích trong MR này — hiện chưa có scheduler `COMING_SOON -> NOW_SHOWING` nào cả (chỉ có auto-end), việc thêm nó thuộc `MOV-FIX-05`. Khi issue đó triển khai, nó chỉ cần gọi `MovieService.releaseMovie()` (đã có gate) để tự động thỏa AC này.
- **`schedule` (tạo showtime cho phim classification `C`) không bị chặn ở MR này.** `ShowTimeService` tạo showtime độc lập với `MovieReadinessValidator` — chặn showtime theo movie status/rating thuộc `ST-01`, một ticket khác chưa được giao.

---

## How to Test

1. `mvnw.cmd -pl movie-service -am test` — toàn bộ suite hiện tại (81 test) pass, gồm `MovieReadinessValidatorTest` (14 test mới, thuần unit không mock HTTP/DB thật) và `MovieServiceTest` (7 test wiring mới: create/update date-range propagation, submit/approve/release propagate `MovieReadinessException` và không gọi `updateStatus` khi validator chặn, cũng như happy-path khi validator pass).
2. Manual: tạo movie DRAFT tối thiểu (chỉ `originalTitle`+`durationMinutes`+1 genre+1 format) → gọi `POST /{id}/submit` → xác nhận `400`, `code: 2041`, message rõ đơn giản (chi tiết field/rule nằm trong danh sách `MOVIE_NOT_READY_FOR_REVIEW` nếu chưa đủ ngôn ngữ/ngày).
3. Manual: đưa movie qua `PENDING_REVIEW` với rating `C` → `POST /{id}/approve` → xác nhận `400`, `code: 2042`, `result.violations` có `{"field":"ageRating","rule":"CLASSIFICATION_C_BANNED_FROM_PUBLIC_RELEASE"}`.
4. Manual: movie `COMING_SOON` có `releaseDate` ở tương lai → `POST /{id}/release` → xác nhận `400`, `code: 2043`, `result.violations` có `{"field":"releaseDate","rule":"RELEASE_DATE_NOT_REACHED"}`.
5. Manual: `PUT /{id}` (update) với `releaseDate` mới > `endDate` hiện có (partial update, không gửi `endDate`) → xác nhận `400`, `code: 2036` — chứng minh check chạy trên state đã merge, không chỉ field gửi lên.
6. Áp `V17` lên DB có sẵn dữ liệu hợp lệ → xác nhận constraint không vi phạm dữ liệu hiện tại; thử `UPDATE movie SET end_date = release_date - interval '1 day'` thủ công → xác nhận bị DB từ chối.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] No N+1 query issues (validator chỉ đọc field đã có sẵn trên `Movie` đã load; query mới `existsByMovieMovieIdAndFutureNonCancelledShowTime` chỉ chạy khi policy showtime bật)
- [x] Exception handling uses correct error codes (2036 tái sử dụng slot trống, 2041–2043 mới, không trùng)
- [ ] Endpoints tested via Postman / API client — chưa test với server thật trong phiên này, xem "How to Test" §2–5 để reviewer tự chạy
- [ ] API contract / Postman collection updated — chưa cập nhật `docs/api-specs/movie-service/API_CONTRACT.md` nếu có, cần review riêng

**Frontend**
- Không áp dụng — MR này chỉ backend.

---

## Reviewer Notes

- **AC chưa hoàn thành có chủ đích:** "test chứng minh scheduler không bypass readiness" — chưa có scheduler tự động release nào để test (xác nhận qua code hiện tại, `MovieScheduler` chỉ có `autoEndExpiredMovies()`). Quyết định (đã thống nhất trước khi code): bỏ qua phần này trong MR, để `MOV-FIX-05` triển khai scheduler và tự động thỏa AC vì nó sẽ gọi `releaseMovie()` đã có gate.
- **`result.violations[]` dùng exception + advice cục bộ, không sửa `server/common`** — xem Key Architectural Decisions. Nếu về sau nhiều service khác cũng cần structured error payload, nên cân nhắc nâng cấp `AppException` dùng chung thay vì nhân bản pattern advice-cục-bộ này ở từng service.
- **`originalLanguage` được kiểm tra chặt hơn bean validation hiện có** (`@Size(min=2,max=2)` chỉ check độ dài, gate mới check thêm phải là 2 ký tự chữ cái) — đây là rule mới, không phải regression; dữ liệu cũ nếu có giá trị lạ (vd số) sẽ bị chặn ở submit chứ không phải ở create/update.
- **Phim import từ TMDB (nhánh `fix/unify-tmdb-import-pipeline`) luôn có `formats=[]` sau import** (theo thiết kế TMDB-FIX-02) — nghĩa là submit gate sẽ luôn chặn phim mới import cho tới khi admin gán format qua update, đúng ý đồ thiết kế của 2 MR khớp nhau, không phải xung đột.
- Chưa có endpoint "promote" cho genre `PENDING_REVIEW -> ACTIVE`; nếu review cả nhánh TMDB thì lưu ý gate approve sẽ chặn các phim còn genre pending cho tới khi có endpoint đó (theo dõi ở nhánh TMDB).
