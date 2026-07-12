# Issues — Account/Employee Provisioning & Authorization Hardening

> Phát hiện khi audit luồng "user tự đăng ký / admin tạo account / admin tạo employee" giữa
> `auth-service` và `user-service` (đối chiếu code thật, không chỉ tài liệu) — xem chi tiết
> phân tích trong lịch sử trao đổi. Tổng: **9 issues** | Backend: 6 · Frontend: 2 · Docs: 1
> Issue numbers: **#155 – #163** (tiếp theo sau #154 ở `sprint-3-issues.md`)
> Milestone: Sprint 4 / Security Hardening — nên làm **trước** khi demo/deploy vì #155–#156 là lỗ hổng bảo mật đang hoạt động (không phải chỉ là thiếu tính năng).
> **#161** là tính năng mới (chọn Pattern 2 — invite-link qua email) thay thế cách admin nhập password thủ công hiện tại; nên làm cùng đợt với #157 (role enum) vì cùng sửa `CreateAccountRequest`. Backend #161 **đã code xong**.
> **#162** là phần Frontend cho #161 — bắt buộc phải làm cùng lúc với backend vì `CreateUserPage`/`CreateEmployeePage` hiện tại đã đứt tương thích với contract mới. **Backend + Frontend #161/#162 đã code xong và đã có hướng dẫn test** (`docs/testing/issue-162-test-guide.md`).
> **#163** là phần mở rộng tiếp theo của #162 — dự án đã có sẵn cơ chế "Progressive Profiling" (skeleton profile → tự điền sau) nhưng hiện chỉ hoạt động cho `MEMBER` lúc đặt vé; #163 mở rộng sang `EMPLOYEE` (trigger ngay sau đăng nhập lần đầu) và dọn field cá nhân "ảo" khỏi form admin.

---

## Issue #155

**Title:** `[Backend] Add role-based authorization to user-service endpoints (Employees & Users)`

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

**Milestone:** Sprint 4 / Security Hardening

---

## Summary / Objective

`user-service/SecurityConfig` hiện chỉ có `.anyRequest().authenticated()` — không có `@EnableMethodSecurity`, không một `@PreAuthorize`/`hasAuthority` nào trong toàn bộ `EmployeeController` và `UserController` (đã grep toàn bộ `src/main/java`, xác nhận 0 kết quả). API Gateway cũng chỉ route theo `Path=/api/users/**, /api/employees/**`, không thêm lớp phân quyền nào. Hệ quả: **bất kỳ ai đã đăng nhập — kể cả một khách hàng role `MEMBER`** — đều có thể gọi `POST /api/employees` (tạo hồ sơ nhân viên cho account bất kỳ), `GET /api/employees` (xem toàn bộ danh sách nhân viên + thông tin cá nhân), `PUT/DELETE /api/employees/{id}` (sửa/vô hiệu hoá nhân viên khác), và tương tự với `/api/users`. Đây là lỗ hổng broken-access-control đang tồn tại trong code hiện tại, đi ngược nguyên tắc "chỉ admin/HR được tạo & xem hồ sơ nhân viên" là chuẩn ngành bắt buộc (không phải tuỳ chọn) cho mọi hệ thống POS/HR nội bộ.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `user-service/SecurityConfig` thêm `@EnableMethodSecurity`
- [ ] `EmployeeController`: `POST /api/employees`, `GET /api/employees`, `GET /api/employees/{id}`, `PUT /api/employees/{id}`, `DELETE /api/employees/{id}` đều yêu cầu `@PreAuthorize("hasAuthority('EMPLOYEE_MANAGE')")` (hoặc `hasRole('ADMIN')` — thống nhất theo pattern đang dùng ở `auth-service`); riêng `GET` list/detail có thể cho phép thêm `EMPLOYEE_READ` nếu muốn nhân viên tự xem hồ sơ mình
- [ ] `UserController`: các endpoint không phải `check-existence` (đã public) đều được gate — tối thiểu `GET /api/users` (list toàn bộ) và `DELETE /api/users/{id}` phải yêu cầu quyền admin; `GET/PUT /api/users/{id}` cho phép chính chủ account đó hoặc admin (so sánh `accountId` trong JWT claim với path param)
- [ ] Viết test (hoặc test thủ công qua Postman) xác nhận: JWT role `MEMBER` gọi `POST /api/employees` → trả `403`
- [ ] JWT role `ADMIN`/`EMPLOYEE` (có `EMPLOYEE_MANAGE`) gọi các endpoint trên vẫn hoạt động bình thường

---

## Technical Notes / Constraints

- `auth-service/SecurityConfig` đã có pattern đúng để tham khảo: `.requestMatchers(HttpMethod.POST, "/api/accounts").hasAuthority("ROLE_ADMIN")` + `@EnableMethodSecurity`. Áp dụng cùng pattern (hoặc `@PreAuthorize` ở tầng method, linh hoạt hơn cho nhiều permission khác nhau như `EMPLOYEE_MANAGE`/`EMPLOYEE_READ` đã có sẵn trong `permission` seed data).
- Permission `EMPLOYEE_READ` và `EMPLOYEE_MANAGE` đã tồn tại trong `data.sql` (gán cho `ADMIN`), chỉ cần enforce ở code — không cần thêm permission mới.
- Ưu tiên sửa **trước** #156 vì đây là service đang bị hở hoàn toàn (auth-service ít nhất còn chặn được `POST /api/accounts`).

---

## Related

