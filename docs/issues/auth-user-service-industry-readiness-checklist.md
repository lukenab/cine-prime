# Auth Service & User Service — Industry Readiness Checklist

> Baseline: source code được đối chiếu ngày **2026-07-15**.  
> Scope: đăng ký/đăng nhập/session, account/role/permission, customer profile, employee provisioning và employee lifecycle.  
> Mục tiêu: đủ an toàn cho hệ thống rạp có customer web/app, Cinema Manager và POS; không thay thế tư vấn pháp lý hoặc security assessment độc lập.

## 1. Cách đọc checklist

| Trạng thái | Ý nghĩa |
|---|---|
| `Covered` | Code hiện tại đã có rule cốt lõi; cần giữ bằng regression test. |
| `Partial` | Có nền tảng nhưng còn đường bypass, thiếu transaction/test hoặc chưa đúng operational practice. |
| `Gap` | Chưa có implementation tương ứng. |
| `Broken` | Source hiện tại không compile/chạy đúng hoặc có lỗi đang chặn flow. |

| Priority | Ý nghĩa |
|---|---|
| `P0` | Có thể lộ PII, nâng quyền, dùng account đã nghỉ việc, chiếm session, phá provisioning hoặc chặn build/demo. |
| `P1` | Cần trước production/pilot nghiêm túc; ảnh hưởng vận hành, audit, support hoặc khả năng mở rộng nhiều rạp. |
| `P2` | Nâng cao enterprise/zero-trust; làm sau khi P0/P1 ổn định. |

### Verification hiện tại

- [x] Đã đọc SecurityConfig, controller, service, entity, mapper, Kafka consumer/publisher và application config của hai service.
- [x] Đã đối chiếu database scripts và API/business-rule docs hiện hữu.
- [x] Đã chạy `server/mvnw.cmd -pl auth-service,user-service -am test -DskipTests`.
- [x] `user-service` compile thành công nhưng có mapper/builder warnings.
- [ ] `auth-service` compile: **FAILED** tại `AuthEventPublisher.java` do typo `GGlobalErrorCode`.
- [ ] Automated test coverage gần như chưa có: auth chỉ có context test, user-service không có test source tương ứng.

---

## 2. Ma trận tổng quan

| ID | Module | Business Rule / vấn đề | Hiện trạng | Priority | Size |
|---|---|---|---|---|---|
| `BUILD-01` | Auth | Main branch phải compile trước mọi refactor | Broken | P0 | S |
| `CFG-01` | Auth/User | Không có secret/default admin credential trong source | Gap | P0 | S |
| `DB-01` | Auth/User | Versioned migrations là schema source of truth | Gap | P0 | M |
| `AUTHZ-01` | Auth | Account list/detail/update chỉ admin; self dùng `/my-info` | Gap | P0 | S |
| `AUTHZ-02` | Auth | Role/permission mutation chỉ security admin | Gap | P0 | S |
| `AUTHZ-03` | User | Object-level authorization cho user/employee APIs | Gap | P0 | M |
| `AUTHZ-04` | Auth/User | JWT authority mapping, issuer/audience và key strategy nhất quán | Gap | P0 | M |
| `AUTHN-01` | Auth | Login throttling chống brute force mà không tạo account-lock DoS | Partial | P0 | M |
| `AUTHN-02` | Auth | MFA/step-up cho admin, manager và thao tác POS nhạy cảm | Gap | P0 | L |
| `PASS-01` | Auth | Password policy hiện đại và compromised-password blocking | Partial | P1 | M |
| `OTP-01` | Auth | OTP có attempt limit, one-time semantics và anti-enumeration | Partial | P0 | M |
| `ACT-01` | Auth | Invite/activation token được hash, single-use và delivery đáng tin cậy | Partial | P0 | M |
| `SESS-01` | Auth | Access/refresh token tách biệt, rotation và replay detection | Gap | P0 | L |
| `SESS-02` | Auth | Password/role/status change revoke sessions phù hợp | Gap | P0 | M |
| `ACCT-01` | Auth | Account/role/status transition rõ, không free-text/fallback âm thầm | Partial | P0 | M |
| `EVENT-01` | Auth/User | Account-created event không bị mất; consumer idempotent/versioned | Partial | P0 | L |
| `AUD-01` | Auth/User | Security/PII audit append-only, redacted và actor đáng tin cậy | Partial | P0 | M |
| `ENUM-01` | Auth/User | Public API không xác nhận email/phone/CCCD tồn tại | Gap | P0 | S |
| `PROF-01` | User | User chỉ đọc/sửa profile của chính mình hoặc theo quyền quản trị | Gap | P0 | M |
| `PROF-02` | User | Không tự tạo profile cho `accountId` tùy ý từ authenticated request | Gap | P0 | M |
| `PII-01` | User | Data minimization: customer thường không bắt buộc CCCD | Gap | P0 | M |
| `PII-02` | User | PII được mask, mã hóa/tokenize, hạn chế truy vấn và log | Partial | P0 | L |
| `PII-03` | User | Consent/purpose/retention/export/correction/deletion workflow | Gap | P1 | L |
| `EMP-01` | Auth/User | Employee provisioning nhất quán account role/profile/employee | Partial | P0 | L |
| `EMP-02` | Auth/User | Mỗi nhân viên có identity riêng; không dùng shared POS login | Partial | P0 | M |
| `EMP-03` | Auth/User | Quyền staff theo user group, cinema/site và phạm vi công việc | Gap | P0 | L |
| `EMP-04` | Auth/User | Supervisor override và segregation of duties cho thao tác nhạy cảm | Gap | P0 | L |
| `EMP-05` | Auth/User | Offboarding khóa account, revoke session nhưng giữ transaction history | Gap | P0 | L |
| `EMP-06` | User | Employee status/assignment có effective dates và lịch sử | Partial | P1 | M |
| `EMP-07` | User/Movie | `cinemaId` phải tham chiếu cluster hợp lệ, không nhận chuỗi bất kỳ | Gap | P0 | M |
| `API-01` | Auth/User | Error/status/pagination và self/admin DTO contract nhất quán | Partial | P1 | M |
| `OPS-01` | Auth/User | Metrics/alerts cho auth abuse, DLT và provisioning drift | Partial | P1 | M |
| `TEST-01` | Auth/User | Security, lifecycle, integration và concurrency regression suite | Gap | P0 | L |

