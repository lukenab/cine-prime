# [Backend] Implement Employee Management API (user-service)

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`, `In Progress`
**Branch:** `feat/employee-management-api`

---

## Summary / Objective

Triển khai toàn bộ Employee CRUD API trong `user-service`. Hiện tại entity `Employee` đã có nhưng thiếu generation strategy, sử dụng `Integer` thô cho status, và chưa có Repository/Service/Controller nào. Admin cần API này để quản lý nhân viên theo đặc tả SRS mục 3.1.7.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [x] `Employee` entity được cập nhật: `employeeId` length 36, `@CreationTimestamp`/`@UpdateTimestamp`, `status` dùng enum `EmployeeStatus`
- [x] `EmployeeStatus` enum có 2 giá trị: `ACTIVE`, `DISABLED`
- [x] `POST /api/employees` — tạo employee mới, validate accountId phải tồn tại trong `users`, không cho tạo 2 employee cùng 1 account
- [x] `GET /api/employees/{id}` — lấy chi tiết employee (bao gồm user profile)
- [x] `GET /api/employees?page=1&size=10` — danh sách có phân trang
- [x] `PUT /api/employees/{id}` — cập nhật position, hireDate (null-safe)
- [x] `DELETE /api/employees/{id}` — soft delete: đổi status → `DISABLED` (theo SRS: "delete = Disable(2)")
- [x] Các error code riêng: `EMPLOYEE_NOT_FOUND`, `EMPLOYEE_ALREADY_DISABLED`, `ACCOUNT_ALREADY_EMPLOYEE`
- [x] API Gateway route `/api/employees/**` → `user-service`
- [x] `EmployeeResponse` gộp cả employee fields + user profile fields (fullName, phone, dob, gender, address, identityCard, avatarUrl)

---

## API Specifications

### API 1 — Create Employee

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/employees` |
| Description | Tạo employee mới, liên kết với User profile qua accountId |
| Auth Required | Yes (Admin) |

**Request Body:**
```json
{
  "accountId": "uuid-of-existing-user",
  "position": "Cashier",
  "hireDate": "2024-01-15"
}
```

**Response 200 OK:**
```json
{
  "code": 1000,
  "result": {
    "employeeId": "uuid-generated",
    "accountId": "uuid-of-user",
    "fullName": "Nguyen Van An",
    "position": "Cashier",
    "hireDate": "2024-01-15",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T08:00:00",
    "updatedAt": "2024-01-15T08:00:00"
  }
}
```

**Response (Error):**
```json
{ "code": 2003, "message": "User profile not found!" }
{ "code": 2022, "message": "This account is already linked to an employee!" }
```

---

### API 2 — Get All Employees (paged)

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/employees?page=1&size=10` |
| Auth Required | Yes (Admin) |

**Response 200 OK:**
```json
{
  "code": 1000,
  "result": {
    "currentPage": 1,
    "totalPages": 3,
    "pageSize": 10,
    "totalElements": 25,
    "data": [ /* EmployeeResponse[] */ ]
  }
}
```

---

### API 3 — Update Employee

| Field | Details |
|---|---|
| Method | `PUT` |
| Endpoint | `/api/employees/{id}` |
| Auth Required | Yes (Admin) |

**Request Body:**
```json
{
  "position": "Supervisor",
  "hireDate": "2024-03-01"
}
```
> Null-safe: chỉ cập nhật field được gửi lên.

---

### API 4 — Disable Employee (Soft Delete)

| Field | Details |
|---|---|
| Method | `DELETE` |
| Endpoint | `/api/employees/{id}` |
| Description | Đổi status → DISABLED. Không xoá record khỏi DB (theo SRS) |
| Auth Required | Yes (Admin) |

**Response 200 OK:**
```json
{ "code": 1000, "message": "Employee has been disabled" }
```

**Response (Error):**
```json
{ "code": 2021, "message": "Employee is already disabled!" }
```

---

## Technical Notes / Constraints

- `employeeId` được generate bằng `UUID.randomUUID()` trong service (không dùng `@GeneratedValue` vì String PK)
- `EmployeeStatus` lưu dạng STRING trong DB (`@Enumerated(EnumType.STRING)`) để dễ đọc
- `EmployeeMapper` (MapStruct) map nested `employee.user.*` → flat `EmployeeResponse`
- `AuditLogService` được gọi cho tất cả CREATE/UPDATE/DELETE để đảm bảo audit trail nhất quán với `UserService`
- SRS data diagram (trang 64): `EMPLOYEE_ID` là PK riêng (không dùng `@MapsId`)

---

## Related

- Branch: `feat/employee-management-api`
- Depends on: `user-service` (User entity, UserRepository), `api-gateway` route config
- Docs: `docs/ISSUE_TEMPLATE.md`, SRS mục 3.1.7 (Employee Management)
- Follow-up: `[Frontend] Connect Employee Management UI to Backend API`
