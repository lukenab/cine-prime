# User Service API Contract

## Overview
This document describes the API contract for the User Service, which manages user profile operations in the CinePrime system.

## Base URLs
- **Production**: `https://api.cineprime.com` (when deployed)
- **Development (Gateway)**: `http://localhost:8080`
- **Development (Direct)**: `http://localhost:8084`

## Authentication
Most endpoints in this service are internal. Note: user profile creation is performed asynchronously via Kafka by `auth-service` (see "Create User Profile — Event-driven" below). Future versions may require JWT token authentication for direct client access.

## Common Response Format

### Success Response
```json
{
  "code": 1000,
  "message": "Success",
  "result": { ... }
}
```

### Error Response
```json
{
  "code": 2003,
  "message": "User profile not found!",
  "result": null
}
```

### Validation Error Response
```json
{
  "code": 2004,
  "message": "Invalid input data!",
  "result": {
    "phoneNumber": "Invalid phone number format",
    "email": "Invalid email format"
  }
}
```

## Error Codes

| Code | Message | HTTP Status | Description |
|------|---------|-------------|-------------|
| 2001 | Phone number already exists! | 400 | Duplicate phone number |
| 2002 | Identity card already exists! | 400 | Duplicate identity card |
| 2003 | User profile not found! | 404 | User doesn't exist or is inactive |
| 2004 | Invalid input data! | 400 | Validation errors |
| 2005 | Email already exists! | 400 | Duplicate email |
| 2008 | User is already inactive! | 400 | Attempting to delete already inactive user |

## Endpoints

### 1. Create User Profile — Event-driven

User profile creation is handled asynchronously via Kafka. Instead of calling an internal HTTP POST, `auth-service` publishes a `UserRegisteredEvent` to the Kafka topic `user-register-topic`. `user-service` consumes that event (consumer group `user-service-group`) and creates the profile in its database.

Key points:
- Topic: `user-register-topic`
- Consumer group: `user-service-group`
- Idempotency: `user-service` MUST check `accountId` existence before persisting to avoid duplicate processing
- Validation: `auth-service` is responsible for primary validation (email/phone/identity format and uniqueness). `user-service` should still handle DB constraint errors and idempotency.

Event payload (JSON example):
```json
{
  "accountId": "b41fac5d-aa57-461d-88f6-28192cfbd64a",
  "fullName": "Nguyen An Binh",
  "phoneNumber": "0812154005",
  "dateOfBirth": "1995-10-15",
  "email": "anbinh200@gmail.com",
  "gender": "MALE",
  "address": "123 Main St, City",
  "identityCard": "123456789012"
}
```

On successful consumption the service responds to internal callers via its usual data model (no immediate synchronous HTTP response to the producer). For details about message format, error handling, retries, and DLT, see [kafka-user-service-contract.md](../../architecture/kafka/kafka-user-service-contract.md).

---

### 2. Get User by ID
**GET** `/api/users/{id}`

Retrieves user profile by account ID. Only returns active users.

**Path Parameters:**
- `id` (string, required): Account ID in UUID format

