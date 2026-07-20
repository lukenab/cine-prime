## Overview / Objective

Chỉnh lại UI phần "TMDB Import Review" và khu vực Cast/Company/Gallery trong `MovieEditorPage` — trước đó phần readiness summary quá cồng kềnh, badge "(new)" gắn trực tiếp trên từng chip cast/company gây rối mắt, danh sách cast dài không giới hạn làm trang kéo dài bất thường, mục "Master-data mapping" trộn chung Company và Person thành 1 danh sách phẳng khó quét, và Gallery hiện placeholder "Save the movie first…" không cần thiết khi đang tạo phim mới. Đồng thời đồng bộ lại tab trạng thái ở trang Manage Genres cho khớp phong cách tab của trang Manage Movies.

Related Issue: Không có issue số cụ thể — cải tiến UI liên tục trong quá trình làm `MovieEditorPage` (nhánh làm việc trước đó, gộp lại thành 1 MR).

---

## Changes Introduced

**Components:**
- `MovieEditorPage.tsx`:
  - `ReadinessSummary` — thu nhỏ padding/font, gộp dòng mô tả vào cùng khối với tiêu đề thay vì xếp riêng dòng, danh sách blocker dùng bullet `list-style` thật thay vì tự chèn ký tự "•".
  - Bỏ badge "(new)" màu vàng gắn trên từng chip company/cast khi `companyId`/`personId` chưa có (sẽ auto-create lúc save) — thông tin này vẫn còn đầy đủ ở khối "Master-data mapping summary" phía dưới, giữ ở 2 nơi cùng lúc là dư.
  - Cast list: giới hạn hiển thị 8 dòng đầu (`MAX_VISIBLE_CAST = 8`), thêm nút "Show all cast (N)" / "Show less" để mở/thu — tránh trang kéo dài vô hạn khi phim có cast đông (vd 13+ người như "The Odyssey").
  - Gallery: ẩn hẳn khối này khi đang tạo phim mới (`!activeMovieId`) thay vì hiện placeholder "Save the movie first to add gallery images." — phần này vô dụng cho tới khi phim được lưu lần đầu, ẩn đi đỡ rối layout tạo phim.
  - "Master-data mapping" (trong TMDB Import Review): tách thành 2 cột riêng "Companies" / "Cast & Crew" (trước đây 1 danh sách phẳng trộn chung 2 loại), mỗi cột có vùng cuộn riêng (`max-h-48`), rút ngắn label trạng thái ("Mapped"/"Suggested" thay vì "✓ Mapped"/"Suggested (Auto-create on save)").
- `ManageGenresPage.tsx` — đổi tab trạng thái (All/Active/Pending Review) từ dạng nút bo tròn nền màu sang dạng tab gạch chân + badge số lượng, khớp đúng phong cách tab trạng thái đã dùng ở trang Manage Movies — nhất quán UI giữa 2 trang quản lý danh mục.

**Test:**
- `MovieEditorPage.validation.test.tsx` — thêm directive `@vitest-environment jsdom` (test cần DOM để render).

---

## Key Architectural Decisions

- **Không đổi API, DTO, hay logic nghiệp vụ nào** — toàn bộ thay đổi trong MR này là trình bày/bố cục, không đổi cách `resolveCompanyIds()`/`resolveCastPersonIds()` hoạt động, không đổi payload gửi lên backend.
- **Giữ đúng 1 nguồn thông tin cho trạng thái "sẽ auto-create"** — bỏ badge "(new)" lặp ở chip vì thông tin tương đương ("Suggested") đã có sẵn ở khối Master-data mapping summary; tránh 2 nơi hiển thị cùng 1 trạng thái với label khác nhau.
- **Giới hạn cast hiển thị mặc định (progressive disclosure)** — chọn ngưỡng 8 vì đây là số dòng vừa đủ nhìn thấy mà không cần cuộn trên khung hình thường, nút "Show all" luôn cho xem đầy đủ khi cần, không mất dữ liệu nào.

---

## How to Test

1. `npx tsc --noEmit` — không lỗi ở `ManageGenresPage.tsx` / `MovieEditorPage.tsx`.
2. `npm test` — 210/211 pass, 1 lỗi có sẵn ở `MovieEditorPage.validation.test.tsx` (`fails to save draft when structurally incomplete`) — đã xác nhận lỗi này tồn tại y hệt trên `develop` sạch (chưa gộp nhánh này), không liên quan tới thay đổi trong MR.
3. Thủ công:
   - Mở "Add Movie" → chọn phim TMDB có cast > 8 người (vd import phim có dàn cast đông) → xác nhận chỉ hiện 8 dòng đầu + nút "Show all cast (N)", bấm vào mở hết, bấm "Show less" thu lại.
   - Mở "Add Movie" (chưa lưu, chưa có `activeMovieId`) → xác nhận khối Gallery không hiện gì (trước đây hiện placeholder).
   - Ở bước TMDB Import Review có cả company và cast chưa map → xác nhận "Master-data mapping summary" hiện 2 cột riêng Companies / Cast & Crew, mỗi cột cuộn được khi dài.
   - Trang Manage Genres → tab All/Active/Pending Review hiện dạng gạch chân + số lượng, giống tab ở Manage Movies.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend**
- [x] Loading and error states handled (không đổi behavior loading/error hiện có)
- [x] axiosClient attaches Bearer token correctly (không đổi phần auth)
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên viết MR này

---

## Reviewer Notes

- Nhánh này có lịch sử commit khá vụn (vài commit fix lỗi syntax phát sinh trong lúc chỉnh — `fix(ui): fix syntax error caused by typo in export keyword`, `fix(ui): restore missing closing brace for ReadinessSummary`) — đã build/typecheck/test lại toàn bộ trước khi push, trạng thái cuối cùng sạch, không cần squash bắt buộc nhưng reviewer có thể squash nếu muốn lịch sử gọn hơn.
- 1 lỗi test có sẵn (`MovieEditorPage.validation.test.tsx`) không phải do nhánh này gây ra — đã verify bằng cách chạy lại test đó trên `develop` chưa merge nhánh, lỗi giống hệt.
