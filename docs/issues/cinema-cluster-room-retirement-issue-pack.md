# Cinema Cluster & Cinema Room Lifecycle — GitLab Issue Pack

> Format source: `docs/issues/ISSUE_TEMPLATE.md`  
> Scope: hard delete bản nháp, suspend/reactivate, maintenance và retire Cinema Cluster/Cinema Room mà không làm mất showtime, layout, booking reference hoặc audit history.  
> Canonical specification: `docs/api-specs/movie-service/CINEMA_CLUSTER_ROOM_LIFECYCLE_CONTRACT.md`  
> Cách dùng: copy **Title**, **Labels** và issue body tương ứng vào GitLab. Issue mới giữ ở `Open`; chỉ chuyển `In Progress` khi assignee bắt đầu triển khai.

## 1. Danh sách và thứ tự triển khai

| Thứ tự | ID | GitLab action | Size | Phụ thuộc |
|---:|---|---|---|---|
| 1 | `VENUE-LC-01` | Create new | M | Runtime migrations `#167` |
| 2 | `VENUE-LC-02` | Create new | M | `VENUE-LC-01` |
| 3 | `ROOM-LC-01` | Create new | M | `VENUE-LC-01` |
| 4 | `VENUE-LC-03` | Create new | L | `VENUE-LC-01`, `VENUE-LC-02`, `#185` |
| 5 | `ROOM-LC-02` | Create new | L | `VENUE-LC-01`, `ROOM-LC-01`, `#185` |
| 6 | `VENUE-LC-UI` | Create new | L | `VENUE-LC-02/03`, `ROOM-LC-01/02` |
| 7 | `#176` | Update existing issue | — | Cluster/room lifecycle contract |
| 8 | `#185` | Update existing issue | — | Closure impact/cancellation contract |
| 9 | `#186`, `#187` | Update existing issues | — | Tất cả issue backend phía trên |

---

# VENUE-LC-01 — [Database] Add auditable retirement lifecycle to cinema clusters and rooms

**Labels:** `Layer::Database`, `Type::Feature`, `Priority::High`

## Summary / Objective

Mở rộng schema để phân biệt rõ tạm ngừng vận hành với ngừng hoạt động vĩnh viễn cho Cinema Cluster và Cinema Room. Mọi thay đổi trạng thái phải có actor, lý do, thời điểm hiệu lực và lịch sử append-only; không được dùng hard delete làm mất audit hoặc các reference lịch sử.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `cinema_cluster.status` hỗ trợ trạng thái terminal `RETIRED`; `INACTIVE` chỉ mang nghĩa tạm ngừng và có thể reactivate.
- [ ] Chuẩn hóa ý nghĩa `CinemaRoomStatus`: `MAINTENANCE`, `TEMPORARILY_UNAVAILABLE`, `SUSPENDED` là tạm thời; `RETIRED` là terminal.
- [ ] `CLOSED` được deprecate/migrate hoặc được document bằng một semantics không trùng `RETIRED`; không để hai trạng thái cùng nghĩa “đóng vĩnh viễn”.
- [ ] Cluster và room có metadata tối thiểu: `status_reason`, `status_effective_at`, `status_changed_at`, `status_changed_by`, `retired_at`, `retired_by` theo contract đã chọn.
- [ ] Cluster và room có optimistic `version` hoặc cơ chế tương đương để ngăn lost update giữa hai lifecycle command đồng thời.
- [ ] Status history/audit là append-only và giữ được `resourceId/resourceCode`, from/to status, actor, reason, timestamp, correlation ID.
- [ ] Không dùng `ON DELETE CASCADE` làm mất audit history của resource đã từng vận hành.
- [ ] Index hỗ trợ truy vấn resource theo `status`, `status_effective_at` và lịch sử theo resource/time.
- [ ] Migration forward-only nâng cấp được database hiện hữu mà không đổi cluster/room/showtime/layout/seat IDs.
- [ ] Fresh database và upgraded database đều khởi động được với `ddl-auto=none`.
- [ ] Migration/integration test chứng minh dữ liệu `ACTIVE`, `INACTIVE`, `CLOSED` legacy được backfill theo policy đã document.

---

## Technical Notes / Constraints

