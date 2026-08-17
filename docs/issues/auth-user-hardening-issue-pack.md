# Auth & User Service Hardening Issue Pack

Trạng thái: backlog đề xuất sau khi rà soát kiến trúc và bảo mật Auth/User  
Phạm vi: `auth-service`, `user-service`, API Gateway, xác thực phía client và chức năng quản trị People & Access  
Tham chiếu: [`ISSUE_TEMPLATE.md`](./ISSUE_TEMPLATE.md)

## Tóm tắt mức ưu tiên

### P0 — hoàn thành trước khi triển khai production

- [ ] **AUTH-01** — Remove the synchronous Auth ↔ User availability cycle from login
- [ ] **AUTH-02** — Revoke active sessions when an account or staff assignment changes
- [ ] **AUTH-03** — Harden internal Auth/User service endpoints and credential rotation
- [ ] **AUTH-04** — Remove default credentials and secure bootstrap accounts
- [ ] **AUTH-05** — Hash and enforce one-time use for activation and recovery tokens
- [ ] **DB-01** — Replace Hibernate schema updates with versioned Flyway migrations
- [ ] **TEST-01** — Add Auth/User authorization and lifecycle end-to-end tests

### P1 — hoàn thành để đạt nền tảng quản trị sẵn sàng cho doanh nghiệp

- [ ] **AUTH-06** — Introduce explicit access-token and refresh-session lifecycle
- [ ] **AUTH-07** — Secure Google identity linking and prevent account takeover
- [ ] **USER-01** — Add auditable account and staff administration actions
- [ ] **USER-02** — Complete admin account lifecycle and session-management APIs/UI
- [ ] **ARCH-01** — Refactor Auth/User packages by feature and isolate API contracts
- [ ] **ARCH-02** — Add architecture rules for controllers, repositories and service boundaries

### P2 — cải tiến bảo mật và quản lý nhân sự sau demo

- [ ] **AUTH-08** — Add MFA for privileged staff accounts
- [ ] **AUTH-09** — Add customer device and active-session management
- [ ] **AUTH-10** — Separate customer and workforce sign-in entry points

---

## Các issue P0

## AUTH-01 — `[Backend] Decouple login from synchronous user-service availability`

**Nhãn:** `Layer::Backend`, `Type::Feature`, `Priority::High`  
**Ước lượng:** XL (> 1 ngày)

### Tóm tắt / Mục tiêu

Khi phát hành token, `auth-service` hiện truy vấn đồng bộ phạm vi chi nhánh của nhân viên từ `user-service`, trong khi `user-service` cũng gọi Auth để thực hiện các thao tác tài khoản. Cần loại bỏ vòng phụ thuộc runtime này để chức năng xác thực vẫn hoạt động khi dịch vụ quản lý hồ sơ tạm thời không khả dụng.

### Tiêu chí chấp nhận

- [ ] Login không yêu cầu Auth gọi đồng bộ sang User.
- [ ] Auth duy trì một projection cục bộ gồm vai trò tài khoản, trạng thái phân công và danh sách ID cụm rạp được phép truy cập.
- [ ] User phát hành các event có version cho các trường hợp tạo phân công, cập nhật phân công, đình chỉ và kích hoạt lại.
- [ ] Consumer tại Auth có tính idempotent và lưu event/version cuối đã xử lý.
- [ ] Khi thiếu phân công hoặc phân công nhân sự đã bị vô hiệu hóa, các endpoint đặc quyền phải từ chối truy cập theo nguyên tắc fail-closed.
- [ ] Luồng đăng nhập MEMBER hiện có không bị ảnh hưởng.
- [ ] Contract test và failure test chứng minh hành vi đăng nhập khi `user-service` dừng hoạt động.

### Ghi chú kỹ thuật / Ràng buộc

- `auth-service` tiếp tục sở hữu thông tin xác thực và trách nhiệm phát hành token.
- `user-service` tiếp tục sở hữu hồ sơ và dữ liệu phân công công việc.
- Không sao chép toàn bộ hồ sơ nhân viên sang Auth; chỉ đồng bộ các thuộc tính phục vụ phân quyền.
- Có thể dùng fallback tương thích ngắn hạn trong giai đoạn chuyển đổi, nhưng phải xác định ngày loại bỏ rõ ràng.

