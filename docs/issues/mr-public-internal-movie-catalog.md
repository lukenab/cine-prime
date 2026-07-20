## Overview / Objective

Hoàn thiện issue `[Backend] Separate public and internal movie catalog APIs`. Trước MR này, `GET /api/movies/**` được cấu hình `permitAll()` ở tầng filter chain, đồng thời `MovieController.findById()` và `getPage()` (catalog nội bộ) hoàn toàn không có `@PreAuthorize` — nghĩa là bất kỳ ai (kể cả anonymous/customer chưa đăng nhập) chỉ cần đoán một `movieId` là có thể đọc được `MovieResponse` đầy đủ của một phim `DRAFT`, `PENDING_REVIEW`, `REJECTED` (`CHANGES_REQUESTED`)... bao gồm cả `rejectionNote` và các field audit nội bộ.

MR này khoá catalog nội bộ lại (chỉ ADMIN/EMPLOYEE), thu hẹp matcher public ở `SecurityConfig` xuống đúng phạm vi `/api/movies/public/**`, và bổ sung endpoint public detail `GET /api/movies/public/{id}` dùng chung một predicate visibility duy nhất với public list — để một movie không đủ điều kiện hiển thị sẽ luôn trả về `404` giống hệt một ID không tồn tại, không có cách nào phân biệt được.

Related Issue: Closes `[Backend] Separate public and internal movie catalog APIs`
Depends on: `API-01` (không phát sinh thay đổi mới cho phụ thuộc này trong MR)

---

## Changes Introduced

**Controllers / Routes:**
- `MovieController.findById()` (`GET /api/movies/{id}`) và `getPage()` (`GET /api/movies`) — thêm `@PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")`. `getAll()` (`GET /api/movies/all`) đã có sẵn từ trước, không đổi.
- Thêm `GET /api/movies/public/{id}` (`getPublicById`) — endpoint mới, không có `@PreAuthorize` (đúng chủ đích: public, giống `getPublic()`), nhận thêm `clusterId` optional giống list.

**Services / Logic:**
- Thêm `MovieService.getPublicMovieDetail(movieId, clusterId)`: tìm `Movie`, lọc các `MovieAvailability` của phim đó theo predicate visibility dùng chung; nếu rỗng (phim không tồn tại, không `APPROVED`, không có availability `PLANNED`/`OPEN`, đã hết hạn `showingEndDate`, hoặc không thuộc `clusterId` được yêu cầu) → ném `MOVIE_NOT_FOUND` (404) — **cùng một lỗi** dù phim thực sự không tồn tại hay chỉ đang bị ẩn, không tiết lộ sự khác biệt.
- Trích xuất `MovieService.isPubliclyVisible(availability, today)` (`private static`) làm **single source of truth** cho điều kiện hiển thị public: `movie.status == APPROVED && availability.status in (PLANNED, OPEN) && (showingEndDate == null || showingEndDate >= today)`. Trước đây điều kiện này bị lặp lại 2 lần khác nhau: một bản trong JPQL (`findPubliclyRelevant`, dùng cho nhánh có `clusterId`) và một bản khác viết tay bằng Java stream filter (dùng cho nhánh aggregate không `clusterId`) — hai bản này có thể trôi lệch nhau qua thời gian mà không ai nhận ra. Giờ cả 2 nhánh của `findAllPublic()` và `getPublicMovieDetail()` đều gọi đúng 1 hàm này.
- `MovieAvailabilityRepository.findPubliclyRelevant()` (JPQL) bị xoá — không còn dùng, thay bằng `findByCluster_ClusterId()` (đã có sẵn) + filter Java dùng chung.

**DTOs / Mappers / Components:**
- Không thêm/đổi DTO nào (dùng lại `PublicMovieResponse` sẵn có).
- **Frontend:** `movieApi.ts` — thêm `getPublicMovieById(movieId, clusterId?)` gọi `GET /api/movies/public/{id}`, dùng lại `toLegacyPublicMovie()` bridge sẵn có.
- **Frontend:** `ShowtimePage.tsx` — trước đây gọi `getPublicMovies()` (toàn bộ danh sách public) rồi `find()` theo `movieId` ở client; giờ gọi thẳng `getPublicMovieById()`, giảm tải dữ liệu và dùng đúng endpoint mới thay vì workaround.

