# API Contract - CinePrime Auth Service

> **Source of Truth:** This is the single, official document defining the APIs for the Auth Service. Any modifications to Input/Output schemas must be updated and agreed upon here before actual implementation.

**Version:** v1.5.0
**Last Updated:** July 2, 2026

---

## 1. Quick Links (Essential Resources)

For API testing and UI integration, the team should utilize the following resources:

* **OpenAPI Specification (Source File):** [`./auth-service.yaml`](./auth-service.yaml)

---

## 2. Team Collaboration Workflow

To ensure parallel development and prevent blockers, all team members must strictly adhere to this workflow:

### For the Frontend Team
1. **Independent Development:** Do not wait for the Backend implementation. Open `auth-service.yaml` in Swagger Editor or Local Swagger UI to review the JSON schemas.
2. **API Mocking:** Utilize Postman Mock Server or hardcode mock data directly into the React components based on the `example` tags provided in this contract.
3. **Error Handling:** It is mandatory to handle all defined HTTP error codes (e.g., `1008`, `1009`, `1010`, `1011`, `1013`, `1015`, `1016`) and display appropriate UI feedback.

### For the Backend Team
1. **API-First Approach:** Strictly adhere to the Request/Response schemas defined in the YAML file. 
2. **Contract Updates:** If any structural changes are required (e.g., adding a new field, renaming a variable), update the YAML file and notify the entire team before modifying the Java source code.
3. **Response Wrapper:** Every API response must be wrapped in the standardized `ApiResponse` format (containing `code`, `message`, and `result`).

---

## 3. Current API Inventory

Below is a summary of all API endpoints. For detailed payloads, please refer to the YAML file.

**Authentication**

