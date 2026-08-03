# Issue pack — Extended final demo

> Các block trong tài liệu này tuân theo `docs/issues/ISSUE_TEMPLATE.md` và được thiết kế để copy thủ công lên GitLab. Mã `FD-*`, `RR-*`, `PR-*`, `RV-*`, `AN-*`, `OB-*`, `E2E-*` chỉ là mã tham chiếu trong tài liệu, không phải GitLab issue ID.

## Nguyên tắc tạo issue

- Không tạo lại các issue đã có: `#147`, `#148`, `#239`, `#240`, `#244`, `#247`, `#248`, `#250`, `#260`, `#262`.
- Giữ `#147` làm issue theo dõi Rating & Review cơ bản; chỉ tách `RV-01..RV-03` theo layer nếu cần chia người hoặc chia MR.
- Các issue `RR-*` bổ sung cho `#240`, `#244`, `#260`, `#262`; không thay thế chúng.
- `PR-03` cung cấp contract cho `#247`; Loyalty và `#248` được chuyển sang P2/OUT-SCOPE FINAL, không triển khai nửa vời trong checkout.
- Chỉ chuyển trạng thái sang `In Progress` khi đã có assignee. Khi mới tạo, giữ issue ở cột `Open`.
- P0 là vertical slice bắt buộc cho demo mở rộng. P1 chỉ bắt đầu sau khi P0 chạy end-to-end ổn định.

## Đối chiếu 15 issue còn lại trong backlog ngày 02/08/2026

| Issue hiện có | Quyết định | Owner đề xuất | Việc cần làm trước khi bắt đầu |
|---|---|---|---|
| `#262` Manual Reconciliation Sync API | **P0 — giữ, nâng Priority::High** | Người 1 | Chốt case status và contract retry/resolve với `#244` |
| `#260` Integrate Provider Refund API | **P0 — giữ, nâng Priority::High** | Người 1 | Chốt provider stub/sandbox, idempotency key và provider reference |
| `#248` Loyalty reservation lifecycle | **OUT-SCOPE FINAL / P2** | Chưa giao | Source mới có schema/entity placeholder; chưa có balance API, ledger hoặc reservation lifecycle |
| `#247` Promotion-aware checkout | **P0 — giữ, nâng Priority::High** | Bạn — booking owner | Phụ thuộc `PR-01..PR-03`; issue này chỉ làm checkout orchestration |
| `#244` Auditable booking reconciliation cases | **P0 — giữ, nâng Priority::High** | Bạn — booking owner | Cung cấp case facts/query cho `#262` và `RR-01` |
| `#240` Cancellation/refund orchestration | **P0 — giữ, nâng Priority::High** | Bạn — booking owner | Chốt state machine và compensation với `#260` |
| `#239` Booking concurrency/E2E tests | **P0 — giữ** | Bạn — booking owner | Mở rộng bằng `RR-04` và `E2E-01`, không tạo issue booking E2E trùng |
| `#148` Promotion apply for movie/showtime | **P0 — giữ, nâng Priority::High** | Người 2 | Dùng làm targeting child/dependency của `PR-02/PR-03` |
| `#147` Rating & Review | **P0 cơ bản — giữ** | Người 3 | Chỉ làm verified rating 1–5, nhận xét tùy chọn và aggregate; không làm moderation |
| `#113` Employee Counter Sale UI | **OUT-SCOPE FINAL** | Chưa giao | Không đóng; đưa sang backlog sau demo vì không chặn customer flow |
| `#97` Email template management API | **OUT-SCOPE FINAL** | Chưa giao | Email reset/notification hiện có không cần template-management UI/API để demo |
| `#266` Kafka retry và DLT | **P1 platform reliability** | Người 4 sau P0 | Chỉ kéo vào P0 nếu event delivery đang chặn refund/analytics |
| `#267` Event consumption idempotency/history | **P0 có chọn lọc** | Mỗi service owner | Áp dụng trực tiếp cho consumer mới; issue chung chỉ giữ phần notification còn thiếu |
| `#269` Consumer concurrency/integration tests | **P1** | Người 4 sau P0 | Không làm trước business vertical slices và E2E-01 |
| `#270` Notification error code/status query | **P1** | Người 4 sau P0 | Không chặn demo nếu notification không được trình diễn như một bounded context riêng |

### Kết luận tránh trùng

- Không tạo thêm một issue “booking integration tổng quát”: `#239`, `#240`, `#244`, `#247` đã bao phủ phần booking P0 do bạn sở hữu; `#248` giữ ở P2.
- Không tạo thêm issue “refund backend tổng quát”: dùng `#260`, `#262`; chỉ tạo `RR-*` cho UI, scheduler và test còn thiếu.
- Không tạo lại “promotion targeting”: dùng `#148`; `PR-*` bổ sung schema, lifecycle, reservation và UI.
- Không mở rộng `#147` thành hệ thống moderation. Nếu cần chia MR, chỉ tạo `RV-01..RV-03` và liên kết chúng với `#147`.
- Không tạo `LY-01..LY-04` trong sprint final; giữ các field/table loyalty hiện có làm placeholder và bảo đảm checkout không phụ thuộc chúng.
- `#267` không thay thế idempotency business của promotion/analytics; mỗi service vẫn phải có unique event/idempotency constraint trong issue riêng.

## Thứ tự và phân công đề xuất