### Liên quan

- Nhánh: `feat/auth-access-scope-projection`
- Phụ thuộc: canonical event/idempotency contract
- Tài liệu: `docs/security/EXTENDED_DEMO_AUTHORIZATION_MATRIX.md`

---

## AUTH-02 — `[Backend] Revoke sessions after account and staff access changes`

**Nhãn:** `Layer::Backend`, `Type::Bug`, `Priority::High`  
**Ước lượng:** L (4–8 giờ)

### Tóm tắt / Mục tiêu

Việc đình chỉ tài khoản, thay đổi vai trò hoặc gỡ phân công chi nhánh phải có hiệu lực ngay, không chờ JWT hiện tại hết hạn. Cần truyền thay đổi quyền truy cập tới Auth và vô hiệu hóa toàn bộ session bị ảnh hưởng.

### Tiêu chí chấp nhận

- [ ] Các lệnh đình chỉ, vô hiệu hóa, đổi vai trò và gỡ chi nhánh thu hồi toàn bộ session đang hoạt động của tài khoản.
- [ ] Kích hoạt lại tài khoản không khôi phục các token đã bị thu hồi trước đó.
- [ ] Access token chứa token ID và phiên bản bảo mật của tài khoản.
- [ ] Các resource service từ chối nhất quán token đã bị thu hồi hoặc có phiên bản bảo mật cũ.
- [ ] Thao tác “Revoke sessions” của admin trả về kết quả có thể kiểm toán, bao gồm số session bị ảnh hưởng.
- [ ] Client đang kết nối WebSocket nhận event session-invalidated hoặc bị từ chối ở request tiếp theo.
- [ ] Test bao phủ revoke-all, logout, refresh-after-revoke và các request đồng thời.

### Liên quan

- Nhánh: `fix/account-access-revocation`
- Phụ thuộc: access projection của AUTH-01

---

## AUTH-03 — `[Backend] Harden internal Auth and User service APIs`

**Nhãn:** `Layer::Backend`, `Type::Bug`, `Priority::High`  
**Ước lượng:** L (4–8 giờ)

### Tóm tắt / Mục tiêu

Các endpoint nội bộ không được phụ thuộc vào route công khai hoặc một shared header được kiểm tra lỏng lẻo. Cần chuẩn hóa xác thực nội bộ, xoay vòng khóa, hành vi từ chối và cô lập tại gateway.

### Tiêu chí chấp nhận

- [ ] `/api/internal/**` không được API Gateway công khai ra bên ngoài.
- [ ] Credential nội bộ bị thiếu hoặc không hợp lệ luôn trả về `401` hoặc `403`, không trả về `500`.
- [ ] Khóa nội bộ chỉ được đọc từ environment/secret storage và được so sánh constant-time.
- [ ] Khóa hiện tại và khóa kế tiếp có thể cùng hợp lệ trong thời gian ngắn để hỗ trợ xoay vòng không downtime.
- [ ] Gateway loại bỏ các external identity header do client gửi vào.
- [ ] Log không ghi internal key, authorization header, JWT hoặc activation token.
- [ ] Integration test bao phủ truy cập trực tiếp từ bên ngoài, header giả mạo và xoay vòng khóa.

### Ghi chú kỹ thuật / Ràng buộc

- Cách dùng `X-Internal-Service-Key` hiện tại có thể chấp nhận cho môi trường triển khai hiện tại nếu được gia cố như trên.
- Ưu tiên workload identity hoặc mTLS nếu hệ thống được chuyển lên nền tảng được quản lý trong tương lai.

### Liên quan

- Nhánh: `fix/internal-api-authentication`
- Tài liệu: `docs/security/EXTENDED_DEMO_AUTHORIZATION_MATRIX.md`

---

## AUTH-04 — `[Infra] Remove default credentials and secure bootstrap accounts`

**Nhãn:** `Layer::Infrastructure`, `Type::Bug`, `Priority::High`  
**Ước lượng:** M (2–4 giờ)

### Tóm tắt / Mục tiêu

Ngăn credential mặc định của admin, branch manager và service bị sử dụng ngoài môi trường phát triển local đã được bật rõ ràng.

### Tiêu chí chấp nhận