- Dùng runtime migration source of truth của `#167`; không chỉ cập nhật `postgres-init/movie_db.sql`.
- Có thể reuse `cluster_audit_log`, nhưng phải bỏ semantics xóa cascade hoặc lưu audit tombstone độc lập trước khi xóa draft.
- Room maintenance history không thay thế room status history; maintenance là incident/work order, status history là lifecycle audit.
- Không thêm `isDeleted` nếu `status=RETIRED` đã biểu diễn đầy đủ lifecycle. `deleted_at` chỉ dùng nếu có retention/purge policy riêng.

---

## Related

- Branch: `feat/venue-room-retirement-schema`
- Depends on: `#167`
- Docs: `docs/issues/ISSUE_TEMPLATE.md`, `docs/issues/movie-service-industry-readiness-checklist.md`

---

# VENUE-LC-02 — [Backend] Restrict hard deletion to unused Cinema Cluster drafts

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Sửa `DELETE /api/cinema-clusters/{id}` để hard delete chỉ còn là thao tác xóa bản nháp chưa từng được sử dụng. Cluster đã submit, approve hoặc vận hành phải đi qua suspend/retire lifecycle, không được xóa vật lý chỉ vì hiện không còn room.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chỉ cho hard delete khi cluster đang `DRAFT` và chưa từng `ACTIVE`/`RETIRED` theo audit history.
- [ ] Chặn delete nếu cluster có room, movie availability, showtime reference hoặc operational history.
- [ ] Cross-service dependency như employee assignment/booking được kiểm tra qua policy đã chốt hoặc chặn an toàn nếu chưa thể xác minh.
- [ ] Không cascade xóa room, showtime, movie availability, booking reference hoặc audit history.
- [ ] Delete draft chạy trong một transaction và chỉ xóa dữ liệu con thực sự là draft/configuration chưa vận hành.
- [ ] Actor lấy từ verified security context; không nhận actor tùy ý từ client header và không hard-code `SYSTEM/Admin`.
- [ ] ADMIN hoặc role được policy cho phép mới được delete; EMPLOYEE không được xóa cluster đã submit.
- [ ] Thành công trả `204 No Content`; request lặp lại tuân theo idempotency/error contract đã document.
- [ ] Vi phạm lifecycle hoặc còn dependency trả `409 Conflict` với stable domain error code và thông tin dependency an toàn.
- [ ] Ghi audit tombstone gồm cluster ID/code, actor, timestamp và reason trước khi xóa bản nháp.
- [ ] Unit/integration/security tests cover DRAFT empty, DRAFT có room, ACTIVE không room, cluster có history và unauthorized role.

---

## API Specifications (if applicable)

### API 1 — Delete unused cluster draft

| Field | Details |
|---|---|
| Method | `DELETE` |
| Endpoint | `/api/cinema-clusters/{id}` |
| Description | Hard delete duy nhất cho cluster draft chưa từng vận hành |
| Auth Required | Yes — ADMIN/authorized creator theo policy |

**Response 204 No Content:** không có body.

**Response 409 Conflict:**

```json
{
  "code": 2024,
  "message": "Only an unused draft cinema cluster can be permanently deleted.",
  "details": {
    "resourceId": 11,
    "currentStatus": "ACTIVE",
    "blockingResource": "OPERATIONAL_HISTORY"
  }
}
```

---

## Technical Notes / Constraints

- Chuyển business logic đang nằm trong `CinemaClusterController` về service transactional.
- Không dùng `countRooms == 0` làm điều kiện duy nhất.
- Không triển khai purge dữ liệu lịch sử trong customer-facing API; retention/purge là quy trình quản trị dữ liệu riêng.

---

## Related

