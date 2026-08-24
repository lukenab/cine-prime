# Phân quyền nhân viên tuyến đầu theo capability

## 1. Mục tiêu

Thiết kế này thay mô hình “mọi tài khoản `EMPLOYEE` đều nhìn thấy mọi chức năng vận hành” bằng hai lớp độc lập:

- `EMPLOYEE` là **base role** dùng chung cho employee self-service.
- `Access Profile` mô tả nhóm công việc thực tế và quyết định các business capability được cấp.
- `Cluster Scope` giới hạn capability đó vào đúng cinema cluster được phân công.

Ví dụ: nhân viên `BOX_OFFICE` có thể bán vé tại cluster 43 nhưng không được xử lý đơn concession và không được bán vé tại cluster khác.

## 2. Data ownership và luồng projection

| Dữ liệu | Source of Truth | Trách nhiệm |
|---|---|---|
| Credential, role, permission catalog | `auth-service` | Xác thực và phát JWT |
| Employee profile, department, assignment status, cluster | `user-service` | Quản lý hồ sơ và phân công |
| Staff Access Projection | `auth-service` | Bản sao tối thiểu để login không gọi đồng bộ sang User |

`user-service` phát canonical event `STAFF_ACCESS_*` version `2` với payload tối thiểu:

```json
{
  "accountId": "employee-account-id",
  "accountRole": "EMPLOYEE",
  "accessProfile": "BOX_OFFICE",
  "assignmentStatus": "ACTIVE",
  "cinemaClusterIds": ["43"],
  "assignmentVersion": 3
}
```

Auth lưu `accessProfile`, cluster IDs, event ID, event version và assignment version cuối đã xử lý. Event trùng hoặc cũ không được rollback projection. Event v1 không có `accessProfile` được lưu thành `UNASSIGNED` và chỉ nhận quyền self-service theo nguyên tắc fail-closed.

Trong giai đoạn hiện tại, mapping `Access Profile -> capability` là policy do `StaffAccessProjectionService` của Auth sở hữu và được bảo vệ bằng test. Access Matrix vẫn quản lý role-permission thông thường; không dùng Access Matrix để cấp rộng permission trực tiếp cho base role `EMPLOYEE`. Giai đoạn tiếp theo có thể chuyển profile bundle sang bảng versioned riêng kèm audit log và approval workflow.

JWT của staff chứa các claim liên quan:

```json
{
  "staffAssignmentActive": true,
  "staffAccessProfile": "BOX_OFFICE",
  "cinemaClusterIds": ["43"],
  "scope": "ROLE_EMPLOYEE WORKFORCE_SELF_READ ... TICKET_SELL"
}
```

## 3. Capability matrix cho frontline employee

Mọi profile đang active đều nhận capability nền:

- `WORKFORCE_SELF_READ`
- `ATTENDANCE_CLOCK`
- `TIMESHEET_SUBMIT`
- `WORKFORCE_REQUEST`

Capability nghiệp vụ được cộng thêm theo profile:

| Access Profile | Phạm vi công việc | Capability chính | Menu employee |
|---|---|---|---|
| `BOX_OFFICE` | Bán vé và hỗ trợ booking tại quầy | `MOVIE_READ`, `SHOWTIME_READ`, `BOOKING_READ`, `BOOKING_CONFIRM`, `BOOKING_CANCEL`, `TICKET_SELL`, `TICKET_CHECK_IN` | Customer Operations |
| `FOOD_BEVERAGE` | Chuẩn bị và bàn giao đơn concession | `CONCESSION_FULFILLMENT_READ`, `CONCESSION_FULFILLMENT_UPDATE` | Food & Beverage |
| `FLOOR_GUEST_SERVICES` | Tra cứu booking, hỗ trợ khách và check-in | `BOOKING_READ`, `BOOKING_CONFIRM`, `TICKET_CHECK_IN` | Customer Operations |
| `GENERAL_OPERATIONS` | Hồ sơ QA/điều phối vận hành tổng hợp | Toàn bộ capability frontline ở trên | Customer Operations và Food & Beverage |
| `PROJECTION_TECHNICAL` | Tra cứu phim và lịch chiếu phục vụ kỹ thuật | `MOVIE_READ`, `SHOWTIME_READ` | Không hiện nghiệp vụ quầy |
| `FACILITIES_MAINTENANCE` | Bảo trì cơ sở vật chất | Chưa có capability nghiệp vụ số ngoài self-service | My Work |
| `UNASSIGNED` | Projection cũ hoặc chưa xác định bộ phận | Chỉ capability nền | My Work |

`GENERAL_OPERATIONS` phù hợp cho demo hoặc vị trí thật sự kiêm nhiệm. Không dùng profile này làm mặc định cho mọi employee trong production.

## 4. Enforcement và quy tắc fail-closed

Mỗi request đặc quyền phải qua cả ba lớp:

1. Frontend navigation chỉ hiện menu khi JWT có capability tương ứng.
2. Frontend route guard từ chối truy cập URL trực tiếp khi thiếu capability.
3. Resource service kiểm tra capability bằng method security và kiểm tra cluster bằng `ClusterAccessPolicy`.

Các endpoint chính:

| Endpoint | Capability | Scope check |
|---|---|---|
| `GET /api/booking-operations/clusters/{clusterId}/bookings` | `BOOKING_READ` | `clusterId` phải thuộc JWT |
| `POST /api/booking-operations/clusters/{clusterId}/counter-sales` | `TICKET_SELL` | `clusterId` phải thuộc JWT |
| `POST /api/booking-operations/clusters/{clusterId}/bookings/{bookingId}/check-in` | `TICKET_CHECK_IN` | `clusterId` phải thuộc JWT |
| `GET /api/employee/concession-orders?clusterId=...` | `CONCESSION_FULFILLMENT_READ` | `clusterId` phải thuộc JWT |
| `POST /api/employee/concession-orders/{id}/{action}` | `CONCESSION_FULFILLMENT_UPDATE` | Order phải thuộc cluster được cấp |

