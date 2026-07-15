# Movie Service P0 — GitLab Issue Pack

> Format source: `docs/issues/ISSUE_TEMPLATE.md`  
> Scope: các P0 trong `docs/issues/movie-service-industry-readiness-checklist.md`.  
> Baseline đối chiếu: Sprint 3 board và source code ngày 2026-07-14.  
> Cách dùng: copy **Title**, **Labels** và phần body của từng mục vào GitLab. Issue mới để ở `Open`; chỉ kéo sang `In Progress` khi assignee thực sự bắt đầu làm.

## 1. Danh sách tạo mới và cập nhật issue hiện có

| Thứ tự | P0 ID | Hành động trên GitLab | Size | Phụ thuộc chính |
|---:|---|---|---|---|
| 1 | `SEC-01` | Create new | S | Không |
| 2 | `DB-01` | Create new | M | Không |
| 3 | `ROOM-01` | Create new; link `#120`, `#164` | M | `DB-01` |
| 4 | `CLU-02` | Create new | S | `DB-01`, `ROOM-01` để verify runtime |
| 5 | `MOV-01` | Update Acceptance Criteria của `#143` | S | Không |
| 6 | `MOV-02` | Create new | M | `API-01` |
| 7 | `MOV-03` | Create new | M | `MOV-01` |
| 8 | `MOV-04` | Create follow-up; link `#122`, `#139` | L | `MOV-03` |
| 9 | `MOV-05` | Update Acceptance Criteria của `#134` | M | `MOV-03`, `MOV-04` |
| 10 | `MOV-06` | Create follow-up; link `#141` | M | `MOV-04`, `MOV-05` |
| 11 | `ST-01` | Create new | M | `MOV-03`, `ROOM-01` |
| 12 | `ST-02` | Create follow-up; link `#135` | M | `ST-01` |
| 13 | `ST-03` | Create follow-up; link `#101`, `#121` | M | `ST-01` |
| 14 | `INV-01` | Create new | M | `ST-02` |
| 15 | `INV-02` | Update Acceptance Criteria của `#145` | M | `INV-01` |
| 16 | `INV-03` | Create new | M | `INV-02` |
| 17 | `SEAT-01` | Create follow-up; link `#164` | L | `INV-02`, `INV-03` |
| 18 | `INV-04` | Create new | M | `INV-03` |
| 19 | `INV-05` | Create new | M | `SEAT-01`, `INV-04` |
| 20 | `ST-04` | Create new | L | `INV-01`, booking event contract |
| 21 | `API-01` | Create new | M | Có thể làm song song từ đầu |
| 22 | `TEST-01` | Create new cuối cùng, triển khai tăng dần | L | Tất cả P0 liên quan |

> Không reopen issue đã `Completed` nếu Acceptance Criteria ban đầu của issue đó đã đạt. Hãy tạo follow-up và link bằng `Related to #...` để lịch sử Sprint không bị sai.

---

# P0-01 / SEC-01 — [Infra] Externalize and rotate movie-service secrets

**GitLab action:** Create new  
**Labels:** `Layer::Infrastructure`, `Type::Bug`, `Priority::High`

## Summary / Objective

Loại bỏ JWT signing key, TMDB API key và Cloudinary credential đang được đặt trực tiếp trong `movie-service/src/main/resources/application.yml`. Tất cả secret phải được cấp từ environment/secret store và các giá trị đã lộ phải được rotate để không thể tiếp tục sử dụng.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Source code, tracked configuration, sample data và log không còn chứa secret thật.
- [ ] `JWT_SIGNER_KEY`, `TMDB_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` được đọc từ environment.
- [ ] Tạo/cập nhật `.env.example` chỉ chứa tên biến và placeholder không nhạy cảm.
- [ ] Credential đã từng commit được rotate trên nhà cung cấp tương ứng.
- [ ] Local development chạy được khi truyền đủ environment variables.
- [ ] Production profile fail-fast với thông báo cấu hình rõ khi thiếu secret bắt buộc.
- [ ] Chạy secret scan và xác nhận không phát hiện secret active mới.

---

## Technical Notes / Constraints

- Không đưa secret mới vào GitLab issue, MR description, screenshot hoặc Postman environment được commit.
- Database password local có thể giữ fallback chỉ trong profile local; production không được có default password.
- Nếu cần giữ backward compatibility, dùng `${ENV_VAR:local-placeholder}` chỉ cho profile `local`, không dùng trong profile production.

---

## Related

- Branch: `fix/externalize-movie-service-secrets`
- Depends on: không có
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-02 / DB-01 — [Database] Enable versioned runtime migrations for movie-service

**GitLab action:** Create new  
**Labels:** `Layer::Database`, `Type::Feature`, `Priority::High`

## Summary / Objective

Đưa các migration movie-service đang nằm trong `docs/database/movie-service/V*.sql` vào cơ chế migration chạy được tại runtime hoặc pipeline chính thức. Mục tiêu là fresh database và database hiện hữu đều đạt đúng schema mà application cần, thay vì phụ thuộc thao tác SQL thủ công.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chọn và cấu hình Flyway hoặc Liquibase cho `movie-service`.
- [ ] Migration được đặt trong runtime migration path và có schema-history table.
- [ ] Thứ tự/version của migration hiện hữu được giữ forward-only; không sửa migration đã áp dụng trên môi trường dùng chung.
- [ ] Fresh `movie_db` chạy đủ migration và `movie-service` startup thành công với `ddl-auto=none`.
- [ ] Database cũ có movie/cluster/room/seat data nâng cấp qua V13/V14 mà không mất dữ liệu.
- [ ] Có validation/health check phát hiện database schema thấp hơn version application yêu cầu.
- [ ] Có integration test hoặc script CI cho cả hai case: fresh database và upgraded database.
- [ ] Rollback deployment được document theo nguyên tắc application backward-compatible; không dùng destructive down migration tự động.

---

## Technical Notes / Constraints

- Source of truth sau issue này là migration runtime, không phải file SQL copy rời rạc trong `docs`.
- Giữ `spring.jpa.hibernate.ddl-auto=none`; không dùng Hibernate auto-update thay migration.
- Seed/reference data phải idempotent hoặc tách khỏi DDL migration.
- Kiểm tra PostgreSQL-specific constraints/indexes hiện có trước khi đổi công cụ.

---

## Related