| Status | Method | Endpoint | Use Case | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| Ready | `GET` | `/api/auth/check` | Pre-check username/email availability (no auth required) | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/register/initiate` | Send 6-digit OTP to initiate registration | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/register/verify` | Verify OTP and create account + publish Kafka event | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/resend-otp` | Resend OTP to email (rate-limited) | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/login` | Authenticate user and retrieve JWT Token | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/logout` | Revoke the current JWT token | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/refresh` | Rotate JWT — revoke old token, issue new one | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/introspect` | Validate a JWT token and return its active status | Nguyễn An Bình |

**Account Management**

| Status | Method | Endpoint | Use Case | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| Ready | `GET` | `/api/accounts` | Get list of all accounts (Admin) | Nguyễn An Bình |
| Ready | `GET` | `/api/accounts/{accountId}` | Get a single account by ID (Admin) | Nguyễn An Bình |
| Ready | `POST` | `/api/accounts` | Create account directly without OTP (Admin) | Nguyễn An Bình |
| Ready | `PUT` | `/api/accounts/{accountId}` | Update account information (Admin) | Nguyễn An Bình |

**Permission & Role**

| Status | Method | Endpoint | Use Case | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| Ready | `POST` | `/api/permissions` | Create a new system permission | Nguyễn An Bình |
| Ready | `GET` | `/api/permissions` | Get a list of all permissions | Nguyễn An Bình |
| Ready | `DELETE` | `/api/permissions/{permissionId}` | Delete a permission by name | Nguyễn An Bình |
| Ready | `POST` | `/api/roles` | Create a new role with assigned permissions | Nguyễn An Bình |
| Ready | `GET` | `/api/roles` | Get a list of all roles and their permissions | Nguyễn An Bình |


---

## 4. Standardized Error Codes

The Frontend team must rely on the returned `code` attribute to render the corresponding UI accurately:

| Error Code | HTTP Status | Origin Service | Message / Meaning |
| :--- | :--- | :--- | :--- |
| `1003` | 500 | Global | An unexpected error occurred. Please try again later. |
| `1008` | 401 | Global | Unauthenticated! (Invalid/missing/revoked token) |
| `1009` | 403 | Global | You do not have permission! (Unauthorized access) |
| `1010` | 400 | Auth | Username already exists! |
| `1011` | 400 | Auth | Email already exists! |
| `1012` | 500 | Auth | An internal error occurred. Please contact support. (Default role missing in DB) |
| `1013` | 400 | Auth | OTP is invalid! |
| `1014` | 404 | Auth | Account not found! |
| `1015` | 400 | Auth | OTP has expired! |
| `1016` | 429 | Auth | Please wait before requesting another OTP! |
| `1017` | 400 | Auth | Phone number already exists in the system! |
| `1018` | 400 | Auth | Identity card (CCCD) already exists in the system! |
| `1019` | 500 | Auth | Failed to send OTP email. Please try again. |
| `1020` | 403 | Auth | Your account has been deactivated. Please contact support. |
| `2001` | 400 | User | Phone number already exists! |
| `2002` | 400 | User | Identity card already exists! |
| `2003` | 404 | User | User profile not found! |

---

## 📦 5. Standard Response Format

All successful and failed responses share a unified JSON structure. The Frontend should strictly parse the `result` object for data rendering.

```json
{
  "code": 1000,
  "message": "Success",
  "result": { 
      // Varies per endpoint
  } 
}
```

---

## 6. Endpoint Details

### 6.1 Authentication

---

#### GET `/api/auth/check`

Pre-checks whether a `username` or `email` is already taken. Intended to be called on the first step of the registration form (before OTP is sent) so users get immediate feedback. Does **not** require authentication.

**Query Parameters:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `username` | string | ❌ | Username to check |
| `email` | string | ❌ | Email address to check |

At least one parameter must be provided. Both can be provided in the same request.

**Example Request:**
```
GET /api/auth/check?username=john_doe&email=johndoe@example.com
```

**Success Response (200) — both available:**
```json
{
  "code": 1000,
  "message": "Available"
}
```

**Error Responses:**

*400 — Username already exists:*
```json
{
  "code": 1010,
  "message": "Username already exists!"
}
```

*400 — Email already exists:*
```json
{
  "code": 1011,
  "message": "Email already exists!"
}
```

---

#### POST `/api/auth/register/initiate`

Validates registration payload and sends a 6-digit OTP to the user's email if the username and email are available.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "Password123",
  "email": "johndoe@example.com",
  "fullName": "John Doe",
  "phoneNumber": "0912345678",
  "dateOfBirth": "1995-10-15",
  "gender": "MALE",
  "address": "123 Main Street, Tech City",
  "identityCard": "079012345678"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `username` | string | ✅ | 5–50 chars, must be unique |
| `password` | string | ✅ | Min 8 chars |
| `email` | string | ✅ | Valid email format, must be unique |
| `fullName` | string | ✅ | Display name |
| `phoneNumber` | string | ✅ | Pattern: `0[3/5/7/8/9]XXXXXXXX` (10 digits) |
| `dateOfBirth` | string (date) | ✅ | Format `YYYY-MM-DD`. User must be **at least 18 years old** |
| `gender` | string | ✅ | Free-text (not enum-validated). Convention: `MALE`, `FEMALE`, `OTHER` |
| `address` | string | ✅ | Address string |
| `identityCard` | string | ✅ | Exactly 12 digits |

> **Note:** The public registration flow does **not** accept a `role` field — every account created this way gets the default `USER` role. To assign a role, use the admin endpoint `POST /api/accounts` (see Section 6.2).

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success",
  "result": "OTP has been sent to your email"
}
```

**Error Responses:**

*400 — Username already exists:*
```json
{
  "code": 1010,
  "message": "Username already exists!"
}
```

*400 — Email already exists:*
```json
{
  "code": 1011,
  "message": "Email already exists!"
}
```

*400 — Phone number already exists:*
```json
{
  "code": 1017,
  "message": "Phone number already exists in the system!"
}
```

*400 — Identity card already exists:*
```json
{
  "code": 1018,
  "message": "Identity card (CCCD) already exists in the system!"
}
```

