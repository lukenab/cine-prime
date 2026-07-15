## Overview / Objective

`ManageMoviePage.tsx` đã có tab "Pending Review" nhưng reject chỉ yêu cầu note không rỗng (không có độ dài tối thiểu), không hiển thị đủ context (poster/genre/duration/release date/age rating/synopsis) trước khi admin quyết định, không có loading state khi gọi API, và dùng `window.alert()` thay vì toast. MR này thêm `PendingReviewModal` dùng chung cho cả approve và reject, thay thế 2 icon button rời rạc trước đây.

Related Issue: Closes #139

---

## Changes Introduced

**Controllers / Routes:** Không áp dụng (frontend-only).

**Services / Logic:**
- Không đổi `movieApi.ts` — dùng lại `movieApi.approveMovie(id)` và `movieApi.requestMovieChanges(id, note)` đã có sẵn.
- `ManageMoviePage.tsx`: thêm state `reviewMovie`/`reviewLoading` + `handleReviewClick()` (fetch full `MovieV2` qua `movieApi.getMovieById()`, cùng pattern với `handleViewMovie()` hiện có cho `MovieDetailModal`), `handleReviewApprove()`, `handleReviewReject()`. Xoá `handleApprove`/`handleReject` cũ (đã chuyển logic try/catch+toast vào trong modal).

**DTOs / Mappers / Components:**
- Mới `client/src/layouts/PendingReviewModal.tsx` — hiển thị poster, title (ưu tiên bản dịch vi/en), genre, duration, release date, age rating, synopsis. Nút Reject mở form nhập note ngay trong modal (không hiện input từ đầu); Confirm Reject bị disable cho tới khi note đạt tối thiểu 10 ký tự (đếm ký tự hiển thị trực tiếp dưới ô nhập). Cả 2 nút Approve/Reject có loading spinner riêng và bị disable trong lúc gọi API. Kết quả thành công/thất bại báo qua `sonner` toast.
- `MovieTable.tsx`: xoá hẳn `InputModal` (component chỉ dùng riêng cho reject cũ) và state `rejectTarget`; thay 2 icon `Approve`/`Request changes` ở trạng thái `PENDING_REVIEW` bằng 1 icon `Review submission` (`ClipboardCheck`) mở `PendingReviewModal` qua prop mới `onReviewClick`.
- `App.tsx`: mount `<Toaster richColors position="top-right" theme="system" />` từ `sonner` ở gốc app (lần đầu tiên toast được dùng thật trong codebase — xem Key Architectural Decisions).

**Database / JPA / Migration:** Không áp dụng.

**Exception Handling / Error Codes:** Không áp dụng — lỗi API vẫn hiển thị qua `err?.response?.data?.message` như quy ước hiện có, chỉ đổi kênh hiển thị từ `alert()` sang `toast.error()`.

---

## Key Architectural Decisions

- **`sonner` được cài thật (thêm vào `package.json`), không dùng lại `components/ui/sonner.tsx` có sẵn.** Phát hiện trong lúc làm: cả `sonner` lẫn `next-themes` (dependency của wrapper có sẵn đó) đều **không có trong `package.json`/`node_modules`/lockfile** — file đó là scaffold chết từ trước, chưa từng chạy được (`npx tsc --noEmit` xác nhận lỗi `Cannot find module 'next-themes'` tại chính file đó, kể cả trước MR này). Thay vì fix file cũ (phải thêm cả `next-themes` không cần thiết), MR này `npm install sonner` và mount `<Toaster>` từ `"sonner"` trực tiếp, dùng `theme="system"` (sonner hỗ trợ sẵn, không cần next-themes) thay vì đồng bộ với state `isDarkMode` tuỳ biến của app — có thể cải thiện sau nếu cần khớp chính xác toggle dark mode hiện có.
- **Thay hẳn 2 icon Approve/Request-changes bằng 1 nút "Review"**, đúng theo Technical Notes của issue ("Import vào ManageMoviePage.tsx và thay thế inline approve/reject buttons ở tab PENDING_REVIEW"). Cả 2 hành động giờ nằm trong modal có đủ context, thay vì approve tức thời không xem lại thông tin phim.
- **Gate hiển thị nút theo `useRole().can` giữ nguyên logic cũ** (`can.approve`/`can.requestChanges`, ADMIN-only) — chỉ gộp UI, không đổi authorization.
- **`InputModal` bị xoá hẳn** thay vì giữ lại made-unused, vì nó chỉ được dùng ở đúng 1 chỗ (reject cũ) và không có usage nào khác trong file.