| Thứ tự | Mã | Priority | Người phụ trách đề xuất | Phụ thuộc chính |
|---:|---|---|---|---|
| 1 | FD-01 | P0 | Cả nhóm review, Người 4 chốt | Không |
| 2 | FD-02, FD-04 | P0 | Người 4 | FD-01 |
| 3 | FD-03 | P0 | Người 4 | P0 Auth/RBAC đã merge |
| 4 | RR-01..RR-04 | P0/P1 | Người 1 | `#240`, `#244`, `#260`, `#262` |
| 5 | PR-01..PR-05 | P0 | Người 2 | FD-01, FD-02, `#148`, `#247` |
| 6 | RV-01..RV-03 | P0 cơ bản | Người 3 | `#147`, booking eligibility contract |
| 7 | AN-01 | P0 | Bạn — booking owner | Booking outbox hiện có |
| 8 | AN-02..AN-04 | P0 tối giản | Người 4 | AN-01, FD-02, FD-03 |
| 9 | OB-01 | P0 tối giản | Người 4; mỗi owner hỗ trợ service của mình | FD-01, FD-02 |
| 10 | OB-02 | Conditional P0/P1 | Mỗi service owner | Golden path và refund đã xanh |
| 11 | OB-03 | OUT-SCOPE FINAL | Chưa giao | Chỉ mở lại nếu Observability bắt buộc phải demo |
| 12 | E2E-01 | P0 | Bạn — booking owner | Tất cả vertical slice P0 |

### Thứ tự thực thi trong giai đoạn nước rút

1. Làm xanh `#239` cho booking/payment/concession golden path; không bắt đầu dashboard khi transaction nguồn còn không ổn định.
2. Hoàn thành `#240` và `#260` để có outcome refund thật.
3. Thực hiện AN-01 → AN-02 → AN-03 → AN-04; Definition of Done là booking/refund vừa chạy làm Analytics Summary thay đổi đúng và event lặp không double-count.
4. Hoàn thiện `#244`, `#262` và RR-01 để trình diễn một reconciliation case có thể xử lý.
5. Làm promotion `#148`, PR-01..PR-05 và `#247` nếu checkout core vẫn xanh.
6. Rating chỉ giữ RV-01..RV-03 ở mức cơ bản; Loyalty và `#248` không tham gia final flow.
7. Dùng E2E-01 làm go/no-go gate; OB-01 là observability P0 tối thiểu, OB-02 chỉ làm có điều kiện và OB-03 là OUT-SCOPE FINAL.

---

# FD-01

## Title

`[Docs] Define canonical cross-service event and idempotency contracts`

## Labels

`Layer::Infrastructure`, `Type::Docs`, `Priority::High`

## Summary / Objective

Chốt event envelope và contract dùng chung cho booking, payment, refund, concession, promotion và analytics trước khi triển khai song song. Contract phải loại bỏ cách hiểu khác nhau về ID, money, trạng thái, version và idempotency giữa các service.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Có event envelope thống nhất gồm `eventId`, `eventType`, `eventVersion`, `occurredAt`, `correlationId`, `causationId`, `producer` và `payload`.
- [ ] Money dùng integer minor unit hoặc `BigDecimal` kèm `currency`; không dùng `double`.
- [ ] Có JSON example cho booking confirmed/cancelled/refunded, payment succeeded/refunded và promotion committed/released.
- [ ] Quy định idempotency key, deduplication key, retry và backward compatibility được ghi rõ.
- [ ] Mỗi event có owner, consumer, topic/routing key và dữ liệu nhạy cảm không được publish.
- [ ] Các owner service review và đồng ý contract trước khi code integration.

## Technical Notes / Constraints

- Không tạo shared entity/JPA model giữa các bounded context.
- Contract phải version được và consumer phải bỏ qua field chưa biết.
- Không publish email, phone, token hoặc credential nếu consumer không thực sự cần.

## Related

- Branch: `docs/canonical-domain-event-contracts`
- Depends on: Không
- Docs: `docs/architecture/kafka/`, `docs/ERROR_CODE_CONVENTION.md`

---

# FD-02

## Title

`[Infra] Register P0 extended-demo services and add startup health gates`

## Labels

`Layer::Infrastructure`, `Type::Feature`, `Priority::High`

## Summary / Objective

Đưa promotion-service và analytics-service P0 vào Docker stack, service discovery và API Gateway. Toàn bộ stack demo phải khởi động theo dependency order và chỉ nhận traffic khi database, Kafka và service dependency đã sẵn sàng; loyalty-service không thuộc final scope.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Docker Compose khai báo analytics-service, database/schema tương ứng và environment variables cần thiết; promotion-service hiện có được kiểm tra lại route/health.
- [ ] API Gateway route được `/api/promotions/**` và `/api/analytics/**` đúng service.
- [ ] Mỗi service P0 có readiness/liveness endpoint và Docker healthcheck.
- [ ] Gateway chỉ healthy sau khi discovery và các route P0 có thể truy cập.
- [ ] `docker compose up` từ môi trường sạch khởi động được toàn bộ demo stack bằng một lệnh.
- [ ] Không commit secret thật; `.env.example` chỉ chứa placeholder và mô tả.

## Technical Notes / Constraints

- Dùng convention port, Eureka service name và Spring profile hiện có.
- Không tạo loyalty-service hoặc loyalty database trong sprint final.
- Không dùng `depends_on` đơn thuần thay cho readiness healthcheck.

## Related

- Branch: `feat/extended-demo-service-routing`
- Depends on: FD-01
- Docs: `docker-compose.yml`, `.env.example`

---



# FD-03

## Title

`[Backend] Enforce RBAC and branch scope for extended-demo APIs`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Áp dụng authorization nhất quán cho refund, reconciliation, promotion, rating và analytics. Admin có quyền toàn hệ thống; Branch Manager chỉ được truy cập dữ liệu thuộc chi nhánh được gán; customer chỉ truy cập tài nguyên của chính mình.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Có authorization matrix cho từng endpoint P0.
- [ ] Branch-scoped query bắt buộc filter theo branch claim/assignment ở server, không tin `branchId` do client tự gửi.
- [ ] Customer không đọc/sửa refund hoặc review của account khác.
- [ ] Internal endpoint yêu cầu `INTERNAL_SERVICE_KEY` hoặc service authentication đã thống nhất, không public qua Gateway.
- [ ] Có integration test cho ít nhất ADMIN, BRANCH_MANAGER, MEMBER và unauthenticated request.
- [ ] Trả `401` cho thiếu/sai authentication và `403` cho thiếu permission.

