# API_LIST.md

## 1. Source Controllers Reviewed

* `server/movie-service/src/main/java/movieservice/controller/MovieController.java`
* `server/movie-service/src/main/java/movieservice/controller/CinemaClusterController.java`
* `server/movie-service/src/main/java/movieservice/controller/CinemaRoomController.java` (inferred from `CinemaRoomService` & `RoomLayoutService`)
* `server/movie-service/src/main/java/movieservice/controller/MovieAvailabilityController.java`

## 2. API Summary

* **Cinema Cluster APIs**: 8 APIs
* **Cinema Room APIs**: 14 APIs (Room & Layout)
* **Movie APIs**: 12 APIs
* **Availability APIs**: 7 APIs
* **Other Related APIs**: 0

## 3. Cinema Cluster APIs

| Method | Endpoint | Controller | Handler Method | Actor / Role | Request DTO | Response DTO | Purpose | Status Change? | Notes |
| ------ | -------- | ---------- | -------------- | ------------ | ----------- | ------------ | ------- | -------------- | ----- |
| GET | `/api/cinema-clusters` | `CinemaClusterController` | `getAll` | Public / Admin / Emp | N/A | `List<CinemaClusterResponse>` | Lấy danh sách | Không | Public chỉ lấy ACTIVE |
| GET | `/api/cinema-clusters/{id}`| `CinemaClusterController` | `getById` | Public / Admin / Emp | N/A | `CinemaClusterResponse` | Lấy chi tiết | Không | |
| POST | `/api/cinema-clusters` | `CinemaClusterController` | `create` | Admin / Emp | `CinemaClusterRequest` | `CinemaClusterResponse` | Tạo cụm rạp | -> DRAFT | |
| PUT | `/api/cinema-clusters/{id}`| `CinemaClusterController` | `update` | Admin / Emp | `CinemaClusterRequest` | `CinemaClusterResponse` | Cập nhật / Đổi ACTIVE-INACTIVE| Có (Active-Inactive) | |
| DELETE | `/api/cinema-clusters/{id}`| `CinemaClusterController` | `delete` | Admin | N/A | Void (`204 No Content`) | Xóa rạp nháp | Không | |
| POST | `/api/cinema-clusters/{id}/submit`| `CinemaClusterController` | `submit` | Admin / Emp | N/A | `CinemaClusterResponse` | Trình duyệt | -> PENDING_REVIEW | |
| POST | `/api/cinema-clusters/{id}/approve`| `CinemaClusterController` | `approve` | Admin | N/A | `CinemaClusterResponse` | Duyệt rạp | -> ACTIVE | |
| POST | `/api/cinema-clusters/{id}/reject` | `CinemaClusterController` | `reject` | Admin | `RejectRequest` | `CinemaClusterResponse` | Từ chối duyệt | -> DRAFT | |

## 4. Cinema Room APIs