---

## 3. Auth Service checklist

### `BUILD-01` — Restore a green build (`P0`, `Broken`)

- [ ] Sửa `GGlobalErrorCode` thành error-code reference hợp lệ trong `AuthEventPublisher`.
- [ ] Thêm test/compile gate để typo tương tự không vào main branch.
- [ ] Review MapStruct warnings; field intentionally ignored phải khai báo explicit thay vì để warning che lỗi mapper thật.
- [ ] Sau compile phải chạy startup/schema preflight, không xem compile là đủ.

### `CFG-01` — Externalize secrets and remove default privileged credentials (`P0`, `Gap`)

Code hiện còn JWT fallback secret, `admin/admin`, database password và Cloudinary credentials có giá trị thật/default.

- [ ] JWT signing key, DB password, Cloudinary credential và admin bootstrap secret chỉ đến từ environment/secret store.
- [ ] Rotate mọi credential đã từng commit hoặc chia sẻ.
- [ ] Production fail-fast nếu thiếu secret; không fallback sang `admin`, `123456` hoặc signing key mẫu.
- [ ] Bootstrap admin dùng one-time setup hoặc bắt buộc đổi password trước khi dùng nghiệp vụ.
- [ ] `.env.example` chỉ chứa tên biến/placeholder không hoạt động.
- [ ] CI secret scan và dependency/security scan được bật.

### `DB-01` — Use versioned database migrations (`P0`, `Gap`)

- [ ] Bỏ `ddl-auto=update` khỏi production; dùng `validate` với Flyway/Liquibase.
- [ ] Fresh DB và upgraded DB đều chạy migration integration test.
- [ ] Đồng bộ `auth_token` schema: entity dùng direct `account_id`, tài liệu cũ còn mô hình join table.
- [ ] Đồng bộ `profile_completed`, unique phone/identity constraints và user audit schema giữa entity và SQL.
- [ ] Migration forward-only, có schema history và startup health check.
- [ ] Seed role/permission không tự overwrite thay đổi production ngoài ý muốn.

### `AUTHZ-01` — Protect account resources and prevent privilege escalation (`P0`, `Gap`)

Hiện chỉ `POST /api/accounts` và resend activation được gate ADMIN; GET/PUT account rơi vào `authenticated()`.

- [ ] `GET /api/accounts` chỉ ADMIN/security staff có quyền tương ứng.
- [ ] `GET /api/accounts/{id}` chỉ ADMIN hoặc self theo contract; public/self DTO không trả quyền nhạy cảm không cần thiết.
- [ ] `PUT /api/accounts/{id}` không cho MEMBER/EMPLOYEE đổi role/status/password của account khác.
- [ ] `/api/accounts/my-info` vẫn dùng được cho mọi authenticated principal.
- [ ] Rule cụ thể đứng trước wildcard rule; có security test cho MEMBER, EMPLOYEE, ADMIN.
- [ ] Role/status changes yêu cầu recent authentication/step-up nếu là hành động nhạy cảm.

### `AUTHZ-02` — Restrict role and permission administration (`P0`, `Gap`)

`POST/GET /api/roles` và `POST/GET/DELETE /api/permissions` hiện chỉ cần đăng nhập.

- [ ] Chỉ security admin được tạo/sửa/xóa role/permission.
- [ ] Không user nào được cấp role cao hơn quyền họ được phép quản lý.
- [ ] Manager site không được xem/sửa Head Office admin hoặc manager cấp cao hơn.
- [ ] Không xóa permission đang được role/audit/history tham chiếu; dùng inactive/deprecated nếu cần.
- [ ] Mọi role/permission assignment ghi audit before/after và actor.
- [ ] Có two-person approval hoặc step-up cho cấp/revoke quyền đặc biệt như refund, complimentary, report revenue, staff management.

### `AUTHZ-04` — Standardize JWT trust and authority mapping (`P0`, `Gap`)

