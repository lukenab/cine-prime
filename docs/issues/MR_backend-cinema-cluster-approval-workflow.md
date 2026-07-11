# MR Description — [Backend] Cinema Cluster approval workflow and audit log

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feat/cinema-cluster-approval-workflow` → target: `develop`

---

## Overview / Objective

Thêm approval workflow và audit log cho Cinema Cluster trong `movie-service`. EMPLOYEE
(nhân viên) tạo và submit cluster, ADMIN (quản lý) review rồi approve hoặc reject với
lý do. Mọi thay đổi trạng thái đều được ghi vào `cluster_audit_log`.

**State machine:**
```
DRAFT → PENDING_REVIEW  (EMPLOYEE hoặc ADMIN submit)
PENDING_REVIEW → ACTIVE (ADMIN approve)
PENDING_REVIEW → DRAFT  (ADMIN reject + rejectionNote)
ACTIVE → INACTIVE       (ADMIN deactivate via PUT)
INACTIVE → ACTIVE       (ADMIN reactivate via PUT)
```

Related Issue: Closes #[cinema-cluster-approval-workflow-issue]

---

## Changes Introduced

**New Files:**
- `docs/database/movie-service/V5__add_cluster_approval_workflow.sql`
  — mở rộng CHECK constraint status (thêm DRAFT, PENDING_REVIEW), thêm cột `rejection_note`,
  tạo bảng `cluster_audit_log`
- `movieservice/enums/ClusterAction.java`
  — enum: CREATE, SUBMIT, APPROVE, REJECT, UPDATE, DEACTIVATE, REACTIVATE
- `movieservice/entity/ClusterAuditLog.java`
  — entity cho bảng `cluster_audit_log` (UUID PK, clusterId, action, performedBy,
  oldStatus, newStatus, note, timestamp)
- `movieservice/repository/ClusterAuditLogRepository.java`
  — `findByClusterIdOrderByTimestampDesc(Long clusterId)`
- `movieservice/dto/response/ClusterAuditLogResponse.java`
  — response DTO cho audit log entries

**Modified Files:**
- `movieservice/enums/ClusterStatus.java`
  — thêm `DRAFT`, `PENDING_REVIEW` (giữ nguyên `ACTIVE`, `INACTIVE`)
- `movieservice/exception/MovieErrorCode.java`
  — thêm `CLUSTER_INVALID_TRANSITION(2026)`: invalid state transition
  — cập nhật message của `INVALID_CLUSTER_STATUS(2025)` để liệt kê đủ 4 status
- `movieservice/entity/CinemaCluster.java`
  — thêm field `rejectionNote TEXT` (nullable)
  — đổi default status `prePersist` từ ACTIVE → DRAFT
  — mở rộng `@Column(length = 20)` cho status
- `movieservice/dto/response/CinemaClusterResponse.java`
  — thêm field `String rejectionNote`
- `movieservice/controller/CinemaClusterController.java`
  — inject `ClusterAuditLogRepository`
  — `GET /api/cinema-clusters`: public thấy ACTIVE, ADMIN/SUPER_ADMIN thấy tất cả
  — `POST /api/cinema-clusters`: luôn tạo với status DRAFT (bỏ qua status trong request)
  — `PUT /api/cinema-clusters/{id}`: chỉ cho phép ACTIVE↔INACTIVE toggle, fix bug lat/lng không được cập nhật
  — `POST /api/cinema-clusters/{id}/submit` (ADMIN): DRAFT → PENDING_REVIEW
  — `POST /api/cinema-clusters/{id}/approve` (SUPER_ADMIN): PENDING_REVIEW → ACTIVE
  — `POST /api/cinema-clusters/{id}/reject` (SUPER_ADMIN): PENDING_REVIEW → DRAFT + rejectionNote
  — `GET /api/cinema-clusters/{id}/audit-log` (ADMIN/SUPER_ADMIN): lịch sử thay đổi
  — helper `logAction()`, `isAdminOrSuperAdmin()`, `getActor()`
- `movieservice/config/SecurityConfig.java`
  — thêm `permitAll()` cho `GET /api/cinema-clusters/**`
  (audit-log được bảo vệ thêm bởi `@PreAuthorize` ở method level)

---

## New API Endpoints

| Method | Path | Role | Mô tả |
|---|---|---|---|
| `POST` | `/api/cinema-clusters` | ADMIN / EMPLOYEE | Tạo cluster mới (status DRAFT) |
| `POST` | `/api/cinema-clusters/{id}/submit` | ADMIN / EMPLOYEE | DRAFT → PENDING_REVIEW |
| `POST` | `/api/cinema-clusters/{id}/approve` | ADMIN | PENDING_REVIEW → ACTIVE |
| `POST` | `/api/cinema-clusters/{id}/reject` | ADMIN | PENDING_REVIEW → DRAFT |
| `GET` | `/api/cinema-clusters/{id}/audit-log` | ADMIN | Lịch sử thay đổi |

**Reject request body:**
```json
{ "note": "Địa chỉ không chính xác, vui lòng kiểm tra lại tọa độ" }
```

**Audit log response:**
```json
{
  "code": 200,
  "result": [
    {
      "logId": "550e8400-e29b-41d4-a716-446655440000",
      "clusterId": 7,
      "action": "APPROVE",
      "performedBy": "superadmin@cineprime.vn",
      "oldStatus": "PENDING_REVIEW",
      "newStatus": "ACTIVE",
      "note": null,
      "timestamp": "2026-07-11T10:30:00"
    },
    {
      "logId": "550e8400-e29b-41d4-a716-446655440001",
      "clusterId": 7,
      "action": "SUBMIT",
      "performedBy": "admin@cineprime.vn",
      "oldStatus": "DRAFT",
      "newStatus": "PENDING_REVIEW",
      "note": null,
      "timestamp": "2026-07-11T09:00:00"
    }
  ]
}
```

---

## Key Decisions

- **DRAFT default** — mọi cluster tạo mới đều là DRAFT, không cho phép tạo thẳng ACTIVE.
  Seed data hiện có (V3) vẫn ACTIVE vì đã INSERT trực tiếp vào DB.

- **PUT chỉ toggle ACTIVE↔INACTIVE** — tránh bypass approval workflow. Các transition
  DRAFT/PENDING_REVIEW phải đi qua endpoint chuyên biệt. Nếu client gửi
  `status: DRAFT` trong PUT body → 400 `CLUSTER_INVALID_TRANSITION`.

- **Fix lat/lng trong PUT** — bug cũ: `update()` không cập nhật `latitude`/`longitude`.
  Đã sửa trong MR này.

- **Public GET filter** — `Authentication authentication` là optional parameter trong Spring
  Security; khi không có token, nó là `null` (hoặc anonymous). `isAdminOrSuperAdmin()` trả
  về false → chỉ trả ACTIVE. Logic xử lý trong controller, không cần Security rule phức tạp.

- **Phân quyền theo role thực tế** — EMPLOYEE tạo và submit (data entry), ADMIN duyệt
  (quản lý). Không cần tạo SUPER_ADMIN mới. ADMIN và EMPLOYEE đều có thể tạo cluster.

- **GET visibility** — ADMIN và EMPLOYEE (internal staff) thấy tất cả status.
  MEMBER và unauthenticated chỉ thấy ACTIVE. Kiểm tra qua `isStaff()` helper.

- **`performedBy` từ JWT** — `authentication.getName()` trả về subject của JWT (username/email).
  Nếu `authentication` null → ghi "UNKNOWN".

- **`rejectionNote` ở cả cluster và audit log** — cluster lưu rejection note mới nhất để
  EMPLOYEE dễ xem lý do mà không cần query audit log. Audit log lưu toàn bộ lịch sử.

- **Re-submit xóa rejectionNote** — khi EMPLOYEE submit lại sau khi bị reject,
  `rejectionNote` của cluster bị clear (set null). Lý do reject cũ vẫn trong audit log.

- **`ReportingPolicy.IGNORE` (MapStruct)** — `rejectionNote` tự động được map
  `CinemaCluster` → `CinemaClusterResponse` (same field name, both String). Không cần
  thêm explicit `@Mapping`.

---

## How to Test

**Setup:**
```powershell
# Apply V5 migration
docker cp docs\database\movie-service\V5__add_cluster_approval_workflow.sql postgres:/tmp/V5.sql
docker exec -it postgres psql -U postgres -d movie_db -f /tmp/V5.sql

# Rebuild service
docker-compose up -d --build movie-service
```

**Full happy path:**

```bash
# 1. Create cluster (DRAFT)
POST /api/cinema-clusters   [ADMIN token]
Body: { "clusterName": "CinePrime Test", "province": "Hà Nội", "address": "123 Nguyễn Trãi, Hà Đông" }
→ 201: status = "DRAFT"

# 2. Submit (DRAFT → PENDING_REVIEW)
POST /api/cinema-clusters/7/submit   [ADMIN token]
→ 200: status = "PENDING_REVIEW"

# 3. Reject (PENDING_REVIEW → DRAFT)
POST /api/cinema-clusters/7/reject   [SUPER_ADMIN token]
Body: { "note": "Địa chỉ thiếu số nhà, vui lòng bổ sung" }
→ 200: status = "DRAFT", rejectionNote = "Địa chỉ thiếu số nhà..."

# 4. Fix + re-submit
PUT /api/cinema-clusters/7   [ADMIN token]
Body: { "clusterName": "CinePrime Test", "province": "Hà Nội", "address": "456 Nguyễn Trãi, Hà Đông", ... }
→ 200: status = "DRAFT" (unchanged), rejectionNote still visible

POST /api/cinema-clusters/7/submit   [ADMIN token]
→ 200: status = "PENDING_REVIEW", rejectionNote = null

# 5. Approve (PENDING_REVIEW → ACTIVE)
POST /api/cinema-clusters/7/approve   [SUPER_ADMIN token]
→ 200: status = "ACTIVE"

# 6. Kiểm tra audit log
GET /api/cinema-clusters/7/audit-log   [ADMIN token]
→ 200: list 5 entries (CREATE, SUBMIT, REJECT, SUBMIT, APPROVE) theo timestamp DESC
```

**Error cases:**
```bash
# Submit cluster không phải DRAFT
POST /api/cinema-clusters/1/submit   [ADMIN]   (cluster 1 đang ACTIVE)
→ 400: "Invalid status transition..."

# Approve cluster không phải PENDING_REVIEW
POST /api/cinema-clusters/7/approve  [SUPER_ADMIN]  (cluster 7 đang DRAFT)
→ 400: "Invalid status transition..."

# PUT với status = PENDING_REVIEW
PUT /api/cinema-clusters/7   [ADMIN]
Body: { ..., "status": "PENDING_REVIEW" }
→ 400: "Invalid status transition..."

# Reject không có note
POST /api/cinema-clusters/7/reject   [SUPER_ADMIN]
Body: { "note": "" }
→ 400: "Rejection note must not be blank"

# Public GET — chỉ thấy ACTIVE (không có token)
GET /api/cinema-clusters
→ 200: chỉ có cluster status ACTIVE, không có DRAFT/PENDING_REVIEW

# Admin GET — thấy tất cả (có ADMIN token)
GET /api/cinema-clusters
→ 200: tất cả cluster bao gồm DRAFT/PENDING_REVIEW
```

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] Không còn debug code
- [x] Follows project conventions (AppException, ApiResponse, @PreAuthorize)

**Database**
- [x] V5 migration idempotent (`ALTER ... IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`)
- [x] CHECK constraint cập nhật đủ 4 status values
- [x] `cluster_audit_log` có index trên `cluster_id` và `timestamp`
- [x] `rejection_note` nullable (cluster có thể chưa bị reject)

**State Machine**
- [x] DRAFT → PENDING_REVIEW: chỉ qua `/submit`, chỉ ADMIN
- [x] PENDING_REVIEW → ACTIVE: chỉ qua `/approve`, chỉ SUPER_ADMIN
- [x] PENDING_REVIEW → DRAFT: chỉ qua `/reject`, chỉ SUPER_ADMIN, yêu cầu `note`
- [x] ACTIVE ↔ INACTIVE: qua PUT, chỉ ADMIN
- [x] Invalid transition → `CLUSTER_INVALID_TRANSITION(2026)` 400

**Audit Log**
- [x] Ghi log cho: CREATE, SUBMIT, APPROVE, REJECT, UPDATE, DEACTIVATE, REACTIVATE
- [x] `performedBy` lấy từ JWT subject
- [x] `GET /{id}/audit-log` protected bởi `@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")`
- [x] Response sắp xếp theo `timestamp DESC`

**Public GET visibility**
- [x] Unauthenticated / non-admin → chỉ thấy ACTIVE
- [x] ADMIN/SUPER_ADMIN → thấy tất cả status
- [x] Filter `?status=` cũng áp dụng rule: non-admin không thể query DRAFT/PENDING_REVIEW

---

## Reviewer Notes

- `SUPER_ADMIN` role phải tồn tại trong JWT token từ auth-service. Nếu chưa có, tạm thời
  test bằng cách thêm role `SUPER_ADMIN` vào account qua DB hoặc auth-service endpoint.
- Seed data (cluster 1–6 từ V3) có status ACTIVE — không bị ảnh hưởng bởi default DRAFT
  vì chúng INSERT trực tiếp với `status = 'ACTIVE'` giá trị cứng.
- `performedBy` sẽ là `null` nếu gọi API không qua JWT (ví dụ test từ Postman không có token
  và endpoint vẫn pass được vì chỉ public GET). Với các endpoint có `@PreAuthorize`, authentication
  luôn có — `performedBy` sẽ luôn có giá trị.
- Nếu team muốn thêm endpoint `/deactivate` và `/reactivate` riêng thay vì dùng PUT, có thể
  tách ra sau mà không cần đổi state machine.
