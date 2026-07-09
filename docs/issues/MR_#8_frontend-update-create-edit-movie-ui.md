# MR Description — Issue #8

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feature/#8-admin-create-movie-ui-v2` → target: `develop`

---

## Overview / Objective

Redesign toàn bộ form tạo/sửa phim của admin để khớp với API v2: tích hợp TMDB search & auto-fill, dropdown cho các lookup table (thể loại, định dạng, độ tuổi, hãng phim), section cast/crew với drag-drop billing order, và tab ngôn ngữ Tiếng Việt / English. Song song đó, implement thêm 3 trang CRUD cho reference data (Age Ratings, Screening Formats, Production Companies) mà các dropdown phụ thuộc vào, và hoàn thiện workflow duyệt phim với status badge + action buttons theo role.

Related Issue: Closes #8

---

## Changes Introduced

**Controllers / Routes (Backend):**
- `AgeRatingController` — CRUD đầy đủ: `GET /api/age-ratings`, `POST`, `PUT/{id}`, `DELETE/{id}`; `POST/PUT/DELETE` require `ROLE_ADMIN`
- `ScreeningFormatController` — CRUD đầy đủ: `GET /api/screening-formats`, `POST`, `PUT/{id}`, `DELETE/{id}`
- `ProductionCompanyController` — CRUD đầy đủ: `GET /api/companies?q=`, `POST`, `PUT/{id}`, `DELETE/{id}`

**DTOs (Backend):**
- `AgeRatingRequest` — `ratingCode` (@NotBlank @Size(max=5)), `minAge` (@Min(0) @Max(21)), `description`
- `ScreeningFormatRequest` — `formatCode`, `formatName`, `description`, `surcharge` (@DecimalMin("0.0"))
- `ProductionCompanyRequest` — `name`, `country`, `logoUrl`, `websiteUrl`
- `ProductionCompanyResponse` — thêm field `websiteUrl`

**API layer (Frontend — `movieApi.ts`):**
- Thêm types: `MovieV2`, `TranslationResponse`, `CastResponse`, `MovieImageResponse`, `AgeRatingRequest/Response`, `ScreeningFormatRequest/Response`, `ProductionCompanyRequest/Response`
- Thêm `movieStatus: MovieStatus` vào `MovieApiResponse` và `toLegacyMovie()`
- Thêm 8 workflow endpoints: `submitForReview`, `approveMovie`, `rejectMovie`, `suspendMovie`, `endMovie`, `reworkMovie`, `releaseMovie`, `reinstateMovie`
- Thêm CRUD endpoints cho AgeRating, ScreeningFormat, ProductionCompany, Person

**Components (Frontend):**
- `MovieModal.tsx` — rewrite hoàn toàn:
  - Tab TMDB Search: debounce 400ms, gọi `GET /api/movies/tmdb/search`, click để auto-fill toàn bộ form
  - Tab Basic Info: `originalTitle`, `durationMinutes` với preview "X giờ Y phút", `releaseDate`, dropdown `AgeRating` (single), `Company` (async search ≥ 2 ký tự)
  - Tab Translations: toggle VI / EN, mỗi tab có `title` và `synopsis` riêng
  - Tab Cast: search person theo tên → chọn → gán role (ACTOR/DIRECTOR/WRITER/PRODUCER) + characterName → `@dnd-kit/core` để kéo thả billing order
  - Tab Formats/Genres: multi-select checkbox list
  - Tab Gallery: upload và quản lý nhiều ảnh cho phim
- `MovieDetailModal.tsx` — rewrite hiển thị `MovieV2`: two-column layout (poster + gallery + links), status badge, synopsis VI/EN toggle, cast card grid với characterName, scrollable gallery strip
- `MovieTable.tsx` — thêm cột Status badge theo `STATUS_CONFIG`, action buttons tùy theo status hiện tại (Submit / Approve / Reject / Release / Suspend / End / Rework / Reinstate), ẩn action ADMIN-only với EMPLOYEE

**Pages (Frontend):**
- `ManageMoviePage.tsx` — load lookup data (genres, age ratings, formats, companies, persons) truyền vào modal; 8 workflow handlers dùng `makeWorkflowHandler` pattern; `handleDeleteMovie` gọi `loadMovies()` thay vì `.filter()` (soft-delete fix); status filter 7 option
- `ManageAgeRatingsPage.tsx` — CRUD page mới: bảng rating code badge (màu theo code), min age, description; Create/Edit modal; confirm delete
- `ManageFormatsPage.tsx` — CRUD page mới: bảng format code badge (2D/3D/IMAX/4DX…), tên, surcharge format VND; Create/Edit modal; confirm delete
- `ManageCompaniesPage.tsx` — CRUD page mới: bảng logo thumbnail (fallback initials avatar), tên, quốc gia, website link; Create/Edit modal; confirm delete

**Hooks / Routing:**
- `useRole.ts` (mới) — centralized permission map mirror `@PreAuthorize` backend: `can.approve/reject/release/suspend/end/reinstate` chỉ `ROLE_ADMIN`; `can.submit/edit/rework/archive` cả hai role
- `LoginPage.tsx` + `RootRedirect.tsx` — redirect theo role: ADMIN → `/admin`, EMPLOYEE → `/admin/movies`
- `Sidebar.tsx` — collapsible Movies dropdown với 4 sub-items (Movie List / Age Ratings / Formats / Companies); auto-expand khi path hiện tại khớp child; ChevronDown animate
- `AppRoutes.tsx` — thêm 3 route ADMIN-only: `/admin/age-ratings`, `/admin/formats`, `/admin/companies`

---

## Key Architectural Decisions