- Branch: `fix/cluster-draft-only-hard-delete`
- Depends on: `VENUE-LC-01`
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# ROOM-LC-01 — [Backend] Restrict hard deletion to unused Cinema Room drafts

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Sửa delete Cinema Room để chỉ xóa vật lý room draft chưa từng activate layout hoặc gắn showtime. Room đã được approve/activate phải được suspend, đưa vào maintenance hoặc retire để giữ nguyên seat/layout/showtime history.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Chỉ cho hard delete khi room đang `DRAFT` và chưa từng chuyển `APPROVED/ACTIVE/RETIRED`.
- [ ] Chặn delete nếu từng có showtime, kể cả showtime đã `COMPLETED/CANCELLED`.
- [ ] Chặn delete nếu có layout từng `APPROVED/ACTIVE` hoặc operational seat đã được materialize.
- [ ] Chặn delete nếu còn maintenance record/history không thể purge theo retention policy.
- [ ] Chỉ cascade xóa draft layout positions và draft-only seat/configuration trong cùng transaction.
- [ ] Không xóa active/inactive seat, layout version hoặc audit record đã được showtime lịch sử tham chiếu.
- [ ] Actor lấy từ verified JWT/security context; loại bỏ audit hard-code `SYSTEM`/`Admin`.
- [ ] ADMIN hoặc chính draft creator EMPLOYEE theo policy mới được delete; retire chỉ ADMIN.
- [ ] Thành công trả `204 No Content`; lifecycle/dependency conflict trả `409` với stable domain error.
- [ ] Concurrent delete và submit/approve chỉ một command thắng nhờ optimistic/pessimistic concurrency control.
- [ ] Tests cover empty draft, draft có draft layout, active room chưa có showtime, room có historical showtime, approved layout và concurrent transition.

---

## API Specifications (if applicable)

### API 1 — Delete unused room draft

| Field | Details |
|---|---|
| Method | `DELETE` |
| Endpoint | `/api/cinema-rooms/{id}` |
| Description | Hard delete duy nhất cho room draft chưa từng vận hành |
| Auth Required | Yes — ADMIN/authorized draft creator |

**Response 204 No Content:** không có body.

**Response 409 Conflict:**

```json
{
  "code": 2028,
  "message": "Only an unused draft cinema room can be permanently deleted.",
  "details": {
    "resourceId": 42,
    "currentStatus": "ACTIVE",
    "blockingResource": "ACTIVE_LAYOUT"
  }
}
```

---

## Technical Notes / Constraints

- Rule “không có showtime” hiện tại là cần thiết nhưng chưa đủ; phải thêm lifecycle/layout/history gates.
- Không regenerate hoặc delete operational seats chỉ để thỏa điều kiện xóa room.
- Nếu draft room có layout draft, xóa positions trước layout theo FK trong cùng transaction.

---

## Related

- Branch: `fix/room-draft-only-hard-delete`
- Depends on: `VENUE-LC-01`
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# VENUE-LC-03 — [Backend] Implement Cinema Cluster suspension, reactivation and retirement lifecycle

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay thao tác “delete cluster” trong vận hành bằng command suspend, reactivate và retire có impact preview. Cluster lifecycle phải chặn scheduling/public sale phù hợp, bảo toàn room state nội tại và không tự động xóa hoặc hủy dữ liệu giao dịch.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Transition matrix tối thiểu: `ACTIVE → INACTIVE → ACTIVE` và `ACTIVE/INACTIVE → RETIRED`; `RETIRED` là terminal.
- [ ] Suspend/retire bắt buộc `reason`; retire hỗ trợ `effectiveAt` và chỉ ADMIN được thực hiện.
- [ ] Có impact preview trả số room, active/open availability, future showtime, on-sale showtime và resource cần manual resolution.
- [ ] Cluster `INACTIVE/RETIRED` bị loại khỏi public cluster catalog và không nhận schedule/open-sale mới.
- [ ] Không mass-update room status khi cluster suspend; effective availability được tính từ cả parent cluster và room để giữ room state riêng.
- [ ] Retire bị chặn khi còn future `SCHEDULED/ON_SALE` showtime hoặc open availability chưa được resolve theo policy.
- [ ] Không tự động cancel/refund âm thầm; cancellation dùng command/contract của `#185` và booking/payment xử lý downstream.
- [ ] Reactivate chỉ thành công khi cluster chưa `RETIRED` và configuration vẫn đạt operational readiness.
- [ ] Command idempotent; retry cùng trạng thái không tạo duplicate audit event.
- [ ] Mọi transition cập nhật status và audit history atomically, dùng verified actor, reason và correlation ID.
- [ ] Concurrent lifecycle commands được bảo vệ bởi `@Version`/locking và trả `409` khi conflict.
- [ ] Unit/integration tests cover valid matrix, terminal RETIRED, unresolved impact, public visibility, scheduling gate và duplicate command.

