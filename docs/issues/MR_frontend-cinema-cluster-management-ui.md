# MR Description — [Frontend] Cinema Cluster Management UI

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feat/cinema-cluster-management-ui` → target: `develop`

---

## Overview / Objective

Xây dựng trang quản lý Cinema Cluster (`ManageCinemaClusterPage`) cho admin panel.
Trang bao gồm bảng danh sách cluster, Create/Edit modal, Delete confirmation modal,
tìm kiếm theo tên/tỉnh thành, lọc theo status, và stats tổng hợp (tổng cluster,
tổng phòng, tổng ghế). UI hoàn toàn responsive với dark/light mode, dùng CSS variables
theo convention của dự án.

MR này bao gồm cả workflow action cho approval flow (Issue 4 backend): status badges
đầy đủ DRAFT / PENDING_REVIEW / ACTIVE / INACTIVE, nút Submit cho EMPLOYEE, nút
Approve/Reject cho ADMIN, hiển thị rejection note.

Related Issue: Closes #[frontend-cinema-cluster-management-ui]

---

## Changes Introduced

**`client/src/pages/admin/ManageCinemaClusterPage.tsx`** — file mới hoàn toàn:

- **Stats bar** — 4 card: Total Clusters, Active, Total Rooms, Total Seats. Loading
  skeleton (hiển thị "—") khi đang fetch. Dùng aggregated data từ API response
  (`totalRooms`, `totalSeats` được backend tính server-side).

- **Toolbar** — search input (by `clusterName` / `province`), status filter dropdown,
  Refresh button, Add Cluster button.

- **Cluster table** — cột: #, Cluster (name + phone), Province (badge), Address
  (truncated + lat/lng hint), Rooms, Seats, Status badge, Actions. Row hover reveal
  Edit / Delete icon buttons.

- **Status badges** — 4 loại status sau khi tích hợp approval workflow:
  - `DRAFT` — xám, icon Clock
  - `PENDING_REVIEW` — vàng, icon Clock
  - `ACTIVE` — xanh lá, icon CheckCircle
  - `INACTIVE` — đỏ, icon XCircle

- **Rejection note banner** — khi cluster có `rejectionNote` (bị ADMIN reject),
  hiển thị inline banner vàng với nội dung lý do ngay trong bảng (dưới status badge).

- **Workflow action buttons** — hiện theo role từ `useAuth()`:
  - EMPLOYEE / ADMIN thấy nút **Submit** (xanh dương) khi cluster đang DRAFT
  - ADMIN thấy nút **Approve** (xanh lá) và **Reject** (đỏ) khi PENDING_REVIEW
  - ADMIN thấy nút toggle **Deactivate** / **Reactivate** khi ACTIVE / INACTIVE

- **ClusterModal** (Create / Edit) — form với:
  - Cluster Name (required, 2–100 chars)
  - Province dropdown (required, danh sách 20 tỉnh/thành)
  - Phone Number (optional, placeholder `028 xxxx xxxx`)
  - Address với Nominatim autocomplete (đã có từ MR Issue 3)
  - OSM map preview khi có tọa độ
  - Status toggle chỉ hiện cho ADMIN khi edit (ACTIVE ↔ INACTIVE); create luôn
    tạo DRAFT — không hiện status picker
  - Inline error banner thay `alert()`
  - Phone normalization: strip `/[\s\-().]/g` trước khi gửi backend

- **RejectModal** — modal nhập rejection note khi ADMIN reject cluster.
  - Textarea required, placeholder hướng dẫn nội dung hữu ích
  - Submit gọi `POST /api/cinema-clusters/{id}/reject`

- **DeleteModal** — xác nhận xoá cluster. Hiển thị tên cluster + cảnh báo
  không thể undo. Disabled khi cluster có rooms (backend trả `CLUSTER_HAS_ROOMS`).

- **Mock data fallback** — `MOCK_CLUSTERS` array để demo UI khi backend chưa sẵn
  sàng (catch `404` hoặc `ERR_NETWORK`).

- **Loading & error states** — spinner khi fetch, error banner với nút Retry.

**`client/src/api/movieApi.ts`** — cập nhật Cinema Cluster types và API calls:

- `ClusterStatus` — mở rộng từ `"ACTIVE" | "INACTIVE"` thành
  `"DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "INACTIVE"`
