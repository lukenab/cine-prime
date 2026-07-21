# BUSINESS_RULES.md

## 1. Source Code Reviewed

* `server/movie-service/src/main/java/movieservice/service/MovieService.java`
* `server/movie-service/src/main/java/movieservice/service/CinemaClusterService.java`
* `server/movie-service/src/main/java/movieservice/service/CinemaRoomService.java`
* `server/movie-service/src/main/java/movieservice/service/RoomLayoutService.java`

## 2. General Rules 

* Dữ liệu liên quan đến cấu hình rạp, ghế, phòng, và phim đều phải tuân thủ luồng duyệt (Maker-Checker): tạo `DRAFT` (Employee) -> `PENDING_REVIEW` -> `ACTIVE / APPROVED` (Admin).
* `AppException` được sử dụng thống nhất trên toàn codebase kết hợp với `MovieErrorCode` để xử lý các Business Exception.
* Luôn ghi log thay đổi trạng thái (AuditLog / StatusHistory) cho Cluster, Layout và Movie.

## 3. Cinema Cluster Business Rules

### Rules 
* Rạp hoạt động độc lập với phòng. Phải tạo rạp xong (được duyệt sang ACTIVE) mới được tạo phòng.

### Creation Rules
* Nếu user là `ROLE_ADMIN`, rạp được tạo có thể tự động thành `ACTIVE` (phụ thuộc authentication). `ROLE_EMPLOYEE` tạo thì vào `DRAFT`.
* `clusterName` và `clusterCode` không được trùng lặp không phân biệt hoa thường.

### Update Rules
* Trạng thái rạp chỉ có thể update tự do khi đang ở `DRAFT`. Nếu rạp đã thoát khỏi DRAFT, `clusterCode` trở thành bất biến (immutable).
* Cập nhật `status` trực tiếp qua API `updateCluster` bị chặn ngặt nghèo (chỉ cho phép ADMIN đổi `ACTIVE` <-> `INACTIVE`).

### Activation / Deactivation Rules
* Được phép chuyển `ACTIVE` -> `INACTIVE` qua API PUT (gọi là action DEACTIVATE) và ngược lại (REACTIVATE).

### Delete Rules
* Chỉ cho phép xóa rạp khi rạp đang `DRAFT`, chưa từng bị submit (`NON_DELETABLE_HISTORY`), không có phòng chiếu và không có lịch trình `MovieAvailability`.

### Validation Rules
* `Timezone` phải hợp lệ chuẩn Java `ZoneId`.
* `OperatingHours` phải cấu hình đầy đủ chính xác 7 ngày trong tuần.

### Permission Rules
* Xóa rạp, phê duyệt rạp: Bắt buộc `ROLE_ADMIN`.
* Submit (Trình duyệt): ADMIN hoặc người tạo ra DRAFT đó (EMPLOYEE).

### Error Cases
* Xóa rạp đã có phòng: Throw `CLUSTER_HAS_ROOMS`.
* Đổi mã rạp khi hết DRAFT: Throw `CLUSTER_CODE_IMMUTABLE`.

### Missing / Unclear
* Chưa thấy rule chặn xếp `Showtime` tương lai nếu rạp đang chuyển sang `INACTIVE`.

### Recommended Improvements
* Xóa cứng (hard delete) rạp nháp vẫn là rủi ro. Có thể bổ sung soft-delete thay vì `cinemaClusterRepository.delete()`.

## 4. Cinema Room Business Rules

### Rules 
* Quá trình thiết lập phòng (Wizard Mode) không chỉ sinh ra Room mà phải sinh kèm 1 `RoomLayout` DRAFT. 
* Capacity của phòng là read-only đối với Client, được tự động recompute bởi `RoomLayoutService` từ các ghế (Seats).

### Creation Rules
* Rạp (Cluster) phải ở trạng thái `ACTIVE` mới được phép tạo phòng.

