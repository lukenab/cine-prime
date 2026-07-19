## Overview / Objective

MR này chuẩn hóa các thao tác trong Movie Editor thành hai command độc lập: `Save Draft` để lưu nội dung ở trạng thái `DRAFT` và `Submit for Review` để lưu phiên bản mới nhất trước khi thực hiện lifecycle transition. Thanh thao tác được ghim trong viewport, hiển thị rõ trạng thái thay đổi/lưu lỗi và ngăn double-submit nhằm giảm nguy cơ mất dữ liệu hoặc chuyển trạng thái ngoài ý muốn.

Related Issue: Closes #<ISSUE_NUMBER> (`MOV-EDITOR-03`)

---

## Changes Introduced

**Controllers / Routes:**

- Sau lần tạo draft đầu tiên, thay URL hiện tại bằng `/admin/movies/{movieId}/edit` để các lần lưu tiếp theo gọi update thay vì tạo movie mới.
- Giữ nguyên section hash hiện tại khi chuyển từ create route sang edit route.

**Services / Logic:**

- Tách orchestration persist draft khỏi lifecycle submit bằng `persistMovieDraft()` và `saveDraftThenSubmit()`.
- `Save Draft` chỉ gọi create/update movie; không gọi `submitForReview()` hoặc approve.
- `Submit for Review` luôn chờ lưu draft thành công rồi mới gọi endpoint submit.
- Phân biệt lỗi lưu draft với lỗi submit sau khi draft đã được lưu thành công.
- Ngăn xử lý đồng thời và double-click bằng operation state kết hợp synchronous guard.
- Theo dõi fingerprint của form và pending TMDB media để xác định dirty state.
- Cảnh báo `beforeunload` và confirmation dialog khi người dùng bấm Back trong lúc còn thay đổi chưa lưu.
- Chỉ hiển thị command phù hợp với permission và trạng thái `DRAFT`.

**DTOs / Mappers / Components:**

- Thêm `MovieEditorActionBar` dạng sticky với các trạng thái:
  - `No unsaved changes`
  - `Unsaved changes`
  - `Saving draft…`
  - `All changes saved`
  - `Save failed`
  - `Submission failed — draft saved`
  - `Submitted for review`
- Thay action cũ `Add Movie`/`Save Changes` bằng `Save Draft` và `Submit for Review`.
- Điều chỉnh sticky offset của section navigation trên mobile để không bị action bar che khuất.

**Database / JPA / Migration:**

- Không thay đổi database.

**Exception Handling / Error Codes:**

- Hiển thị message trả về từ API khi có thể; dùng fallback riêng cho save failure và submit failure.
- Khi submit thất bại sau save, UI thông báo rõ draft đã được lưu để người dùng không thao tác lặp lại ngoài ý muốn.

---

## Key Architectural Decisions

- Persistence và lifecycle transition được mô hình hóa thành hai command riêng, tránh việc nút lưu vô tình thay đổi content status.
- `saveDraftThenSubmit()` đảm bảo thứ tự `save → submit`; submit không được thực hiện nếu save reject.
- URL dùng `replace` sau lần create đầu để tránh tạo history entry trùng và đảm bảo editor tiếp tục làm việc trên một movie ID ổn định.
- Dirty state được so sánh từ form data và pending media thay vì set thủ công ở từng input, nhờ đó các section dùng chung một nguồn trạng thái.
- Readiness issue chỉ chặn Submit for Review; Save Draft vẫn dùng validation integrity theo contract create/update hiện tại.

---

## How to Test

1. Đăng nhập bằng tài khoản `ADMIN` hoặc `EMPLOYEE` có quyền quản lý movie.
2. Mở `/admin/movies/new/manual` và thay đổi một field; xác nhận action bar hiển thị `Unsaved changes`.
3. Nhập đủ Original Title, Duration, tối thiểu một Genre và một Screening Format.
4. Bấm `Save Draft`; xác nhận:
   - Chỉ có một request `POST /api/movies` được gửi.
   - Movie trả về trạng thái `DRAFT`.
   - URL chuyển thành `/admin/movies/{movieId}/edit`.
   - Action bar hiển thị `All changes saved`.
5. Thay đổi dữ liệu rồi bấm `Save Draft` lần nữa; xác nhận request dùng `PUT /api/movies/{movieId}` và không tạo movie trùng.
6. Thay đổi dữ liệu rồi bấm `Submit for Review`; xác nhận request update/create hoàn tất trước request `POST /api/movies/{movieId}/submit`.
7. Double-click nhanh vào Save hoặc Submit; xác nhận chỉ một chuỗi request được thực thi.
8. Mô phỏng create/update API lỗi; xác nhận action bar hiển thị `Save failed` và submit endpoint không được gọi.
9. Mô phỏng submit API lỗi sau khi save thành công; xác nhận hiển thị `Submission failed — draft saved`.
10. Sửa form rồi bấm Back hoặc reload/đóng tab; xác nhận có cảnh báo thay đổi chưa lưu.
11. Kiểm tra tài khoản không có quyền hoặc movie không ở `DRAFT`; xác nhận các command không hợp lệ không xuất hiện.
12. Kiểm tra desktop/mobile và dark/light mode; action bar và section navigation không che nhau.

---

## Checklist

**General**

- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions
- [x] Unit/component tests pass
- [x] ESLint pass
- [x] Production build pass

**Frontend**

- [x] Loading, success, dirty và error states được xử lý
- [x] Không thay đổi cơ chế Bearer token của `axiosClient`
- [x] Permission và movie lifecycle status được áp dụng cho action visibility
- [ ] Browser QA dark/light mode — cần session đăng nhập để xác nhận thủ công

---

## Reviewer Notes

- Thay `<ISSUE_NUMBER>` bằng số GitLab issue trước khi tạo MR.
- Reviewer nên tập trung kiểm tra thứ tự network request của `Submit for Review`, URL sau lần save đầu và hành vi khi submit API lỗi nhưng draft đã lưu thành công.
- Nhánh có commit nền chứa toàn bộ thay đổi còn tồn tại từ workspace theo yêu cầu của project leader; commit triển khai sticky action bar được tách riêng để thuận tiện review.
