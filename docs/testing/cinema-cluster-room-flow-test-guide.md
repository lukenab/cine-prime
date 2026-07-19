# Cinema Cluster & Cinema Room Flow — Manual Test Guide

## 1. Mục tiêu

Tài liệu này hướng dẫn kiểm thử thủ công bằng Postman và giao diện cho các luồng:

- Tạo, cập nhật và duyệt Cinema Cluster.
- Kiểm tra phân quyền và state transition của Cinema Cluster.
- Tạo Cinema Room trong một cluster đã `ACTIVE`.
- Lưu, submit, approve và activate seat layout.
- Hard delete cluster/room draft chưa được sử dụng.
- Kiểm tra các trường hợp phải chặn xóa và audit tombstone.

> Chỉ sử dụng dữ liệu test. Không chạy các request `DELETE` trên dữ liệu dùng cho demo hoặc dữ liệu production.

---

## 2. Điều kiện tiên quyết

### Dịch vụ cần chạy

Từ thư mục repository:

```powershell
cd D:\OJTProject\Movie_Theater\hcm26_cpl_java_05_group1
docker compose up -d --build
```

Các địa chỉ mặc định:

| Thành phần | Địa chỉ |
|---|---|
| Frontend | `http://localhost:3000` |
| API Gateway | `http://localhost:8080` |
| Movie Service trực tiếp | `http://localhost:8081` |
| PostgreSQL | `localhost:5433` |
| Database | `movie_db` |

Khuyến nghị test qua API Gateway tại port `8080`.

### Postman Environment

Tạo các biến:

| Variable | Giá trị |
|---|---|
| `baseUrl` | `http://localhost:8080` |
| `adminToken` | JWT của ADMIN |
| `employeeToken` | JWT của EMPLOYEE thứ nhất |
| `otherEmployeeToken` | JWT của EMPLOYEE thứ hai |
| `clusterId` | Được gán sau khi tạo cluster |
| `activeClusterId` | Cluster đã được approve |
| `roomId` | Được gán sau khi tạo room |
| `layoutId` | Được gán sau khi lấy layout |

Headers dùng chung:

```text
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

### Kiểm tra Flyway migration

Migration `V4__preserve_cluster_delete_audit_tombstones.sql` phải được áp dụng:

```powershell
docker exec postgres psql -U postgres -d movie_db -c "SELECT version, description, success FROM flyway_schema_history WHERE version = '4';"
```

Kết quả mong đợi:

```text
version = 4
success = true
```

Nếu chưa có, restart `movie-service` rồi kiểm tra lại:

```powershell
docker compose restart movie-service
```

---

## 3. Quy ước đánh giá kết quả

- Các API dùng `ApiResponse` có thể trả HTTP `200`, trong khi business code nằm trong trường `code`.
- Endpoint hard delete trả HTTP `204 No Content` và không có response body.
- Với response lỗi, kiểm tra đồng thời HTTP status, `code`, `message` và việc dữ liệu không bị thay đổi ngoài ý muốn.
- Mỗi lần test phải dùng `clusterCode`, `clusterName`, `roomCode` và `cinemaRoomName` khác nhau.

---

# PHẦN A — CINEMA CLUSTER

## 4. CL-01 — Tạo Cinema Cluster DRAFT

### Request

```http
POST {{baseUrl}}/api/cinema-clusters
Authorization: Bearer {{employeeToken}}
Content-Type: application/json
```

```json
{
  "clusterCode": "QA-CLUSTER-01",
  "clusterName": "CinePrime QA Cluster 01",
  "venueType": "MALL",
  "openingDate": "2026-08-01",
  "countryCode": "VN",
  "province": "TP. Hồ Chí Minh",
  "ward": "Phường Bến Nghé",
  "postalCode": "700000",
  "buildingName": "QA Test Mall",
  "floorLocation": "Level 5",
  "address": "123 Đường Nguyễn Huệ, TP. Hồ Chí Minh",
  "latitude": 10.7769,
  "longitude": 106.7009,
  "timezone": "Asia/Ho_Chi_Minh",
  "operatingHours": [
    {
      "dayOfWeek": "MONDAY",
      "opensAt": "08:00:00",
      "closesAt": "23:00:00",
      "closesNextDay": false,
      "closed": false
    },
    {
      "dayOfWeek": "TUESDAY",
      "opensAt": "08:00:00",
      "closesAt": "23:00:00",
      "closesNextDay": false,
      "closed": false
    },
    {
      "dayOfWeek": "WEDNESDAY",
      "opensAt": "08:00:00",
      "closesAt": "23:00:00",
      "closesNextDay": false,
      "closed": false
    },
    {
      "dayOfWeek": "THURSDAY",
      "opensAt": "08:00:00",
      "closesAt": "23:00:00",
      "closesNextDay": false,
      "closed": false
    },
    {
      "dayOfWeek": "FRIDAY",
      "opensAt": "08:00:00",
      "closesAt": "23:59:00",
      "closesNextDay": false,
      "closed": false
    },
    {
      "dayOfWeek": "SATURDAY",
      "opensAt": "08:00:00",
      "closesAt": "23:59:00",
      "closesNextDay": false,
      "closed": false
    },
    {
      "dayOfWeek": "SUNDAY",
      "opensAt": "08:00:00",
      "closesAt": "23:00:00",
      "closesNextDay": false,
      "closed": false
    }
  ]
}
```

### Kết quả mong đợi

- HTTP `200` và response body có `code = 201`.
- `result.status = "DRAFT"`.
- `result.clusterCode = "QA-CLUSTER-01"`.
- `createdBy` phản ánh actor đã đăng nhập.
- Lưu `result.clusterId` vào biến `clusterId`.

---

## 5. CL-02 — Kiểm tra validation khi tạo cluster

Chạy riêng từng trường hợp sau:

| Case | Dữ liệu không hợp lệ | Kết quả mong đợi |
|---|---|---|
| CL-02.1 | Bỏ `clusterCode` | HTTP `400`, validation error |
| CL-02.2 | `clusterCode = "qa cluster"` | HTTP `400`; chỉ chấp nhận chữ hoa, số và dấu `-` |
| CL-02.3 | Bỏ `clusterName` | HTTP `400` |
| CL-02.4 | `venueType = "UNKNOWN"` | HTTP `400` |
| CL-02.5 | `countryCode = "VNM"` | HTTP `400`; yêu cầu ISO alpha-2 |
| CL-02.6 | `address` ngắn hơn 10 ký tự | HTTP `400` |
| CL-02.7 | Chỉ gửi 6 ngày vận hành | HTTP `400` |
| CL-02.8 | Trùng `dayOfWeek` | Request bị từ chối |
| CL-02.9 | Ngày mở cửa không có `opensAt` | HTTP `400` |
| CL-02.10 | Ngày đóng cửa nhưng vẫn gửi giờ | HTTP `400` |
| CL-02.11 | `latitude = 100` | HTTP `400` |
| CL-02.12 | Trùng `clusterCode` hoặc tên unique | HTTP `409` hoặc business error tương ứng |

Các giá trị hợp lệ của `venueType`:

```text
MALL
STANDALONE
MIXED_USE
```

---

## 6. CL-03 — Cập nhật cluster khi còn DRAFT

```http
PUT {{baseUrl}}/api/cinema-clusters/{{clusterId}}
Authorization: Bearer {{employeeToken}}
Content-Type: application/json
```

Dùng lại **toàn bộ body CL-01**, giữ `clusterCode = "QA-CLUSTER-01"` và đổi
`clusterName` thành `"CinePrime QA Cluster 01 Updated"`.

> Endpoint update hiện nhận full `CinemaClusterRequest`; phải gửi lại toàn bộ các trường bắt buộc và đủ 7 ngày vận hành.

Kết quả mong đợi:

- HTTP `200`, body `code = 200`.
- Cluster vẫn ở `DRAFT`.
- Dữ liệu mới được trả về và persisted.

---

## 7. CL-04 — Submit cluster để review

```http
POST {{baseUrl}}/api/cinema-clusters/{{clusterId}}/submit
Authorization: Bearer {{employeeToken}}
```

Kết quả mong đợi:

- HTTP `200`.
- `result.status = "PENDING_REVIEW"`.
- Audit log có transition `DRAFT → PENDING_REVIEW`.

Test thêm:

- Submit lần hai phải bị từ chối.
- Người không phải creator và không phải ADMIN phải bị từ chối.

---

## 8. CL-05A — Reject cluster

```http
POST {{baseUrl}}/api/cinema-clusters/{{clusterId}}/reject
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "note": "Thiếu hồ sơ vận hành và thông tin địa chỉ cần xác minh."
}
```

Kết quả mong đợi:

- HTTP `200`.
- Cluster trở về `DRAFT`.
- Rejection note không rỗng và được lưu trong audit history.
- EMPLOYEE có thể sửa rồi submit lại.
- ADMIN không được review cluster do chính mình tạo nếu maker-checker rule được áp dụng.

Để tiếp tục luồng approve, sửa cluster nếu cần rồi gọi lại CL-04.

---

## 9. CL-05B — Approve cluster

```http
POST {{baseUrl}}/api/cinema-clusters/{{clusterId}}/approve
Authorization: Bearer {{adminToken}}
```

Kết quả mong đợi:

- HTTP `200`.
- `result.status = "ACTIVE"`.
- Lưu ID vào biến `activeClusterId`.
- Cluster được phép tạo Cinema Room.
- Public/customer query chỉ nhìn thấy cluster phù hợp với public visibility policy.

---

## 10. CL-06 — Kiểm tra audit log

```http
GET {{baseUrl}}/api/cinema-clusters/{{activeClusterId}}/audit-log
Authorization: Bearer {{adminToken}}
```

Kết quả mong đợi:

- ADMIN nhận HTTP `200`.
- Có các action tương ứng như `CREATE`, `UPDATE`, `SUBMIT`, `REJECT` hoặc `APPROVE`.
- Log có actor, old status, new status, timestamp và note khi cần.
- EMPLOYEE/customer không được đọc audit log nếu không có quyền.

---

# PHẦN B — CINEMA ROOM

## 11. RM-01 — Lấy master data

```http
GET {{baseUrl}}/api/cinema-room-master-data
Authorization: Bearer {{employeeToken}}
```

Lấy ID hợp lệ từ:

- `result.auditoriumClasses`
- `result.projectionTechnologies`
- `result.resolutions`
- `result.audioFormats`

Không hard-code ID nếu database hiện tại trả về giá trị khác sample.

---

## 12. RM-02 — Tạo Cinema Room DRAFT

Điều kiện: `activeClusterId` phải thuộc cluster `ACTIVE`.

```http
POST {{baseUrl}}/api/cinema-rooms
Authorization: Bearer {{employeeToken}}
Content-Type: application/json
```

```json
{
  "cinemaRoomName": "QA Room 01",
  "clusterId": {{activeClusterId}},
  "roomCode": "R-QA-01",
  "auditoriumClassId": 1,
  "lengthM": 20,
  "widthM": 14,
  "clearHeightM": 6,
  "projectionTechnologyId": 1,
  "presentationSystem": "STANDARD",
  "resolutionId": 1,
  "screenWidthM": 12,
  "screenHeightM": 5,
  "supports2d": true,
  "supports3d": false,
  "audioFormatId": 1
}
```

Thay các master-data ID bằng ID thực tế lấy từ RM-01.

Kết quả mong đợi:

- HTTP `200`, body `code = 200`.
- `result.status = "DRAFT"`.
- `result.clusterId = activeClusterId`.
- `result.totalSeatCapacity = 0` trước khi layout được activate.
- `result.areaSqm = lengthM × widthM`.
- `result.createdBy` là EMPLOYEE đã tạo.
- Lưu `result.cinemaRoomId` vào `roomId`.

---

## 13. RM-03 — Validation khi tạo room

| Case | Dữ liệu/điều kiện | Kết quả mong đợi |
|---|---|---|
| RM-03.1 | Cluster không tồn tại | HTTP `404`, code `2023` |
| RM-03.2 | Cluster còn `DRAFT` hoặc `PENDING_REVIEW` | Request bị chặn vì cluster chưa active |
| RM-03.3 | Bỏ `roomCode` | Business validation error |
| RM-03.4 | Trùng room code trong cùng cluster | Conflict/business error |
| RM-03.5 | Trùng room name trong cùng cluster | Conflict/business error |
| RM-03.6 | `lengthM`, `widthM` hoặc `clearHeightM ≤ 0` | Validation/business error |
| RM-03.7 | Screen rộng hơn room | Request bị chặn |
| RM-03.8 | Screen cao hơn clear height | Request bị chặn |
| RM-03.9 | `supports2d = false` và `supports3d = false` | Request bị chặn |
| RM-03.10 | Master-data ID không tồn tại/inactive | Request bị chặn |

Các giá trị hợp lệ của `presentationSystem`:

```text
STANDARD
IMAX
DOLBY_CINEMA
SCREENX
```

---

## 14. RM-04 — Lấy layout DRAFT ban đầu

```http
GET {{baseUrl}}/api/cinema-rooms/{{roomId}}/layouts
Authorization: Bearer {{employeeToken}}
```

Kết quả mong đợi:

- Có một layout version ban đầu ở trạng thái `DRAFT`.
- Lưu `layoutId` của layout này.

---

## 15. RM-05 — Lưu seat layout

```http
PUT {{baseUrl}}/api/cinema-rooms/{{roomId}}/layouts/{{layoutId}}
Authorization: Bearer {{employeeToken}}
Content-Type: application/json
```

```json
{
  "numberOfRows": 2,
  "maxPositionsPerRow": 4,
  "firstRowLabel": "A",
  "numberingDirection": "LEFT_TO_RIGHT",
  "numberingPolicy": "CONTIGUOUS_SEATS",
  "generatorTemplateCode": "MANUAL-QA",
  "generatorTemplateVersion": 1,
  "generationConfig": "{\"source\":\"manual-test\"}",
  "positions": [
    {
      "rowIndex": 0,
      "columnIndex": 0,
      "rowLabel": "A",
      "positionType": "SEAT",
      "seatNumber": 1,
      "seatCode": "A1",
      "seatType": "STANDARD",
      "manualOverride": false
    },
    {
      "rowIndex": 0,
      "columnIndex": 1,
      "rowLabel": "A",
      "positionType": "AISLE",
      "manualOverride": false
    },
    {
      "rowIndex": 0,
      "columnIndex": 2,
      "rowLabel": "A",
      "positionType": "SEAT",
      "seatNumber": 2,
      "seatCode": "A2",
      "seatType": "VIP",
      "manualOverride": false
    },
    {
      "rowIndex": 1,
      "columnIndex": 0,
      "rowLabel": "B",
      "positionType": "SEAT",
      "seatNumber": 1,
      "seatCode": "B1",
      "seatType": "COUPLE",
      "seatGroupId": "COUPLE-B-01",
      "manualOverride": false
    },
    {
      "rowIndex": 1,
      "columnIndex": 1,
      "rowLabel": "B",
      "positionType": "SEAT",
      "seatNumber": 2,
      "seatCode": "B2",
      "seatType": "COUPLE",
      "seatGroupId": "COUPLE-B-01",
      "manualOverride": false
    }
  ]
}
```

Kết quả mong đợi:

- Layout vẫn ở `DRAFT`.
- Capacity do backend tính, không lấy từ client.
- `personCapacity = 4`: A1, A2 và couple group cho 2 người.
- `sellableUnitCount = 3`: hai ghế đơn và một couple group.
- Hai vị trí couple dùng cùng `seatGroupId`, cùng hàng và nằm kề nhau.

---

## 16. RM-06 — Negative layout cases

| Case | Thao tác | Kết quả mong đợi |
|---|---|---|
| RM-06.1 | Hai position trùng `rowIndex + columnIndex` | Bị từ chối |
| RM-06.2 | Hai ghế trùng `seatCode` | Bị từ chối |
| RM-06.3 | `SEAT` thiếu `seatNumber`, `seatCode` hoặc `seatType` | Bị từ chối |
| RM-06.4 | `AISLE` lại có seat fields | Bị từ chối |
| RM-06.5 | Couple chỉ có một position | Bị từ chối |
| RM-06.6 | Hai couple position không cùng hàng/kề nhau | Bị từ chối |
| RM-06.7 | Submit layout rỗng | Bị từ chối |
| RM-06.8 | Layout vượt room capacity envelope | Bị từ chối |

---

## 17. RM-07 — Submit, approve và activate layout

### Submit bởi EMPLOYEE

```http
POST {{baseUrl}}/api/cinema-rooms/{{roomId}}/layouts/{{layoutId}}/submit
Authorization: Bearer {{employeeToken}}
```

Mong đợi:

- Layout: `DRAFT → PENDING_APPROVAL`.
- Room: `DRAFT → PENDING_APPROVAL`.

### Approve bởi ADMIN

```http
POST {{baseUrl}}/api/cinema-rooms/{{roomId}}/layouts/{{layoutId}}/approve
Authorization: Bearer {{adminToken}}
```

Mong đợi:

- Layout: `PENDING_APPROVAL → APPROVED`.
- Room: `PENDING_APPROVAL → APPROVED`.

### Activate bởi ADMIN

```http
POST {{baseUrl}}/api/cinema-rooms/{{roomId}}/layouts/{{layoutId}}/activate
Authorization: Bearer {{adminToken}}
```

Mong đợi:

- Layout: `APPROVED → ACTIVE`.
- Room: `APPROVED → ACTIVE`.
- Seat inventory được đồng bộ từ active layout.
- `GET /api/cinema-rooms/{{roomId}}/seats` trả đúng seat codes và seat types.
- Couple group vẫn được giữ dưới dạng một atomic group gồm hai vị trí.

---

# PHẦN C — HARD DELETE POLICY

## 18. DEL-CL — Cinema Cluster hard delete

### DEL-CL-01 — ADMIN xóa fresh DRAFT

Tạo một cluster mới nhưng không submit và không tạo room:

```http
DELETE {{baseUrl}}/api/cinema-clusters/{{clusterId}}
Authorization: Bearer {{adminToken}}
```

Mong đợi:

- HTTP `204 No Content`.
- GET lại cùng ID trả `404`, code `2023`.
- DELETE lần hai trả `404`, code `2023`.

### DEL-CL-02 — EMPLOYEE không được hard delete cluster

DELETE fresh DRAFT bằng `employeeToken`.

Mong đợi:

- HTTP `403`.
- Cluster vẫn tồn tại.

### DEL-CL-03 — Cluster đã vào workflow không được hard delete

Test lần lượt:

- Cluster đang `PENDING_REVIEW`.
- Cluster đã bị reject về `DRAFT`.
- Cluster đã `ACTIVE`.

Mong đợi:

```text
HTTP 409
code = 2088
```

Việc reject về `DRAFT` không biến cluster thành fresh/unused draft.

### DEL-CL-04 — Dependency protection

Cluster có room hoặc movie availability history không được hard delete. Trong API flow bình thường, các dependency này chỉ xuất hiện khi cluster đã ACTIVE nên status gate thường chặn trước. Các nhánh dependency cụ thể phải được xác nhận thêm bằng automated service tests.

---

## 19. DEL-RM — Cinema Room hard delete

### DEL-RM-01 — ADMIN xóa room DRAFT chưa sử dụng

Tạo room mới trong active cluster nhưng chưa submit layout:

```http
DELETE {{baseUrl}}/api/cinema-rooms/{{roomId}}
Authorization: Bearer {{adminToken}}
```

Mong đợi:

- HTTP `204`.
- GET lại cùng ID trả `404`, code `2003`.

### DEL-RM-02 — Creator EMPLOYEE xóa draft của mình

- Tạo room bằng `employeeToken`.
- Xóa bằng cùng `employeeToken`.

Mong đợi: HTTP `204`.

### DEL-RM-03 — EMPLOYEE khác không được xóa

- Tạo room bằng `employeeToken`.
- Xóa bằng `otherEmployeeToken`.

Mong đợi:

```text
HTTP 403
code = 2083
```

### DEL-RM-04 — Room đã vào layout workflow không được xóa

Sau khi layout đã submit, reject, approve hoặc activate, gọi DELETE.

Mong đợi:

```text
HTTP 409
code = 2082
```

Room có showtime, active seats hoặc maintenance history cũng không được hard delete.

---

# PHẦN D — UI TEST

## 20. Cinema Cluster UI

Mở:

```text
http://localhost:3000/admin/clusters
```

Checklist:

- [ ] Form tạo cluster nằm trên trang riêng, không phải native dialog.
- [ ] Validation hiển thị ngay tại field tương ứng.
- [ ] Operating schedule có đủ 7 ngày và thao tác đóng/mở ngày rõ ràng.
- [ ] EMPLOYEE có thể tạo, sửa và submit cluster của mình.
- [ ] ADMIN có thể approve/reject pending cluster.
- [ ] Rejection bắt buộc có lý do.
- [ ] Nút hard delete cluster chỉ hiển thị phù hợp cho ADMIN và trạng thái DRAFT.
- [ ] Delete dùng custom confirmation modal, không dùng `window.confirm()`.
- [ ] Xóa thành công hiển thị success toast và cập nhật danh sách.
- [ ] Backend trả lỗi thì hiển thị error toast, không hiển thị empty state sai.

## 21. Cinema Room UI

Đi vào cluster detail và chọn Add Room.

Checklist:

- [ ] Chỉ cluster ACTIVE mới cho phép tạo room.
- [ ] Có thể chọn Create new room hoặc Duplicate existing room.
- [ ] Master-data dropdown load từ API.
- [ ] Room code được gợi ý nhưng vẫn có thể chỉnh trước khi lưu.
- [ ] Required-field validation hiển thị cạnh field.
- [ ] Generate layout hiển thị preview rõ, modal không trong suốt/khó thao tác.
- [ ] Standard, VIP, Couple, Accessible, Aisle, Exit và Empty Space phân biệt được.
- [ ] Couple seat có hai vị trí, seat code riêng và cùng group.
- [ ] Capacity overview cập nhật khi thay đổi layout.
- [ ] Submit/approve/activate cập nhật đúng room và layout status.
- [ ] Nút delete room chỉ xuất hiện với DRAFT phù hợp quyền.
- [ ] Delete dùng custom confirmation modal và toast.
- [ ] Sau delete, room count/seat count và table được refresh.

---

# PHẦN E — AUDIT & DATABASE VERIFICATION

## 22. Cluster delete tombstone

Sau khi hard delete cluster thành công:

```powershell
docker exec postgres psql -U postgres -d movie_db -c "SELECT cluster_id, action, performed_by, old_status, new_status, note, timestamp FROM cluster_audit_log WHERE cluster_id = <CLUSTER_ID> ORDER BY timestamp DESC;"
```

Mong đợi:

- Dòng `DELETE` vẫn tồn tại dù parent cluster đã bị xóa.
- Actor là ADMIN đã thực hiện thao tác.
- Timestamp và note hợp lệ.

> API audit log hiện yêu cầu cluster còn tồn tại, vì vậy audit tombstone sau hard delete được xác minh trực tiếp trong database.

## 23. Room delete audit

Kiểm tra audit theo resource note:

```sql
SELECT *
FROM movie_action_log
WHERE note = 'cinema_room:<ROOM_ID>'
ORDER BY timestamp DESC;
```

Mong đợi có action description về việc permanently delete unused draft cinema room.

---

# PHẦN F — AUTOMATED REGRESSION

## 24. Backend

```powershell
cd D:\OJTProject\Movie_Theater\hcm26_cpl_java_05_group1\server
.\mvnw.cmd -pl movie-service -am test
```

Docker Desktop phải chạy để Testcontainers thực thi concurrency integration tests. Nếu Docker không hoạt động, các test đó có thể bị skip.

## 25. Frontend

```powershell
cd D:\OJTProject\Movie_Theater\hcm26_cpl_java_05_group1\client
npm test
npm run build
```

---

## 26. Exit Criteria

Flow được coi là đạt khi:

- [ ] Cluster luôn được tạo ở `DRAFT`.
- [ ] Cluster đi đúng `DRAFT → PENDING_REVIEW → ACTIVE` hoặc quay về `DRAFT` khi reject.
- [ ] Room chỉ được tạo trong cluster `ACTIVE`.
- [ ] Room/layout đi đúng `DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE`.
- [ ] Seat inventory chỉ được materialize từ active layout.
- [ ] Couple seat được quản lý theo atomic group.
- [ ] Fresh unused DRAFT cluster/room có thể hard delete đúng quyền.
- [ ] Đã vào workflow hoặc có dependency thì hard delete bị chặn.
- [ ] Không cascade làm mất operational/history data.
- [ ] Audit delete được lưu lại.
- [ ] UI không còn native alert/confirm trong flow cluster và room.
- [ ] Backend tests, frontend tests và production build đều thành công.

---

## 27. Test Execution Record

| Test case | Tester | Ngày chạy | Kết quả | Evidence/Link | Ghi chú |
|---|---|---|---|---|---|
| CL-01 |  |  | PASS/FAIL |  |  |
| CL-02 |  |  | PASS/FAIL |  |  |
| CL-03 |  |  | PASS/FAIL |  |  |
| CL-04 |  |  | PASS/FAIL |  |  |
| CL-05A |  |  | PASS/FAIL |  |  |
| CL-05B |  |  | PASS/FAIL |  |  |
| CL-06 |  |  | PASS/FAIL |  |  |
| RM-01 |  |  | PASS/FAIL |  |  |
| RM-02 |  |  | PASS/FAIL |  |  |
| RM-03 |  |  | PASS/FAIL |  |  |
| RM-04 |  |  | PASS/FAIL |  |  |
| RM-05 |  |  | PASS/FAIL |  |  |
| RM-06 |  |  | PASS/FAIL |  |  |
| RM-07 |  |  | PASS/FAIL |  |  |
| DEL-CL |  |  | PASS/FAIL |  |  |
| DEL-RM |  |  | PASS/FAIL |  |  |
| UI |  |  | PASS/FAIL |  |  |
| Audit |  |  | PASS/FAIL |  |  |
| Regression |  |  | PASS/FAIL |  |  |
