# FEATURE_BRIEF.md

## 1. Source Code Reviewed

* `server/movie-service/src/main/java/movieservice/service/MovieService.java`
* `server/movie-service/src/main/java/movieservice/service/CinemaClusterService.java`
* `server/movie-service/src/main/java/movieservice/service/CinemaRoomService.java`
* `server/movie-service/src/main/java/movieservice/service/RoomLayoutService.java`

## 2. Assumptions / Missing Information

* The exact endpoints (Controller layer) are assumed to map 1-1 with the Service layer methods (e.g., `submitCluster`, `approveCluster`).
* Movie Availability Service was not fully reviewed in this scan, but its existence is proven by `movieAvailabilityRepository` usage in `CinemaClusterService` and `MovieService`.

## 3. Cinema Cluster Management

### Purpose 
Quản lý các cụm rạp vật lý (Cinema Cluster), bao gồm thông tin địa lý, timezone và lịch hoạt động (Operating Hours). Đóng vai trò là root entity cho các phòng chiếu (Cinema Room) và phân bổ lịch chiếu (Movie Availability).

### Actors / Roles 
* **ROLE_ADMIN**: Quyền cao nhất, được phép trực tiếp tạo rạp ở trạng thái ACTIVE, duyệt/từ chối rạp (Approve/Reject), và xóa nháp.
* **ROLE_EMPLOYEE**: Quyền tạo nháp (DRAFT) và nộp lên chờ duyệt (Submit).
* **AUTHENTICATED_USER / PUBLIC**: Chỉ có thể lấy thông tin (View).

### Current Flow 
1. **Create**: Nếu là ADMIN tạo, rạp có thể được duyệt ngay. Nếu là EMPLOYEE tạo, rạp ở trạng thái `DRAFT`.
2. **Submit**: Chuyển từ `DRAFT` sang `PENDING_REVIEW`.
3. **Approve/Reject**: Admin duyệt (`ACTIVE`) hoặc từ chối trả về (`DRAFT` kèm `rejectionNote`).
4. **Deactivate**: Admin có thể toggle rạp giữa `ACTIVE` và `INACTIVE`.
5. **Delete**: Chỉ cho phép xóa rạp `DRAFT` chưa từng đưa vào sử dụng và chưa có phòng chiếu/availability.

### Main Entity Fields
* `clusterCode` (Unique)
* `clusterName` (Unique)
* `venueType`, `openingDate`, `countryCode`, `province`, `address`, `timezone`
* `operatingHours` (Collection các ngày trong tuần)