- Branch: `fix/user-service-authorization`
- Depends on: `user-service/SecurityConfig.java`, `EmployeeController.java`, `UserController.java`
- Docs: `docs/api-specs/user-service/API_CONTRACT.md` (cần bổ sung cột "Auth Required" đúng thực tế sau khi fix — xem #160)
- Closes: #155

---
---

## Issue #156

**Title:** `[Backend] Restrict GET/PUT /api/accounts to ADMIN role in auth-service`

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

**Milestone:** Sprint 4 / Security Hardening

---

## Summary / Objective

`auth-service/SecurityConfig` chỉ gate `POST /api/accounts` bằng `hasAuthority("ROLE_ADMIN")`. `GET /api/accounts` (danh sách toàn bộ account), `GET /api/accounts/{accountId}`, và **`PUT /api/accounts/{accountId}`** đều rơi vào `.anyRequest().authenticated()` — nghĩa là bất kỳ user đã login nào (kể cả role `MEMBER`) đều gọi được. `PUT /api/accounts/{accountId}` cho phép đổi `email`, `password`, và **`roles`** của bất kỳ account nào nếu biết UUID — về bản chất một khách hàng có thể tự nâng quyền mình lên `ADMIN`, hoặc đổi mật khẩu người khác. Đây là lỗ hổng privilege-escalation nghiêm trọng nhất tìm thấy trong toàn bộ audit.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `SecurityConfig` thêm rule: `.requestMatchers(HttpMethod.GET, "/api/accounts", "/api/accounts/**").hasAuthority("ROLE_ADMIN")`
- [ ] `.requestMatchers(HttpMethod.PUT, "/api/accounts/**").hasAuthority("ROLE_ADMIN")`
- [ ] `GET /api/accounts/my-info` **vẫn phải cho phép mọi role đã đăng nhập** (đây là endpoint tự xem thông tin mình — không được vô tình chặn nhầm). Cần match rule cụ thể trước rule chung (`/api/accounts/my-info` match trước `/api/accounts/**`), hoặc tách route riêng.
- [ ] Test: JWT role `MEMBER` gọi `GET /api/accounts` → `403`; gọi `PUT /api/accounts/{other-id}` → `403`
- [ ] Test: JWT role `MEMBER` gọi `GET /api/accounts/my-info` → vẫn `200`, trả đúng thông tin của chính mình
- [ ] Test: JWT role `ADMIN` gọi tất cả các endpoint trên → `200`

---

## Technical Notes / Constraints

- Chú ý thứ tự `requestMatchers` trong Spring Security — matcher cụ thể hơn (`/my-info`) phải đứng trước matcher tổng quát (`/**`) nếu không sẽ bị rule sau ghi đè/không bao giờ match tới.
- Không cần đổi `AccountService`/`AccountController` — đây thuần là fix ở tầng `SecurityConfig`.
- Sau khi fix, cập nhật lại `docs/api-specs/auth-service/API_CONTRACT.md` mục 6.2 — hiện chỉ ghi chú "Note: These endpoints require ADMIN role" nhưng thực tế code chưa từng enforce cho GET/PUT tới bây giờ.

---

## Related

- Branch: `fix/auth-service-account-authorization`
- Depends on: `auth-service/SecurityConfig.java`
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md` §6.2
- Closes: #156

---
---

## Issue #157

**Title:** `[Backend] Restrict CreateAccountRequest.role to a fixed enum instead of free-text String`

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::Medium`

**Milestone:** Sprint 4

---

## Summary / Objective

`CreateAccountRequest.role` là `String` tự do, không `@Pattern`/enum validate. `AccountService.createAccount()` chỉ tra `roleRepository.findById(requestedRole)` — nếu admin gõ sai chính tả hoặc để trống, hệ thống âm thầm mặc định `"MEMBER"` (không phải lỗi rõ ràng). Không có gì ngăn admin gõ nhầm role không tồn tại về mặt nghiệp vụ hoặc quên chỉ định `EMPLOYEE` khi ý định là tạo tài khoản nhân viên. Vì role hiện tại chỉ có 3 giá trị hợp lệ (`ADMIN`, `EMPLOYEE`, `MEMBER` — role `USER` không tồn tại trong DB, xem #160), nên ràng buộc bằng enum là hợp lý và rẻ để làm.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo `enum AccountRole { ADMIN, EMPLOYEE, MEMBER }` trong `authservice.enums`
- [ ] `CreateAccountRequest.role` đổi kiểu từ `String` sang `AccountRole` (Jackson sẽ tự validate giá trị hợp lệ khi deserialize, trả `400` nếu sai)
- [ ] Nếu `role` là `null` → vẫn mặc định `MEMBER` (giữ nguyên hành vi hiện tại, chỉ siết phần validate)
- [ ] Cập nhật `AccountService.createAccount()` dùng `request.getRole().name()` thay vì `.toUpperCase().trim()`
- [ ] Test: gửi `"role": "SUPERADMIN"` (không tồn tại) → `400` với thông báo rõ ràng, không rơi vào `ROLE_NOT_FOUND` (500-style) như hiện tại

---

## Technical Notes / Constraints

- Cẩn thận: nếu sau này thêm role `USER` (xem #160), phải nhớ update lại enum này — nên để comment nhắc trong code.
- `GlobalExceptionHandler` cần đảm bảo lỗi deserialize enum trả về `400` với message dễ hiểu (Jackson mặc định ném `HttpMessageNotReadableException` — kiểm tra đã có handler chung hay chưa).

---

## Related

- Branch: `fix/account-role-enum-validation`
- Depends on: `CreateAccountRequest.java`, `AccountService.java`
- Closes: #157

---
---

## Issue #158

**Title:** `[Backend] Cross-check Account role = EMPLOYEE before allowing employee profile creation`

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::Medium`

**Milestone:** Sprint 4

---

## Summary / Objective

`EmployeeService.createEmployee()` chỉ kiểm tra (1) `User` profile đã tồn tại, (2) account chưa từng là employee — **không kiểm tra account có role `EMPLOYEE` hay không**. Kết quả: admin có thể tạo hồ sơ `employee` (mã NV, vị trí, phòng ban) cho một account đang mang role `MEMBER` (khách hàng thường) hoặc `ADMIN`, khiến bảng `employee` và role JWT của account đó không đồng bộ — một "nhân viên" trong DB nhưng token đăng nhập của họ vẫn chỉ có quyền `MEMBER` (không đăng nhập được vào các chức năng quầy vé), hoặc ngược lại.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `EmployeeService.createEmployee()` gọi kiểm tra role của account trước khi tạo employee record
- [ ] Vì `user-service` không có quyền truy vấn trực tiếp bảng `roles`/`account_role` của `auth-service` (khác DB, khác service — DB-per-service), cần 1 trong 2 cách:
  - (a) OpenFeign call đồng bộ sang `auth-service` (`GET /api/accounts/{id}`) để lấy `roles` hiện tại, hoặc
  - (b) Đưa `role` vào payload của `UserRegisteredEvent` (Kafka) khi `auth-service` publish, lưu cached vào bảng `users` (cột `current_role`) để `user-service` tra tại chỗ, không cần gọi đồng bộ
- [ ] Nếu account không có role `EMPLOYEE` → trả lỗi rõ ràng (thêm `ErrorCode` mới, ví dụ `ACCOUNT_NOT_EMPLOYEE_ROLE`), không cho tạo employee record
- [ ] Test: tạo account role `MEMBER` → gọi `POST /api/employees` với `accountId` đó → trả lỗi thay vì tạo thành công

---

## Technical Notes / Constraints

- Recommend cách (b) — đưa `role` vào Kafka event — vì tránh thêm 1 cuộc gọi đồng bộ (Feign) làm chậm luồng vốn đã có polling (xem #159), và tránh coupling runtime giữa 2 service. Council: đổi `UserRegisteredEvent` schema cần bump version + thông báo team (theo `kafka-user-service-contract.md`).
- Cân nhắc luôn: đây là dấu hiệu cho thấy nên có **một endpoint duy nhất** "Admin tạo nhân viên" gộp cả 2 bước (tạo account role EMPLOYEE + tạo employee profile) trong 1 transaction/saga ở tầng orchestration (BFF hoặc admin-service), thay vì để FE gọi 2 API rời rạc và tự chịu trách nhiệm đồng bộ — xem xét làm issue riêng nếu team đồng ý hướng này.

---

## Related

- Branch: `fix/employee-account-role-consistency`
- Depends on: #157 (role enum), `EmployeeService.java`, `UserRegisteredEvent.java` (auth-service & user-service versions), `kafka-user-service-contract.md`
- Closes: #158

---
---

## Issue #159

**Title:** `[Backend] Replace Kafka-polling wait in EmployeeService.createEmployee with reliable profile lookup`

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::Low`

**Milestone:** Sprint 4+ / Backlog

---

## Summary / Objective

`EmployeeService.waitForUserProfile()` poll `userRepository.findById(accountId)` tối đa 5 lần / 300ms (tổng ~1.5s) để đợi `UserEventConsumer` xử lý xong `UserRegisteredEvent` từ Kafka trước khi tạo `employee` record. Đây là workaround cho eventual consistency giữa 2 service, không phải giải pháp bền vững: nếu Kafka consumer chậm hơn 1.5s (queue backlog, GC pause, consumer restart...), admin sẽ nhận lỗi `USER_NOT_FOUND` ngay sau khi vừa tạo account thành công — trải nghiệm khó hiểu ("vừa tạo xong sao báo không tồn tại?") và không có cách retry tự động ở phía client.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Đánh giá 2 hướng và chọn 1:
  - (a) FE: khi admin tạo account xong, disable nút "Tạo hồ sơ nhân viên" trong ~2s hoặc hiển thị loading, polling `GET /api/users/{id}` (đã có sẵn) từ phía FE cho tới khi thấy profile tồn tại rồi mới bật form nhập employee — chuyển trách nhiệm chờ ra khỏi request path của `POST /api/employees`
  - (b) Backend: tăng số lần retry / backoff (ví dụ exponential, tối đa ~5s) **và** trả lỗi có mã riêng (`PROFILE_SYNC_PENDING`, HTTP 409) kèm gợi ý "thử lại sau vài giây" thay vì `USER_NOT_FOUND` (404, gây hiểu lầm là account không tồn tại)
- [ ] Log rõ ràng khi hết retry để dev dễ debug (đã có `log.error` — giữ nguyên, chỉ cải thiện error code trả về client)
- [ ] Cập nhật `docs/architecture/kafka/kafka-user-service-contract.md` mô tả rõ độ trễ tối đa kỳ vọng và cách client nên xử lý

---

## Technical Notes / Constraints

- Đây là vấn đề kiến trúc chung của mô hình event-driven, không phải bug logic — vá triệt để nhất là saga pattern hoặc gọi đồng bộ, nhưng chi phí lớn hơn nhiều so với lợi ích ở quy mô OJT project này. Ưu tiên hướng (b) trước (rẻ, cải thiện UX ngay), cân nhắc (a) nếu team có thời gian làm FE.
- Priority Low vì đây là vấn đề UX/độ tin cậy, không phải lỗ hổng bảo mật — xếp sau #155/#156.

---

## Related

- Branch: `fix/employee-creation-profile-sync`
- Depends on: `EmployeeService.java`, `docs/architecture/kafka/kafka-user-service-contract.md`
- Related: #158 (cùng function `createEmployee`, nên làm chung 1 branch nếu muốn gộp)
- Closes: #159

---
---

## Issue #160

**Title:** `[Docs] Sync auth-service API_CONTRACT.md and SRS.md with actual role model`

**Labels:** `Layer::Backend`, `Type::Docs`, `Priority::Low`

**Milestone:** Sprint 4

---

## Summary / Objective

Tài liệu hiện không khớp code thật ở 2 điểm về role: (1) `API_CONTRACT.md` §6.1 nói `/register/verify` "gets the default `USER` role" và §6.2 nói `AdminCreateAccountRequest.role` "Must be `USER` or `ADMIN`" — nhưng role `USER` **không tồn tại** trong `data.sql` seed (chỉ có `ADMIN`, `EMPLOYEE`, `MEMBER`), và code thực tế mặc định `MEMBER` (theo `auth.default-role` config), không giới hạn chỉ `USER`/`ADMIN`. (2) `SRS.md` §2.1 liệt kê 4 role gồm cả `USER` (guest, không đặt vé) nhưng role này chưa từng được implement — không rõ đây là tính năng dự kiến chưa làm, hay đã bị bỏ và tài liệu quên xoá. Sự lệch pha này sẽ gây nhầm lẫn cho FE/QA khi test theo tài liệu.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Team xác nhận: role `USER` (guest) có còn nằm trong scope hay không (chốt với PO/Scrum lead)
- [ ] Nếu **không** implement `USER`: xoá dòng `USER` khỏi bảng role ở `SRS.md` §2.1, sửa `API_CONTRACT.md` §6.1 thành "gets the default `MEMBER` role" (khớp `auth.default-role`), sửa §6.2 thành "Must be `ADMIN`, `EMPLOYEE`, or `MEMBER`" (khớp #157 nếu đã làm)
- [ ] Nếu **có** implement `USER`: tạo issue riêng để seed role `USER` vào `data.sql`, quyết định lại `auth.default-role` nên là `USER` hay `MEMBER` cho luồng đăng ký công khai
- [ ] Đối chiếu lại toàn bộ `API_CONTRACT.md` với code hiện tại của `AccountController`/`AccountService` sau khi #155–#158 merge (danh sách role hợp lệ, auth requirement của từng endpoint) — cập nhật changelog contract theo đúng convention versioning đang dùng trong file (bump lên 1.6.0)

---

## Technical Notes / Constraints

- Đây là issue phụ thuộc quyết định nghiệp vụ trước, không chỉ kỹ thuật — nên làm **sau** khi đã chốt #157 (role enum) để tránh phải sửa tài liệu 2 lần.
- Không cần code, chỉ sửa `.md` — nhưng nên gộp làm cùng sprint với #157 để một người review cả 2 cùng lúc, tránh drift lặp lại.

---

## Related

- Branch: `docs/sync-role-model-with-code`
- Depends on: #157 (role enum), quyết định PO về role `USER`
- Docs: `docs/agile/SRS.md` §2.1, `docs/api-specs/auth-service/API_CONTRACT.md` §6.1 §6.2
- Closes: #160

---
---

## Issue #161

**Title:** `[Backend] Replace admin-typed password with email invite/activation-link flow for account creation`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

**Milestone:** Sprint 4 / Security Hardening

---

## Summary / Objective

Hiện tại `POST /api/accounts` bắt buộc admin tự gõ `username` + `password` (plaintext) cho từng account — không có cơ chế tự sinh, admin phải biết/nắm mật khẩu thật của nhân viên trước khi họ dùng lần đầu. Đây không phải practice chuẩn: admin/IT không nên bao giờ cầm mật khẩu thật của người khác. Đổi sang **Pattern 2 — invite qua email**: admin chỉ nhập họ tên + email cá nhân của nhân viên (không nhập username/password); hệ thống tự sinh username, tạo account ở trạng thái `PENDING` với mật khẩu placeholder không thể dùng, gửi email chứa link kích hoạt (token có hạn, dùng 1 lần); nhân viên tự click link và tự đặt mật khẩu — chỉ sau đó account mới chuyển `ACTIVE` và đăng nhập được.

Có thể tái dùng gần như toàn bộ hạ tầng đã có sẵn nhưng chưa từng được nối dây: entity `PasswordReset` + `PasswordResetRepository` (đã có `findByToken`, `findByAccountAndIsUsedFalse`, `invalidatePendingResets`, `deleteExpiredResets` — tất cả đều unused hiện tại), `AccountStatus.PENDING` (đã có trong enum và default trong `account.sql`, chưa từng được set ở đâu), và pattern gửi email async qua Kafka + `notification-service` (đã dùng cho OTP đăng ký, chỉ cần thêm 1 topic + 1 consumer mới). ⇒ **Không cần migration DB** — chỉ cần code, không đổi schema.

---

## Estimate

- [ ] S (< 2h) / M (2–4h) / L (4–8h) / **XL (> 1 day)** — trải trên `auth-service` + `notification-service`, cộng thêm 1 FE issue riêng (xem Related)

---

## Acceptance Criteria (Definition of Done)

**auth-service — Account creation:**
- [ ] `CreateAccountRequest` bỏ field `username` và `password`; thêm `fullName` (bắt buộc, dùng để chào trong email và sinh username). Giữ `email`, `role`.
- [ ] `AccountService.createAccount()` tự sinh `username` duy nhất từ `fullName` (bỏ dấu tiếng Việt, lowercase, nối không dấu cách; nếu trùng thì thêm số đếm ở cuối, ví dụ `nguyenvana`, `nguyenvana2`)
- [ ] Account được tạo với `status = PENDING` và `passwordHash` = bcrypt-hash của một chuỗi ngẫu nhiên (SecureRandom, không lưu ở đâu khác, không ai biết được) — **không đổi schema** `password_hash NOT NULL`, chỉ là giá trị không thể đăng nhập được cho tới khi kích hoạt
- [ ] Sinh 1 `PasswordReset` row: `token` (random đủ dài, ví dụ `UUID.randomUUID()` hoặc 32-byte hex), `expiresAt = now + 24h`, `isUsed = false`, gắn với account vừa tạo
- [ ] Publish event mới (Kafka, fire-and-forget giống `sendOtpRequestedEvent`) chứa `email`, `fullName`, `activationLink` (FE URL + token) tới topic `send-activation-email-topic`
- [ ] `POST /api/accounts` vẫn giữ nguyên gate `hasAuthority("ROLE_ADMIN")` (đã có từ #156)

**auth-service — Activation endpoint (mới):**
- [ ] `POST /api/auth/activate-account` — **public** (thêm vào `PUBLIC_POST_ENDPOINTS`), body `{ token, newPassword }`
- [ ] Validate: token tồn tại (`PasswordResetRepository.findByToken`), chưa dùng (`isUsed = false`), chưa hết hạn (`expiresAt > now`) — sai 1 trong 3 điều kiện trả lỗi riêng biệt (xem Error Codes)
- [ ] Nếu hợp lệ: set `account.passwordHash = encode(newPassword)`, `account.status = ACTIVE`, `account.emailVerifiedAt = now`; set `passwordReset.isUsed = true`, `usedAt = now`; gọi `invalidatePendingResets(account)` để vô hiệu các token cũ khác (phòng trường hợp resend nhiều lần)
- [ ] `POST /api/accounts/{accountId}/resend-activation` (ADMIN only) — vô hiệu token cũ, sinh token mới, gửi lại email — dùng khi token 24h đã hết hạn mà nhân viên chưa kích hoạt

**auth-service — Login UX cho account PENDING:**
- [ ] Thêm `AuthErrorCode.ACCOUNT_PENDING_ACTIVATION` (mã mới, ví dụ `1029`) — khi `account.status == PENDING`, `AuthenticationService.authenticate()` trả lỗi này thay vì tái dùng `ACCOUNT_INACTIVE` (1020, hiện có message "deactivated" gây hiểu lầm cho nhân viên mới chưa từng kích hoạt)
- [ ] Thêm `AuthErrorCode.ACTIVATION_TOKEN_INVALID` (1026), `ACTIVATION_TOKEN_EXPIRED` (1027), `ACTIVATION_TOKEN_ALREADY_USED` (1028)

**notification-service:**
- [ ] `AccountActivationConsumer` mới, lắng nghe topic `send-activation-email-topic`, gọi `EmailService` gửi email
- [ ] `EmailService` thêm template email kích hoạt tài khoản: chào theo `fullName`, nêu rõ đây là tài khoản nhân viên CinePrime, nút/link kích hoạt, ghi chú hạn 24h

**Cleanup (tận dụng code đã có sẵn nhưng chưa dùng):**
- [ ] Thêm 1 scheduled job (tương tự `TokenCleanupScheduler` đang có cho `auth_token`) gọi định kỳ `passwordResetRepository.deleteExpiredResets(now)` — query này đã tồn tại trong `PasswordResetRepository` nhưng chưa từng được gọi ở đâu

---

## API Specifications (if applicable)

### API 1 — Admin Create Account (Modified)

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/accounts` |
| Auth Required | Yes (ADMIN) |

**Request Body:**
```json
{
  "fullName": "Nguyễn Văn A",
  "email": "nguyenvana@gmail.com",
  "role": "EMPLOYEE"
}
```

**Response 200 OK:**
```json
{
  "code": 1000,
  "result": {
    "accountId": "acc-uuid-1234",
    "username": "nguyenvana",
    "email": "nguyenvana@gmail.com",
    "status": "PENDING",
    "roles": [{ "roleName": "EMPLOYEE" }]
  }
}
```

### API 2 — Activate Account

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/auth/activate-account` |
| Auth Required | No (public — xác thực bằng token trong body) |

**Request Body:**
```json
{
  "token": "b7e5c1a0-....-....-....-............",
  "newPassword": "MyNewPassword123"
}
```

**Response 200 OK:**
```json
{ "code": 1000, "message": "Account activated successfully. You can now log in." }
```

**Response (Error — token hết hạn):**
```json
{ "code": 1027, "message": "Activation link has expired. Please ask your admin to resend it." }
```

### API 3 — Resend Activation Email

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/accounts/{accountId}/resend-activation` |
| Auth Required | Yes (ADMIN) |

**Response 200 OK:**
```json
{ "code": 1000, "message": "Activation email resent." }
```

---

## Technical Notes / Constraints

- **Không migrate DB** — `account.status` mặc định đã là `PENDING` trong `account.sql`, và bảng `password_reset` đã có đủ cột cần dùng. Chỉ cần code Controller/Service để "nối dây" các thành phần đã tồn tại sẵn.
- `password_hash` vẫn giữ `NOT NULL` — không cần cho phép NULL. Placeholder bcrypt-hash của random string là đủ an toàn (không ai đoán được, và login đã chặn từ bước kiểm tra `status != ACTIVE` **trước khi** chạm tới so khớp password, nên không có nguy cơ NPE hay bypass).
- Việc `PasswordReset` vốn được đặt tên cho "quên mật khẩu" nhưng dùng lại cho "kích hoạt lần đầu" là hợp lý về nghiệp vụ (cùng bản chất: chứng minh quyền truy cập email + tự đặt mật khẩu bằng token dùng 1 lần) — không cần tạo bảng mới.
- `AuthEventPublisher` nên thêm method mới `sendAccountActivationEvent(...)` theo đúng pattern `sendOtpRequestedEvent` hiện có (fire-and-forget, không cần đợi ACK vì không ảnh hưởng tính toàn vẹn của account đã tạo).
- Cân nhắc làm cùng lúc với #157 (role enum) vì cùng sửa `CreateAccountRequest` — tránh conflict merge nếu 2 người làm song song.
- Không đổi luồng tạo Employee profile (`POST /api/employees`) — vẫn giữ nguyên bước 2 độc lập như đã thống nhất, chỉ bước 1 (tạo account) đổi cách cấp mật khẩu.

---

## Related

- Branch: `feat/account-activation-invite-flow`
- Depends on: `PasswordReset.java`, `PasswordResetRepository.java` (đã có sẵn), `AuthEventPublisher.java`, `notification-service/EmailService.java`
- Blocks: #162 (`[Frontend]` — trang activate-account + fix 2 form tạo account đang đứt tương thích)
- Related: #157 (role enum — nên gộp chung PR nếu tiện), #156 (đảm bảo `POST /api/accounts` vẫn ADMIN-only sau khi đổi request body)
- Closes: #161

---
---

## Issue #162

**Title:** `[Frontend] Add /activate-account page and fix account-creation forms for #161 (invite-link flow)`

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::High`

**Milestone:** Sprint 4 / Security Hardening

---

## Summary / Objective

Backend #161 đổi `POST /api/accounts` sang không nhận `username`/`password` nữa (chỉ `fullName` + `email` + `role`), và thêm 2 endpoint mới: `POST /api/auth/activate-account` (public) và `POST /api/accounts/{accountId}/resend-activation` (admin). Việc này làm **2 form hiện có bị lệch hợp đồng ngay lập tức**:

- `CreateUserPage.tsx` (qua `UserForm.tsx`) vẫn bắt buộc admin nhập Username + "Temporary Password" — nhưng backend giờ **âm thầm bỏ qua** 2 giá trị này (Jackson mặc định không fail khi field lạ) và tự sinh username khác + password placeholder không ai biết. Admin sẽ tưởng mình vừa đặt được username/password thật cho nhân viên — hoàn toàn sai.
- `CreateEmployeePage.tsx` còn nặng hơn: gửi cả `username`, `password`, `phoneNumber`, `dateOfBirth`, `gender`, `address`, `identityCard` lên `POST /api/accounts` — nhưng **kể cả trước #161**, backend chưa từng lưu các field profile này ở bước tạo account (event Kafka `UserRegisteredEvent` chỉ mang `accountId` + `email` — xem code `AccountService`), nên các ô nhập này vốn đã là dữ liệu "ảo", không đi đâu cả. #161 không tạo ra lỗi mới ở phần này, chỉ khiến ta buộc phải dọn nó khi sửa Step 1.

Issue này gồm 2 phần bắt buộc đi cùng nhau (không thể ship riêng B mà bỏ A — nếu chỉ thêm trang activate-account mà không sửa 2 form trên, admin vẫn không có cách nào tạo account đúng theo luồng mới qua UI):

- **Part A** — sửa `UserForm.tsx`, `CreateUserPage.tsx`, `CreateEmployeePage.tsx`, `authApi.ts` cho khớp contract mới.
- **Part B** — trang mới `/activate-account?token=...` để nhân viên tự đặt mật khẩu.

---

## Estimate

- [ ] S (< 2h) / M (2–4h) / **L (4–8h)** / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

**Part A — Fix account-creation forms:**

- [ ] `api/authApi.ts`: đổi `createAccount(payload: any)` thành có kiểu `createAccount(payload: { fullName: string; email: string; role: string })`
- [ ] `api/authApi.ts`: thêm `activateAccount: (payload: { token: string; newPassword: string }) => axiosClient.post('/api/auth/activate-account', payload)`
- [ ] `api/authApi.ts`: thêm `resendActivation: (accountId: string) => axiosClient.post(`/api/accounts/${accountId}/resend-activation`)`
- [ ] `layouts/UserForm.tsx`: khi `isEditMode = false` (chế độ Thêm mới) — **bỏ hẳn** input Username và input Password khỏi giao diện (không chỉ disable). Khi `isEditMode = true` (chế độ Sửa) — giữ nguyên như cũ (Username readonly hiển thị, Password optional "leave blank to keep current"), vì `PUT /api/accounts/{id}` (`UpdateAccountRequest`) không đổi ở #161
- [ ] `UserFormData` interface: `username` và `password` đổi thành optional (`username?`, `password?`) vì giờ chỉ còn ý nghĩa ở chế độ Sửa
- [ ] `pages/admin/CreateUserPage.tsx`: `initialData` bỏ `username`/`password`; sau khi `authApi.createAccount()` thành công, đọc `result.username` (do backend tự sinh) từ response và hiển thị toast/thông báo dạng: *"Đã tạo tài khoản **{username}**. Email kích hoạt đã được gửi tới {email}."* trước khi điều hướng về `/admin/users`
- [ ] `pages/admin/CreateEmployeePage.tsx`: `EmployeeFormData` và form UI bỏ hẳn `username`, `password`; Step 1 (`authApi.createAccount`) chỉ còn gửi `{ fullName, email, role: "EMPLOYEE" }`. Các field `phoneNumber`, `dateOfBirth`, `gender`, `address`, `identityCard` **giữ nguyên trong form** (không xoá UI) nhưng đánh dấu rõ trong code là chưa được persist đi đâu (comment `// TODO: not yet wired to a profile-update call — see backlog`), tránh xoá nhầm UX mà team có thể đang định dùng cho bước hoàn thiện hồ sơ sau này
- [ ] Sau khi Step 1 + Step 2 thành công, hiển thị toast xác nhận đã gửi email kích hoạt tới nhân viên trước khi điều hướng về `/admin/employees`
- [ ] Test thủ công: tạo 1 user MEMBER và 1 employee qua UI mới → xác nhận không còn ô nhập username/password nào ở bước Tạo → xác nhận nhận được email kích hoạt thật (SMTP đã cấu hình sẵn trong `notification-service`)

**Part B — New page `/activate-account`:**

- [ ] File mới `pages/auth/ActivateAccountPage.tsx`, thêm route `/activate-account` vào nhóm `<Route element={<AuthLayout />}>` trong `routes/AppRoutes.tsx` (cạnh `/login`, `/register`)
- [ ] Đọc `token` từ query string bằng `useSearchParams()`. Nếu thiếu `token` → hiển thị trạng thái lỗi ngay, không gọi API
- [ ] Form 2 field: `newPassword`, `confirmPassword` — validate client-side: tối thiểu 8 ký tự (khớp `@Size(min=8)` backend), 2 ô phải khớp nhau, trước khi cho submit
- [ ] Submit gọi `authApi.activateAccount({ token, newPassword })`
- [ ] Thành công: toast "Kích hoạt tài khoản thành công", điều hướng sang `/login` sau ~1.5s
- [ ] Xử lý riêng từng mã lỗi trả về từ backend:
  - `1026` (token invalid) → "Đường link kích hoạt không hợp lệ."
  - `1027` (token expired) → "Đường link đã hết hạn. Vui lòng liên hệ admin để gửi lại email kích hoạt." (nhân viên **không tự resend được** — endpoint resend chỉ dành cho ADMIN)
  - `1028` (token already used) → "Đường link này đã được sử dụng. Thử đăng nhập, hoặc liên hệ admin nếu quên mật khẩu."
- [ ] Giao diện theo đúng phong cách `LoginPage.tsx`/`RegisterPage.tsx` hiện có (cùng nằm trong `AuthLayout`) — tái dùng icon `lucide-react` (Eye/EyeOff cho toggle hiện mật khẩu, Loader2 cho trạng thái loading), toast dùng `sonner` (đã có sẵn ở `components/ui/sonner.tsx`)

**Part C — Nice-to-have (Should, không block issue):**

- [ ] Nút "Resend activation email" trên `UserDetailPage.tsx` / `EmployeeDetailPage.tsx`, chỉ hiện khi account đang `PENDING`, gọi `authApi.resendActivation(accountId)`. Lưu ý: `EmployeeResponse` (từ `employeeApi.ts`) hiện **không** có field `status` của account (chỉ có `employee.status: 'ACTIVE'|'DISABLED'`, khác với `account.status: 'PENDING'|'ACTIVE'|'INACTIVE'`) — cần gọi thêm `authApi.getAccountById(employee.accountId)` ở `EmployeeDetailPage` để biết account có đang PENDING hay không, vì đây là cách làm nhanh nhất không phải sửa backend

---

## API Specifications (if applicable)

### API 1 — Activate Account (đã có ở backend, #161)

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/auth/activate-account` |
| Auth Required | No |

**Request Body:**
```json
{ "token": "b7e5c1a0-....", "newPassword": "MyNewPassword123" }
```

**Response 200 OK:**
```json
{ "code": 1000, "message": "Account activated successfully. You can now log in." }
```

### API 2 — Create Account (đã đổi contract ở #161)

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/accounts` |
| Auth Required | Yes (ADMIN) |

**Request Body (mới — KHÔNG còn `username`/`password`):**
```json
{ "fullName": "Nguyễn Văn A", "email": "nguyenvana@gmail.com", "role": "EMPLOYEE" }
```

**Response 200 OK:**
```json
{
  "code": 1000,
  "result": {
    "accountId": "acc-uuid-1234",
    "username": "nguyenvana",
    "email": "nguyenvana@gmail.com",
    "status": "PENDING",
    "roles": [{ "roleName": "EMPLOYEE" }]
  }
}
```

---

## UI Reference / Mockup

Không có Figma — bám theo layout/màu sắc đang dùng ở `pages/auth/LoginPage.tsx` và `pages/auth/RegisterPage.tsx` (cùng nhóm `AuthLayout`) để đồng bộ. Không cần thiết kế mới.

---

## Technical Notes / Constraints

- **Không được xoá** logic username/password trong `EditUserPage.tsx` / `UserForm.tsx` khi `isEditMode = true` — `PUT /api/accounts/{id}` vẫn hỗ trợ đổi mật khẩu thủ công bởi admin (không đổi ở #161), chỉ luồng **Tạo mới** mới bị ảnh hưởng.
- `authApi.createAccount()` hiện đang là `payload: any` — khi siết kiểu, kiểm tra kỹ không có chỗ nào khác trong code đang gọi hàm này với field ngoài `fullName/email/role` (đã rà: chỉ có `CreateUserPage.tsx` và `CreateEmployeePage.tsx` gọi hàm này).
- Phần "TODO" ở `CreateEmployeePage.tsx` (phone/DOB/gender/address/identityCard chưa persist) là gap **có từ trước #161**, không phải lỗi issue này gây ra — không mở rộng scope để fix luôn, chỉ ghi chú lại cho rõ, có thể tách issue riêng nếu team muốn hoàn thiện luồng "complete profile" khi admin tạo nhân viên.
- Sau khi #157 (role enum) làm ở backend, dropdown role trong `CreateEmployeePage.tsx`/`UserForm.tsx` nên khớp đúng 3 giá trị `ADMIN`/`EMPLOYEE`/`MEMBER` — hiện `UserForm.tsx` chỉ có `MEMBER`/`ADMIN` (thiếu `EMPLOYEE`, nhưng `CreateEmployeePage.tsx` tự hardcode `role: "EMPLOYEE"` riêng nên không bị ảnh hưởng bởi issue này).
- Cần biến môi trường FE trỏ đúng backend đang chạy (`VITE_API_URL` trong `.env.local`) khi test end-to-end với email thật từ `notification-service`.

---

## Related

- Branch: `feat/activate-account-page`
- Depends on: #161 (backend — đã code xong, cần merge trước hoặc chạy song song trên cùng nhánh backend đang chạy local)
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md` (nên cập nhật lại request/response mẫu của `POST /api/accounts` sau khi Part A merge — có thể gộp vào #160)
- Closes: #162

---
---

## Issue #163

**Title:** `[Frontend] Extend "Progressive Profiling" gate to EMPLOYEE role; remove non-persisted personal fields from admin creation forms`

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 4+

---

## Summary / Objective

Sau khi audit kỹ hơn theo yêu cầu ("admin nhập hết hồ sơ hay để nhân viên tự điền"), phát hiện dự án **đã có sẵn** một cơ chế "Progressive Profiling" hoàn chỉnh cho luồng self-service — chỉ là đang bị giới hạn (hardcode) cho riêng role `MEMBER`, không áp dụng cho `EMPLOYEE` (kể cả employee tạo qua luồng invite-link mới ở #161/#162):

- **Backend (`user-service`) đã đúng, không cần sửa gì**: khi `auth-service` bắn `UserRegisteredEvent`, `UserService.createUserProfile()` tạo "skeleton profile" với `profileCompleted = false` (comment trong code: *"profile fields được thu thập riêng qua `PUT /api/users/{id}` sau lần đăng nhập đầu tiên"*). `UserService.updateUser()` tự động set `profileCompleted = true` khi đủ 5 field bắt buộc (`isProfileComplete()`: `fullName`, `phoneNumber`, `identityCard`, `dateOfBirth`, `gender` — `address` là optional). Cơ chế này áp dụng cho **mọi account**, không phân biệt role.
- **Frontend chỉ mới nối dây cho `MEMBER`**: `AuthContext.tsx` có `checkProfileComplete(accountId)` gọi `userApi.getUserById()` và set `needsProfileSetup`, nhưng bị chặn cứng bởi điều kiện `if (primaryRole === "ROLE_MEMBER" && accountId)` (2 chỗ: lúc mount và lúc `login()`). Component `ProfileSetupSheet.tsx` (slide-over sheet, đã làm rất đầy đủ — 2 bước, validate, autofill từ CCCD) chỉ được trigger tại **1 điểm duy nhất**: `SeatBookingPage.tsx` dòng ~177, ngay trước khi customer xác nhận đặt vé ("Gate 2"). Đây là thiết kế **có chủ đích** cho MEMBER (comment trong `LoginPage.tsx`: *"Intentionally not checking needsProfileSetup here"*) — hợp lý vì thời điểm tự nhiên nhất để hỏi CCCD của khách là lúc họ sắp mua vé.
- **Vấn đề**: `EMPLOYEE` không bao giờ "đặt vé" nên không có điểm trigger tương đương — nghĩa là sau khi kích hoạt tài khoản qua `/activate-account` (#162), nhân viên đăng nhập vào và **vĩnh viễn không bao giờ được hỏi** điền phone/DOB/gender/CCCD/address, dù cơ chế backend đã sẵn sàng nhận. Đây chính là lý do cần 1 điểm trigger riêng cho EMPLOYEE: **ngay sau lần đăng nhập đầu tiên**, không phải trong luồng booking.
- Đồng thời, `UserForm.tsx` (dùng bởi `CreateUserPage.tsx`) và `CreateEmployeePage.tsx` vẫn đang bắt buộc admin nhập các field này ở bước **Tạo mới** dù không lưu đi đâu (xem ghi chú "TODO" đã có sẵn trong code, từ #162) — theo đúng hướng Progressive Profiling ở trên, các field này nên được **bỏ hẳn khỏi form Tạo mới**, không phải nối dây cho nó lưu được.

---

## Estimate

- [ ] S (< 2h) / **M (2–4h)** / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

**Part A — Dọn form admin (chỉ ảnh hưởng chế độ Tạo mới):**
- [ ] `UserForm.tsx`: bỏ hẳn input Phone Number, Date of Birth, Gender, Address, Identity Card khỏi giao diện và khỏi `UserFormData`/`initialData` khi ở create mode (component này hiện chỉ được `CreateUserPage.tsx` dùng, `EditUserPage.tsx` có form riêng biệt — không đụng tới)
- [ ] `CreateEmployeePage.tsx`: bỏ tương tự 5 field trên khỏi Step 1 (giữ nguyên Position/Department/Employment Type/Hire Date/Cinema ID vì đó là dữ liệu admin quản lý, không phải personal data)
- [ ] Xoá comment TODO cũ (không còn cần thiết vì field đã bị bỏ hẳn, không còn là "chưa persist" nữa)

**Part B — Trigger Progressive Profiling cho EMPLOYEE:**
- [ ] `AuthContext.tsx`: mở rộng điều kiện `checkProfileComplete` để chạy cho cả `ROLE_EMPLOYEE` (không chỉ `ROLE_MEMBER`) — cả 2 chỗ (mount effect + `login()`)
- [ ] Trang mới `pages/employee/CompleteProfilePage.tsx` — **full-page**, không phải slide-over sheet (khác `ProfileSetupSheet.tsx` vì component đó gắn chặt với context đặt vé — cần `movieTitle`/`showtimeInfo` — không phù hợp cho luồng đăng nhập của nhân viên). Có thể tái dùng field/validate pattern (fullName, gender, DOB dropdown, phone, CCCD với autofill hint, address optional) từ `ProfileSetupSheet.tsx` cho nhất quán UX, chỉ đổi layout thành full page và bỏ 2 prop `movieTitle`/`showtimeInfo`
- [ ] Route guard: khi `user.role === "ROLE_EMPLOYEE"` và `needsProfileSetup === true`, redirect ngay tới `/complete-profile` sau khi login thành công (chặn truy cập các route employee khác cho tới khi hoàn tất) — đặt guard ở layout bao ngoài route employee (tương tự cách `SeatBookingPage.tsx` đang check `needsProfileSetup` cho MEMBER, nhưng ở đây là chặn route chứ không phải chặn hành động)
- [ ] Submit gọi đúng `userApi.updateUser(accountId, {...})` — endpoint đã tồn tại và hoạt động đúng, không cần sửa backend
- [ ] Sau khi hoàn tất → `setNeedsProfileSetup(false)`, cho vào dashboard nhân viên bình thường

---

## Technical Notes / Constraints

- **Phụ thuộc #155**: `PUT /api/users/{id}` hiện KHÔNG có ownership check (`.anyRequest().authenticated()` — ai đăng nhập cũng sửa được profile bất kỳ ai). Trang Complete Profile mới sẽ tạo thêm 1 lối vào rõ ràng, dễ thấy tới đúng endpoint đang hở này — **nên làm #155 cùng lúc hoặc trước khi merge issue này**, không bắt buộc kỹ thuật nhưng rất nên về mặt rủi ro.
- Không cần sửa gì ở backend (`user-service`) — `UserUpdateRequest`, `isProfileComplete()`, `profileCompleted` column đều đã đúng và đã hoạt động (đã verify qua `EditEmployeePage.tsx` đang gọi `userApi.updateUser()` thành công ở luồng admin-edit).
- `MEMBER` không cần đổi gì — cơ chế hiện tại (trigger lúc đặt vé) vẫn giữ nguyên, kể cả với MEMBER được admin tạo qua `CreateUserPage.tsx` (#161/#162), vì check theo role chứ không theo nguồn gốc tạo account.
- Phát hiện thêm (ngoài scope issue này): `EditUserPage.tsx` (sửa User không phải Employee) đang gộp `phoneNumber/gender/dateOfBirth/identityCard/address` chung vào payload gửi cho `authApi.updateAccount()` (`PUT /api/accounts/{id}` ở **auth-service**) — nhưng `UpdateAccountRequest` (auth-service) chỉ có `email/password/roles/status`, không có các field này → **cũng đang bị Jackson âm thầm bỏ qua, giống hệt bug đã tìm thấy ở #162**, chỉ khác là ở luồng Edit thay vì Create. Nên tách 1 issue riêng để sửa `EditUserPage.tsx` gọi đúng `userApi.updateUser()` cho phần profile (giống cách `EditEmployeePage.tsx` đang làm đúng).

---

## Related

- Branch: `feat/employee-progressive-profiling`
- Depends on: #155 (khuyến nghị làm cùng/trước), #161/#162 (đã xong — issue này build tiếp trên nền activate-account flow)
- Docs: có thể bổ sung ghi chú "Progressive Profiling" vào `SRS.md` nếu chưa có, vì đây là 1 pattern kiến trúc quan trọng đang bị tài liệu bỏ sót
- Closes: #163