---

## API Specifications (if applicable)

### API 1 — Preview cluster closure impact

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/cinema-clusters/{id}/closure-impact?effectiveAt={timestamp}` |
| Description | Read-only preview các resource bị ảnh hưởng trước suspend/retire |
| Auth Required | Yes — ADMIN |

**Response 200 OK:**

```json
{
  "code": 1000,
  "result": {
    "clusterId": 11,
    "roomCount": 8,
    "openAvailabilityCount": 14,
    "futureShowtimeCount": 32,
    "onSaleShowtimeCount": 18,
    "canRetire": false,
    "blockers": ["OPEN_AVAILABILITY", "FUTURE_ON_SALE_SHOWTIME"]
  }
}
```

### API 2 — Suspend cluster operations

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-clusters/{id}/suspend` |
| Description | Tạm ngừng vận hành cluster |
| Auth Required | Yes — ADMIN |

**Request Body:**

```json
{
  "reason": "Temporary closure for renovation",
  "effectiveAt": "2026-08-01T00:00:00+07:00"
}
```

### API 3 — Reactivate cluster

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-clusters/{id}/reactivate` |
| Description | Khôi phục cluster từ INACTIVE về ACTIVE |
| Auth Required | Yes — ADMIN |

### API 4 — Retire cluster permanently

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-clusters/{id}/retire` |
| Description | Ngừng vận hành cluster vĩnh viễn sau khi giải quyết dependencies |
| Auth Required | Yes — ADMIN |

**Request Body:**

```json
{
  "reason": "Lease contract expired",
  "effectiveAt": "2026-12-31T23:59:59+07:00"
}
```

---

## Technical Notes / Constraints

- Không cho generic update DTO thay đổi lifecycle tùy ý; dùng explicit command endpoints.
- Effective operational state của room có thể là `cluster.status == ACTIVE && room.status == ACTIVE` mà không overwrite room status.
- Nếu hỗ trợ future `effectiveAt`, cần job/outbox an toàn multi-instance; nếu chưa có scheduler, chỉ cho immediate transition và document giới hạn.

---

## Related

- Branch: `feat/cinema-cluster-operational-lifecycle`
- Depends on: `VENUE-LC-01`, `VENUE-LC-02`, `#185`
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# ROOM-LC-02 — [Backend] Implement Cinema Room suspension, maintenance and retirement lifecycle

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Chuẩn hóa operational lifecycle của Cinema Room thay cho generic `PATCH status` cho phép chuyển tùy ý. Room bị sự cố, bảo trì, tạm ngừng hoặc retire phải chặn scheduling/sale phù hợp nhưng vẫn giữ nguyên layout, seats, historical showtimes và audit.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có transition matrix rõ cho `ACTIVE`, `MAINTENANCE`, `TEMPORARILY_UNAVAILABLE`, `SUSPENDED`, `RETIRED`; không cho arbitrary enum transition.
- [ ] `MAINTENANCE/TEMPORARILY_UNAVAILABLE/SUSPENDED` có thể phục hồi; `RETIRED` là terminal.
- [ ] Report maintenance lưu incident/work-order và trạng thái trước đó; resolve không luôn ép về `ACTIVE` nếu room trước đó đang `SUSPENDED`.
- [ ] Suspend/retire yêu cầu `reason`; retire chỉ ADMIN, maintenance có thể cho authorized EMPLOYEE theo policy.
- [ ] Có impact preview cho future showtime, on-sale showtime, active hold/inventory snapshot và active layout.
- [ ] Room không `ACTIVE`, cluster không `ACTIVE` hoặc không có active layout bị chặn schedule/open-sale ở backend.
- [ ] Retire bị chặn cho tới khi future showtimes được relocate/cancel qua workflow `#185`.
- [ ] Suspend/maintenance không xóa seat, layout, showtime hoặc lịch sử; active layout vẫn là historical source of truth.
- [ ] Reactivate yêu cầu cluster ACTIVE, không còn maintenance mở và layout ACTIVE hợp lệ.
- [ ] Command idempotent và audit atomically với verified actor, reason, timestamp, correlation ID.
- [ ] Concurrent maintenance/suspend/retire được kiểm soát bằng version/lock và stable `409` conflict.
- [ ] Tests cover maintenance resolve về prior status, retire blocker, cluster inactive, missing active layout, unauthorized EMPLOYEE và concurrent transitions.