- [ ] `scope`/`roles` claim có một canonical format trên mọi service.
- [ ] Sửa user-service prefix mapping để không tạo `ROLE_ROLE_ADMIN` hoặc `ROLE_EMPLOYEE_READ` ngoài ý muốn.
- [ ] Resource servers validate signature, expiry, issuer và intended audience.
- [ ] Access token có `aud` theo resource/API hoặc scope tối thiểu cần thiết.
- [ ] Không để tất cả resource services giữ cùng symmetric signing secret dài hạn; production ưu tiên asymmetric signing + JWKS/key rotation.
- [ ] Gateway không phải lớp authorization duy nhất; từng resource service tự enforce.
- [ ] Contract tests xác nhận cùng một token tạo cùng authorities ở auth/user/movie/booking services.

### `AUTHN-01` — Harden login throttling without account-lock denial of service (`P0`, `Partial`)

Đã có 5 lần sai → khóa 15 phút và reset counter khi login thành công.

- [x] Có failed-attempt counter, temporary lock và last-login timestamp.
- [ ] Threshold/lock duration cấu hình được thay vì constant trong code.
- [ ] Kết hợp per-account với per-IP/device rate limit; không chỉ khóa account để attacker có thể DoS người dùng.
- [ ] Response public không phân biệt quá chi tiết account không tồn tại/inactive/locked nếu làm lộ account state.
- [ ] Có exponential delay/rate-limit response và `Retry-After` phù hợp.
- [ ] Login success/failure/lock/unlock có metric và alert bất thường.
- [ ] Concurrency test không làm mất increment khi nhiều request sai password cùng lúc.

### `AUTHN-02` — Require MFA or step-up for privileged cinema operations (`P0`, `Gap`)

- [ ] ADMIN, Head Office, cinema manager và supervisor bắt buộc MFA trước production.
- [ ] Ưu tiên WebAuthn/passkey hoặc TOTP; email OTP không được xem là phishing-resistant.
- [ ] Step-up authentication cho cấp quyền, xem/export PII, refund/void, complimentary ticket, cash/report action và override của supervisor.
- [ ] Recovery codes/MFA reset có identity verification, audit và notification.
- [ ] POS fast-login/PIN nếu triển khai chỉ mở session hạn chế; supervisor override vẫn yêu cầu identity riêng.
- [ ] Không dùng một supervisor credential được chia sẻ cho cả ca.

### `PASS-01` — Modern password policy (`P1`, `Partial`)

- [x] Password được hash bằng BCrypt; invite flow không để admin biết password nhân viên.
- [ ] Password single-factor có minimum length phù hợp policy; không chỉ 8 ký tự cho mọi trường hợp.
- [ ] Kiểm tra password nằm trong breached/common-password blocklist.
- [ ] Cho phép paste/password manager và độ dài lớn; không bắt composition rules máy móc.
- [ ] Không ép đổi password định kỳ nếu không có compromise/risk event.
- [ ] Password change/reset yêu cầu reauthentication phù hợp, gửi notification và revoke sessions theo policy.
- [ ] BCrypt cost là configuration và có kế hoạch rehash khi cost thay đổi.

### `OTP-01` — Secure registration OTP (`P0`, `Partial`)

Đã có SecureRandom, TTL 5 phút, resend cooldown 60 giây và delete OTP sau success.

- [x] OTP random, short-lived và one-time sau verify thành công.
- [x] Resend có cooldown.
- [ ] Giới hạn số lần verify sai theo email + IP/device; vượt ngưỡng invalidates challenge.
- [ ] Resend có daily/hourly quota và abuse monitoring, không chỉ 60-second cooldown.
- [ ] Resend tạo OTP mới và invalidate OTP cũ atomically.
- [ ] Initiate/resend response trung tính để giảm account/email enumeration.
- [ ] Không log OTP; Kafka/topic chứa OTP phải có ACL, TLS, retention ngắn và không xuất payload ở DLT/log.
- [ ] Redis pending payload chứa password hash, không plaintext; TTL và access control được verify.

### `ACT-01` — Harden invite and activation lifecycle (`P0`, `Partial`)

Invite-link flow đã tốt hơn admin nhập password nhưng token hiện lưu raw và email publish failure chỉ được log async.

- [x] Account admin-created bắt đầu `PENDING`, user tự đặt password qua single-use activation link.
- [x] Resend invalidates token pending khác.
- [ ] Chỉ lưu hash của activation/reset token; raw token chỉ xuất hiện trong email link.
- [ ] Token purpose (`ACTIVATION`/`PASSWORD_RESET`), issued-at, used-at và created-by được lưu rõ.
- [ ] Token consume dùng conditional update/locking để hai request concurrent chỉ một request thành công.
- [ ] Activation success revoke mọi session/token cũ và gửi notification.
- [ ] Email event failure phải retry/outbox/DLT và hiển thị trạng thái delivery để admin resend; không chỉ log.
- [ ] Activation URL tránh token leakage qua referrer/history; frontend xóa token khỏi URL sau consume.

### `SESS-01` — Replace access-token-as-refresh-token with rotating refresh sessions (`P0`, `Gap`)

Hiện cùng JWT bearer được dùng làm access token và input refresh. DB lưu `expiresAt` theo access expiry trong khi refresh window dài hơn; cleanup có thể xóa record trước khi refresh window kết thúc.

