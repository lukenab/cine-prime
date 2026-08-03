# Final Demo Readiness Audit — 2026-08-01

## Summary / Objective

Tài liệu này đối chiếu backlog trong 9 ảnh GitLab, SRS hiện tại, hai tài liệu đặc tả bổ sung và source code tại ngày 2026-08-01 để quyết định việc nào có thể đóng, việc nào mới hoàn thành một phần, và việc nào thực sự cần làm trong 5 ngày cuối.

Mục tiêu final demo được khóa vào một **golden path** duy nhất:

1. Admin import phim từ TMDB.
2. Hoàn thiện và publish phim.
3. Mở movie availability/release window cho CinePrime Landmark 81.
4. Tạo, review và publish release/schedule plan; sinh suất chiếu tự động.
5. Customer tìm phim/suất, chọn ghế, giữ ghế, chọn bắp nước tùy chọn.
6. Thanh toán VNPAY, booking được xác nhận idempotently và nhận ticket QR.

Các hạng mục không làm thay đổi khả năng trình diễn golden path được đánh dấu **OUT-SCOPE FINAL**; không có nghĩa là yêu cầu đó không có giá trị sản phẩm.

---

## Estimate

- [x] XL (> 1 day) — audit, chạy build/test, kiểm tra runtime, UX và lập kế hoạch 5 ngày.

---

## Nguồn kiểm tra và nguyên tắc đánh giá

- Backlog: 9 ảnh GitLab do người dùng cung cấp; không có GitLab API nên trạng thái board chỉ là ảnh chụp tại thời điểm cung cấp.
- SRS hiện tại: `docs/agile/SRS.md` (v1.2, 2026-07-04).
- Mẫu issue: `docs/issues/ISSUE_TEMPLATE.md`.
- Tài liệu bổ sung: `D:\OJTProject\01-srs-analysis.html` và `D:\OJTProject\02-system-design.html`.
- Source và test trong `client/`, `server/`, `docker-compose.yml`.
- UI Home được kiểm tra trực tiếp trên local Vite; backend golden path chưa chạy đầy đủ nên booking funnel được kiểm tra bằng source, test và các ảnh UI đã cung cấp.

Quy ước:

- **DONE-CANDIDATE**: implementation chính đã tồn tại và có bằng chứng test/source; nên verify acceptance criteria rồi đóng.
- **PARTIAL**: có baseline nhưng thiếu một phần quan trọng hoặc test còn đỏ.
- **NOT DONE**: chưa thấy implementation đáp ứng mục tiêu issue.
- **SUPERSEDED**: intent đã được giải quyết bằng contract/flow mới; nên đóng với lý do thay thế thay vì tiếp tục làm API cũ.
- **P0 / P1**: cần cho final demo trong 5 ngày.
- **OUT-SCOPE FINAL**: không chặn golden path đã khóa.

---

## Kết luận điều hành

### Verdict

**Source đã có phần lớn business flow, nhưng hệ thống chưa đạt trạng thái demo-ready.** Rủi ro lớn nhất hiện tại không phải thiếu màn hình mà là runtime chưa đồng bộ và test chưa xanh.

Tại thời điểm audit:

- Docker chỉ chạy `postgres`, `redis`, `kafka`, `discovery-server`, `notification-service`.
- `api-gateway`, `auth-service`, `user-service`, `movie-service`, `booking-service`, `payment-service`, `concession-service` và client không running; một số container ở trạng thái `Created`, số khác `Exited (137)`.
- Frontend production build thành công, nhưng bundle JS khoảng 2.15 MB và video hero khoảng 44.3 MB.
- Frontend test: **58/62 pass**, 4 fail.
- Backend: `booking-service` **9/9 pass**; `concession-service` **10/10 pass**.
- Reactor dừng ở `movie-service`: **364 tests, 1 failure + 6 errors**; `payment-service` bị skip vì fail-fast.
- Trong test movie-service, scheduler còn ghi lỗi SQL vì `seat_hold_rate_window` không tồn tại ở một số test context và scheduler vẫn chạy sau khi Testcontainer bị đóng.

### Go/No-Go gate cho ngày final

Chỉ coi là **GO** khi cả 6 điều kiện sau đều đạt:

- [ ] `docker compose up` khởi động toàn bộ service golden path và health check đều xanh.
- [ ] API Gateway `:8080` gọi được auth, movie, booking, concession và payment.
- [ ] Frontend test 62/62 pass và production build pass.
- [ ] Movie, booking, concession, payment test suites pass; không có scheduled-task exception trong log test/demo.
- [ ] Chạy thành công hai lần liên tiếp golden path từ import TMDB đến ticket QR.
- [ ] Có seed/reset script và phương án fallback khi TMDB hoặc VNPAY sandbox không ổn định.

---

## Checklist ưu tiên 5 ngày

### Ngày 1 — P0 Runtime và dữ liệu demo

- [ ] Khởi động toàn stack bằng một lệnh; xử lý container `Exited (137)` và `Created`.
- [ ] Bổ sung/kiểm tra health check và thứ tự dependency cho gateway, auth, user, movie, booking, concession, payment.
- [ ] Kiểm tra migration của tất cả database, đặc biệt movie/concession/booking/payment.
- [ ] Chuẩn bị tài khoản cố định: Admin, Branch Manager Landmark 81 và Customer đã hoàn tất profile.
- [ ] Chuẩn bị script reset seed cho Landmark 81: cluster, room/layout, price book, concession stock và dữ liệu customer.
- [ ] Không đổi schema/kiến trúc lớn sau khi runtime gate đã xanh.

