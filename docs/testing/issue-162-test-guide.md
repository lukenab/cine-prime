# Hướng dẫn test Issue #162 — Invite/Activation-link Account Flow

> Bao gồm: Part A (form tạo user/employee đã bỏ username/password), Part B (trang `/activate-account`), Part C (nút Resend activation email).
> Có kèm file `CinePrime-Issue162.postman_collection.json` để import trực tiếp vào Postman.

---

## 0. Chuẩn bị môi trường

1. Chạy toàn bộ backend bằng `docker-compose up` (hoặc chạy riêng từng service nếu đang dev): `postgres`, `redis`, `kafka`, `discovery-server`, `api-gateway`, `auth-service`, `user-service`, `notification-service`.
2. Chạy frontend: `cd client && npm run dev` → mở tại **http://localhost:3000** (project này hard-code `vite --port 3000` trong `vite.config.ts`, không phải cổng mặc định 5173 của Vite).
3. **Đã sửa 1 bug nhỏ trước khi bạn test**: `auth-service/src/main/resources/application.yml` có `app.frontend-url` mặc định trỏ tới `http://localhost:5173` — sai so với port thật của project (3000). Nếu không sửa, link kích hoạt trong email sẽ trỏ sai cổng và bấm vào sẽ không load được trang. Đã đổi default thành `http://localhost:3000`. Nếu bạn deploy FE ở domain/cổng khác, set biến môi trường `FRONTEND_URL` khi chạy `auth-service`.
4. SMTP đã cấu hình sẵn Gmail thật trong `notification-service/application.yml` (`cineprime.theater.contact@gmail.com`) — email kích hoạt sẽ được **gửi thật** tới địa chỉ bạn nhập khi tạo account. Nếu test bằng Postman và không muốn phụ thuộc vào hộp thư thật, dùng cách lấy token qua SQL ở mục 3 bên dưới.
5. Tài khoản ADMIN có sẵn (seed trong `data.sql`): **username `admin` / password `admin`**.

---

## 1. Test qua giao diện (UI) — luồng đầy đủ Part A + B

1. Đăng nhập `http://localhost:3000/login` bằng `admin` / `admin`.
2. Vào **Admin → Users → Add New User**:
   - Xác nhận **không còn** ô Username / Password nào trên form (chỉ còn Full Name, Email, Phone, Gender, DOB, Identity Card, Address).
   - Có banner ghi chú: *"No password needed here — an activation email will be sent..."*.
   - Điền Full Name + Email (dùng email thật của bạn để nhận mail) → Submit.
   - Kỳ vọng: toast xanh `Account "<username-tự-sinh>" created. Activation email sent to <email>.` rồi tự chuyển về `/admin/users` sau ~1.8s.
3. Vào **Admin → Employees → Add Employee**, lặp lại tương tự cho role EMPLOYEE (2 bước Step 1/Step 2 của form).
4. Vào **User Detail** (hoặc **Employee Detail**) của account vừa tạo:
   - Thấy badge **"Pending Activation"** màu cam.
   - Thấy nút **"Resend Activation Email"**.
5. Mở hộp thư email đã nhập → tìm mail "CinePrime - Activate Your Account" → bấm link kích hoạt (dạng `http://localhost:3000/activate-account?token=...`).
6. Trên trang `/activate-account`:
   - Test nhập password < 8 ký tự → báo lỗi validate client-side, không cho submit.
   - Test 2 ô password/confirm không khớp → báo lỗi, không cho submit.
   - Nhập password hợp lệ, khớp nhau → Submit → thấy màn hình thành công (dấu tick xanh) → tự chuyển sang `/login` sau ~1.5s.