---

#### POST `/api/auth/register/verify`

Verifies OTP and creates the account. The registration payload is **not** resent here — it was captured server-side (Redis) during `/register/initiate`, so only `email` and `otp` are sent. After successful account creation, a `UserRegisteredEvent` is published to Kafka topic `user-register-topic` for async user profile creation in `user-service`.

**Request Body:**
```json
{
  "email": "johndoe@example.com",
  "otp": "654321"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `email` | string | ✅ | Email of the pending registration |
| `otp` | string | ✅ | Exactly 6 digits, sent to email |

**Success Response (200):**

> Returns a `RegisterResponse` — note it does **not** include `roles` (the account is always assigned the default `USER` role).

```json
{
  "code": 1000,
  "result": {
    "accountId": "acc-uuid-1234-5678",
    "username": "john_doe",
    "email": "johndoe@example.com",
    "createdAt": "2026-06-14T15:00:00Z"
  }
}
```

**Error Responses:**

*400 — OTP invalid:*
```json
{
  "code": 1013,
  "message": "OTP is invalid!"
}
```

*400 — OTP expired:*
```json
{
  "code": 1015,
  "message": "OTP has expired!"
}
```

*500 — Default role not configured in system:*
```json
{
  "code": 1012,
  "message": "An internal error occurred. Please contact support."
}
```

---

#### POST `/api/auth/login`

Authenticates user using username and password. Returns a signed JWT token.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "Password123@"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `username` | string | ✅ | Registered username |
| `password` | string | ✅ | Account password |

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success",
  "result": {
    "authenticate": true,
    "token": "eyJhbGciOiJIUzUxMiJ9..."
  }
}
```

**Error Responses:**

*401 — Invalid credentials:*
```json
{
  "code": 1008,
  "message": "Unauthenticated!"
}
```

*403 — Account deactivated:*
```json
{
  "code": 1020,
  "message": "Your account has been deactivated. Please contact support."
}
```

---

#### POST `/api/auth/resend-otp`

Resends a new 6-digit OTP to the provided email. Rate-limited to prevent abuse.

**Request Body:**
```json
{
  "email": "johndoe@example.com"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `email` | string | ✅ | Email address of the pending registration |

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "New OTP has been sent to your email!"
}
```

**Error Responses:**

*400 — Email already registered (no OTP will be resent):*
```json
{
  "code": 1011,
  "message": "Email already exists!"
}
```

*429 — Resend too fast:*
```json
{
  "code": 1016,
  "message": "Please wait before requesting another OTP!"
}
```

---

#### POST `/api/auth/logout`

Revokes the current JWT token. After this call, the token is marked as revoked in the whitelist and will be rejected by all services.

**Request Header:**

```
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9...
```

| Header | Required | Description |
| :--- | :---: | :--- |
| `Authorization` | ✅ | Bearer token to revoke. Extracted server-side from the `Authorization` header — no request body needed. |

**Request Body:** none