### Ngày 2 — P0 Movie import → release plan → auto showtime

- [ ] Chuyển TMDB API key khỏi `application.yml` sang environment; rotate key đã lộ trong repository.
- [ ] Chạy import một phim cố định, kiểm tra genre/company/image/trailer và trạng thái DRAFT.
- [ ] Save, submit/review/publish phim; tạo availability tại Landmark 81.
- [ ] Tạo và publish schedule plan, chạy auto-generation, xác nhận suất xuất hiện ở public catalog.
- [ ] Sửa 7 lỗi movie-service test và 4 lỗi frontend test liên quan Movie Editor/showtime board.
- [ ] Chốt một phim/dataset dự phòng đã seed để demo không phụ thuộc TMDB realtime.

### Ngày 3 — P0 Customer booking → concession → payment

- [ ] Chạy seat hold, reload/resume hold, chặn double booking và auto-expire.
- [ ] Đặt vé không bắp nước và có bắp nước tại Landmark 81.
- [ ] Kiểm tra stock thực tế đủ để tránh `Concession items could not be reserved`.
- [ ] Chạy signed VNPAY return/IPN → payment outcome webhook → `CONFIRMED` → ticket QR.
- [ ] Chạy callback lặp lại để chứng minh idempotency; kiểm tra late/failed payment không tạo vé sai.
- [ ] Thêm ít nhất một automated golden-path integration test qua service boundary.

### Ngày 4 — P0/P1 UX và demo hardening

- [ ] Home chỉ hiển thị số liệu/offer/event thật hoặc ẩn section khi API không có dữ liệu.
- [ ] Quick booking có loading, empty, retry rõ ràng; CTA không dẫn vào dead-end.
- [ ] Kiểm tra stepper 5 bước, back navigation, hold timer, expired state, responsive 1366×768 và mobile.
- [ ] Kiểm tra trang food dạng list/quantity stepper, summary phim/rạp/suất/ghế/tổng tiền và thời gian giữ ghế.
- [ ] Kiểm tra lỗi mạng ở từng bước không làm mất bookingId/idempotency key.

### Ngày 5 — Freeze, rehearsal và bằng chứng

- [ ] Freeze feature; chỉ nhận bug chặn demo.
- [ ] Reset dữ liệu rồi chạy 2 buổi rehearsal end-to-end có bấm giờ.
- [ ] Ghi lại API/log/screenshot bằng chứng cho từng bước.
- [ ] Chuẩn bị video/screenshot fallback và booking/ticket đã xác nhận sẵn.
- [ ] Chốt demo script, người thao tác, lời giải thích scope và danh sách known limitations.

---

## Ma trận sẵn sàng của golden path

| Chặng | Implementation hiện có | Audit | Quyết định 5 ngày |
|---|---|---|---|
| TMDB search/import | `TmdbController`, `TmdbService`, mapper và unit tests | PARTIAL | P0: externalize key, harden client tối thiểu, rehearsal bằng phim cố định |
| Movie draft/review/publish | Movie editor và lifecycle backend | PARTIAL | P0: sửa frontend tests, xác nhận save/review/publish trên runtime |
| Availability/release window | CRUD + open/suspend/resume/close | DONE-CANDIDATE | P0 verify dữ liệu Landmark 81 |
| Release/schedule plan | List/detail/revalidate/review/publish | DONE-CANDIDATE | P0 rehearsal một plan cố định |
| Auto showtime | Async generation run, policy, execute, CP-SAT/constraints | PARTIAL | P0 verify runtime; freeze/replan nâng cao để out-scope |
| Public movie/showtime catalog | Public APIs + customer pages | PARTIAL | P0 kiểm tra empty/error và public visibility |
| Seat hold/booking | Persistent hold, idempotency, expiry, inventory lock | DONE-CANDIDATE | P0 E2E + concurrency proof |
| Concession optional step | Public catalog, reservation, attach booking, inventory | DONE-CANDIDATE | P0 seed price/stock Landmark 81 và E2E |
| Payment | VNPAY session/IPN/return + signed outcome webhook | DONE-CANDIDATE | P0 signed round-trip runtime; payment tests chưa chạy trong reactor |
| Confirmation | Auto confirm, ticket pass/QR, pickup code | DONE-CANDIDATE | P0 verify retry/idempotency và ticket rendering |
| Booking email/SMS | Chỉ thấy OTP/activation email baseline | NOT DONE | OUT-SCOPE FINAL; không hứa trong demo |

---

## Phân loại backlog trong 9 ảnh

### Booking, payment và reconciliation