- [ ] Không commit mật khẩu thật, API secret, JWT key, OAuth secret hoặc internal service key.
- [ ] `.env.example` chỉ chứa placeholder và mô tả cách tạo từng giá trị.
- [ ] Tài khoản bootstrap mặc định bị tắt và chỉ được bật qua profile local/demo.
- [ ] Ứng dụng production fail-fast khi thiếu secret bắt buộc hoặc đang dùng giá trị mặc định đã biết.
- [ ] Mật khẩu administrator trong lần chạy đầu được tạo ngẫu nhiên hoặc cung cấp qua secret storage.
- [ ] Credential của provider từng bị lộ phải được xoay vòng trước khi triển khai.
- [ ] Bật secret scanning trong CI.

### Liên quan

- Nhánh: `fix/auth-secret-bootstrap`
- Tài liệu: `docs/operations/MOVIE_SERVICE_SECRET_ROTATION.md`

---

## AUTH-05 — `[Backend] Secure account activation password reset and OTP tokens`

**Nhãn:** `Layer::Backend`, `Type::Bug`, `Priority::High`  
**Ước lượng:** L (4–8 giờ)

### Tóm tắt / Mục tiêu

Xem activation token, password-reset token và OTP như credential. Chỉ lưu hash khi cần persistence, đồng thời bắt buộc thời hạn sử dụng, dùng một lần và cơ chế chống lạm dụng.

### Tiêu chí chấp nhận

- [ ] Activation token và password-reset token được tạo bằng bộ sinh số ngẫu nhiên an toàn về mật mã.
- [ ] Chỉ lưu hash của token; token thô chỉ xuất hiện trong link hoặc thông điệp gửi ra ngoài.
- [ ] Token có mục đích, tài khoản, thời hạn và thời điểm đã sử dụng rõ ràng.
- [ ] Token đã dùng, bị thay thế hoặc hết hạn không thể được sử dụng lại.
- [ ] Gửi lại lời mời sẽ vô hiệu hóa token trước đó.
- [ ] Giới hạn số lần thử OTP và tần suất gửi lại theo tài khoản, email và IP.
- [ ] Response không tiết lộ một email bất kỳ có được đăng ký hay không.
- [ ] Log và error response không để lộ token thô hoặc OTP.

### Liên quan

- Nhánh: `fix/one-time-auth-tokens`
- Phụ thuộc: Redis/database khả dụng

---

## DB-01 — `[Database] Add Flyway baselines for auth and user databases`

**Nhãn:** `Layer::Database`, `Type::Chore`, `Priority::High`  
**Ước lượng:** L (4–8 giờ)

### Tóm tắt / Mục tiêu

Thay thế cơ chế Hibernate `ddl-auto=update` không được kiểm soát bằng migration có version, có thể tái lập và được review cho `auth_db` và `user_db`.

### Tiêu chí chấp nhận

- [ ] Schema Auth và User hiện tại có Flyway baseline có thể tái lập.
- [ ] Cả luồng khởi tạo local sạch và nâng cấp từ dữ liệu hiện tại đều thành công.
- [ ] JPA runtime dùng chế độ `validate` ngoài môi trường test.
- [ ] Có unique constraint và index cho email, username đã chuẩn hóa, external identity và profile identifier.
- [ ] Tài liệu hóa các bước rollback/khôi phục migration.
- [ ] CI khởi chạy cả hai service với database rỗng và áp dụng toàn bộ migration.

### Liên quan

- Nhánh: `chore/auth-user-flyway-baseline`
- Phụ thuộc: snapshot schema production/demo hiện tại

---

## TEST-01 — `[Backend] Add Auth and User security end-to-end tests`

**Nhãn:** `Layer::Backend`, `Type::Chore`, `Priority::High`  
**Ước lượng:** XL (> 1 ngày)

### Tóm tắt / Mục tiêu

Mở rộng unit test bằng các test liên service để chứng minh xác thực, phân quyền, phạm vi chi nhánh và hành vi lifecycle khi đi qua API Gateway.

### Tiêu chí chấp nhận

