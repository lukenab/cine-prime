# API Contract - CinePrime Movie Service (Update & Delete)

> **Source of Truth:** This is the single, official document defining the APIs for the Movie Service updates and deletes. Any modifications to Input/Output schemas must be updated and agreed upon here before actual implementation.

**Version:** v1.0.0
**Last Updated:** June 15, 2026

---

## 1. Quick Links (Essential Resources)

For API testing and UI integration, the team should utilize the following resources:

* **OpenAPI Specification (Source File):** [`docs/api-specs/movie-service/movie-service.yaml`](./movie-service.yaml)
* **Swagger UI (Local):** Run the Spring Boot project and navigate to `http://localhost:8081/swagger-ui`
* **API Documentation Path:** `/v3/api-docs`

---

## 2. Team Collaboration Workflow

To ensure parallel development and prevent blockers, all team members must strictly adhere to this workflow:

### For the Frontend Team
1. **Independent Development:** Do not wait for the Backend implementation. Open `movie-service.yaml` in Swagger Editor or Local Swagger UI to review the JSON schemas.
2. **API Mocking:** Hardcode mock data directly into the client components based on the schemas provided in this contract.

### For the Backend Team
1. **API-First Approach:** Strictly adhere to the Request/Response schemas defined in the YAML file. 
2. **Contract Updates:** If any structural changes are required (e.g., adding a new field, renaming a variable), update the YAML file and notify the entire team before modifying the Java source code.

---

## 3. Current API Inventory

Below is a summary of the primary API workflows. For detailed payloads, please refer to the YAML file or Swagger UI.

| Status | Method | Endpoint | Use Case | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| Ready | `PUT` | `/api/movie/update/{id}` | Cập nhật thông tin chi tiết phim | Nguyễn Mạnh Khải|
| Ready | `DELETE` | `/api/movie/delete/{id}` | Xóa mềm phim (soft delete) | Nguyễn Mạnh Khải |

---

## 4. Standardized Error Codes

The Frontend team must handle the returned `code` and `status` attributes to render the corresponding UI accurately:

| Error Code | HTTP Status | Origin Service | Message / Meaning |
| :--- | :--- | :--- | :--- |
| `400` | 400 | Movie | Dữ liệu yêu cầu không hợp lệ (ví dụ: tên phim trống, thời lượng âm, v.v.) |
| `404` | 404 | Movie | Không tìm thấy phim với ID yêu cầu |
| `404` | 404 | Movie | Không tìm thấy thể loại phim với ID liên kết |
| `409` | 409 | Movie | Tên phim tiếng Việt đã tồn tại trong hệ thống (Khi cập nhật phim) |
| `409` | 409 | Movie | Không thể xóa phim vì vẫn còn suất chiếu hoạt động trong tương lai (Khi xóa mềm) |
| `500` | 500 | Movie | Lỗi máy chủ nội bộ hoặc lỗi kết nối database |

---

## 5. Standard Response Format

All successful responses share a unified JSON structure wrapping the result under `data`.

```json
{
  "code": "200",
  "message": "Cập nhật movie thành công",
  "status": "OK",
  "data": {
    "movieId": 1,
    "movieNameVn": "One Piece Film Red",
    "movieNameEnglish": "One Piece Film Red",
    "director": "Goro Taniguchi",
    "actor": "Luffy, Uta, Shanks",
    "duration": 115,
    "content": "Câu chuyện...",
    "version": "2D",
    "status": true
  }
}

