# Đặc tả vòng đời Cinema Cluster và Cinema Room

**Document ID:** `VENUE-ROOM-LC-01`  
**Module:** `movie-service`  
**Status:** Proposed canonical contract  
**Last updated:** 2026-07-18  
**Related issue pack:** `docs/issues/cinema-cluster-room-retirement-issue-pack.md`

---

## 1. Mục tiêu

Tài liệu này chuẩn hóa cách xóa, tạm ngừng, bảo trì, kích hoạt lại và ngừng vận hành vĩnh viễn đối với:

- **Cinema Cluster**: một địa điểm/cụm rạp vật lý.
- **Cinema Room**: một phòng chiếu/screen/auditorium thuộc Cinema Cluster.

Mục tiêu chính:

1. Không làm mất lịch sử showtime, seat layout, ticket, booking, doanh thu hoặc audit.
2. Phân biệt rõ **hard delete bản nháp** với **operational lifecycle transition**.
3. Chặn scheduling, public visibility và booking dựa trên trạng thái vận hành hiệu lực.
4. Cung cấp impact preview trước thao tác có ảnh hưởng lớn.
5. Giữ API, database, frontend và test dùng cùng một business contract.

---

## 2. Phạm vi

### 2.1 Trong phạm vi

- Hard delete Cluster/Room chưa từng vận hành.
- Suspend, reactivate và retire Cinema Cluster.
- Maintenance, temporarily unavailable, suspend, reactivate và retire Cinema Room.
- Kiểm tra dependency trước delete/retire.
- Ảnh hưởng tới public catalog, showtime scheduling và sale eligibility.
- Authorization, audit, optimistic concurrency và idempotency.
- Database migration và backward compatibility.
- UI action matrix và impact confirmation.

### 2.2 Ngoài phạm vi

- Thực thi refund trong `movie-service`.
- Tự động chuyển booking sang showtime/phòng khác.
- Xóa dữ liệu lịch sử theo retention/compliance policy.
- Tích hợp trực tiếp TMS/DCP/KDM hoặc phần cứng rạp.
- Lập lịch đóng cửa trong tương lai ở P0; P0 chỉ thực hiện transition tức thời.

`movie-service` chỉ xác định affected showtimes, ngăn thao tác không an toàn và phát contract/event cần thiết. Refund, notification hoặc customer remediation thuộc service tương ứng.

---

## 3. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| Hard delete | Xóa vật lý record và draft-only child data khỏi database. |
| Soft retirement | Giữ record nhưng chuyển trạng thái terminal `RETIRED`. |
| Suspend | Tạm ngừng vận hành vì quyết định quản trị; có thể reactivate. |
| Maintenance | Phòng được đưa vào bảo trì theo incident/work order cụ thể. |
| Temporarily unavailable | Phòng tạm thời không sử dụng được do sự cố đột xuất. |
| Retire | Ngừng vận hành vĩnh viễn; không được reactivate. |
| Operational history | Bất kỳ dấu vết từng approve/activate, showtime, layout active, inventory, booking reference hoặc audit transition. |
| Impact preview | Kết quả read-only mô tả các resource bị ảnh hưởng và blocker trước một lifecycle command. |
| Effective operational state | Trạng thái thực tế được suy ra từ cả parent cluster, room, layout và maintenance; không chỉ từ một cột status. |
| Terminal state | Trạng thái không có transition đi ra; trong tài liệu này là `RETIRED`. |

---

## 4. Nguyên tắc nghiệp vụ

### BR-01 — Stable identity

Cluster ID, cluster code, room ID, room code và layout ID đã từng vận hành phải được giữ ổn định. Không tái sử dụng code của resource đã từng `ACTIVE` hoặc `RETIRED`.

### BR-02 — Hard delete is draft-only

Hard delete chỉ dùng cho resource `DRAFT`, chưa từng vận hành và không có dependency lịch sử. Việc hiện tại không còn room/showtime không đủ để kết luận có thể xóa.

### BR-03 — Operational resources are retired, not deleted

