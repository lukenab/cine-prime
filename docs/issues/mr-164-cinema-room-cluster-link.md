## Overview / Objective

Fix bug phòng chiếu (cinema room) tạo mới không được gắn với cinema cluster nào (`cluster_id` luôn `NULL` trong DB dù quan hệ JPA đã tồn tại sẵn ở tầng entity), khiến số phòng/số ghế hiển thị sai trên trang chi tiết cluster. Đồng thời fix 1 bug chặn cứng nằm chung code path: field `seatQuantity` (FE) không khớp `totalSeatCapacity` (BE) khiến "Add Cinema Room" trên UI admin luôn trả lỗi 400.

Related Issue: Closes #164

---

## Changes Introduced

**Controllers / Routes:**
- `CinemaRoomController.getAllRooms()`: nhận thêm `@RequestParam(required = false) Long clusterId` để filter theo cluster (backend trước đó không đọc param này dù FE đã có sẵn hàm gọi `getRoomsByCluster()`)

**Services / Logic:**
- `CinemaRoomService.createCinemaRoom()`: thêm bước `cinemaClusterRepository.findById(request.getClusterId())` (throw `CLUSTER_NOT_FOUND` nếu không tồn tại) và gọi `room.setCluster(cluster)` **trước khi save** — đây là dòng logic còn thiếu gây ra bug gốc
- `CinemaRoomService.getAllRooms()`: đổi chữ ký thành `getAllRooms(Long clusterId)`, filter qua `cinemaRoomRepository.findByCluster_ClusterId(clusterId)` khi có param, giữ nguyên `findAll()` khi không có (backward-compatible)

**DTOs / Mappers / Components:**
- `CinemaRoomRequest.java`: thêm field `clusterId` (`@NotNull`)
- `CinemaRoomResponse.java`: thêm `clusterId`, `clusterName`
- `MovieMapper.toCinemaRoomResponse()`: thêm 2 `@Mapping` expression lấy `clusterId`/`clusterName` từ `cinemaRoom.getCluster()`
- `CinemaRoomRepository`: thêm `findByCluster_ClusterId(Long clusterId)`
- **Frontend** `movieApi.ts`:
  - `CreateRoomPayload`/`RoomResponse` thêm `clusterId` (và `clusterName` cho response)
  - Thêm type `RoomApiResponse` khớp đúng shape backend thật (`totalSeatCapacity` thay vì `seatQuantity`) + hàm `toLegacyRoom()` (cùng pattern `toLegacyMovie()` có sẵn trong file) để giữ nguyên tên field `seatQuantity` đang dùng khắp UI mà không phải sửa lại toàn bộ các trang khác
  - `getRooms()`, `createRoom()`, `getRoomsByCluster()`: build đúng wire payload/parse đúng response qua `toLegacyRoom()`
- **Frontend** `ManageCinemaRoomsPage.tsx`:
  - `AddRoomModal` nhận thêm prop `clusters`, thêm dropdown "Cinema Cluster" bắt buộc (chặn submit nếu `clusterId` rỗng hoặc chưa có cluster nào tồn tại — hiện thông báo rõ ràng)
  - Bảng danh sách phòng thêm cột "Cluster" (hiển thị tên cluster, hoặc "Unassigned" màu đỏ cho phòng cũ chưa gán)
  - `matchCluster` filter bỏ cast `(r as any).clusterId` vì `RoomResponse` giờ có field thật

**Database / JPA / Migration:**
- Không có migration mới — dùng lại cột `cluster_id` đã tồn tại sẵn trên `cinema_room` (chưa từng được ghi giá trị trước MR này).

**Exception Handling / Error Codes:**
- Tái sử dụng `MovieErrorCode.CLUSTER_NOT_FOUND` đã có sẵn (dùng chung với `CinemaClusterController`), không thêm mã lỗi mới.

---

## Key Architectural Decisions

- **`clusterId` bắt buộc (`@NotNull`) khi tạo phòng mới**, không cho phép tạo phòng "mồ côi" nữa — đúng với business rule ngầm định (1 phòng chiếu vật lý luôn thuộc về 1 rạp/cluster cụ thể). Phòng cũ đã tồn tại với `cluster_id = NULL` **không bị migrate/backfill tự động** trong MR này — UI sẽ hiển thị "Unassigned" cho các phòng đó, cần xử lý riêng nếu muốn gán lại (không nằm trong scope bug fix này).
- **Không đổi tên field `seatQuantity` trên toàn bộ UI** dù backend dùng `totalSeatCapacity` — thay vào đó thêm 1 lớp mapper (`toLegacyRoom`) ở tầng `movieApi.ts`, giữ đúng convention `toLegacyMovie` đã có sẵn trong cùng file. Giảm diện thay đổi, tránh phải sửa lại `ShowTimeModal.tsx` và các chỗ khác đang dùng tên `seatQuantity`.
- **Lấy `clusterName` qua MapStruct expression thay vì thêm 1 query riêng**: chấp nhận truy cập lazy proxy `cinemaRoom.getCluster()` vì các endpoint gọi `toCinemaRoomResponse()` đều chạy trong ngữ cảnh có transaction/OSIV mở sẵn (giống cách `CinemaClusterController.toResponseWithStats()` đang làm với `countRoomsByClusterId`).
- **Không thêm bulk "assign cluster" cho phòng cũ** — cân nhắc là 1 thao tác dữ liệu (data migration) tách biệt khỏi bug fix logic, rủi ro nếu làm vội trong cùng MR (không biết chắc phòng cũ nào thuộc cluster nào nếu không có thông tin gốc).