| Issue | Tình trạng audit | Final scope | Ghi chú |
|---|---|---|---|
| #262 Manual Reconciliation Sync API | NOT DONE | OUT-SCOPE FINAL | Có query reconciliation nhưng chưa thấy manual sync/resolve hoàn chỉnh. |
| #261 Admin Query Dashboard APIs | DONE-CANDIDATE | OUT-SCOPE FINAL | Payment attempts/reconciliation query đã có; verify contract trước khi đóng. |
| #260 Integrate Provider Refund API | PARTIAL | OUT-SCOPE FINAL | Có internal refund/local flow; production provider adapter còn manual/pending. |
| #259 Internal API for Refund Request | DONE-CANDIDATE | OUT-SCOPE FINAL | `POST /api/payments/internal/refunds` đã có. |
| #258 Publish Payment Success Event | SUPERSEDED | P0 verify | Kiến trúc hiện dùng signed HTTP outcome webhook thay vì Kafka event; đóng với ADR/contract mới nếu team chấp thuận. |
| #257 Webhook Idempotent State Update | DONE-CANDIDATE | P0 verify | Payment inbox/idempotent state handling đã có. |
| #256 Webhook Endpoint & Signature Verification | DONE-CANDIDATE | P0 verify | `POST /api/internal/payments/webhooks/outcome` và signature test đã có. |
| #250 Booking observability/reconciliation/abuse controls | PARTIAL | OUT-SCOPE FINAL | Có baseline guard/query; thiếu dashboard/tracing/manual redrive đầy đủ. |
| #249 Concession-aware checkout | DONE-CANDIDATE | P0 | Catalog/reservation/attach booking đã tồn tại và concession P0 integration test pass. |
| #248 Loyalty reservation lifecycle | NOT DONE | OUT-SCOPE FINAL | Không chặn customer cash/VNPAY flow. |
| #247 Promotion-aware checkout | NOT DONE | OUT-SCOPE FINAL | Promotion UI hiện không có backend contract hoàn chỉnh. |
| #245 Reliable booking events | DONE-CANDIDATE | P1 verify | Booking outbox/publisher đã có. |
| #244 Auditable booking reconciliation cases | PARTIAL | OUT-SCOPE FINAL | Có case/query; thiếu manual resolution workflow. |
| Hidden: auditable counter sale orchestration | PARTIAL | OUT-SCOPE FINAL | Backend counter-sale có, employee POS UI vẫn mock/incomplete. |
| #240 Policy-driven cancellation/refund orchestration | PARTIAL | OUT-SCOPE FINAL | Cancellation policy baseline có; provider refund production chưa hoàn tất. |
| #239 Booking concurrency and E2E contract tests | PARTIAL | P0 | Unit tests còn ít, chưa có golden-path VNPAY + concession E2E xuyên service. |
| #238 Expire abandoned bookings/late payment compensation | DONE-CANDIDATE | P0 verify | Expiry coordinator/scheduler và late outcome handling đã có. |
| #237 Consume payment result and confirm idempotently | DONE-CANDIDATE | P0 verify | Signed outcome cập nhật booking và issue ticket. |
| #236 Seat reservation + pending booking | DONE-CANDIDATE | P0 | Core orchestration đã có. |
| #183 Release expired seat holds persistently | DONE-CANDIDATE | P0 verify | Có persistent cleanup/expiry behavior. |
| #184 Showtime inventory capacity/counters consistency | DONE-CANDIDATE | P0 verify | Lock/version/capacity/reconciliation logic đã có. |
| #107 Booking expiry scheduled job | DONE-CANDIDATE | P0 verify | Scheduler đã có; cần làm sạch scheduled-task errors trong test. |
| #106 Counter Sale API | DONE-CANDIDATE | OUT-SCOPE FINAL | Backend endpoint tồn tại. |
| #105 Confirm Booking API | SUPERSEDED/PARTIAL | P0 verify | Customer flow được auto-confirm bởi payment outcome; employee explicit-confirm flow cũ không còn là golden path. |
| #109 Employee Booking Search API | DONE-CANDIDATE | OUT-SCOPE FINAL | Cluster booking query đã có. |
| #108 Ticket Detail API | DONE-CANDIDATE | P0 verify | Booking detail và ticket-pass endpoint đã có. |
| #114 Employee Booking Search & Management UI | DONE-CANDIDATE/PARTIAL | OUT-SCOPE FINAL | Trang search/read có; workflow quản trị nâng cao chưa cần final. |
| #113 Employee Counter Sale UI | NOT DONE | OUT-SCOPE FINAL | `TicketSalePage` còn mang tính mock. |

### Movie import, release plan và auto scheduling

