# [Frontend] Nest Cinema Room management under Cinema Cluster detail page

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::Medium`, `Review/ QA`

---

## Summary / Objective

Hiện tại "Cinema Clusters" và "Cinema Rooms" là 2 trang top-level hoàn toàn tách biệt trên sidebar admin, chỉ nối với nhau qua 1 dropdown filter thủ công. Đây không phải practice phổ biến của các hệ thống quản lý theo mô hình "địa điểm cha – đơn vị con" (hotel PMS quản property→room type, POS chuỗi cửa hàng quản store→register, Shopify Locations quản kho theo chi nhánh) — các hệ thống này đều dùng mô hình **drill-down lồng nhau**: click vào 1 cluster/địa điểm mở ra trang chi tiết, và quản lý các đơn vị con (room) ngay bên trong ngữ cảnh đó, vì 1 phòng chiếu chỉ có ý nghĩa khi gắn với 1 rạp vật lý cụ thể.

Việc tách rời cũng là nguyên nhân gián tiếp của bug #164 (phòng tạo ra không gắn với cluster nào) — vì luồng tạo phòng cũ yêu cầu người dùng tự chọn đúng cluster qua dropdown thay vì được xác định sẵn theo ngữ cảnh, dễ bị bỏ qua/chọn sai.

MR này thêm 1 trang chi tiết cluster (`/admin/clusters/:id`) làm nơi quản lý chính cho room thuộc cluster đó, đồng thời giữ lại trang "Cinema Rooms" phẳng cũ làm view phụ (xem/lọc toàn hệ thống — vẫn hữu ích cho các thao tác vận hành cross-cluster như audit giá vé, theo dõi bảo trì).

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [x] Click vào 1 dòng trong "Cinema Clusters" điều hướng sang trang chi tiết cluster đó
- [x] Trang chi tiết cluster hiển thị đầy đủ thông tin (tên, province, address, phone, status, rejection note) và các nút workflow (Submit/Approve/Reject/Edit/Delete) tương ứng đúng role/status như trang danh sách cũ
- [x] Trang chi tiết cluster liệt kê **chỉ room thuộc cluster đó**, nút "Add Room" không cần chọn cluster qua dropdown (đã biết sẵn theo context)
- [x] Trang "Cinema Rooms" phẳng cũ vẫn hoạt động, không bị xoá tính năng — chỉ bổ sung link điều hướng ngược về cluster tương ứng + tip hướng dẫn
- [x] Nút "Edit" trên trang chi tiết cluster mở đúng modal edit sẵn có (không xây dựng lại form edit trùng lặp)
- [ ] Test bằng browser thật trên cả dark/light mode (chưa tự mở trình duyệt kiểm tra trong môi trường viết code)

---

## API Specifications

Không có API mới — tái sử dụng nguyên trạng `GET /api/cinema-clusters/{id}` (đã tồn tại sẵn ở `CinemaClusterController.getById()`, chỉ chưa có wrapper phía frontend) và các API cluster/room đã có từ #164 (`GET /api/cinema-rooms?clusterId=`, `POST /api/cinema-rooms`).

---

## Technical Notes / Constraints

- Depends on #164 — trang chi tiết cluster dựa vào `clusterId` được wire đúng khi tạo room (fix ở #164) để `totalRooms`/`totalSeats` và danh sách room hiển thị chính xác.
- **Chưa xử lý trong MR này**: nav "Cinema Rooms" trong `Sidebar.tsx` và route `/admin/rooms` vẫn giới hạn `ROLE_ADMIN` (`ProtectedRoute allowedRoles={["ROLE_ADMIN"]}`), trong khi route mới `/admin/clusters/:id` cho phép cả EMPLOYEE tạo room (cùng quyền với Clusters). Nghĩa là EMPLOYEE giờ tạo được room qua Cluster Detail nhưng không thấy được view phẳng toàn hệ thống — inconsistency có sẵn từ trước, cố tình không mở rộng scope MR này để sửa luôn.
- Modal "Add Room" được tách thành component dùng chung (`layouts/AddCinemaRoomModal.tsx`) với prop `fixedClusterId` — tránh trùng lặp logic validate/room-type-selector giữa 2 nơi dùng (trang phẳng + trang chi tiết cluster).

---

## Related

- Branch: `feat/cluster-detail-nested-rooms`
- Depends on: #164
- Docs: `docs/issues/mr-165-nest-cinema-room-under-cluster.md` (MR mô tả chi tiết thay đổi)