Resource đã approve/activate phải dùng `INACTIVE`, `SUSPENDED`, `MAINTENANCE` hoặc `RETIRED`. Không cascade delete dữ liệu lịch sử.

### BR-04 — No silent transaction destruction

Suspend/retire không tự động xóa hoặc silently cancel showtime, booking, ticket hoặc payment. Affected resources phải được hiển thị và xử lý qua workflow rõ ràng.

### BR-05 — Backend is the policy owner

Frontend chỉ hỗ trợ UX. Backend/database phải enforce lifecycle transition, dependency, authorization và concurrency.

### BR-06 — Audit is append-only

Mỗi transition phải ghi from/to status, actor, reason, timestamp và correlation ID trong cùng business transaction hoặc qua transactional outbox.

### BR-07 — Historical reads remain available

Cluster/Room `RETIRED` bị ẩn khỏi public/active list mặc định nhưng vẫn truy vấn được trong internal history/reporting API.

### BR-08 — P0 transitions are immediate

Trong P0, `effectiveAt` phải bỏ trống hoặc không lớn hơn thời điểm hiện tại cộng clock-skew cho phép. Future-dated transition cần scheduler/claim strategy riêng và thuộc P1.

---

## 5. Cinema Cluster lifecycle

### 5.1 Trạng thái chuẩn

```text
                         reject
                         ┌─────┐
                         ▼     │
DRAFT ──submit──> PENDING_REVIEW ──approve──> ACTIVE
  │                                             │  ▲
  └──hard delete                               │  │ reactivate
                                                ▼  │
                                             INACTIVE
                                                │
                              retire            │
                   ACTIVE/INACTIVE ─────────────┴──> RETIRED
```

| Status | Ý nghĩa | Public | Cho tạo showtime | Có thể quay lại |
|---|---|---:|---:|---:|
| `DRAFT` | Bản nháp nội bộ | Không | Không | Có |
| `PENDING_REVIEW` | Chờ duyệt | Không | Không | Có, qua reject/request changes |
| `ACTIVE` | Đang vận hành | Có | Có, nếu các gate khác đạt | — |
| `INACTIVE` | Tạm ngừng toàn cụm | Không | Không | Có, về `ACTIVE` |
| `RETIRED` | Đóng vĩnh viễn | Không | Không | Không |

### 5.2 Transition matrix

| From | Command | To | Role | Điều kiện chính |
|---|---|---|---|---|
| `DRAFT` | delete draft | record removed | ADMIN hoặc authorized creator | Chưa từng vận hành, không dependency |
| `DRAFT` | submit | `PENDING_REVIEW` | ADMIN/EMPLOYEE | Readiness hợp lệ |
| `PENDING_REVIEW` | approve | `ACTIVE` | ADMIN | Approval policy đạt |
| `PENDING_REVIEW` | reject | `DRAFT` | ADMIN | Reason bắt buộc |
| `ACTIVE` | suspend | `INACTIVE` | ADMIN | Reason bắt buộc; impact được ghi nhận |
| `INACTIVE` | reactivate | `ACTIVE` | ADMIN | Operational readiness đạt |
| `ACTIVE` | retire | `RETIRED` | ADMIN | Không còn unresolved blocker |
| `INACTIVE` | retire | `RETIRED` | ADMIN | Không còn unresolved blocker |

Mọi transition khác trả `409 Conflict`.

### 5.3 Suspend Cluster

Khi Cluster chuyển `ACTIVE → INACTIVE`:

- Ngay lập tức bị loại khỏi public cluster catalog.
- Không cho create/bulk-create/automatic-generate showtime mới.
- Không cho open sale hoặc tạo seat hold mới tại các room thuộc cluster.
- Không mass-update room status; room giữ state riêng để có thể phục hồi đúng sau reactivate.
- Future showtimes được đưa vào danh sách `requiresResolution`; không bị hard delete.
- Existing booking/ticket vẫn giữ nguyên để operations quyết định cancel/relocate/refund.

Suspend có thể thực hiện dù có future showtime để hỗ trợ incident khẩn cấp, nhưng response phải trả số resource chưa giải quyết.