| Method | Endpoint | Controller | Handler Method | Actor / Role | Request DTO | Response DTO | Purpose | Status Change? | Notes |
| ------ | -------- | ---------- | -------------- | ------------ | ----------- | ------------ | ------- | -------------- | ----- |
| GET | `/api/cinema-rooms` | `CinemaRoomController` | `getAllRooms` | Public / Admin / Emp | N/A | `List<CinemaRoomResponse>` | Lấy ds phòng | Không | |
| GET | `/api/cinema-rooms/{roomId}` | `CinemaRoomController` | `getRoomDetail` | Public / Admin / Emp | N/A | `CinemaRoomResponse` | Lấy chi tiết phòng | Không | |
| POST | `/api/cinema-rooms` | `CinemaRoomController` | `createCinemaRoom` | Admin / Emp | `CinemaRoomRequest` | `CinemaRoomResponse` | Tạo phòng (Wizard) | -> DRAFT | Sinh layout DRAFT tự động |
| PUT | `/api/cinema-rooms/{roomId}`| `CinemaRoomController` | `updateRoom` | Admin / Emp | `CinemaRoomUpdateRequest`| `CinemaRoomResponse` | Cập nhật phòng nháp | Không | |
| DELETE| `/api/cinema-rooms/{roomId}`| `CinemaRoomController` | `deleteCinemaRoom` | Admin / Emp | N/A | Void | Xóa phòng nháp | Không | |
| GET | `/api/cinema-rooms/{roomId}/layouts` | `RoomLayoutController` | `listLayouts` | Public / Admin / Emp | N/A | `List<RoomLayoutSummaryResponse>`| DS Layout | Không | |
| GET | `/api/cinema-rooms/{roomId}/layouts/{id}`| `RoomLayoutController` | `getLayout` | Public / Admin / Emp | N/A | `RoomLayoutResponse` | Chi tiết layout | Không | |
| PUT | `/api/cinema-rooms/{roomId}/layouts/{id}`| `RoomLayoutController` | `saveLayout` | Admin / Emp | `RoomLayoutSaveRequest`| `RoomLayoutResponse` | Sửa layout ghế | Không | Chỉ khi đang DRAFT |
| POST | `/api/cinema-rooms/{roomId}/layouts/{id}/submit`| `RoomLayoutController` | `submit` | Admin / Emp | N/A | `RoomLayoutResponse` | Nộp layout | -> PENDING_APPROVAL| Room -> PENDING_APPROVAL|
| POST | `/api/cinema-rooms/{roomId}/layouts/{id}/approve`| `RoomLayoutController` | `approve`| Admin | N/A | `RoomLayoutResponse` | Duyệt layout | -> APPROVED | Room -> APPROVED |
| POST | `/api/cinema-rooms/{roomId}/layouts/{id}/reject` | `RoomLayoutController` | `reject` | Admin | `RejectRequest` | `RoomLayoutResponse` | Từ chối layout | -> DRAFT | Room -> DRAFT |
| POST | `/api/cinema-rooms/{roomId}/layouts/{id}/activate`| `RoomLayoutController`| `activate` | Admin | N/A | `RoomLayoutResponse` | Kích hoạt layout | -> ACTIVE | Room -> ACTIVE, Sync seats |
| POST | `/api/cinema-rooms/{roomId}/layouts/{id}/clone` | `RoomLayoutController`| `clone` | Admin / Emp | N/A | `RoomLayoutResponse` | Clone layout | -> DRAFT (clone)| |
| POST | `/api/cinema-rooms/{roomId}/maintenance` | `CinemaRoomController` | `reportMaintenance`| Admin / Emp | `MaintenanceRequest`| `CinemaRoomMaintenance`| Báo sự cố | -> TEMP_UNAVAILABLE| |

## 5. Movie APIs

| Method | Endpoint | Controller | Handler Method | Actor / Role | Request DTO | Response DTO | Purpose | Status Change? | Notes |
| ------ | -------- | ---------- | -------------- | ------------ | ----------- | ------------ | ------- | -------------- | ----- |
| GET | `/api/movies` | `MovieController` | `getPage` | Admin / Emp | N/A | `Page<MovieResponse>` | Lấy danh sách | Không | |
| GET | `/api/movies/all` | `MovieController` | `getAll` | Admin / Emp | N/A | `List<MovieResponse>`| Toàn bộ danh sách | Không | |
| GET | `/api/movies/public` | `MovieController` | `getPublic` | Public | N/A | `List<PublicMovieResponse>`| Lấy danh sách public | Không | Display: NOW_SHOWING / COMING_SOON |
| GET | `/api/movies/{id}` | `MovieController` | `findById` | Admin / Emp | N/A | `MovieResponse` | Lấy chi tiết | Không | |
| GET | `/api/movies/public/{id}`| `MovieController` | `getPublicById`| Public | N/A | `PublicMovieResponse` | Chi tiết public | Không | |
| POST | `/api/movies` | `MovieController` | `createMovie` | Admin / Emp | `CreateMovieRequest`| `MovieResponse` | Tạo phim | -> DRAFT | |
| PUT | `/api/movies/{id}` | `MovieController` | `updateMovie` | Admin / Emp | `UpdateMovieRequest`| `MovieResponse` | Cập nhật phim | Không | |
| POST | `/api/movies/{id}/submit`| `MovieController` | `submit` | Admin / Emp | N/A | `MovieResponse` | Trình duyệt | -> PENDING_REVIEW | |
| POST | `/api/movies/{id}/approve`| `MovieController` | `approve` | Admin | N/A | `MovieResponse` | Duyệt phim | -> APPROVED | |
| POST | `/api/movies/{id}/request-changes`| `MovieController` | `requestChanges`| Admin | `RejectRequest` | `MovieResponse` | Y/c chỉnh sửa | -> CHANGES_REQUESTED| |
| POST | `/api/movies/{id}/start-revision`| `MovieController` | `startRevision`| Admin / Emp | N/A | `MovieResponse` | Sửa đổi | -> DRAFT | |
| POST | `/api/movies/{id}/archive`| `MovieController` | `archive` | Admin | N/A | `MovieResponse` | Lưu trữ phim | -> ARCHIVED | |