| Issue | Tình trạng audit | Final scope | Ghi chú |
|---|---|---|---|
| #235 Version scheduling policies + immutable snapshots | PARTIAL | OUT-SCOPE FINAL | Có policy/plan persistence; chưa chứng minh versioned immutable input snapshot đầy đủ. |
| #234 Protect frozen showtimes + penalize manual changes | NOT DONE/PARTIAL | OUT-SCOPE FINAL | Không thấy rolling replan/freeze stability penalty hoàn chỉnh. |
| #233 Title không đọc được trong ảnh | NEEDS TRIAGE | OUT-SCOPE FINAL mặc định | Cần lấy title/acceptance criteria từ GitLab trước khi quyết định. |
| #231 Distributor commitments/film-plan constraints | NOT DONE | OUT-SCOPE FINAL | Distributor licensing/commitment chưa phải dependency của một demo plan cố định. |
| Hidden: occupancy/revenue/pricing forecasts | NOT DONE | OUT-SCOPE FINAL | UI hiện chỉ có demand proxy; không nên gọi là revenue forecast. |
| #218 Debounced Movie Editor autosave | NOT DONE | OUT-SCOPE FINAL | Editor dùng explicit save; không thấy autosave debounce. |
| #217 Versioned partial update for movie draft | PARTIAL | OUT-SCOPE FINAL | Partial DTO có; chưa thấy optimistic version/If-Match contract. |
| #215 Smart TMDB defaults + override | DONE-CANDIDATE | P0 verify | Mapper/default/override UI đã có. |
| #214 Non-destructive TMDB mapping suggestions | DONE-CANDIDATE | P0 verify | Mapping suggestion/preservation logic đã có. |
| #175 Trustworthy movie lifecycle audit events | PARTIAL | OUT-SCOPE FINAL | Có audit tables/services nhưng actor/event reliability chưa đồng nhất. |
| Hidden: timezone-safe movie release/end schedulers | PARTIAL | P1 | Scheduler còn dấu hiệu dùng system `LocalDate`; cần tránh demo qua timezone boundary. |
| #166 Externalize/rotate movie-service secrets | NOT DONE | P0 | TMDB API key vẫn hardcoded trong `application.yml`; key phải rotate. |
| #142 MovieCast.roleType String → Enum | NOT DONE | OUT-SCOPE FINAL | Không chặn golden path. |
| #143 Keyword search GET `/api/movies` | NOT DONE | OUT-SCOPE FINAL | Public/admin search hiện chưa có keyword contract đúng issue. |
| #196 TMDB ingestion regression/contract tests | PARTIAL | P0 | Nhiều TMDB tests đã có và pass, nhưng toàn movie-service suite đang đỏ. |
| #195 TMDB timeout/rate-limit/cache hardening | NOT DONE | P0 tối thiểu | Raw client chưa có hardening đủ an toàn cho live demo. |
| #187 Movie-service P0 regression/concurrency suite | PARTIAL | P0 | Suite phong phú nhưng hiện 1 failure + 6 errors. |
| #194 Verify Vietnam theatrical release metadata | PARTIAL/NOT DONE | P1 | Có release-date/certification data nhưng release date chưa được xác nhận rõ là VN theatrical. |

### Auth, user và cinema lifecycle

| Issue | Tình trạng audit | Final scope | Ghi chú |
|---|---|---|---|
| #206 Lifecycle-aware cluster/room actions UI | PARTIAL | OUT-SCOPE FINAL | Room lifecycle có baseline; cluster suspension/reactivation/retirement chưa đủ. |
| #201 Auditable retirement lifecycle for clusters/rooms | PARTIAL | OUT-SCOPE FINAL | Audit fields có; retirement workflow chưa hoàn chỉnh. |
| #204 Cluster suspension/reactivation/retirement | NOT DONE | OUT-SCOPE FINAL | Dùng cluster ACTIVE đã seed cho demo. |
| #161 Progressive profiling gate to EMPLOYEE | PARTIAL | P1 | Có profile gating baseline; cần verify các route demo bằng tài khoản cố định. |
| #158 Replace Kafka-polling wait when create Employee | NOT DONE | OUT-SCOPE FINAL | Không tạo employee live trong demo. |
| #157 Cross-check Account role EMPLOYEE | NOT DONE | P1 security | Không thấy cross-check đầy đủ ở employee creation. |
| #156 Restrict Create Account Role free-text to enum | NOT DONE | P1 security | Request còn free-text/uppercase + lookup. |
| #155 Restrict account GET/PUT to ADMIN | NOT DONE | P1 security | GET/PUT vẫn có nguy cơ chỉ yêu cầu authenticated. |
| #154 RBAC on user-service endpoints | NOT DONE | P1 security | Không nên demo bằng account có quyền vượt scope. |

### Promotion, notification và phần bổ trợ

| Issue | Tình trạng audit | Final scope | Ghi chú |
|---|---|---|---|
| #148 Promotion per movie/showtime | NOT DONE | OUT-SCOPE FINAL | Không dùng mã giảm giá trong demo. |
| #147 Rating & Review | NOT DONE | OUT-SCOPE FINAL | Không liên quan golden path. |
| #97 Email template management API | PARTIAL | OUT-SCOPE FINAL | Có static OTP/activation templates; chưa có management API/booking email đầy đủ. |
| #265 Notification schema + migration baseline | NOT DONE | OUT-SCOPE FINAL | Dù ở Review/QA, service hiện chưa có DB/JPA baseline tương ứng. |
| #266 Kafka retry + DLT | NOT DONE | OUT-SCOPE FINAL | Email consumer chưa có retry/DLT hoàn chỉnh. |
| #267 Idempotent notification consumption/history | NOT DONE | OUT-SCOPE FINAL | Chưa thấy persistence/delivery history. |
| #268 Remove hardcoded mail credentials | DONE IN WORKTREE | P1 commit | `application.yml` đã dùng env placeholder, nhưng file đang modified và cần commit/review. |
| #269 Notification concurrency/integration tests | NOT DONE | OUT-SCOPE FINAL | Không chặn ticket QR trên web. |
| #270 Notification error code/status query | NOT DONE | OUT-SCOPE FINAL | Không chặn golden path. |

### Issue không thấy ID đầy đủ trong ảnh