- Branch: `feat/movie-service-runtime-migrations`
- Depends on: không có
- Docs: `docs/database/movie-service/`, `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-03 / ROOM-01 — [Database] Roll out cinema-room seat-zone schema safely

**GitLab action:** Create new follow-up; link `#120`, `#164`  
**Labels:** `Layer::Database`, `Type::Bug`, `Priority::High`

## Summary / Objective

Roll out đầy đủ các field layout `numberOfRows`, `seatsPerRow`, `standardRowCount`, `vipRowCount`, `coupleRowCount` lên database hiện hữu và xác nhận backend/API/seat generation dùng cùng contract. Issue này xử lý schema drift gây API room trả 500 dù cluster counters vẫn có dữ liệu.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] V13/V14 được áp dụng qua cơ chế của `DB-01` trên database có room/seat cũ.
- [ ] Room cũ được backfill thành layout hợp lệ; tổng ba zone bằng `numberOfRows`.
- [ ] DB constraint, DTO validation và service validation dùng cùng semantics.
- [ ] `coupleRowCount > 0` chỉ hợp lệ với layout hỗ trợ ghế đôi; policy row width chẵn được enforce nhất quán.
- [ ] `POST /api/cinema-rooms` tạo room và seats trong cùng transaction; lỗi generate seat rollback room.
- [ ] `GET /api/cinema-rooms?clusterId={id}` và `GET /api/cinema-rooms/{id}/seats` trả đủ layout field sau upgrade.
- [ ] Integration test cover create room → generate seats → read room/seats và verify số lượng/type.
- [ ] Existing room/seat IDs không bị thay đổi chỉ vì migration.

---

## API Specifications (if applicable)

### API 1 — Create cinema room with explicit seat zones

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-rooms` |
| Description | Tạo room và materialize physical seat layout |
| Auth Required | Yes — ADMIN/authorized EMPLOYEE theo policy |

**Request Body:**

```json
{
  "cinemaClusterId": 11,
  "cinemaRoomName": "Room 08",
  "roomType": "STANDARD",
  "numberOfRows": 10,
  "seatsPerRow": 12,
  "standardRowCount": 6,
  "vipRowCount": 3,
  "coupleRowCount": 1
}
```

**Response (Validation Error):**

```json
{
  "code": 2032,
  "message": "Seat zone row counts must equal numberOfRows"
}
```

---

## Technical Notes / Constraints

- Không regenerate/xóa seat của room cũ khi migration nếu room đã có showtime history.
- Nếu dữ liệu legacy không thể suy luận chính xác, backfill về safe default và xuất báo cáo cần admin review.
- Capacity được tính server-side từ physical layout; không tin `seatQuantity` do client gửi.

---

## Related

- Branch: `fix/cinema-room-seat-zone-schema-rollout`
- Depends on: `DB-01`; related `#120`, `#164`
- Docs: `docs/database/movie-service/V13__add_room_layout_columns.sql`, `docs/database/movie-service/V14__configure_room_seat_zones.sql`

---

# P0-04 / CLU-02 — [Frontend] Distinguish cinema-room API errors from empty state

**GitLab action:** Create new  
**Labels:** `Layer::Frontend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Trang Cinema Cluster Detail hiện dùng `Promise.allSettled()` nhưng không set error khi request rooms thất bại, nên UI hiển thị sai “No rooms” trong khi cluster counters vẫn có room. Cần tách rõ loading, success-empty và failure để admin không hiểu nhầm hoặc tạo dữ liệu trùng.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Room request 4xx/5xx/network error hiển thị “Failed to load rooms” và nút Retry.
- [ ] “No rooms in this cluster” chỉ hiển thị sau response success với `result: []`.
- [ ] Cluster request thành công nhưng room request thất bại vẫn hiển thị cluster header và room error state.
- [ ] Không dùng `cluster.totalRooms` hoặc `cluster.totalSeats` để giả lập room list.
- [ ] Retry chỉ cần reload resource lỗi hoặc reload an toàn cả hai resource.
- [ ] Nếu response có correlation/request ID, UI hiển thị/copy được trong error detail cho support.
- [ ] Frontend test cover case `totalRooms > 0` nhưng room API reject.
- [ ] `npm run build` pass; browser QA dark/light mode.

---

## UI Reference / Mockup

Tại `/admin/clusters/{clusterId}` thay empty row bằng error row có icon, message và `Retry`. Giữ nguyên table header để layout không nhảy.

---

## Technical Notes / Constraints

- Sửa `client/src/pages/admin/ClusterDetailPage.tsx`; không dùng fallback mock room data.
- Tránh một biến `error` chung làm room failure che cluster failure; ưu tiên `clusterError` và `roomsError`.
- Không xóa `Promise.allSettled()` nếu vẫn cần hiển thị partial result; phải xử lý cả hai rejected branch.

---

## Related

- Branch: `fix/cluster-room-error-state`
- Depends on: runtime verification cần `DB-01`, `ROOM-01`
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-05 / MOV-01 — [Backend] Prevent null overwrite in partial movie updates

**GitLab action:** Update existing issue `#143`  
**Labels:** giữ `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Hoàn thiện `updateMovie()` để field không xuất hiện hoặc có giá trị `null` theo partial-update contract không ghi đè dữ liệu hiện hữu. Đồng thời làm rõ semantics cho collection và thao tác explicit clear.

---

## Estimate

- [x] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Mapper dùng `NullValuePropertyMappingStrategy.IGNORE` hoặc service cập nhật scalar field có chủ đích.
- [ ] Contract quy định rõ `null = không thay đổi`; clear field dùng explicit operation/flag đã document.
- [ ] `genres`, `formats`, `cast`, `translations`, `images` chỉ replace khi request thực sự gửi collection tương ứng.
- [ ] Update một field không làm mất title, runtime, dates, URLs, companies hoặc relationships khác.
- [ ] Empty collection và missing collection được phân biệt theo contract.
- [ ] Unit test cover scalar null, missing collection, empty collection và explicit clear.
- [ ] API contract/Postman sample được update theo semantics đã chọn.

---

## API Specifications (if applicable)

### API 1 — Update movie

| Field | Details |
|---|---|
| Method | `PUT` hiện hữu; cân nhắc `PATCH` nếu đổi contract |
| Endpoint | `/api/movies/{id}` |
| Description | Cập nhật movie mà không làm mất field không gửi |
| Auth Required | Yes — ADMIN/EMPLOYEE |

**Request Body:**

```json
{
  "tagline": "New tagline"
}
```

---

## Technical Notes / Constraints

- Không biến toàn bộ update thành full replacement nếu frontend đang gửi partial payload.
- Nếu tiếp tục dùng `PUT`, document rõ đây là partial-update compatibility contract; chuẩn REST dài hạn nên dùng `PATCH`.

---

## Related

- Branch: giữ branch của `#143`
- Depends on: không có
- Docs: `docs/issues/movie-lifecycle-enterprise-fix-plan.md`

