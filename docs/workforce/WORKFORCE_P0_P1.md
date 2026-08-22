# Workforce P0/P1

> Đặc tả đầy đủ về kiến trúc, contract, phân quyền và test case UI: [WORKFORCE_SERVICE_SPECIFICATION_P0_P1.md](WORKFORCE_SERVICE_SPECIFICATION_P0_P1.md).

## 1. Mục tiêu và ranh giới

Module `workforce-service` chịu trách nhiệm lập lịch làm việc và xác nhận thời gian công có thể thanh toán. Module không sở hữu hồ sơ nhân viên, tài khoản đăng nhập hoặc bảng lương:

- `user-service` vẫn là nguồn chuẩn của nhân viên, trạng thái phân công và phạm vi cụm rạp.
- `auth-service` vẫn phát hành JWT và permission.
- `workforce-service` duy trì projection tối thiểu từ `staff-access.events.v1`, không gọi đồng bộ sang User khi xử lý nghiệp vụ.
- Bảng lương chưa được tính trong P0/P1. Event `TIMESHEET_APPROVED.v1` là hợp đồng đầu vào cho payroll ở giai đoạn tiếp theo.

## 2. Phạm vi đã triển khai

### P0 - Scheduling foundation

- Database riêng `workforce_db`, schema quản lý bằng Flyway.
- Projection nhân viên cục bộ, có `eventId`, `eventVersion` và `assignmentVersion` để xử lý idempotent.
- Shift template, roster theo cụm rạp, gán ca và publish roster.
- Chặn nhân viên inactive, sai phạm vi cụm, ca chồng nhau, nghỉ giữa hai ca dưới 12 giờ và ca dài quá 24 giờ.
- Phân quyền riêng cho cấu hình, lập lịch và publish; mọi command quan trọng có audit log.
- UI quản lý tại `/admin/workforce`; UI cá nhân tại `/employee/workforce` (employee) hoặc `/admin/my-workforce` (branch manager).

### P1 - Attendance and approval

- Clock-in/clock-out cần `Idempotency-Key`; raw punch được lưu bất biến.
- Tách `actual time`, `regular time`, `overtime` và `payable time`.
- Tự động tạo timesheet tuần Thứ Hai-Chủ Nhật, summary tháng và các exception `LATE`, `EARLY_LEAVE`, `OVERTIME`, `MISSING_CLOCK_IN/OUT`.
- Nhân viên submit timesheet; người duyệt không thể tự duyệt timesheet của chính mình.
- Exception phải được resolve/waive trước khi approve.
- Shift swap và leave request có luồng `SUBMITTED -> APPROVED/REJECTED`.
- Timesheet được duyệt ghi event vào transactional outbox trong cùng transaction; publisher retry phát canonical event `TIMESHEET_APPROVED`, version `1` lên `workforce.timesheet.events.v1`.
- Manager khóa kỳ `APPROVED -> LOCKED` trước khi bàn giao payroll; dữ liệu đã khóa không được sửa.

## 3. State machine

- Roster: `DRAFT -> PUBLISHED -> IN_OPERATION -> CLOSED`.
- Shift: `ASSIGNED -> PUBLISHED -> IN_PROGRESS -> COMPLETED`; leave được duyệt có thể chuyển ca sang `CANCELLED`.
- Timesheet: `OPEN/REJECTED -> SUBMITTED -> APPROVED -> LOCKED`.
- Leave/shift swap: `SUBMITTED -> APPROVED | REJECTED`.

Không sửa trực tiếp raw punch hoặc timesheet đã approve. Điều chỉnh công sau khi khóa kỳ phải dùng adjustment record ở payroll P2.

## 4. Khởi động

Với Docker volume mới:

```powershell
docker compose up -d --build postgres kafka discovery-server workforce-service api-gateway
```

Với PostgreSQL volume cũ chưa có database mới, chạy một lần:

```powershell
docker exec postgres psql -U postgres -d postgres -c "CREATE DATABASE workforce_db"
docker compose up -d --build workforce-service api-gateway
```

Kiểm tra:

```powershell
curl.exe http://localhost:8091/actuator/health
```

Kết quả mong đợi: `{"status":"UP"}`. Sau khi auth-service được cập nhật/restart, đăng xuất và đăng nhập lại để JWT nhận permission mới.

## 5. Test thủ công qua UI

### 5.1 Chuẩn bị

1. Tạo một `BRANCH_MANAGER` và ít nhất hai `EMPLOYEE` đang active, cùng một `cinemaClusterId`.
2. Đảm bảo user-service đã phát event projection. Nếu nhân viên có trước khi workforce-service chạy, restart user-service để bootstrap phát lại projection.
3. Đăng nhập lại các tài khoản sau khi auth-service seed permission.