- [ ] Access token ngắn hạn và refresh token/session credential là hai loại khác nhau.
- [ ] Refresh token chỉ lưu dạng hash, bound với client/device/session và có absolute + idle expiry.
- [ ] Rotate refresh token ở mỗi lần refresh; reuse token cũ revoke toàn token family/session.
- [ ] Logout current session và logout-all-devices là hai command rõ.
- [ ] Cleanup dùng refresh/session expiry đúng, không xóa token còn refreshable.
- [ ] Refresh token không được gửi tới resource services; chỉ auth-service nhận qua TLS/cookie strategy đã chốt.
- [ ] Password reset, account disable và high-risk event revoke refresh-token families.
- [ ] Concurrency/replay tests cover simultaneous refresh và stolen-token reuse.

### `SESS-02` — Revoke authorization promptly after account changes (`P0`, `Gap`)

- [ ] Disable account/employee revoke toàn active sessions trong cùng workflow đáng tin cậy.
- [ ] Role/permission downgrade không tiếp tục có hiệu lực đến hết token TTL mà không có revocation/version check.
- [ ] Password change/reset revoke sessions theo policy, tối thiểu các session khác.
- [ ] JWT/session chứa authorization version hoặc resource server introspection/cache strategy phù hợp.
- [ ] Re-enable account không tự phục hồi old sessions.
- [ ] Audit ghi actor, reason, affected sessions và timestamp.

### `ACCT-01` — Canonical account and role lifecycle (`P0`, `Partial`)

- [ ] Role input không còn free-text; invalid role trả 400, không fallback âm thầm về MEMBER.
- [ ] Account transitions được chốt: `PENDING → ACTIVE → INACTIVE`; reactivate là command riêng có policy.
- [ ] Email change có uniqueness check, verification lại email và notification tới địa chỉ cũ/mới.
- [ ] Update request không cho client tùy ý gửi password/roles/status trong một DTO chung.
- [ ] Tách command `change-email`, `change-password`, `assign-role`, `disable`, `reactivate` với authorization/audit riêng.
- [ ] Không cho tự vô hiệu hóa admin cuối cùng hoặc xóa đường khôi phục hệ thống.

### `EVENT-01` — Make cross-service identity provisioning reliable (`P0`, `Partial`)

- [x] UserRegistered consumer idempotent cơ bản theo `accountId`.
- [x] Kafka consumer có retry và DLT cho event register.
- [ ] Auth account creation và event publish dùng transactional outbox; không commit account rồi mất event khi Kafka fail.
- [ ] Event có `eventId`, version, occurredAt, account status/role cần thiết và correlation ID.
- [ ] Consumer deduplicate theo `eventId`, không chỉ `existsById`.
- [ ] DLT được lưu/alert/replay có kiểm soát; không chỉ log payload.
- [ ] Không catch business exception rồi commit offset âm thầm trong `updateUserProfile`.
- [ ] Có reconciliation tìm account thiếu user profile hoặc employee/account role bị lệch.

### `AUD-01` — Trustworthy security audit (`P0`, `Partial`)

- [x] Auth có bảng audit riêng với actor, target, action, status, IP và user-agent.
- [ ] Chỉ tin `X-Forwarded-For` từ trusted proxy; gateway phải sanitize header từ client.
- [ ] Mask/hash email, phone, CCCD trong log/metadata theo purpose; không ghi token, OTP hoặc password.
- [ ] User audit không serialize toàn entity graph/PII raw vào `old_value/new_value`.
- [ ] Audit append-only, access-controlled và có retention/archival policy.
- [ ] Critical audit write failure tạo metric/alert; không bị swallow hoàn toàn.
- [ ] Correlation ID xuyên auth → Kafka → user-service.

---

## 4. User Service & Employee checklist

### `AUTHZ-03` — Enforce endpoint and object-level authorization (`P0`, `Gap`)

`user-service` hiện chỉ có `anyRequest().authenticated()`, chưa bật method security; mọi account đã login có thể gọi user/employee CRUD.

- [ ] Thêm `@EnableMethodSecurity` và canonical authority converter theo `AUTHZ-04`.
- [ ] Customer chỉ đọc/sửa/upload avatar cho chính `accountId` trong verified JWT.
- [ ] Employee thường không được list toàn bộ customers/employees hoặc sửa profile người khác.
- [ ] HR/security admin được quản lý employee theo permission cụ thể.
- [ ] Cinema manager chỉ xem/sửa staff thuộc cinema/site họ quản lý và không sửa manager/admin cấp cao hơn.
- [ ] List/detail DTO được field-filter theo caller; không trả PII vì caller có quyền đọc một phần.
- [ ] Security tests cover horizontal IDOR, vertical privilege escalation và direct URL/API call.

### `ENUM-01` — Remove public PII/account enumeration (`P0`, `Gap`)

`GET /api/users/check-existence` hiện public và nhận phone + identityCard trên query string.