- **`makeWorkflowHandler` pattern** — mỗi workflow action wrap trong `async () => { await fn(); await loadMovies(); }` để tránh lặp code try/catch/reload trên 8 handlers.

- **Soft-delete fix** — Backend set `status=ENDED` thay vì xóa DB. Frontend cũ dùng `.filter()` nên phim "biến mất" optimistically rồi "xuất hiện lại" khi refresh. Fix: gọi `loadMovies()` để lấy state thực từ server, giữ nhất quán với soft-delete pattern.

- **`useRole()` hook** — tập trung logic phân quyền FE vào một chỗ, mirror đúng `@PreAuthorize` backend. Tránh scatter điều kiện `user.role === "ROLE_ADMIN"` rải rác trong components. Khi business rule thay đổi chỉ cần sửa 1 file.

- **TMDB search qua backend** — FE gọi `GET /api/movies/tmdb/search` thay vì gọi TMDB trực tiếp. Tránh lộ `TMDB_API_KEY` ra client.

- **Collapsible sidebar** — Nhóm Age Ratings / Formats / Companies vào dropdown "Movies" thay vì thêm 3 mục riêng lên sidebar, giữ sidebar không bị quá dài khi scale thêm reference data pages.

- **`STATUS_CONFIG` map** — Định nghĩa một lần duy nhất màu badge và label cho 7 `MovieStatus`, dùng chung ở cả `MovieTable` và `MovieDetailModal`.

---

## How to Test

**Setup:**
1. Rebuild backend: `docker-compose up -d --build movie-service`
2. Chạy frontend: `cd client && npm install && npm run dev`
3. Đăng nhập với tài khoản ADMIN

**Test TMDB Import:**

4. Vào `/admin/movies` → click **Add Movie**
5. Chuyển sang tab **TMDB Search** → gõ "Avengers" → đợi debounce 400ms → chọn một kết quả
6. Kiểm tra form auto-fill: `originalTitle`, `releaseDate`, `durationMinutes`, `synopsis` (EN), poster, cast list
7. Chuyển sang tab **Translations** → kiểm tra tab VI và EN đều có nội dung
8. Chuyển sang tab **Cast** → kéo thả để đổi thứ tự billing order → kiểm tra thứ tự thay đổi
9. Submit → phim được tạo với status `DRAFT`

**Test workflow duyệt phim:**

10. Với phim vừa tạo (DRAFT) → click **Submit** → status chuyển `PENDING_REVIEW`
11. Click **Approve** → status chuyển `COMING_SOON`
12. Click **Release** → status chuyển `NOW_SHOWING`
13. Click **Suspend** → nhập lý do → status chuyển `SUSPENDED`
14. Click **Reinstate** → status chuyển `NOW_SHOWING`
15. Click **End** → status chuyển `ENDED` → phim vẫn còn trong bảng (không bị filter ra)

**Test role EMPLOYEE:**

16. Đăng nhập tài khoản EMPLOYEE → tự động redirect đến `/admin/movies`
17. Kiểm tra: không thấy nút **Approve**, **Reject**, **Release**, **Suspend**, **End**, **Reinstate**
18. Chỉ thấy **Submit** (với DRAFT), **Edit**, **View**

**Test reference data pages (ADMIN only):**

19. Click sidebar **Movies** → dropdown xuất hiện với 4 sub-items
20. Vào **Age Ratings** → tạo rating mới "NC-17" / 18 tuổi → kiểm tra hiển thị badge màu đúng
21. Edit rating → Save → bảng cập nhật ngay (không cần reload)
22. Delete rating → confirm → rating biến khỏi bảng
23. Lặp tương tự với **Formats** và **Companies**

**Test dark/light mode:**

24. Toggle dark/light mode → kiểm tra modal, bảng, sidebar đều render đúng màu

---

## Checklist

**General**
- [x] Code compiles, no TypeScript errors
- [x] Không còn `console.log` hay debug code
- [x] Follows project coding conventions (axiosClient, CSS variables, `var(--bg-card)`, `var(--text-main)`)

**Backend**
- [x] `@PreAuthorize("hasRole('ADMIN')")` trên tất cả mutation endpoints (POST/PUT/DELETE)
- [x] Exception handling dùng `AppException(MovieErrorCode.*)` — không lộ stack trace
- [x] Endpoints tested qua Postman: CRUD AgeRating, ScreeningFormat, ProductionCompany

**Frontend**
- [x] Loading state và error state handled đầy đủ ở cả 3 CRUD pages và MovieModal
- [x] `axiosClient` attach Bearer token đúng — không gửi `"null"` hay `"undefined"`
- [x] Tested dark mode và light mode
- [x] Soft-delete: phim ENDED không bị filter ra khỏi state trước khi reload

---

## Reviewer Notes

- **`MovieModal.tsx`** là file lớn nhất (~1000 dòng) — review theo từng tab (TMDB Search → Basic Info → Translations → Cast → Formats/Genres → Gallery)
- **TMDB auto-fill**: chú ý mapping genre name (case-insensitive + TMDB genre ID lookup) và age rating mapping từ TMDB certification (US ratings: G/PG/PG-13/R/NC-17)
- **`useRole.ts`**: đảm bảo các `can.*` permission khớp đúng với `@PreAuthorize` ở backend — đây là nguồn sự thật duy nhất cho FE permission
- **`handleDeleteMovie`**: trước đây dùng `.filter()` gây inconsistency với soft-delete — đã fix thành `loadMovies()`, reviewer confirm lại behavior
- **Sidebar children render**: `maxHeight` animation thay vì `display:none` để smooth collapse — không có lỗi layout khi toggle nhanh
