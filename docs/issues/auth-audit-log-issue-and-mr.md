# [Backend] Implement Auth Audit Log tracking

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`, `Review/ QA`  
**Branch:** `feat/auth-audit-log-tracking`

---

## Summary / Objective

Implement audit logging for security-sensitive activities in `auth-service`. The system needs to track authentication, registration, token, account, role, and permission events for operational visibility and security review. Audit logs must avoid storing sensitive raw values such as passwords, full phone numbers, full citizen IDs, or JWT tokens.

---

## Estimate

- [x] M (2-4h)

---

## Acceptance Criteria (Definition of Done)

- [x] Add `auth_audit_log` table/entity for auth-service activity tracking
- [x] Audit login success and login failure
- [x] Audit logout
- [x] Audit token refresh success and failure
- [x] Audit registration initiation, OTP resend, OTP verification failure, and registration completion
- [x] Audit account creation and account update
- [x] Audit role creation
- [x] Audit permission creation and deletion
- [x] Phone numbers are masked in audit metadata
- [x] Citizen IDs are masked in audit metadata
- [x] Passwords and JWT tokens are never stored in audit logs
- [x] Failed actions are still persisted even when the main transaction rolls back
- [x] Audit logging failure must not break the main business flow
- [x] Auth DB SQL documentation is updated with `auth_audit_log`

---

## API Specifications (if applicable)

No public API is added in this issue.

Audit logs are written internally by `auth-service`.

Future API suggestion for admin UI:

### API 1 - Get Auth Audit Logs

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/auth/audit-logs?page=1&size=20&action=LOGIN_FAILED&status=FAILED` |
| Description | Return paginated auth audit logs for admin security review |
| Auth Required | Yes, Admin only |

**Response 200 OK:**

```json
{
  "code": 1000,
  "result": {
    "currentPage": 1,
    "totalPages": 3,
    "pageSize": 20,
    "totalElements": 54,
    "data": [
      {
        "auditId": "uuid",
        "actorAccountId": "admin-account-id",
        "targetAccountId": "target-account-id",
        "action": "LOGIN_FAILED",
        "status": "FAILED",
        "message": "Invalid password",
        "ipAddress": "127.0.0.1",
        "userAgent": "Mozilla/5.0",
        "metadata": "{\"username\":\"admin\"}",
        "createdAt": "2026-06-29T18:30:25"
      }
    ]
  }
}
```

---

## Technical Notes / Constraints

- Use a dedicated `auth_audit_log` table in `auth_db`.
- Audit write operations should run in a separate transaction using `REQUIRES_NEW`.
- Audit write failures should be logged as warnings and must not break the main flow.
- Do not store passwords, password hashes, raw JWT tokens, or full citizen IDs.
- Mask phone number format example: `090****567`.
- Mask citizen ID format example: `092******442`.
- Store flexible event details in `metadata`.
- Use `actorAccountId` for the account performing the action.
- Use `targetAccountId` for the account affected by the action.
- `LOGIN_FAILED` for unknown username may have `targetAccountId = null`.

---

## Related

- Branch: `feat/auth-audit-log-tracking`
- Depends on: `auth-service`
- Docs: `docs/ISSUE_TEMPLATE.md`, `docs/database/auth-service/auth_db.sql`
- Follow-up: Add admin UI/API for viewing auth audit logs

---

# MR: [Backend] Implement Auth Audit Log tracking

**Branch:** `feat/auth-audit-log-tracking` -> `develop`  
**Related Issue:** Closes #<issue-number>

---

## Overview / Objective

Implement audit log tracking inside `auth-service` for authentication and account-security activities. This MR introduces a new `auth_audit_log` persistence model and writes audit records for login, registration, OTP, token refresh, logout, account, role, and permission events. Sensitive values such as passwords, JWT tokens, full phone numbers, and full citizen IDs are not stored.

Related Issue: Closes #<issue-number>

---

## Changes Introduced

**Controllers / Routes:**
- No new public endpoint added in this MR.
- Audit logs are written internally by service-layer operations.

**Services / Logic:**
- Added `AuthAuditLogService`
  - `success(...)` writes successful audit events
  - `failed(...)` writes failed audit events
  - Uses `REQUIRES_NEW` transaction so audit records survive rollback of the main transaction
  - Resolves IP address and User-Agent from the current request
  - Resolves actor from `SecurityContext`
  - Masks phone numbers and citizen IDs
  - Swallows audit persistence failures after logging a warning

- Updated `AuthenticationService`
  - Audits `REGISTER_INITIATED`
  - Audits `OTP_RESEND_REQUESTED`
  - Audits `REGISTER_OTP_VERIFIED` failures
  - Audits `REGISTER_COMPLETED`
  - Audits `LOGIN_SUCCESS`
  - Audits `LOGIN_FAILED`
  - Audits `LOGOUT`
  - Audits `TOKEN_REFRESH_SUCCESS`
  - Audits `TOKEN_REFRESH_FAILED`

- Updated `AccountService`
  - Audits `ACCOUNT_CREATED`
  - Audits `ACCOUNT_UPDATED`

- Updated `RoleService`
  - Audits `ROLE_CREATED`

- Updated `PermissionService`
  - Audits `PERMISSION_CREATED`
  - Audits `PERMISSION_DELETED`