---

## API Specifications (if applicable)

### API 1 — Preview room closure impact

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/cinema-rooms/{id}/closure-impact?effectiveAt={timestamp}` |
| Description | Preview showtime/layout/inventory bị ảnh hưởng |
| Auth Required | Yes — ADMIN/authorized operations role |

### API 2 — Suspend room

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-rooms/{id}/suspend` |
| Description | Tạm ngừng phòng vì lý do vận hành |
| Auth Required | Yes — ADMIN |

**Request Body:**

```json
{
  "reason": "Projection system certification expired"
}
```

### API 3 — Reactivate room

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-rooms/{id}/reactivate` |
| Description | Khôi phục room khi readiness đạt yêu cầu |
| Auth Required | Yes — ADMIN |

### API 4 — Retire room

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-rooms/{id}/retire` |
| Description | Ngừng sử dụng room vĩnh viễn |
| Auth Required | Yes — ADMIN |

**Request Body:**

```json
{
  "reason": "Auditorium permanently converted to retail space",
  "effectiveAt": "2026-09-30T23:59:59+07:00"
}
```

---

## Technical Notes / Constraints

- Deprecate generic `PATCH /api/cinema-rooms/{id}/status` hoặc chỉ giữ làm internal command có transition validator chung.
- Không tin `X-User-Name`; actor lấy từ JWT claims/security principal.
- Không implement refund trong movie-service; chỉ expose blockers và phối hợp cancellation/outbox contract.

---

## Related

- Branch: `feat/cinema-room-operational-lifecycle`
- Depends on: `VENUE-LC-01`, `ROOM-LC-01`, `#176`, `#185`
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# VENUE-LC-UI — [Frontend] Replace cluster and room delete controls with lifecycle-aware actions

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Thay nút Delete chung trên trang Cinema Cluster/Cinema Room bằng action theo trạng thái: Delete draft, Suspend operations, Maintenance, Reactivate và Retire permanently. UI phải hiển thị impact preview để Admin hiểu số showtime/resource bị ảnh hưởng trước khi xác nhận.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `DRAFT` chỉ hiển thị `Delete draft`; không dùng label Delete cho resource đang vận hành.
- [ ] `ACTIVE` hiển thị `Suspend operations` và `Retire permanently` theo quyền.
- [ ] `INACTIVE/SUSPENDED` hiển thị `Reactivate` và `Retire permanently`.
- [ ] `MAINTENANCE/TEMPORARILY_UNAVAILABLE` hiển thị trạng thái sự cố và action resolve phù hợp.
- [ ] `RETIRED` không hiển thị delete/reactivate; resource bị ẩn khỏi danh sách mặc định nhưng xem được qua filter Archived/Retired.
- [ ] Delete draft confirmation phân biệt rõ đây là xóa vĩnh viễn và chỉ dùng cho draft chưa vận hành.
- [ ] Suspend/retire dialog bắt buộc nhập reason và tải closure-impact preview trước khi cho confirm.
- [ ] Dialog hiển thị tối thiểu room count, future showtime, on-sale showtime, availability/blocker và hướng xử lý tiếp theo.
- [ ] Confirm bị disable khi backend trả blocker; không cho frontend bypass bằng cách gọi command trực tiếp từ UI.
- [ ] Loading, empty, 409 conflict, stale version và retry states được xử lý rõ ràng.
- [ ] Action visibility dựa trên backend permissions/current status; frontend không phải lớp enforce duy nhất.
- [ ] Toast/message dùng thuật ngữ `Suspended`, `Reactivated`, `Retired`, không dùng chung `Deleted successfully`.
- [ ] Dark/light mode, keyboard focus, destructive confirmation và responsive layout được QA.
- [ ] Frontend tests cover action matrix cho DRAFT, ACTIVE, SUSPENDED, MAINTENANCE và RETIRED.

