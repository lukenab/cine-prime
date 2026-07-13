## Overview / Objective

Gộp luồng quản lý Cinema Room vào bên trong Cinema Cluster theo mô hình drill-down (click cluster → trang chi tiết → quản lý room ngay trong đó), thay vì 2 trang top-level tách rời chỉ nối qua dropdown filter thủ công như trước. Giữ nguyên trang "Cinema Rooms" phẳng cũ làm view phụ cross-cluster.

Related Issue: Closes #165
Depends on: #164 (cluster-room link phải hoạt động đúng thì trang chi tiết mới hiển thị đúng số liệu)

---

## Changes Introduced

**Controllers / Routes:**
- `AppRoutes.tsx`: thêm `<Route path="clusters/:id" element={<ClusterDetailPage />} />` — đặt cùng tier với `clusters` (ADMIN + EMPLOYEE), không nằm trong block `ProtectedRoute allowedRoles={["ROLE_ADMIN"]}` của `rooms`

**Services / Logic:**
- Không có business logic mới ngoài các hàm gọi API liệt kê dưới đây.

**DTOs / Mappers / Components:**
- `api/movieApi.ts`: thêm `getClusterById(id)` (`GET /api/cinema-clusters/{id}`) — API đã tồn tại sẵn ở backend, chỉ thiếu wrapper phía FE
- `pages/admin/ClusterDetailPage.tsx` (mới): trang chi tiết cluster — header hiển thị tên/status/address/phone/rejection note, nút workflow Submit/Approve/Reject/Edit/Delete theo đúng rule role/status hiện có (`useRole()`), 2 stat card (Rooms/Seats), bảng room **scoped theo cluster** (dùng `movieApi.getRoomsByCluster()`), nút "Add Room" gắn sẵn `clusterId` — không qua dropdown
- `layouts/AddCinemaRoomModal.tsx` (mới, tách ra từ `ManageCinemaRoomsPage.tsx`): modal tạo room dùng chung 2 nơi — nhận `clusters` (trang phẳng, hiện dropdown chọn) hoặc `fixedClusterId` (trang chi tiết cluster, ẩn hẳn dropdown)
- `pages/admin/ManageCinemaClusterPage.tsx`:
  - Mỗi dòng cluster giờ `onClick` điều hướng sang `/admin/clusters/{id}` (nút action Edit/Delete/Submit/Approve/Reject dùng `stopPropagation` để không bị trigger navigate nhầm)
  - Thêm `useEffect` đọc `location.state.editClusterId` — khi được điều hướng tới từ nút "Edit" ở trang chi tiết, tự mở đúng modal edit cho cluster đó rồi clear state (tránh mở lại khi refresh/back)
- `pages/admin/ManageCinemaRoomsPage.tsx`:
  - Import `AddCinemaRoomModal` từ `layouts/` thay vì định nghĩa cục bộ (xoá ~165 dòng trùng lặp)
  - Thêm dòng tip dưới tiêu đề trang, trỏ về "Cinema Clusters" để quản lý theo từng rạp
  - Cột "Cluster" trong bảng giờ là `<Link>` điều hướng sang `/admin/clusters/{room.clusterId}` (kèm `stopPropagation` để không trigger navigate sang room detail của cùng dòng)

**Database / JPA / Migration:**
- Không áp dụng (frontend-only, không đụng backend).

**Exception Handling / Error Codes:**
- Không có thay đổi.

---

## Key Architectural Decisions

- **Không xoá trang "Cinema Rooms" phẳng** — theo đúng practice ngành (cross-cluster view vẫn cần cho vận hành: audit giá vé, theo dõi bảo trì toàn hệ thống), chỉ đổi vai trò từ "nơi tạo chính" thành "view phụ", giữ nguyên tính năng tạo room ở đó (đề phòng có luồng/test nào khác đang phụ thuộc).
- **Tách `AddRoomModal` thành component dùng chung** (`layouts/AddCinemaRoomModal.tsx`) thay vì viết riêng 2 bản cho 2 trang — tránh 2 nơi cùng chứa logic validate `overLimit`/room-type-selector rồi lệch nhau dần theo thời gian.
- **Nút "Edit" ở trang chi tiết không tự dựng lại form edit** — thay vào đó điều hướng về trang danh sách kèm `location.state.editClusterId`, tận dụng `ClusterModal` sẵn có (vốn không export). Đánh đổi: có 1 lần chuyển trang trước khi modal hiện ra, nhưng tránh trùng lặp toàn bộ logic edit (address autocomplete, validate, v.v.) vốn khá phức tạp trong `ManageCinemaClusterPage.tsx`.
- **Cố tình không đồng bộ luôn quyền truy cập** giữa route `clusters/:id` (ADMIN+EMPLOYEE) và route `rooms` cũ (ADMIN-only) — xem Reviewer Notes.