- [ ] Bao phủ các trường hợp Anonymous, MEMBER, EMPLOYEE, BRANCH_MANAGER, ADMIN và SUPER_ADMIN.
- [ ] Mọi endpoint được bảo vệ đều kiểm tra `401` khi thiếu xác thực và `403` khi không đủ quyền.
- [ ] Token của Chi nhánh A không thể truy cập dữ liệu Chi nhánh B dù client thay đổi ID trong path/query/body.
- [ ] MEMBER không thể đọc hoặc cập nhật hồ sơ của MEMBER khác.
- [ ] Bao phủ các luồng suspend, revoke, refresh, logout, invitation và activation.
- [ ] Kafka event trùng lặp không tạo hồ sơ hoặc phân công trùng.
- [ ] Kiểm thử hành vi khi Auth/User ngừng hoạt động hoặc timeout.
- [ ] Bộ test chạy trong CI với database, Redis và Kafka/Testcontainers độc lập.

### Liên quan

- Nhánh: `test/auth-user-security-e2e`
- Phụ thuộc: AUTH-01, AUTH-02, AUTH-03
- Tài liệu: `docs/security/EXTENDED_DEMO_AUTHORIZATION_MATRIX.md`

---

## Các issue P1

## AUTH-06 — `[Backend] Introduce explicit access token and refresh session lifecycle`

**Nhãn:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`  
**Ước lượng:** XL (> 1 ngày)

### Tóm tắt / Mục tiêu

Thay cơ chế refresh bằng cách tái sử dụng access token bằng mô hình session rõ ràng: access token sống ngắn và refresh token được server quản lý, xoay vòng sau mỗi lần sử dụng.

### Tiêu chí chấp nhận

- [ ] Access token và refresh token có audience, mục đích và thời hạn khác nhau.
- [ ] Refresh token được lưu dưới dạng hash và xoay vòng sau mỗi lần dùng.
- [ ] Việc tái sử dụng refresh token đã được xoay vòng sẽ thu hồi toàn bộ token family.
- [ ] Refresh token trên trình duyệt dùng cookie `HttpOnly`, `Secure` và `SameSite` phù hợp.
- [ ] Access token không được lưu trong browser storage dài hạn.
- [ ] Hỗ trợ logout session hiện tại và logout trên mọi thiết bị.
- [ ] Cơ chế CSRF cho endpoint dùng cookie được tài liệu hóa và kiểm thử.

### Liên quan

- Nhánh: `feat/refresh-session-lifecycle`
- Phụ thuộc: AUTH-02

---

## AUTH-07 — `[Backend] Secure Google account linking and social sign-in`

**Nhãn:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`  
**Ước lượng:** L (4–8 giờ)

### Tóm tắt / Mục tiêu

Xác minh danh tính Google ở backend và xác định quy tắc an toàn khi tạo mới hoặc liên kết danh tính Google với tài khoản CinePrime hiện có.

### Tiêu chí chấp nhận

- [ ] Backend xác minh issuer, audience, signature, expiry, nonce và claim email đã được xác minh.
- [ ] External identity được định danh bằng provider và provider subject bất biến, không chỉ bằng email.
- [ ] Không tự động liên kết tài khoản dùng mật khẩu hiện có chỉ vì email trùng nhau.
- [ ] Liên kết tài khoản yêu cầu xác thực gần đây hoặc xác nhận rõ ràng.
- [ ] Đăng ký bằng Google chỉ được cấp vai trò MEMBER.
- [ ] Vai trò nhân sự đặc quyền không thể tự cấp qua đăng nhập Google.
- [ ] Tài khoản CinePrime đã bị vô hiệu hóa vẫn giữ nguyên trạng thái dù xác thực Google thành công.
- [ ] Kiểm thử trường hợp đăng nhập/liên kết trùng lặp và đồng thời.

### Liên quan

- Nhánh: `feat/google-identity-linking`
- Phụ thuộc: DB-01

---

## USER-01 — `[Backend] Add audit history for account and staff administration`

