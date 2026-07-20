## Overview / Objective

Genre có 2 trạng thái (`ACTIVE`, `PENDING_REVIEW`) nhưng chỉ có nơi tạo ra `PENDING_REVIEW` (import TMDB gặp genre chưa map, `TmdbService.createPendingReviewGenre()`) — không có endpoint hay UI nào để duyệt (promote) một genre từ `PENDING_REVIEW` lên `ACTIVE`. MR này xây dựng luồng duyệt đó: endpoint backend + UI trên trang "Manage Genres".

Related Issue: Xây luồng duyệt genre (yêu cầu trực tiếp từ user, tiếp nối câu hỏi "đã có UI cho phần nếu genre đó chưa có thì phải được duyệt chưa" ở MR chuẩn hóa tên genre)

---

## Changes Introduced

**Controllers / Routes:**
- `GenreController` — thêm `PATCH /api/genres/{id}/approve` (`@PreAuthorize("hasRole('ADMIN')")`).

**Services / Logic:**
- `GenreService.approve(Long id)` — tìm genre theo id (404 `GENRE_NOT_FOUND` nếu không có), kiểm tra `status == PENDING_REVIEW` (409 `GENRE_NOT_PENDING_REVIEW` nếu không), rồi set `ACTIVE` và save.

**DTOs / Mappers / Components:**
- Không có DTO mới — tái dùng `GenreResponse` (đã có sẵn field `status`).
- **Frontend:** `client/src/api/movieApi.ts` — thêm type `GenreStatus`, thêm `status`/`tmdbGenreId` vào `GenreResponse`, thêm `movieApi.approveGenre(id)`.
- `ManageGenresPage.tsx` — thêm filter tab (All / Active / Pending Review với đếm số lượng), cột "Status" (badge Active/Pending Review), nút "Approve" cho dòng đang `PENDING_REVIEW`.

**Database / JPA / Migration:**
- Không có — dùng cột `status` đã tồn tại sẵn trên `genre`.

**Exception Handling / Error Codes:**
- Thêm `GENRE_NOT_PENDING_REVIEW(2091, ..., HttpStatus.CONFLICT)` trong `MovieErrorCode`.

---

## Key Architectural Decisions

- **ADMIN-only**, không cho EMPLOYEE duyệt — khớp đúng governance level đã có sẵn trong codebase: `POST /api/genres` (tạo genre) đã là ADMIN-only, và luồng duyệt phim (`PENDING_REVIEW → APPROVED` trong `MovieController`) cũng ADMIN-only trong khi EMPLOYEE chỉ được submit for review.
- **Không xây "reject/delete"**: nếu admin thấy 1 pending genre không nên tồn tại, MR này chưa xử lý việc xóa/từ chối nó. Lý do: `createPendingReviewGenre()` gắn genre đó vào phim đang import ngay lập tức (trước khi admin kịp duyệt), nên xóa thẳng genre có thể phá vỡ genre list của phim đã import. Xử lý đúng đắn cho "reject" cần quyết định thêm (xóa khỏi phim luôn hay chỉ hiện cảnh báo) — cố tình để ngoài phạm vi MR này, tương tự cách các MR trước disclose rõ resync/reject chưa tồn tại.
- **Tái dùng `GenreResponse` sẵn có** thay vì tạo DTO riêng cho approve — response trả về giống hệt response của `getAll()`/`create()`, không cần field gì thêm.
- **Không thêm endpoint lọc theo status ở backend** (`GET /api/genres?status=...`) — `GET /api/genres` vốn đã trả `status` cho từng genre, và cả 3 nơi gọi `getGenres()` ở frontend đều là trang admin/employee (`MovieEditorPage`, `ManageMoviePage`, `ManageGenresPage`), không có nguy cơ lộ `PENDING_REVIEW` ra customer-facing UI — nên lọc phía client theo `statusFilter` là đủ, không cần thêm tải trọng API.

---

## How to Test

1. `./mvnw.cmd -pl movie-service clean test` — 242 test pass, chỉ còn lỗi có sẵn không liên quan `MovieImageRepositoryIntegrationTest.save_NativeQuery_LegacyMixedCase_UppercaseEnum`. 3 test mới trong `GenreServiceTest`: approve thành công, approve genre đã `ACTIVE` (409), approve genre không tồn tại (404).
2. `npm test` (client) — 206/206 pass. `npx tsc --noEmit` — không phát sinh lỗi mới ở `movieApi.ts`/`ManageGenresPage.tsx` (các lỗi TS hiện có trong repo đều ở file khác, không liên quan).
3. Thủ công: import 1 phim TMDB có genre chưa map, chọn "Create as pending review" ở TMDB Import Review → genre mới xuất hiện ở "Manage Genres" với badge "Pending Review" và tab "Pending Review (N)".
4. Bấm "Approve" trên dòng đó → badge chuyển "Active", nút Approve biến mất, genre giờ dùng được bình thường ở mọi nơi khác (ví dụ chọn làm genre cho phim khác qua "Manage Genres" hay editor).
5. Gọi `PATCH /api/genres/{id}/approve` bằng token EMPLOYEE → 403. Gọi lại lần 2 với cùng id đã `ACTIVE` → 409 `GENRE_NOT_PENDING_REVIEW`.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] No N+1 query issues
- [x] Exception handling uses correct error codes
- [ ] Chưa test thủ công qua Postman trong phiên này (đã cover qua unit test + đọc code, xem How to Test #1)

**Frontend**
- [x] Loading and error states handled (nút Approve disable + đổi label "Approving…" khi đang gọi API, alert khi lỗi)
- [x] axiosClient attaches Bearer token correctly (không đổi phần auth, dùng chung `axiosClient`)
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên này

---

## Reviewer Notes

- **"Reject/xóa pending genre" cố tình chưa làm** — xem Key Architectural Decisions. Nếu cần, đây sẽ là MR riêng vì phải quyết định cách xử lý phim đã tham chiếu genre đó.
- Badge/tab dùng đúng 2 giá trị của `GenreStatus` enum hiện có (`ACTIVE`, `PENDING_REVIEW`) — không thêm giá trị enum mới.
- `GenreResponse.status` đã tồn tại từ trước (không phải field mới của MR này) nhưng type phía frontend (`movieApi.ts`) trước đây thiếu field này — MR này bổ sung cho khớp với response thật của backend.