> **Why header, not body?**
> Token is identity context, not payload data — it belongs in `Authorization` per RFC 6750. Sending tokens in the request body risks them being captured in server access logs, which typically record body content but redact the `Authorization` header by convention.

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Logged out successfully"
}
```

**Error Responses:**

*401 — Missing or malformed Authorization header:*
```json
{
  "code": 1008,
  "message": "Unauthenticated!"
}
```

*401 — Token already revoked or signature invalid:*
```json
{
  "code": 1008,
  "message": "Unauthenticated!"
}
```

---

#### POST `/api/auth/refresh`

Issues a new JWT token using the current (still-valid) token. The old token is **immediately revoked** (token rotation). The response format is identical to `/login`.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9..."
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `token` | string | ✅ | A valid (non-revoked, non-expired) JWT token |

**Success Response (200):**
```json
{
  "code": 1000,
  "result": {
    "authenticate": true,
    "token": "eyJhbGciOiJIUzUxMiJ9...<new_token>"
  }
}
```

**Error Response:**

*401 — Token invalid, expired, or already revoked:*
```json
{
  "code": 1008,
  "message": "Unauthenticated!"
}
```

---

#### POST `/api/auth/introspect`

Validates a JWT token and returns whether it is currently active (not revoked, not expired).

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9..."
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `token` | string | ✅ | The JWT token to validate |

**Success Response (200):**
```json
{
  "code": 1000,
  "result": {
    "valid": true
  }
}
```

> If the token is expired or revoked, `valid` will be `false` (no error thrown).

---

### 6.2 Account Management

> **Note:** These endpoints require `ADMIN` role. Include the JWT token in the `Authorization` header.

**Header:**
```
Authorization: Bearer <token>
```

---

#### GET `/api/accounts`

Retrieves a list of all registered accounts.

**No request body or query parameters required.**

**Success Response (200):**
```json
{
  "code": 1000,
  "result": [
    {
      "accountId": "acc-uuid-1234-5678",
      "username": "john_doe",
      "email": "johndoe@example.com",
      "createdAt": "2026-06-14T15:00:00",
      "roles": [
        {
          "roleName": "USER",
          "description": "Default user role",
          "permissions": []
        }
      ]
    }
  ]
}
```

---

#### GET `/api/accounts/{accountId}`

Retrieves a single account's details by account ID.

**Path Parameters:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `accountId` | string | ✅ | UUID of the account |

**Example Request:**
```
GET /api/accounts/acc-uuid-1234-5678
```

**Success Response (200):**
```json
{
  "code": 1000,
  "result": {
    "accountId": "acc-uuid-1234-5678",
    "username": "john_doe",
    "email": "johndoe@example.com",
    "createdAt": "2026-06-14T15:00:00",
    "roles": [
      {
        "roleName": "USER",
        "description": "Default user role",
        "permissions": []
      }
    ]
  }
}
```

**Error Response:**

*400 — Account not found:*
```json
{
  "code": 1014,
  "message": "Account not found!"
}
```

---

#### POST `/api/accounts`

Creates a new account directly without OTP verification. Intended for admin use.

**Request Body:** `AdminCreateAccountRequest` — same fields as `RegisterRequest` (see Section 6.1 `/register/initiate`) **plus** an optional `role`:

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `role` | string | ❌ | Must be `USER` or `ADMIN`. Defaults to `USER` if omitted |

```json
{
  "username": "jane_admin",
  "password": "Password123",
  "email": "jane@example.com",
  "fullName": "Jane Admin",
  "phoneNumber": "0912345678",
  "dateOfBirth": "1990-05-20",
  "gender": "FEMALE",
  "address": "1 Admin Road",
  "identityCard": "079012345679",
  "role": "ADMIN"
}
```

**Success Response (200):**
```json
{
  "code": 1000,
  "result": {
    "accountId": "acc-uuid-1234-5678",
    "username": "john_doe",
    "email": "johndoe@example.com",
    "createdAt": "2026-06-14T15:00:00",
    "roles": [
      {
        "roleName": "USER",
        "description": "Default user role",
        "permissions": []
      }
    ]
  }
}
```

---

#### PUT `/api/accounts/{accountId}`

Updates an existing account's information. All fields are optional — only provided fields will be updated.

**Path Parameters:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `accountId` | string | ✅ | UUID of the account to update |

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "password": "NewPassword123",
  "roles": ["ADMIN"],
  "fullName": "John Doe Updated",
  "phoneNumber": "0987654321",
  "dateOfBirth": "1995-10-15",
  "gender": "MALE",
  "address": "456 New Street, City",
  "identityCard": "079012345678"
}
```

**Success Response (200):**
```json
{
  "code": 1000,
  "result": {
    "accountId": "acc-uuid-1234-5678",
    "username": "john_doe",
    "email": "newemail@example.com",
    "createdAt": "2026-06-14T15:00:00",
    "roles": [
      {
        "roleName": "ADMIN",
        "description": "Administrator Role",
        "permissions": []
      }
    ]
  }
}
```

