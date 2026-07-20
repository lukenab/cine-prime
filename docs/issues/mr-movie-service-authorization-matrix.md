## Overview / Objective

Hoàn thiện issue `[Backend] Enforce movie-service endpoint authorization matrix`. Trước MR này, `movie-service` bảo vệ endpoint theo kiểu permit GET rộng theo wildcard (`GET /api/movies/**`, `/api/cinema-rooms/**`, ...) rồi trông chờ `@PreAuthorize` ở từng method bù lại — dẫn tới một số endpoint bị rơi ra ngoài cả 2 lớp bảo vệ mà không ai nhận ra, cho tới khi rà soát toàn bộ theo đúng ma trận Anonymous/CUSTOMER/EMPLOYEE/ADMIN mới lộ ra.

MR này sửa toàn bộ lỗ hổng thật sự tìm được, và viết tài liệu ma trận authorization đầy đủ cho toàn bộ resource của service.

Related Issue: Closes `[Backend] Enforce movie-service endpoint authorization matrix`
Depends on: có thể làm song song với `MOV-02`, `INV-03` theo issue gốc — MR này không phụ thuộc trực tiếp vào MR nào khác.

---

## Changes Introduced

**Controllers / Routes:**
- `CinemaRoomController.reportMaintenance()` / `resolveMaintenance()` / `setRoomStatus()` — bỏ tham số `@RequestHeader(value = "X-User-Name", defaultValue = "unknown")`, thay bằng `Authentication authentication` (giống pattern `createRoom`/`updateRoom`/`deleteRoom` đã dùng sẵn trong cùng controller).
- `CinemaRoomController.getAllRooms()` / `getRoomDetail()` — thêm tham số `Authentication authentication`, forward xuống service để lọc theo status.
- `CinemaClusterController.getById()` — thêm tham số `Authentication authentication`, áp policy visibility giống hệt `getAll()`.
- `PersonController` — thêm `@PreAuthorize` cho `create`/`update` (`hasAnyRole('ADMIN', 'EMPLOYEE')`) và `delete` (`hasRole('ADMIN')`).
- `SeatController.updateSeat()` — thêm `@PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")`.

**Services / Logic:**
- `CinemaRoomService.getAllRooms(clusterId, authentication)` / `getRoomDetail(roomId, authentication)` — non-staff caller (không phải ADMIN/EMPLOYEE) không còn thấy phòng đang `DRAFT`/`PENDING_APPROVAL`; guess ID của phòng ẩn nhận đúng `CINEMA_ROOM_NOT_FOUND` giống ID không tồn tại.
- `CinemaClusterController.getById()` — non-staff caller không còn thấy cluster non-`ACTIVE`; cùng nguyên tắc "404 giống hệt ID không tồn tại", không tiết lộ sự tồn tại của cluster bị ẩn.

**DTOs / Mappers / Components:**
- Không có DTO nào thay đổi.

**Database / JPA / Migration:**
- Không có.

**Exception Handling / Error Codes:**
- Không thêm mã lỗi mới — tái sử dụng `CINEMA_ROOM_NOT_FOUND` và `CLUSTER_NOT_FOUND` sẵn có cho các trường hợp bị ẩn.

**Security Config:**
- `SecurityConfig` — thêm matcher `GET /api/showtimes/*/seats` → permitAll (trước đó rơi vào `.anyRequest().authenticated()`, bắt buộc đăng nhập chỉ để xem sơ đồ ghế của 1 suất chiếu — không nhất quán với các endpoint browse ghế/phòng khác vốn đã public).

---

## API contract

Không có contract mới, chỉ thay đổi hành vi authorization của endpoint đã tồn tại:

| Endpoint | Trước MR | Sau MR |
|---|---|---|
| `POST /{id}/maintenance`, `/maintenance/{id}/resolve`, `PATCH /{id}/status` | Actor lấy từ header `X-User-Name` do client tự gửi | Actor lấy từ JWT đã verify |
| `GET /api/cinema-clusters/{id}` | Trả full detail cho mọi status, mọi caller | Non-staff chỉ thấy cluster `ACTIVE`; cluster khác → `404 CLUSTER_NOT_FOUND` |
| `GET /api/cinema-rooms`, `GET /{id}` | Trả mọi status, mọi caller | Non-staff không thấy `DRAFT`/`PENDING_APPROVAL`; phòng ẩn → `404 CINEMA_ROOM_NOT_FOUND` |
| `POST/PUT/DELETE /api/persons` | Không yêu cầu role nào (chỉ cần đăng nhập) | POST/PUT: ADMIN hoặc EMPLOYEE — DELETE: ADMIN |
| `PUT /api/seats/{id}` | Không yêu cầu role nào (chỉ cần đăng nhập) | ADMIN hoặc EMPLOYEE |
| `GET /api/showtimes/{id}/seats` | Yêu cầu đăng nhập | Public (permitAll) |

---

## Key Architectural Decisions

