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

All endpoints listed below belong to the **Movie Controller** tag (Managing movies, showtimes, cinema rooms, and movie genres).

|    Status   | Method   | Endpoint                    | Use Case                          | Assignee         |
| :---------: | :------- | :-------------------------- | :-------------------------------- | :--------------- |
| **In Prog** | `POST`   | `/api/movie`                | Create a new movie with showtimes | Lê Tấn Lộc       |
|  **Ready**  | `GET`    | `/api/movie/{id}`           | Get movie details by ID           | Lê Tấn Lộc       |
|  **Ready**  | `GET`    | `/api/movie?page=1&size=10` | Get paginated movie list          | Lê Tấn Lộc       |
| **In Prog** | `POST`   | `/api/movie/room`           | Create a cinema room              | Lê Tấn Lộc       |
| **In Prog** | `POST`   | `/api/movie/type`           | Create a movie genre/type         | Lê Tấn Lộc       |
|  **Ready**  | `PUT`    | `/api/movie/update/{id}`    | Update movie information          | Nguyễn Mạnh Khải |
|  **Ready**  | `DELETE` | `/api/movie/delete/{id}`    | Soft delete a movie               | Nguyễn Mạnh Khải |


## 4. Standardized Error Codes

The Frontend team must rely on the returned `code` attribute to render the corresponding UI accurately:

| Error Code | HTTP Status | Origin Service | Message / Meaning                                                        |
| :--------- | :---------- | :------------- | :----------------------------------------------------------------------- |
| `400`      | 400         | Movie          | Invalid input data (e.g., movie name or director is blank)               |
| `404`      | 404         | Movie          | Movie not found with the provided ID                                     |
| `404`      | 404         | Movie Type     | Movie genre not found with the provided ID                               |
| `409`      | 409         | Movie Type     | Movie type name already exists                                           |
| `409`      | 409         | Room           | Room name already exists                                                 |
| `900`      | 400         | Showtime       | Invalid showtime! The cinema only operates from 08:00 AM to 11:00 PM     |
| `901`      | 409         | Showtime       | A movie schedule already exists in this room                             |
| `902`      | 400         | Showtime       | Invalid showdate! Showtimes must be scheduled at least 3 days in advance |
| `903`      | 409         | Showtime       | The room has been booked for another showtime                            |
| `904`      | 404         | Room           | Cinema room does not exist                                               |
| `400` | 400 | Movie | Dữ liệu yêu cầu không hợp lệ (ví dụ: tên phim trống, thời lượng âm, v.v.) |
| `404` | 404 | Movie | Không tìm thấy phim với ID yêu cầu |
| `404` | 404 | Movie | Không tìm thấy thể loại phim với ID liên kết |
| `409` | 409 | Movie | Tên phim tiếng Việt đã tồn tại trong hệ thống (Khi cập nhật phim) |
| `409` | 409 | Movie | Không thể xóa phim vì vẫn còn suất chiếu hoạt động trong tương lai (Khi xóa mềm) |
| `500` | 500 | Movie | Lỗi máy chủ nội bộ hoặc lỗi kết nối database |


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