## 6. Availability APIs

| Method | Endpoint | Controller | Handler Method | Actor / Role | Request DTO | Response DTO | Purpose | Status Change? | Notes |
| ------ | -------- | ---------- | -------------- | ------------ | ----------- | ------------ | ------- | -------------- | ----- |
| GET | `/api/movie-availabilities` | `MovieAvailabilityController`| `search` | Admin / Emp | N/A | `List<MovieAvailabilityResponse>`| Xem phân bổ | Không | |
| POST | `/api/movie-availabilities` | `MovieAvailabilityController`| `create` | Admin / Emp | `CreateMovieAvailabilityRequest`| `MovieAvailabilityResponse` | Phân bổ rạp chiếu | -> PLANNED | |
| PUT | `/api/movie-availabilities/{id}`| `MovieAvailabilityController`| `update` | Admin / Emp | `UpdateMovieAvailabilityRequest`| `MovieAvailabilityResponse` | Sửa thông tin | Không | |
| POST | `/api/movie-availabilities/{id}/open`| `MovieAvailabilityController`| `open` | Admin | N/A | `MovieAvailabilityResponse` | Mở rạp | -> OPEN | |
| POST | `/api/movie-availabilities/{id}/suspend`| `MovieAvailabilityController`| `suspend` | Admin | `SuspendRequest`| `MovieAvailabilityResponse` | Đóng băng | -> SUSPENDED | |
| POST | `/api/movie-availabilities/{id}/resume`| `MovieAvailabilityController`| `resume` | Admin | N/A | `MovieAvailabilityResponse` | Phục hồi | -> OPEN | |
| POST | `/api/movie-availabilities/{id}/close`| `MovieAvailabilityController`| `close` | Admin | `CloseRequest` | `MovieAvailabilityResponse` | Kết thúc phân bổ | -> CLOSED | |

## 7. Missing / Suggested APIs

- **Không tìm thấy API Xóa (Delete) Movie**: Ngay cả khi tạo nhầm DRAFT. Mặc dù soft delete hay archive là bắt buộc với phim đã chiếu, nhưng khi mới DRAFT nên có API Delete. Đề xuất: Bổ sung `DELETE /api/movies/{id}` chỉ áp dụng với phim DRAFT chưa có Availability.
- **API `PATCH /api/cinema-rooms/{roomId}/status`**: Có vẻ thiếu trong service nhưng document (API_CONTRACT.md) từng đề cập.

## 8. API Open Questions

- `MovieController.uploadImage` hiện đang cho phép public request (phía API_CONTRACT.md cũ), nhưng code java `MovieController.java` lại phân quyền `@PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")`. Tôi sẽ follow theo Code java.
- Thiếu API cập nhật `Seat` từng ghế (PUT /api/seats/{id}) trong service scan này, nhưng Comment nhắc là "edited individually afterward via PUT /api/seats/{id}". Cần hỏi lại để confirm controller tồn tại.
