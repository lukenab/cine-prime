## Overview / Objective

Frontend cho luồng invite-link (#161): thêm trang public `/activate-account?token=...` để nhân viên/member tự đặt mật khẩu lần đầu, sửa 2 form tạo tài khoản của admin (`CreateUserPage`, `CreateEmployeePage`) cho khớp contract mới của `POST /api/accounts` (không còn `username`/`password`), và thêm nút "Resend Activation Email" ở trang chi tiết account cho case link hết hạn.

Related Issue: Closes #162
Depends on: MR #161 (backend contract phải merge trước hoặc chạy song song trên cùng nhánh backend)

---

## Changes Introduced

**Controllers / Routes:**
- `routes/AppRoutes.tsx`: thêm `<Route path="/activate-account" element={<ActivateAccountPage />} />` vào nhóm `<Route element={<AuthLayout />}>` (cạnh `/login`, `/register`)

**Services / Logic:**
- Không có business logic mới ngoài các hàm gọi API liệt kê dưới đây — toàn bộ validate/luồng nằm trong component.

**DTOs / Mappers / Components:**
- `api/authApi.ts`: thêm interface `CreateAccountPayload { fullName, email, role }` và `ActivateAccountPayload { token, newPassword }`; siết kiểu `createAccount()`; thêm `activateAccount()` (`POST /api/auth/activate-account`, public) và `resendActivation(accountId)` (`POST /api/accounts/{accountId}/resend-activation`, ADMIN)
- `layouts/UserForm.tsx`: bỏ hẳn input Username/Password khỏi giao diện khi `isEditMode = false` (chế độ Tạo mới) — không chỉ ẩn, bỏ khỏi cả `UserFormData`; giữ nguyên khi `isEditMode = true`. Thêm banner giải thích "sẽ gửi activation email" ở chế độ tạo mới.
- `pages/admin/CreateUserPage.tsx`: `initialData` bỏ `username`/`password`; đọc `result.username` (backend tự sinh) từ response, hiện toast xác nhận đã gửi activation email trước khi điều hướng về `/admin/users`
- `pages/admin/CreateEmployeePage.tsx`: bỏ hẳn field `username`/`password` khỏi form và khỏi payload gửi `authApi.createAccount()` (Step 1 giờ chỉ gửi `{fullName, email, role: "EMPLOYEE"}`); thêm toast xác nhận tương tự
- `pages/auth/ActivateAccountPage.tsx` (mới): đọc `token` từ query string (`useSearchParams`), 3 trạng thái — thiếu token → lỗi ngay không gọi API; form 2 field `newPassword`/`confirmPassword` validate client-side (≥8 ký tự, khớp nhau); thành công → auto-redirect `/login` sau ~1.5s; map riêng 3 mã lỗi 1026/1027/1028 thành message rõ ràng cho người dùng
- `pages/admin/UserDetailPage.tsx` + `pages/admin/EmployeeDetailPage.tsx` (Part C — nice-to-have trong issue gốc, đã làm luôn trong MR này): thêm badge "Pending Activation" + nút "Resend Activation Email", chỉ hiện khi `account.status === "PENDING"`; `EmployeeDetailPage` cần bổ sung field `status` vào interface `AccountInfo` cục bộ vì `EmployeeResponse` không có field này

**Database / JPA / Migration:**
- Không áp dụng (frontend-only).

**Exception Handling / Error Codes:**
- Xử lý hiển thị riêng cho `1026` (token invalid), `1027` (token expired — nhắc liên hệ admin resend, không tự resend được vì endpoint resend chỉ dành ADMIN), `1028` (token đã dùng) tại `ActivateAccountPage.tsx`.

---

## Key Architectural Decisions

- **Không tái sử dụng `ProfileSetupSheet.tsx`** cho trang activate — component đó là slide-over sheet, styling/luồng khác hẳn trang public full-page cần cho activate-account. `ActivateAccountPage` build riêng, bám theo style `LoginPage.tsx`/`AuthLayout` hiện có cho đồng bộ.
- **Toast tự viết cục bộ trong từng page** (copy pattern từ `SettingsPage.tsx`) thay vì dùng `sonner` — `sonner` đã có file `components/ui/sonner.tsx` trong repo nhưng chưa từng được wire (không có `<Toaster />` ở root), nên dùng lại pattern đã chạy thật thay vì bật 1 lib chưa tích hợp trong cùng MR này.
- **Giữ nguyên toàn bộ field profile (phone/DOB/gender/address/CCCD) trên `CreateEmployeePage.tsx`**, chỉ thêm comment TODO đánh dấu chưa persist — đây là gap có từ trước #161 (backend `EmployeeCreateRequest` chưa từng nhận các field này), không mở rộng scope MR để fix luôn. Đã tách theo dõi riêng ở #163.
- **Không thêm field `EMPLOYEE` vào dropdown role của `UserForm.tsx`** — form này chỉ dùng cho `CreateUserPage` (tạo MEMBER/ADMIN), `CreateEmployeePage` tự hardcode `role: "EMPLOYEE"` ở form riêng, không đụng tới `UserForm.tsx`.

---

## How to Test

1. `cd client && npm run dev` (chạy ở port 3000, xem `vite.config.ts`), cần backend #161 đang chạy song song.
2. Login admin → **Admin → Users → Add New User**: xác nhận không còn ô Username/Password, có banner giải thích, submit thành công → toast hiện username tự sinh + xác nhận đã gửi email.
3. Lặp lại tương tự ở **Admin → Employees → Add Employee**.
4. Vào **User/Employee Detail** của account vừa tạo → xác nhận thấy badge "Pending Activation" + nút "Resend Activation Email".
5. Mở email nhận được (hoặc lấy token qua SQL, xem `docs/testing/issue-162-test-guide.md` mục 2) → vào `/activate-account?token=...`: test password <8 ký tự, test 2 ô không khớp, rồi submit hợp lệ → xác nhận redirect `/login` sau ~1.5s và login được bằng password mới.
6. Bấm lại đúng link kích hoạt đã dùng → xác nhận báo lỗi "đã được sử dụng" (1028), không cho đặt lại.
7. Bấm nút "Resend Activation Email" ở Detail page của 1 account `PENDING` khác → xác nhận toast thành công và link cũ trước đó không còn dùng được nữa (test qua Postman, case cuối cùng trong folder `04` của collection).
8. Test riêng route `/activate-account` không có `?token=` → phải báo lỗi ngay, không gọi API nào.

Bộ Postman + hướng dẫn chi tiết từng bước: `docs/testing/CinePrime-Issue162.postman_collection.json` + `docs/testing/issue-162-test-guide.md`.

---

## Checklist

**General**
- [x] Follows project coding conventions (Tailwind + CSS custom properties `var(--text-main)` v.v., pattern `FormField`/`Toast` đã có sẵn trong repo)
- [x] No debug / console.log code left
- [x] Code compiles, no errors — chạy `node_modules/.bin/tsc --noEmit -p tsconfig.json`: baseline có sẵn 86 lỗi pre-existing không liên quan (thiếu type `@radix-ui/*`, lỗi cũ ở `mockShowtime.ts`/`AuthContext.tsx`/`components/ui/*`...), xác nhận **0 lỗi mới** phát sinh từ 7 file đã sửa/thêm trong MR này (đối chiếu bằng grep tên file trong log lỗi)

**Frontend**
- [x] Loading and error states handled (`ActivateAccountPage` có 3 trạng thái rõ ràng: no-token / form / success; nút submit disable + spinner lúc `loading`)
- [x] axiosClient attaches Bearer token correctly — không có interceptor mới, dùng lại `axiosClient` hiện có; `activate-account` là endpoint public nên không cần token, các endpoint còn lại (`createAccount`, `resendActivation`) đi qua interceptor gắn Bearer đã có sẵn từ trước
- [ ] Tested on both dark and light mode — **chưa tự mở trình duyệt kiểm tra trực quan** trong môi trường viết code này (không có phiên browser thật khả dụng lúc đó); code dùng đúng các biến CSS theme (`var(--bg-card)`, `var(--text-main)`, `var(--border-color)`...) theo cùng pattern các trang admin khác đang dùng, nhưng **reviewer nên tự bật/tắt dark mode để xác nhận trực quan**, đặc biệt màu badge "Pending Activation" (cam) và `Toast`

---

## Reviewer Notes

- Route `/activate-account` nằm trong `AuthLayout` (public) — double-check middleware/guard không vô tình yêu cầu login trước khi vào được trang này.
- `ActivateAccountPage` không tự resend được khi token hết hạn (1027) — theo đúng thiết kế issue (chỉ ADMIN resend), UI chỉ hiển thị message hướng dẫn liên hệ admin. Nếu sau này muốn cho member/employee tự resend, cần thêm endpoint public riêng ở backend, không nằm trong scope MR này.
- `EmployeeDetailPage.tsx` gọi thêm `authApi.getAccountById(employee.accountId)` để lấy `account.status` (vì `EmployeeResponse` không có field này) — nếu `auth-service` không phản hồi được, trang vẫn hiển thị được phần Employment/Personal Info, chỉ ẩn phần Account Info + nút Resend (đã có try/catch fallback từ trước, không phải thêm mới trong MR này).
- Test dark/dark-mode và test bằng SMTP thật (nhận email thật) là 2 việc mình chưa tự verify được — ưu tiên reviewer check kỹ 2 điểm này trước khi merge.