### Update Rules
* Cập nhật thông số cơ bản (chiều dài, rộng, công nghệ chiếu) chỉ được phép khi phòng đang `DRAFT`.

### Activation / Deactivation Rules
* Phòng chuyển `TEMPORARILY_UNAVAILABLE` nếu có `CinemaRoomMaintenance`.
* Trạng thái phòng được tự động chuyển `ACTIVE` khi Layout được `activate()`.

### Delete Rules
* Chỉ cho phép xóa khi phòng đang `DRAFT`, chưa từng có workflow duyệt layout (Layout chưa gửi), và chưa có Seat hay Showtime.

### Seat / Layout Rules
* Layout vị trí (Row, Col) không được trùng lặp tọa độ.
* Ghế đôi (COUPLE) bắt buộc phải cấu hình chính xác 2 ghế cùng hàng và cạnh nhau (`ROOM_LAYOUT_COUPLE_GROUP_INVALID`).

### Showtime Dependency Rules
* Không cho phép kích hoạt (`activate`) layout mới đè lên layout cũ nếu phòng đang có `Showtime` tương lai. Phải xóa lịch hoặc đợi chiếu xong.

### Validation Rules
* Kích thước màn chiếu (`screenWidthM`, `screenHeightM`) không được phép lớn hơn kích thước phòng (`widthM`, `clearHeightM`).

### Permission Rules
* Duyệt layout và kích hoạt layout: Bắt buộc `ROLE_ADMIN`.

### Error Cases
* Kích thước màn hình lố phòng: `ROOM_SCREEN_EXCEEDS_ROOM_DIMENSIONS`.
* Sức chứa lố chuẩn PCCC (>= 0.8m2 / người): `ROOM_LAYOUT_EXCEEDS_ROOM_ENVELOPE`.

### Missing / Unclear
* Room type legacy (STANDARD) đang bị hard code `roomType(RoomType.STANDARD)` do constraints cũ dưới DB chưa gỡ bỏ.

### Recommended Improvements
* Gỡ bỏ các Constraint check legacy trong DB (như `chk_room_row_allocation_total`) để service code sạch hơn, tránh việc gán cứng dummy data.

## 5. Movie Business Rules

### Rules 
* Nội dung phim và Dịch thuật (Translation) / Diễn viên (Cast) được lưu tách bảng nhưng update reconcile (merge) thông minh.

### Creation Rules
* `originalTitle` không được trùng (chống spam / trùng data).

### Draft Rules
* Mọi thay đổi dữ liệu chỉ được tiến hành tự do ở trạng thái `DRAFT`. Nếu phim đang chờ duyệt, bị cấm update.

### Submit For Review Rules
* Validate bằng `movieReadinessValidator` (kiểm tra đầy đủ tag, translation, etc.) trước khi chuyển status `PENDING_REVIEW`.

### Approve Rules
* Đưa status phim sang `APPROVED` (không phải NOW_SHOWING).

### Reject Rules
* Nếu từ chối phải cung cấp lý do, chuyển sang `CHANGES_REQUESTED`.
* Để sửa lỗi, phải gọi action `startRevision` để đưa phim về lại `DRAFT`.

### Availability Rules
* Phim `APPROVED` không tự động hiển thị Public. Nó chỉ hiển thị `COMING_SOON` hoặc `NOW_SHOWING` dựa vào Availability và các suất chiếu được tạo (Showtime) tại từng rạp cụ thể.

### Update Rules
* Logic Reconcile Cast/Translations: Xóa phần tử cũ bị thiếu trong request, update phần tử tồn tại, insert phần tử mới (Tránh lỗi mất orphan deletion của Hibernate).

### Delete / Deactivate Rules
* Không có API Delete phim. Code chỉ có API đưa phim vào lưu trữ: `archiveMovie`.
* Yêu cầu: Không được archive phim nếu phim đó đang có Availability `PLANNED` hoặc `OPEN`.