---

# P0-06 / MOV-02 — [Backend] Separate public and internal movie catalog APIs

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Ngăn customer đọc movie nội bộ qua generic list/detail hoặc đoán ID. Public catalog chỉ được trả phim đủ điều kiện market/publish; internal catalog dành cho ADMIN/EMPLOYEE và hỗ trợ toàn bộ workflow statuses.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Public list chỉ trả movie `COMING_SOON`/`NOW_SHOWING` hoặc display states tương đương sau lifecycle refactor.
- [ ] Có public detail endpoint với cùng visibility predicate như public list.
- [ ] Customer/anonymous đoán ID của `DRAFT`, `PENDING_REVIEW`, `REJECTED`, `SUSPENDED`, `ENDED` nhận `404` hoặc policy response không làm lộ record.
- [ ] Generic/internal list và detail yêu cầu ADMIN/EMPLOYEE.
- [ ] Customer frontend chỉ gọi public endpoints; admin frontend chỉ gọi internal endpoints.
- [ ] Visibility predicate được dùng chung, không copy khác nhau giữa list/detail.
- [ ] Security/controller tests cover anonymous, CUSTOMER, EMPLOYEE, ADMIN cho list và direct ID.
- [ ] Không làm lộ rejection note, audit actor hoặc metadata nội bộ trong public DTO.

---

## API Specifications (if applicable)

### API 1 — Public movie list

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/public` |
| Description | Catalog phim được phép hiển thị cho customer |
| Auth Required | No |

### API 2 — Public movie detail

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/public/{id}` |
| Description | Detail dùng cùng publish predicate với public list |
| Auth Required | No |

