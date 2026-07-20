## Overview / Objective

Sau khi bấm "Submit for Review" thành công, trang Edit Movie không tự điều hướng đi đâu — admin bị "kẹt" trên trang chỉnh sửa đã chuyển sang chỉ đọc (không còn gì để làm tiếp vì phim không còn ở trạng thái DRAFT).

Related Issue: "sao ấn submit for review không chuyển hướng" (yêu cầu trực tiếp từ user)

---

## Changes Introduced

**Components:**
- `MovieEditorPage.tsx` — `handleSubmitForReview()`: sau khi submit thành công, gọi `navigate(exitDestination)` để quay về `/admin/movies`, dùng lại đúng biến `exitDestination` mà nút "Back" đã dùng sẵn.

---

## Key Architectural Decisions

- **Không đổi hành vi của "Save Draft"** — hàm đó CỐ Ý ở lại trang editor (đang làm dở, lưu xong vẫn cần tiếp tục sửa), chỉ `handleSubmitForReview()` mới điều hướng vì đây là hành động chuyển trạng thái (DRAFT → PENDING_REVIEW) khiến form chuyển hẳn sang chỉ đọc (`editableDraft` false → `canSaveDraft`/`canSubmitForReview` đều false) — không còn lý do gì để ở lại trang.
- **Không cần lo toast biến mất khi điều hướng** — `Toaster` (thư viện `sonner`) được mount ở `App.tsx`, nằm TRÊN router, nên tồn tại xuyên suốt khi đổi route — toast "submitted for review" vẫn hiển thị đầy đủ ở trang Manage Movies sau khi redirect.
- **Dùng lại `exitDestination` có sẵn** thay vì hardcode `/admin/movies` — nhất quán với nút Back, và tự động đúng cho cả 2 trường hợp (phim đã có ID hoặc đang ở `/new`), dù trên thực tế Submit for Review chỉ khả dụng khi phim đã tồn tại.

---

## How to Test

1. `npx tsc --noEmit` — không lỗi ở `MovieEditorPage.tsx`.
2. `npm test` — 210/211 pass (1 lỗi có sẵn không liên quan, đã xác nhận tồn tại trên `develop` sạch).
3. Thủ công (đã test qua Playwright + app thật): mở Edit Movie cho 1 phim DRAFT đã đủ điều kiện review → bấm "Submit for Review" → xác nhận:
   - Chuyển hướng về `/admin/movies`.
   - Toast "... submitted for review." hiển thị đúng ở trang danh sách.
   - Tab "Pending Review" tăng đúng số lượng.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend**
- [x] Loading and error states handled (nhánh lỗi của `handleSubmitForReview` không đổi, vẫn ở lại trang để admin sửa lỗi)
- [x] Không đổi hành vi "Save Draft"

---

## Reviewer Notes

- Chỉ đổi nhánh THÀNH CÔNG của `handleSubmitForReview()` — nhánh lỗi (`catch`) giữ nguyên hoàn toàn, admin vẫn ở lại trang để sửa nếu submit thất bại.
