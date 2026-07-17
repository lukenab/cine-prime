
## Bối cảnh làm việc

Bạn đang làm việc trong repository CinePrime tại:

```text
D:\OJTProject\Movie_Theater\hcm26_cpl_java_05_group1
```

## Vai trò

Hãy đóng vai **Senior Full-stack Engineer kiêm Solution Architect**, triển khai hoàn chỉnh luồng tạo và quản lý **Cinema Room** theo hướng production-oriented, nhưng giữ phạm vi phù hợp Sprint hiện tại.

Nhiệm vụ bao gồm:

- Database migration.
- Backend API.
- Validation và business rules.
- Frontend wizard tạo phòng.
- Seat layout editor.
- Layout versioning.
- Automated tests.
- API documentation và dữ liệu kiểm thử thủ công.

Không chỉ phân tích hoặc viết hướng dẫn. Hãy trực tiếp sửa code, chạy test và hoàn thiện implementation.

---

## 1. Yêu cầu trước khi implementation

Trước khi sửa code:

1. Đọc toàn bộ tài liệu liên quan:
   - `README.md`.
   - `CONTRIBUTING.md`.
   - `AGENTS.md` nếu có.
   - Các file trong `/docs` liên quan đến movie-service, cinema room, cinema cluster, seat và showtime.
   - API contract hiện tại.
   - Database migrations/schema hiện tại.

2. Kiểm tra kiến trúc repository:
   - Backend framework và conventions.
   - Frontend framework, component library, form library và state management.
   - Cách gọi API qua API Gateway.
   - Authentication/authorization hiện hữu.
   - Error response convention.
   - Audit fields.
   - Các entity hiện hữu: `CinemaCluster`, `CinemaRoom`, `Seat`, `Showtime`, `ShowtimeSeat`.
   - Quan hệ giữa `Seat` và `ShowtimeSeat`.
   - API Cinema Room hiện tại.

3. Tìm và reuse implementation hiện hữu. Không tạo:
   - Entity trùng chức năng.
   - API trùng endpoint.
   - Enum hoặc master table trùng dữ liệu.
   - Component UI trùng component dùng chung.

4. Viết implementation plan ngắn, sau đó tiếp tục thực hiện mà không chờ xác nhận, trừ khi gặp blocker có thể làm thay đổi business scope nghiêm trọng.

5. Bảo toàn dữ liệu hiện hữu:
   - Chỉ dùng versioned migration.
   - Ưu tiên additive migration.
   - Không drop table hoặc column đang được sử dụng.
   - Không xóa rồi sinh lại toàn bộ Seat khi cập nhật phòng.
   - Không dùng migration phá hủy dữ liệu.

6. Không sửa hoặc format hàng loạt những module không liên quan.

---

## 2. Business objective

Xây dựng luồng tạo Cinema Room theo các nguyên tắc:

- `roomType` không được tự động hard-code tỷ lệ Standard/VIP/Couple.
- Số hàng và số vị trí mỗi hàng chỉ dùng để tạo layout ban đầu.
- Người dùng chỉnh layout trực quan.
- Tổng sức chứa được derive từ layout, không nhập trực tiếp.
- Công nghệ trình chiếu, độ phân giải, âm thanh và phân hạng phòng là các dimension độc lập.
- Layout đã được duyệt không được chỉnh sửa trực tiếp.
- Thay đổi layout đã duyệt phải tạo version mới.
- Couple seats phải được xử lý theo nhóm atomic.
- Không phá vỡ các showtime hoặc showtime-seat hiện hữu.
- Database/backend là source of truth đối với capacity, version và status.

---

## 3. Luồng frontend

Triển khai form tạo phòng theo **wizard bốn bước**.

### Bước 1 — Thông tin phòng

Các trường bắt buộc:

- Cụm rạp.
- Mã phòng.
- Tên phòng.
- Phân hạng phòng.
- Chiều dài phòng.
- Chiều rộng phòng.
- Chiều cao thông thủy.

Yêu cầu UI:

- Cụm rạp là searchable dropdown.
- Mã phòng tự trim và chuyển uppercase.
- Numeric fields có đơn vị mét.
- Hiển thị diện tích dự kiến và tự tính:

```text
diện tích = chiều dài × chiều rộng
```

- Không cho người dùng chỉnh sửa diện tích đã tính.
- Có các hành động:
  - Hủy.
  - Lưu bản nháp.
  - Tiếp tục.

### Bước 2 — Cấu hình kỹ thuật

Các trường:

- Công nghệ trình chiếu.
- Độ phân giải.
- Chiều rộng màn hình.
- Chiều cao màn hình.
- Định dạng âm thanh.
- Hỗ trợ 2D.
- Hỗ trợ 3D.

Hiển thị tự động tỷ lệ màn hình:

```text
screenAspectRatio = screenWidth / screenHeight
```

Có thể hiển thị gợi ý:

- Gần `1.85` → Flat.
- Gần `2.39` → Scope.
- Không khớp → warning, không hard-block nếu không có business rule chính thức.

### Bước 3 — Thiết kế sơ đồ ghế

Thông tin tạo layout ban đầu:

- Số hàng dự kiến.
- Số vị trí tối đa mỗi hàng.
- Nhãn hàng bắt đầu.
- Hướng đánh số:
  - Trái sang phải.
  - Phải sang trái.

Sau khi chọn, người dùng nhấn **Tạo sơ đồ**.

Layout editor tối thiểu phải hỗ trợ:

- Standard seat.
- VIP seat.
- Couple seat.
- Wheelchair space nếu model hiện tại cho phép.
- Aisle — lối đi.
- Empty space — vùng trống.
- Exit — lối thoát.
- Xóa vị trí.
- Chọn một ô.
- Chọn nhiều ô.
- Chọn cả hàng.
- Undo/Redo nếu kiến trúc frontend hiện tại hỗ trợ hợp lý.
- Xem preview seat map.

Hiển thị màn hình ở phía trên layout.

Hỗ trợ row label vượt quá `Z`:

```text
A ... Z, AA, AB ... AZ, BA ...
```

Không giới hạn hệ thống ở 26 hàng.

Couple seat:

- Phải gồm đúng hai vị trí liền kề.
- Hai vị trí phải cùng hàng.
- Hai vị trí có chung `seatGroupId`.
- Không được tạo một ghế Couple đơn lẻ.
- Booking/locking phải có khả năng nhận diện group.
- Không phá vỡ model Couple/Sofa hiện có nếu repository đã triển khai.

Hiển thị thống kê trực tiếp:

- Số Standard seats.
- Số VIP seats.
- Số Couple groups.
- Sức chứa Couple theo người.
- Số wheelchair spaces.
- Tổng sức chứa theo người.
- Tổng số sellable units.

Không có trường nhập trực tiếp `seatQuantity`.

### Bước 4 — Review và gửi duyệt

Hiển thị:

- Cụm rạp, mã phòng và tên phòng.
- Phân hạng phòng.
- Kích thước vật lý.
- Công nghệ trình chiếu và độ phân giải.
- Kích thước màn hình.
- Âm thanh.
- Số hàng.
- Tổng sức chứa.
- Phân bổ loại ghế.
- Phiên bản layout.
- Validation summary.
- Preview seat layout.

Các hành động:

- Quay lại.
- Lưu bản nháp.
- Gửi phê duyệt.

Không hiển thị dropdown cho phép người dùng tùy ý chọn trạng thái.

---

## 4. State machine

Room status tối thiểu:

```text
DRAFT
PENDING_APPROVAL
APPROVED
ACTIVE
MAINTENANCE
SUSPENDED
RETIRED
```

Layout status tối thiểu:

```text
DRAFT
PENDING_APPROVAL
APPROVED
ACTIVE
REJECTED
SUPERSEDED
```

Transition:

```text
DRAFT
  → PENDING_APPROVAL

PENDING_APPROVAL
  → APPROVED
  → REJECTED hoặc quay lại DRAFT kèm lý do

APPROVED
  → ACTIVE

ACTIVE
  → MAINTENANCE
  → SUSPENDED
  → RETIRED
```

Phải validate transition ở backend, không chỉ ẩn nút ở frontend.

Reuse authorization matrix hiện hữu. Không làm yếu security hiện tại. Nếu project đã quy định EMPLOYEE submit và ADMIN approve thì tiếp tục áp dụng đúng quy định đó.

