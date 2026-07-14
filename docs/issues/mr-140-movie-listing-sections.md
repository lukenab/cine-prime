## Overview / Objective

Tách `MoviesPage.tsx` (trang danh sách phim khách hàng) thành 2 section riêng biệt — "Đang Chiếu" (NOW_SHOWING) và "Sắp Chiếu" (COMING_SOON) — thay vì render tất cả phim có poster chung một grid như trước. Đây là UI pattern chuẩn của trang rạp chiếu phim, giúp khách phân biệt ngay phim nào xem được hôm nay và phim nào chỉ để tham khảo/chờ ra mắt.

Related Issue: Closes #140
Depends on: không có

**Lưu ý quan trọng trước khi đọc tiếp:** phần code mô tả bên dưới **đã tồn tại sẵn trong working tree hiện tại, nhưng CHƯA được commit**. Xem mục "Reviewer Notes" ở cuối — có vài điểm cần xử lý ở tầng git trước khi MR này có thể tạo thật trên GitLab.

---

## Changes Introduced

**Controllers / Routes:** Không có — đây là thay đổi thuần frontend, dùng lại đúng endpoint `GET /api/movies/public` đã có (`MovieService.findAllPublic()`, đã verify lại: chỉ trả `COMING_SOON`/`NOW_SHOWING` qua `findByStatusIn`, không lộ `ENDED`/`DRAFT`/`PENDING_REVIEW` ra trang customer).

**Components:**
- `MoviesPage.tsx`: thêm component con `MovieSection({ id, title, movies, onOpen })` — tự ẩn (`return null`) nếu `movies.length === 0`, hiển thị heading kèm số lượng (`{title} ({movies.length})`), gắn `id` để làm anchor scroll target.
- `filtered` (kết quả sau khi áp search + genre filter) được tính **một lần duy nhất**, sau đó tách thành 2 danh sách con: `nowShowing = filtered.filter(m => m.movieStatus !== "COMING_SOON")` và `comingSoon = filtered.filter(m => m.movieStatus === "COMING_SOON")`. Tách sau khi filter chứ không phải trước, để search/genre áp dụng đồng nhất cho cả 2 section.
- `PosterCard`: thêm nhánh hiển thị theo `movie.movieStatus === "COMING_SOON"` — badge góc phải trên đổi từ rating (sao vàng) sang ngày phát hành (`formatReleaseDate(movie.releaseDate)` kèm icon lịch), vì hiển thị rating cho phim chưa ra mắt không hợp lý.
- `Navbar.tsx`: dropdown "Movies" trỏ tới `/movies#now-showing` và `/movies#coming-soon`; `MoviesPage.tsx` có `useEffect` lắng nghe `location.hash` và scroll tới đúng section sau khi data load xong (`document.getElementById(hash)?.scrollIntoView(...)`).

**DTOs / Mappers:** Không có — dùng thẳng field `movieStatus` đã có sẵn trong `MovieApiResponse`.

**Database / JPA / Migration:** Không áp dụng.

**Exception Handling / Error Codes:** Không có thay đổi.

---

## Acceptance Criteria — đối chiếu với code hiện tại