- **Set Up Payment Service — Mock Payment Flow**: intent đã vượt qua mock vì source có VNPAY session/IPN/return. Đề xuất verify sandbox round-trip rồi đóng/supersede.
- **Orchestrate auditable counter sale**: backend có counter-sale endpoint nhưng UI nhân viên chưa hoàn chỉnh; để OUT-SCOPE FINAL.
- Các title bị che một phần phải được đối chiếu trực tiếp trên GitLab trước khi đổi trạng thái board.

---

## SRS gap analysis

### SRS hiện tại đã lỗi thời so với implementation

| Requirement | SRS ghi | Source audit | Hành động |
|---|---|---|---|
| FR-MOV-5 Seat pricing | Planned | Có price book, pricing resolver và snapshot | Cập nhật Done/Partial theo acceptance criteria mới. |
| FR-BOOK-4 Confirm booking | Planned | Payment outcome tự xác nhận và issue ticket | Viết lại requirement theo payment-driven confirmation. |
| FR-BOOK-5 Counter sale | Planned | Backend có, frontend POS chưa hoàn chỉnh | Đánh dấu Partial. |
| FR-BOOK-6 Auto-expire | Planned | Scheduler/coordinator đã có | Đánh dấu Done sau runtime verification. |
| FR-BOOK-7 Employee search | Planned | Backend query + UI search/read đã có | Đánh dấu Done/Partial. |
| FR-PAY-1 Payment | Planned | VNPAY flow đã có | Đánh dấu Done-Candidate, bổ sung signed callback/idempotency AC. |
| FR-NOTI-1 | OTP partial | Activation có; booking email chưa có | Giữ Partial, tách rõ loại notification. |
| Concession | Không define | Có bounded context và customer flow | Bổ sung FR-CON-* và actor/approval/inventory/reservation. |

### Yêu cầu quan trọng được define nhưng chưa hoàn tất