**Database / JPA / Migration:**
- Không có migration nào trong MR này.

**Exception Handling / Error Codes:**
- Không thêm mã lỗi mới — tái sử dụng `MOVIE_NOT_FOUND` (2002, 404) sẵn có cho mọi trường hợp phim không đủ điều kiện hiển thị public.

---

## API contract

### `GET /api/movies/public/{id}` (endpoint mới)

Response 200 (visible):
```json
{
  "code": 200,
  "result": {
    "movieId": 42,
    "originalTitle": "Dune: Part Two",
    "displayStatus": "NOW_SHOWING",
    "bookingAvailable": true
  }
}
```

Response 404 (không tồn tại **hoặc** không đủ điều kiện public — luôn cùng 1 dạng lỗi):
```json
{ "code": 2002, "message": "Movie not found." }
```

### `GET /api/movies/{id}`, `GET /api/movies` (đã tồn tại, thêm auth)

Giờ yêu cầu `ROLE_ADMIN` hoặc `ROLE_EMPLOYEE` — anonymous/CUSTOMER nhận `401`/`403` thay vì `200` với dữ liệu đầy đủ như trước.

---

## Key Architectural Decisions

- **Một predicate visibility duy nhất, không phải 2 bản đồng bộ tay.** Đây là điểm mấu chốt AC yêu cầu ("Visibility predicate được dùng chung, không copy khác nhau giữa list/detail"). Thay vì chỉ thêm detail endpoint và tự viết lại điều kiện lọc một lần nữa (thành bản thứ 3), MR này dọn luôn 2 bản cũ (JPQL + Java filter) về chung 1 hàm `isPubliclyVisible()`.
- **404 cho mọi trường hợp "không nên thấy", không phân biệt loại lý do.** Dù phim không tồn tại, hay tồn tại nhưng đang `DRAFT`/hết hạn/sai cluster, response phải giống hệt nhau — nếu trả các mã lỗi khác nhau, một client có thể suy luận ngược được trạng thái nội bộ của phim (vd. "403 nghĩa là phim có tồn tại nhưng bị khoá").
- **Thu hẹp matcher ở tầng filter chain, không chỉ dựa vào `@PreAuthorize`.** `@PreAuthorize` vẫn hoạt động đúng dù URL có `permitAll()` hay không (Spring Security vẫn áp method-security cho request anonymous), nhưng để lộ matcher rộng (`GET /api/movies/**` permitAll) là một rủi ro thiết kế: bất kỳ endpoint GET mới nào thêm vào sau này dưới `/api/movies` mà quên gắn `@PreAuthorize` sẽ mặc định public. Thu hẹp xuống đúng `/api/movies/public/**` làm boundary bảo mật tường minh hơn thay vì phải nhớ.
- **Không đổi từ `permitAll` sang chặn hẳn TMDB routes** — `TmdbController` (`/api/movies/tmdb/**`) vốn đã có `@PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")` trên từng method từ trước, nên hành vi thực tế của các route này không đổi; chỉ là bây giờ filter-chain cũng phản ánh đúng boundary đó thay vì im lặng dựa vào method-security một mình.

---

## How to Test