**Nhãn:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`  
**Ước lượng:** L (4–8 giờ)

### Tóm tắt / Mục tiêu

Ghi nhận ai đã thay đổi trạng thái tài khoản, vai trò, phân công chi nhánh hoặc quyền truy cập nhân sự, đồng thời lưu đủ ngữ cảnh để điều tra vận hành.

### Tiêu chí chấp nhận

- [ ] Ghi audit cho các thao tác tạo lời mời, gửi lại, kích hoạt, đình chỉ, kích hoạt lại, đổi vai trò, đổi phân công và thu hồi session.
- [ ] Audit record gồm người thực hiện, đối tượng, hành động, thời gian, correlation ID và các trường nghiệp vụ trước/sau thay đổi.
- [ ] Không ghi mật khẩu, token, OTP hoặc toàn bộ số giấy tờ định danh.
- [ ] Audit record chỉ được phép append thông qua API ứng dụng.
- [ ] ADMIN có thể truy vấn lịch sử audit với phân trang và bộ lọc.
- [ ] Branch Manager chỉ xem được audit record thuộc chi nhánh được phân công và không được xem thao tác bảo mật toàn hệ thống.

### Liên quan

- Nhánh: `feat/people-access-audit-log`
- Phụ thuộc: AUTH-02

---

## USER-02 — `[Frontend] Complete admin account lifecycle and session management workspace`

**Nhãn:** `Layer::Frontend`, `Type::Feature`, `Priority::Medium`  
**Ước lượng:** XL (> 1 ngày)

### Tóm tắt / Mục tiêu

Hoàn thiện các luồng People & Access để administrator hiểu và quản lý trạng thái tài khoản mà không cần sửa database trực tiếp, thiếu an toàn.

### Tiêu chí chấp nhận

- [ ] Tab Customer và Staff hiển thị trạng thái tài khoản chính thức từ Auth và trạng thái làm việc từ User, không trộn lẫn hai khái niệm.
- [ ] Các action gồm xem, gửi lại lời mời, đình chỉ, kích hoạt lại và thu hồi session khi người dùng có quyền.
- [ ] Action phá hủy yêu cầu xác nhận và lý do.
- [ ] UI giải thích ảnh hưởng lên session hiện tại và lần đăng nhập sau.
- [ ] Action của Branch Manager bị giới hạn trong chi nhánh được phân công và các chức danh được hỗ trợ.
- [ ] Xử lý đầy đủ trạng thái loading, empty, lỗi một phần service và conflict.
- [ ] UI tải lại dữ liệu từ server sau command và không giả định thành công theo kiểu optimistic đối với thay đổi bảo mật.

### Liên quan

- Nhánh: `feat/people-access-lifecycle`
- Phụ thuộc: AUTH-02, USER-01

---

## ARCH-01 — `[Backend] Refactor Auth and User packages around business capabilities`

**Nhãn:** `Layer::Backend`, `Type::Chore`, `Priority::Medium`  
**Ước lượng:** XL (> 1 ngày)

### Tóm tắt / Mục tiêu

Chuyển khỏi cấu trúc thuần kỹ thuật `controller/service/repository/entity` để các ranh giới authentication, registration, invitation, session và profile được thể hiện rõ trong code.

### Tiêu chí chấp nhận

- [ ] Package root mới dùng namespace nhất quán như `com.cineprime.auth` và `com.cineprime.user`.
- [ ] Auth được nhóm theo capability như registration, authentication, session, activation, authorization và external identity.
- [ ] User được nhóm theo profile, employee, invitation, assignment và administration.
- [ ] Controller trả response DTO thay vì persistence entity.
- [ ] Application service không để lộ JPA entity qua ranh giới package.
- [ ] Loại bỏ cặp `Service`/`ServiceImpl` chỉ có một implementation, trừ khi chúng đại diện cho một port có chủ đích.
- [ ] Việc refactor giữ nguyên API và event contract bên ngoài.

### Liên quan

- Nhánh: `refactor/auth-user-package-boundaries`
- Phụ thuộc: hoàn thành ổn định P0

---

## ARCH-02 — `[Backend] Enforce Auth and User architecture rules with ArchUnit`

**Nhãn:** `Layer::Backend`, `Type::Chore`, `Priority::Medium`  
**Ước lượng:** M (2–4 giờ)

### Tóm tắt / Mục tiêu

Ngăn code mới vượt qua application boundary hoặc làm public API phụ thuộc vào persistence model.

### Tiêu chí chấp nhận

- [ ] Controller không được truy cập repository trực tiếp.
- [ ] Package domain/application không được phụ thuộc vào web adapter.
- [ ] Public controller không được để lộ kiểu JPA entity.
- [ ] Auth không được import implementation class của User và ngược lại.
- [ ] Chỉ contract module được phê duyệt mới được chia sẻ giữa các service.
- [ ] Architecture test chạy trong CI và cung cấp thông báo lỗi dễ hiểu.

### Liên quan

- Nhánh: `test/auth-user-architecture-rules`
- Phụ thuộc: ARCH-01

---

## Các issue P2

## AUTH-08 — `[Backend] Require multi-factor authentication for privileged staff`

**Nhãn:** `Layer::Backend`, `Type::Feature`, `Priority::Low`  
**Ước lượng:** XL (> 1 ngày)

### Tiêu chí chấp nhận

- [ ] Hỗ trợ đăng ký MFA cho ADMIN, SUPER_ADMIN và tùy chọn BRANCH_MANAGER.
- [ ] TOTP và recovery code được lưu an toàn.
- [ ] Đăng nhập đặc quyền và action nhạy cảm có thể yêu cầu step-up authentication.
- [ ] Thao tác khôi phục và reset được audit, đồng thời một người không thể tự thực hiện nếu chưa qua policy check.

### Liên quan

- Nhánh: `feat/staff-mfa`
- Phụ thuộc: AUTH-06, USER-01

---

## AUTH-09 — `[Frontend] Add customer device and active-session management`

**Nhãn:** `Layer::Frontend`, `Type::Feature`, `Priority::Low`  
**Ước lượng:** L (4–8 giờ)

### Tiêu chí chấp nhận

- [ ] Customer có thể xem các session gần đây với thiết bị, vị trí gần đúng và lần hoạt động cuối.
- [ ] Customer có thể thu hồi một session hoặc tất cả session khác.
- [ ] Session hiện tại được xác định rõ ràng.
- [ ] Metadata của session tránh fingerprinting xâm lấn và tuân thủ chính sách lưu giữ dữ liệu.

### Liên quan

- Nhánh: `feat/customer-session-management`
- Phụ thuộc: AUTH-06

---

## AUTH-10 — `[Frontend] Separate customer and workforce sign-in entry points`

**Nhãn:** `Layer::Frontend`, `Type::Feature`, `Priority::Low`  
**Ước lượng:** L (4–8 giờ)

### Tóm tắt / Mục tiêu

Dùng điểm đăng nhập hướng tới customer cho tài khoản MEMBER và điểm đăng nhập workforce cho nhân viên, administrator, trong khi vẫn sử dụng chung một identity backend.

### Tiêu chí chấp nhận

- [ ] Trang đăng nhập customer dùng thuật ngữ dành cho khách hàng và hỗ trợ đăng ký/đăng nhập Google.
- [ ] Trang đăng nhập workforce không có đăng ký công khai và không cho phép tự cấp tài khoản qua social login.
- [ ] Sau khi đăng nhập thành công, hệ thống chuyển hướng theo vai trò và workspace được server cấp quyền.
- [ ] Truy cập trực tiếp bằng URL không thể bỏ qua kiểm tra vai trò.
- [ ] Component xác thực dùng chung vẫn có thể tái sử dụng mà không trộn thông điệp dành cho customer và staff.

### Liên quan

- Nhánh: `feat/customer-workforce-login-entrypoints`
- Phụ thuộc: contract vai trò và session ổn định

---

## Thứ tự triển khai đề xuất

```text
AUTH-04 ─┐
AUTH-05 ─┼─> DB-01 ────────────────┐
AUTH-03 ─┘                          │
AUTH-01 ─> AUTH-02 ─> TEST-01      │
                    ├─> AUTH-06 ───┼─> AUTH-08 / AUTH-09
                    ├─> USER-01 ─> USER-02
                    └─> AUTH-07

Ổn định P0 ─> ARCH-01 ─> ARCH-02
```

## Ngoài phạm vi của buổi final demo hiện tại

- [ ] Tích hợp workforce SSO cấp doanh nghiệp qua SAML/OIDC
- [ ] Cấp tài khoản nhân viên qua SCIM
- [ ] Xác thực không mật khẩu bằng WebAuthn/passkey
- [ ] Đồng bộ danh tính đa vùng
- [ ] Chuyển sang sản phẩm IAM chuyên dụng như Keycloak/Auth0/Entra ID

Đây là các năng lực phù hợp cho tương lai, nhưng chưa cải thiện đủ giá trị của luồng demo rạp chiếu cốt lõi để biện minh cho rủi ro triển khai ở thời điểm hiện tại.