### Validation Rules
* Xem bảng bên dưới.

### Permission Rules
* Approve, Reject, Archive: `ROLE_ADMIN`.

### Error Cases
* Archive khi đang chiếu: `MOVIE_HAS_ACTIVE_AVAILABILITY`.

### Missing / Unclear
* "Tagline" và "Trailer" bị ghi đè thông minh (Manual source vs TMDB source) nhưng code update TMDB chưa thấy ở trong các service này (Chắc nằm ở `TmdbService`).

### Recommended Improvements
* Đóng gói logic check phim đã có showtime vào một validator chung để tái sử dụng.

## 6. Movie State Transition Table

| Current Status | Action | Next Status | Actor / Role | Allowed? | Evidence From Code | Notes |
| -------------- | ------ | ----------- | ------------ | -------- | ------------------ | ----- |
| `DRAFT` | `/submit` | `PENDING_REVIEW` | ADMIN/EMP | YES | `MovieService.submitForReview` | Gọi Validator trước |
| `PENDING_REVIEW` | `/approve` | `APPROVED` | ADMIN | YES | `MovieService.approveMovie` | |
| `PENDING_REVIEW` | `/request-changes` | `CHANGES_REQUESTED` | ADMIN | YES | `MovieService.requestChanges` | Kèm note |
| `CHANGES_REQUESTED`| `/start-revision` | `DRAFT` | ADMIN/EMP | YES | `MovieService.startRevision` | Cho phép sửa lại |
| `APPROVED` | `/archive` | `ARCHIVED` | ADMIN | YES | `MovieService.archiveMovie` | Block nếu đang có lịch |

## 7. Validation Rules

| Entity / DTO | Field | Validation Found | Source File | Error Handling | Notes |
| ------------ | ----- | ---------------- | ----------- | -------------- | ----- |
| `Movie` | `originalTitle` | Unique | `MovieService.createMovie` | `MOVIE_ALREADY_EXISTS` | |
| `CinemaCluster`| `clusterCode` | Unique | `CinemaClusterService.create`| `CLUSTER_CODE_EXISTED` | |
| `CinemaRoom` | `dimensions` | > 0 | `CinemaRoomService.create` | `ROOM_DIMENSION_INVALID` | Check dài rộng, cao |
| `RoomLayout` | `positions` | Unique Coord | `RoomLayoutService.save` | `ROOM_LAYOUT_POSITION_DUPLICATE_COORDINATE`| |

## 8. Error Cases

| Error Case | Exception / Error Code | Where It Happens | Expected Behavior | Notes |
| ---------- | ---------------------- | ---------------- | ----------------- | ----- |
| Delete cluster có room | `CLUSTER_HAS_ROOMS` | `CinemaClusterService.delete` | HTTP 400 | Bảo vệ dữ liệu |
| Activate layout có vé | `ROOM_LAYOUT_HAS_FUTURE_SHOWTIMES`| `RoomLayoutService.activate` | HTTP 400 | Cấm đè layout phòng |
| Edit movie đang duyệt | `MOVIE_NOT_EDITABLE` | `MovieService.updateMovie` | HTTP 400 | Phải ở DRAFT |

## 9. Production Gaps

* **Missing soft delete**: Chưa áp dụng soft delete (`deleted_at`) cho `CinemaCluster` nháp và `CinemaRoom` nháp (đang dùng `delete()` thẳng của Repository).
* **Missing dependency check before delete/deactivate**: Dù đã cấm xóa rạp có phòng chiếu, nhưng logic báo rạp `INACTIVE` chưa check cấm lên lịch chiếu mới cho các phòng thuộc rạp này (Cần check showtime module).
* **Legacy Constraints Leak**: `CinemaRoomService` vẫn gán dummy (1-0-0) cho `standardRowCount`, `vipRowCount`, `coupleRowCount` vì Constraint DB chưa chịu gỡ bỏ ở Wizard mode.
