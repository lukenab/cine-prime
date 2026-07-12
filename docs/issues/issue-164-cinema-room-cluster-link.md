# [Backend] Fix cinema room creation not linking to cinema cluster

**Labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`, `Review/ QA`

---

## Summary / Objective

`CinemaRoom` và `CinemaCluster` đã có quan hệ `@ManyToOne`/`@OneToMany` đúng ở tầng entity (cột `cluster_id`), nhưng quan hệ này chưa từng được wire xuyên suốt DTO → Controller → Service. Mọi phòng tạo qua `POST /api/cinema-rooms` đều có `cluster_id = NULL` trong DB, khiến `CinemaClusterRepository.countRoomsByClusterId()` luôn trả về `0` — trang chi tiết cụm rạp (cinema cluster) hiển thị sai số phòng/số ghế dù đã tạo phòng thực tế. Phát hiện trong lúc điều tra báo cáo "tạo cinema cluster và cinema room chưa link với nhau".

Trong lúc sửa còn phát hiện thêm **Bug B (cùng luồng, chặn cứng tính năng)**: frontend gửi field `seatQuantity` nhưng `CinemaRoomRequest` (backend) yêu cầu `totalSeatCapacity` (`@NotNull`) — nghĩa là nút "Add Cinema Room" trên UI admin **luôn trả lỗi 400** trước khi sửa, không tạo được phòng nào qua giao diện (chỉ tạo được qua Postman/gọi API trực tiếp với đúng tên field). Đây có lẽ là lý do các phòng "mồ côi" tồn tại trong DB — được tạo qua Postman, bỏ qua luôn field `clusterId` không có sẵn trên UI.

Cả 2 bug đã được fix trong cùng 1 bộ thay đổi vì đụng chung code path (`CreateRoomPayload` → `POST /api/cinema-rooms` → `CinemaRoomService.createCinemaRoom()`).

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [x] `POST /api/cinema-rooms` bắt buộc nhận `clusterId`; trả lỗi rõ ràng (`CLUSTER_NOT_FOUND`) nếu cluster không tồn tại
- [x] Phòng tạo mới được lưu với `cluster_id` đúng theo cluster đã chọn
- [x] `GET /api/cinema-clusters/{id}` — `totalRooms`/`totalSeats` phản ánh đúng số phòng thực đã gắn với cluster đó
- [x] `GET /api/cinema-rooms` hỗ trợ filter theo `?clusterId=` (frontend đã có sẵn hàm gọi nhưng backend chưa từng đọc param này)
- [x] `CinemaRoomResponse` trả về `clusterId`/`clusterName` để FE hiển thị
- [x] Form "Add Cinema Room" trên admin UI có ô chọn Cluster bắt buộc, không cho submit nếu chưa chọn
- [x] Fix field mismatch `seatQuantity` (FE) ↔ `totalSeatCapacity` (BE) chặn tạo phòng qua UI
- [ ] `mvn compile` xác nhận build thật thành công (chưa chạy được trong môi trường viết code — xem MR Checklist)

---

## API Specifications

### API 1 — Create Cinema Room (contract thay đổi)

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/cinema-rooms` |
| Description | Tạo phòng chiếu mới, giờ bắt buộc thuộc về 1 cinema cluster |
| Auth Required | Yes (ADMIN/EMPLOYEE — theo cấu hình hiện có, không đổi trong MR này) |

**Request Body (mới — thêm `clusterId`):**
```json
{
  "cinemaRoomName": "Room A",
  "roomType": "STANDARD",
  "totalSeatCapacity": 50,
  "defaultPrice": 90000,
  "clusterId": 1
}
```

**Response 200 OK (mới — thêm `clusterId`/`clusterName`):**
```json
{
  "code": 200,
  "result": {
    "cinemaRoomId": 12,
    "cinemaRoomName": "Room A",
    "roomType": "STANDARD",
    "totalSeatCapacity": 50,
    "status": "ACTIVE",
    "maintenanceNote": null,
    "clusterId": 1,
    "clusterName": "CGV Vincom Đồng Khởi"
  }
}
```

**Response (Error — cluster không tồn tại):**
```json
{
  "code": 1xxx,
  "message": "Cinema cluster not found"
}
```

### API 2 — Get Rooms filtered by cluster (đã tồn tại phía FE, nay backend mới hỗ trợ)

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/cinema-rooms?clusterId={id}` |
| Description | Trả về danh sách phòng thuộc 1 cluster cụ thể; bỏ trống `clusterId` → trả tất cả (không đổi behavior cũ) |
| Auth Required | No (giữ nguyên như endpoint cũ) |

---

## Technical Notes / Constraints

- Không có migration DB mới — cột `cluster_id` trên bảng `cinema_room` đã tồn tại sẵn từ trước (JPA entity `CinemaRoom.cluster`), chỉ là chưa từng được set giá trị.
- `clusterId` bắt buộc (`@NotNull`) cho phòng **tạo mới** — các phòng cũ đã tồn tại với `cluster_id = NULL` sẽ **không tự động được gán cluster**; cần 1 script/API riêng (ngoài scope MR này) nếu muốn backfill dữ liệu cũ. Hiện tại UI sẽ hiển thị "Unassigned" (màu đỏ) cho các phòng này.
- Việc lấy `clusterId`/`clusterName` từ `cinemaRoom.getCluster()` trong `MovieMapper` dùng MapStruct `expression` truy cập trực tiếp id/name trên proxy lazy — an toàn vì chỉ đọc id (Hibernate không cần init proxy để đọc id đã biết sẵn từ FK) và `getClusterName()` chỉ được gọi trong ngữ cảnh có transaction/OSIV đang mở (như code cũ `toResponseWithStats` ở `CinemaClusterController` đã làm tương tự).

---

## Related

- Branch: `fix/cinema-room-cluster-link`
- Depends on: không có
- Docs: `docs/issues/mr-164-cinema-room-cluster-link.md` (MR mô tả chi tiết thay đổi)