**Example Request:**
```
GET /api/users/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200):**
```json
{
  "code": 1000,
  "result": {
    "accountId": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Nguyen Van A",
    "phoneNumber": "0912345678",
    "dateOfBirth": "1995-05-15",
    "gender": "Male",
    "address": "123 Nguyen Hue, District 1, HCMC",
    "identityCard": "079095001234",
    "email": "nguyenvana@gmail.com",
    "avatarUrl": null,
    "createdAt": "2026-06-15T19:00:00",
    "updatedAt": null,
    "isActive": true
  }
}
```

**Error Response (404):**
```json
{
  "code": 2003,
  "message": "User profile not found!"
}
```

---

### 3. Update User Profile
**PUT** `/api/users/{id}`

Updates user profile. All fields are optional - only provided fields will be updated.

**Path Parameters:**
- `id` (string, required): Account ID in UUID format

**Request Body:**
```json
{
  "fullName": "Nguyen Van A Updated",
  "phoneNumber": "0987654321",
  "address": "456 Le Loi, District 1, HCMC",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Success Response (200):**
```json
{
  "code": 1000,
  "result": {
    "accountId": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Nguyen Van A Updated",
    "phoneNumber": "0987654321",
    "dateOfBirth": "1995-05-15",
    "gender": "Male",
    "address": "456 Le Loi, District 1, HCMC",
    "identityCard": "079095001234",
    "email": "nguyenvana@gmail.com",
    "avatarUrl": "https://example.com/avatar.jpg",
    "createdAt": "2026-06-15T19:00:00",
    "updatedAt": "2026-06-15T19:30:00",
    "isActive": true
  }
}
```

**Error Responses:**

*400 Bad Request - Phone Existed:*
```json
{
  "code": 2001,
  "message": "Phone number already exists!"
}
```

*404 Not Found:*
```json
{
  "code": 2003,
  "message": "User profile not found!"
}
```

---

### 4. Delete User (Soft Delete)
**DELETE** `/api/users/{id}`

Soft deletes user by setting isActive to false. Data remains in database.

**Path Parameters:**
- `id` (string, required): Account ID in UUID format

**Example Request:**
```
DELETE /api/users/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "User has been deleted",
  "result": null
}
```

**Error Responses:**

*400 Bad Request - Already Inactive:*
```json
{
  "code": 2008,
  "message": "User is already inactive!"
}
```

*404 Not Found:*
```json
{
  "code": 2003,
  "message": "User profile not found!"
}
```

---

### 5. Get All Users (Paginated)
**GET** `/api/users`

Retrieves a paginated list of user profiles.

**Query Parameters:**
- `page` (integer, optional): Page number (1-based index). Default: `1`
- `size` (integer, optional): Number of records per page. Default: `10`

**Example Request:**
```
GET /api/users?page=1&size=5
```

**Success Response (200):**
```json
{
  "code": 1000,
  "message": "Success",
  "result": {
    "currentPage": 1,
    "totalPages": 5,
    "pageSize": 5,
    "totalElements": 23,
    "data": [
      {
        "accountId": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": "Nguyen Van A",
        "phoneNumber": "0912345678",
        "dateOfBirth": "1995-05-15",
        "gender": "Male",
        "address": "123 Nguyen Hue, District 1, HCMC",
        "identityCard": "079095001234",
        "email": "nguyenvana@gmail.com",
        "avatarUrl": null,
        "createdAt": "2026-06-15T19:00:00",
        "updatedAt": null,
        "isActive": true
      }
    ]
  }
}
```

---

## Validation Rules

### Phone Number
- **Format**: `0XXXXXXXXX` or `+84XXXXXXXXX`
- **Length**: 9-10 digits after prefix
- **Pattern**: `^(0|\+84)[0-9]{9,10}$`
- **Examples**: 
  - Valid: `0912345678`, `+84912345678`
  - Invalid: `123456789`, `09123`, `abc123456`

### Identity Card
- **Format**: 12 digits only
- **Pattern**: `^[0-9]{12}$`
- **Example**: `079095001234`

### Email
- **Format**: Valid email format
- **Pattern**: `^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`
- **Examples**:
  - Valid: `user@example.com`, `john.doe@company.co.uk`
  - Invalid: `user@`, `@example.com`, `user.example.com`

### Date of Birth
- **Format**: `YYYY-MM-DD`
- **Rule**: Must be in the past
- **Example**: `1995-05-15`

### Gender
- **Allowed values**: `Male`, `Female`, `Other`
- Case-sensitive

### Full Name
- **Create**: Max 100 characters
- **Update**: Max 50 characters
- **Required**: Yes (for create)

### Address
- **Max length**: 255 characters
- **Example**: `123 Nguyen Hue Street, District 1, Ho Chi Minh City`

---

## Business Rules

### 1. Uniqueness Constraints
- **Phone number** must be unique across all users
- **Email** must be unique across all users  
- **Identity card** must be unique across all users
- Uniqueness is checked during both create and update operations

### 2. Soft Delete Behavior
- Deleted users have `isActive = false`
- Deleted users are **not returned** in GET requests
- Deleted users **cannot be deleted again** (error 2008)
- Data remains in database for audit/recovery purposes

### 3. Update Behavior
- Only provided fields are updated (partial update)
- Omitted fields remain unchanged
- `updatedAt` timestamp is **automatically set** on every update
- Phone number uniqueness is validated if changed

### 4. Account Linking
- User profile is linked to auth account via `accountId`
- `accountId` is set during creation and **cannot be changed**
- One account = one user profile (1:1 relationship)

---

## Integration Notes

### Produced by Auth Service (Kafka)

User profile creation is performed asynchronously. When a user successfully registers, `auth-service` publishes a `UserRegisteredEvent` to Kafka (topic: `user-register-topic`). `user-service` consumes events using consumer group `user-service-group` and persists the profile.

Integration flow (event-driven):

```
Client → Auth Service (register/verify)
         ↓
         Creates Account
         ↓
         Publishes UserRegisteredEvent → Kafka (user-register-topic)
                    ↓
         User Service (consumer user-service-group) consumes event and creates profile
```

Guidelines for integrators:
- Retry: The producer (`auth-service`) should retry event publish on transient errors. Configure producer acks and retries as appropriate.
- Idempotency: `user-service` MUST check for existing `accountId` before insertion and acknowledge duplicates to avoid duplicate processing.
- Validation responsibilities: `auth-service` performs primary validations (email/phone/identity). `user-service` should still handle DB constraint violations and log/forward to DLT when necessary.
- Error handling: Use a DLT (dead-letter topic) or retry mechanism for messages that fail deserialization or processing after retries.

### Timeout Recommendations
- **Event processing**: N/A (async). Ensure consumer processing timeouts are tuned to avoid excessive reprocessing.
- **Get operations**: 2 seconds
- **Update/Delete operations**: 3 seconds

---

## Testing

### OpenAPI Specification
See `user-service.yaml` for complete OpenAPI 3.0 specification.

### Swagger UI
Import into Postman or use Swagger UI for interactive testing:
```
http://localhost:8084/swagger-ui.html
```

### Example Test Scenarios

**Scenario 1: Happy Path**
1. POST /profile with valid data → 200 OK
2. GET /{id} → 200 OK with created user
3. PUT /{id} with updates → 200 OK with updated data
4. DELETE /{id} → 200 OK
5. GET /{id} → 404 Not Found (user is inactive)

**Scenario 2: Duplicate Phone**
1. POST /profile with phone `0912345678` → 200 OK
2. POST /profile with same phone → 400 Error 2001

**Scenario 3: Validation Errors**
1. POST /profile with invalid phone format → 400 Error 2004
2. POST /profile with future date of birth → 400 Error 2004
3. POST /profile with invalid gender → 400 Error 2004

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    account_id VARCHAR(36) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15),
    date_of_birth DATE,
    gender VARCHAR(20),
    address VARCHAR(255),
    identity_card VARCHAR(20),
    email VARCHAR(255),
    avatar_url VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for uniqueness and performance
CREATE UNIQUE INDEX idx_users_phone ON users(phone_number);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_identity_card ON users(identity_card);
CREATE INDEX idx_users_is_active ON users(is_active);
```

---

## Changelog

### Version 1.1.0 (2026-06-17)
- Added GET `/api/users` endpoint to list all users with pagination support

### Version 1.0.0 (2026-06-15)
- Initial API specification
- CRUD operations for user profiles
- Soft delete functionality
- Validation rules and error codes
- Integration with auth-service
- Email field added to user profile

### Future Enhancements
- User restore endpoint (reactivate soft-deleted users)
- Search users by criteria
- Batch operations support
- Avatar upload endpoint

---

## Support & Contact

For API support or questions:
- **Email**: support@cineprime.com
- **Documentation**: https://docs.cineprime.com/user-service
- **Issue Tracker**: https://github.com/cineprime/user-service/issues