- [ ] Không có public API trả `phoneExists`/`identityCardExists` cho dữ liệu bất kỳ.
- [ ] Registration uniqueness được kiểm tra server-side và response không xác nhận record cụ thể quá mức cần thiết.
- [ ] Nếu internal endpoint vẫn cần, chỉ auth-service/service credential hoặc authorized staff được gọi.
- [ ] Không truyền CCCD/phone nhạy cảm qua URL query vì có thể xuất hiện trong access log/history.
- [ ] Rate limit và audit các lookup uniqueness bất thường.
- [ ] Frontend không phụ thuộc pre-check để đảm bảo uniqueness; DB constraint vẫn là lớp cuối.

### `PROF-01` — Self profile versus administrative profile access (`P0`, `Gap`)

- [ ] Có endpoint canonical `/api/users/me` dùng `accountId` từ JWT, không nhận ID do client chọn.
- [ ] Self update chỉ cho profile fields; không cho sửa email auth, isActive, role hoặc employee assignment.
- [ ] Admin/HR endpoints tách namespace/DTO và yêu cầu permission riêng.
- [ ] User inactive không thể đọc/sửa profile qua self endpoint.
- [ ] List users có pagination, filter, field-level permission và audit access/export.
- [ ] Identity card luôn masked trong response thông thường; unmask là action đặc quyền có reason/step-up/audit.

### `PROF-02` — Do not create profiles from an arbitrary path account ID (`P0`, `Gap`)

`updateUser()` hiện upsert skeleton nếu không tìm thấy ID, nên authenticated caller có thể tạo profile cho UUID bất kỳ nếu authorization thiếu.

- [ ] Self update không bao giờ tạo profile cho path ID do client cung cấp.
- [ ] Skeleton chỉ được tạo từ trusted `UserRegisteredEvent` hoặc internal reconciliation đã xác thực account tồn tại.
- [ ] Kafka lag trả `PROFILE_SYNC_PENDING`/retry behavior rõ, không dùng unauthenticated upsert làm fallback.
- [ ] Profile create có idempotency/event ID và email/account data đến từ auth-service, không từ client.
- [ ] Negative test: valid MEMBER token không thể tạo/sửa UUID khác.

### `PII-01` — Minimize customer profile data (`P0`, `Gap`)

Current `profileCompleted` bắt buộc full name, phone, CCCD, DOB và gender. Với customer mua vé thông thường, CCCD/gender/address không nên là điều kiện mặc định nếu không có purpose rõ.

- [ ] Chốt field tối thiểu theo persona: customer, employee, admin/manager; không dùng một completion rule cho tất cả.
- [ ] Customer booking profile chỉ yêu cầu dữ liệu thực sự cần cho contact/fulfillment; CCCD không bắt buộc mặc định.
- [ ] Age restriction được booking/venue flow enforce bằng age/classification policy; không biến việc lưu CCCD toàn bộ customer thành giải pháp mặc định.
- [ ] Employee HR data được thu thập theo employment purpose riêng, không dùng chung customer profile form.
- [ ] Mỗi field có purpose, source, retention và access policy trong data inventory.
- [ ] Form/contract phân biệt required, optional và conditional; consent/privacy notice phù hợp.

### `PII-02` — Protect personal and employee data (`P0`, `Partial`)

Đã mask CCCD trong `UserResponse`/`EmployeeResponse`, nhưng raw CCCD/phone vẫn lưu plaintext và user audit serialize dữ liệu before/after.

- [x] Response mapper mask identity card ở các DTO hiện tại.
- [ ] Mã hóa field nhạy cảm at rest bằng application/KMS-managed encryption; khóa không nằm trong DB/source.
- [ ] Nếu cần uniqueness/search, dùng normalized keyed hash/blind index tách khỏi ciphertext.
- [ ] Phone/email normalization nhất quán trước unique comparison.
- [ ] Audit/log/DLT không chứa raw CCCD, phone, address hoặc full entity payload.
- [ ] Cloudinary/avatar upload kiểm tra magic bytes, size, re-encode/metadata stripping và ownership.
- [ ] Database backup, export và support tooling dùng cùng access/retention controls.
- [ ] PII read/export được audit theo actor, purpose và scope.

### `PII-03` — Personal-data lifecycle and data-subject operations (`P1`, `Gap`)

- [ ] Có privacy notice/consent record hoặc lawful-purpose record theo loại dữ liệu.
- [ ] User có flow xem, sửa và yêu cầu xóa/hạn chế xử lý dữ liệu phù hợp.
- [ ] Tách xóa/anonymize customer PII khỏi retention bắt buộc của booking/payment/audit history.
- [ ] Employee offboarding áp dụng retention rule cho hồ sơ lao động, sau đó xóa/anonymize theo policy/pháp luật áp dụng.
- [ ] Có export portable profile data và verification trước khi cung cấp.
- [ ] Vendor/cross-border processing như Cloudinary có inventory, purpose và contractual control.
- [ ] Incident/breach response và notification process được document.

### `EMP-01` — Orchestrate employee provisioning consistently (`P0`, `Partial`)

Flow hiện tại gồm create auth account → Kafka skeleton profile → POST employee; `EmployeeService` poll DB 5 × 300 ms và chưa cross-check account role.