## API Specifications (if applicable)

### API 1 — Authorization coverage

| Field | Details |
|---|---|
| Method | `GET` / `POST` / `PUT` / `PATCH` |
| Endpoint | `/api/promotions/**`, `/api/reviews/**`, `/api/analytics/**`, `/api/refunds/**` |
| Description | Áp dụng role và resource scope cho toàn bộ API demo mở rộng. |
| Auth Required | Yes |

## Technical Notes / Constraints

- Tái sử dụng JWT claim và internal-service pattern đã có trong auth/user service.
- Không dựa vào việc ẩn nút trên frontend để bảo vệ API.

## Related

- Branch: `feat/extended-demo-rbac-branch-scope`
- Depends on: P0 Auth/RBAC issues `#154`–`#157` đã merge
- Docs: `docs/api-specs/movie-service/AUTHORIZATION_MATRIX.md`

---

# FD-04

## Title

`[Infra] Add deterministic extended-demo seed and reset workflow`

## Labels

`Layer::Infrastructure`, `Type::Chore`, `Priority::High`

## Summary / Objective

Tạo dữ liệu demo lặp lại được cho Landmark 81 và một lệnh reset về trạng thái ban đầu. Dataset phải hỗ trợ booking, refund, promotion, rating và analytics mà không phụ thuộc dữ liệu ngẫu nhiên hoặc thao tác tay dài.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Seed có Admin, Branch Manager Landmark 81 và ít nhất một customer đã hoàn tất profile.
- [ ] Có phim published, showtime tương lai, room/seat, price, concession stock và payment demo data hợp lệ.
- [ ] Có promotion `MOVIE10` và một booking lịch sử đủ điều kiện review; không cần loyalty opening balance.
- [ ] Reset script idempotent và không xóa database ngoài phạm vi demo.
- [ ] Chạy reset rồi thực hiện golden path hai lần liên tiếp không bị trùng unique key hoặc lệch inventory.
- [ ] README mô tả lệnh chạy, account demo và expected state; không ghi password production.

## Technical Notes / Constraints

- Trên Windows, script phải kiểm tra chính xác database/container mục tiêu trước khi reset.
- Không hardcode provider credential trong seed hoặc script.

## Related

- Branch: `chore/extended-demo-seed-reset`
- Depends on: FD-02 và migrations của các service
- Docs: `docs/features/showtime-management/LANDMARK_81_PRICING_AND_CONCESSION_DEMO_DATA.md`

---

# RR-01

## Title

`[Frontend] Build admin refund and reconciliation workbench`

## Labels

`Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Xây dựng trang vận hành để Admin theo dõi refund và các trường hợp booking/payment lệch trạng thái. Trang phải ưu tiên xử lý ngoại lệ: filter, xem timeline, retry sync, resolve và escalate mà không sửa trạng thái trực tiếp bằng thao tác thiếu audit.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Hiển thị stat cards cho pending refund, failed refund, unresolved case và stale case.
- [ ] Có search cùng filter theo status, provider, branch và date range.
- [ ] Bảng/list hiển thị booking, payment, provider reference, amount, last sync và owner.
- [ ] Detail modal hiển thị audit timeline và raw provider reference đã mask dữ liệu nhạy cảm.
- [ ] Retry, resolve và escalate có confirm modal, loading, success/error feedback và refresh đúng record.
- [ ] Action bị ẩn/disable đúng role và state transition; không cho resolve case chưa có resolution note.

## UI Reference / Mockup

Theo admin design system hiện tại: stat cards, unified filter dropdown, detail modal và action menu. Không tạo dashboard style mới tách biệt với Catalog/Booking admin pages.

## Technical Notes / Constraints

- Dùng API của `#262` và reconciliation query hiện có; không mock production data.
- Query/filter phải server-side và có pagination.

## Related

- Branch: `feat/admin-refund-reconciliation-workbench`
- Depends on: `#244`, `#260`, `#262`, FD-03
- Docs: `docs/features/booking-service/DEMO_READINESS_AND_GAP_ANALYSIS.md`

---

# RR-02

## Title

`[Frontend] Show customer refund status and timeline`

## Labels

`Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Bổ sung trạng thái refund vào booking detail để customer biết yêu cầu đang ở bước nào, số tiền dự kiến và kết quả cuối cùng. UI không được báo “đã hoàn tiền” chỉ vì booking đã cancel nếu provider refund chưa thành công.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Hiển thị state `REQUESTED`, `PROCESSING`, `REFUNDED`, `REJECTED`/`FAILED` theo contract backend.
- [ ] Hiển thị requested amount, refunded amount, reason và timestamps phù hợp.
- [ ] Timeline phân biệt booking cancellation và provider refund completion.
- [ ] Customer chỉ xem refund thuộc booking của mình.
- [ ] Có loading, empty, retry và unavailable state; không hiển thị dữ liệu mock.
- [ ] Responsive ở mobile và desktop.

## UI Reference / Mockup

Dùng timeline tối giản trong customer booking detail, đồng bộ tone xanh dương của booking flow.

## Related

- Branch: `feat/customer-refund-timeline`
- Depends on: `#240`, `#260`, refund status query API
- Docs: `docs/features/booking-service/FEATURE_BRIEF.md`

---

# RR-03

## Title

