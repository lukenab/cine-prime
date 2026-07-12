## Overview / Objective

Thay luồng admin gõ tay username/password khi tạo account (đang tồn tại risk: admin biết password thật của nhân viên) bằng luồng invite-link qua email — admin chỉ nhập `fullName`/`email`/`role`, backend tự sinh username, tạo account ở trạng thái `PENDING` với password placeholder không ai biết, và gửi email chứa link `/activate-account?token=...` để nhân viên tự đặt mật khẩu. Không cần migration DB mới — tái sử dụng bảng `password_reset` vốn có sẵn nhưng chưa từng được dùng.

Related Issue: Closes #161

---

## Changes Introduced

**Controllers / Routes:**
- `AccountController` (auth-service): thêm `POST /api/accounts/{accountId}/resend-activation` (ADMIN only)
- `RegisterController` (auth-service): thêm `POST /api/auth/activate-account` (public, không cần token JWT)

**Services / Logic:**
- `AccountService.createAccount()`: bỏ nhận `username`/`password` từ request; tự sinh username duy nhất từ `fullName` (bỏ dấu tiếng Việt, xử lý trùng bằng suffix số); set password placeholder (bcrypt của UUID random, không ai đoán được) + `AccountStatus.PENDING`; gọi `issueActivationToken()` sau khi tạo account
- `AccountService.activateAccount()` (mới): validate token từ `password_reset`, set password thật do nhân viên chọn, chuyển account sang `ACTIVE`, đánh dấu token đã dùng
- `AccountService.resendActivation()` (mới): vô hiệu token cũ (`invalidatePendingResets`), sinh token mới, gửi lại email — chặn nếu account đã `ACTIVE`
- `AccountService.issueActivationToken()` (private, dùng chung bởi cả 2 method trên): sinh token, lưu `PasswordReset`, publish `AccountActivationRequestedEvent` (fire-and-forget, không đợi ACK — không ảnh hưởng tính toàn vẹn account đã tạo)
- `AuthenticationService.authenticate()`: khi `account.status == PENDING`, trả lỗi riêng `ACCOUNT_PENDING_ACTIVATION` (1029) thay vì tái dùng `ACCOUNT_INACTIVE` (1020, message "deactivated" gây hiểu lầm cho nhân viên mới)
- `AuthEventPublisher`: thêm `sendAccountActivationEvent(...)` theo đúng pattern `sendOtpRequestedEvent` hiện có
- `TokenCleanupScheduler`: thêm job định kỳ (`0 30 2 * * *`) gọi `passwordResetRepository.deleteExpiredResets(now)` — query này tồn tại sẵn trong repo nhưng chưa từng được gọi

