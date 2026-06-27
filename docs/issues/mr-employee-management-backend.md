# MR: [Backend] Implement Employee Management API (user-service)

**Branch:** `feat/employee-management-api` → `develop`
**Related Issue:** Closes #<issue-number>

---

## Overview / Objective

Implement toàn bộ Employee CRUD API trong `user-service` theo đặc tả SRS mục 3.1.7. MR này bao gồm cập nhật entity, tạo mới EmployeeStatus enum, DTOs, Repository, Mapper, Service, Controller và cập nhật route API Gateway. Thao tác "xoá employee" được implement là soft delete (đổi status → DISABLED) đúng theo SRS.

Related Issue: Closes #<issue-number>

---

## Changes Introduced

**Controllers / Routes:**
- Thêm `EmployeeController.java` — 5 endpoints: `POST`, `GET /{id}`, `GET` (paged), `PUT /{id}`, `DELETE /{id}` tại `/api/employees`
- Cập nhật `api-gateway/application.yml` — thêm `/api/employees/**` vào route `user-service`

**Services / Logic:**
- Thêm `EmployeeService.java`:
  - `createEmployee` — validate accountId tồn tại, chặn duplicate, generate UUID, set `status = ACTIVE`
  - `getEmployeeById` — tìm hoặc throw `EMPLOYEE_NOT_FOUND`
  - `getAllEmployees` — phân trang, delegate sang `EmployeeMapper`
  - `updateEmployee` — null-safe update qua MapStruct `@BeanMapping`
  - `disableEmployee` — soft delete: set `status = DISABLED`, throw nếu đã disabled
  - Tất cả write operations gọi `AuditLogService` để đảm bảo audit trail

**DTOs / Mappers / Components:**
- `EmployeeCreateRequest.java` — `accountId` (required), `position` (required), `hireDate` (required)
- `EmployeeUpdateRequest.java` — `position`, `hireDate` (cả hai nullable, patch-style)
- `EmployeeResponse.java` — flat response gộp employee fields + user profile fields (fullName, phone, dob, gender, address, identityCard, avatarUrl)
- `EmployeeMapper.java` — MapStruct, map nested `user.accountId` / `user.fullName` / ... → flat response; `@BeanMapping(IGNORE)` cho update
- `EmployeeStatus.java` — enum `ACTIVE` / `DISABLED` (lưu dạng STRING)

**Database / JPA / Migration:**
- Cập nhật `Employee.java`:
  - `employeeId`: `length = 10` → `length = 36` (UUID-compatible)
  - `status`: `Integer` → `@Enumerated(EnumType.STRING) EmployeeStatus`
  - `createdAt`/`updatedAt`: manual set → `@CreationTimestamp` / `@UpdateTimestamp`
- `ddl-auto: update` sẽ tự alter cột `status` và `employee_id` khi khởi động

**Exception Handling / Error Codes:**
- `ErrorCode.java` — thêm 3 error code mới:
  - `EMPLOYEE_NOT_FOUND (2020, 404)`
  - `EMPLOYEE_ALREADY_DISABLED (2021, 400)`
  - `ACCOUNT_ALREADY_EMPLOYEE (2022, 409)`

---

## Key Architectural Decisions

- **Separate `employeeId` (không dùng `@MapsId`):** SRS data diagram (trang 64) định nghĩa `EMPLOYEE_ID VARCHAR2(10)` là PK riêng biệt so với `ACCOUNT_ID`. Dùng UUID (36 chars) thay vì VARCHAR(10) để nhất quán với các entity khác trong hệ thống.
- **`EnumType.STRING` thay vì `ORDINAL`:** Tránh bug khi thêm/sửa enum về sau. Giá trị trong DB là `"ACTIVE"` / `"DISABLED"` thay vì `0` / `1`.
- **Flat `EmployeeResponse`:** Gộp user profile vào response để frontend không cần gọi thêm `/api/users/{id}` khi render danh sách employee.
- **Soft delete qua `DELETE` endpoint:** Đúng theo SRS ("Successfully deleting = changing status to Disable(2)"). Record được giữ nguyên trong DB cho audit purposes.

---

## How to Test

1. Start `user-service` (port 8084) và `api-gateway` (port 8080)
2. Login admin để lấy `accessToken`:
   ```
   POST http://localhost:8080/api/auth/login
   { "username": "admin", "password": "123456" }
   ```
3. Lấy `accountId` của một user chưa có employee: `GET /api/users?page=1&size=5`
4. Tạo employee:
   ```
   POST http://localhost:8080/api/employees
   Authorization: Bearer <token>
   { "accountId": "<id>", "position": "Cashier", "hireDate": "2024-01-15" }
   ```
5. Verify response có đầy đủ user profile fields (fullName, phone, ...)
6. Test GET list: `GET /api/employees?page=1&size=10`
7. Update: `PUT /api/employees/{employeeId}` với `{ "position": "Supervisor" }`
8. Disable: `DELETE /api/employees/{employeeId}` → status phải là `DISABLED`
9. Disable lần 2 → phải trả `400 EMPLOYEE_ALREADY_DISABLED`
10. Tạo employee với accountId đã dùng → phải trả `409 ACCOUNT_ALREADY_EMPLOYEE`

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions (Lombok, `@FieldDefaults`, `@RequiredArgsConstructor`)

**Backend**
- [ ] No N+1 query issues (check Hibernate console output — `@OneToOne` fetch `user` trong Employee)
- [x] Exception handling uses correct error codes
- [ ] Endpoints tested via Postman / API client
- [ ] API contract / Postman collection updated

---

## Reviewer Notes

- Chú ý `@OneToOne` giữa `Employee` và `User` — JPA sẽ JOIN khi fetch. Nếu danh sách lớn cần xem xét thêm `@EntityGraph` hoặc DTO projection để tránh N+1.
- `ddl-auto: update` sẽ ALTER cột `employee_id` từ `varchar(10)` → `varchar(36)`. Nếu DB đã có data thì cần migration thủ công trước.
- `EmployeeMapper` dùng nested source mapping (`user.fullName` → `fullName`) — cần verify MapStruct generate đúng sau build.