### Status / Lifecycle 
* `ClusterStatus`: `DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `INACTIVE`

### Relationships 
* 1 Cluster có nhiều `CinemaRoom`
* 1 Cluster có nhiều `MovieAvailability`

### Missing / Unclear
* API để cập nhật nhanh 1 field (PATCH) không thấy trong code, chỉ có `updateCluster` (PUT) update toàn bộ.

### Recommended Improvements
* Không thấy đề cập đến việc tự động hủy vé hoặc cảnh báo khi cụm rạp bị chuyển sang `INACTIVE`. Nên bổ sung logic check vé tương lai trước khi deactivate.

## 4. Cinema Room Management

### Purpose 
Quản lý phòng chiếu thuộc một cụm rạp, bao gồm kích thước vật lý (chiều dài, rộng, cao), công nghệ chiếu (2D, 3D, IMAX) và sơ đồ ghế (Layout).

### Actors / Roles 
* **ROLE_ADMIN / ROLE_EMPLOYEE (Staff)**: Được tạo phòng (Wizard mode), cấu hình layout, duyệt layout.
* **PUBLIC**: Chỉ xem được các phòng ở trạng thái `ACTIVE` (không xem được `DRAFT` hay `PENDING_APPROVAL`).

### Current Flow 
1. **Wizard Creation**: `createCinemaRoom` sẽ tạo ra một phòng chiếu ở trạng thái `DRAFT` (kèm theo 1 RoomLayout `DRAFT` sinh tự động qua `RoomLayoutService.createInitialDraft`).
2. **Layout Design**: User gọi `saveLayout` để cấu hình ghế vật lý trên layout.
3. **Layout Submit & Approve**: Submit -> `PENDING_APPROVAL` -> Approve -> `APPROVED`. Quá trình này sẽ đồng bộ đổi status của Cinema Room tương ứng.
4. **Activate Layout**: Khi layout được `activate`, backend tự động sinh records vào bảng `Seat` (syncSeatsFromLayout), và phòng chiếu trở thành `ACTIVE`.
5. **Maintenance**: Khi có sự cố, tạo `MaintenanceRequest`, phòng chuyển thành `TEMPORARILY_UNAVAILABLE`. Khi `resolveMaintenance`, phòng tự về lại `ACTIVE`.

### Main Entity Fields
* `roomCode`, `cinemaRoomName`
* `lengthM`, `widthM`, `clearHeightM`, `screenWidthM`, `screenHeightM`
* `auditoriumClass`, `projectionTechnology`, `resolution`, `audioFormat`
* `supports2d`, `supports3d`

### Status / Lifecycle 
* **CinemaRoomStatus**: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `ACTIVE`, `TEMPORARILY_UNAVAILABLE`
* **LayoutStatus**: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `ACTIVE`, `SUPERSEDED`

### Relationships 
* Thuộc về `CinemaCluster`
* Có nhiều `RoomLayout`
* Có nhiều `Seat`
* Có nhiều `ShowTime` (Lịch chiếu)

### Missing / Unclear
* Code có nhắc đến column legacy (như `standardRowCount`, `vipRowCount`) vẫn phải dummy data vì DB schema chưa gỡ constraint. 

### Recommended Improvements
* Migrate database schema (V13/V14 constraints) để loại bỏ hoàn toàn các cột legacy của Cinema Room, tránh rác code bằng dummy data.

## 5. Movie Management

### Purpose 
Quản lý danh mục phim, kiểm duyệt metadata (thông tin phim, ảnh, dịch thuật, dàn cast) và hiển thị cho người dùng cuối (Public Catalog).

### Actors / Roles 
* **ROLE_ADMIN**: Quyền duyệt phim (Approve), Yêu cầu sửa đổi (Request Changes), Lưu trữ (Archive).
* **System/Employee**: Cập nhật thông tin gốc, dịch thuật.

### Current Flow 
1. **Create**: Khởi tạo phim với trạng thái `DRAFT`.
2. **Update**: Có cơ chế Reconcile (Merge data) cho Cast và Translations để update tại chỗ thay vì xóa toàn bộ.
3. **Review**: `submitForReview` (DRAFT -> PENDING_REVIEW).
4. **Approve / Reject**: Admin duyệt (`APPROVED`) hoặc yêu cầu sửa đổi (`CHANGES_REQUESTED` + note). 
5. **Archive**: Đưa phim vào kho lưu trữ (`ARCHIVED`) sau khi chiếu xong.

### Main Entity Fields
* `originalTitle`, `durationMinutes`, `releaseDate`
* `posterUrl`, `trailerUrl`, `tagline`
* Quan hệ: `genres`, `formats`, `translations`, `cast`, `companies`

### Status / Lifecycle
* **MovieStatus**: `DRAFT`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `ARCHIVED`
* **Display Status (Dynamic)**: Trạng thái hiển thị ra ngoài Public (`NOW_SHOWING` hoặc `COMING_SOON`) không phải là column trong DB, mà được *tính toán động* dựa vào `MovieAvailability` và `ShowTime`.

### Review Flow 
* Gọi `movieReadinessValidator` trước khi chuyển sang `PENDING_REVIEW` hoặc `APPROVED` để đảm bảo đã điền đủ thông tin (ảnh, translation, format).
* Phim bị yêu cầu sửa đổi phải qua bước `startRevision` để về lại `DRAFT`.

### Availability Flow 
* Phim chỉ xuất hiện ở `PublicMovieResponse` nếu status = `APPROVED` VÀ có `MovieAvailability` (PLANNED hoặc OPEN) tại Cụm rạp tương ứng VÀ chưa qua ngày `showingEndDate`.

### Missing / Unclear
* Code chứa `setTrailerSource("MANUAL")` ngụ ý có module TMDB tự động đồng bộ (sync), nhưng module này nằm ở class khác (TmdbService).

### Recommended Improvements
* Bổ sung cơ chế soft-delete cho phim DRAFT (hiện tại chưa thấy hàm Delete movie trong `MovieService`).

## 6. High-level Flow 
1. Khởi tạo Master Data: Cluster -> Cần cấu hình `OperatingHours`.
2. Xây dựng phòng: Cluster ACTIVE -> Tạo Room DRAFT -> Layout DRAFT -> Layout ACTIVE -> Room ACTIVE -> Sinh ra các dòng Seat vật lý.
3. Quản lý phim: Tạo Movie DRAFT -> Cấu hình Cast, Translation -> Submit -> Approve.
4. Lên lịch: Cần có `MovieAvailability` OPEN tại cụm rạp để tính ra trạng thái `NOW_SHOWING` cho khách hàng. Mọi tính toán hiển thị Public phụ thuộc hoàn toàn vào Availability và ShowTime tương lai.