---

## 5. Enum và master data

Chỉ dùng enum cho dữ liệu ổn định gắn với logic:

```text
RoomStatus
LayoutStatus
LayoutPositionType
SeatStatus
AccessibilityType
NumberingDirection
```

Trong JPA bắt buộc lưu enum bằng tên:

```java
@Enumerated(EnumType.STRING)
```

Không sử dụng `EnumType.ORDINAL`.

Các dữ liệu configurable phải dùng master data hoặc reuse lookup table hiện hữu:

- Phân hạng phòng.
- Loại ghế.
- Công nghệ trình chiếu.
- Độ phân giải.
- Định dạng âm thanh.

Nếu chưa có master data, tạo migration và seed tối thiểu:

```text
Auditorium class:
- STANDARD
- PREMIUM
- LUXURY
- PRIVATE

Projection technology:
- XENON
- LASER
- DIRECT_VIEW_LED

Resolution:
- 2K
- 4K

Audio format:
- DOLBY_5_1
- DOLBY_7_1
- DOLBY_ATMOS

Seat type:
- STANDARD
- VIP
- COUPLE
```

Không hard-code danh sách dropdown riêng ở frontend. Frontend phải lấy từ API master data hoặc config source chính thức của backend.

---

## 6. Data model đề xuất

Điều chỉnh theo schema hiện hữu. Không tạo duplicate nếu đã có trường hoặc table tương đương.

### Cinema room

Tối thiểu cần có:

```text
id
cinema_cluster_id
room_code
room_name
auditorium_class_id

length_m
width_m
clear_height_m

projection_technology_id
resolution_id
screen_width_m
screen_height_m
supports_2d
supports_3d
audio_format_id

status

created_at
created_by
updated_at
updated_by
```

Constraints:

```text
UNIQUE(cinema_cluster_id, room_code)
UNIQUE(cinema_cluster_id, room_name)
```

Không dùng unique toàn hệ thống cho `roomName`, vì nhiều cụm rạp có thể cùng có `Phòng 01`.

### Room layout

```text
id
cinema_room_id
version
status

number_of_rows
max_positions_per_row
first_row_label
numbering_direction

person_capacity
sellable_unit_count

submitted_at
submitted_by
approved_at
approved_by
rejection_reason

created_at
created_by
updated_at
updated_by
```

Constraint:

```text
UNIQUE(cinema_room_id, version)
```

Chỉ được có một active layout cho mỗi room.

### Layout position/Seat

Ưu tiên tích hợp với entity `Seat` hiện hữu nếu phù hợp. Không tạo hai nguồn dữ liệu ghế cạnh tranh nhau.

Dữ liệu cần biểu diễn được:

```text
layout_id
row_index
column_index
row_label
seat_number
position_type
seat_type_id
seat_group_id
accessibility_type
seat_status
```

`seat_number`, `seat_type_id` và `seat_group_id` có thể null đối với AISLE, EXIT hoặc EMPTY_SPACE.

Constraints:

- Unique coordinate trong cùng layout.
- Seat code duy nhất trong cùng layout.
- Couple group hợp lệ.
- Không tạo Seat business entity cho AISLE hoặc EMPTY_SPACE nếu model hiện hữu tách Seat khỏi layout cell.
- Giữ stable identity cho Seat đang được `ShowtimeSeat` tham chiếu.

---

## 7. Layout versioning

Business rules:

- Tạo phòng lần đầu → layout version 1.
- Chỉnh sửa khi layout vẫn DRAFT → không tăng version.
- Layout APPROVED hoặc ACTIVE không được sửa trực tiếp.
- Muốn thay đổi → clone thành DRAFT version tiếp theo.
- Version cũ được giữ để audit.
- Khi version mới được activate, version cũ chuyển `SUPERSEDED` nếu phù hợp.
- Không xóa Seat/Layout đã được Showtime hoặc Booking tham chiếu.
- Kiểm tra impact với future showtime trước khi activate layout mới.
- Reuse logic/service hiện tại nếu Showtime nằm trong cùng movie-service.