- `ClusterResponse` — thêm `rejectionNote?: string`
- `submitCluster(id)` — `POST /api/cinema-clusters/{id}/submit`
- `approveCluster(id)` — `POST /api/cinema-clusters/{id}/approve`
- `rejectCluster(id, note)` — `POST /api/cinema-clusters/{id}/reject`

---

## New API Calls (Frontend → Backend)

| Method | Endpoint | Gọi từ component | Mô tả |
|---|---|---|---|
| `GET` | `/api/cinema-clusters` | `loadClusters()` | Lấy danh sách (staff thấy tất cả status) |
| `POST` | `/api/cinema-clusters` | `handleSave()` create mode | Tạo cluster mới (DRAFT) |
| `PUT` | `/api/cinema-clusters/{id}` | `handleSave()` edit mode | Cập nhật data |
| `DELETE` | `/api/cinema-clusters/{id}` | `handleDelete()` | Xoá cluster |
| `POST` | `/api/cinema-clusters/{id}/submit` | `handleSubmit()` | DRAFT → PENDING_REVIEW |
| `POST` | `/api/cinema-clusters/{id}/approve` | `handleApprove()` | PENDING_REVIEW → ACTIVE |
| `POST` | `/api/cinema-clusters/{id}/reject` | `handleReject()` | PENDING_REVIEW → DRAFT |

---

## Key Decisions

- **Status filter mở rộng** — dropdown bổ sung option DRAFT và PENDING_REVIEW;
  employee thấy cả 4 option vì backend đã lọc theo role tự động.

- **Role-aware action buttons** — lấy role từ `useAuth()` context.
  EMPLOYEE không thấy Approve / Reject; ADMIN không thấy Submit (vẫn có thể Submit
  nhưng không cần button riêng — admin dùng Approve trực tiếp khi cần).
  Tránh hiển thị button gây nhầm lẫn.

- **Create modal không có status picker** — tất cả cluster tạo mới đều là DRAFT
  (backend enforce). Ẩn status toggle ở create mode tránh confusion.

- **Edit modal chỉ show ACTIVE ↔ INACTIVE toggle** — EMPLOYEE không thấy toggle
  (không có quyền đổi status qua PUT). ADMIN thấy toggle nhưng chỉ ACTIVE/INACTIVE,
  không phải DRAFT/PENDING_REVIEW (backend enforce).

- **Rejection note inline banner** — thay vì mở modal, rejection note hiển thị
  thẳng trong row của bảng. Nhỏ gọn hơn, employee nhìn vào bảng là thấy ngay
  lý do cần sửa.

- **Optimistic update** — sau mỗi action (submit/approve/reject), cập nhật local
  state thay vì refetch toàn bộ danh sách, giảm round-trip.

- **Error handling tách biệt** — lỗi load page dùng banner toàn trang + Retry;
  lỗi trong modal dùng inline error (không đóng modal để user sửa ngay).

---

## Status Badge UI Reference

| Status | Màu | Icon | Label |
|---|---|---|---|
| DRAFT | Xám `#6b7280` | Clock | Draft |
| PENDING_REVIEW | Vàng `#d97706` | Clock | Pending Review |
| ACTIVE | Xanh lá `#10b981` | CheckCircle | Active |
| INACTIVE | Đỏ `#ef4444` | XCircle | Inactive |

---

## How to Test

**Prerequisites:** Backend Issue 4 merged và V5 migration đã chạy.

**1. Load trang:**
- Vào Admin → Cinema Clusters
- → Bảng hiển thị tất cả clusters (DRAFT/PENDING_REVIEW/ACTIVE/INACTIVE)
- → Stats card đúng: Total Clusters = n, Active = k clusters đang ACTIVE
- → Status badges màu đúng với bảng trên

**2. Tạo cluster mới (EMPLOYEE):**
- Nhấn "Add Cluster" → modal mở
- Điền form, nhập address → chọn gợi ý Nominatim → map preview hiện
- Nhấn "Create Cluster" → 201, cluster xuất hiện trong bảng với badge "Draft"
- → Modal KHÔNG có status picker (chỉ create DRAFT)

