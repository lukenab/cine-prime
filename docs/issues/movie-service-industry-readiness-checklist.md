# Movie Service — Industry Readiness Checklist

> Baseline code review: **2026-07-14**  
> Scope: Movie lifecycle, TMDB ingestion, Cinema Cluster, Cinema Room, physical seat layout, Showtime và showtime-seat inventory.  
> Mục tiêu: tạo backlog có thể assign và kiểm thử; không tuyên bố hệ thống đạt chuẩn pháp lý hoặc production chỉ vì đã có CRUD.

## 1. Cách sử dụng

### Ký hiệu trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| `Covered` | Code hiện tại đã enforce rule cốt lõi; vẫn cần regression test khi thay đổi liên quan. |
| `Partial` | Đã có một phần nhưng còn lỗ hổng nghiệp vụ, integration hoặc migration. |
| `Gap` | Chưa implement hoặc implementation hiện tại không bảo vệ được business rule. |
| `Backlog` | Có giá trị enterprise nhưng không chặn demo Sprint 3. |

### Mức ưu tiên

| Priority | Khi nào dùng |
|---|---|
| `P0` | Có thể làm lộ nội dung chưa duyệt, sai lịch chiếu, bán trùng ghế, sai tiền hoặc làm API runtime lỗi. |
| `P1` | Cần để vận hành sát rạp thực tế, cải thiện audit, dữ liệu và UX quản trị. |
| `P2` | Tối ưu hoặc mở rộng enterprise; không nên làm trước khi P0 ổn định. |

### Nguyên tắc đánh dấu Done

- [ ] Không đóng issue chỉ vì code đã merge; migration, API contract, UI và test phải cùng đồng bộ.
- [ ] Mỗi P0 phải có ít nhất một happy-path test và một negative/concurrency test tương ứng.
- [ ] `Build passed` không đồng nghĩa `runtime passed`; phải chạy với database đã migrate.
- [ ] Rule quan trọng phải được backend enforce; frontend validation chỉ hỗ trợ UX.
- [ ] Tất cả transition, cancel, lock và price change phải có audit actor thật.

---

## 2. Ma trận tổng quan để tạo/assign issue

| ID | Layer | Vấn đề / Business Rule | Hiện trạng | Priority | Size |
|---|---|---|---|---|---|
| `SEC-01` | Infra/Backend | Secret và credential không nằm trong source code | Gap | P0 | S |
| `DB-01` | Database/Backend | Migration phải tự động, có version và chạy được trên DB hiện hữu | Done | P0 | M |
| `MOV-01` | Backend | Partial update không được ghi đè field không gửi thành `null` | Gap | P0 | S |
| `MOV-02` | Backend/Frontend | Tách API catalog nội bộ và catalog public; không lộ DRAFT/REJECTED | Partial | P0 | M |
| `MOV-03` | Backend | Readiness validation trước submit/approve/release | Gap | P0 | M |
| `MOV-04` | Backend/Frontend | Workflow approval tách khỏi public exhibition lifecycle | Partial | P0 | M |
| `MOV-05` | Backend | Scheduler release-date và end-date idempotent, timezone-safe | Partial | P0 | M |
| `MOV-06` | Backend/Database | Audit actor/action/before-after đúng cho mọi thay đổi | Gap | P0 | M |
| `MOV-07` | Backend/Database | Movie identity và duplicate rule theo external ID/title-year-language | Partial | P1 | M |
| `MOV-08` | Backend/Database | Metadata phân loại và giấy phép phát hành tại Việt Nam | Gap | P1 | M |
| `TMDB-01` | Backend/Frontend | Browse Now Playing/Upcoming theo region, vẫn giữ search | Gap | P1 | M |
| `TMDB-02` | Backend | TMDB chỉ enrich metadata; không tự publish và phải lưu provenance | Partial | P1 | M |
| `CLU-01` | Backend/Frontend | Maker-checker/self-approval phải là policy rõ ràng | Partial | P1 | M |
| `CLU-02` | Frontend | Không được nuốt lỗi API room rồi hiển thị nhầm “No rooms” | Gap | P0 | S |
| `ROOM-01` | Database/Backend | Schema layout và seat-zone phải đồng bộ trên DB hiện tại | Partial | P0 | M |
| `ROOM-02` | Backend/Frontend | Seat map là cấu hình vật lý/versioned, không chỉ là tỷ lệ theo RoomType | Partial | P1 | L |
| `ROOM-03` | Backend/Database | Capacity limit phải cấu hình theo phòng/layout, không coi 100/200/300 là chuẩn ngành | Gap | P1 | M |
| `ROOM-04` | Backend | Room maintenance/closed phải chặn scheduling và bảo toàn lịch sử | Partial | P1 | M |
| `SEAT-01` | Backend/Database | Couple/Sofa phải có capacity hoặc seat-group và được bán atomically | Gap | P0 | L |
| `SEAT-02` | Backend/Frontend | Accessible/companion seat dựa trên layout và selection rule | Partial | P1 | M |
| `ST-01` | Backend | Chỉ schedule phim/phòng/cluster đủ điều kiện vận hành | Gap | P0 | M |
| `ST-02` | Backend/Database | `formatId` và `basePrice` phải được lưu/enforce thật | Gap | P0 | M |
| `ST-03` | Backend/Database | Overlap tính cả trailer/cleaning buffer và status hợp lệ | Partial | P0 | M |
| `ST-04` | Backend/Frontend | Showtime lifecycle: on-sale, suspend, cancel, complete; không hard-delete lịch sử | Gap | P0 | L |
| `INV-01` | Backend | Showtime-seat được materialize khi tạo showtime, không ghi DB trong GET | Gap | P0 | M |
| `INV-02` | Backend/Database | Lock seat atomic/pessimistic; không double-book hoặc partial lock | Gap | P0 | M |
| `INV-03` | Backend/Database | Lock có owner/hold token/idempotency key | Gap | P0 | M |
| `INV-04` | Backend | Expired reservation phải được release thật trong DB | Gap | P0 | M |
| `INV-05` | Backend/Database | Capacity/sold/available counters nhất quán với Couple và inventory | Gap | P0 | M |
| `API-01` | Backend | Security matrix theo endpoint/role; public chỉ đọc dữ liệu được publish | Partial | P0 | M |
| `API-02` | Backend/Frontend | HTTP status, response code và error contract nhất quán | Partial | P1 | M |
| `TEST-01` | QA/Backend/Frontend | Regression suite cho toàn flow và concurrency | Gap | P0 | L |
| `OPS-01` | Backend/Infra | Observability, scheduler metrics và reconciliation job | Backlog | P1 | M |