`[Backend] Schedule provider reconciliation and stale-case escalation`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Chạy reconciliation theo lịch để phát hiện payment/refund lệch trạng thái với provider và tự tạo hoặc cập nhật reconciliation case. Case quá SLA phải được đánh dấu stale/escalated để Admin xử lý.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Scheduler có thể bật/tắt và cấu hình interval/timezone bằng environment.
- [ ] Provider query có timeout, retry giới hạn và không chạy chồng nhiều instance.
- [ ] Một mismatch chỉ tạo một active case theo deduplication key.
- [ ] Case quá SLA chuyển `STALE`/`ESCALATED` và lưu audit event.
- [ ] Manual sync `#262` và scheduled sync dùng chung application service.
- [ ] Có test cho retry, duplicate run, provider timeout và stale escalation.

## Technical Notes / Constraints

- Không giữ database transaction trong lúc gọi provider network API.
- Dùng distributed lock hoặc database lease nếu nhiều instance chạy scheduler.

## Related

- Branch: `feat/provider-reconciliation-scheduler`
- Depends on: `#260`, `#262`, `#244`
- Docs: `docs/features/booking-service/DEMO_READINESS_AND_GAP_ANALYSIS.md`

---

# RR-04

## Title

`[Backend] Add refund late-payment and reconciliation end-to-end tests`

## Labels

`Layer::Backend`, `Type::Chore`, `Priority::High`

## Summary / Objective

Bổ sung automated tests chứng minh refund và reconciliation an toàn trước callback lặp, timeout và trạng thái đến sai thứ tự. Test phải bao phủ boundary giữa booking-service và payment-service thay vì chỉ mock toàn bộ orchestration.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Test confirmed booking → cancel → refund requested → provider refunded → booking refunded.
- [ ] Callback payment/refund lặp không double-confirm, double-refund hoặc tạo case trùng.
- [ ] Late payment sau booking expiry tạo kết quả compensation/reconciliation đúng policy.
- [ ] Provider timeout giữ trạng thái recoverable và retry không mất reference.
- [ ] Paid-but-unconfirmed tạo reconciliation case và có thể resolve sau sync.
- [ ] Test chạy ổn định trong CI, không phụ thuộc clock hoặc provider thật.

## Technical Notes / Constraints

- Dùng fixed clock/Testcontainers/WireMock theo convention hiện có.
- Không chỉ assert HTTP 200; phải assert booking, payment, refund, case và audit state.

## Related

- Branch: `test/refund-reconciliation-e2e`
- Depends on: `#239`, `#240`, `#244`, `#260`, `#262`
- Docs: `docs/features/booking-service/SCENARIO.md`

---

# PR-01

## Title

`[Database] Create promotion schema and migration baseline`

## Labels

`Layer::Database`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tạo schema có version cho promotion, targeting và usage/reservation. Schema phải hỗ trợ một promotion áp dụng theo movie/showtime, usage limit và lifecycle reserve/commit/release mà không lưu discount dưới dạng dữ liệu không kiểm soát.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Có migration cho promotion, target, price rule, reservation và usage ledger.
- [ ] Promotion code được normalize và unique không phân biệt hoa thường.
- [ ] Có status, validity window, global/per-account usage limits và optimistic version.
- [ ] Reservation có idempotency key, booking/account reference, amount snapshot và expiry.
- [ ] Monetary/percentage constraints được enforce ở database hoặc application validation phù hợp.
- [ ] Migration chạy được trên database sạch và database đã có skeleton promotion-service.

## Technical Notes / Constraints

- Không lưu danh sách movie/showtime dưới dạng comma-separated string.
- Timestamp lưu UTC; business date/time được diễn giải theo timezone chi nhánh khi cần.

## Related

- Branch: `feat/promotion-schema-baseline`
- Depends on: FD-01
- Docs: `docs/DB_DESIGN.md`

---

# PR-02

## Title

`[Backend] Implement promotion CRUD and lifecycle APIs`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Hoàn thiện API quản trị promotion từ draft đến active/paused/expired. API phải validate code, thời gian hiệu lực, rule và targeting; mọi thay đổi quan trọng được audit.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Có create, detail, paginated search, update draft, activate, pause và retire APIs.
- [ ] Không cho sửa rule/target làm thay đổi promotion đã có committed usage; phải tạo version mới hoặc giới hạn field được sửa.
- [ ] `#148` movie/showtime targeting được tích hợp vào create/update/detail.
- [ ] Có validation cho overlapping/invalid validity window và usage limits.
- [ ] ADMIN có quyền toàn hệ thống; Branch Manager chỉ quản lý promotion thuộc branch nếu policy cho phép.
- [ ] Có unit/integration tests và error code theo convention.

## API Specifications (if applicable)

### API 1 — Create promotion

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/promotions` |
| Description | Tạo promotion ở trạng thái DRAFT cùng rule và targeting. |
| Auth Required | Yes — ADMIN/authorized BRANCH_MANAGER |

### API 2 — Change lifecycle state

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/promotions/{promotionId}/activate` / `pause` / `retire` |
| Description | Thực hiện state transition có validation và audit. |
| Auth Required | Yes |

## Related

- Branch: `feat/promotion-admin-apis`
- Depends on: PR-01, `#148`, FD-03
- Docs: FD-01 event contract

---

# PR-03

## Title

`[Backend] Implement promotion eligibility and reservation APIs`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Cung cấp quote/reserve/commit/release contract cho booking checkout. Kết quả phải deterministic theo price snapshot, chống vượt usage limit khi concurrent checkout và không áp dụng promotion ngoài movie/showtime/account hợp lệ.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Quote trả eligibility, reason code, discount và final amount mà chưa tiêu usage.
- [ ] Reserve dùng idempotency key, có TTL và atomically giữ usage quota.
- [ ] Commit chỉ thành công một lần sau booking confirmation; release trả quota khi payment fail/expired.
- [ ] Validate lifecycle, validity, movie/showtime/branch target, minimum amount và usage limits.
- [ ] Booking lưu được immutable promotion/discount snapshot để audit/refund/analytics.
- [ ] Có concurrency test chứng minh usage limit không bị vượt.

## API Specifications (if applicable)