1. `mvnw.cmd -pl movie-service test` — bao gồm test mới `MovieControllerAuthorizationTest` (kiểm tra `findById`/`getPage`/`getAll`/`createMovie`/`updateMovie`/... đều mang đúng annotation `@PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")` qua reflection, và `getPublic`/`getPublicById` **không** mang annotation nào — cùng pattern với `TmdbControllerAuthorizationTest` đã có trong repo) và 6 case mới trong `MovieServiceTest` cho `getPublicMovieDetail()` (phim `APPROVED` + `OPEN` → thấy được; `DRAFT` → 404; `APPROVED` nhưng availability `SUSPENDED` → 404; `showingEndDate` đã qua → 404; chỉ có availability ở cluster khác → 404; ID không tồn tại → 404 và không đụng tới `movieAvailabilityRepository`). Kết quả: 216/217 — 1 lỗi còn lại (`MovieImageRepositoryIntegrationTest`) là lỗi có từ trước, không liên quan.
2. Thủ công: gọi `GET /api/movies/{id}` không kèm Bearer token cho một phim `APPROVED` bất kỳ → phải nhận `401`/`403` thay vì `200` như trước MR. Gọi lại với token ADMIN/EMPLOYEE → vẫn `200` bình thường.
3. Thủ công: gọi `GET /api/movies/public/{id}` không kèm token cho một phim đang `DRAFT` → phải nhận `404` (`code: 2002`), không phải `200` hay lỗi khác. Gọi với một phim `APPROVED` đang có suất chiếu → `200` với `PublicMovieResponse` đầy đủ.
4. `npx tsc --noEmit` (client) sạch cho `movieApi.ts` và `ShowtimePage.tsx`; mở trang chi tiết phim ở customer flow (`/showtime/:movieId`) xác nhận vẫn tải đúng thông tin phim qua endpoint mới.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (backend `mvn compile`, frontend `tsc` cho các file đã đổi)

**Backend**
- [x] Không phát sinh N+1 mới (`getPublicMovieDetail()` dùng đúng 1 câu `findByMovie_MovieId`, không load thêm gì ngoài dự kiến)
- [x] Exception dùng đúng mã lỗi có sẵn (`MOVIE_NOT_FOUND`, không thêm mã mới)
- [ ] Endpoint chưa test thủ công qua Postman/API client trong phiên làm việc này — reviewer nên smoke-test cả `401`/`403` (catalog nội bộ không token) và `404` (public detail của phim DRAFT) trước khi merge
- [ ] Postman collection / `API_CONTRACT.md` chưa cập nhật theo endpoint mới

**Frontend**
- [x] Trạng thái loading/error được xử lý (giữ nguyên fallback về mock data khi API lỗi, đúng hành vi cũ)
- [x] `axiosClient` gắn Bearer token đúng cách (endpoint mới không cần token, không đổi phần auth)
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên này

---

## Reviewer Notes

- **`findPubliclyRelevant()` (JPQL) đã bị xoá khỏi `MovieAvailabilityRepository`** — nếu có nhánh/MR khác đang mở song song mà cũng sửa file này, cần kiểm tra conflict khi rebase.
- **Đổi từ query lọc ở SQL (`findPubliclyRelevant`) sang tải hết theo cluster rồi lọc ở Java (`findByCluster_ClusterId` + `isPubliclyVisible`)** cho nhánh có `clusterId` của `findAllPublic()` — đánh đổi nhỏ về hiệu năng (tải nhiều row hơn từ DB) để đổi lấy đúng 1 predicate dùng chung, tránh lệch logic giữa 2 nơi. Với quy mô cụm rạp hiện tại, đánh đổi này chấp nhận được; nếu sau này số lượng availability mỗi cluster tăng rất lớn, có thể cân nhắc đưa `isPubliclyVisible()` trở lại thành JPQL (nhưng vẫn phải giữ nguyên tắc "một chỗ duy nhất").
- **`GET /api/movies/{id}` và `GET /api/movies` giờ đòi hỏi ADMIN/EMPLOYEE** — nếu có bất kỳ tool/script/tích hợp nào khác (ngoài admin frontend) đang gọi 2 endpoint này ẩn danh, sẽ bắt đầu nhận `401`/`403` sau khi merge. Đã rà soát `client/src` và xác nhận chỉ 2 trang admin (`MovieEditorPage.tsx`, `ManageMoviePage.tsx`) gọi `getMovieById`, cả hai đều nằm sau `ProtectedRoute`.