**3. Submit cluster (EMPLOYEE):**
- Tìm cluster vừa tạo (DRAFT)
- → Thấy nút "Submit" màu xanh dương trong cột Actions
- Nhấn Submit → 200, badge chuyển "Pending Review" màu vàng
- → Nút Submit biến mất

**4. Approve cluster (ADMIN):**
- Tìm cluster PENDING_REVIEW
- → Thấy nút "Approve" (xanh) và "Reject" (đỏ)
- Nhấn Approve → 200, badge chuyển "Active" màu xanh lá

**5. Reject cluster (ADMIN):**
- Tìm cluster PENDING_REVIEW
- Nhấn Reject → RejectModal mở
- Nhập lý do, nhấn Submit → 200, badge chuyển "Draft"
- → Trong bảng xuất hiện banner vàng với rejection note

**6. Employee sửa và re-submit:**
- Tìm cluster DRAFT có rejection note
- Nhấn Edit → modal mở, sửa address, lưu
- → rejection note banner biến mất sau PUT (DRAFT clear note)
- Nhấn Submit → Pending Review lại

**7. Filter status:**
```
Select "Pending Review" → chỉ hiện PENDING_REVIEW clusters
Select "Draft" → chỉ hiện DRAFT clusters
Select "All Status" → hiện tất cả
```

**8. Search:**
```
Gõ "Hà Nội" → lọc cluster có province hoặc tên chứa "Hà Nội"
Gõ "CinePrime Q1" → lọc theo cluster name
```

**9. Delete cluster có rooms:**
- Nhấn Delete cluster đang có rooms
- → Backend trả 409 CLUSTER_HAS_ROOMS
- → Modal hiện error: "Cannot delete cluster that still has cinema rooms."
- → Modal không đóng, cluster không bị xoá

**10. Dark mode:**
- Toggle dark mode → tất cả component dùng CSS variables (`var(--bg-main)`,
  `var(--text-main)`, v.v.) → không có màu hard-coded nào bị vỡ

---

## Checklist

**General**
- [x] Không còn `console.log` thừa
- [x] Follows project conventions: functional components, CSS variables, lucide-react icons
- [x] Tested trên cả dark mode và light mode
- [x] Loading và error states được handle đúng

**Table & Filtering**
- [x] 4 status badges hiển thị đúng màu và icon
- [x] Filter DRAFT / PENDING_REVIEW / ACTIVE / INACTIVE / ALL
- [x] Search by clusterName và province
- [x] Rejection note banner hiện đúng cluster bị reject

**Workflow Actions**
- [x] Submit button chỉ hiện khi status = DRAFT
- [x] Approve / Reject chỉ hiện khi status = PENDING_REVIEW
- [x] EMPLOYEE không thấy Approve / Reject
- [x] Optimistic update sau mỗi action (không refetch toàn bộ)

**Modals**
- [x] Create modal không có status picker
- [x] Edit modal: EMPLOYEE không thấy status toggle
- [x] RejectModal: textarea required, submit gọi đúng endpoint
- [x] DeleteModal: hiển thị error inline khi cluster has rooms
- [x] Inline error thay thế `alert()` trong mọi modal

**API Types**
- [x] `ClusterStatus` type có đủ 4 giá trị
- [x] `ClusterResponse` có `rejectionNote?: string`
- [x] 3 API functions mới: `submitCluster`, `approveCluster`, `rejectCluster`

---

## Reviewer Notes

- `useAuth()` hook phải trả về `user.roles` array để component lấy role check.
  Nếu hook hiện chỉ trả `user.role` (string), cần adjust logic hoặc normalize ở hook.
- Nominatim `PlacesAddressInput` component giữ nguyên từ MR Issue 3 — không
  thay đổi. Nếu reviewer chỉ review phần workflow, có thể skip phần autocomplete.
- `totalRooms` và `totalSeats` là computed từ backend (join query) — không thể
  tính ở frontend vì không có rooms trong GET /api/cinema-clusters response.
- Khi implement RejectModal, cần thêm state `rejectTarget` (ClusterResponse | null)
  tương tự pattern `deleteTarget` đang dùng.
- Mock data `MOCK_CLUSTERS` chỉ có ACTIVE/INACTIVE — thêm vài entry DRAFT và
  PENDING_REVIEW để test UI badge khi backend không có.