**DTOs / Mappers / Components:**
- No DTO or mapper changes required.

**Database / JPA / Migration:**
- Added `AuthAuditLog` entity mapped to `auth_audit_log`.
- Added `AuthAuditLogRepository`.
- Updated `docs/database/auth-service/auth_db.sql` with `auth_audit_log` DDL.

**Exception Handling / Error Codes:**
- No new error code added.
- Existing business exceptions remain unchanged.
- Audit write errors are handled internally and do not change API responses.

---

## Key Architectural Decisions

- **Dedicated audit table:** Auth audit data is stored separately from account and token tables to keep security activity tracking clear and queryable.
- **`REQUIRES_NEW` for audit writes:** Failed login or failed OTP verification throws an exception and rolls back the main transaction. Audit logs must still persist, so audit writes run in a separate transaction.
- **Metadata as flexible JSON string:** Different audit events need different contextual fields, so `metadata` stores flexible serialized data instead of adding many nullable columns.
- **No sensitive raw data:** Passwords, JWT tokens, full phone numbers, and full citizen IDs are not stored. Phone and citizen ID values are masked.
- **No UI/API in this MR:** This MR only implements audit capture. Viewing logs should be implemented later as an admin-only feature.

---

## How to Test

1. Start required infrastructure:
   - PostgreSQL
   - Redis
   - Kafka, if testing full registration flow
   - Discovery server
   - Auth service
   - User service, if testing registration duplicate checks

2. Verify table exists:

   ```sql
   SELECT *
   FROM auth_audit_log
   ORDER BY created_at DESC;
   ```

3. Test login success:

   ```http
   POST http://localhost:8080/api/auth/login
   Content-Type: application/json
   ```

   ```json
   {
     "username": "admin",
     "password": "Admin@123456"
   }
   ```

   Expected DB record:

   ```text
   LOGIN_SUCCESS | SUCCESS
   ```

4. Test login failure:

   ```json
   {
     "username": "admin",
     "password": "wrong-password"
   }
   ```

   Expected DB record:

   ```text
   LOGIN_FAILED | FAILED | Invalid password
   ```

5. Test unknown username:

   ```json
   {
     "username": "unknown-user",
     "password": "123456"
   }
   ```

   Expected DB record:

   ```text
   LOGIN_FAILED | FAILED | Account not found
   ```

6. Test token refresh:

   ```http
   POST http://localhost:8080/api/auth/refresh
   Content-Type: application/json
   ```

   ```json
   {
     "token": "<accessToken>"
   }
   ```

   Expected DB record:

   ```text
   TOKEN_REFRESH_SUCCESS | SUCCESS
   ```

7. Test refresh failure:

   ```json
   {
     "token": "invalid-token"
   }
   ```

   Expected DB record:

   ```text
   TOKEN_REFRESH_FAILED | FAILED
   ```

8. Test logout:

   ```http
   POST http://localhost:8080/api/auth/logout
   Authorization: Bearer <accessToken>
   ```

   Expected DB record:

   ```text
   LOGOUT | SUCCESS
   ```

9. Test registration initiate:

   ```http
   POST http://localhost:8080/api/auth/register/initiate
   Content-Type: application/json
   ```

   ```json
   {
     "username": "testuser01",
     "password": "123456",
     "email": "testuser01@gmail.com",
     "fullName": "Test User",
     "phoneNumber": "0901234567",
     "dateOfBirth": "2000-08-15",
     "gender": "Male",
     "address": "Ho Chi Minh",
     "identityCard": "079200123456"
   }
   ```

   Expected DB record:

   ```text
   REGISTER_INITIATED | SUCCESS
   ```

   Metadata should contain masked values:

   ```json
   {
     "phoneNumber": "090****567",
     "identityCard": "079******456"
   }
   ```

10. Test invalid OTP:

    ```http
    POST http://localhost:8080/api/auth/register/verify
    Content-Type: application/json
    ```

    ```json
    {
      "otp": "000000",
      "registerRequest": {
        "username": "testuser01",
        "password": "123456",
        "email": "testuser01@gmail.com",
        "fullName": "Test User",
        "phoneNumber": "0901234567",
        "dateOfBirth": "2000-08-15",
        "gender": "Male",
        "address": "Ho Chi Minh",
        "identityCard": "079200123456"
      }
    }
    ```

    Expected DB record:

    ```text
    REGISTER_OTP_VERIFIED | FAILED | Invalid OTP
    ```

11. Build auth-service:

    ```bash
    cd server
    .\mvnw.cmd -pl auth-service -am test -DskipTests
    ```

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Exception handling uses existing error codes
- [x] Audit logs persist even when main transaction fails
- [x] Passwords are not logged
- [x] JWT tokens are not logged
- [x] Phone number is masked in metadata
- [x] Citizen ID is masked in metadata
- [x] Auth DB SQL docs updated
- [ ] Endpoints tested via Postman / API client
- [ ] Audit log query verified directly in PostgreSQL

---

## Reviewer Notes

- Please verify failed login records are written to `auth_audit_log`. This depends on `AuthAuditLogService` using `REQUIRES_NEW`.
- Please verify metadata does not contain raw passwords, raw JWT tokens, or full citizen IDs.
- Audit log viewing is intentionally not included in this MR. A follow-up admin-only UI/API should be created for `Security / Activity Logs`.