### API 3 — Internal movie catalog

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies` và `/api/movies/{id}` sau khi protect |
| Description | Catalog quản trị có filter workflow status |
| Auth Required | Yes — ADMIN/EMPLOYEE |

---

## Technical Notes / Constraints

- Sửa matcher `GET /api/movies/** permitAll()` vì pattern hiện làm cả TMDB và internal detail public.
- Endpoint public không được chỉ filter ở frontend.
- Nên trả public DTO riêng hoặc projection để tránh accidental field exposure.

---

## Related

- Branch: `fix/public-internal-movie-catalog`
- Depends on: `API-01`
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-07 / MOV-03 — [Backend] Enforce movie readiness gates before workflow transitions

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thêm validation theo từng workflow gate thay vì chỉ kiểm tra status. Movie không đủ metadata, sai release window hoặc bị phân loại cấm phổ biến không được submit, approve, release hoặc schedule.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Submit gate kiểm tra title, original language, runtime > 0, genre, format và date range cơ bản.
- [ ] Approve gate kiểm tra age classification, primary poster/image, synopsis/localized title và reference IDs hợp lệ.
- [ ] Release gate kiểm tra approved state, business date trong release window và showtime hợp lệ nếu policy yêu cầu.
- [ ] Enforce `releaseDate <= endDate` tại DTO/service và database nếu phù hợp.
- [ ] Movie classification `C` không được approve để public, release hoặc schedule.
- [ ] Validation response trả danh sách rule/field chưa đạt, không chỉ message chung.
- [ ] Một validator/service dùng chung được gọi từ command endpoints và scheduler.
- [ ] Negative test cho mỗi gate và test chứng minh scheduler không bypass readiness.

---

## API Specifications (if applicable)

Áp dụng cho các endpoint hiện hữu:

| Action | Method | Endpoint |
|---|---|---|
| Submit | `POST` | `/api/movies/{id}/submit` |
| Approve | `POST` | `/api/movies/{id}/approve` |
| Release | `POST` | `/api/movies/{id}/release` |

**Response (Readiness Error):**

```json
{
  "code": 2401,
  "message": "Movie is not ready for approval",
  "result": {
    "violations": [
      { "field": "ageRating", "rule": "REQUIRED_FOR_APPROVAL" },
      { "field": "poster", "rule": "PRIMARY_IMAGE_REQUIRED" }
    ]
  }
}
```

---

## Technical Notes / Constraints

- Error code là ví dụ; phải cấp mã không trùng trong `MovieErrorCode`.
- Không đặt business gate chỉ bằng bean validation của create DTO vì gate khác nhau theo transition.
- Dùng `Clock`/business date abstraction cho validation liên quan ngày.

---

## Related

- Branch: `feat/movie-readiness-gates`
- Depends on: `MOV-01`; liên quan `#122`
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`, `docs/issues/movie-lifecycle-enterprise-fix-plan.md`

---

# P0-08 / MOV-04 — [Backend] Separate movie approval from exhibition lifecycle

**GitLab action:** Create follow-up; link `#122`, `#139`  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tách trạng thái nội dung đã được duyệt khỏi trạng thái phát hành/đang chiếu để `approve` không đồng nghĩa âm thầm với `COMING_SOON`. Workflow phải có command rõ, role rõ và không cho client gán status tùy ý qua create/update payload.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chốt và document canonical content states tối thiểu: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `CHANGES_REQUESTED`, `ARCHIVED`.
- [ ] Exhibition/display state được tách hoặc được derive từ release window/showtime; không dùng một field cho cả review và vận hành.
- [ ] Movie mới luôn là `DRAFT` bất kể ADMIN hay EMPLOYEE tạo; request không được chọn status.
- [ ] Admin muốn duyệt ngay phải dùng action rõ `Save & Approve`, không phải side effect của create.
- [ ] Reject/request changes bắt buộc reason và giữ toàn bộ history qua rework.
- [ ] Mỗi transition kiểm tra current state và role ở backend; invalid transition trả conflict.
- [ ] Không archive movie còn showtime/availability active.
- [ ] Có migration/backfill strategy cho legacy `COMING_SOON`, `NOW_SHOWING`, `REJECTED`, `ENDED`.
- [ ] Frontend `#139` dùng contract mới hoặc có compatibility mapping có ngày loại bỏ.
- [ ] Unit/controller tests cover transition matrix và concurrent approval.

---

## API Specifications (if applicable)

| Action | Method | Endpoint | Auth |
|---|---|---|---|
| Submit | `POST` | `/api/movies/{id}/submit` | ADMIN/EMPLOYEE |
| Approve content | `POST` | `/api/movies/{id}/approve` | ADMIN |
| Request changes | `POST` | `/api/movies/{id}/request-changes` | ADMIN |
| Start revision | `POST` | `/api/movies/{id}/start-revision` | ADMIN/EMPLOYEE |
| Archive | `POST` | `/api/movies/{id}/archive` | ADMIN |

---

## Technical Notes / Constraints

- Bám contract chi tiết trong `movie-lifecycle-refactor-issue-checklist.md`; không tạo một state machine thứ ba.
- Nếu Sprint không đủ để tách schema, phải document quyết định MVP `APPROVE → COMING_SOON` và không tuyên bố đã hoàn thành P0 separation.
- Không hard-delete business history.

---

## Related

- Branch: `feat/separate-movie-content-exhibition-lifecycle`
- Depends on: `MOV-03`; related `#122`, `#139`
- Docs: `docs/issues/movie-lifecycle-refactor-issue-checklist.md`

---

# P0-09 / MOV-05 — [Backend] Complete timezone-safe movie release and end schedulers

**GitLab action:** Update existing issue `#134`  
**Labels:** giữ `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Hoàn thành scheduler tự chuyển movie đủ điều kiện sang trạng thái phát hành và kết thúc phim theo `endDate`. Scheduler phải dùng business date cấu hình, idempotent, an toàn multi-instance và không bypass readiness/audit.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Auto-release chỉ transition movie đã approved/eligible khi `releaseDate <= businessDate`.
- [ ] Auto-end dùng semantics: `endDate < businessDate`, nghĩa phim vẫn hiệu lực hết ngày `endDate`.
- [ ] Inject `Clock` và cấu hình timezone mặc định `Asia/Ho_Chi_Minh`; không gọi `LocalDate.now()` rải rác.
- [ ] Cùng record chạy lại không tạo transition/audit duplicate.
- [ ] Multi-instance execution có lock/claim strategy để tránh xử lý trùng.
- [ ] Scheduler dùng cùng readiness validator với manual command.
- [ ] Audit actor là `SYSTEM:SCHEDULER`; log/metric có số success, skipped và failed.
- [ ] Test fixed Clock cho trước/đúng/sau `releaseDate` và `endDate`.
- [ ] Một record lỗi không rollback toàn bộ batch; failure được ghi nhận để retry.

---

## Technical Notes / Constraints

- Link phần auto-end đã làm ở `#132`; không duplicate scheduler khác cho cùng semantics.
- Scheduler không được release movie classification `C`, thiếu metadata hoặc bị suspended.

---

## Related

- Branch: giữ branch của `#134`
- Depends on: `MOV-03`, `MOV-04`; related `#131`, `#132`, `#133`
- Docs: `docs/issues/movie-lifecycle-enterprise-fix-plan.md`

---

# P0-10 / MOV-06 — [Backend] Record trustworthy movie lifecycle audit events

**GitLab action:** Create follow-up; link `#141`  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Chuẩn hóa audit cho mọi thay đổi quan trọng trong movie lifecycle. Actor phải đến từ authenticated principal hoặc system identity tin cậy, không hard-code `Admin/SYSTEM`, và log phải đủ để truy vết before/after cùng lý do.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Actor gồm stable `actorId`, username và role lấy từ verified security context.
- [ ] Scheduler dùng actor `SYSTEM:SCHEDULER`; import có actor/user gọi import.
- [ ] `actionType` tối thiểu gồm CREATE, UPDATE, SUBMIT, APPROVE, REQUEST_CHANGES/REJECT, RELEASE, SUSPEND, REINSTATE, END, IMPORT, ARCHIVE.
- [ ] Transition log lưu `fromStatus`, `toStatus`, reason, timestamp và correlation/request ID.
- [ ] Update quan trọng lưu before/after hoặc field diff có redaction.
- [ ] Reject/rework history append-only, không bị overwrite.
- [ ] Audit được ghi trong cùng transaction với business change hoặc dùng outbox pattern; không để business success nhưng mất audit âm thầm.
- [ ] Audit API chỉ ADMIN/authorized auditor đọc được.
- [ ] Tests cover ADMIN, EMPLOYEE, scheduler actor và rollback behavior.

---

## API Specifications (if applicable)

### API 1 — Movie audit log

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/{id}/audit-log` |
| Description | Trả audit events của movie theo thứ tự thời gian |
| Auth Required | Yes — ADMIN/authorized internal role |

---

## Technical Notes / Constraints

- Reuse/extend `MovieActionLog`; không ghi credential, token hoặc payload nhạy cảm.
- Gateway-provided actor headers chỉ được tin nếu gateway xóa header từ client và ký/xác thực request; ưu tiên JWT claims.

---

## Related

- Branch: `feat/trustworthy-movie-audit-trail`
- Depends on: `MOV-04`, `MOV-05`; related `#141`
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

# P0-11 / ST-01 — [Backend] Enforce showtime scheduling eligibility

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Chặn tạo/cập nhật showtime khi movie, cinema cluster hoặc cinema room chưa đủ điều kiện vận hành. Validation phải nằm ở backend và được tái sử dụng cho create đơn, update và bulk generation.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Movie ở workflow/exhibition state được phép schedule theo contract đã chốt.
- [ ] `showDate` nằm trong release window; không schedule movie SUSPENDED, ENDED, ARCHIVED hoặc classification `C`.
- [ ] Cinema cluster phải `ACTIVE`.
- [ ] Cinema room phải `ACTIVE`, không nằm trong maintenance/closed interval tại thời gian suất chiếu.
- [ ] Movie runtime > 0 và có format/metadata bắt buộc.
- [ ] Create, update và bulk generation dùng cùng `ShowtimeEligibilityValidator` hoặc policy service.
- [ ] Mỗi vi phạm trả domain error code cụ thể, không trả `MOVIE_NOT_FOUND` cho mọi lỗi.
- [ ] Negative unit/integration test cho từng movie/cluster/room status và release-window boundary.
- [ ] Public listing không mở bán showtime không còn eligible.

---

## API Specifications (if applicable)

Áp dụng cho:

| Action | Method | Endpoint |
|---|---|---|
| Create | `POST` | `/api/schedules` |
| Update | `PUT` | `/api/schedules/{id}` |
| Bulk preview/create | Theo contract của `#101` | `/api/schedules/...` |

**Response (Eligibility Error):**

```json
{
  "code": 2501,
  "message": "Cinema room is not available for scheduling"
}
```

---

## Technical Notes / Constraints

- Error code là ví dụ; cấp mã không trùng trong `MovieErrorCode`.
- Không dựa vào button disabled ở frontend.
- Query maintenance phải kiểm tra overlap với toàn bộ occupancy interval của showtime.

---

## Related

- Branch: `fix/showtime-scheduling-eligibility`
- Depends on: `MOV-03`, `ROOM-01`
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

# P0-12 / ST-02 — [Backend] Persist and enforce showtime format and base price

**GitLab action:** Create follow-up; link `#135`  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Sửa contract showtime đang nhận dữ liệu nhưng không persist/enforce đầy đủ. `formatId` phải được lưu và tương thích movie/room; `basePrice` phải được lưu thật hoặc bị loại khỏi request, tuyệt đối không silently ignore.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `CreateShowTimeRequest` nhận `formatId` bắt buộc và map vào `ShowTime.format`.
- [ ] Screening format tồn tại, thuộc format hỗ trợ của movie và room/equipment hỗ trợ format đó.
- [ ] `basePrice` dùng `BigDecimal`, có min/max/scale validation và được persist.
- [ ] Nếu pricing model của `#135` thay `basePrice`, field cũ bị loại/deprecate rõ; request gửi field không hỗ trợ phải fail validation thay vì bị bỏ qua.
- [ ] Response trả `formatId`, format name, `basePrice`, audio language và subtitle language theo contract.
- [ ] Database column, entity, request, mapper, response, frontend type và OpenAPI đồng bộ.
- [ ] Create/read/update integration test chứng minh dữ liệu round-trip không bị mất.
- [ ] Negative tests cho format không thuộc movie, room không hỗ trợ và price không hợp lệ.

---

## API Specifications (if applicable)

### API 1 — Create showtime with format and price

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/schedules` |
| Description | Tạo showtime với commercial/technical attributes thực |
| Auth Required | Yes — ADMIN |

**Request Body:**

```json
{
  "movieId": 25,
  "cinemaRoomId": 8,
  "showDate": "2026-07-18",
  "startTime": "19:30:00",
  "formatId": 2,
  "basePrice": 85000,
  "audioLanguage": "vi",
  "subtitleLanguage": "en"
}
```

---

## Technical Notes / Constraints

- Không dùng floating-point cho tiền.
- Chốt rõ giá là per sellable unit hay per person trước `SEAT-01`/`INV-05`.
- Link `#135` để không tạo hai nguồn pricing cạnh tranh.

---

## Related

- Branch: `fix/showtime-format-base-price-persistence`
- Depends on: `ST-01`; related `#135`
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# P0-13 / ST-03 — [Backend] Model room occupancy and prevent buffered showtime overlap

**GitLab action:** Create follow-up; link `#101`, `#121`  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Đổi overlap semantics từ thời lượng phim đơn thuần sang khoảng thời gian phòng thực sự bị chiếm dụng, gồm quảng cáo/trailer và cleaning/turnaround buffer. Application check và database constraint phải đồng nhất và chống được concurrent create.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Contract phân biệt advertised start, film start, film end và room release time.
- [ ] Occupancy interval gồm configurable pre-show và cleanup buffer.
- [ ] Buffer có một source cấu hình theo site/room/format; không hard-code rải rác.
- [ ] Chốt hỗ trợ suất qua nửa đêm; nếu hỗ trợ, dùng timestamp/business date semantics không bị sai khi `endTime < startTime`.
- [ ] CANCELLED showtime không block slot; các status khác có rule cụ thể.
- [ ] Same-day operational scheduling được cho phép hoặc lead-time trở thành configuration; không hard-code “trước 3 ngày”.
- [ ] Overlap query và PostgreSQL constraint/exclusion index dùng cùng occupancy interval/status predicate.
- [ ] Hai request concurrent cho cùng room/time chỉ một request thành công; request còn lại nhận conflict.
- [ ] Boundary tests cover touching intervals, buffer overlap, midnight và cancelled showtime.

---

## API Specifications (if applicable)

Không bắt buộc endpoint mới. Response conflict của `POST /api/schedules` phải trả HTTP 409 và chỉ rõ room/time bị xung đột, không lộ dữ liệu nhạy cảm.

---

## Technical Notes / Constraints

- Tham chiếu model business date/session times trong tài liệu nghiệp vụ; không đổi timezone âm thầm.
- Bulk conflict preview `#101` chỉ là UX; database vẫn phải là lớp bảo vệ cuối cùng.

---

## Related

- Branch: `fix/buffered-showtime-overlap`
- Depends on: `ST-01`; related `#101`, `#121`
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

# P0-14 / INV-01 — [Backend] Materialize showtime-seat inventory when creating showtime

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Loại bỏ side effect khỏi `GET /api/showtimes/{id}/seats`. Showtime-seat snapshot phải được tạo trong transaction ghi khi tạo showtime để GET luôn read-only và booking-service không gặp inventory thiếu/ngẫu nhiên.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo toàn bộ `showtime_seat` snapshot trong cùng transaction với create showtime.
- [ ] Snapshot lấy seat code/type/capacity/price cần thiết tại thời điểm showtime được tạo.
- [ ] Nếu room không có active seats hoặc snapshot insert fail, rollback showtime.
- [ ] `GET /api/showtimes/{id}/seats` được đánh dấu/read-only và không `saveAll` hay thay đổi DB.
- [ ] Unique constraint `(showtime_id, seat_id)` được verify và duplicate initialization không thể xảy ra.
- [ ] Retry create/idempotent operation không tạo snapshot trùng.
- [ ] Existing showtime thiếu snapshot được xử lý bằng explicit admin reconciliation/backfill command, không bằng customer GET.
- [ ] Integration test kiểm tra row count ngay sau create và xác nhận hai lần GET không thay đổi database.

---

## API Specifications (if applicable)

### API 1 — Read showtime seat inventory

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/showtimes/{id}/seats` |
| Description | Read-only availability snapshot |
| Auth Required | Theo `API-01`; public chỉ cho showtime bookable |

---

## Technical Notes / Constraints

- Refactor `ShowTimeService.getSeatsByShowtime()`; bỏ lazy initialization block.
- Cân nhắc batch insert để tránh N+1/save loop.
- Không tự thay đổi snapshot khi room layout đổi sau đó.

---

## Related

- Branch: `fix/materialize-showtime-seat-on-create`
- Depends on: `ST-02`, `ROOM-01`
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

# P0-15 / INV-02 — [Backend] Lock showtime seats atomically with pessimistic concurrency control

**GitLab action:** Update existing issue `#145`  
**Labels:** giữ `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Hoàn thiện `ShowtimeSeat.lockSeats()` để toàn bộ selection được kiểm tra và lock atomically. Không được xảy ra double hold, cross-showtime lock hoặc partial success khi một ghế trong selection không còn available.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tất cả `seatIds` phải tồn tại và thuộc đúng `showtimeId` từ path.
- [ ] Reject empty list, duplicate IDs và ID từ showtime khác bằng domain validation error.
- [ ] Load/lock selection theo thứ tự ID ổn định trong một transaction.
- [ ] Dùng `PESSIMISTIC_WRITE` hoặc conditional atomic update `WHERE status = AVAILABLE`; kiểm tra affected rows.
- [ ] Nếu bất kỳ seat/group nào không available, rollback toàn bộ selection.
- [ ] Couple/Sofa group được expand/lock all-or-nothing khi `SEAT-01` hoàn thành.
- [ ] Không throw raw `RuntimeException`; trả HTTP 409 với stable domain error.
- [ ] Concurrency test dùng hai transaction/thread chứng minh chỉ một request thắng cùng seat/group.
- [ ] Database lock timeout/deadlock có handling và log phù hợp.

---

## API Specifications (if applicable)

Giữ endpoint hiện hữu trong issue này:

| Field | Details |
|---|---|
| Method | `PUT` hiện hữu; endpoint hold canonical sẽ được chuẩn hóa ở `INV-03` |
| Endpoint | `/api/showtimes/{id}/seats/lock` |
| Auth Required | Yes |

---

## Technical Notes / Constraints

- Chỉ thêm `@Lock` mà không validate membership/rollback selection là chưa đạt Acceptance Criteria.
- Lock database chỉ bảo vệ concurrency; ownership và idempotency thuộc `INV-03`.

---

## Related

- Branch: giữ branch của `#145`
- Depends on: `INV-01`; follow-up `INV-03`, `SEAT-01`
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-16 / INV-03 — [Backend] Add seat-hold ownership, expiry and idempotency

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay request lock chỉ chứa danh sách seat IDs bằng seat-hold contract có owner, hold token, expiration và idempotency key. Chỉ owner hoặc booking-service được ủy quyền mới có thể confirm/release hold.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Mỗi hold có unique `holdToken`, `ownerId`/session principal, `expiresAt`, `createdAt` và status.
- [ ] Client gửi `Idempotency-Key`; retry cùng owner/request trả cùng hold, không tạo hold thứ hai.
- [ ] Hold token không đoán được và không chứa PII.
- [ ] Chỉ owner hoặc authorized booking-service mới confirm/release hold.
- [ ] Cross-user confirm/release trả 403/404 theo security policy.
- [ ] Public seat DTO không expose owner ID/token của user khác.
- [ ] Confirm/release là idempotent và kiểm tra hold chưa expired.
- [ ] Schema có unique/index cần thiết cho token, idempotency key và expiration query.
- [ ] Integration/security tests cover retry, owner mismatch, expired token và concurrent requests.

---

## API Specifications (if applicable)

### API 1 — Create seat hold

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/showtimes/{showtimeId}/seat-holds` |
| Description | Giữ atomic một selection/group ghế |
| Auth Required | Yes |

**Headers:** `Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000`

**Request Body:**

```json
{
  "seatIds": [1001, 1002]
}
```

**Response 200/201:**

```json
{
  "code": 1000,
  "result": {
    "holdToken": "opaque-random-token",
    "showtimeId": 77,
    "seatIds": [1001, 1002],
    "expiresAt": "2026-07-14T20:10:00+07:00"
  }
}
```

### API 2 — Release seat hold

| Field | Details |
|---|---|
| Method | `DELETE` |
| Endpoint | `/api/showtimes/{showtimeId}/seat-holds/{holdToken}` |
| Description | Release hold do owner tạo |
| Auth Required | Yes |

---

## Technical Notes / Constraints

- Không dùng `bookingId` chỉ được set sau SOLD để thay ownership lúc RESERVED.
- Nếu ownership thuộc booking-service, chốt service-to-service auth và event/API contract rõ.

---

## Related

- Branch: `feat/seat-hold-ownership-idempotency`
- Depends on: `INV-02`
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# P0-17 / SEAT-01 — [Backend] Model Couple and Sofa seats as atomic inventory groups

**GitLab action:** Create follow-up; link `#164`  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Chốt mô hình tồn kho cho Couple/Sofa để capacity, price, hold và sold counters không mơ hồ. Backend phải tự expand group và áp dụng all-or-nothing; không tin frontend gửi đủ hai phía của ghế đôi.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Architecture decision chọn rõ một model: sellable unit `capacity=2` hoặc nhiều physical seats chung `seat_group_id`.
- [ ] Schema lưu `groupCode`, `capacity`, `groupType` và `purchasePolicy=ALL_OR_NOTHING` khi dùng group model.
- [ ] Mỗi physical seat có identity ổn định; không dùng self-FK `paired_seat_id` cho group có thể lớn hơn hai.
- [ ] Backend tự expand một seat/group selection thành toàn group trước availability check và lock.
- [ ] Price semantics được document: per group hay per person/ticket.
- [ ] Maintenance/block một thành phần làm cả group không sellable khi policy yêu cầu.
- [ ] Public/admin seat DTO thể hiện group/capacity mà không expose hold owner.
- [ ] Migration/backfill chuyển Couple hiện hữu mà không đổi historical showtime-seat identity trái phép.
- [ ] Unit/integration/concurrency tests cover generation, selection một phía, atomic hold, sale và maintenance.

---

## API Specifications (if applicable)

Seat response tối thiểu cần thêm contract tương đương:

```json
{
  "seatId": 1001,
  "seatCode": "J1-J2",
  "seatType": "COUPLE",
  "groupCode": "J-C01",
  "capacity": 2,
  "purchasePolicy": "ALL_OR_NOTHING",
  "status": "AVAILABLE"
}
```

---

## Technical Notes / Constraints

- `#164` chỉ cover generation theo zone; không đóng issue này bằng việc tạo đúng tỷ lệ row.
- Model phải tương thích `INV-02`, `INV-03`, `INV-05` và booking-service quantity/price contract.

---

## Related

- Branch: `feat/atomic-couple-sofa-seat-groups`
- Depends on: `INV-02`, `INV-03`; related `#164`
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-18 / INV-04 — [Backend] Release expired seat holds persistently

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Thêm expiry job thực sự cập nhật hold/RESERVED hết hạn trong database về trạng thái available/released. Không được chỉ render expired reservation như available trong DTO trong khi DB vẫn giữ RESERVED.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Query tìm hold active có `expiresAt <= now` dùng index và batch limit.
- [ ] Scheduler/update chuyển hold sang EXPIRED và inventory về AVAILABLE trong transaction.
- [ ] Job idempotent và an toàn multi-instance bằng claim/lock strategy.
- [ ] Confirm sau expiry thất bại bằng domain conflict rõ ràng.
- [ ] Race confirm-vs-expire có deterministic transaction rule và concurrency test.
- [ ] Scheduler dùng injected `Clock`, không gọi system time rải rác.
- [ ] Có structured log/metric cho scanned, expired, skipped và failed.
- [ ] Một batch lỗi không làm job ngừng vĩnh viễn; có retry/next-run behavior rõ.
- [ ] `toDto()` phản ánh persisted state, không tự che dữ liệu drift.

---

## Technical Notes / Constraints

- TTL phải configurable; issue `#115` có thể được link nếu vẫn open/relevant.
- Nếu hold nằm ở bảng riêng, state transition của hold và showtime-seat phải atomic.

---

## Related

- Branch: `fix/persist-expired-seat-hold-release`
- Depends on: `INV-03`; related `#115`
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

# P0-19 / INV-05 — [Backend] Keep showtime inventory capacity and counters consistent

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Chuẩn hóa đơn vị đo và cách tính `totalSeats`, `availableSeats`, `reservedSeats`, `soldSeats` để không sai với Couple/Sofa capacity. Thêm reconciliation để phát hiện drift giữa counters và `showtime_seat` inventory.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chốt counter unit là physical capacity/person hoặc sellable units và dùng nhất quán toàn API/UI.
- [ ] Couple/Sofa `capacity` được tính theo quyết định của `SEAT-01`; không coi một record luôn bằng một người.
- [ ] Counter không âm, không vượt capacity và thỏa invariant tổng đã document.
- [ ] SOLD chỉ được set sau booking/payment contract thành công; retry không tăng sold hai lần.
- [ ] Hold/release/expire/confirm/cancel update inventory/counter trong transaction hoặc counters được derive đáng tin cậy.
- [ ] Reconciliation operation so sánh counters với inventory và báo mismatch; auto-fix chỉ khi policy an toàn.
- [ ] Có query/index tránh N+1 khi tổng hợp nhiều showtime.
- [ ] Tests cover standard, couple, mixed room, expiry, cancellation và duplicate confirmation.

---

## API Specifications (if applicable)

Response showtime/admin inventory phải ghi rõ unit, ví dụ:

```json
{
  "showtimeId": 77,
  "capacityUnit": "PERSON",
  "totalCapacity": 120,
  "availableCapacity": 82,
  "heldCapacity": 4,
  "soldCapacity": 34
}
```

---

## Technical Notes / Constraints

- Không vừa lưu counters vừa derive ở các endpoint khác nhau mà không có source of truth.
- Reconciliation có thể là admin command/job; không chạy write trong customer GET.

---

## Related

- Branch: `fix/showtime-inventory-counter-consistency`
- Depends on: `SEAT-01`, `INV-04`
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-20 / ST-04 — [Backend] Implement showtime sale lifecycle and cancellation

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay delete/update tùy ý bằng lifecycle rõ cho showtime: schedule, open sale, suspend sale, cancel và complete. Mọi action phải bảo toàn seat/order history, có actor/reason và phối hợp với booking/payment khi đã phát sinh giao dịch.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chốt transition matrix tối thiểu `SCHEDULED → ON_SALE → COMPLETED` và nhánh `SUSPENDED/CANCELLED`.
- [ ] Open sale chỉ khi showtime đạt `ST-01`, inventory đã materialize và thời gian chưa qua cutoff.
- [ ] Suspend sale ngăn hold mới nhưng không xóa hold/order history.
- [ ] Cancel bắt buộc reason, actor, timestamp và idempotency key.
- [ ] Cancel chuyển inventory phù hợp sang CANCELLED/BLOCKED và phát event/outbox cho booking/payment refund workflow.
- [ ] Showtime đã có hold/booking/sale không hard-delete.
- [ ] Delete chỉ dùng cho draft/no-sale theo policy; nếu không cần thì deprecate `DELETE /api/schedules/{id}`.
- [ ] Update movie/room/time bị chặn sau khi sale mở hoặc phải qua reschedule workflow rõ.
- [ ] Scheduler/command complete showtime sau room-release time và idempotent.
- [ ] Public API chỉ trả showtime visible/bookable theo status và cutoff.
- [ ] Audit và integration tests cover suspend, cancel no-booking, cancel with-booking, duplicate cancel và complete.

---

## API Specifications (if applicable)

| Action | Method | Endpoint | Request |
|---|---|---|---|
| Open sale | `POST` | `/api/schedules/{id}/open-sale` | `{}` |
| Suspend sale | `POST` | `/api/schedules/{id}/suspend-sale` | `{ "reason": "..." }` |
| Resume sale | `POST` | `/api/schedules/{id}/resume-sale` | `{}` |
| Cancel | `POST` | `/api/schedules/{id}/cancel` | `{ "reason": "..." }` |

Tất cả command yêu cầu ADMIN/authorized operations role và trả state mới nhất.

---

## Technical Notes / Constraints

- Dùng transactional outbox nếu publish event cần bảo đảm cùng business transaction.
- Issue này không implement refund logic trong movie-service; chỉ chốt event/contract và trạng thái nguồn.

---

## Related

- Branch: `feat/showtime-sale-lifecycle-cancellation`
- Depends on: `INV-01`, booking/payment event contract
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

# P0-21 / API-01 — [Backend] Enforce movie-service endpoint authorization matrix

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Chuẩn hóa authorization theo resource/action thay vì permit toàn bộ GET theo wildcard. Public chỉ đọc movie/showtime/seat data đã publish/bookable; TMDB, audit, reference management và internal catalogs phải được bảo vệ đúng role.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có security matrix document cho Anonymous/CUSTOMER/EMPLOYEE/ADMIN/service credential.
- [ ] `GET /api/movies/** permitAll()` không còn làm TMDB/internal detail public ngoài ý muốn.
- [ ] Public movie/showtime/seat endpoints áp dụng publish/bookable predicate ở backend.
- [ ] EMPLOYEE chỉ tạo/chỉnh draft, submit và thao tác trong scope được giao.
- [ ] ADMIN mới approve/reject, reference-data mutation, schedule/cancel và room lifecycle theo policy.
- [ ] TMDB browse/details/import chỉ internal role được phép gọi.
- [ ] Seat hold/confirm/release yêu cầu authenticated owner hoặc authorized service.
- [ ] Audit endpoints không public.
- [ ] Resource server lấy actor/role từ verified JWT; không tin header actor do client tự gửi.
- [ ] Security tests cover từng row của matrix, gồm 401, 403, direct-ID enumeration và method mismatch.

---

## API Specifications (if applicable)

Security matrix tối thiểu:

| Resource | Anonymous/Customer | Employee | Admin |
|---|---|---|---|
| Public movie/showtime catalog | Read published | Read | Read |
| Internal movie catalog | Deny | Read/write draft | Full |
| TMDB browse/details/import | Deny | Theo policy, mặc định deny | Allow |
| Schedule mutation | Deny | Theo assigned scope | Allow |
| Seat hold | Authenticated customer only | Allow if needed | Allow/support |
| Audit/reference mutation | Deny | Deny/read-limited | Allow |

---

## Technical Notes / Constraints

- Kết hợp request matcher với `@PreAuthorize`; tránh rule rộng đứng trước rule hẹp.
- Public read không đồng nghĩa trả mọi record; authorization và visibility filter là hai lớp khác nhau.
- Kiểm tra gateway không forward spoofed identity headers.

---

## Related

- Branch: `fix/movie-service-authorization-matrix`
- Depends on: có thể làm song song; phối hợp `MOV-02`, `INV-03`
- Docs: `docs/issues/movie-service-industry-readiness-checklist.md`

---

# P0-22 / TEST-01 — [Backend] Add movie-service P0 regression and concurrency suite

**GitLab action:** Create new  
**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::High`

## Summary / Objective

Xây regression suite chứng minh các P0 hoạt động cùng nhau trên schema đã migrate. Test phải gồm workflow, authorization, scheduler boundary, showtime eligibility/overlap, inventory lifecycle và concurrency; không chỉ happy path controller mocks.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Movie happy flow: EMPLOYEE create → submit → ADMIN approve → publish/release → end.
- [ ] Reject/request-changes/rework giữ reason và audit actor/history.
- [ ] Public visibility test cho mọi MovieStatus và direct-ID enumeration.
- [ ] Scheduler release/end tests dùng fixed `Clock` tại date boundaries.
- [ ] Fresh DB và upgraded DB chạy room migration + create layout + generate seats integration test.
- [ ] Showtime tests cover eligibility, format, price, release window, maintenance và buffered overlap.
- [ ] Concurrent showtime create cùng room/time chỉ một request thành công.
- [ ] Inventory tests cover materialize-on-create, read-only GET, atomic lock, owner/idempotency, Couple group, expiry và counters.
- [ ] Concurrent seat hold cùng seat/group chỉ một request thắng và không partial lock.
- [ ] Showtime cancel test verify state, inventory và booking/payment event/outbox contract.
- [ ] Security tests cover authorization matrix của `API-01`.
- [ ] Postman/Newman smoke suite chạy trên database đã migrate; không phụ thuộc thứ tự/manual residue.
- [ ] Frontend build pass và có ít nhất một E2E admin scheduling flow cùng customer seat-selection flow.
- [ ] CI lưu test report và fail build khi P0 regression fail.

---

## Technical Notes / Constraints

- Ưu tiên Testcontainers PostgreSQL cho behavior constraint/locking thực; H2 không đủ để chứng minh PostgreSQL exclusion/locking semantics.
- Concurrency test phải dùng transaction/thread thật và timeout ổn định, không chỉ gọi method tuần tự.
- Có thể chia implementation thành checklist/MR nhỏ nhưng chỉ close issue khi toàn bộ P0 suite pass.

---

## Related

- Branch: `test/movie-service-p0-regression-suite`
- Depends on: tất cả P0 được test; triển khai test tăng dần cùng từng issue
- Docs: `docs/testing/movie-service-postman-test-cases.md`, `docs/issues/movie-service-industry-readiness-checklist.md`

---

## 2. Quy tắc assign và kéo trạng thái

- Assignee kéo issue từ `Open` sang `In Progress` ngay khi đã checkout branch và bắt đầu làm; leader không cần kéo thay trừ khi phân công lại hoặc member không có quyền board.
- Mỗi người chỉ nên có một issue `In Progress` chính tại một thời điểm; issue phụ thuộc chưa sẵn sàng giữ ở `Open`.
- Khi mở MR và đã tự test theo Acceptance Criteria, assignee kéo sang `Review/ QA` và gắn reviewer.
- Reviewer chỉ kéo `Completed/Closed` khi MR merge, migration/API docs liên quan đã cập nhật và các checkbox bắt buộc đều đạt.
- Không close issue bằng frontend workaround nếu business rule nằm ở backend/database.

## 3. Thứ tự triển khai ngắn gọn

1. Security/schema runtime: `SEC-01`, `DB-01`, `ROOM-01`, `CLU-02`.
2. Movie correctness: `MOV-01`, `MOV-02`, `MOV-03`, `MOV-04`, `MOV-05`, `MOV-06`.
3. Scheduling: `ST-01`, `ST-02`, `ST-03`, sau đó `INV-01`.
4. Revenue safety: `INV-02`, `INV-03`, `SEAT-01`, `INV-04`, `INV-05`.
5. Operational lifecycle: `ST-04`, `API-01`.
6. `TEST-01` được viết tăng dần từ phase đầu và hoàn tất sau các P0 còn lại.