- [x] Employee table có unique `account_id`; service dùng `saveAndFlush()` và translate duplicate race.
- [x] Admin invite flow không yêu cầu admin nhập password nhân viên.
- [ ] Có một provisioning workflow/saga rõ với operation ID và trạng thái `INVITED/PROFILE_PENDING/ACTIVE/FAILED`.
- [ ] Chỉ tạo employee record khi auth account có intended role/type `EMPLOYEE`.
- [ ] Không giữ `Thread.sleep()` polling trong request transaction; trả sync status hoặc retry orchestration.
- [ ] Failure sau khi account đã tạo không để orphan account không có recovery path.
- [ ] Retry cùng operation không tạo account/profile/employee duplicate.
- [ ] Admin UI hiển thị trạng thái invitation, activation, profile sync và resend/retry action.
- [ ] Reconciliation job phát hiện role/profile/employee mismatch.

### `EMP-02` — One identity per staff member, no shared POS credentials (`P0`, `Partial`)

- [ ] Mỗi người thao tác Cinema Manager/POS có account/employee identity riêng.
- [ ] Không seed/dùng shared `cashier`, `manager` hoặc supervisor password/PIN giữa nhiều người/ca.
- [ ] Mọi booking confirmation, counter sale, refund/void/override mang actor account/employee ID.
- [ ] Fast POS unlock nếu cần vẫn map tới một nhân viên cụ thể và session/workstation cụ thể.
- [ ] Không cho cùng account liên kết nhiều employee records; unique DB constraint đã có phải được migration/test.
- [ ] Quy định rõ một person có thể vừa MEMBER vừa EMPLOYEE hay không; nếu có, context switch và permissions không trộn lẫn.

### `EMP-03` — Scope staff permissions by group, cinema and assignment (`P0`, `Gap`)

Current global roles chỉ có MEMBER/EMPLOYEE/ADMIN; role EMPLOYEE nhận nhiều permission toàn hệ thống và token không có site scope đáng tin cậy.

- [ ] Tạo role/user-group thực tế tối thiểu: POS_OPERATOR, FLOOR_STAFF, PROJECTIONIST, SUPERVISOR, CINEMA_MANAGER, HEAD_OFFICE/ADMIN theo scope sản phẩm.
- [ ] Permission là action cụ thể; role/group là bundle có version và audit.
- [ ] Employee assignment gồm cinema/cluster/site scope; query/service luôn filter theo assignment.
- [ ] Head Office có cross-site permission riêng; cinema manager không mặc định thấy toàn chuỗi.
- [ ] Role/position/department không bị coi là cùng một khái niệm.
- [ ] Token/session có authorization context hoặc resource service tra assignment đáng tin cậy.
- [ ] Khi transfer cinema, quyền site cũ bị revoke theo effective time và session được refresh/revoke.

### `EMP-04` — Supervisor authorization and segregation of duties (`P0`, `Gap`)

Các hệ thống rạp/POS thực tế thường tách người thực hiện và người phê duyệt các thao tác dễ gian lận.

- [ ] POS operator chỉ có minimum permissions để bán vé/đồ ăn và xử lý booking trong ca/phạm vi của mình.
- [ ] Refund, void, complimentary ticket, price override, cash adjustment và mở lại business day yêu cầu permission/manager approval phù hợp.
- [ ] Supervisor override ghi cả operator actor và approving supervisor; không thay thế actor gốc.
- [ ] Người nhập dữ liệu nhạy cảm không tự phê duyệt khi maker-checker policy bật.
- [ ] Manager không thể sửa/quản lý user group cao hơn hoặc ngoài scope được giao.
- [ ] Step-up/MFA có thể được yêu cầu theo risk/amount/action.
- [ ] Permission checks nằm ở backend của booking/payment/POS service; auth/user chỉ cung cấp identity/authorization facts.

### `EMP-05` — Coordinated offboarding and immutable history (`P0`, `Gap`)

`DELETE /api/employees/{id}` hiện chỉ set employee `DISABLED`; auth account/token vẫn có thể ACTIVE. User soft-delete cũng không khóa auth account.

- [ ] Offboarding command cập nhật employee status và auth account state theo workflow đáng tin cậy.
- [ ] Revoke toàn active sessions/refresh families ngay khi termination/suspension có hiệu lực.
- [ ] Xóa site assignment, POS access, privileged groups và pending invites.
- [ ] Không hard-delete staff đã từng login/thực hiện transaction; giữ stable actor ID cho booking/payment/audit history.
- [ ] Rehire/reactivate là command riêng, không tự phục hồi role/site/session cũ.
- [ ] Support immediate termination và scheduled last-working-day.
- [ ] Offboarding failure giữa services có retry/reconciliation/alert.

### `EMP-06` — Employee lifecycle and assignment history (`P1`, `Partial`)

- [x] Có position, department, employment type, hire date và status ACTIVE/DISABLED.
- [ ] Bổ sung lifecycle phù hợp: INVITED, ACTIVE, SUSPENDED/ON_LEAVE, TERMINATED/INACTIVE theo scope thực tế.
- [ ] Có termination/effective dates, reason code và actor; không overwrite lịch sử.
- [ ] Cinema/site assignment có start/end/effective time và transfer history.
- [ ] Position/department change có history thay vì chỉ update row hiện tại.
- [ ] Future-dated change chỉ tác động authorization đúng thời điểm.
- [ ] Employee code không tái sử dụng cho người khác.