### API 1 — Quote promotion

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/promotions/quote` |
| Description | Tính eligibility và discount cho checkout snapshot. |
| Auth Required | Yes |

### API 2 — Reserve/commit/release promotion

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/promotions/reservations`, `/api/promotions/reservations/{id}/commit`, `/release` |
| Description | Quản lý quota trong booking lifecycle. |
| Auth Required | Internal service authentication |

## Technical Notes / Constraints

- Không tin total do client gửi; booking-service phải cung cấp server-side price snapshot.
- Không dùng floating point cho discount calculation.

## Related

- Branch: `feat/promotion-eligibility-reservation`
- Depends on: PR-01, PR-02, `#148`
- Blocks: `#247`

---

# PR-04

## Title

`[Frontend] Connect admin promotion management to real APIs`

## Labels

`Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay dữ liệu mock của trang promotion bằng API thật và tạo workflow quản lý dễ kiểm tra cho Admin. Form phải hướng dẫn theo từng nhóm: basic information, validity, discount rule, targeting và usage limit.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] List có stats, search, status filter, validity filter và pagination từ server.
- [ ] Create/edit dùng modal hoặc page thống nhất design system, có validation inline.
- [ ] Target selector lấy movie/showtime thật và hiển thị timezone/branch rõ ràng.
- [ ] Lifecycle actions có confirm, permission guard và phản hồi lỗi API.
- [ ] Có loading, empty, retry và stale-data refresh state.
- [ ] Không còn mock promotion trong admin route P0.

## UI Reference / Mockup

Theo admin Catalog/Pricing pattern hiện tại: stat cards, compact toolbar, modal detail/edit và audit-friendly status badge.

## Related

- Branch: `feat/admin-promotion-api-integration`
- Depends on: PR-02, FD-03
- Docs: `docs/issues/ISSUE_TEMPLATE.md`

---

# PR-05

## Title

`[Frontend] Integrate promo code into customer checkout`

## Labels

`Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Cho customer nhập, áp dụng và bỏ promo code trong booking checkout. UI phải hiển thị lý do không đủ điều kiện và price breakdown rõ ràng, đồng thời không tự tính discount ở browser.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Promo code được normalize trước request nhưng discount chỉ lấy từ backend quote.
- [ ] Summary hiển thị subtotal, promotion discount và final payable amount.
- [ ] Hiển thị message cụ thể cho invalid, expired, not eligible, usage exhausted và temporarily unavailable.
- [ ] Thay đổi ghế/concession làm quote cũ invalid và re-quote theo contract.
- [ ] Back/reload giữ đúng booking checkout state nhưng không reuse reservation đã hết hạn.
- [ ] Không còn mock offer/promo trong booking checkout P0.

## UI Reference / Mockup

Một promo input gọn trong booking confirmation card, đồng bộ tone xanh dương và không làm gián đoạn luồng chính.

## Related

- Branch: `feat/checkout-promo-code`
- Depends on: PR-03, `#247`
- Docs: `docs/features/booking-service/FEATURE_BRIEF.md`

---

# RV-01

## Title

`[Database] Create basic verified movie rating schema`

## Labels

`Layer::Database`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Tạo schema tối thiểu cho đánh giá phim từ booking đã xác minh. Schema phải chống đánh giá trùng và cung cấp dữ liệu để tính điểm trung bình cùng tổng số lượt đánh giá; chưa triển khai moderation workflow.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Review lưu account, booking, movie, rating, optional content và timestamps.
- [ ] Rating bị giới hạn từ 1 đến 5; review hợp lệ được hiển thị ngay, không có `PENDING`/moderation state trong scope cơ bản.
- [ ] Có unique constraint phù hợp chống duplicate review theo booking/movie/account policy.
- [ ] Aggregate lưu hoặc tính được `averageRating` và `reviewCount` từ các review hợp lệ.
- [ ] Có chiến lược cập nhật aggregate an toàn khi customer sửa/xóa review nếu API cho phép hai thao tác này.
- [ ] Migration chạy được và không phụ thuộc dữ liệu booking trong cùng database.

## Related

- Branch: `feat/movie-review-schema`
- Depends on: `#147`, FD-01
- Docs: `docs/DB_DESIGN.md`

---

# RV-02

## Title

`[Backend] Implement basic verified-booking rating and aggregate APIs`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Cho customer chỉ đánh giá phim từ booking hợp lệ đã confirmed và suất chiếu đã kết thúc. API phải chống đánh giá trùng và cung cấp điểm trung bình cho movie detail; không bao gồm Admin moderation, report abuse hoặc helpful votes.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Eligibility xác minh booking thuộc account, đã confirmed và showtime đã kết thúc.
- [ ] Create/update review enforce rating 1–5 và duplicate policy.
- [ ] Customer xem review của mình; public xem các review hợp lệ theo movie với pagination.
- [ ] Movie aggregate trả `averageRating` và `reviewCount`, cập nhật đúng sau create/update/delete nếu được hỗ trợ.
- [ ] Booking đã refund toàn bộ trước khi suất chiếu diễn ra không đủ điều kiện review.
- [ ] Có tests cho unauthorized, booking không thuộc account, future showtime, duplicate và aggregate recalculation.

## API Specifications (if applicable)

### API 1 — Submit verified review

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/reviews` |
| Description | Tạo review dựa trên booking/movie entitlement. |
| Auth Required | Yes — MEMBER |

### API 2 — Get movie ratings

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/reviews/movies/{movieId}` |
| Description | Trả average rating, review count và danh sách review hợp lệ có phân trang. |
| Auth Required | No |

## Related

- Branch: `feat/verified-movie-reviews`
- Depends on: RV-01, `#147`, booking eligibility internal API/event
- Docs: `docs/api-specs/booking-service/API_CONTRACT.md`

---

# RV-03

## Title

`[Frontend] Build customer movie rating and review experience`

## Labels

