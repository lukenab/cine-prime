## Overview / Objective

Sau khi bấm "Submit for Review" thành công cho một phim **hoàn toàn mới** (chưa từng bấm "Save Draft" thủ công lần nào trước đó), trang lại điều hướng nhầm về modal "How would you like to create this movie?" (`/admin/movies/new`) thay vì về danh sách phim (`/admin/movies`) — dù toast báo submit thành công vẫn hiện đúng.

Đây là bug hồi quy (regression) do chính fix trước đó của tôi trong session này gây ra ([mr-redirect-after-submit-for-review.md](mr-redirect-after-submit-for-review.md), đã merge) — khi thêm `navigate(exitDestination)` để xử lý report "submit for review không chuyển hướng".

Related Issue: "so back ra modal phải ra movie list chứ" (báo cáo trực tiếp từ user, kèm screenshot)

---

## Changes Introduced

**Components:**
- `MovieEditorPage.tsx` — `handleSubmitForReview()`: thay `navigate(exitDestination)` bằng `navigate("/admin/movies")` (hardcode) trong nhánh thành công.

---

## Key Architectural Decisions

- **Root cause: stale closure, không phải lỗi routing.** `exitDestination` được tính lại mỗi lần render, dựa vào `editMovieId`/`activeMovieId`. Với phim mới hoàn toàn, tại thời điểm handler `handleSubmitForReview` được tạo ra (render đầu tiên), cả hai giá trị này đều `null` → `exitDestination` = `"/admin/movies/new"`. Khi handler này chạy, nó gọi `saveDraftThenSubmit()` — hàm này lưu phim lần đầu và cập nhật `activeMovieId` như một *side effect*, khiến component re-render với `exitDestination` mới ("/admin/movies"). Nhưng closure của `handleSubmitForReview` đang chạy dở KHÔNG tự "thấy" giá trị mới này — nó vẫn giữ nguyên `const exitDestination` đã capture từ lúc được tạo ra. Kết quả: `navigate(exitDestination)` gọi với giá trị cũ `"/admin/movies/new"`.
- **Vì sao hardcode là đúng, không phải patch lại closure:** `reviewedMovie` (kết quả trả về từ submit thành công) luôn có `id` thật — nghĩa là phim chắc chắn đã được lưu. Do đó đích đến sau khi submit thành công LUÔN LUÔN là danh sách phim, không bao giờ là modal tạo mới. Không cần logic điều kiện nào cả, hardcode `"/admin/movies"` là chính xác và đơn giản hơn việc cố gắng "làm tươi" lại `exitDestination` giữa chừng.
- **Không đụng đến nút "Back"** — `exitDestination` vẫn giữ nguyên vai trò và logic hai chế độ (list vs. chooser) cho `requestExit()`, vì nút Back có thể được bấm ở bất kỳ thời điểm nào (kể cả trước khi lưu), nên vẫn cần phân biệt "phim đã tồn tại" và "vẫn đang là draft chưa lưu lần nào".

---

## How to Test

1. `npx tsc --noEmit` — không lỗi ở `MovieEditorPage.tsx`.
2. `npm test -- --run` — 210/211 pass (1 lỗi có sẵn không liên quan trong `MovieEditorPage.validation.test.tsx`, đã xác nhận tồn tại từ trước, không do fix này gây ra).
3. Thủ công (đã test qua Playwright + app thật, đúng kịch bản user báo cáo):
   - Vào `/admin/movies/new/manual` (tạo phim hoàn toàn mới).
   - Điền các trường bắt buộc tối thiểu (title, duration, 1 genre, 1 format).
   - Bấm thẳng "Submit for Review" — **không** bấm "Save Draft" trước.
   - Xác nhận: toast "... submitted for review." hiện đúng, VÀ trang chuyển về `/admin/movies` (danh sách), không phải modal `/admin/movies/new`.
4. Regression check cho case cũ (phim đã có sẵn, chỉnh sửa rồi submit) — vẫn hoạt động đúng như MR trước, vì `reviewedMovie` luôn có id thật nên `"/admin/movies"` luôn đúng cho cả hai trường hợp.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend**
- [x] Loading and error states handled (nhánh lỗi của `handleSubmitForReview` không đổi)
- [x] Không đổi hành vi "Save Draft" hay nút "Back"

---

## Reviewer Notes

- Đây là fix cho chính regression do MR trước (`feat/redirect-after-submit-for-review`, đã merge vào `develop`) gây ra. Nguyên nhân là dùng nhầm một `const` được tính theo render (`exitDestination`) bên trong một closure bất đồng bộ đang chạy, trong khi giá trị phụ thuộc lại đổi ngay trong lúc closure đó đang thực thi (side effect của `saveDraftThenSubmit()`).
- Chỉ đổi 1 dòng logic (`navigate(...)` target); phần còn lại của `handleSubmitForReview` giữ nguyên.
