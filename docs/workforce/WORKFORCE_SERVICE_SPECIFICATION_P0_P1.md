# Workforce Management — Đặc tả service và kiểm thử P0/P1

> Phiên bản tài liệu: 1.0  
> Phạm vi: Workforce Scheduling, Attendance, Timesheet, Leave và Shift Swap  
> Không thuộc phạm vi: tính lương, thuế, bảo hiểm, payslip và chuyển khoản ngân hàng

---

> Phân quyền nghiệp vụ tuyến đầu (`BOX_OFFICE`, `FOOD_BEVERAGE`, guest services) và cách đồng bộ `Access Profile` sang Auth được mô tả tại [FRONTLINE_CAPABILITY_ACCESS.md](../security/FRONTLINE_CAPABILITY_ACCESS.md). Workforce tiếp tục dùng Staff Access Projection và Cluster Scope, không gọi đồng bộ sang User trong request path.

## 1. Mục đích

Tài liệu này mô tả phần Workforce Management đã triển khai trong P0 và P1, bao gồm:

- Ranh giới trách nhiệm giữa `auth-service`, `user-service`, `workforce-service`, API Gateway và client.
- Mô hình dữ liệu và các trạng thái nghiệp vụ.
- Permission và phạm vi cụm rạp.
- Contract event giữa các service.
- Danh sách API.
- Kịch bản kiểm thử thủ công trên UI.
- Các kiểm thử backend không thể chứng minh đầy đủ chỉ bằng UI.
- Giới hạn hiện tại và hướng phát triển tiếp theo.

Mục tiêu quan trọng nhất là tách ba loại dữ liệu khác nhau:

1. **Hồ sơ nhân viên**: họ là ai và đang được phân công ở đâu.
2. **Dữ liệu chấm công thực tế**: nhân viên đã clock-in/out lúc nào.
3. **Thời gian được duyệt để trả lương**: số phút regular/overtime/payable sau khi manager xử lý ngoại lệ.

Không được dùng trực tiếp raw punch để tính tiền lương.

---

## 2. Phạm vi P0 và P1

### 2.1 P0 — Scheduling foundation

P0 cung cấp nền tảng lập lịch làm việc:

- Database riêng `workforce_db`.
- Projection nhân viên cục bộ từ event của `user-service`.
- Shift template.
- Roster theo cụm rạp và khoảng ngày.
- Gán ca cho nhân viên.
- Publish roster.
- Kiểm tra ca chồng nhau.
- Kiểm tra thời gian nghỉ tối thiểu giữa hai ca.
- Kiểm tra nhân viên active và thuộc đúng cụm rạp.
- Giao diện lịch cá nhân và giao diện quản lý đội.
- Permission, branch scope và audit log.

### 2.2 P1 — Attendance và approval

P1 bổ sung dữ liệu công và luồng phê duyệt:

- Clock-in/clock-out có idempotency key.
- Hỗ trợ ca qua đêm.
- Lưu raw time punch bất biến.
- Timesheet tuần từ Thứ Hai đến Chủ Nhật.
- Tổng hợp thời gian theo tháng.
- Tách regular, overtime và payable minutes.
- Tự động phát hiện late clock-in, early clock-out, overtime và missing punch.
- Manager resolve hoặc waive attendance exception.
- Nhân viên submit timesheet.
- Manager approve/reject timesheet.
- Chống tự duyệt timesheet của chính mình.
- Khóa kỳ công trước khi bàn giao cho payroll.
- Leave request và shift swap request.
- Transactional outbox phát `TIMESHEET_APPROVED.v1`.

---

## 3. Kiến trúc và trách nhiệm service

```text
Client
  |
  v
API Gateway :8080
  |---------------------> Auth Service :8088
  |                         - Credentials
  |                         - JWT + permissions
  |
  |---------------------> User Service :8084
  |                         - Employee profile
  |                         - Staff assignment owner
  |                         - Publishes staff-access.events.v1
  |
  `---------------------> Workforce Service :8091
                            - Employee access projection
                            - Roster and shifts
                            - Attendance and exceptions
                            - Timesheets and approvals
                            - Leave and shift swaps
                            - workforce_db
                            - Publishes workforce.timesheet.events.v1