**Error Response:**

*400 — Account not found:*
```json
{
  "code": 1014,
  "message": "Account not found!"
}
```

---

### 6.3 Permission Management

> **Note:** These endpoints require `ADMIN` role. Include the JWT token in the `Authorization` header.

**Header:**
```
Authorization: Bearer <token>
```

---

#### POST `/api/permissions`

Creates a new system permission for use in RBAC.

**Request Body:**
```json
{
  "name": "UPDATE_DATA",
  "description": "Update data permission"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `name` | string | ✅ | Unique permission identifier (UPPER_SNAKE_CASE) |
| `description` | string | ✅ | Human-readable description |

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success",
  "result": {
    "name": "UPDATE_DATA",
    "description": "Update data permission"
  }
}
```

---

#### GET `/api/permissions`

Retrieves a list of all permissions in the system.

**No request body or query parameters required.**

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success",
  "result": [
    {
      "name": "UPDATE_DATA",
      "description": "Update data permission"
    },
    {
      "name": "CREATE_USER",
      "description": "Create user permission"
    }
  ]
}
```

---

#### DELETE `/api/permissions/{permissionId}`

Removes a permission from the system by its name.

**Path Parameters:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `permissionId` | string | ✅ | The permission `name` (e.g. `UPDATE_DATA`) |

**Example Request:**
```
DELETE /api/permissions/UPDATE_DATA
```

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success"
}
```

---

### 6.4 Role Management

> **Note:** These endpoints require `ADMIN` role. Include the JWT token in the `Authorization` header.

**Header:**
```
Authorization: Bearer <token>
```

---

#### POST `/api/roles`

Creates a new role and assigns permissions to it.

**Request Body:**
```json
{
  "roleName": "ADMIN",
  "description": "Administrator Role",
  "permissions": ["UPDATE_DATA", "CREATE_USER"]
}
```

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `roleName` | string | ✅ | Unique role name |
| `description` | string | ✅ | Human-readable description |
| `permissions` | string[] | ❌ | List of permission `name` values to assign |

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success",
  "result": {
    "roleName": "ADMIN",
    "description": "Administrator Role",
    "permissions": [
      {
        "name": "UPDATE_DATA",
        "description": "Update data permission"
      },
      {
        "name": "CREATE_USER",
        "description": "Create user permission"
      }
    ]
  }
}
```

---

#### GET `/api/roles`

Retrieves all roles and their assigned permissions.

**No request body or query parameters required.**

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success",
  "result": [
    {
      "roleName": "ADMIN",
      "description": "Administrator Role",
      "permissions": [
        {
          "name": "UPDATE_DATA",
          "description": "Update data permission"
        }
      ]
    },
    {
      "roleName": "USER",
      "description": "Default user role",
      "permissions": []
    }
  ]
}
```

---

## 7. Validation Rules

### Username
- **Min length:** 5 characters, **Max length:** 50 characters
- **Validation message:** `Username must be between 5 and 50 characters!`
- **Must be unique** across all accounts

### Password
- **Min length:** 8 characters
- **Validation message:** `Password must be at least 8 characters!`

### Email
- **Format:** Valid email — `user@domain.tld`
- **Validation message:** `Invalid email format (e.g., example@gmail.com)!`
- **Must be unique** across all accounts

### Phone Number
- **Pattern:** `^(0[3|5|7|8|9])+([0-9]{8})$` (Vietnamese mobile numbers only)
- **Valid prefixes:** `03x`, `05x`, `07x`, `08x`, `09x`
- **Total length:** 10 digits
- **Examples (valid):** `0912345678`, `0387654321`
- **Validation message:** `Invalid phone number format!`

### Date of Birth
- **Format:** `YYYY-MM-DD`
- **Required:** Yes (`@NotNull`)
- **Rule:** User must be at least **18 years old** (`@DobConstraint(min = 18)`)