---

## 3. Checklist chi tiết

## 3.1 Security, configuration và database migration

### `SEC-01` — Externalize and rotate secrets (`P0`)

Hiện cấu hình service có credential được đặt trực tiếp trong application configuration.

- [ ] Chuyển JWT signing key, TMDB credential và Cloudinary credential sang environment/secret store.
- [ ] Rotate các credential đã từng commit hoặc chia sẻ trong source/history.
- [ ] Tạo `.env.example` chỉ chứa tên biến, không chứa giá trị thật.
- [ ] Startup fail-fast với message rõ khi production thiếu secret bắt buộc.
- [ ] CI secret scan không phát hiện credential mới.

### `DB-01` — Versioned migration as source of truth (`P0`) — **Done**

Flyway wired into `movie-service` (`server/movie-service/src/main/resources/db/migration/`,
`spring.flyway.enabled=true`, `ddl-auto` stays `none`). `docs/database/movie-service/V*.sql`
consolidated into one `V1__baseline_schema.sql` (DDL) + `R__seed_reference_data.sql`
(idempotent reference data) — see `docs/database/movie-service/README.md` for why a single
baseline was chosen over replaying 30+ historical files verbatim. The old files stay in
place as historical/audit reference only.

- [x] Đưa migration vào Flyway runtime path (`spring.flyway.*` in `application.yml`).
- [x] Fresh database và upgraded/hand-migrated database đều chạy cùng integration suite
      (`FlywayMigrationIntegrationTest` — Testcontainers, 2 scenarios, both green).
- [x] Migration forward-only; `baseline-on-migrate` + `baseline-version: 1` lets the
      shared dev database (already fully migrated by hand, no `flyway_schema_history`)
      adopt Flyway without replaying DDL against tables that already exist.
- [x] Schema-history table (`flyway_schema_history`) + fail-fast validation: Flyway
      refuses app startup if the DB's applied migrations don't match what's on disk;
      `/actuator/flyway` (authenticated) and `/actuator/health` (public) also exposed.
- [x] Rollback policy documented (`docs/database/movie-service/ROLLBACK.md`) — forward-fix
      only, no destructive auto-downgrade, backward-compatible app/schema deploy ordering.