### 5.4 Reactivate Cluster

Chỉ cho reactivate khi:

- Current status là `INACTIVE`.
- Cluster configuration còn hợp lệ.
- Không có blocker ở cấp cluster ngăn vận hành.
- Request không stale theo optimistic version.

Reactivate Cluster không tự chuyển Room `SUSPENDED/MAINTENANCE/RETIRED` về `ACTIVE`.

### 5.5 Retire Cluster

Retire là thao tác terminal và chỉ thành công khi:

- Không còn movie availability `PLANNED/OPEN` chưa được close/suspend theo policy.
- Không còn future showtime `SCHEDULED/ON_SALE` chưa cancel/relocate.
- Booking/payment dependency cho affected showtimes đã được resolve hoặc xác nhận qua downstream contract.
- Reason bắt buộc và actor là ADMIN hợp lệ.

Retire không xóa rooms, layouts, seats, showtimes, audit hoặc reporting data.

---

## 6. Cinema Room lifecycle

### 6.1 Trạng thái chuẩn

```text
DRAFT ──submit──> PENDING_APPROVAL ──approve──> APPROVED ──activate──> ACTIVE
  │                                                                    │
  └──hard delete                                                       ├──> MAINTENANCE ──resolve──┐
                                                                       ├──> TEMPORARILY_UNAVAILABLE ─┤
                                                                       ├──> SUSPENDED ──reactivate────┤
                                                                       │                              │
                                                                       └────────retire────────> RETIRED
```

### 6.2 Trạng thái và semantics

| Status | Ý nghĩa | Bookable | Có thể quay lại |
|---|---|---:|---:|
| `DRAFT` | Room/layout đang soạn | Không | Có |
| `PENDING_APPROVAL` | Layout chờ duyệt | Không | Có |
| `APPROVED` | Layout đã duyệt, chưa activate | Không | Có |
| `ACTIVE` | Room và active layout đang vận hành | Có | — |
| `MAINTENANCE` | Bảo trì có work order | Không | Có |
| `TEMPORARILY_UNAVAILABLE` | Sự cố đột xuất | Không | Có |
| `SUSPENDED` | Admin tạm ngừng | Không | Có |
| `RETIRED` | Ngừng sử dụng vĩnh viễn | Không | Không |

`CLOSED` được deprecate vì trùng nghĩa với `RETIRED` hoặc dễ bị hiểu nhầm với giờ đóng cửa hằng ngày. Daily opening/closing thuộc `cinema_cluster_operating_hour`, không phải room lifecycle.

### 6.3 Hard delete Room

Chỉ cho phép khi tất cả điều kiện đúng:

- Current status là `DRAFT`.
- Chưa từng `APPROVED/ACTIVE/RETIRED` theo history.
- Chưa từng có showtime ở bất kỳ status nào.
- Không có layout từng `APPROVED/ACTIVE`.
- Không có operational `showtime_seat` hoặc external booking reference.
- Chỉ có draft layout positions/configuration có thể xóa an toàn.

### 6.4 Maintenance và Temporary Unavailable

- `MAINTENANCE` phải liên kết maintenance record có reason, severity, startedAt và owner.
- `TEMPORARILY_UNAVAILABLE` dùng cho incident tức thời; vẫn phải ghi incident/audit reason.
- Cả hai trạng thái chặn schedule, open sale và seat hold mới.
- Resolve maintenance phải khôi phục **previous recoverable status**, không mặc định luôn về `ACTIVE`.
- Nếu trước maintenance room đang `SUSPENDED`, resolve trả room về `SUSPENDED`.
- Chỉ về `ACTIVE` khi cluster ACTIVE, không còn maintenance mở và active layout hợp lệ.

### 6.5 Suspend Room

`ACTIVE → SUSPENDED` dùng cho quyết định vận hành không nhất thiết có maintenance work order. Reason bắt buộc. Future showtime được đưa vào impact resolution nhưng không bị xóa.

### 6.6 Retire Room

Chỉ cho retire khi:

- Không còn future showtime `SCHEDULED/ON_SALE` chưa được resolve.
- Không còn active seat hold hoặc booking dependency chưa xử lý.
- Reason bắt buộc và actor là ADMIN.
- Active layout được giữ làm historical snapshot, không xóa.

Room `RETIRED` không được reactivate. Nếu cùng không gian vật lý được xây dựng thành phòng mới với cấu hình khác, tạo Room mới với ID/code mới theo naming policy.

---

## 7. Effective operational state

Trạng thái bookable/schedulable không được xác định chỉ bằng `cinema_room.status`.

### 7.1 Schedulable predicate

```text
cluster.status == ACTIVE
AND room.status == ACTIVE
AND room has ACTIVE layout
AND no unresolved maintenance
AND movie availability permits scheduling
AND showtime-specific eligibility passes
```

### 7.2 Bookable predicate

```text
schedulable predicate passes
AND showtime.status == ON_SALE
AND current time is inside sale window
AND inventory is initialized and available
```

Predicate phải được reuse cho:

- Standalone showtime creation.
- Bulk generation.
- Automatic generation.
- Open-sale command.
- Public showtime catalog.
- Seat hold creation.

Không copy business rule khác nhau giữa từng controller.

---

## 8. Dependency và impact rules

### 8.1 Cluster impact preview

Tối thiểu gồm:

- Tổng room theo status.
- Movie availability `PLANNED/OPEN/SUSPENDED`.
- Future showtime theo status.
- On-sale showtime.
- Số seat hold/sold inventory nếu movie-service có dữ liệu.
- Downstream booking dependency: resolved, unresolved hoặc unknown.
- Danh sách blocker và allowed actions.

### 8.2 Room impact preview

Tối thiểu gồm:

- Active layout ID/version.
- Future showtime và on-sale showtime.
- Active hold/sold inventory.
- Open maintenance records.
- Parent cluster effective status.
- Blocker và allowed actions.

### 8.3 Fail-closed policy

Nếu downstream dependency bắt buộc nhưng service không truy vấn được:

- Impact trả dependency status `UNKNOWN`.
- Retire bị chặn.
- Suspend khẩn cấp vẫn được phép nhưng ngăn sale/hold mới và tạo operational alert.

---

## 9. API contract

### 9.1 Delete unused Cluster draft

```http
DELETE /api/cinema-clusters/{clusterId}
Authorization: Bearer <token>
```

Success:

```http
204 No Content
```

### 9.2 Delete unused Room draft

```http
DELETE /api/cinema-rooms/{roomId}
Authorization: Bearer <token>
```

Success: `204 No Content`.

### 9.3 Closure impact

```http
GET /api/cinema-clusters/{clusterId}/closure-impact
GET /api/cinema-rooms/{roomId}/closure-impact
```

Response:

```json
{
  "code": 1000,
  "result": {
    "resourceType": "CINEMA_ROOM",
    "resourceId": 42,
    "currentStatus": "ACTIVE",
    "version": 7,
    "futureShowtimeCount": 6,
    "onSaleShowtimeCount": 4,
    "activeHoldCount": 12,
    "activeLayoutId": 91,
    "canSuspend": true,
    "canRetire": false,
    "blockers": [
      "FUTURE_ON_SALE_SHOWTIME",
      "ACTIVE_SEAT_HOLD"
    ],
    "requiresResolution": true
  }
}
```

### 9.4 Suspend

```http
POST /api/cinema-clusters/{clusterId}/suspend
POST /api/cinema-rooms/{roomId}/suspend
Content-Type: application/json
```

```json
{
  "reason": "Temporary closure for renovation",
  "expectedVersion": 7
}
```

### 9.5 Reactivate

```http
POST /api/cinema-clusters/{clusterId}/reactivate
POST /api/cinema-rooms/{roomId}/reactivate
```

```json
{
  "expectedVersion": 8
}
```

### 9.6 Retire

```http
POST /api/cinema-clusters/{clusterId}/retire
POST /api/cinema-rooms/{roomId}/retire
Content-Type: application/json
```

```json
{
  "reason": "Lease contract expired",
  "expectedVersion": 8
}
```