### Gender
- **Constraint:** `@NotBlank` only — accepted as a free-text string, **not** enum-validated server-side
- **Convention:** `MALE`, `FEMALE`, `OTHER`

### Identity Card
- **Format:** Exactly 12 digits
- **Pattern:** `^[0-9]{12}$`
- **Example:** `079012345678`
- **Validation message:** `Identity card must contain exactly 12 digits!`

### OTP
- **Format:** 6-digit string
- **Validity:** Time-limited (configured server-side); error `1015` returned if expired

### Permission Name
- **Convention:** `UPPER_SNAKE_CASE`
- **Examples:** `UPDATE_DATA`, `CREATE_USER`, `DELETE_MOVIE`

---

## 8. Business Rules

### Registration Flow (2-step)
1. Client calls `/register/initiate` → system validates uniqueness, sends OTP to email
2. Client calls `/register/verify` with OTP → system creates account, publishes `UserRegisteredEvent` to Kafka
3. `user-service` consumes the event and creates the user profile asynchronously

### Token
- JWT token returned by `/login` must be attached to all protected endpoints as `Authorization: Bearer <token>`
- Token carries role/permission claims used by the gateway and each service for access control
- **Whitelist model:** every issued token is stored in the `auth_token` table with `is_revoked = false`. On `/logout` or `/refresh`, the old token is marked `is_revoked = true` and rejected immediately — even if the JWT signature is still technically valid
- **Token rotation:** calling `/refresh` revokes the old token and issues a brand-new one atomically. Never reuse a token after calling `/refresh`
- **Logout requires Authorization header:** `/logout` reads the token from `Authorization: Bearer <token>` — no request body. Clients must not clear the token from storage until after the server confirms revocation (200 OK). Clearing before the call would cause the axios interceptor to send no Authorization header, and the server would reject the request with 401.

### Account Status
- Login checks `account.status`. A value other than `1` (active) returns error `1020` (`ACCOUNT_INACTIVE`)
- Deactivated accounts cannot log in but their data remains intact

### Default Role
- Every newly registered user is automatically assigned a default role (e.g., `USER`)
- If the default role is not configured in the database, `/register/verify` returns error `1012`

### Permission Name as ID
- A permission's `name` (e.g., `UPDATE_DATA`) is its unique identifier — used as the path parameter in `DELETE /api/permissions/{permissionId}`

---

## 9. Integration Notes

### Kafka Event (after `/register/verify`)

On successful registration, `auth-service` publishes the following event:

- **Topic:** `user-register-topic`
- **Consumer:** `user-service` (group: `user-service-group`)

**Event Payload:**
```json
{
  "accountId": "acc-uuid-1234-5678",
  "fullName": "John Doe",
  "phoneNumber": "0123456789",
  "dateOfBirth": "1995-10-15",
  "gender": "MALE",
  "address": "123 Main Street, Tech City",
  "identityCard": "079012345678"
}
```

> **Note:** The `email` field was intentionally removed. Email is owned exclusively by `auth-service` (authentication credential). `user-service` stores only the profile data above.

For full Kafka contract details (retries, DLT, idempotency), see [kafka-user-service-contract.md](../../architecture/kafka/kafka-user-service-contract.md).

### Timeout Recommendations

| Operation | Recommended Timeout |
| :--- | :--- |
| `/login` | 3 seconds |
| `/register/initiate` (sends email) | 5 seconds |
| `/register/verify` | 5 seconds |
| Permission / Role CRUD | 2 seconds |

---

## 10. Changelog

