# Danh mục role và vận hành phân quyền CinePrime

## 1. Mục đích và Source of Truth

Tài liệu này giải thích mục đích của từng staff role, phạm vi làm việc, giao diện quản trị được phép sử dụng và cách kiểm thử quyền truy cập. Đây là tài liệu hướng dẫn vận hành, không phải Source of Truth quyết định phân quyền tại runtime.

Source of Truth của hệ thống gồm:

1. Các bảng `auth_db.roles`, `permission` và `role_permissions` lưu role và capability.
2. Staff Assignment đang hoạt động do `user-service` sở hữu, bao gồm Employee Status và Cluster Scope.
3. Bảng `auth_db.staff_access_projection` lưu Authorization Projection cục bộ tại Auth để phát hành token theo nguyên tắc fail-closed.
4. Backend Authorization thực thi permission. Việc ẩn hoặc hiện mục trên sidebar chỉ phục vụ navigation, không thay thế kiểm tra bảo mật.
5. Riêng frontline `EMPLOYEE`, Auth áp dụng thêm versioned Access Profile policy; xem [FRONTLINE_CAPABILITY_ACCESS.md](./FRONTLINE_CAPABILITY_ACCESS.md).

Mọi thay đổi thực hiện qua Access Matrix phải được ghi Audit Log và có Contract Test tương ứng. Không cấp permission trực tiếp cho từng tài khoản cá nhân.

### Quy ước thuật ngữ

| Thuật ngữ sử dụng | Ý nghĩa trong CinePrime |
|---|---|
| Identity & Access Management (`IAM`) | Quản lý tài khoản, danh tính, role và permission |
| Role-Based Access Control (`RBAC`) | Cấp capability thông qua role thay vì cấp trực tiếp cho từng người dùng |
| Staff Assignment | Phân công công việc, role nghiệp vụ và phạm vi chi nhánh của nhân viên |
| Cluster Scope | Danh sách cụm rạp mà tài khoản được phép truy cập |
| Authorization Projection | Bản sao tối thiểu tại Auth phục vụ kiểm tra quyền và phát hành token |
| Source of Truth | Service hoặc database sở hữu dữ liệu chuẩn của một nghiệp vụ |
| Separation of Duties (`SoD`) | Phân tách người chuẩn bị và người phê duyệt một quyết định |
| Maker/Checker | Cặp role tạo hoặc chuẩn bị dữ liệu và role kiểm tra hoặc phê duyệt |
| Fail-closed | Từ chối quyền khi thiếu dữ liệu hoặc không xác nhận được trạng thái hợp lệ |

## 2. Danh mục vai trò

| Role | Chức năng nghiệp vụ | Scope | Primary Workspace | Business Owner |
|---|---|---|---|---|
| `EMPLOYEE` | Base role cho self-service; nghiệp vụ quầy được cấp theo Access Profile | Assigned Cluster | Employee Workspace, My Schedule & Time | Branch Operations |
| `BRANCH_MANAGER` | Điều hành một hoặc nhiều chi nhánh và quản lý đội ngũ tại rạp | Assigned Clusters | Workforce Operations, My Schedule & Time, Branch Operations | Regional Operations |
| `PROGRAMMING_OPERATOR` | Chuẩn bị nội dung phim, kế hoạch phát hành và bản nháp lịch chiếu | Trụ sở chính | Film Programming | Head of Programming |
| `PROGRAMMING_APPROVER` | Kiểm tra và phê duyệt nội dung, kế hoạch phát hành, lịch chiếu | Trụ sở chính | Programming Approval Queue | Head of Programming |
| `FINANCE_OFFICER` | Điều tra yêu cầu hoàn tiền và sai lệch đối soát | Trụ sở chính hoặc Finance Scope được giao | Refunds & Reconciliation | Finance Controller |
| `FINANCE_APPROVER` | Phê duyệt quyết định tài chính do Finance Officer chuẩn bị | Trụ sở chính | Finance Approval Queue, Audit Evidence | Finance Controller/CFO Delegate |
| `COMMERCIAL_MANAGER` | Chuẩn bị bảng giá và chiến dịch khuyến mãi | Trụ sở chính | Price Books, Promotions | Commercial Director |
| `COMMERCIAL_APPROVER` | Duyệt khuyến mãi và kiểm soát vòng đời chiến dịch | Trụ sở chính | Promotion Approval Queue | Commercial Director Delegate |
| `SECURITY_AUDITOR` | Kiểm tra bằng chứng bảo mật và vận hành nhưng không được sửa dữ liệu | Organization-wide, Read-only | Audit Trail, Reports | Risk & Compliance |
| `SYSTEM_ADMIN` | Quản trị Identity & Access Management và cấu hình nền tảng | Organization-wide Platform Scope | People & Access, Access Matrix, Settings | IT Operations |
| `ADMIN` | Role tương thích tạm thời trong giai đoạn chuyển đổi | Broad Legacy Scope | Platform Administration | Migration Owner |