- [x] Bonus: adding Flyway surfaced a real latent bug — `no_overlapping_showtimes` (the
      overlap-prevention EXCLUDE constraint) had never actually applied successfully to
      any database (its `::text` cast wasn't IMMUTABLE, silently rejected). Fixed in `V2`
      using `date + time` arithmetic instead, verified against live `show_time` data first
      (zero overlapping rows) before applying.
- [ ] API trả lỗi vận hành rõ; frontend không biến HTTP 500 thành empty state — **out of
      scope for this item**, tracked separately under `CLU-02`.

---

## 3.2 Movie master data và lifecycle

### `MOV-01` — Safe partial update (`P0`)

`MovieMapper.updateMovieFromRequest()` hiện chưa cấu hình ignore-null, nên request thiếu field có thể ghi đè dữ liệu cũ thành `null`.

- [ ] Dùng `NullValuePropertyMappingStrategy.IGNORE` hoặc update scalar fields có chủ đích.
- [ ] Quy định rõ: `null` = không thay đổi; muốn xóa dùng explicit clear operation hoặc field riêng.
- [ ] Collection `genres/formats/cast/translations` chỉ replace khi field xuất hiện trong request.
- [ ] Test update một field không làm mất title, dates, URLs, company hoặc relationships khác.
- [ ] Test explicit clear theo contract đã chọn.

### `MOV-02` — Internal catalog vs public catalog (`P0`)

Đã có `/api/movies/public`, nhưng `GET /api/movies`, `GET /api/movies/{id}` vẫn public và có thể trả status nội bộ.

- [ ] Customer API chỉ trả `COMING_SOON`/`NOW_SHOWING` và dữ liệu đủ điều kiện publish.
- [ ] DRAFT, PENDING_REVIEW, REJECTED, SUSPENDED, ENDED không lộ qua customer detail bằng cách đoán ID.
- [ ] Internal API (`/admin` hoặc `/internal`) yêu cầu ADMIN/EMPLOYEE và hỗ trợ filter mọi status.
- [ ] Frontend customer chỉ gọi public contract; admin chỉ gọi internal contract.
- [ ] Security tests cho list, detail và ID enumeration.

### `MOV-03` — Readiness gates (`P0`)

- [ ] `Submit for review`: title, original language, runtime, genre, format và release window hợp lệ.
- [ ] `Approve`: có age classification, poster/primary image, synopsis/localized title cần thiết và không có reference lỗi.
- [ ] `Release/NOW_SHOWING`: movie đã approved, ngày hiện tại trong release window và có ít nhất một showtime hợp lệ nếu policy yêu cầu.
- [ ] `releaseDate <= endDate`; không nhận date range đảo ngược.
- [ ] Phim classification `C` không được publish/schedule.
- [ ] API trả danh sách field/rule chưa đạt thay vì message chung chung.
- [ ] Mỗi gate có negative unit/service test.

### `MOV-04` — Approval và exhibition lifecycle (`P0`)

Practice nên tách “nội dung đã duyệt” khỏi “đang hiển thị/đang chiếu”.

- [ ] Employee create → `DRAFT`; Employee submit → `PENDING_REVIEW`.
- [ ] Admin create mặc định vẫn là `DRAFT`; self-approve là action rõ (`Save & Approve`), không side effect âm thầm của Create.
- [ ] Cân nhắc thêm `APPROVED` hoặc tách `workflow_status` và `exhibition_status`.
- [ ] Nếu giữ state machine hiện tại, document rõ `APPROVE → COMING_SOON` là quyết định MVP.
- [ ] Reject bắt buộc reason; rework giữ rejection history.
- [ ] Quy định maker-checker: có/không cho cùng user tạo và duyệt phải là configuration/policy rõ.
- [ ] Mỗi transition kiểm tra current status và role ở backend.

### `MOV-05` — Release/end scheduler (`P0`)

Hiện đã có auto-end, nhưng chưa có scheduler `COMING_SOON → NOW_SHOWING`.

- [ ] Auto-release các phim đủ readiness khi `releaseDate <= businessDate`.
- [ ] Auto-end theo semantics được chốt: `endDate < today` nghĩa phim vẫn chiếu hết ngày `endDate`.
- [ ] Inject `Clock` và cấu hình timezone/business date; không gọi `LocalDate.now()` rải rác.
- [ ] Scheduler idempotent và an toàn khi nhiều instance service chạy đồng thời.
- [ ] Scheduler ghi audit event và metric số record transitioned/failed.
- [ ] Test boundary trước/đúng/sau releaseDate và endDate.

### `MOV-06` — Audit trail (`P0`)

Hiện create log hard-code actor `Admin/SYSTEM`, không phản ánh Employee thật.

- [ ] Lấy `actorId`, username, role từ authenticated principal/header tin cậy.
- [ ] Chuẩn hóa `actionType`: CREATE, UPDATE, SUBMIT, APPROVE, REJECT, RELEASE, SUSPEND, REINSTATE, END, IMPORT.
- [ ] Lưu `fromStatus`, `toStatus`, reason, timestamp và correlation/request ID.
- [ ] Không overwrite hoặc xóa lịch sử reject/rework.
- [ ] Scheduler dùng actor `SYSTEM:SCHEDULER`, không giả làm Admin.
- [ ] Audit API chỉ cho role nội bộ phù hợp.

### `MOV-07` — Movie identity and duplicate detection (`P1`)

- [ ] Unique `tmdb_id` khi không null.
- [ ] Không dùng chỉ `originalTitle` làm duplicate key.
- [ ] Fallback identity: normalized title + release year + original language; cho phép remake cùng tên khác năm.
- [ ] Hỗ trợ merge/manual override khi external source trùng nhưng local record đã có.
- [ ] Multiple production companies dùng join table; distributor/exhibitor rights không đồng nhất với production company.

### `MOV-08` — Vietnam classification and release authorization (`P1`)

- [ ] Hỗ trợ rating code `P`, `K`, `T13`, `T16`, `T18`, `C` và display warning tương ứng.
- [ ] Bổ sung metadata: classification/license number, issued date, issuing authority, distributor/importer nếu scope yêu cầu.
- [ ] `C` bị chặn khỏi public catalog và showtime.
- [ ] Không coi certification từ TMDB là nguồn pháp lý cuối cùng; Admin phải xác nhận dữ liệu Việt Nam.
- [ ] Customer UI hiển thị rating rõ trên movie detail/showtime/booking.
- [ ] Enforcement tuổi/guardian được phối hợp với booking/user service, không chỉ lưu enum trong movie-service.

---

## 3.3 TMDB ingestion

### `TMDB-01` — Browse-first import experience (`P1`)

- [ ] Khi mở modal, tự tải `Now Playing` với `region=VN`, `language=vi-VN`.
- [ ] Có tab `Upcoming`; `Trending Today` chỉ là suggestion, không đồng nghĩa đang chiếu ở Việt Nam.
- [ ] Giữ search theo title làm fallback.
- [ ] Pagination/load-more; không tải toàn bộ catalog một lần.
- [ ] Đánh dấu/disable item có `tmdbId` đã import.
- [ ] Backend cache ngắn hạn và xử lý TMDB `429`/timeout/fallback rõ ràng.

### `TMDB-02` — Controlled metadata enrichment (`P1`)

- [ ] Chọn item → preview details → populate form; không auto-save/auto-publish.
- [ ] Import luôn tạo DRAFT hoặc đi qua action `Save & Approve` rõ ràng.
- [ ] Lưu `metadataSource`, `sourceId/tmdbId`, `importedAt`, `lastSyncedAt` và actor.
- [ ] Admin sửa được local title, rating, dates, poster và translations trước publish.
- [ ] Re-sync không overwrite field đã được local editor lock/override.
- [ ] TMDB release/certification được xem là metadata tham khảo, không thay thế distributor slate hoặc giấy phép địa phương.

---

## 3.4 Cinema Cluster và Cinema Room

### `CLU-01` — Cluster approval policy (`P1`)

- [ ] Employee create → DRAFT → submit → Admin approve/reject.
- [ ] Nếu Admin create → ACTIVE, UI và audit phải nói rõ đây là self-approval policy.
- [ ] Có thể cấu hình maker-checker nếu doanh nghiệp không cho người tạo tự duyệt.
- [ ] Chỉ ACTIVE cluster xuất hiện ở public catalog và nhận room/showtime mới.
- [ ] Delete cluster có room bị chặn; ngừng vận hành dùng INACTIVE thay hard delete.

### `CLU-02` — Honest loading/error/empty state (`P0`)

Trang Cluster Detail hiện dùng `Promise.allSettled()` nhưng không surface lỗi room request.

- [ ] Room API reject/500 phải hiện “Failed to load rooms” và nút Retry.
- [ ] Chỉ hiện “No rooms” khi request thành công với `[]`.
- [ ] Không dùng `cluster.totalRooms` để che việc room list failed.
- [ ] Log correlation/request ID để truy DB/schema error.
- [ ] Integration test cluster count > 0 nhưng room API failure.

### `ROOM-01` — Seat-zone schema rollout (`P0`)

Ba field `standardRowCount`, `vipRowCount`, `coupleRowCount` đã có ở code/migration nhưng cần rollout runtime.

- [ ] Apply V14 và verify dữ liệu room cũ được backfill hợp lệ.
- [ ] Sum của ba zone bằng `numberOfRows` ở request, service và DB constraint.
- [ ] Couple row yêu cầu row width chẵn hoặc policy layout phù hợp.
- [ ] API response và frontend model luôn trả đủ layout fields.
- [ ] Targeted unit tests chưa đủ; thêm integration test tạo room → generate seats → GET room/seats.

### `ROOM-02` — Physical, editable and versioned seat layout (`P1`)

Autogeneration chỉ nên là template khởi tạo; layout vật lý đã duyệt mới là source of truth.

- [ ] Admin có preview và chỉnh từng row/seat/aisle trước khi activate room.
- [ ] Lưu tọa độ/row/column/area/type/group từ layout, không tái suy ra theo RoomType khi đọc.
- [ ] Layout có trạng thái DRAFT/ACTIVE và version.
- [ ] Showtime liên kết `seatLayoutId/version`; sửa layout không làm biến đổi showtime đã bán vé.
- [ ] Sau khi room có showtime/booking, thay đổi topology phải tạo version mới.
- [ ] Seat maintenance chỉ đổi availability, không phá historical identity.

### `ROOM-03` — Capacity rules are configurable (`P1`)

- [ ] `STANDARD=100`, `LARGE=200`, `IMAX=300` chỉ là product defaults, không được mô tả là giới hạn ngành/pháp lý.
- [ ] Capacity thực tế đến từ approved physical layout và safety/site configuration.
- [ ] Giới hạn row/column/capacity là configurable guardrail theo tenant/site/room type.
- [ ] Backend vẫn giới hạn để chống payload bất thường, nhưng error message nói rõ đây là system policy.
- [ ] Row label hỗ trợ A..Z, AA..; UI vẫn kiểm tra usability với phòng quá nhiều hàng.

### `ROOM-04` — Room operational lifecycle (`P1`)

- [ ] Chỉ room ACTIVE trong cluster ACTIVE được tạo showtime mới.
- [ ] MAINTENANCE/TEMPORARILY_UNAVAILABLE/CLOSED chặn scheduling.
- [ ] Maintenance có start/end, severity, reason, actor và resolution.
- [ ] Khi room bị sự cố, showtime tương lai phải được review/reassign/cancel theo policy.
- [ ] Room đã có showtime không hard-delete; dùng CLOSED và giữ lịch sử.

---

## 3.5 Seat type, Couple/Sofa và accessibility

### `SEAT-01` — Couple/Sofa inventory model (`P0`)

Hiện `COUPLE colSpan=2` tạo một Seat record đại diện hai vị trí, nhưng schema chưa có capacity nên counters/booking quantity mơ hồ.

- [ ] Chốt một trong hai model và document contract:
  - [ ] **MVP:** một sellable unit, `capacity=2`, một seat code/group code, một atomic lock.
  - [ ] **Enterprise-like:** hai hoặc nhiều Seat records cùng `seat_group_id`, purchase policy `ALL_OR_NOTHING`.
- [ ] Nếu dùng group, mỗi physical seat có code riêng và group có `groupCode`, `capacity`, `groupType`, `purchasePolicy`.
- [ ] Backend tự expand selection thành toàn group; không dựa vào frontend.
- [ ] Price semantics rõ: giá cho cả group hay mỗi person/ticket.
- [ ] `totalSeats`, `soldSeats`, `availableSeats` tính theo cùng một đơn vị (physical capacity hoặc sellable units), không trộn hai loại.
- [ ] Maintenance một thành phần phải block toàn group nếu group không thể bán đầy đủ.
- [ ] Concurrency test hai user cùng chọn hai phía của một Couple/Sofa.

### `SEAT-02` — Accessible and companion seating (`P1`)

- [ ] Accessible location dựa trên approved layout/aisle, không coi công thức 1% là chuẩn pháp lý chung.
- [ ] Phân biệt wheelchair space và companion seat nếu triển khai booking thực tế.
- [ ] Companion selection rule được backend validate theo policy.
- [ ] Không tự chuyển accessible seat sang VIP/Couple chỉ vì zone percentage.
- [ ] UI có legend, accessible label và thông báo sử dụng phù hợp.

---

## 3.6 Showtime scheduling

### `ST-01` — Eligibility gate before scheduling (`P0`)

Hiện create showtime mới chỉ kiểm tra movie/room tồn tại, chưa kiểm tra operational readiness.

- [ ] Movie ở status được phép schedule (`APPROVED/COMING_SOON/NOW_SHOWING` theo thiết kế đã chọn).
- [ ] `showDate` nằm trong release/end window và phim không SUSPENDED/ENDED/C-rated.
- [ ] Cluster ACTIVE và room ACTIVE.
- [ ] Runtime > 0; required metadata/format tồn tại.
- [ ] Không mở bán nếu movie chưa publish hoặc room unavailable.
- [ ] Negative test cho từng status không hợp lệ.

### `ST-02` — Format, language and price are real data (`P0`)

Schema có `format_id/base_price`, nhưng create request/service hiện chưa lưu format và `basePrice` request bị bỏ qua.

- [ ] `CreateShowTimeRequest` nhận `formatId` và service lưu vào entity.
- [ ] Format phải thuộc danh sách format của movie và được room/equipment hỗ trợ.
- [ ] `basePrice` được lưu hoặc bỏ khỏi contract; không nhận field rồi silently ignore.
- [ ] Tách `showtime_price`/pricing plan nếu có giá theo seat type/ticket type/channel.
- [ ] Validate audio/subtitle language; response trả format/language/subtitle rõ.
- [ ] API/DB/entity/request/response cùng một contract.

### `ST-03` — Time model and overlap (`P0`)

Đã có overlap query và DB exclusion constraint, nhưng khoảng chiếm phòng hiện chỉ bằng runtime phim.

- [ ] Phân biệt advertised start, film start, film end và room release/cleanup end.
- [ ] Overlap dùng khoảng room occupancy, gồm trailer/advertisement và cleaning/turnaround buffer.
- [ ] Buffer cấu hình theo site/room/format, không hard-code trong nhiều service.
- [ ] Quyết định rõ hỗ trợ suất qua nửa đêm; nếu có, dùng timestamp thay `showDate + LocalTime`.
- [ ] Bỏ hoặc cấu hình rule “phải schedule trước 3 ngày”; rạp có thể cần same-day operational changes.
- [ ] Cancelled showtime không chặn slot; status khác phải có rule rõ.
- [ ] Application check và DB constraint dùng cùng semantics.
- [ ] Concurrent create cùng room/time chỉ một request thành công.

### `ST-04` — Showtime lifecycle and cancellation (`P0`)

- [ ] Endpoint/action rõ cho `SCHEDULED → ON_SALE`.
- [ ] Auto/explicit `ON_SALE → COMPLETED` sau khi kết thúc.
- [ ] Suspend/close sale không làm mất seat/order history.
- [ ] Cancel bắt buộc reason, actor, timestamp và idempotency.
- [ ] Cancel chuyển inventory phù hợp sang CANCELLED/BLOCKED và phát event cho booking/payment refund workflow.
- [ ] Showtime đã có booking không hard-delete; delete chỉ dùng cho draft/no-sale theo policy.
- [ ] Update room/time/movie bị chặn sau khi đã bán vé hoặc đi qua reschedule workflow.
- [ ] Public API chỉ trả showtime bookable/visible theo status và cutoff.

---

## 3.7 Showtime-seat inventory và booking safety

### `INV-01` — Materialize inventory on write, not read (`P0`)

Hiện `GET /showtimes/{id}/seats` có thể lazy-create `showtime_seat`, tức GET đang mutate database.

- [ ] Tạo toàn bộ showtime-seat snapshot trong transaction tạo showtime.
- [ ] Nếu snapshot fail thì rollback showtime.
- [ ] GET seat availability là read-only và không tạo dữ liệu.
- [ ] Reconciliation job chỉ sửa dữ liệu bất thường theo operation rõ, không nằm trong customer GET.
- [ ] Unique `(showtime_id, seat_id)` và snapshot seat code/type/price được verify.

### `INV-02` — Atomic seat locking (`P0`)

`lockSeats()` hiện đọc và save từng seat, không có pessimistic/conditional atomic lock.

- [ ] Verify tất cả seat ID thuộc đúng `showtimeId`; không cho lock ID từ showtime khác.
- [ ] Lock toàn bộ selection/group trong một transaction theo thứ tự ID ổn định.
- [ ] Dùng `PESSIMISTIC_WRITE` hoặc atomic `UPDATE ... WHERE status=AVAILABLE` và kiểm tra affected rows.
- [ ] Nếu một seat không available thì rollback toàn bộ request.
- [ ] Không trả `RuntimeException`; dùng domain error code chuẩn.
- [ ] Concurrency test chứng minh chỉ một user thắng cùng seat/group.

### `INV-03` — Lock ownership and idempotency (`P0`)

- [ ] Mỗi hold có `holdToken/reservationId`, user/session owner và expiration.
- [ ] Cùng idempotency key gọi lại không tạo hold thứ hai.
- [ ] Chỉ owner/authorized booking mới confirm hoặc release hold.
- [ ] Không dùng `bookingId` chỉ sau SOLD để thay thế ownership của RESERVED.
- [ ] Không expose thông tin owner cho customer khác.

### `INV-04` — Expiry and release (`P0`)

- [ ] Scheduler thực sự update RESERVED hết hạn về AVAILABLE trong DB.
- [ ] Expiry query có index và batch limit.
- [ ] Scheduler idempotent, multi-instance safe và có metric.
- [ ] `toDto()` không chỉ “hiển thị như available” trong khi DB vẫn RESERVED.
- [ ] Confirm sau expiry thất bại rõ ràng; race confirm-vs-expire được test.

### `INV-05` — Inventory counters and reconciliation (`P0`)

- [ ] Chốt unit của `totalSeats/soldSeats/availableSeats`: persons, physical positions hoặc sellable units.
- [ ] Couple/Sofa capacity được tính nhất quán.
- [ ] SOLD chỉ được set sau booking/payment contract đã chọn.
- [ ] Counter update transactional hoặc được derive từ inventory; không để drift âm/vượt capacity.
- [ ] Reconciliation job so sánh snapshot counters với showtime-seat và cảnh báo mismatch.

---

## 3.8 API, authorization, quality và operations

### `API-01` — Authorization matrix (`P0`)

- [ ] Public: movie/showtime/seat availability đã publish và bookable.
- [ ] Employee: tạo/chỉnh draft, submit và vận hành trong quyền được giao.
- [ ] Admin: approve/reject, reference data, schedule/cancel và room lifecycle.
- [ ] TMDB browse/details/import không public chỉ vì path nằm dưới `/api/movies/**`; method-security test phải chứng minh ADMIN-only.
- [ ] Lock/confirm/release seat yêu cầu authenticated context/service credential phù hợp.
- [ ] Gateway headers không được client giả mạo; resource server lấy actor từ verified JWT.

### `API-02` — Contract consistency (`P1`)

- [ ] Chuẩn hóa HTTP: create `201`, validation `400`, auth `401/403`, not found `404`, conflict `409`.
- [ ] Không trộn success code `200`, `1000` tùy controller nếu client không có convention rõ.
- [ ] Error envelope gồm stable code, message, field errors, timestamp, path và correlation ID.
- [ ] Pagination cho movie/TMDB/showtime lists có thể lớn.
- [ ] OpenAPI/API contract cập nhật cùng code và Postman samples.

### `TEST-01` — Required regression suite (`P0`)

- [ ] Movie Employee happy flow: create → submit → Admin approve → publish/release → end.
- [ ] Reject/rework flow giữ reason và audit.
- [ ] Public visibility tests theo mọi MovieStatus.
- [ ] Scheduler date-boundary tests với fixed Clock.
- [ ] Room migration + create layout + generate seats integration test.
- [ ] Showtime eligibility, format, price, overlap và cleanup-buffer tests.
- [ ] Room unavailable/cluster inactive negative tests.
- [ ] Cancel showtime with inventory/booking event contract test.
- [ ] Seat lock concurrency, group lock, expiry, idempotency và ownership tests.
- [ ] Full Postman/Newman smoke test trên database đã migrate.
- [ ] Frontend build và ít nhất một E2E admin flow + customer seat-selection flow.

### `OPS-01` — Observability and reconciliation (`P1`)

- [ ] Structured logs cho transition, scheduler, TMDB failures, overlap conflicts và seat locks.
- [ ] Metrics: pending review count, failed scheduler jobs, active holds, expired holds, lock conflicts, inventory mismatch.
- [ ] Alert khi scheduler không chạy hoặc database schema version thấp hơn application expectation.
- [ ] Correlation ID xuyên gateway → movie-service → booking/payment events.
- [ ] Admin operation view cho failed imports/cancel/refund events nếu mở rộng production.

---

## 4. Những rule hiện đã có và cần giữ bằng regression test

- [x] Movie có state machine cơ bản: DRAFT, PENDING_REVIEW, REJECTED, COMING_SOON, NOW_SHOWING, SUSPENDED, ENDED.
- [x] Employee/Admin có thể tạo Movie; Movie mới hiện bắt đầu ở DRAFT.
- [x] Approve/Reject/Release/Suspend/Reinstate/End có endpoint và kiểm tra một phần transition.
- [x] Public list chuyên dụng chỉ lấy COMING_SOON/NOW_SHOWING.
- [x] Auto-end phim NOW_SHOWING khi `endDate < today` đã có scheduler.
- [x] TMDB import chặn duplicate theo `tmdbId` và tạo DRAFT.
- [x] Cluster room name unique theo `(clusterId, roomName)`.
- [x] Không tạo room trong cluster chưa ACTIVE.
- [x] Room capacity được server tính từ `numberOfRows × seatsPerRow`.
- [x] Seat-zone counts đã được đưa ra khỏi hard-code RoomType ở code hiện tại.
- [x] Couple row width lẻ bị backend reject theo contract mới.
- [x] Showtime có overlap check ở service/repository và DB constraint trong fresh schema.
- [x] Showtime-seat có snapshot code/type/price và unique `(showtimeId, seatId)`.
- [x] Room có maintenance status/history cơ bản và room đã có showtime không hard-delete.

> Các mục `[x]` là baseline cần bảo vệ, không đồng nghĩa toàn bộ luồng liên quan đã production-ready.

---

## 4.1 Mapping với GitLab issues hiện có

> Mapping theo Sprint 3 board được đối chiếu ngày 2026-07-14. `Direct` nghĩa issue cũ xử lý đúng trọng tâm; `Partial` nghĩa chỉ cover một phần và không nên đóng checklist item chỉ dựa vào issue đó.

### Đã có issue trực tiếp hoặc gần trực tiếp

| Checklist ID | GitLab issue hiện có | Board status | Mức khớp | Ghi chú |
|---|---|---|---|---|
| `MOV-01` | `#143` Fix `updateMovie()` | Ongoing | Direct | Cần xác nhận fix null-overwrite và collection replace semantics bằng test. |
| `MOV-04` | `#122` Movie lifecycle management API; `#139` pending-review panel | Backend completed; Frontend ongoing | Partial | Đã có state transitions/UI review, nhưng chưa tách APPROVED khỏi public lifecycle và chưa chốt self-approval policy. |
| `MOV-05` | `#131`, `#132`, `#133` end-date DB/backend/frontend; `#134` release-date scheduler | End-date completed; release scheduler ongoing | Direct | Auto-end có code; auto-release vẫn cần hoàn thành và test boundary/timezone/audit. |
| `MOV-06` | `#141` actionType cho MovieActionLog; `#146` createdBy/updatedBy cho CinemaCluster; `#130` cluster workflow/audit | `#141/#146` ongoing; `#130` completed | Partial | Chưa chuẩn hóa actor thật, before/after, correlation ID và scheduler actor trên toàn module. |
| `MOV-07` | `#151` Movie.company ManyToMany | Unstarted | Partial | Chỉ cover multiple companies; duplicate identity/external-ID merge vẫn chưa có issue riêng. |
| `TMDB-02` | `#123` TMDB search/import; `#125` Create/Edit Movie UI với TMDB search | Completed | Partial | Search/enrichment đã có; provenance, safe re-sync và local override policy chưa có. |
| `CLU-01` | `#130` Cinema Cluster approval workflow and audit log | Completed | Partial | Workflow đã có; cần xác nhận policy Admin self-approve và maker-checker bằng acceptance test. |
| `ROOM-01` | `#120` CinemaRoom/Seat DB v2; `#162` link room với cluster; `#164` seat generation by room zone | Foundation completed; `#164` ongoing | Direct/Partial | `#164` là issue gần nhất với seat-zone mới; migration V14/runtime upgrade vẫn cần kiểm tra riêng. |
| `ROOM-02` | `#163` nest room management under cluster; `#164` seat generation by room zone | `#163` completed; `#164` ongoing | Partial | Chưa cover layout editor, activation và layout versioning. |
| `SEAT-01` | `#164` seat generation by room zone | Ongoing | Partial | Chưa cover Couple/Sofa capacity, seat group và atomic group purchase. |
| `INV-02` | `#145` Add pessimistic locking to `ShowtimeSeat.lockSeats()` | Unstarted | Direct | Phải bổ sung validate seat thuộc showtime và rollback toàn selection, không chỉ thêm annotation lock. |
| `ST-02` | `#135` Seat pricing per showtime | Review/QA | Partial | Pricing có issue; `formatId` và việc `basePrice` hiện bị ignore chưa được cover đầy đủ. |
| `ST-03` | `#101` bulk showtime generation with conflict preview; `#121` ShowTime/ShowtimeSeat DB v2 | `#101` Review/QA; `#121` completed | Partial | Chưa cover cleanup buffer, overnight/business datetime và concurrent conflict semantics. |
| `API-02` | `#95` standardize gateway error responses; `#126` update API contract; `#137` fix showtimeApi | `#95/#126` ongoing; `#137` completed | Partial | Cần đồng bộ HTTP/error contract ở movie-service, không chỉ gateway/docs/frontend. |

### Issue cũ liên quan nhưng không thay thế checklist item

| GitLab issue | Liên quan tới | Vì sao chưa đủ |
|---|---|---|
| `#140` Customer — Movie listing | `MOV-02` | Có UI listing nhưng chưa chứng minh direct-ID và generic GET không lộ phim nội bộ. |
| `#136` Expose seat status management endpoint | `ROOM-04`, `SEAT-02` | Có thao tác status nhưng chưa có accessibility/companion rule hoặc operational propagation. |
| `#144` Fix cinemaRoomName unique constraint | Baseline room integrity | Rule đã resolved; không cover layout/capacity/inventory. |
| `#118`, `#119`, `#124` DB/Movie entity/CreateMovieRequest v2 | Movie foundation | Là refactor nền, không thay thế readiness, public visibility, lifecycle/audit tests. |
| `#86`, `#87`, `#88`, `#127`, `#128`, `#129` Cinema Cluster DB/API/UI/validation/geocoding | Cluster foundation | Không cover room-list error handling hoặc showtime operational eligibility. |
| `#142`, `#150`, `#152`, `#153` enum/tagline/image/person fields | Metadata quality | Là cải tiến dữ liệu riêng, không phải P0 lifecycle/inventory rules. |
| `#149` Movie keyword search | Catalog UX | Không thay thế public/internal visibility authorization. |
| `#96` API Gateway PATCH/CORS | API infrastructure | Không thay thế security matrix và resource authorization trong `API-01`. |

### Chưa thấy issue tương ứng trên board — nên tạo mới

- [ ] `SEC-01` — Externalize/rotate source-controlled secrets.
- [x] `DB-01` — Flyway runtime migrations và upgrade test. Done.
- [ ] `MOV-02` — Backend public visibility leak/direct-ID authorization.
- [ ] `MOV-03` — Movie readiness validation trước submit/approve/release.
- [ ] `MOV-07b` — Movie duplicate identity theo TMDB/title-year-language.
- [ ] `MOV-08` — Vietnam classification/license metadata và C-rating gate.
- [ ] `TMDB-01` — Browse Now Playing/Upcoming Vietnam không cần nhập keyword.
- [ ] `CLU-02` — Cluster Detail không nuốt room API error thành empty state.
- [ ] `ROOM-03` — Configurable capacity guardrails, bỏ mô tả 100/200/300 như chuẩn ngành.
- [ ] `ROOM-04` — Block scheduling theo room maintenance/closed và xử lý affected showtimes.
- [ ] `SEAT-01b` — Couple/Sofa capacity hoặc seat-group + all-or-nothing purchase.
- [ ] `SEAT-02` — Accessible/wheelchair/companion layout and selection rules.
- [ ] `ST-01` — Showtime eligibility gate theo movie/cluster/room status và release window.
- [ ] `ST-02b` — Persist/enforce showtime `formatId` và fix ignored `basePrice`.
- [ ] `ST-03b` — Trailer/cleaning buffer, business datetime và overlap semantics.
- [ ] `ST-04` — Showtime ON_SALE/SUSPEND/CANCEL/COMPLETE lifecycle.
- [ ] `INV-01` — Materialize showtime-seat khi tạo showtime; GET read-only.
- [ ] `INV-03` — Hold owner/token/idempotency.
- [ ] `INV-04` — Persisted expired-lock release scheduler.
- [ ] `INV-05` — Capacity/sold/available reconciliation, đặc biệt với Couple.
- [ ] `API-01` — Public/internal endpoint security matrix.
- [ ] `TEST-01` — Full regression/concurrency test suite.
- [ ] `OPS-01` — Scheduler/inventory observability và reconciliation metrics.

---

## 5. Thứ tự thực hiện đề xuất

### Phase A — Làm hệ thống chạy đúng và không mất dữ liệu

1. `SEC-01`
2. `DB-01` + `ROOM-01` + `CLU-02`
3. `MOV-01` + `MOV-02` + `MOV-03`
4. `ST-01` + `ST-02` + `ST-03`

### Phase B — Bảo vệ inventory và doanh thu

5. `INV-01` + `INV-02` + `INV-03`
6. `SEAT-01` + `INV-04` + `INV-05`
7. `ST-04`

### Phase C — Hoàn thiện lifecycle và governance

8. `MOV-04` + `MOV-05` + `MOV-06`
9. `API-01` + `API-02`
10. `TEST-01`

### Phase D — Nâng độ sát doanh nghiệp

11. `TMDB-01` + `TMDB-02`
12. `ROOM-02` + `ROOM-03` + `ROOM-04` + `SEAT-02`
13. `MOV-07` + `MOV-08` + `OPS-01`

---

## 6. Definition of Done cho toàn Movie Service Sprint

- [ ] Fresh DB và upgraded DB đều startup thành công.
- [ ] Không có P0 mở hoặc bị workaround bằng frontend-only validation.
- [ ] Customer không truy cập được nội dung chưa publish bằng list hoặc direct ID.
- [ ] Không thể schedule movie/room/cluster không đủ điều kiện.
- [ ] Không thể tạo hai showtime overlap trong cùng room, kể cả concurrent requests.
- [ ] Không thể giữ/bán cùng seat hoặc Couple/Sofa group cho hai booking.
- [ ] Cancel/suspend/end giữ historical data và có audit actor/reason.
- [ ] Scheduler release/end/expiry có test date boundary và metric.
- [ ] Price, capacity và availability sử dụng một contract nhất quán.
- [ ] Postman smoke, backend automated tests và frontend build đều pass trên cùng commit/schema version.
- [ ] Sprint demo chạy bằng account ADMIN và EMPLOYEE thật, không dùng dữ liệu mock để che integration failure.

---

## 7. Nguồn tham khảo nghiệp vụ

- [Vista — Film programming](https://help.vista.co/hc/en-nz/articles/22355345190297-About-film-programming): mô hình centralised/distributed, draft schedule và review cycle.
- [Vista — Seating](https://developer.vista.co/digital-platform/seating): physical seat layout, area category, allocated seating, Sofa group, wheelchair/companion và live availability.
- [Vista — Showtime schedule model](https://developer.vista.co/openapi/digital-platform/reference/operation/OcapiShowtimes_GetShowtimesForScreen/): business date, session start/end và film start/end.
- [TMDB — Now Playing](https://developer.themoviedb.org/reference/movie-now-playing-list), [Upcoming](https://developer.themoviedb.org/reference/movie-upcoming-list), [Discover](https://developer.themoviedb.org/reference/discover-movie): browse/search metadata theo region/date.
- [Bộ VHTTDL — Tiêu chí phân loại phim](https://bvhttdl.gov.vn/Pages/chi-tiet.aspx?url=%2Fquy-dinh-tieu-chi-phan-loai-phim-va-thuc-hien-hien-thi-muc-phan-loai-phim-canh-bao-20230417152429268.htm): P, K, T13, T16, T18 và C.

## 8. Ngoài scope Sprint 3 nếu chưa hoàn thành P0

- Dynamic pricing/AI pricing tối ưu doanh thu.
- Multi-territory rights và contract settlement với distributor.
- Refund/exchange policy đầy đủ trong booking/payment-service.
- Private screening, event cinema, subscription entitlement phức tạp.
- TMS/DCP/KDM integration và hardware automation.
- Multi-site timezone/currency nếu sản phẩm hiện chỉ vận hành tại Việt Nam.