### `EMP-07` — Validate cinema assignment (`P0`, `Gap`)

`cinemaId` hiện chỉ là string tối đa 36 ký tự, không xác nhận cluster tồn tại/ACTIVE.

- [ ] Dùng canonical `cinemaClusterId`/site ID và contract rõ với movie-service/master-data owner.
- [ ] Chỉ assign employee vào cluster/site tồn tại và được phép vận hành.
- [ ] Manager chỉ assign vào site trong scope của họ.
- [ ] Cinema inactive/closed không nhận assignment mới.
- [ ] Không dùng cross-service database FK; dùng API/event/cache + reconciliation phù hợp.
- [ ] Rename/delete/merge cluster không làm mất historical employee/transaction reference.

### `API-01` — Stable self/admin contracts (`P1`, `Partial`)

- [ ] Tách self endpoints và admin collection endpoints rõ ràng.
- [ ] Create trả 201; validation 400; unauthenticated 401; forbidden 403; not found 404; conflict 409; rate limit 429.
- [ ] Error envelope có stable code, field errors, correlation ID, timestamp và path.
- [ ] List accounts/users/employees có page/size max, filter/sort allowlist và no unbounded `findAll()`.
- [ ] Self DTO, employee directory DTO và HR/admin DTO không dùng chung toàn bộ fields.
- [ ] API contract/OpenAPI/Postman cập nhật cùng code và security matrix.

### `OPS-01` — Operational security and reconciliation (`P1`, `Partial`)

- [ ] Metrics: login failure/lock, OTP issue/verify failure, refresh replay, activation delivery failure, active privileged sessions.
- [ ] Metrics: orphan account, missing profile, employee-role mismatch, DLT count và offboarding failure.
- [ ] Alerts có threshold/runbook; không log payload PII để “debug”.
- [ ] Admin support view cho invite/provisioning status và session revocation có audit.
- [ ] Clock/timezone được inject cho expiry/effective-date tests.

### `TEST-01` — Required regression and security suite (`P0`, `Gap`)

- [ ] Auth build/startup trên fresh và upgraded PostgreSQL schema.
- [ ] Registration OTP happy path, wrong-attempt limit, resend quota, expiry và concurrent verify.
- [ ] Invite/activation single-use, token hashing, resend, delivery failure và concurrent consume.
- [ ] Login brute-force/rate-limit/lock concurrency tests.
- [ ] Access/refresh rotation, replay, logout, logout-all, password/role/status revocation tests.
- [ ] Authorization matrix tests cho account/role/permission/user/employee endpoints.
- [ ] Horizontal IDOR tests: MEMBER A không đọc/sửa MEMBER B.
- [ ] PII response/log/DLT redaction tests.
- [ ] Employee provisioning idempotency, Kafka failure, DLT/replay và reconciliation tests.
- [ ] Site-scope tests: manager site A không quản lý staff/site B.
- [ ] Offboarding immediately blocks POS/API session nhưng transaction history vẫn resolve actor.
- [ ] Testcontainers/real Redis/Kafka integration được dùng cho behavior không thể chứng minh bằng mock.

---

## 5. Business Rules đặc thù doanh nghiệp rạp chiếu

### Identity và access

- [ ] Mỗi staff cần login riêng để mọi counter sale, booking change, refund và override truy được đúng người.
- [ ] Access dựa trên user group/permission và site scope, không chỉ `EMPLOYEE` toàn cục.
- [ ] POS operator dùng least privilege; supervisor/manager là approver cho action nhạy cảm.
- [ ] Head Office, cinema manager, supervisor và POS operator có hierarchy; cấp dưới không sửa account cấp trên.
- [ ] Workstation/session/shift context không thay thế user identity; shared account không được chấp nhận.

### Employee lifecycle

- [ ] Invite → activate → assign site/group → enable POS là các bước có trạng thái và audit.
- [ ] Transfer/leave/suspension/termination tác động permission theo effective time.
- [ ] Staff đã từng thao tác không bị hard-delete vì transaction/audit cần giữ actor.
- [ ] Rehire không tự động khôi phục quyền cũ; phải review lại group/site assignment.

### Customer identity

- [ ] Customer account phục vụ booking/loyalty không mặc định là hồ sơ định danh đầy đủ.
- [ ] DOB/age evidence chỉ thu thập khi có purpose; kiểm tra rating tại booking/admission không đồng nghĩa phải lưu CCCD cho mọi customer.
- [ ] Customer có quyền tự quản profile/session và không thấy dữ liệu/account người khác.
- [ ] Employee directory/HR PII tách khỏi customer-facing API.

### High-risk operations

- [ ] Refund, void, complimentary, manual discount/price override và cash adjustment có permission/approval/audit riêng.
- [ ] Audit giữ operator + approver + cinema + workstation + business date + correlation ID.
- [ ] Role/permission change, PII export và offboarding là privileged actions cần reauthentication/MFA theo risk.

---

## 6. Những rule hiện đã có và cần giữ bằng regression test