---

## UI Reference / Mockup

- Cluster/Room detail dùng action menu hoặc lifecycle action group thay nút Delete màu đỏ mặc định.
- `Retire permanently` được đặt trong danger zone, yêu cầu reason và confirm tên/code resource.
- Impact preview hiển thị trong modal/drawer trước bước xác nhận cuối.

---

## API Specifications (if applicable)

Frontend tích hợp các API closure impact, suspend, reactivate, retire và draft-only delete từ `VENUE-LC-02/03` và `ROOM-LC-01/02`.

---

## Technical Notes / Constraints

- Không tự suy luận `canDelete` chỉ bằng `rooms.length === 0`; dùng status/capability do backend trả.
- Nên để backend trả `allowedActions` hoặc stable status/error contract nếu action matrix còn thay đổi.
- Không optimistic-remove resource khỏi list trước khi lifecycle command thành công.

---

## Related

- Branch: `feat/venue-room-lifecycle-actions-ui`
- Depends on: `VENUE-LC-02`, `VENUE-LC-03`, `ROOM-LC-01`, `ROOM-LC-02`
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

## 2. Acceptance Criteria cần bổ sung vào issue hiện có

### Update `#176` — Enforce showtime scheduling eligibility

Thêm các checkbox:

- [ ] Không cho create/bulk-create/open-sale showtime nếu cluster không `ACTIVE`.
- [ ] Không cho schedule nếu room không `ACTIVE`, không có active layout hoặc đang có maintenance mở.
- [ ] `RETIRED` cluster/room luôn không eligible; không có transition nào bypass rule này.
- [ ] Eligibility được enforce ở service dùng chung cho standalone, bulk và automatic generation.
- [ ] Tests cover cluster `INACTIVE/RETIRED` và room `SUSPENDED/MAINTENANCE/RETIRED`.

### Update `#185` — Implement showtime sale lifecycle and cancellation

Thêm các checkbox:

- [ ] Cluster/room closure impact dùng cùng query/policy xác định future `SCHEDULED/ON_SALE` showtime.
- [ ] Suspend/retire cluster/room không tự hard-delete showtime hoặc booking history.
- [ ] Retire bị block cho tới khi affected showtimes được cancel/relocate theo explicit command.
- [ ] Cancellation bắt buộc actor/reason, idempotent và phát event/outbox cho booking/payment downstream.
- [ ] Integration test cover room maintenance và cluster retirement có future on-sale showtime.

### Update `#186` — Enforce movie-service endpoint authorization matrix

Thêm các checkbox:

- [ ] Chỉ ADMIN được retire cluster/room và xem full closure impact.
- [ ] Authorized EMPLOYEE chỉ được report/resolve maintenance hoặc delete draft do mình tạo theo policy.
- [ ] Actor lấy từ verified security context; không tin `X-User-Name`/`X-Role` do client gửi.
- [ ] Security tests cover delete draft, suspend, reactivate, maintenance và retire.

### Update `#187` — Add movie-service P0 regression and concurrency suite

Thêm các checkbox:

- [ ] Migration test nâng cấp cluster/room legacy statuses sang lifecycle mới mà không mất ID/history.
- [ ] Hard delete tests chứng minh chỉ unused DRAFT được xóa.
- [ ] Lifecycle tests cover cluster suspend/reactivate/retire và room maintenance/suspend/reactivate/retire.
- [ ] Historical showtime/layout/seat/audit vẫn đọc được sau retirement.
- [ ] Concurrent delete-vs-submit và retire-vs-reactivate chỉ một command thắng.
- [ ] Public catalog và scheduling không trả/nhận cluster hoặc room không operational.

---

## 3. Quy tắc assign

- Database issue `VENUE-LC-01` làm trước để khóa enum, metadata và migration contract.
- Cluster và Room backend có thể làm song song sau khi schema contract được chốt.
- Frontend chỉ bắt đầu integration sau khi API/error contract của hai backend issue ổn định.
- Không close backend issue nếu mới ẩn nút Delete ở frontend; business rule phải được backend/database enforce.
- Không close lifecycle issue nếu chưa chứng minh historical showtime/layout/audit vẫn đọc được.