### 9.7 Maintenance

Giữ endpoint hiện hữu nhưng chuẩn hóa actor và previous status:

```http
POST /api/cinema-rooms/{roomId}/maintenance
POST /api/cinema-rooms/maintenance/{maintenanceId}/resolve
```

### 9.8 Lifecycle response

```json
{
  "code": 1000,
  "result": {
    "resourceType": "CINEMA_CLUSTER",
    "resourceId": 11,
    "fromStatus": "ACTIVE",
    "toStatus": "INACTIVE",
    "reason": "Temporary closure for renovation",
    "version": 9,
    "changedAt": "2026-07-18T16:30:00+07:00",
    "requiresResolution": true,
    "affectedFutureShowtimes": 18
  }
}
```

---

## 10. Error contract

| HTTP | Symbolic code | Khi sử dụng |
|---:|---|---|
| 400 | `LIFECYCLE_REQUEST_INVALID` | Thiếu reason hoặc body không hợp lệ |
| 401 | `UNAUTHENTICATED` | Không có identity hợp lệ |
| 403 | `LIFECYCLE_ACTION_FORBIDDEN` | Role không được phép |
| 404 | `CLUSTER_NOT_FOUND` / `CINEMA_ROOM_NOT_FOUND` | Resource không tồn tại |
| 409 | `CLUSTER_DELETE_NOT_ALLOWED` | Cluster không phải unused DRAFT |
| 409 | `ROOM_DELETE_NOT_ALLOWED` | Room không phải unused DRAFT |
| 409 | `LIFECYCLE_INVALID_TRANSITION` | From/to không hợp lệ |
| 409 | `RETIREMENT_BLOCKED` | Còn unresolved dependency |
| 409 | `RESOURCE_CONCURRENTLY_MODIFIED` | `expectedVersion` đã stale |
| 422 | `FUTURE_EFFECTIVE_TIME_NOT_SUPPORTED` | P0 nhận future-dated command |
| 503 | `DEPENDENCY_STATUS_UNKNOWN` | Không xác minh được dependency bắt buộc |

Error response không expose booking customer PII hoặc internal stack trace.

---

## 11. Authorization matrix

| Action | CUSTOMER | EMPLOYEE | ADMIN |
|---|---:|---:|---:|
| Xem public ACTIVE Cluster/Room | Read | Read | Read |
| Xem retired/internal history | Deny | Theo scope | Allow |
| Delete own unused DRAFT | Deny | Allow theo ownership policy | Allow |
| Delete draft của người khác | Deny | Deny | Allow |
| Report maintenance | Deny | Allow | Allow |
| Resolve maintenance | Deny | Allow theo assignment | Allow |
| Suspend/reactivate Cluster | Deny | Deny | Allow |
| Suspend/reactivate Room | Deny | Theo operations policy | Allow |
| Retire Cluster/Room | Deny | Deny | Allow |
| Xem full closure impact | Deny | Theo scope, redacted | Allow |

Actor phải lấy từ verified JWT/security context. Không tin `X-User-Name`, `X-Role` hoặc actor field do client tự gửi.

---

## 12. Data model

### 12.1 Cinema Cluster

Các field canonical:

```text
status
version
status_reason
status_effective_at
status_changed_at
status_changed_by
retired_at
retired_by
```

`ClusterStatus`:

```text
DRAFT, PENDING_REVIEW, ACTIVE, INACTIVE, RETIRED
```

### 12.2 Cinema Room

Các field canonical tương tự Cluster. `CinemaRoomStatus` canonical:

```text
DRAFT, PENDING_APPROVAL, APPROVED, ACTIVE,
MAINTENANCE, TEMPORARILY_UNAVAILABLE, SUSPENDED, RETIRED
```

Maintenance record cần thêm hoặc bảo đảm có:

```text
previous_room_status
reason
severity
started_at
resolved_at
created_by
resolved_by
resolution_note
```

### 12.3 Status history

Mỗi history record tối thiểu:

```text
history_id
resource_id
resource_code_snapshot
from_status
to_status
action
actor_id
actor_username
actor_role
reason
correlation_id
created_at
```