`Layer::Frontend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Cho customer xem eligibility và gửi rating/review từ booking history hoặc movie detail. UI chỉ tập trung vào thao tác chấm 1–5 sao, nhận xét tùy chọn và hiển thị kết quả; không có moderation status.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] CTA review chỉ xuất hiện khi API trả eligible.
- [ ] Form có rating 1–5, optional content, validation và accessible controls.
- [ ] Sau khi lưu thành công, review và aggregate mới được cập nhật từ response/API refresh.
- [ ] Chặn double submit và xử lý duplicate response rõ ràng.
- [ ] Movie detail hiển thị average rating/review count từ API thật.
- [ ] Có loading, empty và error states; không dùng aggregate ngẫu nhiên/mock.

## UI Reference / Mockup

Modal review tối giản từ booking history; aggregate rating compact trong movie detail.

## Related

- Branch: `feat/customer-movie-review-ui`
- Depends on: RV-02
- Docs: `docs/issues/ISSUE_TEMPLATE.md`

---

# AN-01

## Title

`[Backend] Publish analytics-ready booking outcome events`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Chuẩn hóa booking outbox message để analytics consumer nhận được event envelope và snapshot tài chính cần thiết. P0 chỉ cần `BOOKING_CONFIRMED` và `BOOKING_REFUNDED`, nhưng phải đủ dữ liệu để dashboard tính booking count, ticket/concession revenue, refund và net revenue mà không query booking database.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Kafka message có envelope gồm `eventId`, `eventType`, `eventVersion`, `occurredAt`, `correlationId`, `producer` và `payload`; publisher không chỉ gửi raw payload.
- [ ] Publish được `BOOKING_CONFIRMED` và `BOOKING_REFUNDED` với stable event ID khi retry.
- [ ] Payload có tối thiểu `bookingId`, `clusterId`, `showtimeId`, `ticketCount`, `ticketAmount`, `concessionAmount`, `discountAmount`, `finalAmount`, `refundAmount` và `currency`.
- [ ] Money dùng `BigDecimal`/minor unit theo contract; không dùng `double`.
- [ ] Không publish account PII, JWT, provider signature hoặc credential.
- [ ] Có contract/integration test chứng minh retry giữ nguyên event ID và consumer có thể phân biệt confirmed/refunded.

## Related

- Branch: `feat/analytics-ready-booking-events`
- Depends on: FD-01, booking outbox hiện có
- Docs: `docs/architecture/kafka/`, `docs/features/booking-service/API_LIST.md`

---

# AN-02

## Title

`[Infra] Scaffold minimal analytics-service and booking projection`

## Labels

`Layer::Infrastructure`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tạo analytics-service P0 tối giản cùng database projection cho booking/revenue. Service chỉ consume canonical booking events và không query trực tiếp operational database; promotion, loyalty, rating, forecasting và data warehouse nằm ngoài final scope.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Analytics module build trong Maven reactor và chạy trong Docker Compose với database riêng.
- [ ] Có Kafka config, readiness/liveness healthcheck và Gateway route `/api/analytics/**`.
- [ ] Migration tạo `processed_event` và `booking_revenue_fact` với unique constraint trên source event ID.
- [ ] Projection lưu booking, cluster, business date, ticket/concession/discount/final/refund amounts, currency và trạng thái cần cho summary.
- [ ] Refund điều chỉnh net revenue mà không xóa gross revenue lịch sử.
- [ ] Có index theo `clusterId` và business date; migration chạy được trên database sạch.
- [ ] `.env.example` và service README được cập nhật, không chứa credential thật.

## Technical Notes / Constraints

- Không tạo read model cho promotion, loyalty, rating, top movie hoặc occupancy trong P0 nếu event chưa có snapshot tương ứng.
- Không join/query trực tiếp operational database trong dashboard request.
- Timestamp lưu UTC; group theo timezone chi nhánh/business date đã thống nhất.

## Related

- Branch: `feat/minimal-analytics-service`
- Depends on: AN-01, FD-01, FD-02, FD-03
- Docs: `docs/DB_DESIGN.md`, `docker-compose.yml`

---

# AN-03

## Title

`[Backend] Project booking outcomes and expose minimal admin KPIs`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Consume hai booking outcome events để cập nhật projection idempotently và cung cấp một summary API cho Admin Dashboard. P0 không làm replay/backfill, DLT management, source reconciliation hoặc projection từ các bounded context khác.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Consume `BOOKING_CONFIRMED` và `BOOKING_REFUNDED` từ canonical envelope của AN-01.
- [ ] Mỗi event chỉ apply một lần theo event ID; callback/event lặp không double-count.
- [ ] Refund cập nhật refund count/amount và net revenue đúng mà không xóa gross revenue.
- [ ] `GET /api/analytics/admin/summary` filter được theo `clusterId`, `from`, `to` và enforce branch scope.
- [ ] Response trả `confirmedBookings`, `ticketsSold`, `ticketRevenue`, `concessionRevenue`, `grossRevenue`, `refundCount`, `refundAmount`, `netRevenue`, `currency` và `dataThrough`.
- [ ] Có integration test với known dataset cho confirmed, refunded, duplicate event và unauthorized branch.

## Technical Notes / Constraints

- P0 chỉ hỗ trợ currency VND hoặc group rõ theo currency; không cộng nhiều currency vào một total.
- Không suy diễn occupancy/top movie nếu canonical event chưa có seat capacity/movie snapshot.
- Consumer lỗi được retry theo Kafka baseline; UI quản lý DLT và replay thuộc P1.

## API Specifications (if applicable)

### API 1 — Get minimal analytics summary

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/analytics/admin/summary?clusterId={id}&from={date}&to={date}` |
| Description | Trả booking và revenue summary từ analytics projection cùng độ mới dữ liệu. |
| Auth Required | Yes — ADMIN/BRANCH_MANAGER |

## Related

- Branch: `feat/analytics-booking-summary`
- Depends on: AN-01, AN-02, FD-03
- Docs: `docs/architecture/kafka/`

---

# AN-04

## Title

`[Frontend] Connect admin KPI cards to real analytics summary`

## Labels

`Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay các KPI và revenue mock/random trên Admin Dashboard bằng summary API thật. UI P0 chỉ cần chứng minh booking/refund vừa thực hiện làm thay đổi dashboard đúng; không thay toàn bộ ReportPage hoặc xây dashboard BI hoàn chỉnh.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Stat cards hiển thị confirmed bookings, tickets sold, gross revenue, refund và net revenue từ AN-03.
- [ ] Có branch selector, date range và nút Refresh; Branch Manager không chọn branch ngoài scope.
- [ ] Hiển thị ticket/concession revenue breakdown nếu API trả dữ liệu.
- [ ] Hiển thị `dataThrough`/freshness để tránh hiểu nhầm projection là synchronous realtime.
- [ ] Có loading skeleton, empty, error và retry state; không fallback sang hardcoded/random data.
- [ ] Có frontend test chứng minh filter được gửi đúng và KPI refresh sau response mới.

## API Specifications (if applicable)

## UI Reference / Mockup

Giữ Admin Dashboard hiện tại nhưng thay stat cards bằng dữ liệu thật. Một revenue summary/chart đơn giản là đủ; không thêm top movie, occupancy, promotion, loyalty hoặc rating widget trong P0.

## Related

- Branch: `feat/real-admin-analytics-summary`
- Depends on: AN-03
- Docs: `docs/issues/FINAL_DEMO_READINESS_AUDIT_2026-08-01.md`

---

# OB-01

## Title

`[Infra] Propagate correlation IDs across P0 demo services`

## Labels

`Layer::Infrastructure`, `Type::Feature`, `Priority::High`

## Summary / Objective

Cho phép trace một request P0 từ Gateway qua booking, payment, concession, refund và analytics bằng correlation ID thống nhất. Phạm vi nước rút chỉ bổ sung header propagation và MDC/log fields tối thiểu; không triển khai ELK/OpenSearch, distributed tracing backend hoặc một logging platform mới.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Gateway nhận correlation ID hợp lệ hoặc sinh `X-Correlation-Id` mới và trả lại trong response.
- [ ] Booking, Payment, Concession và Analytics đặt correlation ID vào MDC trong thời gian xử lý request/event rồi clear an toàn.
- [ ] HTTP clients và Kafka event envelope của P0 propagate cùng correlation ID.
- [ ] Log có tối thiểu service, correlation ID, operation/outcome và booking/payment/event reference khi đã tồn tại.
- [ ] Không log JWT, internal key, OTP, password, full provider signature hoặc PII không cần thiết.
- [ ] Error response/log có correlation ID để tra cứu.
- [ ] Có một smoke test chứng minh booking → payment outcome → analytics event giữ cùng correlation ID.

## Technical Notes / Constraints

- Không bắt buộc chuyển toàn bộ log sang JSON trong P0; log pattern key-value/MDC có thể tìm kiếm được là đủ.
- Correlation ID không dùng làm Prometheus label.
- Nếu client gửi giá trị quá dài/không hợp lệ, Gateway phải thay bằng ID mới thay vì ghi trực tiếp vào log.

## Related

- Branch: `feat/p0-correlation-id-propagation`
- Depends on: FD-01, FD-02
- Docs: `docs/ERROR_CODE_CONVENTION.md`

---

# OB-02

## Title

`[Backend] Expose booking payment refund and concession business metrics`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Bổ sung một bộ Micrometer metrics nhỏ để theo dõi outcome của booking, payment, refund và concession. Đây là Conditional P0/P1: chỉ bắt đầu sau khi golden path/refund đã xanh và chỉ giữ nếu Observability là nội dung cần trình diễn.

## Estimate

M (2–4h)

## Acceptance Criteria (Definition of Done)

- [ ] Có `booking_confirmed_total` và `booking_failed_total`.
- [ ] Có `payment_success_total`, `payment_failed_total`, `refund_success_total` và `refund_failed_total`.
- [ ] Có `concession_reservation_failed_total`; các metric khác để P1.
- [ ] Tái sử dụng HTTP latency/error metrics của Spring Actuator thay vì tự tạo timer trùng.
- [ ] Labels chỉ dùng bounded values như service, operation, outcome và provider; không dùng booking/account/correlation ID.
- [ ] Prometheus scrape endpoint được bảo vệ/không expose công khai qua customer Gateway route.

## Technical Notes / Constraints

- Metrics là telemetry vận hành, không phải nguồn dữ liệu doanh thu hay báo cáo kinh doanh; Analytics Service vẫn là nguồn KPI Admin.
- Mỗi service owner có thể thêm metrics trong MR nghiệp vụ tương ứng; không bắt buộc một MR sửa đồng thời mọi service.
- Không triển khai Kafka lag/DLT metrics hoặc alerting nâng cao trong issue P0 tối giản.

## Related

- Branch: `feat/demo-business-metrics`
- Depends on: OB-01 và golden path/refund đã pass
- Docs: Spring Actuator/Micrometer configuration hiện có

---

# OB-03

> **OUT-SCOPE FINAL.** Không tạo/nhận issue này trong sprint nước rút. Chỉ mở lại sau khi E2E-01 xanh và Observability dashboard là nội dung bắt buộc phải trình diễn.

## Title

`[Infra] Add optional Prometheus and Grafana operational dashboard`

## Labels

`Layer::Infrastructure`, `Type::Feature`, `Priority::Low`

## Summary / Objective

Sau final, thêm Prometheus/Grafana vào local stack và provision dashboard vận hành cho service health cùng booking/payment/refund/concession flow. Issue không chặn business E2E, refund, reconciliation hoặc Analytics Dashboard.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Prometheus scrape được Gateway và các service P0; target health hiển thị rõ.
- [ ] Grafana datasource/dashboard được provision từ file trong repository.
- [ ] Dashboard tối thiểu có booking/payment/refund success-failure, concession failure, HTTP latency/error rate và service health.
- [ ] Time range và service/branch filter hoạt động trong giới hạn metric labels.
- [ ] Visual threshold cho payment/refund failure spike và service down là đủ; production alert routing thuộc issue khác.
- [ ] README có lệnh chạy và URL đăng nhập local; không commit production credential.

## Related

- Branch: `feat/demo-prometheus-grafana`
- Depends on: OB-02 hoàn thành, E2E-01 xanh và có quyết định đưa Observability vào demo
- Docs: `docker-compose.yml`

---

# E2E-01

## Title

`[Infra] Add full-system extended-demo golden-path and failure-path suite`

## Labels

`Layer::Infrastructure`, `Type::Chore`, `Priority::High`

## Summary / Objective

Tạo automated hoặc scripted full-system suite chứng minh các bounded context mới thực sự tích hợp với booking flow. Suite phải chạy trên deterministic dataset và tạo bằng chứng rõ cho happy path, refund và các failure/idempotency cases quan trọng.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Golden path: movie/showtime → hold seat → concession → promotion → payment → booking confirmed → ticket.
- [ ] Refund path: confirmed booking → cancel → refund requested → provider refunded → booking refunded → reconciliation clean.
- [ ] Rating path: booking/showtime đủ điều kiện → submit verified review → `averageRating`/`reviewCount` cập nhật.
- [ ] Analytics summary phản ánh đúng confirmed booking, ticket/concession revenue, refund và net revenue từ dataset vừa chạy.
- [ ] Callback/event lặp không double-confirm, double-commit promotion, double-refund hoặc double-count analytics.
- [ ] Failure path có payment timeout/late result, expired hold, concession reservation failure và provider refund timeout.
- [ ] Có reset command, expected assertions, runtime logs/correlation IDs và hướng dẫn chạy trong CI/local.
- [ ] Hai lần chạy liên tiếp sau reset đều pass mà không phụ thuộc TMDB/VNPAY production.

## Technical Notes / Constraints

- Ưu tiên API-level E2E với provider stubs có signature thật; UI smoke có thể là lớp bổ sung.
- Test phải dùng fixed clock hoặc relative dates, không hardcode ngày đã qua.
- Không biến E2E suite thành nơi seed dữ liệu không kiểm soát; dùng FD-04.

## Related

- Branch: `test/extended-demo-full-system-e2e`
- Depends on: `#239`, `#240`, `#247`, RR-04, AN-01..AN-04 và toàn bộ vertical slice P0
- Docs: `docs/features/booking-service/DEMO_SCRIPT.md`, `docs/issues/FINAL_DEMO_READINESS_AUDIT_2026-08-01.md`

---

## P1 chỉ tạo sau khi P0 ổn định

Các mục sau có giá trị để hoàn thiện sản phẩm nhưng không nên kéo vào sprint demo nếu P0 chưa xanh:

- `[Infra] Scaffold loyalty-service and register its gateway route`.
- `[Database] Create append-only loyalty ledger and reservation schema`.
- `[Backend] Implement loyalty balance, earn, redeem, reserve, commit, release and reversal APIs`.
- `[Frontend] Build member loyalty wallet and point history`.
- `#248 Integrate loyalty reservation lifecycle`.
- `[Frontend] Build admin loyalty tier and manual adjustment UI`.
- `[Backend] Implement loyalty point expiry scheduler and tier evaluation`.
- `[Backend] Add promotion stacking exclusivity and advanced campaign rules`.
- `[Backend] Implement analytics replay, backfill and source reconciliation`.
- `[Backend] Add analytics projections for promotion, loyalty and rating`.
- `[Backend] Add occupancy and top-movie analytics after canonical events contain the required snapshots`.
- `[Frontend] Replace random report exports with analytics report APIs`.
- `[Backend] Complete remaining booking/payment/refund/concession metrics beyond the OB-02 minimal set`.
- `OB-03 Add optional Prometheus and Grafana operational dashboard`.
- `[Infra] Add production alert routing and escalation policies`.
- `[Frontend] Build admin review moderation queue`.
- `[Backend] Implement review abuse detection and moderation automation`.
- `[Backend] Add scheduled provider reconciliation` nếu manual reconciliation đã đủ cho demo và RR-03 chưa thể hoàn thành an toàn.

## Checklist trước khi tạo thủ công

- [ ] Tìm title/keyword trên GitLab để tránh issue trùng.
- [ ] Với `RV-01..RV-03`, đặt related/parent tracking issue là `#147`; không tạo moderation issue trong final scope.
- [ ] Với promotion, link `#148` và `#247`; không tạo lại targeting/checkout orchestration.
- [ ] Không tạo Loyalty issue trong sprint final; giữ `#248` và toàn bộ Loyalty ở P2/OUT-SCOPE FINAL.
- [ ] Với Analytics, tạo theo thứ tự AN-01 → AN-02 → AN-03 → AN-04; không tạo lại AN-05 cũ.
- [ ] Với Observability, tạo OB-01; chỉ tạo OB-02 khi E2E/refund đã xanh; không tạo OB-03 trong sprint final.
- [ ] Với refund/reconciliation, link `#240`, `#244`, `#260`, `#262`.
- [ ] Gắn đúng một Layer, Type và Priority theo block.
- [ ] Chỉ gắn `In Progress` sau khi có assignee và branch.
- [ ] Điền GitLab issue number mới vào `Depends on`/`Blocks` của các issue liên quan sau khi tạo.
- [ ] Mỗi MR chỉ `Closes` issue mà nó thực sự hoàn thành; issue Epic/parent dùng `Related to`.