7. Đăng nhập lại bằng username tự sinh (xem lại ở bước 2/4) + password vừa đặt → phải login được.
8. Mở lại chính link kích hoạt vừa dùng (bấm lại / F5) → phải báo lỗi "đã được sử dụng" (mã 1028), không cho đặt lại password.
9. Quay lại **User/Employee Detail** của account đã ACTIVE → badge "Pending Activation" và nút "Resend Activation Email" phải **biến mất** (vì `account.status` không còn PENDING).
10. Test Part C trực tiếp: tạo 1 account mới (PENDING), vào Detail page, bấm **"Resend Activation Email"** → toast xanh xác nhận → kiểm tra hộp thư nhận được **email kích hoạt mới** (link kích hoạt cũ lúc này không còn dùng được nữa — xem test Postman #16 để verify điều này bằng API).
11. Test trường hợp chưa kích hoạt mà cố đăng nhập: dùng username của 1 account còn PENDING, nhập bừa password → phải báo lỗi rõ ràng ("chưa kích hoạt"), **không** phải lỗi "sai mật khẩu" hay "tài khoản bị khoá" chung chung.

---

## 2. Lấy activation token trực tiếp từ DB (dùng khi test qua Postman, không có email/UI)

Kết nối Postgres (container tên `postgres`, expose ra host ở cổng `5433`):

```bash
psql -h localhost -p 5433 -U postgres -d auth_db
# password: 123456
```

hoặc từ trong container:

```bash
docker exec -it postgres psql -U postgres -d auth_db
```

Query lấy token mới nhất theo email:

```sql
SELECT pr.token, pr.expires_at, pr.is_used, a.email, a.username, a.status
FROM password_reset pr
JOIN account a ON a.account_id = pr.account_id
WHERE a.email = 'nguyenvan.test.xxxxxxx@example.com'   -- thay bằng email vừa dùng
ORDER BY pr.created_at DESC
LIMIT 1;
```

`pr.token` chính là giá trị cần dán vào field `token` khi gọi `POST /api/auth/activate-account`.

---

## 3. Test qua Postman

Import file **`CinePrime-Issue162.postman_collection.json`** đính kèm. Collection đã có sẵn:
- Biến `baseUrl = http://localhost:8080` (qua **API Gateway**, route `/api/auth/**` và `/api/accounts/**` đều trỏ về `auth-service`). Postman không bị chặn CORS nên không cần lo việc gateway chỉ cho phép origin `localhost:3000/3001` — giới hạn đó chỉ áp dụng cho trình duyệt.
- Script tự động lưu `adminToken`, `memberAccountId`, `memberUsername`, `employeeAccountId`, `employeeUsername` sau mỗi request — không cần copy tay.
- 2 biến **cần bạn tự dán tay** vì Postman không đọc được email/DB: `activationToken` và `employeeOldActivationToken` (lấy theo mục 2 ở trên).

### Thứ tự chạy

| # | Folder | Việc cần làm thêm |
|---|---|---|
| 1 | `00 - Setup` → *Login as Admin* | Không cần gì thêm |
| 2 | `01 - Create Account (Part A)` — chạy hết cả 6 request | Không cần gì thêm (email tự sinh unique theo timestamp) |
| 3 | `02 - Login Guard for PENDING account` | Không cần gì thêm |
| 4 | Lấy token của `memberAccountId` qua SQL (mục 2) → dán vào biến collection `activationToken` | **Bắt buộc trước khi chạy folder 03** |
| 5 | `03 - Activate Account (Part B)` — chạy hết 5 request theo thứ tự | — |
| 6 | Lấy token hiện tại của `employeeAccountId` qua SQL → dán vào biến `employeeOldActivationToken` | **Bắt buộc trước khi chạy request "Resend Activation — success" ở folder 04** |
| 7 | `04 - Resend Activation (Part C)` — chạy hết 4 request theo thứ tự | Request cuối verify token cũ đã bị vô hiệu (mã 1028) |

### Bảng API reference (đầy đủ, dùng để tự dựng request thủ công nếu cần)

**API 1 — Login**
| | |
|---|---|
| Method / URL | `POST {{baseUrl}}/api/auth/login` |
| Auth | Không |
| Body | `{"username": "admin", "password": "admin"}` |
| 200 OK | `{"code":1000,"result":{"token":"..."}}` |

**API 2 — Create Account (Part A)**
| | |
|---|---|
| Method / URL | `POST {{baseUrl}}/api/accounts` |
| Auth | Bearer token, role **ADMIN** |
| Body | `{"fullName": "Nguyen Van A", "email": "a@example.com", "role": "MEMBER"}` (role: `MEMBER` hoặc `EMPLOYEE`) |
| 200 OK | `{"code":1000,"result":{"accountId":"...","username":"nguyenvana","email":"a@example.com","status":"PENDING", ...}}` |
| Lỗi thường gặp | `1011` email đã tồn tại · `1012` role không tồn tại (ROLE_NOT_FOUND, ví dụ gõ sai `"ADMINN"`) · `1005` thiếu field bắt buộc · `1008` thiếu/sai Bearer token |

**API 3 — Get Account By Id**
| | |
|---|---|
| Method / URL | `GET {{baseUrl}}/api/accounts/{accountId}` |
| Auth | Bearer token (ADMIN) |
| 200 OK | field `status` là `PENDING` / `ACTIVE` / `INACTIVE` |

**API 4 — Activate Account (Part B, public)**
| | |
|---|---|
| Method / URL | `POST {{baseUrl}}/api/auth/activate-account` |
| Auth | Không (public) |
| Body | `{"token": "<lấy từ email hoặc DB>", "newPassword": "Password123!"}` (`newPassword` tối thiểu 8 ký tự) |
| 200 OK | `{"code":1000,"message":"Account activated successfully. You can now log in."}` |
| Lỗi | `1026` token không tồn tại/sai · `1027` token hết hạn (>24h, hoặc `auth.activation.ttl-hours` đã config) · `1028` token đã dùng rồi · `1005` password < 8 ký tự |

**API 5 — Resend Activation (Part C)**
| | |
|---|---|
| Method / URL | `POST {{baseUrl}}/api/accounts/{accountId}/resend-activation` |
| Auth | Bearer token, role **ADMIN** |
| Body | Không có |
| 200 OK | `{"code":1000,"message":"Activation email resent."}` |
| Lỗi | `1030` account đã ACTIVE rồi (không cho resend) · `1014` accountId không tồn tại · `1008` thiếu/sai Bearer token |
| Hiệu ứng phụ | Token activation **cũ** của account này lập tức bị đánh dấu `is_used = true` — nếu ai đó vẫn cầm link email cũ và bấm vào, sẽ nhận lỗi `1028` (not `1026`/`1027`) |

**API 6 — Login khi account đang PENDING**
| | |
|---|---|
| Method / URL | `POST {{baseUrl}}/api/auth/login` |
| Body | `{"username": "<username tự sinh>", "password": "bất kỳ"}` |
| Response | HTTP 403, `{"code":1029,"message":"Your account has not been activated yet. Please check your email for the activation link."}` — **khác** với tài khoản INACTIVE thật sự (mã `1020`, message "deactivated") |

### Bảng mã lỗi liên quan (auth-service, `AuthErrorCode`)

| Code | HTTP | Ý nghĩa |
|---|---|---|
| 1005 | 400 | Validate field thất bại (thiếu fullName, password < 8 ký tự...) |
| 1008 | 401 | Thiếu/sai Bearer token (`UNAUTHENTICATED`) |
| 1011 | 400 | Email đã tồn tại |
| 1014 | 404 | Không tìm thấy account |
| 1020 | 403 | Account bị admin vô hiệu hoá (`INACTIVE`) — khác PENDING |
| 1026 | 400 | Activation token không tồn tại / sai |
| 1027 | 400 | Activation token đã hết hạn |
| 1028 | 400 | Activation token đã được dùng rồi |
| 1029 | 403 | Account đang PENDING, chưa kích hoạt — chặn login |
| 1030 | 400 | Account đã ACTIVE rồi, không cho resend nữa |

> Lưu ý: role không đúng (ví dụ dùng token của EMPLOYEE gọi API cần ADMIN) hiện **không** trả về theo format `ApiResponse` JSON — Spring Security trả 403 mặc định (body rỗng/HTML), vì project chưa có `AccessDeniedHandler` tuỳ chỉnh. Đây là gap đã ghi trong Issue #155/#156, không thuộc phạm vi #162.

---

## 4. Checklist theo Acceptance Criteria của #162

**Part A**
- [ ] `CreateUserPage` / `CreateEmployeePage`: không còn ô Username, Password
- [ ] Toast sau khi tạo hiển thị đúng username tự sinh + email đã gửi
- [ ] `EmployeeFormData`: các field profile (phone, DOB, gender, address, identityCard) vẫn còn trên UI nhưng có TODO comment là chưa persist (kiểm tra code, không phải hành vi runtime)

**Part B**
- [ ] Truy cập `/activate-account` không có `?token=` → hiện lỗi ngay, không gọi API
- [ ] Validate client-side: password < 8 ký tự, 2 ô không khớp
- [ ] Activate thành công → redirect `/login` sau ~1.5s
- [ ] 3 mã lỗi 1026/1027/1028 hiển thị message tương ứng, không hiện lỗi chung chung

**Part C**
- [ ] Badge "Pending Activation" + nút "Resend Activation Email" chỉ hiện khi `account.status === PENDING`
- [ ] Sau khi account ACTIVE, badge/nút biến mất
- [ ] Click resend → toast xác nhận, token cũ bị vô hiệu (verify bằng API #16 trong Postman collection)

---

## 5. File đính kèm

- `CinePrime-Issue162.postman_collection.json` — import vào Postman (File → Import), chạy folder theo đúng thứ tự 00 → 01 → 02 → 03 → 04, nhớ dán tay 2 biến `activationToken` / `employeeOldActivationToken` như hướng dẫn ở mục 3.
