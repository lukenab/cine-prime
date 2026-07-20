## Overview / Objective

EMPLOYEE không thể tạo phim mới nếu công ty sản xuất chưa có sẵn trong hệ thống — bấm "Save Draft"/"Submit for Review" báo "You do not have permission!", console log `403 (Forbidden)` tại `POST /api/companies`.

Related Issue: "lỗi employee tạo movie không được" (yêu cầu trực tiếp từ user, kèm ảnh chụp lỗi)

---

## Changes Introduced

**Controllers / Routes:**
- `ProductionCompanyController.create()` và `.update()` — đổi từ `hasRole('ADMIN')` sang `hasAnyRole('ADMIN', 'EMPLOYEE')`. `delete()` giữ nguyên ADMIN-only.

**Test:**
- `ProductionCompanyControllerAuthorizationTest.java` (mới) — kiểm tra bằng reflection rằng `create`/`update` yêu cầu ADMIN hoặc EMPLOYEE, `delete` chỉ ADMIN, theo đúng pattern đã dùng cho `PersonControllerAuthorizationTest`.

---

## Key Architectural Decisions

- **Cùng nguyên tắc đã áp dụng cho Person trước đó (`[Backend] Enforce movie-service endpoint authorization matrix`)**: production company được thêm **inline** trong lúc tạo/sửa phim ở `MovieEditorPage` (cả ADMIN và EMPLOYEE đều dùng trang này) — `resolveCompanyIds()` phía frontend gọi `POST /api/companies` cho bất kỳ công ty nào gõ vào mà chưa có `companyId` sẵn (tức là chưa tồn tại trong hệ thống). Đây không phải hành động quản trị độc lập như tạo genre (vốn có luồng duyệt PENDING_REVIEW riêng, chỉ ADMIN thấy nút "Create new") — company giống Person hơn: dữ liệu tham chiếu dùng chung, cần thiết để hoàn thành nghiệp vụ chính (tạo phim) của cả 2 role.
- **`DELETE` vẫn ADMIN-only** — hậu quả nghiêm trọng hơn create/update (1 company có thể đang được nhiều phim tham chiếu), giữ đúng bất đối xứng đã áp dụng cho Person.
- **Đây là lỗi bị bỏ sót, không phải cố ý** — `PersonController` đã được sửa đúng ở MR trước, nhưng `ProductionCompanyController` (thêm sau, cùng cơ chế inline-create) lại chưa được cập nhật theo. MR này chỉ đưa 2 controller về cùng chuẩn.

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 250 test pass (loại trừ lỗi có sẵn không liên quan). 2 test mới: `createAndUpdateRequireAdminOrEmployee`, `deleteIsAdminOnly`.
2. Thủ công: đăng nhập tài khoản EMPLOYEE → Add New Movie → gõ tên 1 công ty chưa có trong hệ thống (không chọn từ dropdown gợi ý) → Save Draft → lưu thành công (trước MR: "You do not have permission!" + 403).
3. Xác nhận `DELETE /api/companies/{id}` bằng token EMPLOYEE vẫn trả 403 (không đổi hành vi này).

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Exception handling uses correct error codes (không đổi)
- [x] Endpoints tested via reflection-based authorization test, cùng pattern đã có sẵn trong repo

---

## Reviewer Notes

- Đã kiểm tra thêm `AgeRatingController` và `ScreeningFormatController` — cả 2 vẫn ADMIN-only cho create/update/delete, nhưng đúng ý vì Age Rating/Screening Format được chọn từ dropdown cố định trong `MovieEditorPage` (không có luồng "gõ tên mới, tự tạo nếu chưa có" như Company/Person), nên EMPLOYEE không bao giờ cần quyền tạo mới 2 loại này khi tạo phim. Không cần sửa thêm ở đâu khác.
