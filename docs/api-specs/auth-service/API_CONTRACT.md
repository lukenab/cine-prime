    # API Contract - CinePrime Auth Service

> **Source of Truth:** This is the single, official document defining the APIs for the Auth Service. Any modifications to Input/Output schemas must be updated and agreed upon here before actual implementation.

**Version:** v1.0.0
**Last Updated:** June 14, 2026

---

## 1. Quick Links (Essential Resources)

For API testing and UI integration, the team should utilize the following resources:

* **OpenAPI Specification (Source File):** [`docs/api-specs/auth-service.yaml`](./docs/api-specs/auth-service.yaml)
* **Swagger UI (Local):** Run the Spring Boot project and navigate to `http://localhost:8080/docs/index.html`
* **Postman Collection:** [`docs/postman/CinePrime_Auth.json`](./docs/postman/CinePrime_Auth.json) *(Download and import into Postman for rapid testing)*

---

## 2. Team Collaboration Workflow

To ensure parallel development and prevent blockers, all team members must strictly adhere to this workflow:

### For the Frontend Team
1. **Independent Development:** Do not wait for the Backend implementation. Open `auth-service.yaml` in Swagger Editor or Local Swagger UI to review the JSON schemas.
2. **API Mocking:** Utilize Postman Mock Server or hardcode mock data directly into the React components based on the `example` tags provided in this contract.
3. **Error Handling:** It is mandatory to handle all defined HTTP 400 error codes (e.g., `1008`, `1010`, `1011`) and display appropriate UI feedback.

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
| In Prog | `POST` | `/api/auth/register/initiate` | Send 6-digit OTP to initiate registration | Nguyễn An Bình |
| In Prog | `POST` | `/api/auth/register/verify` | Verify OTP and call User Service to create profile | Nguyễn An Bình |


---

## 4. Standardized Error Codes

The Frontend team must rely on the returned `code` attribute to render the corresponding UI accurately:

| Error Code | HTTP Status | Origin Service | Message / Meaning |
| :--- | :--- | :--- | :--- |
| `1008` | 400 | Auth | Unauthenticated (Invalid username or password) |
| `1010` | 400 | Auth | Username already exists |
| `1011` | 400 | Auth | Email already exists |
| `1012` | 400 | Auth | Default role not found |
| `2004` | 400 | Auth | Invalid or expired OTP |
| `2001` | 400 | User | Phone number already exists |
| `2002` | 400 | User | Identity card already exists |
| `2003` | 404 | User | User profile not found |

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