```

### 3.1 `auth-service`

`auth-service` sở hữu:

- Username/email và password hash.
- Trạng thái tài khoản đăng nhập.
- Role và permission.
- Phát hành JWT.
- Projection phạm vi cụm rạp dùng trong JWT.

`auth-service` không sở hữu:

- Hồ sơ nhân viên.
- Lịch làm việc.
- Dữ liệu clock-in/out.
- Timesheet hoặc lương.

JWT dùng cho Workforce cần chứa:

- `accountId`.
- Role.
- Permission.
- `cinemaClusterIds`.

Khi permission hoặc assignment thay đổi, người dùng phải đăng nhập lại để nhận JWT mới.

### 3.2 `user-service`

`user-service` là nguồn chuẩn của:

- Employee profile.
- Position, department và employment type.
- Trạng thái phân công.
- Role phục vụ công việc.
- Danh sách cụm rạp được phân công.
- `assignmentVersion`.

Mỗi lần tạo, cập nhật, đình chỉ hoặc kích hoạt lại phân công, User phát event version 1 lên:

```text
staff-access.events.v1
```

`user-service` không gọi Workforce để ghi trực tiếp dữ liệu lịch hoặc công.

### 3.3 `workforce-service`

`workforce-service` sở hữu:

- Projection tối thiểu của nhân viên.
- Shift template.
- Roster period.
- Employee shift.
- Raw time punch.
- Timesheet và timesheet entry.
- Attendance exception.
- Leave request.
- Shift swap request.
- Audit log.
- Transactional outbox.

Workforce không sao chép full name, phone, address, CCCD hoặc hồ sơ đầy đủ của nhân viên.

### 3.4 API Gateway

Gateway định tuyến:

```text
/api/workforce/** -> lb://workforce-service
```

Client không nên gọi trực tiếp port `8091` trong luồng sử dụng bình thường.

### 3.5 Client

Client cung cấp ba entry point:

| Đối tượng | Route | Mục đích |
|---|---|---|
| Employee | `/employee/workforce` | Lịch cá nhân, clock-in/out, timesheet và request |
| Branch Manager | `/admin/my-workforce` | Lịch và công cá nhân của manager |
| Branch Manager/Admin | `/admin/workforce` | Roster, công của đội và approval queue |

---

## 4. Luồng dữ liệu chính

### 4.1 Đồng bộ nhân viên

```text
User changes assignment
  -> increment assignmentVersion
  -> publish STAFF_ACCESS_* v1
  -> Workforce consumer receives event
  -> compare eventId and assignmentVersion
  -> update local employee projection
```

Quy tắc consumer:

- Cùng `eventId`: `DUPLICATE`, không ghi lại.
- Version thấp hơn hoặc bằng version đã xử lý: `STALE`, không rollback projection.
- Event producer hoặc version không hỗ trợ: bỏ qua.
- Chỉ projection mới nhất được dùng khi gán ca và chấm công.

### 4.2 Lập và phát hành lịch

```text
Manager creates draft roster
  -> assigns shifts
  -> Workforce validates employee and conflicts
  -> manager publishes roster
  -> assigned shifts become visible/usable for attendance
```

### 4.3 Chấm công và duyệt công

```text
Employee clocks in
  -> immutable CLOCK_IN punch
  -> shift IN_PROGRESS

Employee clocks out
  -> immutable CLOCK_OUT punch
  -> calculate regular/overtime/payable minutes
  -> create/update weekly timesheet
  -> create exceptions when needed

Employee submits timesheet
  -> manager resolves/waives exceptions
  -> manager approves
  -> outbox row committed with approval
  -> publisher retries until Kafka accepts event
  -> manager locks period for payroll handoff
```

---

## 5. Mô hình trạng thái

### 5.1 Roster

```text
DRAFT -> PUBLISHED -> IN_OPERATION -> CLOSED
```

Hiện tại UI triển khai trực tiếp `DRAFT -> PUBLISHED`. Hai trạng thái sau phục vụ mở rộng tự động đóng kỳ.

### 5.2 Shift

```text
ASSIGNED -> PUBLISHED -> IN_PROGRESS -> COMPLETED

ASSIGNED/PUBLISHED -> CANCELLED
```

- `ASSIGNED`: ca nằm trong roster nháp.
- `PUBLISHED`: nhân viên có thể clock-in.
- `IN_PROGRESS`: đã clock-in nhưng chưa clock-out.
- `COMPLETED`: có đủ clock-in và clock-out.
- `CANCELLED`: ca bị hủy, ví dụ leave được duyệt trùng thời gian.

### 5.3 Timesheet

```text
OPEN -> SUBMITTED -> APPROVED -> LOCKED
  ^          |
  `-- REJECTED
```

- `OPEN`: hệ thống đang thu thập công.
- `SUBMITTED`: nhân viên xác nhận và gửi manager.
- `REJECTED`: cần nhân viên hoặc manager xử lý lại.
- `APPROVED`: số phút payable đã được duyệt và phát event.
- `LOCKED`: đóng kỳ, không cho sửa dữ liệu công.

### 5.4 Leave và shift swap

```text
SUBMITTED -> APPROVED
          -> REJECTED
```

---

## 6. Mô hình dữ liệu

| Table | Mục đích | Dữ liệu quan trọng |
|---|---|---|
| `workforce_employee_projection` | Projection từ User | account, role, active, cluster IDs, last event/version |
| `shift_template` | Mẫu ca tái sử dụng | start/end, break, cluster |
| `roster_period` | Kỳ lập lịch | cluster, start/end, status, publisher |
| `employee_shift` | Một ca của nhân viên | account, cluster, time, break, role, status |
| `time_punch` | Raw clock event bất biến | type, occurredAt, recordedAt, source, idempotency key |
| `timesheet` | Tổng công theo tuần | regular, overtime, exception count, approval state |
| `timesheet_entry` | Công của từng ca | actual start/end, regular, overtime, payable |
| `attendance_exception` | Sai lệch cần xử lý | code, variance, resolution |
| `leave_request` | Đơn nghỉ | type, time range, status, reviewer |
| `shift_swap_request` | Yêu cầu đổi ca | source shift, target employee, reviewer |
| `workforce_audit_log` | Nhật ký command | actor, action, aggregate, timestamp |
| `workforce_outbox_event` | Event chờ publish | payload, attempts, next retry, status |

### 6.1 Raw time và payable time

Ví dụ:

```text
Scheduled:    09:00 - 17:00, break 60 phút
Actual:       08:55 - 18:00
Raw duration: 545 phút
Payable:      raw duration - break
Regular:      phần thời gian trong khung ca
Overtime:     phần vượt khung ca
```

Overtime được ghi nhận là exception. Việc có trả overtime hay không phải được manager xác nhận trước khi payroll sử dụng.

### 6.2 Missing punch

Sau khi ca kết thúc quá tolerance:

- Không có punch: tạo `MISSING_CLOCK_IN`.
- Có clock-in nhưng không có clock-out: tạo `MISSING_CLOCK_OUT`.
- Payable minutes ban đầu bằng `0`.
- Hệ thống không tự lấy giờ scheduled làm giờ actual.

Đây là nguyên tắc fail-closed để tránh trả lương cho thời gian chưa được chứng minh.

### 6.3 Roster period — kỳ xếp lịch

`Roster period` là một kỳ hoặc đợt xếp lịch làm việc của **một cụm rạp** trong một khoảng ngày xác định. Đây là đối tượng bao ngoài dùng để quản lý và publish nhiều ca cùng lúc, không phải một ca làm việc cụ thể và cũng không phải kỳ tính lương.

Ví dụ:

```json
{
  "id": 25,
  "clusterId": 45,
  "name": "Lịch làm việc tuần 24–30/08",
  "startDate": "2026-08-24",
  "endDate": "2026-08-30",
  "status": "DRAFT"
}
```

Một roster period xác định:

- Cụm rạp được áp dụng.
- Khoảng thời gian cần bố trí nhân lực.
- Người tạo và người publish.
- Trạng thái của cả kỳ lập lịch.
- Danh sách `employee_shift` thuộc kỳ đó.

Ý nghĩa của trạng thái:

- `DRAFT`: quản lý còn chỉnh sửa; nhân viên chưa nên nhìn thấy các ca mới được gán.
- `PUBLISHED`: lịch đã được công bố; nhân viên có thể xem và chấm công theo ca.
- `IN_OPERATION`: kỳ đang diễn ra; trạng thái dành cho bước tự động hóa tiếp theo.
- `CLOSED`: kỳ đã kết thúc hoặc được khóa khỏi thay đổi thông thường.

Phân biệt hai khái niệm:

| Khái niệm | Mục đích |
|---|---|
| Roster period | Lập và phát hành lịch làm việc |
| Payroll period | Tổng hợp, kiểm tra và chốt dữ liệu để tính lương |

Hai kỳ có thể trùng ngày nhưng không được dùng thay thế cho nhau.

### 6.4 Employee shift — ca làm việc của nhân viên

`Employee shift` là một ca làm việc cụ thể được giao cho một nhân viên trong roster period.

```json
{
  "id": 301,
  "rosterPeriodId": 25,
  "employeeAccountId": 102,
  "clusterId": 45,
  "startAt": "2026-08-25T08:00:00+07:00",
  "endAt": "2026-08-25T16:00:00+07:00",
  "status": "PUBLISHED"
}
```

Bản ghi trên có nghĩa: nhân viên có account ID `102` làm tại cluster `45` từ 08:00 đến 16:00 ngày 25/08/2026.

Employee shift là cơ sở để:

- Hiển thị lịch làm việc cá nhân.
- Kiểm tra ca chồng nhau và thời gian nghỉ giữa hai ca.
- Xác định nhân viên có được clock-in/out hay không.
- Đối chiếu giờ scheduled với giờ actual.
- Tạo timesheet entry và payable time sau khi xử lý ngoại lệ.

Quan hệ giữa roster và ca:

```text
Roster: Lịch tuần 24–30/08 tại cluster 45
├── An:   25/08, 08:00–16:00
├── Bình: 25/08, 16:00–23:00
└── An:   27/08, 08:00–16:00
```

Một roster period chứa nhiều employee shift; mỗi employee shift thuộc đúng một roster period.

### 6.5 Shift swap request — yêu cầu đổi ca

`Shift swap request` là quy trình để một nhân viên đề nghị đổi ca với nhân viên khác. Hệ thống không đổi trực tiếp ngay khi gửi yêu cầu vì cần sự đồng ý của người nhận và kiểm soát vận hành của quản lý.

```json
{
  "id": 78,
  "requesterAccountId": 102,
  "targetAccountId": 103,
  "requesterShiftId": 301,
  "targetShiftId": 306,
  "reason": "Personal appointment",
  "status": "PENDING_PEER"
}
```

Luồng chuẩn:

```text
PENDING_PEER -> PENDING_MANAGER -> APPROVED
       |                |
       v                v
   DECLINED          REJECTED
```

- `PENDING_PEER`: chờ nhân viên được đề nghị xác nhận.
- `PENDING_MANAGER`: hai nhân viên đã đồng thuận, chờ quản lý duyệt.
- `APPROVED`: hệ thống áp dụng việc đổi người được phân công.
- `DECLINED`: nhân viên được đề nghị không đồng ý.
- `REJECTED`: quản lý không duyệt vì lý do vận hành hoặc validation.
- `CANCELLED`: người tạo rút yêu cầu khi yêu cầu còn được phép hủy.

Khi approve, hệ thống phải kiểm tra lại dữ liệu hiện tại, không chỉ dựa trên kết quả validation lúc tạo request:

- Hai tài khoản vẫn active và có projection hợp lệ.
- Cả hai thuộc đúng cluster và có năng lực/vị trí phù hợp.
- Ca chưa bắt đầu, chưa hoàn thành hoặc bị hủy.
- Việc đổi không tạo ca chồng nhau.
- Thời gian nghỉ tối thiểu giữa các ca vẫn được bảo đảm.
- Không có yêu cầu khác đang khóa cùng ca.

Việc kiểm tra lại khi duyệt ngăn lỗi race condition khi lịch hoặc phân công đã thay đổi trong thời gian request chờ xử lý.

### 6.6 Transactional outbox — phát event đáng tin cậy

`Transactional outbox` là pattern ghi thay đổi nghiệp vụ và event cần phát vào **cùng một database transaction**. Nó giải quyết tình huống database đã cập nhật nhưng service bị dừng trước khi gửi event lên Kafka.

Cách không an toàn:

```text
1. UPDATE timesheet = APPROVED       -> thành công
2. Gửi TIMESHEET_APPROVED lên Kafka  -> service crash, event bị mất
```

Cách dùng outbox:

```text
BEGIN TRANSACTION
  1. UPDATE timesheet SET status = 'APPROVED'
  2. INSERT workforce_outbox_event (..., status = 'PENDING')
COMMIT
```

Nếu transaction rollback thì cả timesheet và outbox event đều không được lưu. Nếu commit thành công thì event luôn tồn tại để background publisher gửi lại, kể cả khi Kafka tạm thời không hoạt động.

```text
Approve timesheet
        |
        v
Workforce database transaction
├── Timesheet = APPROVED
└── Outbox event = PENDING
        |
        v
Background publisher --retry--> Kafka
        |
        v
Payroll service
```

Vòng đời cơ bản của outbox event:

```text
PENDING -> PROCESSING -> PUBLISHED
               |
               `-> retry theo attempts/nextRetryAt
```

Transactional outbox cung cấp:

- Không mất event sau khi thay đổi nghiệp vụ đã commit.
- Kafka ngừng tạm thời không chặn transaction duyệt timesheet.
- Có thể retry và theo dõi số lần gửi.
- Không cần distributed transaction giữa PostgreSQL và Kafka.

Pattern này thường cung cấp **at-least-once delivery**, nên cùng một event có thể được gửi lại. Consumer, ví dụ Payroll, phải idempotent: lưu `eventId` đã xử lý và bỏ qua lần nhận trùng. Contract cụ thể của `TIMESHEET_APPROVED.v1` được trình bày tại mục 9.2.

### 6.7 Quan hệ tổng thể

```text
Branch Manager tạo roster period
        -> thêm employee shift
        -> publish roster
Employee xem lịch
        -> có thể gửi shift swap request
        -> clock-in/out theo ca cuối cùng đã được duyệt
Workforce tạo và duyệt timesheet
        -> ghi TIMESHEET_APPROVED.v1 vào transactional outbox
        -> publisher gửi event cho Payroll
```

---

## 7. Validation nghiệp vụ

| Rule | Hành vi |
|---|---|
| Roster tối đa 31 ngày | Từ chối kỳ tạo roster dài hơn giới hạn |
| Khoảng truy vấn tối đa 366 ngày | Ngăn query quá lớn |
| Ca tối đa 24 giờ | Từ chối thời gian không hợp lệ |
| Break từ 0 đến 240 phút | Validation request |
| Ca phải nằm trong roster period | Từ chối ca vượt kỳ |
| Employee phải active | Fail-closed nếu projection thiếu/inactive |
| Employee phải thuộc cluster | Không thể gán nhân viên sai cụm |
| Không chồng ca | Từ chối time overlap |
| Nghỉ tối thiểu mặc định 12 giờ | Từ chối ca quá sát nhau |
| Chỉ published shift được clock-in | Chặn chấm công cho roster nháp |
| Clock-out phải sau clock-in | Chặn sai thứ tự |
| Không tự approve | Reviewer không được trùng account của timesheet |
| Không approve khi còn exception | Phải resolve/waive trước |
| Không sửa sau lock | Kỳ công đã đóng là bất biến |

Các giá trị cấu hình:

```properties
WORKFORCE_TIME_ZONE=Asia/Ho_Chi_Minh
WORKFORCE_MINIMUM_REST_HOURS=12
WORKFORCE_CLOCK_TOLERANCE_MINUTES=5
WORKFORCE_OUTBOX_POLL_MS=1000
WORKFORCE_MISSING_PUNCH_DETECTION_MS=60000
```

---

## 8. Permission và branch scope

| Permission | Employee | Branch Manager | Legacy Admin |
|---|:---:|:---:|:---:|
| `WORKFORCE_SELF_READ` | ✓ | ✓ | ✓ |
| `ATTENDANCE_CLOCK` | ✓ | ✓ | ✓ |
| `TIMESHEET_SUBMIT` | ✓ | ✓ | ✓ |
| `WORKFORCE_REQUEST` | ✓ | ✓ | ✓ |
| `WORKFORCE_PLAN` |  | ✓ | ✓ |
| `WORKFORCE_PUBLISH` |  | ✓ | ✓ |
| `TIMESHEET_REVIEW` |  | ✓ | ✓ |
| `WORKFORCE_REQUEST_APPROVE` |  | ✓ | ✓ |
| `WORKFORCE_CONFIG` |  | ✓ | ✓ |

Branch Manager chỉ được thao tác với cluster nằm trong `cinemaClusterIds` của JWT.

Kiểm tra scope được thực hiện ở cả hai lớp:

- Client lọc cluster selector để giảm thao tác sai.
- Backend kiểm tra lại JWT scope và trả `403` nếu request bị sửa thủ công.

Không được chỉ dựa vào việc ẩn menu trên frontend.

---

## 9. Event contract

### 9.1 Staff access projection event

Topic:

```text
staff-access.events.v1
```

Các event type được Workforce hỗ trợ:

- `STAFF_ACCESS_ASSIGNED`
- `STAFF_ACCESS_UPDATED`
- `STAFF_ACCESS_SUSPENDED`
- `STAFF_ACCESS_REACTIVATED`

Payload tối thiểu:

```json
{
  "accountId": "employee-account-id",
  "accountRole": "EMPLOYEE",
  "accessProfile": "BOX_OFFICE",
  "assignmentStatus": "ACTIVE",
  "cinemaClusterIds": ["45"],
  "assignmentVersion": 3
}
```

### 9.2 Timesheet approved event

Topic:

```text
workforce.timesheet.events.v1
```

Envelope:

```json
{
  "eventId": "stable-outbox-event-id",
  "eventType": "TIMESHEET_APPROVED",
  "eventVersion": "1",
  "occurredAt": "2026-08-20T10:00:00+07:00",
  "correlationId": "stable-outbox-event-id",
  "causationId": null,
  "producer": "workforce-service",
  "payload": {
    "timesheetId": "timesheet-id",
    "accountId": "employee-account-id",
    "clusterId": "45",
    "periodStart": "2026-08-17",
    "periodEnd": "2026-08-23",
    "regularMinutes": 2400,
    "overtimeMinutes": 120,
    "version": 2
  }
}
```

Outbox bảo đảm:

- Business transaction và outbox row commit cùng nhau.
- Kafka tạm dừng không làm mất approval event.
- Retry có exponential backoff.
- Event giữ nguyên `eventId` khi retry.
- Consumer downstream vẫn phải idempotent theo `eventId`.

---

## 10. API catalog

Base URL qua Gateway:

```text
http://localhost:8080
```

### 10.1 Employee/self-service

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/api/workforce/me/shifts` | Lấy lịch cá nhân |
| POST | `/api/workforce/me/shifts/{id}/clock-in` | Clock-in |
| POST | `/api/workforce/me/shifts/{id}/clock-out` | Clock-out |
| GET | `/api/workforce/me/timesheets` | Danh sách timesheet tuần |
| GET | `/api/workforce/me/timesheets/monthly` | Tổng hợp tháng |
| POST | `/api/workforce/me/timesheets/{id}/submit` | Submit timesheet |
| GET/POST | `/api/workforce/me/shift-swaps` | Xem/tạo shift swap |
| GET/POST | `/api/workforce/me/leave-requests` | Xem/tạo leave request |

Clock API bắt buộc có:

```text
Idempotency-Key: <UUID>
```

### 10.2 Manager/operations

| Method | Endpoint | Mục đích |
|---|---|---|
| GET/POST | `/api/workforce/admin/shift-templates` | Xem/tạo shift template |
| GET/POST | `/api/workforce/admin/rosters` | Xem/tạo roster |
| POST | `/api/workforce/admin/rosters/{id}/shifts` | Gán ca |
| POST | `/api/workforce/admin/rosters/{id}/publish` | Publish roster |
| GET | `/api/workforce/admin/timesheets` | Review queue |
| GET | `/api/workforce/admin/timesheets/monthly` | Tổng hợp tháng theo cluster |
| POST | `/api/workforce/admin/timesheets/{id}/approve` | Approve |
| POST | `/api/workforce/admin/timesheets/{id}/reject` | Reject |
| POST | `/api/workforce/admin/timesheets/{id}/lock` | Khóa kỳ |
| POST | `/api/workforce/admin/attendance-exceptions/{id}/resolve` | Resolve/waive exception |
| GET/POST | `/api/workforce/admin/shift-swaps/**` | Review shift swap |
| GET/POST | `/api/workforce/admin/leave-requests/**` | Review leave |

---

## 11. Chuẩn bị dữ liệu kiểm thử UI

### 11.1 Dịch vụ cần chạy

```powershell
docker compose up -d postgres kafka redis discovery-server workforce-service api-gateway
```

Auth và User có thể chạy bằng Docker hoặc IDE, nhưng không được chạy hai process cùng chiếm một port.

Kiểm tra Workforce:

```powershell
curl.exe http://localhost:8091/actuator/health
```

Kết quả:

```json
{"status":"UP"}
```

### 11.2 Tài khoản cần có

| Tài khoản | Role | Cluster | Mục đích |
|---|---|---|---|
| `manager-a` | BRANCH_MANAGER | 45 | Tạo lịch và duyệt công |
| `employee-a` | EMPLOYEE | 45 | Nhân viên chính |
| `employee-b` | EMPLOYEE | 45 | Nhận shift swap |
| `employee-other` | EMPLOYEE | 46 | Test sai branch scope |

Tất cả assignment phải ở trạng thái `ACTIVE`.

### 11.3 Đồng bộ projection

Nếu các employee được tạo trước khi Workforce chạy:

1. Restart `user-service` để bootstrap phát lại projection.
2. Chờ consumer xử lý event.
3. Đăng xuất và đăng nhập lại để nhận JWT mới.

Nếu projection chưa có, thao tác gán ca phải bị từ chối thay vì gọi đồng bộ sang User.

---

## 12. Test case UI — P0 Scheduling

### WF-UI-P0-001 — Hiển thị menu theo role

**Mục tiêu:** xác nhận điều hướng dựa trên permission.

**Tiền điều kiện:** có tài khoản Employee và Branch Manager.

**Các bước:**

1. Đăng nhập Employee.
2. Quan sát sidebar.
3. Đăng xuất và đăng nhập Branch Manager.
4. Quan sát sidebar.

**Kết quả mong đợi:**

- Employee thấy **My Schedule & Time**, không thấy **Workforce Operations**.
- Branch Manager thấy cả **My Schedule & Time** và **Workforce Operations**.
- Nhập trực tiếp URL không có permission phải bị điều hướng ra khỏi trang.

**Giải thích:** ẩn menu chỉ là UX; route guard là lớp bảo vệ phía client, backend permission vẫn là lớp quyết định cuối.

### WF-UI-P0-002 — Branch Manager chỉ thấy cluster được phân công

**Mục tiêu:** xác nhận branch scope trên selector.

**Các bước:**

1. Đăng nhập `manager-a` chỉ thuộc cluster 45.
2. Mở `/admin/workforce`.
3. Mở cluster selector.

**Kết quả mong đợi:**

- Chỉ cluster 45 xuất hiện.
- Không có cluster 46 hoặc cluster ngoài JWT scope.

**Giải thích:** client giảm nguy cơ thao tác nhầm chi nhánh. Backend vẫn phải trả 403 nếu người dùng sửa request bằng DevTools.

### WF-UI-P0-003 — Tạo draft roster hợp lệ

**Các bước:**

1. Mở **Workforce Operations > Rosters**.
2. Bấm **New roster**.
3. Chọn một ngày Thứ Hai làm `Period start`.
4. Đặt `Period end` sau đó 6 ngày.
5. Bấm **Create draft**.

**Kết quả mong đợi:**

- Roster mới xuất hiện.
- Status là `DRAFT`.
- Số shift bằng 0.
- Có nút **Assign shift**.
- Publish bị disable khi roster chưa có shift.

**Giải thích:** draft cho phép manager chuẩn bị lịch mà chưa làm thay đổi lịch nhân viên.

### WF-UI-P0-004 — Từ chối roster period không hợp lệ

**Các bước:**

1. Tạo roster có end date trước start date.
2. Thử lại với kỳ dài hơn 31 ngày.

**Kết quả mong đợi:**

- UI hoặc backend từ chối.
- Không có roster mới trong danh sách.
- Thông báo thể hiện date/time period không hợp lệ.

### WF-UI-P0-005 — Gán ca hợp lệ

**Các bước:**

1. Mở roster `DRAFT`.
2. Bấm **Assign shift**.
3. Nhập account ID của `employee-a`.
4. Chọn role `TEAM_MEMBER`.
5. Chọn giờ bắt đầu/kết thúc nằm trong roster period.
6. Bấm **Assign**.

**Kết quả mong đợi:**

- Ca xuất hiện trong roster.
- Status là `ASSIGNED`.
- Hiển thị account ID, role, start/end và break.

### WF-UI-P0-006 — Từ chối nhân viên khác cluster

**Các bước:**

1. Trong roster cluster 45, gán ca cho `employee-other` thuộc cluster 46.

**Kết quả mong đợi:**

- Gán ca thất bại.
- Không tạo shift.
- Thông báo nhân viên không có active assignment cho cluster.

**Giải thích:** hệ thống dùng projection cục bộ và fail-closed, không gọi User đồng bộ để “xin xác nhận”.

### WF-UI-P0-007 — Từ chối employee inactive hoặc thiếu projection

**Các bước:**

1. Suspend assignment của một employee hoặc dùng account ID chưa được projection.
2. Thử gán ca.

**Kết quả mong đợi:**

- Request bị từ chối.
- Không có shift mới.

### WF-UI-P0-008 — Từ chối ca chồng nhau

**Dữ liệu:** đã có ca 09:00–17:00 cho `employee-a`.

**Các bước:** tạo thêm ca 16:00–20:00 cùng ngày.

**Kết quả mong đợi:**

- Hệ thống báo overlapping shift.
- Ca thứ hai không được tạo.

### WF-UI-P0-009 — Từ chối thiếu thời gian nghỉ

**Dữ liệu:** ca trước kết thúc lúc 22:00; minimum rest là 12 giờ.

**Các bước:** tạo ca tiếp theo bắt đầu lúc 08:00 hôm sau.

**Kết quả mong đợi:**

- Hệ thống từ chối vì chỉ nghỉ 10 giờ.

**Giải thích:** rule này độc lập với overlap; hai ca không chồng nhưng vẫn không an toàn để vận hành.

### WF-UI-P0-010 — Tạo ca qua đêm

**Các bước:** tạo ca 22:00 ngày hiện tại đến 06:00 ngày hôm sau.

**Kết quả mong đợi:**

- Ca được tạo nếu cả hai ngày nằm trong roster period.
- Duration được tính đúng 8 giờ, không bị coi là end time trước start time.

### WF-UI-P0-011 — Publish roster

**Các bước:**

1. Tạo ít nhất một shift hợp lệ.
2. Bấm **Publish**.

**Kết quả mong đợi:**

- Roster chuyển thành `PUBLISHED`.
- Shift chuyển thành `PUBLISHED`.
- Không thể gán thêm shift bằng luồng hiện tại.
- Employee có thể thấy và clock-in ca đã publish.

---

## 13. Test case UI — P1 Attendance và Timesheet

### WF-UI-P1-001 — Employee xem lịch đã publish

**Các bước:**

1. Đăng nhập `employee-a`.
2. Mở `/employee/workforce`.
3. Chọn tab **My schedule**.

**Kết quả mong đợi:**

- Hiển thị ca vừa publish.
- Hiển thị cluster, role, start/end và break.
- Ca `PUBLISHED` có nút **Clock in**.

### WF-UI-P1-002 — Clock-in thành công

**Các bước:** bấm **Clock in** trên ca `PUBLISHED`.

**Kết quả mong đợi:**

- Shift chuyển sang `IN_PROGRESS`.
- Nút **Clock in** được thay bằng **Clock out**.
- Refresh trang không tạo thêm clock-in.

### WF-UI-P1-003 — Clock-out thành công

**Các bước:** bấm **Clock out** trên ca `IN_PROGRESS`.

**Kết quả mong đợi:**

- Shift chuyển thành `COMPLETED`.
- Timesheet tuần được tạo hoặc cập nhật.
- Tab Timesheets hiển thị regular/overtime.
- Card **Payable this month** được cập nhật.

### WF-UI-P1-004 — Late clock-in tạo exception

**Chuẩn bị:** dùng ca có scheduled start sớm hơn thời điểm test trên 5 phút.

**Các bước:** clock-in và clock-out, sau đó mở timesheet manager.

**Kết quả mong đợi:**

- Timesheet có exception `LATE_CLOCK_IN`.
- Hiển thị variance theo phút.
- Nút Approve bị disable khi exception còn `OPEN`.

### WF-UI-P1-005 — Early clock-out tạo exception

**Chuẩn bị:** clock-out trước scheduled end trên 5 phút.

**Kết quả mong đợi:** có `EARLY_CLOCK_OUT`, approval bị chặn.

### WF-UI-P1-006 — Overtime tạo exception

**Chuẩn bị:** actual end vượt scheduled end trên tolerance.

**Kết quả mong đợi:**

- Overtime minutes lớn hơn 0.
- Có exception `OVERTIME`.
- Manager phải xác nhận trước approval.

### WF-UI-P1-007 — Missing clock-in

**Chuẩn bị:** tạo và publish một ca có end time đã qua ít nhất 5 phút; không clock-in.

**Các bước:**

1. Chờ tối đa một chu kỳ detector, mặc định 60 giây.
2. Manager mở tab **Timesheets** và refresh.

**Kết quả mong đợi:**

- Có exception `MISSING_CLOCK_IN`.
- Payable time của entry bằng 0.
- Hệ thống không tự dùng scheduled time làm actual time.

### WF-UI-P1-008 — Missing clock-out

**Chuẩn bị:** employee đã clock-in nhưng không clock-out; ca đã kết thúc quá tolerance.

**Kết quả mong đợi:**

- Có `MISSING_CLOCK_OUT`.
- Payable time bằng 0 cho tới khi dữ liệu được hoàn tất/xử lý.

### WF-UI-P1-009 — Resolve exception

**Các bước:**

1. Manager mở tab **Timesheets**.
2. Bấm **Resolve** trên một exception.

**Kết quả mong đợi:**

- Exception không còn `OPEN`.
- Exception count giảm.
- Audit ghi reviewer và resolution note.

**Giải thích:** Resolve nghĩa là manager đã xác minh dữ liệu hoặc thực hiện correction theo quy trình nội bộ.

### WF-UI-P1-010 — Waive exception

**Các bước:** bấm **Waive** trên exception có lý do được chấp nhận.

**Kết quả mong đợi:** exception chuyển `WAIVED`, approval không còn bị chặn bởi exception đó.

**Giải thích:** Waive không xóa lịch sử sai lệch; nó thể hiện manager chấp nhận ngoại lệ.

### WF-UI-P1-011 — Submit timesheet

**Các bước:**

1. Employee mở tab **Timesheets**.
2. Bấm **Submit current**.

**Kết quả mong đợi:**

- Timesheet chuyển `SUBMITTED`.
- Employee không thể submit lại cho tới khi bị reject.
- Timesheet xuất hiện trong review queue của manager.

### WF-UI-P1-012 — Reject timesheet

**Các bước:** Manager bấm **Reject**.

**Kết quả mong đợi:**

- Status thành `REJECTED`.
- Review note được lưu.
- Employee có thể xử lý và submit lại.

### WF-UI-P1-013 — Approve timesheet

**Tiền điều kiện:** timesheet `SUBMITTED`, không còn open exception.

**Các bước:** Manager bấm **Approve**.

**Kết quả mong đợi:**

- Status thành `APPROVED`.
- Lưu reviewer và thời điểm review.
- Outbox row được tạo.
- Kafka nhận đúng một logical event `TIMESHEET_APPROVED.v1` dù publisher có retry.

### WF-UI-P1-014 — Khóa kỳ công

**Tiền điều kiện:** timesheet đã `APPROVED`.

**Các bước:** Manager bấm **Lock period**.

**Kết quả mong đợi:**

- Status thành `LOCKED`.
- Các thao tác resolve, approve hoặc thay đổi lại bị từ chối.

**Giải thích:** lock tạo snapshot ổn định cho payroll; điều chỉnh sau lock phải dùng adjustment ledger ở P2.

### WF-UI-P1-015 — Tổng hợp tháng

**Các bước:** hoàn thành ít nhất hai ca trong tháng rồi mở lại trang cá nhân.

**Kết quả mong đợi:**

- Card **Payable this month** bằng tổng payable minutes của các entry trong tháng hiện tại.
- Dữ liệu được nhóm theo account và cluster.

---

## 14. Test case UI — Leave và Shift Swap

### WF-UI-REQ-001 — Tạo leave request

**Các bước:**

1. Employee mở tab **Requests**.
2. Bấm **Request leave**.
3. Chọn cluster, leave type, from/to và reason.
4. Submit.

**Kết quả mong đợi:** request xuất hiện với status `SUBMITTED`.

### WF-UI-REQ-002 — Approve leave

**Chuẩn bị:** employee có ca `ASSIGNED` hoặc `PUBLISHED` trùng thời gian nghỉ.

**Các bước:** Manager mở Requests và approve leave.

**Kết quả mong đợi:**

- Leave thành `APPROVED`.
- Các ca trùng thời gian chuyển `CANCELLED`.
- Ca ngoài khoảng leave không thay đổi.

### WF-UI-REQ-003 — Reject leave

**Kết quả mong đợi:** leave thành `REJECTED`, shift không bị hủy.

### WF-UI-REQ-004 — Tạo shift swap

**Các bước:**

1. Employee mở ca tương lai ở trạng thái `PUBLISHED`.
2. Bấm icon swap.
3. Nhập account ID của `employee-b`.

**Kết quả mong đợi:**

- Request `SUBMITTED` được tạo.
- Assignee của shift chưa đổi trước khi manager approve.

### WF-UI-REQ-005 — Approve shift swap

**Các bước:** Manager approve request.

**Kết quả mong đợi:**

- Request thành `APPROVED`.
- Shift được chuyển sang `employee-b`.
- Backend kiểm tra lại target employee active, cluster và conflict ngay tại thời điểm approve.

### WF-UI-REQ-006 — Từ chối swap gây conflict

**Chuẩn bị:** sau khi request được tạo, gán cho target employee một ca chồng thời gian.

**Các bước:** Manager thử approve swap cũ.

**Kết quả mong đợi:** approval bị từ chối; assignee ban đầu không đổi.

**Giải thích:** validation phải chạy lại khi approve vì dữ liệu có thể thay đổi sau lúc submit.

---

## 15. Negative và security cases

### WF-SEC-001 — Truy cập cluster ngoài scope

**Thực hiện:** Branch Manager sửa `clusterId` trong Network request sang cluster khác.

**Mong đợi:** HTTP `403`; không trả dữ liệu cluster khác.

### WF-SEC-002 — Employee gọi manager endpoint

**Thực hiện:** dùng token Employee gọi `/api/workforce/admin/rosters`.

**Mong đợi:** HTTP `403`.

### WF-SEC-003 — Tự approve timesheet

Case này không thể tạo hoàn toàn qua UI vì Employee không có màn manager. Dùng token có quyền review nhưng có cùng `accountId` với timesheet.

**Mong đợi:** HTTP `403`, error `SELF_APPROVAL_FORBIDDEN`.

### WF-SEC-004 — Projection bị suspend sau khi publish

**Các bước:**

1. Publish shift cho employee.
2. Suspend assignment tại User.
3. Chờ Workforce consume event.
4. Employee thử clock-in.

**Mong đợi:** clock-in bị từ chối fail-closed.

### WF-SEC-005 — User Service dừng hoạt động

**Các bước:**

1. Đảm bảo Workforce đã có projection.
2. Dừng `user-service`.
3. Đăng nhập và sử dụng roster/attendance với projection hiện có.

**Mong đợi:**

- Workforce không gọi đồng bộ sang User.
- Nghiệp vụ hiện có tiếp tục hoạt động.
- Employee chưa từng được projection vẫn bị từ chối.

---

## 16. Các case phải test bằng API/Kafka

Một số thuộc tính không thể quan sát đáng tin cậy chỉ qua UI.

| Case | Vì sao cần API/Kafka |
|---|---|
| Clock idempotency | UI sinh key mới cho mỗi action; cần gửi lại cùng key |
| Duplicate staff event | Phải publish lại cùng event ID/version |
| Stale assignment event | Phải phát event version thấp hơn |
| Outbox retry | Cần tạm dừng Kafka sau khi approval commit |
| Stable event ID | Cần đọc Kafka/outbox qua nhiều lần retry |
| Self approval | UI route không cấp đồng thời hai vai trò xung đột |
| Tampered cluster ID | Cần sửa HTTP request hoặc dùng Postman |

### 16.1 Idempotent clock-in

Gửi hai lần cùng request:

```http
POST /api/workforce/me/shifts/{shiftId}/clock-in
Authorization: Bearer <employee-token>
Idempotency-Key: 7cf2ed44-bd58-4aed-83f2-6ee29163a901
Content-Type: application/json

{}
```

Kết quả:

- Hai response tham chiếu cùng punch.
- Database chỉ có một raw punch.
- Dùng cùng key cho shift/type khác trả conflict.

### 16.2 Outbox failure test

1. Dừng Kafka.
2. Approve timesheet.
3. Xác nhận timesheet vẫn `APPROVED` và outbox ở `FAILED/PENDING`.
4. Khởi động Kafka.
5. Chờ publisher retry.
6. Xác nhận outbox `PUBLISHED` và Kafka có event.

Không được rollback quyết định approve chỉ vì Kafka tạm thời unavailable.

---

## 17. Error codes Workforce

| Code | Ý nghĩa |
|---:|---|
| 6101 | Workforce record không tồn tại |
| 6102 | State transition không hợp lệ |
| 6103 | Date/time period không hợp lệ |
| 6104 | Employee không active hoặc sai cluster |
| 6105 | Shift overlap |
| 6106 | Không đủ thời gian nghỉ |
| 6107 | Không có quyền trên cluster |
| 6108 | Tự duyệt bị cấm |
| 6109 | Idempotency key conflict |
| 6110 | Sai thứ tự clock-in/out |
| 6111 | Còn attendance exception chưa xử lý |
| 6112 | Staff projection event không hợp lệ |
| 6113 | Đã có request active |
| 6114 | Không serialize được event để ghi outbox |

---

## 18. Acceptance checklist

### P0

- [ ] Workforce khởi động với database riêng và Flyway V1–V3.
- [ ] Projection nhận được event assign/update/suspend/reactivate.
- [ ] Duplicate/stale event không làm lùi dữ liệu.
- [ ] Manager tạo được roster và shift hợp lệ.
- [ ] Overlap, minimum rest, inactive và cross-cluster bị từ chối.
- [ ] Publish roster thành công.
- [ ] Employee và Branch Manager truy cập đúng màn theo permission.
- [ ] Branch scope fail-closed ở backend.

### P1

- [ ] Clock-in/out đúng sequence và idempotent.
- [ ] Ca qua đêm được tính đúng.
- [ ] Timesheet tuần và summary tháng đúng.
- [ ] Late/early/overtime/missing punch tạo exception.
- [ ] Missing punch không tự phát sinh payable time.
- [ ] Resolve/waive exception hoạt động.
- [ ] Submit/reject/resubmit/approve đúng state.
- [ ] Không tự approve.
- [ ] Lock period ngăn sửa sau duyệt.
- [ ] Leave và shift swap đi qua approval.
- [ ] `TIMESHEET_APPROVED.v1` phát qua outbox và retry được.

---

## 19. Giới hạn hiện tại

- UI gán ca đang dùng account ID; phiên bản tiếp theo nên có employee picker theo cluster.
- UI shift swap đang dùng prompt nhập target account ID; nên đổi thành modal có availability preview.
- Shift template đã có API nhưng chưa có màn cấu hình đầy đủ.
- API lịch cá nhân hiện chưa loại roster nháp khỏi kết quả; trước khi production cần lọc ca `ASSIGNED` để nhân viên chỉ thấy lịch đã publish và lịch sử ca của chính mình.
- Missing punch hiện tạo exception và payable bằng 0; chưa có correction request riêng cho nhân viên đề xuất giờ thay thế.
- Chưa có geolocation, device trust hoặc biometric attendance.
- Chưa có pay policy theo hợp đồng, ca đêm, ngày lễ hoặc collective agreement.
- Chưa có adjustment ledger sau khi timesheet đã khóa.

---

## 20. Hướng phát triển P2

Thứ tự khuyến nghị:

1. Attendance correction request cho missing punch.
2. Pay policy versioned theo cluster/contract/effective date.
3. Holiday và night-shift premium.
4. Overtime approval tách khỏi attendance exception chung.
5. Payroll period và payroll run.
6. Snapshot input từ `TIMESHEET_APPROVED.v1`.
7. Gross-to-net, deduction, tax và insurance.
8. Payslip, bank export và finance approval.
9. Adjustment ledger cho thay đổi sau lock.
10. Audit/export phục vụ Finance Officer và Security Auditor.