### 5.2 Manager - roster

1. Đăng nhập `BRANCH_MANAGER`, mở **Business Operations > Workforce** (`/admin/workforce`).
2. Chọn đúng cụm rạp, bấm **New roster**, tạo kỳ 7 ngày.
3. Bấm **Assign shift**, nhập account ID của nhân viên, giờ bắt đầu/kết thúc và break.
4. Thử tạo ca chồng hoặc nghỉ dưới 12 giờ: hệ thống phải từ chối.
5. Bấm **Publish**. Roster và ca phải chuyển sang `PUBLISHED`.

### 5.3 Employee - attendance

1. Đăng nhập `EMPLOYEE`, mở **My Schedule & Time** (`/employee/workforce`).
2. Ca đã publish phải xuất hiện; bấm **Clock in**, sau đó **Clock out**.
3. Tab **Timesheets** phải có timesheet tuần, regular/overtime và exception nếu chấm công lệch lịch.
4. Bấm **Submit current**. Trạng thái phải thành `SUBMITTED`.

### 5.4 Manager - approval

1. Quay lại `/admin/workforce`, mở tab **Timesheets**.
2. Nếu có exception, bấm **Resolve** hoặc **Waive** kèm lý do.
3. Bấm **Approve**; trạng thái phải thành `APPROVED` và Kafka nhận một event `TIMESHEET_APPROVED` v1.
4. Bấm **Lock period**; trạng thái phải thành `LOCKED` và mọi thay đổi sau khóa bị từ chối.
5. Thử dùng chính tài khoản nhân viên để duyệt timesheet của mình: API phải fail-closed.

### 5.5 Leave và shift swap

1. Employee mở tab **Requests**, tạo leave hoặc yêu cầu đổi ca.
2. Manager mở tab **Requests**, approve/reject.
3. Leave được approve phải hủy các ca trùng thời gian; swap được approve chỉ đổi assignee sau quyết định duyệt.

## 6. Smoke test API

Tất cả request đi qua `http://localhost:8080` và dùng `Authorization: Bearer <token>`.

Tạo roster:

```json
POST /api/workforce/admin/rosters
{
  "clusterId": "45",
  "periodStart": "2026-08-24",
  "periodEnd": "2026-08-30"
}
```

Gán ca:

```json
POST /api/workforce/admin/rosters/{rosterId}/shifts
{
  "accountId": "<employee-account-id>",
  "roleCode": "TEAM_MEMBER",
  "startsAt": "2026-08-24T09:00:00+07:00",
  "endsAt": "2026-08-24T17:00:00+07:00",
  "breakMinutes": 60,
  "note": "Front-of-house"
}
```

Publish và chấm công:

```text
POST /api/workforce/admin/rosters/{rosterId}/publish
POST /api/workforce/me/shifts/{shiftId}/clock-in
POST /api/workforce/me/shifts/{shiftId}/clock-out
```

Hai endpoint clock cần header `Idempotency-Key` khác nhau cho hai hành động. Gửi lại cùng key phải trả cùng kết quả và không sinh punch thứ hai.

## 7. Permission

| Permission | Mục đích |
|---|---|
| `WORKFORCE_SELF_READ` | Xem lịch và timesheet cá nhân |
| `ATTENDANCE_CLOCK` | Clock-in/clock-out |
| `TIMESHEET_SUBMIT` | Submit timesheet cá nhân |
| `WORKFORCE_REQUEST` | Tạo leave/swap request |
| `WORKFORCE_PLAN` | Tạo roster và gán ca |
| `WORKFORCE_PUBLISH` | Publish roster |
| `TIMESHEET_REVIEW` | Resolve exception, approve/reject timesheet |
| `WORKFORCE_REQUEST_APPROVE` | Approve/reject leave và swap |
| `WORKFORCE_CONFIG` | Quản lý shift template |

`EMPLOYEE` nhận nhóm self-service. `BRANCH_MANAGER` nhận cả self-service và quyền vận hành trong các cụm có trong JWT. `ADMIN/SUPER_ADMIN` được giữ tương thích legacy.

## 8. Việc chưa thuộc P0/P1

- Pay policy theo hợp đồng, ngày lễ, ca đêm và hệ số làm thêm.
- Payroll run, gross-to-net, thuế/bảo hiểm, payslip và bank export.
- Quy trình correction request chuyên biệt để nhân viên đề xuất giờ thay thế cho missing punch (P1 hiện chỉ tạo exception và không tự suy diễn giờ công).
- Biometric/GPS/device attestation.
- Adjustment ledger cho thay đổi sau khi timesheet đã khóa.

Các mục này nên là P2; không nên cộng trực tiếp tiền lương từ raw punch.
