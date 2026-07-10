# MR Description — [Backend] Implement Cinema Cluster CRUD API in movie-service

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feat/cinema-cluster-crud` → target: `develop`

---

## Overview / Objective

Implement CRUD API cho `cinema_cluster` trong `movie-service`, cho phép admin quản lý các cụm rạp chiếu phim theo địa điểm/tỉnh thành. Frontend (`ManageCinemaClusterPage.tsx`) đã có sẵn và integrate với `/api/cinema-clusters` — MR này hoàn thiện phần backend còn thiếu để feature hoạt động end-to-end.

Related Issue: Closes #[cinema-cluster-issue]

---

## Changes Introduced

**Controllers / Routes:**
- `CinemaClusterController` — CRUD đầy đủ tại `/api/cinema-clusters`
  - `GET /api/cinema-clusters` — lấy tất cả, hỗ trợ `?q=` (search theo tên/tỉnh) và `?status=ACTIVE|INACTIVE`
  - `GET /api/cinema-clusters/{id}` — lấy theo id
  - `POST /api/cinema-clusters` — tạo mới (`ROLE_ADMIN` only)
  - `PUT /api/cinema-clusters/{id}` — cập nhật (`ROLE_ADMIN` only)
  - `DELETE /api/cinema-clusters/{id}` — xóa, block nếu còn phòng (`ROLE_ADMIN` only)

**Entities / JPA:**
- `CinemaCluster` — entity mới map table `cinema_cluster` (clusterId, clusterName, province, address, phoneNumber, status enum, audit fields)
- `CinemaRoom` — thêm `@ManyToOne cluster` (nullable FK `cluster_id`) để link phòng vào cụm rạp

**DTOs / Mappers:**
- `CinemaClusterRequest` — validation `@NotBlank` trên clusterName/province/address
- `CinemaClusterResponse` — bao gồm `totalRooms` và `totalSeats` (computed từ repository)
- `MovieMapper` — thêm `toCinemaCluster()`, `toCinemaClusterResponse()`; thêm `@Mapping(target = "cluster", ignore = true)` vào `toCinemaRoom()`

**Database / Migration:**
- `V3__add_cinema_cluster.sql` — tạo bảng `cinema_cluster`, thêm cột `cluster_id` FK vào `cinema_room`, seed 6 cluster mẫu

**Enums:**
- `ClusterStatus` — `ACTIVE | INACTIVE`

**Exception Handling / Error Codes:**
- `CLUSTER_NOT_FOUND(2023)` — 404 khi cluster không tồn tại
- `CLUSTER_HAS_ROOMS(2024)` — 409 khi xóa cluster còn phòng chiếu

---

## Key Architectural Decisions

- **`totalRooms` / `totalSeats` tính tại controller layer** — thay vì lưu counter vào DB hay dùng `@Formula`. Dùng 2 JPQL queries (`COUNT` + `SUM`) mỗi lần GET. Đơn giản, không cần sync counter khi thêm/xóa phòng. Nếu scale cần thiết có thể cache sau.

- **FK `cluster_id` nullable** — phòng chiếu hiện có không bị break. Phòng chưa gán cluster vẫn hoạt động bình thường. Admin gán cluster cho phòng thông qua CinemaRoom edit UI.

- **Block delete khi còn phòng** — tránh orphaned rooms. Nếu muốn xóa cluster phải unassign hoặc xóa hết phòng trước. Trả về `CLUSTER_HAS_ROOMS(409)` với message rõ ràng.

- **Search `?q=` match cả tên lẫn tỉnh** — 1 query duy nhất `findByClusterNameContainingIgnoreCaseOrProvinceContainingIgnoreCase(q, q)`, khớp với UX search bar trên frontend.

---

## How to Test

**Setup:**
1. Chạy migration: `docker exec -it postgres psql -U postgres -d movie_db -f /tmp/V3__add_cinema_cluster.sql`
   (hoặc copy nội dung file vào DBeaver/pgAdmin và execute)
2. Rebuild service: `docker-compose up -d --build movie-service`
3. Đăng nhập tài khoản **ADMIN**

**Test GET:**

4. `GET /api/cinema-clusters` → trả về 6 cluster seed, mỗi cluster có `totalRooms` và `totalSeats`
5. `GET /api/cinema-clusters?q=hà nội` → chỉ trả về các cluster ở Hà Nội
6. `GET /api/cinema-clusters?status=INACTIVE` → chỉ trả về cluster Ninh Kiều (INACTIVE)
7. `GET /api/cinema-clusters/1` → chi tiết cluster id=1

**Test CREATE:**

8. `POST /api/cinema-clusters` body:
   ```json
   {
     "clusterName": "CinePrime Test",
     "province": "Đà Nẵng",
     "address": "99 Lê Duẩn, Hải Châu",
     "phoneNumber": "0236 999 9999",
     "status": "ACTIVE"
   }
   ```
   → 201, response có `clusterId` mới, `totalRooms: 0`, `totalSeats: 0`

9. POST thiếu `clusterName` → 400 Bad Request với message validation

**Test UPDATE:**

10. `PUT /api/cinema-clusters/{id}` với body thay đổi `province` → 200, data cập nhật
11. `PUT /api/cinema-clusters/9999` → 404 `CLUSTER_NOT_FOUND`

**Test DELETE:**

12. `DELETE /api/cinema-clusters/{id mới tạo ở bước 8}` → 200 OK (cluster không có phòng)
13. `DELETE /api/cinema-clusters/1` (cluster có 4 phòng) → 409 `CLUSTER_HAS_ROOMS`
14. `DELETE` bằng tài khoản EMPLOYEE → 403 Forbidden

**Test Frontend:**

15. Vào sidebar → click **Clusters** → trang hiển thị 6 cluster với stats (rooms, seats)
16. Click **Add Cluster** → điền form → Save → cluster mới xuất hiện trong bảng ngay
17. Click Edit → sửa tên → Save → cập nhật ngay không cần reload
18. Click Delete cluster không có phòng → confirm → xóa thành công
19. Search theo tên hoặc tỉnh → bảng filter realtime

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] Không còn debug code
- [x] Follows project coding conventions (`AppException`, `ApiResponse`, `@PreAuthorize`)

**Backend**
- [x] `@PreAuthorize("hasRole('ADMIN')")` trên POST/PUT/DELETE
- [x] Exception handling dùng `AppException(MovieErrorCode.*)` — không lộ stack trace
- [x] Block xóa cluster khi còn phòng (error code 2024)
- [x] FK nullable — không break dữ liệu `cinema_room` hiện có
- [x] Endpoints tested via Postman: GET all, GET by id, POST, PUT, DELETE

**Database**
- [x] Migration script `V3__add_cinema_cluster.sql` idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- [x] Seed data 6 cluster mẫu khớp với mock data frontend
- [x] `updated_at` trigger tự động

---

## Reviewer Notes

- **`totalRooms` / `totalSeats`**: computed bằng 2 queries trong `toResponseWithStats()` — check N+1 nếu list lớn (hiện tại acceptable vì số cluster nhỏ)
- **`CinemaRoom.cluster` field**: nullable, `FetchType.LAZY` — không ảnh hưởng existing `CinemaRoomResponse` vì mapper ignore field này
- **Migration**: chạy thủ công (project không dùng Flyway/Liquibase), cần copy vào `server/postgres-init/movie_db.sql` cho fresh setup
- **Frontend**: đã integrate sẵn từ trước, không cần thay đổi gì thêm
