    # API Contract - CinePrime Auth Service

> **Source of Truth:** This is the single, official document defining the APIs for the Auth Service. Any modifications to Input/Output schemas must be updated and agreed upon here before actual implementation.

**Version:** v1.1.0
**Last Updated:** June 15, 2026

---

## 1. Quick Links (Essential Resources)

For API testing and UI integration, the team should utilize the following resources:

* **OpenAPI Specification (Source File):** [`./auth-service.yaml`](./auth-service.yaml)
* **Swagger UI (API Gateway):** `http://localhost:8085/webjars/swagger-ui/index.html`
* **Swagger UI (Auth Service):** `http://localhost:8088/swagger-ui/index.html`

---

## 2. Team Collaboration Workflow

To ensure parallel development and prevent blockers, all team members must strictly adhere to this workflow:

### For the Frontend Team
1. **Independent Development:** Do not wait for the Backend implementation. Open `auth-service.yaml` in Swagger Editor or Local Swagger UI to review the JSON schemas.
2. **API Mocking:** Utilize Postman Mock Server or hardcode mock data directly into the React components based on the `example` tags provided in this contract.
3. **Error Handling:** It is mandatory to handle all defined HTTP error codes (e.g., `1008`, `1009`, `1010`, `1011`, `1013`) and display appropriate UI feedback.

### For the Backend Team
1. **API-First Approach:** Strictly adhere to the Request/Response schemas defined in the YAML file. 
2. **Contract Updates:** If any structural changes are required (e.g., adding a new field, renaming a variable), update the YAML file and notify the entire team before modifying the Java source code.
3. **Response Wrapper:** Every API response must be wrapped in the standardized `ApiResponse` format (containing `code`, `message`, and `result`).

---

## 3. Current API Inventory

Below is a summary of the primary API workflows. For detailed payloads, please refer to the YAML file or Swagger UI.

| Status | Method | Endpoint | Use Case | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| Ready | `POST` | `/api/auth/login` | Authenticate user and retrieve JWT Token | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/register/initiate` | Send 6-digit OTP to initiate registration | Nguyễn An Bình |
| Ready | `POST` | `/api/auth/register/verify` | Verify OTP and call User Service to create profile | Nguyễn An Bình |
| Ready | `POST` | `/api/permissions` | Create a new system permission | Nguyễn An Bình |
| Ready | `GET` | `/api/permissions` | Get a list of all permissions | Nguyễn An Bình |
| Ready | `DELETE` | `/api/permissions/{permissionId}` | Delete a permission by ID | Nguyễn An Bình |
| Ready | `POST` | `/api/roles` | Create a new role with assigned permissions | Nguyễn An Bình |
| Ready | `GET` | `/api/roles` | Get a list of all roles and their permissions | Nguyễn An Bình |


---

## 4. Standardized Error Codes

The Frontend team must rely on the returned `code` attribute to render the corresponding UI accurately:

| Error Code | HTTP Status | Origin Service | Message / Meaning |
| :--- | :--- | :--- | :--- |
| `1003` | 500 | Global | Uncategorized error! (Server fallback) |
| `1008` | 401 | Global | Unauthenticated (Invalid username or password) |
| `1009` | 403 | Global | You do not have permission (Unauthorized access) |
| `1010` | 400 | Auth | Username already exists! |
| `1011` | 400 | Auth | Email already exists! |
| `1012` | 400 | Auth | Default role not found! |
| `1013` | 400 | Auth | Otp invalid |
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