- Promotion/voucher apply (#148/#247): chưa hoàn chỉnh; **OUT-SCOPE FINAL**.
- Loyalty/score lifecycle: tài liệu bổ sung mô tả rõ nhưng source chưa có; **OUT-SCOPE FINAL**.
- Employee counter sale, booking confirmation/print: backend partial, UI chưa sẵn sàng; **OUT-SCOPE FINAL**.
- Booking email/SMS: chưa có; **OUT-SCOPE FINAL**, không đưa vào lời hứa demo.
- RBAC user/account (#154–#157): thiếu; **P1 security**, bắt buộc xử lý nếu final demo có thao tác employee/admin nhạy cảm.
- NFR observability/audit: mới partial; không chặn golden path nhưng phải ghi known limitation.

### Hai tài liệu HTML bổ sung

`01-srs-analysis.html` là đặc tả nghiệp vụ hữu ích cho actor và use case cũ, nhưng booking flow thiên về member/counter conversion, loyalty và chưa định nghĩa online payment/refund/notification chi tiết. Dùng tài liệu này để truy vết phạm vi nghiệp vụ, không dùng trạng thái “đã làm/chưa làm”.

`02-system-design.html` mô tả kiến trúc mục tiêu Node.js/Express, RabbitMQ, Elasticsearch, MinIO, React Query và Socket.IO. Source hiện tại là Java Spring Boot, Spring Cloud Gateway/Eureka, Kafka, PostgreSQL/Redis và React SPA. Tài liệu này **không phải as-built architecture**; cần gắn nhãn legacy/target hoặc cập nhật, nếu không hội đồng có thể phát hiện mâu thuẫn ngay trong phần trình bày kiến trúc.

---

## Audit UI/UX Home và booking funnel

### Home page

Điểm tốt:

- Hero, navigation và CTA có hierarchy rõ.
- Quick booking có `aria-label`, loading/error baseline và hướng cinema-first.
- Customer routes cho movies/cinemas/showtimes/booking đã tồn tại.

P0/P1 findings:

- **P0 — dữ liệu mâu thuẫn:** khi API lỗi, Home vẫn hiển thị “200+ Movies”, “50+ Screens”, ưu đãi, event và testimonial tĩnh nhưng đồng thời báo `0 movies`, `0 cinemas` và API unavailable.
- **P0 — false affordance:** nhiều footer link trỏ `#`; Offers/Events có nội dung marketing chưa gắn backend thật.
- **P0 — brand inconsistency:** footer ghi “CineVault” thay vì CinePrime.
- **P1 — performance:** hero video khoảng 44 MB và JS bundle hơn 2 MB, có nguy cơ lag khi demo/mạng yếu.
- **P1 — recovery:** Quick booking error cần retry button và fallback “Browse movies/cinemas”, không chỉ alert.
- **P1 — content truth:** nếu chưa có promotion/events backend, ẩn section hoặc gắn rõ “Demo content”.

### Booking funnel

Điểm tốt đã có trong source:

- Stepper dùng chung 5 bước: Movie & showtime → Seats → Food → Payment → Confirmation.
- Seat hold idempotency key được lưu để resume sau reload.
- Có countdown, expired handling, max seats, realtime seat updates và profile gate.
- Food là optional; có quantity +/- và combo option selection.
- Summary card hiển thị phim, rạp, phòng, ngày, giờ, ghế, concession, phí, tổng tiền và thời gian giữ ghế.
- Payment có VNPAY, return-state messaging và ticket QR.

Các điểm cần verify/sửa trước final:

- **P0:** E2E runtime hiện chưa chạy vì golden-path services không running.
- **P0:** hết giờ giữ ghế phải khóa mọi CTA và đưa customer về showtime/seat selection bằng một hành động rõ ràng.
- **P0:** lỗi reserve concession phải phân biệt hết hàng, giá/offer chưa cấu hình, hold hết hạn và lỗi hệ thống; không dùng một message chung.
- **P0:** khi bỏ qua food, tổng tiền và booking state phải giữ nguyên; callback payment lặp lại không tạo reservation/ticket trùng.
- **P1:** stepper không nên ám chỉ bước Movie & showtime đã được thực hiện trên cùng page nếu customer vào deep link; bảo đảm trạng thái done/active có ngữ nghĩa và responsive.
- **P1:** `Back` từ payment dùng history (`navigate(-1)`); cần kiểm tra không quay ra ngoài funnel hoặc quay về food đã attach và bị redirect vòng lặp.
- **P1:** promotion tab đang hiện dù backend promotion chưa hoàn chỉnh; nên ẩn cho final hoặc hiển thị disabled “Coming soon”.
- **P1:** test keyboard focus, screen-reader labels, contrast và mobile sticky summary.

### Đánh giá trải nghiệm tổng thể

Booking UI hiện đã gần đúng hướng doanh nghiệp hơn phiên bản trong các ảnh cũ: tone xanh, stepper thống nhất, list concession, summary card và hold timer. Vấn đề còn lại chủ yếu là **runtime truth, failure recovery và consistency**, không nên redesign lớn trong 5 ngày cuối.

---

# Issue drafts theo ISSUE_TEMPLATE

## 1. [Infra] Stabilize one-command final demo stack and health gate

**Labels:** `Layer::Infrastructure`, `Type::Bug`, `Priority::High`, `In Progress`

### Summary / Objective

Đảm bảo toàn bộ service trên golden path khởi động ổn định bằng một lệnh và chỉ báo ready khi dependency thực sự sẵn sàng. Hiện gateway/auth/user/movie/booking/payment/concession/client chưa running; một số container `Exited (137)`.

### Estimate

- [x] XL (> 1 day)

### Acceptance Criteria (Definition of Done)

- [ ] `docker compose up -d --build` hoàn tất mà không có service golden path exit/restart loop.
- [ ] Postgres, Redis, Kafka, Eureka, gateway, auth, user, movie, booking, concession, payment và client đều healthy/ready.
- [ ] Có script health gate trả non-zero nếu bất kỳ service bắt buộc nào chưa sẵn sàng.
- [ ] Migration chạy sạch trên database mới và database hiện hữu.
- [ ] Log 10 phút không có SQL/scheduler/discovery/payment-webhook exception.
- [ ] README có lệnh start, stop, reset và troubleshooting ngắn.

### Technical Notes / Constraints

- Điều tra exit code 137 trước: memory limit, JVM heap và concurrent service startup.
- Không dùng fixed sleep làm readiness; ưu tiên health check và `depends_on: condition`.
- Giữ secret trong environment, không hardcode vào compose/application YAML.

### Related

- Branch: `fix/final-demo-stack-health`
- Depends on: Docker Desktop, all golden-path services
- Docs: `docker-compose.yml`, tài liệu audit này

---

## 2. [QA] Automate the final golden-path booking and payment journey

**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::High`, `In Progress`

### Summary / Objective

Tạo automated integration smoke test chứng minh luồng Landmark 81 từ public showtime đến confirmed ticket, bao gồm seat hold, optional concession, payment outcome và idempotency. Đây là bằng chứng trực tiếp thay cho việc suy luận từ các unit test rời rạc.

### Estimate

- [x] XL (> 1 day)

### Acceptance Criteria (Definition of Done)

- [ ] Seed một customer, movie, cluster/room/layout, showtime, price book và concession stock.
- [ ] Tạo booking giữ ghế thành công và không double-sell khi request cạnh tranh.
- [ ] Chạy cả nhánh không concession và có concession.
- [ ] Signed payment outcome chuyển booking sang confirmed và tạo ticket pass/QR.
- [ ] Gửi outcome lần hai không tạo ticket/reservation hoặc thay đổi tổng tiền lần hai.
- [ ] Hold hết hạn/late payment tạo trạng thái đúng và giải phóng inventory.
- [ ] Test chạy được bằng một lệnh và được ghi vào checklist rehearsal.

### API Specifications

| Field | Details |
|---|---|
| Booking | `POST /api/bookings` |
| Concession | `POST /api/bookings/{bookingId}/concessions` |
| Payment | `POST /api/payments/sessions` |
| Outcome | `POST /api/internal/payments/webhooks/outcome` |
| Ticket | `GET /api/bookings/{bookingId}/ticket-pass` |

### Technical Notes / Constraints

- Reuse idempotency/signature code production; không bypass business checks trong test.
- Tách provider sandbox test và deterministic signed-outcome test để tránh flaky network.

### Related

- Branch: `test/final-golden-path-e2e`
- Depends on: #236, #237, #239, #249, #256, #257
- Docs: booking/payment/concession feature docs

---

## 3. [Backend] Externalize TMDB credentials and harden demo import

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`, `In Progress`

### Summary / Objective

Loại bỏ TMDB key khỏi source và làm import đủ chịu lỗi cho final demo. Chuẩn bị một dataset dự phòng để demo vẫn tiếp tục khi TMDB rate-limit hoặc mất mạng.

### Estimate

- [x] L (4–8h)

### Acceptance Criteria (Definition of Done)

- [ ] `tmdb.api-key` chỉ đọc từ environment và application fail-fast với thông báo rõ khi thiếu.
- [ ] Rotate key đã xuất hiện trong repository; kiểm tra không còn secret bằng repository scan.
- [ ] Client có connect/read timeout hữu hạn và mapping lỗi 401/404/429/5xx rõ ràng.
- [ ] Import retry không tạo movie/media/company trùng.
- [ ] Có phim seed/fallback đã duyệt để tiếp tục release-plan demo khi TMDB unavailable.
- [ ] TMDB unit/contract tests pass.

### API Specifications

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/movies/tmdb/import` |
| Auth Required | ADMIN |

### Technical Notes / Constraints

- Không log API key hoặc full upstream URL có secret.
- Không thêm retry không giới hạn; tôn trọng 429/backoff.

### Related

- Branch: `fix/tmdb-demo-hardening`
- Depends on: #166, #195, #196, #194
- Docs: `docs/agile/SRS.md`

---

## 4. [QA] Restore green frontend and movie-service regression suites

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`, `In Progress`

### Summary / Objective

Khôi phục test gate trước khi freeze final demo. Audit hiện có 4 frontend failures và movie-service có 1 failure + 6 errors; payment-service chưa được chạy vì reactor dừng sớm.

### Estimate

- [x] L (4–8h)

### Acceptance Criteria (Definition of Done)

- [ ] Frontend đạt 62/62 hoặc cao hơn, không sửa test bằng cách xóa assertion có ý nghĩa.
- [ ] Movie Editor tests mock `getRoomMasterData` đúng contract.
- [ ] Showtime board test không phụ thuộc ngày hệ thống cố định.
- [ ] Flyway test kỳ vọng version hiện tại thay vì 49 khi migration đang ở 52.
- [ ] Movie image repository context load thành công.
- [ ] Bulk showtime concurrency fixture tạo ACTIVE cluster + ACTIVE sellable layout.
- [ ] Room layout wizard tests không gặp lazy proxy/no-session.
- [ ] Scheduler không chạy trên schema test thiếu bảng và không giữ datasource sau Testcontainer teardown.
- [ ] Payment-service tests được chạy và pass sau movie-service.

### Technical Notes / Constraints

- Có thể dùng test profile để disable scheduler/Eureka/Kafka trừ test chủ đích kiểm tra chúng.
- Ghi rõ lỗi sản phẩm và lỗi fixture/test isolation; không đánh đồng.

### Related

- Branch: `fix/final-regression-gate`
- Depends on: #187, #196, #239
- Docs: `server/movie-service/target/surefire-reports`

---

## 5. [Frontend] Make Home data truthful and demo-resilient

**Labels:** `Layer::Frontend`, `Type::Bug`, `Priority::High`, `In Progress`

### Summary / Objective

Loại bỏ dữ liệu/CTA gây hiểu nhầm khi backend unavailable và bảo đảm Home luôn dẫn được vào booking funnel. Hiện trang có thể đồng thời báo 0 phim/0 rạp nhưng vẫn quảng cáo 200+ phim, 50+ màn hình và offer/event tĩnh.

### Estimate

- [x] M (2–4h)

### Acceptance Criteria (Definition of Done)

- [ ] Số liệu hero lấy từ API hoặc được thay bằng copy không chứa số giả.
- [ ] Section offer/event/testimonial được ẩn hoặc gắn rõ demo content khi không có backend thật.
- [ ] Quick booking error có Retry và CTA fallback hợp lệ.
- [ ] Footer dùng CinePrime; không còn link `#` có vẻ bấm được.
- [ ] Loading, empty và error state không xuất hiện mâu thuẫn trên cùng trang.
- [ ] Kiểm tra viewport desktop/mobile và keyboard navigation.

### UI Reference / Mockup

- Giữ visual hiện tại; không redesign lớn. Ưu tiên data truth và recovery.

### Technical Notes / Constraints

- Cân nhắc lazy-load/compress hero video và route-level code splitting sau khi P0 runtime ổn định.

### Related

- Branch: `fix/home-demo-truth`
- Depends on: public movie/cinema APIs
- Docs: tài liệu audit này

---

## 6. [Frontend] Harden booking funnel navigation and failure recovery

**Labels:** `Layer::Frontend`, `Type::Bug`, `Priority::Medium`, `In Progress`

### Summary / Objective

Giữ UI booking hiện có nhưng làm rõ recovery cho hold expiry, concession failure, browser back và unsupported promotion. Không thực hiện redesign lớn trong 5 ngày cuối.

### Estimate

- [x] L (4–8h)

### Acceptance Criteria (Definition of Done)

- [ ] Stepper 5 bước đúng active/done state trên seat, food, payment và confirmation.
- [ ] Hết hold khóa CTA và có một đường quay lại chọn suất/ghế rõ ràng.
- [ ] Lỗi concession hiển thị message riêng cho sold-out, offer/price thiếu, hold expired và server error.
- [ ] Back từ payment không thoát ngoài funnel hoặc gây redirect loop sau khi concession đã attach.
- [ ] Promotion tab ẩn/disabled nếu backend chưa hỗ trợ.
- [ ] Refresh/deep link giữ booking state hợp lệ và không tạo duplicate booking/reservation.
- [ ] Responsive, keyboard focus và contrast được kiểm tra.

### UI Reference / Mockup

- Reuse `CheckoutProgress` và `BookingSummaryCard`; tone xanh hiện tại là baseline.

### Related

- Branch: `fix/booking-funnel-recovery`
- Depends on: #236, #238, #249
- Docs: customer booking components

---

## 7. [Docs] Reconcile SRS and system design with the as-built platform

**Labels:** `Type::Docs`, `Priority::Medium`, `In Progress`

### Summary / Objective

Cập nhật SRS và architecture để phản ánh hệ thống thực tế Java/Spring/Kafka và các flow payment/concession hiện có. Gắn nhãn rõ tài liệu legacy/target để tránh mâu thuẫn khi báo cáo final.

### Estimate

- [x] L (4–8h)

### Acceptance Criteria (Definition of Done)

- [ ] FR-MOV-5, FR-BOOK-4/5/6/7, FR-PAY-1 và FR-NOTI-1 phản ánh đúng trạng thái.
- [ ] Bổ sung FR-CON-* cho catalog, SKU/combo, branch offer/stock, reservation và fulfillment.
- [ ] Mô tả payment-driven confirmation, expiry và idempotency.
- [ ] As-built diagram dùng Spring Boot, Gateway/Eureka, Kafka, PostgreSQL/Redis và service ports thật.
- [ ] `01-srs-analysis.html` và `02-system-design.html` được gắn nhãn legacy/reference hoặc thay bằng bản cập nhật.
- [ ] Out-of-scope final (loyalty, promotions, counter POS, notification reliability, production refund) được ghi rõ.

### Technical Notes / Constraints

- Không sửa lịch sử tài liệu để giả vờ requirement đã tồn tại từ đầu; ghi version/changelog minh bạch.

### Related

- Branch: `docs/reconcile-final-srs-architecture`
- Depends on: issue owners xác nhận trạng thái
- Docs: `docs/agile/SRS.md`, `D:\OJTProject\01-srs-analysis.html`, `D:\OJTProject\02-system-design.html`

---

## Out-scope final được chốt

- Loyalty/score lifecycle.
- Promotion/voucher thực tế.
- Rating/review.
- Employee counter POS hoàn chỉnh.
- Production refund provider + manual reconciliation dashboard.
- Notification DB, retry/DLT, delivery history, booking email/SMS.
- Distributor commitment, revenue forecast, rolling replan/frozen-showtime optimization nâng cao.
- Full cluster retirement/reactivation lifecycle.
- Movie autosave/versioned collaboration.
- Search/SEO/performance optimization ngoài các lỗi gây lag trực tiếp trong demo.

Nếu giảng viên yêu cầu một hạng mục trong danh sách này, phải đổi scope bằng quyết định rõ ràng và bỏ một hạng mục P1 tương ứng; không mở rộng song song.

---

## Demo script đề xuất (8–12 phút)

1. Đăng nhập Admin; mở TMDB Catalog, import phim cố định.
2. Mở Movie Editor, giải thích dữ liệu provenance/default; submit/publish.
3. Tạo availability tại CinePrime Landmark 81.
4. Tạo auto-generation run, xem diagnostics, publish schedule plan.
5. Chuyển Customer; Home/Movies → suất tại Landmark 81.
6. Chọn ghế, chỉ ra realtime lock và countdown.
7. Thêm một combo hoặc skip; kiểm tra summary.
8. Thanh toán VNPAY sandbox; quay lại hệ thống.
9. Hiển thị booking `CONFIRMED`, ticket QR và concession pickup code.
10. Nếu còn thời gian, mở My Bookings hoặc thử callback lặp để giải thích idempotency.

Fallback:

- Nếu TMDB lỗi: dùng phim seed đã publish và nói rõ upstream fallback.
- Nếu VNPAY sandbox lỗi: dùng deterministic signed payment-outcome test/demo endpoint trong môi trường demo, không sửa trực tiếp DB.
- Nếu UI mất kết nối: dùng screenshot/video đã quay từ rehearsal và API evidence, sau đó trình bày known limitation.

---

## Acceptance Criteria của audit này

- [x] Phân loại các issue nhìn thấy trong backlog thành done-candidate/partial/not-done/superseded.
- [x] Xác định P0/P1 trong 5 ngày và out-scope final.
- [x] Đối chiếu SRS hiện tại và hai tài liệu bổ sung với source thực tế.
- [x] Audit Home và booking UX ở mức phù hợp với runtime hiện có.
- [x] Ghi kết quả build/test/runtime có thể tái kiểm tra.
- [x] Soạn issue drafts theo `ISSUE_TEMPLATE.md`.

---

## Related

- Branch đề xuất: `docs/final-demo-readiness-audit`
- Depends on: xác nhận issue titles/acceptance criteria trực tiếp từ GitLab
- Docs: `docs/issues/ISSUE_TEMPLATE.md`, `docs/agile/SRS.md`, các feature demo/readiness docs hiện có