Nếu schema hiện tại chưa đủ để migrate an toàn, dùng additive migration và viết compatibility mapping thay vì xóa dữ liệu.

---

## 8. Backend API

Ưu tiên mở rộng endpoint hiện hữu. Chỉ đổi đường dẫn nếu API convention trong repository yêu cầu.

Các use case cần có:

```http
GET /api/cinema-room-master-data

POST /api/cinema-rooms
GET /api/cinema-rooms/{roomId}
PUT hoặc PATCH /api/cinema-rooms/{roomId}

GET /api/cinema-rooms/{roomId}/layouts
GET /api/cinema-rooms/{roomId}/layouts/{layoutId}
PUT /api/cinema-rooms/{roomId}/layouts/{layoutId}

POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/submit
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/approve
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/reject
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/activate
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/clone
```

Nếu project đã có API tương đương, reuse và chuẩn hóa thay vì tạo API song song.

Mọi mutation phải:

- Có transaction boundary phù hợp.
- Validate trạng thái ở backend.
- Trả stable domain error.
- Không throw raw `RuntimeException`.
- Tuân thủ error response convention hiện hữu.
- Có authorization.
- Có audit actor từ authenticated principal.

---

## 9. Validation bắt buộc

### Room validation

- Cluster phải tồn tại và được phép thêm phòng.
- `roomCode` không rỗng, được trim và chuyển uppercase.
- `roomCode` duy nhất trong cluster.
- `roomName` duy nhất trong cluster.
- Chiều dài, chiều rộng và chiều cao phải lớn hơn 0.
- Kích thước màn hình phải lớn hơn 0.
- Screen width không vượt quá room width.
- Screen height không vượt quá clear height.
- Các master data ID/code phải tồn tại và đang active.
- Không nhận free text thay cho master data ID/code.

Không tự tạo các giới hạn pháp lý giả như:

```text
STANDARD tối đa 100 ghế
IMAX tối đa 300 ghế
```

Nếu cần technical guardrail chống payload quá lớn, đặt thành application configuration, không hard-code thành business rule.

### Layout validation

- Không nhận danh sách vị trí trống khi submit.
- Không có coordinate trùng.
- Không có seat code trùng.
- AISLE/EXIT/EMPTY_SPACE không có seat type.
- SEAT phải có seat type và seat number.
- Couple group gồm đúng hai vị trí.
- Couple seats cùng hàng và liền kề.
- Không có một nửa Couple bị thiếu.
- Capacity được backend tính lại, không tin số frontend gửi lên.
- Person capacity và sellable unit count được tính riêng.
- Không cho submit layout còn lỗi.
- Không cho sửa layout APPROVED hoặc ACTIVE.

---

## 10. Capacity calculation

Backend là source of truth.

Ví dụ:

```text
STANDARD = 1 person, 1 sellable unit
VIP      = 1 person, 1 sellable unit
COUPLE   = 2 persons, 1 sellable unit cho mỗi group
```

Không double-count hai position thuộc cùng một Couple group.

Các giá trị sau phải read-only với frontend:

```text
personCapacity
sellableUnitCount
layoutVersion
roomStatus
layoutStatus
```

---

## 11. Frontend requirements

- Dùng component library và design system hiện tại.
- Không thêm UI framework mới nếu không cần thiết.
- Form validation phải hiển thị cạnh field.
- Phân biệt rõ:
  - Loading.
  - Empty state.
  - API error.
  - Validation error.
- Không hiển thị `No rooms` nếu API thực sự bị lỗi.
- Lưu được draft và tiếp tục chỉnh sửa.
- Reload trang không làm mất draft đã lưu ở backend.
- Không hard-code master data dropdown.
- Hiển thị toast/modal theo shared component hiện hữu.
- Bảo đảm responsive ở độ phân giải laptop phổ biến.
- Route tạo phòng nên nằm dưới Cinema Cluster detail nếu routing hiện tại hỗ trợ:

```text
/cinema-clusters/{clusterId}/rooms/new
```

- Sau khi tạo thành công, chuyển về room detail hoặc cluster detail theo pattern hiện tại.

---

## 12. Testing

### Backend unit tests

Bao phủ:

- Unique room code theo cluster.
- Unique room name theo cluster.
- Kích thước không hợp lệ.
- Screen lớn hơn room.
- Master data không tồn tại hoặc inactive.
- Sinh row label qua `Z`: `AA`, `AB`.
- Numbering trái sang phải và phải sang trái.
- Duplicate coordinate.
- Duplicate seat code.
- Couple hợp lệ.
- Couple chỉ có một vị trí.
- Couple không liền kề.
- Capacity calculation.
- State transition hợp lệ và không hợp lệ.
- Không cho sửa approved/active layout.
- Clone layout tạo version tiếp theo.

### Integration tests

Bao phủ:

- Tạo draft room.
- Save layout.
- Submit.
- Approve.
- Activate.
- Reject có lý do.
- Authorization.
- Transaction rollback nếu lưu layout lỗi.
- Không làm mất Seat/ShowtimeSeat hiện hữu.
- Migration chạy được trên database test.

### Frontend tests

Theo testing stack hiện hữu:

- Wizard navigation.
- Required field validation.
- Save draft.
- Generate grid.
- Chọn loại vị trí.
- Couple grouping.
- Capacity summary.
- Review screen.
- API error khác empty state.
- Submit flow.

Chạy toàn bộ test liên quan và sửa lỗi phát sinh. Không bỏ qua test chỉ để build xanh.

---

## 13. Documentation

Cập nhật hoặc tạo tài liệu phù hợp trong `/docs`:

```text
docs/CINEMA_ROOM_CREATION_FLOW.md
docs/CINEMA_ROOM_BUSINESS_RULES.md
docs/movie-service_API_CONTRACT.md
```

Tài liệu phải bao gồm:

- State machine.
- Database model.
- API contract.
- Request/response JSON.
- Validation errors.
- Layout versioning.
- Capacity semantics.
- Couple seat semantics.
- Hướng dẫn test thủ công bằng Postman.

Cung cấp JSON test cho tối thiểu:

- Tạo room hợp lệ.
- Trùng mã phòng.
- Kích thước âm hoặc bằng 0.
- Màn hình lớn hơn phòng.
- Layout Standard/VIP/Couple hợp lệ.
- Duplicate coordinate.
- Couple bị thiếu một vị trí.
- Submit layout.
- Approve.
- Reject.
- Activate.

---

## 14. Out of scope

Không triển khai trong task này:

- CAD/BIM.
- Evacuation simulation.
- Tự động chứng nhận PCCC.
- Tính sightline vật lý nâng cao.
- Tính toán acoustic engineering.
- Tự động chọn projector/lens.
- Kết nối hệ thống IMAX/4DX thật.
- Hard-code tỷ lệ loại ghế theo room class.
- Booking/payment flow mới ngoài việc giữ compatibility.

---

## 15. Definition of Done

Chỉ coi task hoàn thành khi:

- Migration chạy thành công.
- Backend compile.
- Frontend compile.
- Tests liên quan pass.
- Tạo room draft thành công.
- Layout grid được lưu thành công.
- Layout có thể biểu diễn aisle và empty space.
- Couple seats được validate theo group.
- Capacity được backend tự tính.
- Submit/approve/activate tuân thủ state machine.
- Approved layout không sửa trực tiếp được.
- Version mới được tạo đúng.
- Danh sách Cinema Room hiển thị đúng sau khi tạo.
- API error không bị hiển thị thành empty state.
- Không phá vỡ Showtime/ShowtimeSeat hiện hữu.
- API contract và Postman JSON được cập nhật.

---

## 16. Cách báo cáo kết quả

Sau khi hoàn thành, trả về:

1. Tóm tắt kiến trúc đã triển khai.
2. Danh sách file đã thay đổi.
3. Migration đã thêm.
4. API đã thêm hoặc thay đổi.
5. Business rules đã enforce.
6. Tests đã chạy và kết quả cụ thể.
7. Hướng dẫn chạy backend/frontend.
8. Hướng dẫn test luồng hoàn chỉnh.
9. Những assumption đã đưa ra.
10. Những giới hạn còn lại, nếu có.

Không tuyên bố hoàn thành nếu chưa chạy test. Không sửa những module không liên quan nếu không thật sự cần thiết.