History không bị xóa cascade khi operational resource được retire. Hard-delete draft phải giữ audit tombstone không phụ thuộc FK tới record đã xóa.

### 12.4 Constraints

- `status = RETIRED` yêu cầu `retired_at`, `retired_by`, `status_reason` không null.
- `status <> RETIRED` không được có transition đi ra từ history sau RETIRED.
- `version` tăng sau mỗi lifecycle mutation.
- Cluster/room code của resource từng active không được tái sử dụng.
- Migration không đổi historical IDs.

---

## 13. Transaction, concurrency và idempotency

- Lifecycle mutation chạy trong transaction.
- Load resource bằng optimistic `@Version` hoặc lock phù hợp.
- Request gửi `expectedVersion`; mismatch trả `409`.
- Lặp lại suspend trên resource đã `INACTIVE` không tạo audit duplicate.
- Lặp lại retire trên `RETIRED` trả current state hoặc stable idempotent response, không tạo transition mới.
- Audit/history được ghi cùng transaction với status change.
- Nếu publish downstream event, dùng transactional outbox để tránh business success nhưng event bị mất.

---

## 14. Public visibility và query behavior

### Public APIs

- Chỉ trả Cluster `ACTIVE`.
- Chỉ trả showtime/bookable Room có effective operational state hợp lệ.
- Không expose lifecycle reason, actor hoặc audit fields.

### Internal APIs

- Mặc định có thể filter `status`.
- `includeRetired=false` mặc định cho operational list.
- Reporting/history có thể truy vấn `RETIRED` theo quyền.
- Direct ID của retired resource trả data cho authorized internal user, không trả 404 giả nếu cần audit/reporting.

---

## 15. Frontend behavior

### 15.1 Action labels

| Current status | Actions |
|---|---|
| `DRAFT` | Edit, Submit, Delete draft |
| `PENDING_*` | View review status; không hard delete |
| `ACTIVE` | Suspend operations, Report maintenance (Room), Retire permanently |
| `INACTIVE/SUSPENDED` | Reactivate, Retire permanently |
| `MAINTENANCE/TEMPORARILY_UNAVAILABLE` | View incident, Resolve, Retire nếu blockers đã xử lý |
| `RETIRED` | View history only |

### 15.2 Confirmation UX

- `Delete draft`: destructive confirmation, nêu rõ xóa vĩnh viễn draft-only data.
- `Suspend`: bắt buộc reason, hiển thị affected showtime nhưng cho phép khẩn cấp.
- `Retire`: danger zone, bắt buộc gõ lại resource code/name và chỉ enable khi không còn blocker.
- Không dùng một nút `Delete` chung cho mọi trạng thái.
- Không xóa resource khỏi UI trước khi backend thành công.
- `409` stale version phải reload impact và yêu cầu người dùng xác nhận lại.

---

## 16. Audit và observability

Mỗi command log structured fields:

```text
correlationId
resourceType
resourceId
action
fromStatus
toStatus
actorId
reasonCode/reason
affectedShowtimeCount
result
durationMs
```

Metrics tối thiểu:

- Lifecycle command success/failure theo action.
- Retirement blocked theo blocker type.
- Dependency status unknown.
- Stale version conflict.
- Resource `INACTIVE/MAINTENANCE` còn future on-sale showtime chưa resolve.

Không log token, booking PII hoặc raw payment data.

---

## 17. Migration và rollout

### Phase 1 — Schema compatible

1. Thêm status/metadata/history/version theo additive migration.
2. Backfill legacy status.
3. Deploy code đọc được cả legacy và canonical value nếu cần rolling deployment.

### Phase 2 — Command APIs

1. Thêm impact, suspend, reactivate và retire endpoints.
2. Restrict DELETE thành draft-only.
3. Deprecate generic `PATCH status`.

### Phase 3 — Eligibility enforcement

1. Reuse effective-state predicate trong showtime create/open sale/public APIs.
2. Chặn seat hold mới khi parent resource không operational.

### Phase 4 — Frontend cutover

