## Overview / Objective

Redesign `MovieDetailModal` (modal "View details" ở trang Manage Movies) — bố cục cũ dồn poster + gallery + link ngoài vào 1 cột 200px cố định, còn toàn bộ thông tin phim (stats, genres, formats, age rating, tagline, synopsis, cast, availability, production, gallery lần 2) xếp chồng liên tục trong 1 scroll dài, không có phân cấp hình ảnh.

Related Issue: "Giúp tôi design lại phần view movie detail vì khá cũ" (yêu cầu trực tiếp từ user)

---

## Changes Introduced

**Components:**
- `MovieDetailModal.tsx` — viết lại hoàn toàn phần bố cục, giữ nguyên toàn bộ props/behavior public (`open`, `movie`, `loading`, `onClose`) và mọi tính năng đã có.

**Không có thay đổi API/DTO/migration** — MR này thuần UI, không đổi dữ liệu hay endpoint.

---

## Key Architectural Decisions

- **Hero cinematic thay cho cột poster cố định:** ảnh `BACKDROP` (nếu có) làm nền có gradient phủ, poster nổi đè lên mép dưới hero. Nếu phim không có ảnh `BACKDROP` (đa số phim tạo tay/chưa import đầy đủ), fallback sang chính poster làm nền (blur + scale), fallback cuối là nền phẳng theo `var(--bg-card)` — không bao giờ vỡ layout dù thiếu ảnh.
- **Tách 1 scroll dài thành 4 tab: Overview / Cast & Crew / Media / Availability** — mỗi tab chỉ hiện khi có nội dung (`Cast & Crew` ẩn nếu không có cast, `Media` ẩn nếu không có ảnh, `Availability` chỉ hiện khi `status === APPROVED`, đúng theo MOV-LC-06 y hệt bản cũ). Giúp admin xem 1 phim có nhiều dữ liệu (cast đông, nhiều ảnh) mà không phải kéo scroll qua tất cả.
- **Gộp gallery về 1 nơi duy nhất** (tab Media) — bản cũ hiển thị gallery 2 lần (lưới nhỏ ở cột trái + dải ảnh ở cuối trang), giờ chỉ còn 1 viewer chính + nút prev/next + dải thumbnail.
- **Thêm Esc-to-close + khóa scroll trang nền** — bản cũ không có, trong khi `MoviePreviewModal` (modal tương tự phía customer) đã có từ trước; đưa 2 modal về cùng chuẩn hành vi.
- **Age Rating**: badge gọn hiện ngay trong hero (chỉ code, vd "T18"); mô tả đầy đủ (vd "Restricted to viewers 18 and older") chuyển vào ô Quick Facts trong tab Overview — tránh hero quá dài nhưng không mất thông tin.
- **Toàn bộ màu sắc dùng lại design token có sẵn** (`var(--bg-main)`, `var(--bg-card)`, `var(--text-main)`, `var(--text-sub)`, `var(--border-color)`) — không thêm token mới, tự động đúng cho cả dark/light theme (đã test cả 2, xem "How to Test").

---

## How to Test

1. `npx tsc --noEmit` — không phát sinh lỗi mới ở `MovieDetailModal.tsx`.
2. `npm test` — 210/211 pass (1 lỗi có sẵn ở `MovieEditorPage.validation.test.tsx`, xác nhận lỗi này tồn tại y hệt trên `develop` sạch không liên quan tới MR này — không có test nào cho `MovieDetailModal` bị mock hoàn toàn ở `ManageMoviePage.creationOverlay.test.tsx` nên không bị ảnh hưởng).
3. Thủ công (đã chạy qua Playwright + app thật, admin/admin, tại `/admin/movies`):
   - "Inside Out 2" (APPROVED, không có ảnh BACKDROP) — hero fallback sang poster blur đúng như thiết kế; đủ 4 tab; tab Availability hiện `MovieAvailabilityPanel` bình thường.
   - "The Odyssey" (DRAFT, có ảnh BACKDROP + 4 ảnh gallery + 13 cast) — hero hiện đúng ảnh backdrop thật; tab Media chuyển ảnh prev/next đúng; tab Cast & Crew hiện đủ director + lưới actor có ảnh; tab Availability không hiện (đúng, vì DRAFT).
   - Chuyển dark ↔ light theme — cả 2 theme đọc được, tương phản tốt, gradient hero không bị vỡ ở theme sáng.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend**
- [x] Loading state giữ nguyên (skeleton cũ không đổi)
- [x] Tested on both dark and light mode
- [x] Không đổi props/contract public — không cần sửa nơi gọi (`ManageMoviePage.tsx`)

---

## Reviewer Notes

- MR này thuần refactor UI của 1 component — không đổi logic nghiệp vụ, không đổi API call nào.
- Đã xác nhận lỗi test hiện có (`MovieEditorPage.validation.test.tsx`) không liên quan và tồn tại sẵn trên `develop`.