Khi thiếu projection, assignment inactive, access profile không hợp lệ hoặc cluster scope rỗng, Auth không phát staff role/capability đặc quyền. Backend phải trả `403 Forbidden`; không chuyển lỗi phân quyền thành `500 Internal Server Error`.

Cluster ID trong assignment phải là canonical numeric ID, ví dụ `"43"`. Không dùng mã hiển thị như `CINE-HCM-01`, vì resource service đối chiếu với khóa `clusterId` kiểu số.

## 5. Ticket Sales không còn là mock

Trang `/employee/sell` sử dụng dữ liệu thật:

1. Lọc cinema cluster theo `cinemaClusterIds` trong JWT.
2. Tải showtime `ON_SALE` và live seat inventory.
3. Cho phép chọn tối đa 8 ghế còn available.
4. Gửi counter sale cùng `terminalId`, payment method, receipt reference và `Idempotency-Key`.
5. Chỉ hiển thị booking code/receipt sau khi booking-service xác nhận thành công.

Payment method được hỗ trợ: `CASH`, `CARD`, `QR`, `BANK_TRANSFER`. UI hiện dùng Cash, Card và Bank transfer. `Idempotency-Key` được đổi khi đổi cinema/showtime hoặc bắt đầu giao dịch mới để tránh ghi nhận trùng.

## 6. Navigation terminology

Không dùng section header chung chung `OPS`. Employee workspace dùng các nhóm theo tác vụ:

- **My Work**: My Schedule & Time.
- **Customer Operations**: Ticket Sales, Booking Lookup.
- **Food & Beverage**: Order Fulfillment.

Menu thiếu capability sẽ không xuất hiện. Đây là cải thiện UX; backend authorization vẫn là lớp bảo vệ quyết định.

## 7. Migration cho assignment hiện có

Event v1 không có department-derived profile nên được chuyển thành `UNASSIGNED`. Để nâng projection cũ lên v2:

1. Xác nhận employee có department đúng và cinema ID dạng số tại People & Access.
2. Mở assignment, chọn đúng Job role/Department và Cinema branch rồi lưu lại.
3. `user-service` tăng `assignmentVersion` và phát `STAFF_ACCESS_UPDATED` v2.
4. Auth consumer cập nhật projection.
5. Revoke session cũ hoặc yêu cầu employee sign out/sign in để nhận JWT mới.

Không sửa trực tiếp permission hoặc `staff_access_projection` trong Auth database. Nếu cần backfill số lượng lớn, triển khai command replay có audit và tăng assignment version ở `user-service`.

## 8. Manual UI test cases

### FT-AUTH-001 — Box Office chỉ thấy chức năng quầy

1. Tạo/invite employee có department `BOX_OFFICE`, cluster 43 và role `EMPLOYEE`.
2. Activate account và login lại sau khi event v2 đã được consume.
3. Kiểm tra sidebar.

Kỳ vọng: thấy My Work, Ticket Sales và Booking Lookup; không thấy Order Fulfillment.

### FT-SALE-001 — Bán vé thật tại cluster được phân công

1. Mở Ticket Sales.
2. Chọn showtime `ON_SALE`, chọn ghế available, payment method và xác nhận.
3. Kiểm tra booking code và receipt reference.
4. Mở Booking Lookup tại cùng cluster.

Kỳ vọng: booking thật xuất hiện; gửi lại cùng `Idempotency-Key` không tạo booking thứ hai.

### FT-SCOPE-001 — Không truy cập cluster khác

1. Login bằng employee chỉ có cluster 43.
2. Gọi `GET /api/booking-operations/clusters/45/bookings` bằng token đó.

Kỳ vọng: `403 Forbidden`; UI không liệt kê cluster 45.

### FT-FNB-001 — Food & Beverage chỉ xử lý fulfillment

1. Login bằng employee có profile `FOOD_BEVERAGE`.
2. Mở `/employee/concessions/fulfillment`.
3. Thử mở trực tiếp `/employee/sell`.

Kỳ vọng: fulfillment tải đơn trong cluster được giao; Ticket Sales bị route guard từ chối và backend counter-sales trả `403` nếu gọi trực tiếp.

### FT-FAIL-001 — Assignment inactive

1. Suspend assignment rồi revoke active sessions.
2. Login lại hoặc dùng refresh flow.

Kỳ vọng: không nhận `ROLE_EMPLOYEE`/frontline capability; endpoint đặc quyền bị từ chối ngay cả khi `user-service` đang dừng.

### FT-LEGACY-001 — Projection v1

1. Dùng account có projection v1 chưa backfill.
2. Login và kiểm tra token/sidebar.

Kỳ vọng: `staffAccessProfile=UNASSIGNED`, chỉ thấy My Work; không được suy đoán hoặc tự cấp quyền quầy.

## 9. Automated verification

- Auth projection test chứng minh event v2 tạo capability đúng profile và v1 fail-closed.
- JWT test chứng minh token chỉ chứa capability của projected profile và cluster scope.
- User publisher test chứng minh department được phát thành `accessProfile` v2.
- Frontend cluster-scope test chứng minh branch-scoped role chỉ nhìn thấy cluster trong token.
- Frontend route-guard test chứng minh URL trực tiếp vẫn yêu cầu capability.