- [x] Password được BCrypt hash; admin invite không thu password nhân viên.
- [x] Account admin-created bắt đầu `PENDING`; activation link single-use ở mức service logic.
- [x] Public registration có Redis pending state, OTP TTL, resend cooldown và email verification trước ACTIVE.
- [x] Login có account status check, failed-attempt counter, temporary lock và last-login time.
- [x] JWT có expiry, JTI và server-side revoked-token lookup.
- [x] Logout/current-token revocation và token cleanup scheduler đã có nền tảng.
- [x] Auth audit có actor/target/action/status/IP/user-agent.
- [x] User profile event consumer idempotent cơ bản; retry + DLT đã cấu hình.
- [x] Employee `account_id` và `employee_code` có unique constraint trong entity/schema intent.
- [x] Employee delete hiện là soft-disable, không hard-delete row.
- [x] CCCD được mask trong current user/employee response mapper.

> `[x]` chỉ là baseline đã có, không có nghĩa luồng liên quan đã production-ready.

---

## 7. Thứ tự thực hiện đề xuất

### Phase A — Khôi phục build và đóng lỗ hổng đang hoạt động

1. `BUILD-01`
2. `CFG-01` + `DB-01`
3. `AUTHZ-01` + `AUTHZ-02` + `AUTHZ-03` + `AUTHZ-04`
4. `ENUM-01` + `PROF-01` + `PROF-02`

### Phase B — Bảo vệ session, OTP và provisioning

5. `OTP-01` + `ACT-01`
6. `SESS-01` + `SESS-02` + `AUTHN-01`
7. `ACCT-01` + `EVENT-01` + `EMP-01`

### Phase C — Đúng nghiệp vụ nhân viên rạp và bảo vệ PII

8. `EMP-02` + `EMP-03` + `EMP-07`
9. `EMP-04` + `EMP-05`
10. `PII-01` + `PII-02` + `AUD-01`

### Phase D — Production readiness

11. `AUTHN-02` + `PASS-01`
12. `EMP-06` + `PII-03` + `API-01` + `OPS-01`
13. Hoàn tất `TEST-01`; thực tế test phải được viết tăng dần từ Phase A.

---

## 8. Definition of Done cho Auth/User modules

- [ ] Cả hai service compile, startup và chạy migration trên fresh/upgraded DB.
- [ ] Không còn hard-coded active secret hoặc default privileged credential.
- [ ] MEMBER không thể list/sửa account, role, permission, user hoặc employee khác.
- [ ] Employee/manager chỉ truy cập dữ liệu/action trong permission và cinema scope.
- [ ] Disable/offboard nhân viên revoke session ngay nhưng giữ actor history.
- [ ] Access/refresh session có rotation/replay handling và revoke-on-risk-event.
- [ ] OTP/invite không brute-force được và token không lưu raw.
- [ ] Customer không bị bắt cung cấp CCCD nếu không có purpose bắt buộc rõ.
- [ ] PII không xuất hiện raw trong response thường, log, audit payload hoặc DLT.
- [ ] Account/profile/employee provisioning retry được, không orphan và có reconciliation.
- [ ] Security/integration/concurrency tests chạy trong CI.
- [ ] Demo dùng ADMIN, EMPLOYEE/POS và MEMBER thật; không dùng shared/mocked identity để che authorization gap.

---

## 9. Nguồn tham khảo hiện hành

- [NIST SP 800-63B — Digital Identity Guidelines](https://pages.nist.gov/800-63-4/sp800-63b.html): password, MFA, phishing resistance và session assurance.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): login throttling, reauthentication và MFA.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): session/token lifecycle.
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): reset flow, single-use token và notification.
- [RFC 9700 — OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html): refresh-token protection, rotation và replay detection.
- [Vista — Creating POS users](https://help.vista.co/hc/en-nz/articles/12121659344281-Creating-POS-users): POS user group và minimum-security permissions.
- [Vista — User groups in Head Office and Cinema Manager](https://help.vista.co/hc/en-nz/articles/11820637012249-User-groups-in-Head-Office-and-Cinema-Manager): group-based module/report/application rights.
- [Vista — Users](https://help.vista.co/hc/en-nz/articles/12547477213465-Users): user inactive thay vì delete sau khi đã login để giữ transaction identity.
- [Vista — User group form](https://help.vista.co/hc/en-nz/articles/4415783048473-User-group-form-Form-Launcher): security hierarchy, cinema scope và supervisor-level permissions.
- [Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://xaydungchinhsach.chinhphu.vn/luat-bao-ve-du-lieu-ca-nhan.html): có hiệu lực từ 2026-01-01; checklist áp dụng nguyên tắc purpose, minimization, access và lifecycle ở mức kỹ thuật, không phải tư vấn pháp lý.

## 10. Ngoài scope trước khi P0 ổn định

- Workforce scheduling/timekeeping/payroll đầy đủ.
- Enterprise SSO federation/SAML cho Head Office nếu chưa có nhu cầu thật.
- Behavioral risk engine/AI fraud scoring.
- Biometric staff authentication.
- Customer social login/identity linking phức tạp.
- Fine-grained ABAC engine riêng nếu RBAC + cinema scope đã đủ cho MVP.