**DTOs / Mappers / Components:**
- `CreateAccountRequest`: bỏ `username`/`password`, còn `fullName` (`@NotBlank`, max 100), `email` (`@NotBlank @Email`), `role` (String, tự do — siết enum sẽ làm ở #157 riêng)
- `ActivateAccountRequest` (mới): `token` (`@NotBlank`), `newPassword` (`@NotBlank @Size(min=8)`)
- `AccountActivationRequestedEvent` (mới, auth-service + notification-service, phải khớp field): `email`, `fullName`, `activationLink`, `expiryHours`

**Database / JPA / Migration:**
- Không có migration mới. Dùng lại bảng `password_reset` (entity `PasswordReset`, repo `PasswordResetRepository`) đã tồn tại từ trước nhưng chưa được service nào ghi/đọc.
- `notification-service`: thêm `AccountActivationConsumer` (`@KafkaListener` topic `send-activation-email-topic`) + template Thymeleaf `email/account-activation-email.html` + `EmailService.sendAccountActivationEmail(...)`.

**Exception Handling / Error Codes:**
- `AuthErrorCode`: thêm `ACTIVATION_TOKEN_INVALID` (1026, 400), `ACTIVATION_TOKEN_EXPIRED` (1027, 400), `ACTIVATION_TOKEN_ALREADY_USED` (1028, 400), `ACCOUNT_PENDING_ACTIVATION` (1029, 403), `ACCOUNT_ALREADY_ACTIVE` (1030, 400)

---

## Key Architectural Decisions

- **Tái dùng `PasswordReset` cho activation** thay vì tạo bảng mới: về bản chất "quên mật khẩu" và "kích hoạt lần đầu" là cùng 1 pattern (chứng minh quyền truy cập email + tự đặt mật khẩu bằng token dùng 1 lần dùng chung field `token`/`expiresAt`/`isUsed`). Tiết kiệm 1 migration + 1 bảng trùng lặp.
- **Placeholder password thay vì cho phép `password_hash NULL`**: giữ nguyên constraint `NOT NULL` hiện có, không đổi schema. Placeholder là bcrypt của random UUID — không ai (kể cả admin) biết được, và login đã chặn ở bước kiểm tra `status != ACTIVE` **trước khi** chạm tới so khớp password, nên không có nguy cơ NPE hay bypass.
- **`role` trong `CreateAccountRequest` vẫn là `String` tự do** ở MR này — cố tình không gộp việc siết enum vào đây để giữ MR tập trung 1 việc; sẽ làm riêng ở #157.
- **`resendActivation()` gọi `invalidatePendingResets()` trước khi issue token mới** — đảm bảo tại một thời điểm chỉ có tối đa 1 token còn hiệu lực cho mỗi account, tránh trường hợp nhân viên bấm nhầm link cũ sau khi admin đã resend.

---

## How to Test

1. Chạy backend qua `docker-compose up` (cần `auth-service`, `notification-service`, `postgres`, `redis`, `kafka`, `discovery-server`, `api-gateway`).
2. Login admin (`admin`/`admin`) → `POST /api/accounts` với `{"fullName": "...", "email": "...", "role": "MEMBER"}` → xác nhận response `status: PENDING` và `username` được tự sinh.
3. Kiểm tra email thật gửi tới địa chỉ vừa nhập (SMTP Gmail đã cấu hình sẵn trong `notification-service`), hoặc lấy token trực tiếp từ bảng `password_reset` qua `psql` nếu không muốn phụ thuộc hộp thư.
4. `POST /api/auth/activate-account` với token vừa lấy + `newPassword` ≥ 8 ký tự → xác nhận account chuyển `ACTIVE`, login được bằng username/password mới.
5. Thử activate lại đúng token đó lần 2 → phải trả `1028`. Thử `POST /api/accounts/{id}/resend-activation` với ADMIN token trên 1 account `PENDING` khác → email mới được gửi, token cũ trước đó không còn dùng được (trả `1028` thay vì `1026`).
6. Bộ Postman collection đầy đủ (`docs/testing/CinePrime-Issue162.postman_collection.json`) đã có sẵn toàn bộ các case trên — import và chạy theo thứ tự folder 00→04, xem hướng dẫn chi tiết ở `docs/testing/issue-162-test-guide.md`.

---

## Checklist

**General**
- [x] Follows project coding conventions (Lombok `@FieldDefaults` + `@NonFinal` cho `@Value`-injected field, theo đúng pattern `RegistrationService` hiện có)
- [x] No debug / console.log code left
- [ ] Code compiles, no errors — **chưa build được bằng Maven thật** trong môi trường code review (không có `mvn`/JDK phù hợp khả dụng). Đã tự kiểm tra thủ công: cân bằng ngoặc `{}` trên toàn bộ 11 file `auth-service` + 3 file `notification-service` đã sửa/thêm, grep xác nhận không còn tham chiếu tới field/method đã xoá (`username`, `password` cũ trong `CreateAccountRequest`), xác nhận không có `NewTopic` bean nào cần thêm cho topic Kafka mới. **Reviewer vui lòng chạy `mvn compile` thật trước khi merge.**

**Backend**
- [ ] No N+1 query issues — không áp dụng nhiều cho MR này (không có query mới dạng list/join phức tạp), nhưng chưa bật Hibernate SQL log để xác nhận trực tiếp
- [x] Exception handling uses correct error codes (5 mã lỗi mới 1026-1030, đúng convention `AuthErrorCode` hiện có)
- [ ] Endpoints tested via Postman / API client — **đã chuẩn bị sẵn Postman collection với test script đầy đủ, nhưng chưa tự chạy được vì không có backend đang chạy sẵn trong môi trường viết code này.** Reviewer chạy theo `docs/testing/issue-162-test-guide.md`.
- [x] API contract / Postman collection updated (`docs/testing/CinePrime-Issue162.postman_collection.json`)

---

## Reviewer Notes

- Bắt buộc phải merge/chạy cùng lúc với MR Frontend (#162) — `CreateUserPage`/`CreateEmployeePage` hiện tại gửi `username`/`password` lên `POST /api/accounts`, nếu chỉ merge riêng backend MR này thì FE cũ vẫn "chạy" (Jackson bỏ qua field lạ) nhưng UX sai hoàn toàn (admin tưởng đặt được password thật).
- Chú ý `app.frontend-url` trong `application.yml` — default đã sửa thành `http://localhost:3000` (khớp `vite.config.ts` của project, không phải cổng mặc định 5173 của Vite) để link trong email trỏ đúng chỗ. Nếu deploy khác domain/cổng, nhớ set env `FRONTEND_URL`.
- `auth.activation.ttl-hours` mặc định 24h — muốn test nhanh case token hết hạn thì tạm chỉnh xuống vài phút trong `application.yml` lúc test, đừng để lọt vào config thật.
- Không có `AccessDeniedHandler` tuỳ chỉnh trong `auth-service` — request đủ quyền JWT nhưng sai role sẽ trả 403 mặc định của Spring Security (không theo format `ApiResponse`). Đây là gap đã biết, tracked riêng ở #155/#156, không thuộc scope MR này.
