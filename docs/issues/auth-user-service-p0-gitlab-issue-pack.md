# Auth & User Service P0 — GitLab Issue Pack

> Format source: `docs/issues/ISSUE_TEMPLATE.md`  
> Scope source: `docs/issues/auth-user-service-industry-readiness-checklist.md`.  
> Baseline: source và Sprint board được đối chiếu ngày **2026-07-15**.  
> Cách dùng: copy từng **Title**, **Labels** và issue body vào GitLab. Issue mới giữ `Open`; assignee tự kéo sang `In Progress` khi thực sự bắt đầu.

## 1. Danh sách tạo mới và cập nhật issue hiện có

> Các số `#154–#161` dựa trên board screenshot đã cung cấp. Kiểm tra title trên GitLab trước khi edit vì file `account-employee-authz-issues.md` cũ từng bị lệch số issue.

| Thứ tự | P0 ID | GitLab action | Size | Phụ thuộc |
|---:|---|---|---|---|
| 1 | `BUILD-01` | Create new | S | Không |
| 2 | `CFG-01` | Create new | S | Không |
| 3 | `DB-01` | Create new | M | `BUILD-01` |
| 4 | `AUTHZ-03` | Update `#154` | M | `AUTHZ-04` |
| 5 | `AUTHZ-01` | Update `#155` | S | `AUTHZ-04` |
| 6 | `AUTHZ-02` | Create new | M | `AUTHZ-04` |
| 7 | `AUTHZ-04` | Create new | M | `BUILD-01`, `CFG-01` |
| 8 | `ENUM-01` | Create new | S | `AUTHZ-03` |
| 9 | `PROF-01` | Create new | M | `AUTHZ-03` |
| 10 | `PROF-02` | Create new | M | `PROF-01`, `EVENT-01` |
| 11 | `AUTHN-01` | Create new | M | `DB-01` |
| 12 | `AUTHN-02` | Create new | L | `AUTHZ-04` |
| 13 | `OTP-01` | Create new | M | `AUTHN-01` |
| 14 | `ACT-01` | Create follow-up; link `#159`, `#160` | M | `CFG-01`, `EVENT-01` |
| 15 | `SESS-01` | Create new | L | `AUTHZ-04`, `DB-01` |
| 16 | `SESS-02` | Create new | M | `SESS-01`, `ACCT-01` |
| 17 | `ACCT-01` | Create follow-up; link `#156` | M | `AUTHZ-01` |
| 18 | `EVENT-01` | Create follow-up; link `#158` | L | `DB-01` |
| 19 | `AUD-01` | Create new | M | `AUTHZ-04` |
| 20 | `PII-01` | Create new | M | `PROF-01`; related `#161` |
| 21 | `PII-02` | Create new | L | `PII-01`, `AUD-01` |
| 22 | `EMP-01` | Create follow-up; link `#157`, `#158`, `#159` | L | `EVENT-01`, `ACCT-01` |
| 23 | `EMP-02` | Create new | M | `EMP-01` |
| 24 | `EMP-03` | Create new | L | `AUTHZ-02`, `EMP-07` |
| 25 | `EMP-04` | Create new | L | `AUTHN-02`, `EMP-03` |
| 26 | `EMP-05` | Create new | L | `SESS-02`, `EMP-01` |
| 27 | `EMP-07` | Create new | M | Movie-service cluster contract |
| 28 | `TEST-01` | Create new; implement incrementally | L | Tất cả P0 |

---

# P0-01 / BUILD-01 — [Backend] Fix auth-service compilation failure

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Khôi phục build xanh cho auth-service. Compile hiện thất bại tại `AuthEventPublisher.java` vì reference `GGlobalErrorCode` không tồn tại, làm chặn toàn bộ test và deployment của auth/user flow.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Thay typo bằng error code hợp lệ và import đúng.
- [ ] `mvnw.cmd -pl auth-service,user-service -am test -DskipTests` pass.
- [ ] Review MapStruct/compiler warnings; intentional ignores được khai báo explicit.
- [ ] Không sửa business flow ngoài phạm vi cần thiết để restore build.
- [ ] CI có compile gate cho tất cả modules bị ảnh hưởng.

---

## Technical Notes / Constraints

- Failure đã reproduce tại `authservice.messaging.AuthEventPublisher:60`.
- Compile success chưa thay thế startup/schema verification; phần đó thuộc `DB-01`.

---

## Related

- Branch: `fix/auth-event-publisher-compile`
- Depends on: không có
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

# P0-21 / PII-02 — [Backend] Encrypt and restrict personal data in user-service

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Bảo vệ phone, CCCD và dữ liệu hồ sơ nhạy cảm theo nguyên tắc least privilege. Không trả raw PII trong API thông thường, log, audit payload hoặc dead-letter message.

---

## Estimate

- [x] L (> 4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] CCCD và các trường nhạy cảm được mã hóa at rest bằng key nằm ngoài source code/database.
- [ ] Phone/CCCD được normalize trước khi kiểm tra uniqueness; nếu cần tìm kiếm, dùng blind index hoặc cơ chế tương đương.
- [ ] DTO mặc định chỉ trả dữ liệu đã mask; không serialize entity trực tiếp.
- [ ] Chỉ permission HR/ADMIN được phép xem dữ liệu đầy đủ và phải cung cấp reason code.
- [ ] Thao tác unmask yêu cầu step-up authentication và được audit theo actor, subject, purpose, timestamp.
- [ ] Application log, audit log, Kafka payload lỗi và DLT không chứa raw password, token, OTP hoặc CCCD.
- [ ] Avatar upload kiểm tra MIME bằng file signature, giới hạn kích thước và loại bỏ metadata không cần thiết.
- [ ] Có migration/backfill an toàn và test chứng minh dữ liệu cũ vẫn đọc được trong giai đoạn chuyển đổi.

---