- [x] Section "Đang Chiếu" hiển thị phim NOW_SHOWING (có poster) — đạt về mặt logic (`movieStatus !== "COMING_SOON"`), nhưng **heading hiện đang là tiếng Anh "Now Showing"**, không phải "Đang Chiếu (N)" như AC ghi rõ — xem Reviewer Notes.
- [x] Section "Sắp Chiếu" hiển thị phim COMING_SOON (có poster) — đạt, nhưng heading là "Coming Soon" (tiếng Anh), cùng vấn đề label như trên.
- [x] Phim ENDED/DRAFT/PENDING_REVIEW không hiển thị — đạt, đã verify tận `MovieService.findAllPublic()`: query `findByStatusIn(COMING_SOON, NOW_SHOWING)`, không có đường nào để status khác lọt qua.
- [x] Mỗi section có heading rõ ràng kèm số lượng — đạt (`{title} ({movies.length})`).
- [x] Section rỗng thì tự ẩn — đạt (`if (movies.length === 0) return null;`).
- [x] Search/genre filter hoạt động đúng ở cả 2 section — đạt, vì tách nowShowing/comingSoon từ `filtered` (đã qua search+genre), không tính riêng từng nhánh.
- [ ] Phim COMING_SOON hiển thị release date thay vì nút "Mua vé" — **partial**: badge góc trên đã đổi thành ngày phát hành đúng yêu cầu, nhưng thực ra card hiện tại (cả 2 trạng thái) không có nút "Mua vé" riêng nào cả — toàn bộ card chỉ có 1 hành động chung là mở `MoviePreviewModal` (hover hiện "View Details" cho cả 2 loại phim như nhau). Tức là phần "thay thế nút Mua vé" không literal đúng như AC mô tả vì nút đó chưa từng tồn tại ở dạng tách biệt — cần PM/reviewer xác nhận ý đồ ban đầu có phải "trong modal chi tiết ẩn nút mua vé cho phim Coming Soon" hay không (modal đó nằm ngoài phạm vi file này).
- [x] Responsive mobile/desktop — đạt (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`).

**Tóm lại: 6/8 tiêu chí đạt đầy đủ, 2 tiêu chí đạt về mặt chức năng nhưng lệch chữ (tiếng Anh thay vì tiếng Việt) hoặc cần làm rõ thêm phạm vi.**

---

## Key Architectural Decisions

- **Tách nowShowing/comingSoon SAU khi filter, không phải trước** — đảm bảo search theo tên phim và genre pill hoạt động nhất quán trên cả 2 section cùng lúc, thay vì phải viết 2 bộ state/logic filter riêng.
- **Không filter lại theo status ở frontend ngoài việc tách 2 nhóm** — dựa vào invariant "backend `/api/movies/public` chỉ bao giờ trả về đúng 2 status" (đã verify). Rủi ro: nếu sau này có ai thêm status public thứ 3 (ví dụ business rule mới), `nowShowing` (định nghĩa là "khác COMING_SOON") sẽ vô tình nuốt luôn status mới đó vào nhầm nhóm — nên dùng so sánh dương tính rõ ràng (`=== "NOW_SHOWING"`) thay vì âm tính (`!== "COMING_SOON"`) để an toàn hơn về lâu dài, dù hiện tại 2 cách cho kết quả giống hệt nhau.
- **`mockMovies` (dữ liệu fallback khi lỗi/offline) không có field `movieStatus`** — được coi mặc định là "đang chiếu" (rơi vào nhánh `!== "COMING_SOON"`), giữ hành vi cũ khi API lỗi.

---

## How to Test

1. `cd client && npm run dev`; backend `movie-service` đang chạy, có ít nhất vài phim status NOW_SHOWING và vài phim COMING_SOON (dùng TMDB import + set status thủ công nếu cần).
2. Mở `/movies` — xác nhận 2 heading tách biệt, đúng số lượng phim mỗi section, thứ tự NOW_SHOWING trên trước COMING_SOON dưới.
3. Gõ search hoặc chọn 1 genre pill — xác nhận cả 2 section cùng lọc theo điều kiện đó, không phải chỉ section trên.
4. Xoá hết phim COMING_SOON (hoặc lọc ra bằng search không khớp) — xác nhận section "Coming Soon" biến mất hoàn toàn, không để lại heading trống.
5. Click dropdown "Movies" trên Navbar → mục con trỏ `#now-showing`/`#coming-soon` — xác nhận trang scroll đúng tới section tương ứng kể cả khi đã đang ở `/movies`.
6. Mở 1 card phim COMING_SOON — xác nhận badge góc trên hiện ngày phát hành (không hiện rating sao).
7. Test responsive: thu nhỏ về mobile width — xác nhận grid co về 2 cột, không vỡ layout.

---

## Checklist

**General**
- [x] Follows project coding conventions
- [x] No debug / console.log code left
- [ ] Code compiles, no errors — `tsc --noEmit` chưa chạy lại riêng cho commit này (xem Reviewer Notes về tình trạng working tree)

**Frontend**
- [x] Loading and error states handled — giữ nguyên logic loading/error cũ, chỉ thêm bước tách nhóm
- [x] Genre/search filter tested against both sections
- [ ] Tested on both dark and light mode — cần tự kiểm tra trực quan
- [ ] Vietnamese label wording ("Đang Chiếu"/"Sắp Chiếu") — **hiện đang là tiếng Anh, cần sửa nếu muốn khớp đúng AC**

---

## Reviewer Notes — đọc trước khi merge

- **QUAN TRỌNG NHẤT: toàn bộ thay đổi trên vẫn nằm trong working tree, CHƯA commit.** `git diff --stat HEAD -- client/src/pages/customer/MoviesPage.tsx` cho thấy 249 dòng thêm / 192 dòng xoá so với bản đã commit gần nhất (bản HEAD không hề có MovieSection/now-showing/coming-soon). Cần commit trước khi mở MR thật trên GitLab.
- **Phát hiện khi kiểm tra git status: có một file `.git/index.lock` đang tồn tại trong repo tại thời điểm viết MR này.** Đây thường là dấu hiệu có một tiến trình git khác đang chạy (git đang add/commit/rebase ở một chỗ khác), hoặc một lock cũ bị bỏ sót sau khi 1 lệnh git bị ngắt giữa chừng. Nếu cố `git add`/`git commit` lúc file này còn tồn tại, git sẽ báo lỗi "Unable to create '.git/index.lock': File exists." — **kiểm tra không có tiến trình git nào khác đang chạy (đóng hết IDE background git task) trước khi thao tác, sau đó mới xoá file lock này rồi thử lại.**
- **Cực kỳ quan trọng: `git diff --stat HEAD` toàn repo cho thấy 593 file thay đổi, +73,330/-72,782 dòng** — lớn hơn rất nhiều so với riêng tính năng này. Nhiều khả năng có một đợt reformat toàn repo (prettier/eslint --fix, hoặc đổi line-ending) đang nằm chung uncommitted với các thay đổi tính năng thật (bao gồm `MoviesPage.tsx`, `Navbar.tsx` — riêng file này đã 734 dòng thay đổi, nhiều khả năng phần lớn là reformat chứ không phải logic mới, và `HomePage.tsx` 96 dòng). **Tuyệt đối không nên `git add -A` hay `git add .` để commit MR này** — sẽ vô tình gộp toàn bộ thay đổi không liên quan (bao gồm cả những file backend/config khác) vào chung 1 MR, rất khó review và rủi ro cao. Nên `git add` chỉ đích danh các file liên quan tới #140: `client/src/pages/customer/MoviesPage.tsx`, `client/src/layouts/Navbar.tsx`, `client/src/pages/customer/HomePage.tsx` — và tốt nhất nên dùng `git add -p` (add từng hunk) cho `Navbar.tsx` vì file đó lẫn cả reformat lẫn logic thật, cần tách tay phần nào là phần của #140.
- **2 tiêu chí AC chưa khớp chữ chính xác** (xem bảng đối chiếu ở trên): heading tiếng Anh thay vì tiếng Việt "Đang Chiếu"/"Sắp Chiếu", và không có nút "Mua vé" riêng để "thay thế" như AC mô tả (card hiện dùng chung 1 hành động "View Details" cho mọi trạng thái). Cả hai đều là gap nhỏ, dễ sửa, nhưng nên xác nhận với người tạo issue (Nguyễn An Bình) trước khi đóng issue là "Done" — nếu chỉ đổi 2 chuỗi text thì rất nhanh, không đáng phải mở issue mới.
- Chưa chạy `tsc --noEmit` riêng cho đúng bộ thay đổi này (môi trường viết MR này không tách được đúng commit để test riêng lẻ do vấn đề working tree ở trên) — reviewer nên tự chạy lại sau khi đã commit đúng phạm vi.