Không cấp `ADMIN` cho người dùng mới. Các tài khoản còn lại phải được chuyển sang vai trò nghiệp vụ phù hợp và loại bỏ role này sau ngày **2026-10-01**.

Chi tiết mapping giữa Department, Access Profile, capability, Cluster Scope và quy trình test employee được đặc tả tại [FRONTLINE_CAPABILITY_ACCESS.md](./FRONTLINE_CAPABILITY_ACCESS.md). Không gán toàn bộ quyền bán vé, booking và concession trực tiếp cho base role `EMPLOYEE`.

## 3. Employee Self-service và Platform Administration

`My Schedule & Time` là chức năng self-service dành cho nhân viên. Người dùng chỉ được truy cập khi đáp ứng đầy đủ:

- role có permission `WORKFORCE_SELF_READ`;
- Staff Assignment trong projection đang ở trạng thái active;
- có Cluster Scope hợp lệ đối với role theo phạm vi chi nhánh (`EMPLOYEE`, `BRANCH_MANAGER`).

`SYSTEM_ADMIN`, `SECURITY_AUDITOR` và legacy `ADMIN` không tự động có quyền self-service chỉ vì họ quản trị nền tảng. Nếu một quản trị viên đồng thời làm công việc vận hành tại rạp, doanh nghiệp nên sử dụng tài khoản công việc riêng hoặc tạo phân công nhân viên rõ ràng bằng role vận hành phù hợp.

## 4. Separation of Duties (SoD)

| Maker Role | Checker Role | SoD Conflict bị cấm |
|---|---|---|
| `PROGRAMMING_OPERATOR` | `PROGRAMMING_APPROVER` | Không được tự duyệt phim, release plan hoặc lịch chiếu do chính mình gửi |
| `FINANCE_OFFICER` | `FINANCE_APPROVER` | Không được tự phê duyệt quyết định hoàn tiền do chính mình chuẩn bị |
| `COMMERCIAL_MANAGER` | `COMMERCIAL_APPROVER` | Không được tự duyệt hoặc kích hoạt khuyến mãi do chính mình tạo |
| `SYSTEM_ADMIN` | `SECURITY_AUDITOR` | Người thay đổi quyền không được là người duy nhất kiểm tra thay đổi của chính mình |

Các quy tắc trên phải được thực thi trong policy của backend workflow, không chỉ bằng cách ẩn nút trên giao diện.

## 5. Local QA Accounts

Cấu hình `.env` local bật `DEMO_STAFF_ACCOUNTS_ENABLED` để tạo một tài khoản cho mỗi role nhân sự. Các tài khoản dưới đây đều sử dụng mật khẩu `12345678` theo yêu cầu kiểm thử.

| Role | Username | Password | Default Landing Page |
|---|---|---|---|
| `EMPLOYEE` | `employee` | `12345678` | `/employee` |
| `BRANCH_MANAGER` | `branchmanager` | `12345678` | `/admin/workforce` |
| `PROGRAMMING_OPERATOR` | `programmingoperator` | `12345678` | `/admin/programming` |
| `PROGRAMMING_APPROVER` | `programmingapprover` | `12345678` | `/admin/release-plans` |
| `FINANCE_OFFICER` | `financeofficer` | `12345678` | `/admin/refunds-reconciliation` |
| `FINANCE_APPROVER` | `financeapprover` | `12345678` | `/admin/refunds-reconciliation` |
| `COMMERCIAL_MANAGER` | `commercialmanager` | `12345678` | `/admin/price-books` |
| `COMMERCIAL_APPROVER` | `commercialapprover` | `12345678` | `/admin/promotions` |
| `SECURITY_AUDITOR` | `securityauditor` | `12345678` | `/admin/audit` |
| `SYSTEM_ADMIN` | `systemadmin` | `12345678` | `/admin/people` |

Lưu ý:

- `MEMBER` không phải tài khoản nhân sự seed sẵn; tài khoản được tạo qua luồng đăng ký khách hàng.
- Legacy `ADMIN` không nằm trong bộ demo role ở trên. Credential của tài khoản này do `ADMIN_USERNAME` và `ADMIN_PASSWORD` trong môi trường quyết định.
- Docker Compose mặc định tắt demo fixture; mỗi môi trường phải chủ động bật nếu cần dữ liệu QA.
- Môi trường production bắt buộc đặt `DEMO_STAFF_ACCOUNTS_ENABLED=false`.
- Không sử dụng mật khẩu `12345678` ngoài máy phát triển hoặc môi trường QA cô lập.
- Projection demo sử dụng assignment version `-1`; canonical event đầu tiên từ `user-service` có version từ `0` trở lên sẽ thay thế projection này.
- Có thể tắt việc phát profile demo bằng `DEMO_STAFF_PUBLISH_PROFILES=false`.

## 6. Manual UI Authorization Matrix

Với từng tài khoản, đăng nhập tại `/login`, kiểm tra trang đích, sau đó thử cả một URL được phép và một URL bị cấm.

| Trường hợp | Kết quả mong đợi |
|---|---|
| Employee mở `/employee/workforce` | Hiển thị lịch làm việc và chấm công của chính mình |
| Employee mở `/admin/workforce` | Bị từ chối hoặc chuyển hướng |
| Branch Manager mở `/admin/my-workforce` | Hiển thị lịch làm việc cá nhân |
| Branch Manager mở `/admin/workforce` | Hiển thị roster và luồng duyệt đội ngũ trong cụm rạp được phân công |
| System Admin mở `/admin/people` và `/admin/access-matrix` | Được phép truy cập |
| System Admin mở `/admin/my-workforce` | Không xuất hiện trên sidebar và route bị từ chối |
| Legacy Admin mở `/admin/my-workforce` | Không xuất hiện trên sidebar và route bị từ chối |
| Programming Operator tạo/sửa bản nháp phim hoặc release plan | Được phép; thao tác phê duyệt không hiển thị hoặc bị từ chối |
| Programming Approver mở hàng đợi phê duyệt | Được phép; thao tác tạo bản nháp không hiển thị hoặc bị từ chối |
| Finance Officer chuẩn bị quyết định hoàn tiền | Được phép; không được phê duyệt cuối cùng |
| Finance Approver duyệt quyết định do người khác tạo | Được phép và phải có audit log |
| Commercial Manager tạo và submit khuyến mãi | Được phép; không được duyệt hoặc kích hoạt |
| Commercial Approver duyệt/kích hoạt khuyến mãi đã submit | Được phép; không được tạo hoặc sửa bản nháp |
| Security Auditor mở Audit Trail | Chỉ đọc, không có thao tác thay đổi role hoặc dữ liệu |

Kiểm tra thêm nguyên tắc fail-closed: vô hiệu hóa phân công nhân viên, đăng nhập lại và xác nhận hệ thống từ chối phát hành quyền đặc quyền hoặc từ chối endpoint đặc quyền ngay cả khi `user-service` đang dừng.

## 7. Access Lifecycle

1. **Joiner:** gửi invitation từ People & Access; không tạo staff role qua public account endpoint.
2. **Activation:** nhân viên tự đặt password; `user-service` sở hữu profile và Staff Assignment.
3. **Transfer:** cập nhật role hoặc Cluster Scope tại `user-service`, phát versioned event và để Auth cập nhật projection một cách idempotent.
4. **Suspension:** vô hiệu hóa assignment và revoke toàn bộ active sessions.
5. **Leaver:** vô hiệu hóa account và assignment, revoke token nhưng giữ lại Audit History.
6. **Quarterly Access Review:** Business Owner kiểm tra role membership, Cluster Scope và các SoD Conflict.

## 8. Definition of Done khi thêm role mới

- Role và permission tồn tại trong catalog/migration của Auth database.
- `user-service` có validation tương ứng cho job role, department và access role.
- Contract test cho invitation, activation, projection và login đều pass.
- Có navigation profile tập trung và default landing route riêng.
- Có test endpoint được phép và bị từ chối.
- Có test cluster scope và inactive-assignment fail-closed nếu role có phạm vi chi nhánh.
- Xung đột maker-checker được mô tả và thực thi tại backend.
- Chỉ tạo tài khoản QA local khi demo seed được bật rõ ràng.