1. Thay Delete chung bằng lifecycle actions.
2. Thêm impact preview và retired filter.
3. Xóa caller của generic status mutation sau compatibility window.

### Rollback principle

- Không dùng destructive down migration tự động.
- Application rollback phải chịu được field mới.
- Không xóa history/status metadata khi rollback binary.

---

## 18. Test scenarios bắt buộc

### Cluster

- Delete empty DRAFT thành công.
- Delete ACTIVE cluster không room vẫn bị chặn.
- Suspend ACTIVE có future showtime thành công nhưng trả `requiresResolution=true`.
- Retire có future ON_SALE showtime trả 409.
- Reactivate INACTIVE đạt readiness thành công.
- Reactivate RETIRED bị chặn.
- Public catalog ẩn INACTIVE/RETIRED.

### Room

- Delete DRAFT với draft layout đúng policy.
- Delete ACTIVE room chưa có showtime vẫn bị chặn.
- Delete room có historical CANCELLED/COMPLETED showtime bị chặn.
- Maintenance resolve phục hồi previous `SUSPENDED`, không ép `ACTIVE`.
- Retire giữ nguyên active/historical layout và seats.
- Room không ACTIVE bị chặn scheduling/open sale/seat hold.

### Security

- CUSTOMER nhận 403 cho mọi lifecycle mutation.
- EMPLOYEE không retire Cluster/Room.
- Spoofed `X-User-Name` không thay đổi audit actor.
- ADMIN command ghi đúng verified actor.

### Concurrency

- Delete-vs-submit chỉ một command thành công.
- Suspend-vs-retire chỉ một transition thắng.
- Reactivate bằng stale version trả 409.
- Retry cùng command không tạo duplicate audit.

### Migration

- Fresh database chạy toàn bộ migration.
- Database có ACTIVE/INACTIVE/CLOSED legacy nâng cấp không mất ID/history.
- Audit không bị cascade delete ngoài ý muốn.

---

## 19. Definition of Done

- [ ] State enums, DB constraints và API contract đồng nhất.
- [ ] Hard delete chỉ hoạt động cho unused DRAFT.
- [ ] Suspend/reactivate/maintenance/retire có transition validator dùng chung.
- [ ] Scheduling, sale, public visibility và seat hold dùng effective operational predicate.
- [ ] Retire không làm mất historical showtime/layout/seat/audit.
- [ ] Actor lấy từ verified principal; authorization tests pass.
- [ ] Audit atomic, append-only và không cascade-delete.
- [ ] Fresh/upgraded database tests pass.
- [ ] Frontend action matrix và impact preview hoạt động ở dark/light mode.
- [ ] API contract/OpenAPI/Postman samples được cập nhật.
- [ ] Full movie-service regression suite xanh.

---

## 20. Nguồn tham khảo và suy luận thiết kế

- [Vista Digital Platform — Showtime by Screen](https://developer.vista.co/openapi/digital-platform/reference/operation/OcapiShowtimes_GetShowtimesForScreen/): showtime giữ `siteId`, `screenId` và `seatLayoutId` ổn định.
- [Vista Digital Platform — Seating](https://developer.vista.co/digital-platform/seating): một screen có thể có nhiều seat layout; layout là dữ liệu tương đối tĩnh và được showtime tham chiếu.
- [Microsoft Dataverse Auditing Overview](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/auditing/overview): audit history được quản lý như dữ liệu riêng và không nên bị xóa trực tiếp cùng business record.

Các nguồn trên không quy định trực tiếp endpoint delete cho dự án này. Quy tắc draft-only hard delete và operational retirement là quyết định kiến trúc được suy ra từ nhu cầu giữ stable identity, lịch sử giao dịch, seat-layout snapshot và auditability của hệ thống rạp chiếu.

---

## 21. Tài liệu liên quan

- `docs/issues/cinema-cluster-room-retirement-issue-pack.md`
- `docs/issues/movie-service-industry-readiness-checklist.md`
- `docs/api-specs/movie-service/API_CONTRACT.md`
- `docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md`
- `docs/database/movie-service/`