---

## How to Test

1. `cd client && npm run dev`, backend `movie-service` cần đang chạy với dữ liệu cluster/room đã có sẵn từ #164 (dùng bộ data mẫu ở `docs/testing/cinema-cluster-room-sample-data.md` nếu chưa có).
2. Login ADMIN hoặc EMPLOYEE → **Admin → Cinema Clusters** → click vào 1 dòng cluster bất kỳ → xác nhận điều hướng sang `/admin/clusters/{id}`, hiển thị đúng thông tin + đúng số Rooms/Seats.
3. Ở trang chi tiết: bấm "Add Room" → xác nhận **không có dropdown chọn cluster** (khác với trang phẳng cũ), tạo phòng → xác nhận phòng xuất hiện ngay trong bảng và stat "Rooms"/"Seats" tăng đúng.
4. Bấm "Edit" → xác nhận điều hướng về danh sách cluster và tự động mở đúng modal edit cho cluster đó (không phải mở nhầm cluster khác).
5. Với cluster đang `DRAFT`/`PENDING_REVIEW`: xác nhận nút Submit/Approve/Reject hiện đúng theo role (EMPLOYEE thấy Submit, ADMIN thấy Approve/Reject) và bấm hoạt động đúng như ở trang danh sách cũ.
6. Vào lại **Admin → Cinema Rooms** (trang phẳng): xác nhận vẫn hoạt động bình thường, thấy dòng tip trỏ về Cinema Clusters, cột "Cluster" bấm được → điều hướng đúng sang trang chi tiết cluster tương ứng.
7. Test quyền: login EMPLOYEE → xác nhận vào được `/admin/clusters/{id}` và tạo được room, nhưng `/admin/rooms` vẫn bị chặn (behavior cũ, chưa đổi trong MR này).

---

## Checklist

**General**
- [x] Follows project coding conventions (tái sử dụng pattern `useOutletContext`, CSS variable theme, cấu trúc modal/table đã có sẵn trong `ManageCinemaRoomsPage.tsx`/`RoomDetailPage.tsx`)
- [x] No debug / console.log code left
- [x] Code compiles, no errors — `tsc --noEmit -p tsconfig.json`: 108 lỗi baseline có sẵn (không đổi so với trước MR này), **0 lỗi mới** từ 6 file đã sửa/thêm (`ClusterDetailPage.tsx`, `AddCinemaRoomModal.tsx`, `ManageCinemaClusterPage.tsx`, `ManageCinemaRoomsPage.tsx`, `movieApi.ts`, `AppRoutes.tsx`)

**Backend**
- Không áp dụng — MR này không đụng backend.

**Frontend**
- [x] Loading and error states handled (trang chi tiết có loading spinner riêng, error banner + nút Retry giống pattern các trang khác; case cluster không tồn tại/404 hiển thị màn hình riêng có nút quay lại)
- [x] axiosClient attaches Bearer token correctly — không đổi interceptor, dùng lại `axiosClient`/`movieApi` hiện có
- [ ] Tested on both dark and light mode — chưa tự mở trình duyệt kiểm tra trực quan trong môi trường viết code này; các màu mới thêm (nút workflow, badge) dùng đúng biến CSS theme (`var(--bg-card)`, `var(--text-main)`...) theo cùng pattern có sẵn — **reviewer nên tự kiểm tra trực quan**

---

## Reviewer Notes

- **Inconsistency về phân quyền chưa xử lý**: route `clusters/:id` (mới) cho phép ADMIN+EMPLOYEE, nhưng route `rooms` (cũ, view phẳng) vẫn giới hạn `ROLE_ADMIN` qua `ProtectedRoute` + `Sidebar.tsx`. Cân nhắc mở luôn cho EMPLOYEE ở lần sau nếu muốn nhất quán hoàn toàn (chỉ cần đổi 1 dòng `roles` trong `Sidebar.tsx` và bỏ `rooms`/`rooms/:id` ra khỏi block `ProtectedRoute allowedRoles={["ROLE_ADMIN"]}`).
- Nút "Edit" trên trang chi tiết dùng `navigate(..., { state: { editClusterId } })` — nếu sau này có người thêm 1 route khác cũng set `location.state` theo cách tương tự trên trang `ManageCinemaClusterPage`, cần chú ý tránh xung đột key `editClusterId`.
- Đã kiểm tra kỹ layout responsive ở mức code (flex-wrap trên header actions) nhưng chưa test thực tế trên màn hình nhỏ/mobile.