---

## How to Test

1. `npx tsc --noEmit` — 101 lỗi trước và sau MR này giống hệt nhau (baseline có sẵn: thiếu package `@radix-ui/*`, `mockShowtime.ts`, v.v., không liên quan) — xác nhận MR không thêm lỗi type mới.
2. `npx vite build` — build production thành công.
3. Manual: đăng nhập ADMIN → `/admin/movies` → tab "Pending Review" → xác nhận mỗi row chỉ còn 1 icon "Review submission" (không còn 2 icon Approve/Reject riêng).
4. Manual: bấm Review → xác nhận modal hiện đủ poster/title/genre/duration/release date/age rating/synopsis.
5. Manual: bấm Approve → xác nhận nút hiện spinner trong lúc gọi API, sau đó toast success hiện ra, modal đóng, phim biến khỏi tab Pending Review.
6. Manual: bấm Reject → xác nhận form note KHÔNG hiện sẵn, chỉ hiện sau khi bấm Reject. Gõ < 10 ký tự → nút "Confirm Reject" vẫn disable, counter hiện đỏ. Gõ ≥ 10 ký tự → nút enable, bấm → spinner, toast success, modal đóng, phim chuyển sang "Changes Requested".
7. Manual: tắt mạng/để backend lỗi → xác nhận toast.error hiện thông báo lỗi từ `err.response.data.message`, modal KHÔNG đóng (admin có thể sửa và thử lại).
8. Manual: đăng nhập EMPLOYEE → xác nhận tab Pending Review vẫn chỉ thấy nút View (Eye), không thấy nút Review (giữ nguyên authorization cũ).

---

## Checklist

**General**
- [x] Code compiles, no errors (`npx tsc --noEmit` — không phát sinh lỗi mới so với baseline)
- [x] No debug / console.log code left
- [x] Follows project coding conventions (raw elements + `var(--...)` + Tailwind layout-only, khớp `MovieDetailModal.tsx`/`MovieTable.tsx`)

**Backend:** Không áp dụng.

**Frontend**
- [x] Loading and error states handled (spinner riêng cho Approve/Reject, lỗi hiện qua toast thay vì im lặng)
- [x] axiosClient attaches Bearer token correctly (không đổi `movieApi.ts`/`api.ts`)
- [ ] Tested on both dark and light mode — mới verify bằng đọc CSS var convention (`var(--bg-main)` v.v. đã theme-aware sẵn), CHƯA tự chạy UI thật bằng mắt trong phiên này; reviewer nên tự kiểm tra dark/light trước khi merge.

---

## Reviewer Notes

- **`sonner` là dependency mới** (`package.json`/`package-lock.json` có thay đổi) — đây là lần đầu tiên toast thật được dùng trong codebase; các luồng approve/reject/delete khác (`ManageMoviePage.tsx`'s `handleDeleteMovie`, submit, rework) vẫn dùng `alert()` như cũ, ngoài phạm vi issue này. Có thể cân nhắc một MR riêng để thống nhất toàn bộ sang toast nếu team muốn.
- **`movieApi.requestMovieChanges` chứ không phải `movieApi.rejectMovie`** — issue gốc ghi `movieApi.rejectMovie(id, note)` nhưng hàm đó không tồn tại trong `movieApi.ts`; hàm tương đương thực tế là `requestMovieChanges` (route BE vẫn là `/reject`). Đã dùng đúng hàm có sẵn, không tạo hàm trùng.
- **Chưa tự chạy UI thật (dev server) trong phiên làm việc này** — đã verify bằng `tsc --noEmit` (không lỗi mới) và `vite build` (build thành công), nhưng chưa click-through thật bằng trình duyệt; reviewer nên tự `npm run dev` và làm theo "How to Test" trước khi merge.