### Version 1.5.0 (2026-07-02)
Synced the contract and `auth-service.yaml` with the actual backend implementation:
- **`POST /api/auth/register/verify` — request body simplified:** now `{ email, otp }` only. The full registration payload is no longer resent — it is captured server-side (Redis, 5-min TTL) during `/register/initiate`. The previous `{ otp, registerRequest }` shape was never implemented.
- **`POST /api/auth/register/verify` — response changed:** now returns `RegisterResponse` (`accountId`, `username`, `email`, `createdAt`) **without** the `roles` array. The previous `AccountResponse` (with roles) was incorrect.
- **`POST /api/auth/resend-otp` — corrected error handling:** returns `400 / 1011` (Email already exists) when the email is already registered, not `404 / 1014`. Success message corrected to `New OTP has been sent to your email!`.
- **`POST /api/accounts` — request schema corrected:** uses `AdminCreateAccountRequest` (RegisterRequest fields + optional `role` restricted to `USER`/`ADMIN`), not `RegisterRequest`.
- **`RegisterRequest` corrected:** password minimum is **8** characters (was 6); `dateOfBirth` is **required** and the user must be **at least 18 years old** (`@DobConstraint(min = 18)`, was "2 years"); the `role` field was removed (public registration always assigns `USER`).
- **`gender`** documented as free-text `@NotBlank` (not enum-validated server-side).
- **`POST /api/auth/logout`** YAML corrected to drop the request body (already header-based since 1.4.0).

### Version 1.4.0 (2026-06-27)
- **Breaking change — `POST /api/auth/logout`:** Token is no longer accepted in the request body. The endpoint now reads the token exclusively from the `Authorization: Bearer <token>` header.
  - **Before:** `POST /api/auth/logout` with body `{ "token": "eyJ..." }`
  - **After:** `POST /api/auth/logout` with header `Authorization: Bearer eyJ...` and no body
  - **Rationale:** Tokens are identity context (RFC 6750), not payload data. Request bodies are more likely to appear in server access logs than the `Authorization` header, which log aggregators typically redact by convention. The axios request interceptor already attaches the token to every outgoing request automatically, making the body field redundant.
  - **Frontend impact:** `authApi.logout()` no longer accepts a `token` argument. The axios interceptor handles header injection automatically.
  - **Backend impact:** `AuthenticationController` now reads from `HttpServletRequest.getHeader("Authorization")` and delegates to `AuthenticationService.logoutByToken(String token)`. The old `logout(LogoutRequest)` method is retained as a delegate wrapper for backward compatibility.

### Version 1.3.0 (2026-06-25)
- Added `GET /api/auth/check` — pre-check username/email availability (no auth required)
- Added `POST /api/auth/logout` — revokes the current JWT token
- Added `POST /api/auth/refresh` — token rotation (old revoked, new issued)
- Added `POST /api/auth/introspect` — validates a JWT token
- Updated token security model: whitelist-based (`auth_token` table) replacing the old blacklist approach
- Added error code `1019` — OTP email send failure (500)
- Added error code `1020` — Account deactivated (403); login now checks `account.status`
- Fixed error code `1012` HTTP status: 400 → 500 (internal config error, not client error)
- Fixed error code `1014` HTTP status: 400 → 404
- Updated error messages to be consistent: `1013`, `1015`, `1016`
- Removed `email` field from Kafka `UserRegisteredEvent` payload — email is owned by auth-service only
- Updated Business Rules section: token whitelist model, account status check

### Version 1.2.0 (2026-06-22)
- Added `POST /api/auth/resend-otp` endpoint
- Added `AccountController`: `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/{accountId}`
- Updated `RegisterRequest`: all fields required (except `dateOfBirth`, `role`), corrected phone pattern, corrected username min length to 5
- Updated `/register/verify` response to return `AccountResponse` with `roles` (replaced old `RegisterResponse`)
- Added error codes: `1014` (account not found), `1015` (OTP expired), `1016` (resend too fast), `1017` (phone existed), `1018` (identity card existed)

### Version 1.1.0 (2026-06-15)
- Added OTP-based 2-step registration flow (`/register/initiate`, `/register/verify`)
- Added RBAC endpoints for Permission and Role management
- Standardized error codes (`1008`–`1013`)

### Version 1.0.0
- Initial API specification
- Basic login endpoint