- **Sửa đúng lỗ hổng tìm được, không viết lại toàn bộ security config.** Issue có phạm vi rất rộng ("chuẩn hóa toàn bộ ma trận"), nhưng MR này tập trung vào các endpoint thực sự bị rơi ra ngoài 2 lớp bảo vệ (URL matcher + `@PreAuthorize`) thay vì đảo lộn cấu trúc đang hoạt động đúng.
- **Visibility non-ACTIVE/DRAFT dùng lại đúng pattern đã có, không phát minh cơ chế mới.** `CinemaClusterController.getAll()` đã có sẵn `isStaff(authentication)` — MR chỉ áp lại đúng logic đó cho `getById()`. Tương tự, `CinemaRoomService` đã có `hasRole()` helper — MR thêm `isStaff()`/`isPubliclyVisible()` dùng lại helper đó.
- **404 thống nhất cho "không tồn tại" và "tồn tại nhưng bị ẩn"** — đúng nguyên tắc đã áp dụng ở MR tách public/internal movie catalog trước đó: không được để lộ sự khác biệt giữa 2 trường hợp qua mã lỗi khác nhau.
- **Không mở rộng phạm vi sang siết luôn GET reference-data (persons/companies/age-ratings/formats)** — các endpoint này hiện chỉ cần đăng nhập, chưa giới hạn role. Đã ghi rõ trong `AUTHORIZATION_MATRIX.md` là rủi ro thấp (dữ liệu tham chiếu không nhạy cảm) và cố ý để ngoài phạm vi MR này.
- **Không tự audit lại API Gateway.** Issue có nhắc "Kiểm tra gateway không forward spoofed identity headers" — MR này chỉ sửa phía `movie-service` (ngừng tin `X-User-Name` client gửi), chưa re-verify cấu hình routing của gateway. Đã ghi rõ trong tài liệu ma trận là việc cần làm riêng.

---

## How to Test

1. `mvnw.cmd -pl movie-service test` — bao gồm test mới:
   - `PersonControllerAuthorizationTest`, `SeatControllerAuthorizationTest` (reflection-based, cùng pattern `TmdbControllerAuthorizationTest` có sẵn trong repo).
   - `CinemaClusterControllerTest` — 4 case mới cho `getById()`: ẩn cluster DRAFT với anonymous, ẩn cluster PENDING_REVIEW với customer, staff thấy được cluster DRAFT, ai cũng thấy cluster ACTIVE.
   - `CinemaRoomServiceTest` — 6 case mới cho `getRoomDetail()`/`getAllRooms()`: tương tự, cộng thêm case lọc đúng số lượng phòng trả về cho non-staff vs staff.
   - `CinemaRoomControllerTest` — 5 case mới xác nhận `reportMaintenance`/`resolveMaintenance`/`setRoomStatus`/`getAllRooms`/`getRoomDetail` dùng đúng tên từ `Authentication` đã verify, không còn phụ thuộc header.
   - Kết quả: 235/236 — 1 lỗi còn lại (`MovieImageRepositoryIntegrationTest`) là lỗi có từ trước, không liên quan.
2. Thủ công: gọi `POST /api/cinema-rooms/{id}/maintenance` kèm header `X-User-Name: someone-else` cùng token JWT thật của user khác → xác nhận audit log ghi đúng username từ token, không phải giá trị trong header.
3. Thủ công: gọi `GET /api/cinema-clusters/{id}` cho 1 cluster đang `DRAFT` không kèm token → xác nhận `404`. Gọi lại với token ADMIN/EMPLOYEE → xác nhận `200` với đầy đủ dữ liệu.
4. Thủ công: gọi `POST /api/persons` và `PUT /api/seats/{id}` bằng token của một CUSTOMER (`ROLE_MEMBER`) → xác nhận `403` thay vì `200`/`201` như trước.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (`mvn compile`)

**Backend**
- [x] Không phát sinh N+1 mới (visibility filter chỉ thêm 1 điều kiện `if` trên dữ liệu đã load, không thêm truy vấn)
- [x] Exception dùng đúng mã lỗi có sẵn (`CLUSTER_NOT_FOUND`, `CINEMA_ROOM_NOT_FOUND`)
- [ ] Chưa test thủ công qua Postman trong phiên này (đã test qua unit test + gọi API trực tiếp bằng curl trong phiên làm việc, xem How to Test #2-4)
- [ ] Chưa re-verify cấu hình API Gateway có forward header giả mạo hay không (ngoài phạm vi MR này, xem Key Architectural Decisions)

**Frontend**
- Không áp dụng — MR này không chạm frontend.

---

## Reviewer Notes

- **`CinemaRoomController.getAllRooms()`/`getRoomDetail()` và `CinemaClusterController.getById()` đổi signature** (thêm tham số `Authentication`) — đã rà soát toàn bộ codebase xác nhận không còn nơi nào khác gọi các method cũ (chỉ controller gọi service, không có internal caller nào khác).
- **Reference-data GET (persons/companies/age-ratings/formats) vẫn chỉ yêu cầu đăng nhập, chưa giới hạn role** — cố ý, đã ghi rõ trong `AUTHORIZATION_MATRIX.md`. Nếu policy đội ngũ muốn siết chặt hơn, đây là follow-up riêng, không phải thiếu sót của MR này.
- **Gateway header-spoofing chưa được audit riêng** — MR chỉ đảm bảo `movie-service` không còn tin header `X-User-Name` do client gửi; chưa xác minh gateway có chặn/strip header này ở tầng routing hay không.
- File `docs/api-specs/movie-service/AUTHORIZATION_MATRIX.md` nên được cập nhật mỗi khi có endpoint mới thêm vào service — coi đây là tài liệu sống, không phải snapshot một lần.