---

## How to Test

1. `cd server/movie-service && mvn spring-boot:run` (cần Postgres/Kafka/Eureka đang chạy như bình thường).
2. Login ADMIN/EMPLOYEE → **Admin → Cinema Clusters** → tạo 1 cluster mới (hoặc dùng cluster có sẵn), submit + approve để `status = ACTIVE`.
3. Vào **Admin → Cinema Rooms → Add Room**: xác nhận có dropdown "Cinema Cluster" bắt buộc chọn; thử submit khi chưa chọn → bị chặn (nút disable).
4. Chọn cluster, điền đủ thông tin phòng → Submit → xác nhận tạo thành công (không còn lỗi 400 do field `seatQuantity`/`totalSeatCapacity`).
5. Vào lại **Cinema Cluster Detail** của cluster vừa chọn → xác nhận `totalRooms`/`totalSeats` tăng đúng theo phòng vừa tạo (trước fix luôn là 0).
6. Ở trang danh sách Cinema Rooms → xác nhận cột "Cluster" hiển thị đúng tên cluster; dùng dropdown filter "All Clusters" → lọc đúng theo cluster đã chọn.
7. Test qua Postman: `POST /api/cinema-rooms` thiếu `clusterId` → phải trả lỗi validation 400; `clusterId` không tồn tại (vd. `999999`) → trả `CLUSTER_NOT_FOUND`.
8. `GET /api/cinema-rooms?clusterId={id}` → xác nhận chỉ trả phòng thuộc cluster đó; bỏ trống param → trả tất cả như cũ.

---

## Checklist

**General**
- [x] Follows project coding conventions (Lombok `@FieldDefaults`, MapStruct `@Mapping` expression theo đúng pattern có sẵn trong `MovieMapper`)
- [x] No debug / console.log code left
- [ ] Code compiles, no errors — **chưa chạy được `mvn compile` thật** trong môi trường viết code này (không có Maven/JDK khả dụng). Đã kiểm tra thủ công: cân bằng ngoặc `{}`/`()` trên toàn bộ 6 file Java đã sửa (`CinemaRoomRequest`, `CinemaRoomResponse`, `MovieMapper`, `CinemaRoomService`, `CinemaRoomController`, `CinemaRoomRepository`), grep xác nhận `CLUSTER_NOT_FOUND`/`CinemaClusterRepository` đã tồn tại sẵn (không cần thêm mới). Phía frontend đã chạy `tsc --noEmit` thật — 0 lỗi mới phát sinh từ 2 file `movieApi.ts`/`ManageCinemaRoomsPage.tsx` (đối chiếu với log lỗi pre-existing không liên quan). **Reviewer vui lòng chạy `mvn compile` thật trước khi merge.**

**Backend**
- [ ] No N+1 query issues — `createCinemaRoom()` thêm 1 query `findById` cho cluster (chấp nhận được, không phải trong vòng lặp); chưa bật Hibernate SQL log để xác nhận trực tiếp
- [x] Exception handling uses correct error codes (tái sử dụng `CLUSTER_NOT_FOUND` có sẵn, không thêm mã mới)
- [ ] Endpoints tested via Postman / API client — chưa tự chạy được vì không có backend đang chạy sẵn trong môi trường viết code này; xem bước 7–8 ở "How to Test"
- [ ] API contract / Postman collection updated — **collection cũ (`CinePrime-Issue162.postman_collection.json`) không cover cinema-rooms**, cần bổ sung riêng nếu muốn có bộ test tự động cho API này (ngoài scope MR)

**Frontend**
- [x] Loading and error states handled (dropdown cluster hiện message rõ ràng khi chưa có cluster nào; nút submit disable khi chưa chọn cluster)
- [x] axiosClient attaches Bearer token correctly — không đổi interceptor, dùng lại `axiosClient` hiện có
- [ ] Tested on both dark and light mode — chưa tự mở trình duyệt kiểm tra trực quan trong môi trường viết code này; cột "Cluster" mới thêm dùng đúng biến CSS theme sẵn có (`var(--text-main)`), riêng màu đỏ "Unassigned" dùng hardcode `#ef4444` giống các chỗ báo lỗi khác trong cùng file — **reviewer nên tự kiểm tra trực quan**

---

## Reviewer Notes

- Đây là **breaking change nhỏ** cho `POST /api/cinema-rooms`: field `totalSeatCapacity` (đã có từ trước, không đổi) vẫn bắt buộc, nay **thêm `clusterId` cũng bắt buộc**. Nếu có script/tool nào khác ngoài admin UI đang gọi API này (vd. seed data, test tự động), cần cập nhật để không bị 400.
- Phòng cũ (`cluster_id = NULL`) **cố tình không được backfill** trong MR này — xem "Key Architectural Decisions". Sau khi merge, reviewer nên kiểm tra DB thật có bao nhiêu phòng đang "Unassigned" để quyết định có cần 1 task riêng dọn dữ liệu hay không.
- Bug B (field `seatQuantity`/`totalSeatCapacity`) được fix chung MR này vì cùng code path và chặn cứng việc test Bug A qua UI — nếu reviewer muốn tách riêng thành 2 MR/2 commit để dễ review, có thể yêu cầu tách lại `movieApi.ts`'s `toLegacyRoom()` ra khỏi phần `clusterId`.
- Không có `AccessDeniedHandler` tuỳ chỉnh trong `movie-service` (giống gap đã biết ở `auth-service`, tracked riêng ở #155/#156) — không thuộc scope MR này.