## Technical Notes / Constraints

- Không dùng reversible encryption key được hard-code trong application properties.
- Tách permission `USER_PII_READ` khỏi quyền xem/sửa hồ sơ thông thường.
- Thiết kế key rotation trước khi migrate production data.

---

## Related

- Branch: `feat/protect-user-personal-data`
- Depends on: `PII-01`, `AUD-01`, `AUTHN-02`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

# P0-22 / EMP-01 — [Backend] Orchestrate employee provisioning across auth and user services

**GitLab action:** Create follow-up; link `#157`, `#158`, `#159`  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay luồng tạo nhân viên phụ thuộc polling/sleep bằng provisioning workflow có trạng thái, idempotency và recovery rõ ràng giữa auth-service, user-service và notification-service.

---

## Estimate

- [x] L (> 4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Mỗi yêu cầu có `provisioningId`/idempotency key duy nhất.
- [ ] Workflow có tối thiểu các trạng thái `INVITED`, `PROFILE_PENDING`, `ACTIVE`, `FAILED`.
- [ ] Chỉ account có role/permission nhân viên hợp lệ mới được liên kết với Employee profile.
- [ ] Không dùng `Thread.sleep`, fixed polling hoặc giả định Kafka sẽ hoàn tất trong một khoảng thời gian cố định.
- [ ] Retry cùng idempotency key không tạo trùng account, user hoặc employee.
- [ ] Failure giữa các bước được lưu trạng thái, retry/reconcile được và không trả thành công giả.
- [ ] API/UI hiển thị trạng thái provisioning thay vì chỉ trả lỗi timeout chung chung.
- [ ] Có reconciliation job và integration tests cho duplicate event, out-of-order event và notification failure.

---

## API / Contract Changes

- `POST /api/employee-provisioning` trả `202 Accepted` cùng `provisioningId` khi xử lý bất đồng bộ.
- `GET /api/employee-provisioning/{id}` trả trạng thái và lỗi đã sanitize.
- Event contract có `eventId`, `correlationId`, `occurredAt`, `schemaVersion`.

---

## Technical Notes / Constraints

- Có thể triển khai saga/process manager hoặc state machine nhẹ; không dùng distributed transaction.
- Producer nên dùng transactional outbox; consumer lưu processed event ID.

---

## Related

- Branch: `feat/employee-provisioning-workflow`
- Follow-up to: `#157`, `#158`, `#159`
- Depends on: `EVENT-01`, `ACT-01`, `AUTHZ-02`

# P0-23 / EMP-02 — [Backend] Enforce one identity per cinema employee and POS operator

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Đảm bảo mỗi nhân viên/POS operator sử dụng định danh cá nhân riêng. Không cho dùng chung account hoặc PIN vì mọi giao dịch bán vé, hủy vé, hoàn tiền và override phải truy vết đúng người thao tác.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Một active Employee profile chỉ liên kết một account và một account không liên kết nhiều Employee profile.
- [ ] Database có unique constraint tương ứng; service xử lý conflict thành business error rõ ràng.
- [ ] POS login/session luôn mang `actorAccountId`, `employeeId`, `cinemaClusterId` và workstation context phù hợp.
- [ ] Không có default/shared operator account trong seed hoặc production configuration.
- [ ] Mọi privileged operation lưu actor identity; không nhận actor ID từ request body làm nguồn tin cậy.
- [ ] Quy tắc CUSTOMER đồng thời là EMPLOYEE được document rõ và không tạo hai identity độc lập không liên kết.
- [ ] Tests cover duplicate link, concurrent provisioning và disabled employee login.

---

## Technical Notes / Constraints

- Phân biệt person identity, login account và employment record; không gộp chúng chỉ vì đang quan hệ one-to-one.
- Workstation/session context phải được server xác nhận, không chỉ dựa vào header do client tự gửi.

---

## Related

- Branch: `feat/employee-identity-integrity`
- Depends on: `EMP-01`, `SESS-01`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

# P0-24 / EMP-03 — [Backend] Scope employee permissions by user group and cinema

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay RBAC chỉ dựa trên role tổng quát bằng authorization có permission và cinema scope. Nhân viên tại một cụm rạp không được mặc nhiên đọc hoặc thao tác dữ liệu của cụm khác.

---

## Estimate

- [x] L (> 4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có user groups/roles nghiệp vụ tối thiểu như POS operator, supervisor, cinema manager và head-office administrator.
- [ ] Permission được định nghĩa theo hành động, không chỉ theo tên màn hình hoặc chức danh.
- [ ] Employee assignment chứa site/cinema scope có thời hạn hiệu lực khi cần.
- [ ] API kiểm tra cả permission và object scope; không chỉ ẩn menu ở frontend.
- [ ] Quyền cross-cinema chỉ cấp cho group được định nghĩa rõ và được audit.
- [ ] Job title/department không tự động trở thành security authority nếu chưa có mapping được duyệt.
- [ ] Transfer giữa các cụm rạp làm mất scope cũ và revoke/refresh session phù hợp.
- [ ] Tests cover same-site allow, cross-site deny, head-office allow và stale-token denial.

---

## API / Contract Changes

- JWT/session chỉ chứa stable identity và các claim cần thiết; cinema assignment thay đổi phải có cơ chế invalidation/versioning.
- Error response phân biệt `403 Forbidden` với resource không tồn tại mà không làm lộ dữ liệu ngoài scope.

---

## Technical Notes / Constraints

- Áp dụng method-level authorization và object authorization tại service boundary.
- Không tin `cinemaId` client gửi nếu không đối chiếu với assignment của principal.

---

## Related

- Branch: `feat/cinema-scoped-employee-access`
- Depends on: `AUTHZ-02`, `AUTHZ-03`, `EMP-07`, `SESS-02`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

# P0-25 / EMP-04 — [Backend] Add supervisor approval for privileged cinema operations

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Cung cấp authorization facts và approval control cho các thao tác nhạy cảm tại rạp như hoàn/hủy vé, void giao dịch, vé miễn phí, điều chỉnh tiền mặt hoặc override giá. Operator không được tự phê duyệt thao tác do chính mình khởi tạo.

---

## Estimate

- [x] L (> 4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Mỗi privileged action được ánh xạ tới permission riêng và ngưỡng cần supervisor approval.
- [ ] Hệ thống lưu riêng operator, approver, cinema, workstation, reason code và timestamp.
- [ ] Maker và checker phải là hai identity khác nhau đối với action được cấu hình segregation of duties.
- [ ] Approver phải có permission, đúng cinema scope và cấp bậc phù hợp tại thời điểm phê duyệt.
- [ ] Approval yêu cầu step-up authentication; không chấp nhận supervisor PIN dùng chung.
- [ ] Auth/user service cung cấp decision/facts nhất quán để booking/payment/POS service enforce tại server side.
- [ ] Audit record không bị thay đổi khi nhân viên đổi tên, chuyển rạp hoặc nghỉ việc.
- [ ] Tests cover self-approval deny, insufficient hierarchy, wrong cinema, expired approval và replay.

---

## Technical Notes / Constraints

- Business transaction thuộc booking/payment service; auth/user service sở hữu identity, permission, assignment và approval assurance.
- Approval token nếu có phải one-time, scope theo action/resource và có TTL ngắn.

---

## Related

- Branch: `feat/supervisor-operation-approval`
- Depends on: `AUTHN-02`, `EMP-03`, `AUD-01`
- Cross-service: booking-service, payment-service/POS

# P0-26 / EMP-05 — [Backend] Coordinate employee offboarding and session revocation

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Biến việc disable nhân viên thành workflow thu hồi quyền end-to-end. Chỉ cập nhật Employee status tại user-service là chưa đủ nếu auth account, refresh session, invitation và cinema scope vẫn còn hiệu lực.

---

## Estimate

- [x] L (> 4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Offboarding hỗ trợ effective time và có trạng thái workflow quan sát được.
- [ ] Khi hiệu lực, Employee chuyển inactive/terminated và auth account bị disable hoặc bỏ employee access theo policy.
- [ ] Tất cả access/refresh sessions của employee bị revoke; request dùng token cũ bị từ chối.
- [ ] Cinema assignments, pending invitations và privileged approvals chưa dùng bị thu hồi.
- [ ] Historical booking/POS/audit records vẫn giữ immutable actor reference và display snapshot cần thiết.
- [ ] Rehire không âm thầm khôi phục session/quyền cũ; phải qua explicit reprovisioning policy.
- [ ] Failure ở một service được retry/reconcile; không báo hoàn tất khi mới cập nhật một phía.
- [ ] Tests cover immediate/scheduled offboarding, retry, concurrent login và rehire.

---

## API / Contract Changes

- Dùng command có reason/effectiveAt thay cho generic update status.
- Trả workflow ID/status nếu xử lý bất đồng bộ.

---

## Technical Notes / Constraints

- Workflow phải idempotent và audit được.
- Không hard-delete employee/account để bảo toàn traceability giao dịch.

---

## Related

- Branch: `fix/coordinated-employee-offboarding`
- Depends on: `SESS-02`, `EVENT-01`, `EMP-03`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

# P0-27 / EMP-07 — [Backend] Validate employee cinema-cluster assignments

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Không lưu `cinemaId` dạng chuỗi tùy ý. Mọi employee assignment phải tham chiếu một cinema cluster tồn tại, đang hoạt động và nằm trong scope quản lý của người thực hiện.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Assignment dùng canonical `cinemaClusterId` với type/format thống nhất trong API, DB và event.
- [ ] Khi tạo/chuyển assignment, server xác minh cluster tồn tại và `ACTIVE` qua contract được định nghĩa.
- [ ] Người gán phải có management scope đối với cluster đích.
- [ ] Không cho tạo assignment mới vào cluster inactive/deleted; response dùng business error rõ ràng.
- [ ] Cluster rename không phá liên kết; cluster inactive không làm mất historical assignment.
- [ ] Không tạo foreign key xuyên database/microservice.
- [ ] Có cache/event projection hoặc synchronous validation với timeout/failure policy rõ ràng.
- [ ] Tests cover invalid ID, inactive cluster, unauthorized manager, service timeout và rename.

---

## API / Contract Changes

- Đổi field mơ hồ `cinemaId` thành `cinemaClusterId` trong request/response/event mới.
- Nếu cần tương thích ngược, document deprecation và thời hạn loại bỏ field cũ.

---

## Technical Notes / Constraints

- movie-service/cinema domain vẫn là source of truth của cluster.
- user-service chỉ lưu assignment/reference và snapshot tối thiểu cần thiết.

---

## Related

- Branch: `fix/validate-employee-cinema-assignment`
- Depends on: cinema-cluster contract, `EMP-03`
- Cross-service: movie-service

# P0-28 / TEST-01 — [Backend] Add auth and user-service P0 regression suite

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::High`

## Summary / Objective

Tạo regression/security suite làm quality gate cho toàn bộ P0. Compile thành công chưa đủ để chứng minh auth-service và user-service chạy đúng với database, Redis, Kafka và authorization thật.

---

## Estimate

- [x] L (> 4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] CI build/compile cả auth-service và user-service từ clean checkout.
- [ ] Startup test chạy với fresh schema và upgrade từ schema hiện tại bằng migration thực.
- [ ] Tests cover registration OTP, invite activation, login throttling, MFA/step-up và generic error responses.
- [ ] Tests cover refresh rotation/replay, logout, password/role/status session revocation.
- [ ] Tests cover endpoint/object authorization, IDOR, cross-cinema access và supervisor approval.
- [ ] Tests chứng minh raw password/token/OTP/CCCD không xuất hiện trong response, log, audit event hoặc DLT fixture.
- [ ] Integration tests cover employee provisioning, duplicate/out-of-order event, reconciliation và offboarding.
- [ ] Test dependencies dùng isolated containers/fixtures; không phụ thuộc database hoặc account cá nhân của developer.
- [ ] CI publish test report và fail khi P0 security regression xảy ra.

---

## Technical Notes / Constraints

- Ưu tiên Testcontainers cho PostgreSQL/Redis/Kafka hoặc environment tương đương có lifecycle do test quản lý.
- Tách unit, slice, integration và contract tests để thời gian CI kiểm soát được.
- Không dùng `-DskipTests` làm tiêu chí đóng issue này.

---

## Related

- Branch: `test/auth-user-p0-regression-suite`
- Depends on: các issue P0 chức năng liên quan
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

---

# P0-02 / CFG-01 — [Infra] Externalize auth and user-service secrets

**GitLab action:** Create new  
**Labels:** `Layer::Infrastructure`, `Type::Bug`, `Priority::High`

## Summary / Objective

Loại bỏ active/default credentials khỏi source configuration của auth-service và user-service. Production không được fallback sang JWT key mẫu, `admin/admin`, database password `123456` hoặc Cloudinary credentials đã commit.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] JWT, DB, Cloudinary và bootstrap-admin credentials chỉ đọc từ environment/secret store.
- [ ] Rotate toàn bộ credential từng xuất hiện trong repository.
- [ ] Production profile fail-fast khi thiếu secret; local defaults không hoạt động ở production.
- [ ] Bootstrap admin dùng one-time setup hoặc bắt buộc đổi password trước nghiệp vụ.
- [ ] `.env.example` không chứa giá trị thật.
- [ ] CI secret scan không phát hiện active secret mới.

---

## Technical Notes / Constraints

- Không paste giá trị secret vào issue/MR/Postman environment được commit.
- JWT key rotation phải phối hợp `AUTHZ-04`; không đổi key đột ngột làm mọi resource service ngừng verify.

---

## Related

- Branch: `fix/externalize-auth-user-secrets`
- Depends on: không có
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

---

# P0-03 / DB-01 — [Database] Add versioned migrations for auth and user databases

**GitLab action:** Create new  
**Labels:** `Layer::Database`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay `ddl-auto=update` bằng versioned migrations và schema validation. Fresh database và database hiện hữu phải đạt cùng schema cho account/token/audit/user/employee mà không phụ thuộc Hibernate tự sửa bảng.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Cấu hình Flyway/Liquibase cho `auth_db` và `user_db`.
- [ ] Production dùng `ddl-auto=validate`/`none`, không `update`.
- [ ] Đồng bộ `auth_token.account_id`; loại bỏ schema join-table cũ nếu không còn dùng.
- [ ] Migration gồm `failed_login_attempts`, status string, `profile_completed`, unique account/employee/phone/identity constraints và indexes.
- [ ] Fresh DB và upgraded populated DB startup thành công, không mất ID/history.
- [ ] Seed role/permission idempotent nhưng không overwrite production configuration ngoài ý muốn.
- [ ] CI chạy integration suite trên cả fresh và upgrade path.

---

## Technical Notes / Constraints

- Migration forward-only; không sửa file version đã chạy trên shared environment.
- Tách reference seed khỏi migration dữ liệu nghiệp vụ.

---

## Related

- Branch: `feat/auth-user-runtime-migrations`
- Depends on: `BUILD-01`
- Docs: `docs/database/auth-service/`, `docs/database/user-service/`

---

# P0-04 / AUTHZ-03 — [Backend] Enforce user-service endpoint and object authorization

**GitLab action:** Update existing issue `#154`  
**Labels:** giữ `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Bật method security và chặn horizontal/vertical privilege escalation trong user-service. Customer chỉ được thao tác profile của chính mình; employee/admin/manager chỉ được truy cập theo permission và scope.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Thêm `@EnableMethodSecurity` và authority converter canonical.
- [ ] MEMBER A không thể GET/PUT/DELETE/avatar cho account B.
- [ ] MEMBER/EMPLOYEE thường không thể list toàn bộ users/employees.
- [ ] Employee CRUD yêu cầu permission cụ thể; không chỉ `authenticated()`.
- [ ] Cinema manager bị giới hạn staff/cinema scope và không sửa cấp cao hơn.
- [ ] List/detail dùng DTO theo quyền, không trả PII không cần thiết.
- [ ] Tests cover MEMBER, EMPLOYEE, MANAGER/ADMIN và direct-ID enumeration.

---

## API Specifications (if applicable)

| Resource | Self | Employee | Admin/HR |
|---|---|---|---|
| `/api/users/me` | Read/update | Own profile | Read/update by permission |
| `/api/users` | Deny | Deny/read-limited | Paginated management |
| `/api/employees` | Deny | Own/assigned scope | Manage by permission |

---

## Technical Notes / Constraints

- Authorization phải kiểm tra cả action và object/scope, không chỉ role ở controller.
- Phụ thuộc `AUTHZ-04` để JWT authorities không bị `ROLE_ROLE_ADMIN`.

---

## Related

- Branch: giữ branch của `#154`
- Depends on: `AUTHZ-04`
- Docs: `docs/api-specs/user-service/API_CONTRACT.md`

---

# P0-05 / AUTHZ-01 — [Backend] Restrict auth account management endpoints

**GitLab action:** Update existing issue `#155`  
**Labels:** giữ `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Chặn MEMBER/EMPLOYEE xem danh sách account hoặc đổi email/password/roles/status của account khác. Self-service phải đi qua endpoint/command giới hạn thay vì dùng admin update DTO.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `GET /api/accounts` chỉ security admin/permission tương ứng.
- [ ] `GET /api/accounts/{id}` chỉ admin hoặc self theo DTO an toàn.
- [ ] `PUT /api/accounts/{id}` không cho non-admin đổi account khác/roles/status.
- [ ] `/api/accounts/my-info` vẫn dùng được cho mọi authenticated role.
- [ ] Matcher cụ thể đứng trước wildcard matcher.
- [ ] Role/status/password change được audit và trigger session revocation theo `SESS-02`.
- [ ] Security tests cover self, other-account và admin paths.

---

## Technical Notes / Constraints

- Không chỉ ẩn button ở frontend.
- Dài hạn tách `PUT` tổng quát thành command riêng trong `ACCT-01`.

---

## Related

- Branch: giữ branch của `#155`
- Depends on: `AUTHZ-04`
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md`

---

# P0-06 / AUTHZ-02 — [Backend] Restrict role and permission administration

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Bảo vệ `/api/roles` và `/api/permissions`, hiện chỉ yêu cầu đăng nhập. Chỉ security admin được thay đổi quyền; manager site không được quản lý role cao hơn hoặc ngoài scope.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] GET/POST/DELETE role/permission yêu cầu permission quản trị phù hợp.
- [ ] Không user nào cấp role cao hơn role/group họ được phép quản lý.
- [ ] Không xóa permission đang được sử dụng; deprecate/inactive theo policy.
- [ ] Role assignment có actor, target, before/after, reason và correlation ID.
- [ ] Cấp/revoke quyền đặc biệt yêu cầu step-up hoặc approval theo policy.
- [ ] MEMBER/EMPLOYEE gọi mutation nhận 403.
- [ ] Tests cover hierarchy và last-admin protection.

---

## Technical Notes / Constraints

- Startup seed không được âm thầm khôi phục permission đã bị admin revoke.
- Permission names phải canonical giữa JWT và resource services.

---

## Related

- Branch: `fix/role-permission-administration-authz`
- Depends on: `AUTHZ-04`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

---

# P0-07 / AUTHZ-04 — [Backend] Standardize JWT trust and authority mapping

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Chuẩn hóa JWT claims và authority conversion trên mọi resource service. User-service hiện thêm prefix `ROLE_` vào `scope` vốn đã chứa `ROLE_ADMIN`, dẫn tới authority sai và làm security rules không đáng tin cậy.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chốt claim contract cho roles/permissions/scopes và dùng chung converter.
- [ ] Token ADMIN tạo chính xác `ROLE_ADMIN`, không `ROLE_ROLE_ADMIN`.
- [ ] Permission `EMPLOYEE_READ` không bị đổi thành authority ngoài contract.
- [ ] Validate signature, expiry, issuer và audience ở mọi resource service.
- [ ] Production có asymmetric signing/JWKS hoặc documented secure key-rotation plan.
- [ ] Gateway không phải authorization layer duy nhất.
- [ ] Contract test cùng token trên auth/user/movie/booking services.

---

## Technical Notes / Constraints

- Có thể đặt converter/claim constants trong `common` nhưng không đưa business authorization vào shared utility mơ hồ.
- Rollout phải backward-compatible hoặc coordinated để không làm toàn hệ thống 401/403 cùng lúc.

---

## Related

- Branch: `fix/canonical-jwt-authority-mapping`
- Depends on: `BUILD-01`, `CFG-01`
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md`

---

# P0-08 / ENUM-01 — [Backend] Remove public phone and identity-card enumeration

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Đóng public `GET /api/users/check-existence`, hiện cho phép kiểm tra phone/CCCD có trong hệ thống và truyền PII qua query string. Uniqueness vẫn phải được enforce server-side/database mà không lộ record cho anonymous caller.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Anonymous/customer không nhận boolean tồn tại của phone/CCCD bất kỳ.
- [ ] CCCD/phone không còn truyền trong URL query/access log.
- [ ] Nếu cần internal lookup, yêu cầu service credential/authorized permission và POST body phù hợp.
- [ ] Registration/update trả response trung tính, DB unique constraint là lớp cuối.
- [ ] Rate limit và audit lookup bất thường.
- [ ] Frontend không phụ thuộc pre-check để đảm bảo uniqueness.

---

## Related

- Branch: `fix/remove-public-pii-enumeration`
- Depends on: `AUTHZ-03`
- Docs: `docs/api-specs/user-service/API_CONTRACT.md`

---

# P0-09 / PROF-01 — [Backend] Add canonical self-profile APIs

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tạo self-profile contract lấy `accountId` từ verified JWT thay vì tin path ID từ client. Tách self DTO khỏi admin/HR DTO để giảm IDOR và lộ PII.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `GET /api/users/me` trả profile của JWT principal.
- [ ] `PATCH/PUT /api/users/me` chỉ cập nhật self-profile fields được phép.
- [ ] Self không sửa email auth, role, account status, employee assignment hoặc raw PII restricted fields.
- [ ] Inactive account/profile không tiếp tục dùng self APIs.
- [ ] Admin endpoints dùng namespace/DTO/permission riêng.
- [ ] Identity card luôn masked; unmask là privileged audited action nếu thật sự cần.
- [ ] Tests chứng minh thay path/body ID không đổi target account.

---

## API Specifications (if applicable)

| Method | Endpoint | Auth |
|---|---|---|
| `GET` | `/api/users/me` | Authenticated self |
| `PATCH` | `/api/users/me` | Authenticated self |

---

## Technical Notes / Constraints

- Có thể giữ legacy ID endpoint cho admin trong migration period nhưng phải protect.
- Không lấy account ID từ untrusted request header.

---

## Related

- Branch: `feat/user-self-profile-api`
- Depends on: `AUTHZ-03`
- Docs: `docs/api-specs/user-service/API_CONTRACT.md`

---

# P0-10 / PROF-02 — [Backend] Remove arbitrary profile upsert from user update

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Loại bỏ hành vi `updateUser()` tự tạo skeleton nếu path `accountId` không tồn tại. Profile chỉ được tạo từ trusted account-created event hoặc reconciliation đã xác thực account thật.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Self/admin update record không tồn tại trả 404 hoặc `PROFILE_SYNC_PENDING`, không tự insert.
- [ ] Skeleton chỉ được tạo từ verified `UserRegisteredEvent`/internal reconciliation.
- [ ] Profile create lấy account/email từ auth event, không từ client.
- [ ] Event/retry idempotent và không tạo profile cho UUID giả.
- [ ] Kafka lag có explicit retry/status flow.
- [ ] Negative test valid MEMBER token không tạo/sửa account khác.

---

## Technical Notes / Constraints

- Không dùng REST upsert để che Kafka/schema failure.
- Phối hợp `EVENT-01` để profile không bị thiếu vĩnh viễn.

---

## Related

- Branch: `fix/remove-arbitrary-profile-upsert`
- Depends on: `PROF-01`, `EVENT-01`
- Docs: `docs/architecture/kafka/kafka-user-service-contract.md`

---

# P0-11 / AUTHN-01 — [Backend] Harden login throttling and account lock concurrency

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Hoàn thiện chống brute-force mà không biến account lock thành công cụ denial-of-service. Current flow có 5 lần sai/khóa 15 phút nhưng dùng constants và chưa có per-IP/device throttling hoặc concurrency protection.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Threshold, lock duration và delay được cấu hình theo environment/risk tier.
- [ ] Kết hợp per-account với per-IP/device rate limit; trả 429/`Retry-After` phù hợp.
- [ ] Public login error không làm lộ account tồn tại/status quá chi tiết.
- [ ] Concurrent failed logins không làm mất counter update; dùng atomic update/version/lock.
- [ ] Successful login reset lock counters atomically.
- [ ] Có audit/metrics cho failure, lock, unlock và abuse spike.
- [ ] Tests cover unknown account, wrong password, concurrent attempts và recovery after expiry.

---

## API Specifications (if applicable)

Áp dụng `POST /api/auth/login`; rate-limited response dùng HTTP 429 với stable error code và retry hint.

---

## Technical Notes / Constraints

- Không chỉ tăng hard-lock threshold; account-only lock dễ bị attacker dùng để khóa account nạn nhân.
- Không log password hoặc full credential payload.

---

## Related

- Branch: `fix/login-throttling-concurrency`
- Depends on: `DB-01`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

---

# P0-12 / AUTHN-02 — [Backend] Add MFA and step-up authentication for privileged roles

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Bổ sung MFA cho ADMIN/Head Office/cinema manager và step-up authentication cho thao tác rủi ro cao. POS fast-login nếu có không được thay thế identity và approval riêng của supervisor.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] ADMIN/manager/supervisor enrollment và login yêu cầu MFA trước production.
- [ ] Hỗ trợ TOTP hoặc WebAuthn/passkey; email OTP không được coi là phishing-resistant MFA.
- [ ] Session/token ghi authentication assurance/time để quyết định step-up.
- [ ] Role changes, PII export, offboarding, refund/void/complimentary/cash override yêu cầu recent MFA theo policy.
- [ ] Recovery codes lưu hash; MFA reset có identity verification, audit và notification.
- [ ] Không dùng shared supervisor PIN/account.
- [ ] Tests cover enrollment, challenge, replay, recovery, step-up expiry và role policy.

---

## API Specifications (if applicable)

Tối thiểu cần endpoints tương đương `mfa/enroll`, `mfa/verify`, `mfa/recovery` và step-up challenge. Contract cụ thể phải được chốt trong OpenAPI trước implementation.

---

## Technical Notes / Constraints

- Scope MVP nên ưu tiên TOTP cho privileged staff; passkey có thể là phase kế tiếp.
- Booking/payment/POS services vẫn phải enforce assurance claim cho action nhạy cảm.

---

## Related

- Branch: `feat/privileged-mfa-step-up`
- Depends on: `AUTHZ-04`
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md`

---

# P0-13 / OTP-01 — [Backend] Add OTP attempt limits and abuse controls

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Giữ TTL/cooldown hiện có nhưng bổ sung giới hạn verify và quota resend. OTP sáu chữ số không được phép thử vô hạn trong thời gian sống hoặc bị phát lại qua topic/log không kiểm soát.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Giới hạn verify sai theo challenge/email + IP/device.
- [ ] Vượt ngưỡng invalidates OTP/pending challenge và yêu cầu initiate lại.
- [ ] Resend có hourly/daily quota ngoài cooldown 60 giây.
- [ ] Resend tạo OTP mới và invalidate OTP cũ atomically.
- [ ] Initiate/resend response trung tính để giảm email enumeration.
- [ ] Kafka OTP topic có ACL/TLS/retention ngắn; không log/DLT raw OTP.
- [ ] Redis keys/pending password hash có TTL và access control đúng.
- [ ] Tests cover wrong attempts, expiry, resend invalidation, concurrent verify và quota reset.

---

## Technical Notes / Constraints

- Không lưu/ghi log OTP plaintext ngoài đường delivery bắt buộc.
- Rate-limit error trả 429; invalid/expired challenge dùng stable error code.

---

## Related

- Branch: `fix/registration-otp-abuse-controls`
- Depends on: `AUTHN-01`
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md`

---

# P0-14 / ACT-01 — [Backend] Hash activation tokens and guarantee invite delivery

**GitLab action:** Create follow-up; link `#159`, `#160`  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Hardening invite-link flow đã triển khai: activation token không được lưu raw và event gửi email không được mất âm thầm. Admin cần thấy delivery status và có resend/retry đáng tin cậy.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Database chỉ lưu hash token; raw token chỉ xuất hiện trong email link.
- [ ] Token có purpose, issuedAt, expiresAt, usedAt, createdBy và status.
- [ ] Concurrent consume dùng conditional update/lock, chỉ một request thành công.
- [ ] Resend invalidates token pending cũ và rate-limited.
- [ ] Account creation + activation-email request dùng outbox/retry/DLT; async failure không chỉ log.
- [ ] Admin UI/API trả invite delivery state và retry/resend action.
- [ ] Activation success notification và session/token cleanup phù hợp.
- [ ] Frontend xóa token khỏi URL sau consume, tránh referrer/history leakage.

---

## API Specifications (if applicable)

Giữ `POST /api/auth/activate-account` và `POST /api/accounts/{id}/resend-activation`; bổ sung admin invitation-status contract nếu cần.

---

## Technical Notes / Constraints

- Không reopen `#159/#160` nếu original Acceptance Criteria đã đạt; đây là follow-up security/reliability.
- Password-reset token tương lai phải dùng cùng token hashing pattern.

---

## Related

- Branch: `fix/activation-token-delivery-hardening`
- Depends on: `CFG-01`, `EVENT-01`; related `#159`, `#160`
- Docs: `docs/testing/issue-162-test-guide.md`

---

# P0-15 / SESS-01 — [Backend] Implement rotating refresh-token sessions

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay cơ chế dùng cùng bearer JWT làm access token và refresh input bằng session model có access token ngắn hạn cùng opaque refresh token được rotate. Phát hiện replay và quản lý token family/device session rõ ràng.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Access token và refresh token là hai credential khác nhau.
- [ ] Chỉ lưu hash refresh token, bound với account/client/device/session.
- [ ] Refresh token có absolute expiry và idle expiry.
- [ ] Mỗi refresh rotate token; reuse token cũ revoke cả token family.
- [ ] Logout current session và logout-all-devices là hai command riêng.
- [ ] Cleanup dựa trên session/refresh expiry, không xóa record còn refreshable theo access expiry.
- [ ] Refresh token chỉ gửi tới auth-service qua transport/storage strategy đã chốt.
- [ ] Concurrent refresh/replay tests chứng minh chỉ một rotation chain hợp lệ.

---

## API Specifications (if applicable)

### Login response

Trả access token và refresh/session credential theo secure client strategy. `POST /api/auth/refresh` chỉ nhận refresh credential, không nhận access JWT cũ.

---

## Technical Notes / Constraints

- Bám RFC 9700 refresh-token rotation/replay recommendations.
- Nếu SPA dùng cookie, cần Secure/HttpOnly/SameSite và CSRF design rõ.

---

## Related

- Branch: `feat/rotating-refresh-token-sessions`
- Depends on: `AUTHZ-04`, `DB-01`
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md`

---

# P0-16 / SESS-02 — [Backend] Revoke sessions after password role or status changes

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Bảo đảm account disable, password reset và role/permission downgrade có hiệu lực ngay với session đang hoạt động. Không để employee đã bị khóa tiếp tục dùng token cũ tới hết TTL.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Disable/offboard account revoke toàn refresh/session family ngay.
- [ ] Password reset/change revoke sessions theo policy, tối thiểu sessions khác.
- [ ] Role/permission downgrade làm token cũ mất hiệu lực qua session/authz version hoặc introspection strategy.
- [ ] Reactivate không phục hồi old sessions/permissions âm thầm.
- [ ] Revoke operation idempotent, có actor/reason/audit và retry.
- [ ] Resource service từ chối access token đã bị revoke/version stale.
- [ ] Integration tests cover disable, downgrade, password reset và re-enable.

---

## Technical Notes / Constraints

- Phối hợp `EMP-05`; employee status trong user-service không tự đảm bảo auth revocation.
- Không gọi synchronous cascade thiếu retry giữa services mà không có reconciliation.

---

## Related

- Branch: `fix/revoke-sessions-on-account-change`
- Depends on: `SESS-01`, `ACCT-01`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

---

# P0-17 / ACCT-01 — [Backend] Split account lifecycle into explicit commands

**GitLab action:** Create follow-up; link `#156`  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Sau khi role input được giới hạn enum ở `#156`, tách update DTO tổng quát thành các command có validation/authorization/audit riêng. Không cho một `PUT` tùy ý đổi email, password, roles và status cùng lúc.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Role input dùng enum/allowlist; invalid role trả 400, không fallback âm thầm.
- [ ] Chốt transitions `PENDING → ACTIVE → INACTIVE`; reactivate là command riêng.
- [ ] Tách change-email, change-password, assign-role, disable và reactivate.
- [ ] Email change kiểm tra uniqueness, reverify và notify old/new email.
- [ ] Role/status command yêu cầu privilege/step-up và trigger `SESS-02`.
- [ ] Không disable/xóa admin cuối cùng.
- [ ] Mỗi command có stable error, audit actor/reason và unit/security tests.

---

## API Specifications (if applicable)

Endpoints mục tiêu có thể là `/api/accounts/{id}/roles`, `/disable`, `/reactivate`, `/change-email`; contract cụ thể phải update OpenAPI trước merge.

---

## Technical Notes / Constraints

- Không reopen `#156` nếu enum Acceptance Criteria đã đạt.
- Self password/email commands phải khác admin lifecycle commands.

---

## Related

- Branch: `feat/explicit-account-lifecycle-commands`
- Depends on: `AUTHZ-01`; related `#156`
- Docs: `docs/api-specs/auth-service/API_CONTRACT.md`

---

# P0-18 / EVENT-01 — [Backend] Add transactional outbox and identity reconciliation

**GitLab action:** Create follow-up; link `#158`  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Loại bỏ rủi ro account commit nhưng UserRegisteredEvent bị mất và thay `Thread.sleep()` polling bằng provisioning trạng thái/retry đáng tin cậy. Consumer phải idempotent/versioned, DLT phải replay được.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Auth account create và outbox record commit trong một DB transaction.
- [ ] Publisher retry outbox, đánh dấu published và không mất event khi Kafka tạm lỗi.
- [ ] Event có eventId, version, occurredAt, correlationId và identity facts cần thiết.
- [ ] User consumer deduplicate theo eventId và idempotent khi redelivery.
- [ ] DLT lưu metadata, alert và có authorized replay operation; không chỉ log payload.
- [ ] Employee create không `Thread.sleep()` trong request transaction.
- [ ] Reconciliation phát hiện account thiếu profile, profile orphan và role/employee mismatch.
- [ ] Integration tests cover broker failure, duplicate event, out-of-order event và replay.

---

## Technical Notes / Constraints

- `#158` chỉ thay polling có thể chưa cover outbox/reconciliation; tạo follow-up nếu original issue đã close.
- Không swallow business exception rồi commit Kafka offset âm thầm.

---

## Related

- Branch: `feat/identity-outbox-reconciliation`
- Depends on: `DB-01`; related `#158`
- Docs: `docs/architecture/kafka/kafka-user-service-contract.md`

---

# P0-19 / AUD-01 — [Backend] Redact and harden auth user audit logs

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Chuẩn hóa audit bảo mật và PII: actor/IP phải đáng tin, token/OTP/CCCD không được log raw, user audit không serialize toàn entity graph. Critical audit failures cần observable thay vì bị swallow.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chỉ tin forwarded IP từ trusted proxy; gateway sanitize client headers.
- [ ] Redaction policy cho email/phone/CCCD/address/token/OTP/password.
- [ ] User audit lưu field diff allowlist, không serialize raw entity/relationships.
- [ ] Audit append-only, read-protected và có retention/archive policy.
- [ ] Critical audit write failure tạo metric/alert; behavior fail-open/fail-closed được chốt theo action.
- [ ] Correlation ID xuyên REST → auth → Kafka → user.
- [ ] Tests xác nhận PII/secrets không xuất hiện trong log, audit hoặc DLT.

---

## Technical Notes / Constraints

- Vẫn cần giữ stable employee/account actor ID cho transaction history.
- Không log raw Kafka payload chứa OTP/PII ở INFO/ERROR.

---

## Related

- Branch: `fix/auth-user-audit-redaction`
- Depends on: `AUTHZ-04`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

---

# P0-20 / PII-01 — [Backend] Minimize required customer profile data

**GitLab action:** Create new; link progressive-profile issue `#161`  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Tách profile completeness theo persona và purpose. Customer mua vé/loyalty không nên bắt buộc CCCD, gender, address và full HR-style data chỉ để dùng booking; employee data được thu thập theo employment purpose riêng.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có completion rules riêng cho CUSTOMER/MEMBER và EMPLOYEE.
- [ ] Customer booking profile chỉ yêu cầu contact/fulfillment fields thực sự cần.
- [ ] CCCD không bắt buộc cho customer mặc định nếu không có purpose/policy rõ.
- [ ] Age-rating check nằm ở booking/admission policy; không yêu cầu lưu CCCD mọi customer.
- [ ] Field required/optional/conditional được document trong API/UI/privacy notice.
- [ ] Existing customer thiếu CCCD vẫn booking được nếu thỏa business rule khác.
- [ ] Tests cover minimal customer profile và stricter employee onboarding.

---

## Technical Notes / Constraints

- `#161` có thể mở rộng progressive profiling nhưng không được dùng để bắt toàn bộ PII cho mọi persona.
- Đây là data-minimization/business-rule change; phối hợp frontend và booking guard.

---

## Related

- Branch: `fix/profile-completion-by-persona`
- Depends on: `PROF-01`; related `#161`
- Docs: `docs/issues/auth-user-service-industry-readiness-checklist.md`

---

# Workflow áp dụng cho gói P0

## Khi nào chuyển trạng thái

- `Open → In Progress`: assignee đã đọc acceptance criteria, xác nhận dependency, tạo branch và bắt đầu thay đổi thực tế. Assignee tự kéo issue; leader chỉ điều phối hoặc sửa trạng thái bị sai.
- `In Progress → Review / QA`: merge request đã mở, pipeline cần thiết đã pass, self-review hoàn tất và có bằng chứng test trong MR.
- `Review / QA → Closed`: reviewer/QA xác nhận toàn bộ acceptance criteria, thay đổi đã merge vào nhánh mục tiêu và tài liệu/contract liên quan đã cập nhật.
- Không kéo nhiều issue sang `In Progress` chỉ vì đã assign. Giới hạn WIP đề xuất: mỗi member tối đa một issue chính và một issue nhỏ đang chờ review.

## Thứ tự triển khai đề xuất

1. Gate 1 — Build/config/schema: `BUILD-01`, `CFG-01`, `DB-01`.
2. Gate 2 — Authorization/data exposure: `AUTHZ-01..04`, `ENUM-01`, `PROF-01..02`.
3. Gate 3 — Authentication/session: `AUTHN-01..02`, `OTP-01`, `ACT-01`, `SESS-01..02`, `ACCT-01`.
4. Gate 4 — Reliability/privacy: `EVENT-01`, `AUD-01`, `PII-01..02`.
5. Gate 5 — Cinema workforce: `EMP-01..05`, `EMP-07`.
6. Quality gate xuyên suốt: `TEST-01` được bổ sung theo từng MR, không chờ cuối sprint mới làm.

## Quy tắc với issue đã có

- Issue đang `Open/Ongoing`: cập nhật description và acceptance criteria từ entry tương ứng; không tạo issue trùng.
- Issue đã `Completed`: không reopen chỉ để mở rộng scope. Tạo follow-up và liên kết bằng `Related/Follow-up to`.
- Các số `#154–#161` trong tài liệu dựa trên board hiện tại; kiểm tra lại title trước khi bulk assign hoặc import.
