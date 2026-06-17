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

| Status | Method | Endpoint | Use Case / Business Description | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| **In Prog** | `POST` | `/api/movie` | Create a new movie along with its assigned showtimes. | Lê Tấn Lộc |
| **Ready** | `GET` | `/api/movie/{id}` | Retrieve details of a specific movie by its ID. | Lê Tấn Lộc |
| **Ready** | `GET` | `/api/movie?page=1&size=10` | Retrieve paginated movies. | Lê Tấn Lộc |
| **In Prog** | `POST` | `/api/movie/room` | Initialize a new cinema room in the theater system. | Lê Tấn Lộc |
| **In Prog** | `POST` | `/api/movie/type` | Add a new movie genre/type (e.g., Action, Sci-Fi). | Lê Tấn Lộc |
Below is a summary of the primary API workflows. For detailed payloads, please refer to the YAML file or Swagger UI.

| Status | Method | Endpoint | Use Case | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| Ready | `PUT` | `/api/movie/update/{id}` | Cập nhật thông tin chi tiết phim | Nguyễn Mạnh Khải|
| Ready | `DELETE` | `/api/movie/delete/{id}` | Xóa mềm phim (soft delete) | Nguyễn Mạnh Khải |

---

## 4. Standardized Error Codes

The system utilizes a combination of standard HTTP Status Codes and custom business codes wrapped inside the `code` attribute of the response body.

| HTTP Status | Custom Code | Error Classification | Message                                                                              |
| ----------- | ----------- | -------------------- | ------------------------------------------------------------------------------------ |
| `400`       | `400`       | Validation           | Invalid input data (e.g., Vietnamese movie name or Director field is blank).         |
| `400`       | `900`       | Business Logic       | Invalid showtime! The cinema only operates from 8:00 AM to 11:00 PM.                 |
| `400`       | `902`       | Business Logic       | Invalid showdate! Showtimes must be scheduled at least 3 days in advance from today. |
| `404`       | `404`       | Not Found            | No matching movie found with the provided ID.                                        |
| `404`       | `404`       | Not Found            | Movie genre not found with the provided ID.                                          |
| `404`       | `904`       | Not Found            | Cinema room does not exist.                                                          |
| `409`       | `409`       | Conflict             | Room name or Movie type name already exists.                                         |
| `409`       | `901`       | Conflict             | A movie schedule already exists in this room.                                        |
| `409`       | `903`       | Conflict             | The room has been booked for another showtime.                                       |
|             |             |                      |                                                                                      |

## 5. Endpoints & Data Structures
### 5.1 Create a New Movie (`POST /api/movie/create`)

#### Description

Create a new movie along with its movie types and showtimes.

#### Request Body (`CreateMovieRequest`)

```json
{
  "movieNameVn": "Avengers: Hồi Kết",
  "movieNameEnglish": "Avengers: Endgame",
  "director": "Anthony Russo, Joe Russo",
  "actor": "Robert Downey Jr., Chris Evans, Scarlett Johansson",
  "content": "Sau sự kiện Infinity War, các siêu anh hùng còn sống sót tìm cách đảo ngược hậu quả do Thanos gây ra.",
  "duration": 181,
  "version": "2D",
  "movieProductionCompany": "Marvel Studios",
  "smallImage": "https://example.com/images/avengers-small.jpg",
  "largeImage": "https://example.com/images/avengers-large.jpg",
  "status": 1,
  "typeIds": [
    1
  ],
  "showTimes": [
    {
      "cinemaRoomId": 1,
      "showDate": "2026-11-30",
      "startTime": "08:00:00"
    },
    {
      "cinemaRoomId": 1,
      "showDate": "2026-10-30",
      "startTime": "08:00:00"
    }
  ]
}
```

#### Request Fields

| Field                  | Type                  | Required | Description                             |
| ---------------------- | --------------------- | -------- | --------------------------------------- |
| movieNameVn            | String                | Yes      | Vietnamese movie name                   |
| movieNameEnglish       | String                | No       | English movie name                      |
| director               | String                | Yes      | Movie director                          |
| actor                  | String                | No       | Cast members                            |
| content                | String                | No       | Movie description                       |
| duration               | Integer               | No       | Movie duration in minutes               |
| version                | String                | No       | Movie version (2D, 3D, IMAX, etc.)      |
| movieProductionCompany | String                | No       | Production company                      |
| smallImage             | String                | No       | Thumbnail image URL                     |
| largeImage             | String                | No       | Banner image URL                        |
| status                 | Integer               | No       | Movie status (1 = Active, 0 = Inactive) |
| typeIds                | List<Long>            | Yes      | List of movie genre IDs                 |
| showTimes              | List<ShowTimeRequest> | Yes      | List of movie showtimes                 |

#### ShowTimeRequest

| Field        | Type      | Required | Description    |
| ------------ | --------- | -------- | -------------- |
| cinemaRoomId | Long      | Yes      | Cinema room ID |
| showDate     | LocalDate | Yes      | Show date      |
| startTime    | LocalTime | Yes      | Start time     |

#### Response - 200 OK

```json
{
  "code": "200",
  "message": "Movie created successfully",
  "status": "OK"
}
```


#### Description

Create a new movie.

#### Request Body (`CreateMovieRequest`)

```json
{
    "movieNameVn": "Avengers: Hồi Kết",
    "movieNameEnglish": "Avengers: Endgame",
    "director": "Anthony Russo, Joe Russo",
    "actor": "Robert Downey Jr., Chris Evans, Scarlett Johansson",
    "content": "Sau sự kiện Infinity War, các siêu anh hùng còn sống sót tìm cách đảo ngược hậu quả do Thanos gây ra.",
    "duration": 181,
    "version": "2D",
    "movieProductionCompany": "Marvel Studios",
    "smallImage": "https://example.com/images/avengers-small.jpg",
    "largeImage": "https://example.com/images/avengers-large.jpg",
    "status": 1,
    "typeIds": [
        1
    ],
    "showTimes": [
        {
            "cinemaRoomId": 1,
            "showDate": "2026-11-30",
            "startTime": "08:00:00"
        },
        {
            "cinemaRoomId": 1,
            "showDate": "2026-10-30",
            "startTime": "08:00:00"
        }
    ]
}
```

#### Response - 200 OK

```json
{
    "code": 0,
    "result": {
        "movieId": 13,
        "actor": "Robert Downey Jr., Chris Evans, Scarlett Johansson",
        "content": "Sau sự kiện Infinity War, các siêu anh hùng còn sống sót tìm cách đảo ngược hậu quả do Thanos gây ra.",
        "director": "Anthony Russo, Joe Russo",
        "duration": 181,
        "movieProductionCompany": "Marvel Studios",
        "version": "2D",
        "movieNameEnglish": "Avengers: Endgame",
        "movieNameVn": "Avengers: Hồi Kết",
        "largeImage": "http://res.cloudinary.com/dzlfgmtbc/image/upload/v1781711111/ltorcd3buhdvkp8uqque.jpg",
        "smallImage": "http://res.cloudinary.com/dzlfgmtbc/image/upload/v1781711108/fg55eskmku8dkbv9tnd3.jpg",
        "status": true,
        "movieType": [
            "Hành độn"
        ],
        "showTimes": [
            {
                "showTimeId": 13,
                "showDate": "2035-11-01",
                "startTime": "16:00:00",
                "endTime": "19:01:00",
                "updateAt": null
            },
            {
                "showTimeId": 14,
                "showDate": "2035-08-01",
                "startTime": "12:01:00",
                "endTime": "15:02:00",
                "updateAt": null
            }
        ],
        "createAt": "2026-06-17T22:45:04.7810888"
    }
}
```

#### Response - 400 Bad Request

```json
{
  "code": "400",
  "message": "Vietnamese movie name cannot be blank; Director cannot be blank",
  "status": "BAD_REQUEST"
}
```

#### Response - Invalid Showtime (Code 900)

```json
{
  "code": "900",
  "message": "Invalid showtime! The cinema only operates from 8:00 AM to 11:00 PM",
  "status": "BAD_REQUEST"
}
```

#### Response - Invalid Show Date (Code 902)

```json
{
  "code": "902",
  "message": "Invalid showdate! Showtimes must be scheduled at least 3 days in advance from today.",
  "status": "BAD_REQUEST"
}
```

#### Response - Genre Not Found

```json
{
  "code": "404",
  "message": "Movie genre not found with the provided ID",
  "status": "NOT_FOUND"
}
```

#### Response - Room Not Found (Code 904)

```json
{
  "code": "904",
  "message": "Cinema room does not exist.",
  "status": "NOT_FOUND"
}
```

#### Response - Room Schedule Conflict (Code 901)

```json
{
  "code": "901",
  "message": "A movie schedule already exists in this room.",
  "status": "CONFLICT"
}
```

#### Response - Showtime Conflict (Code 903)

```json
{
  "code": "903",
  "message": "The room has been booked for another showtime.",
  "status": "CONFLICT"
}
```

---

### 5.2 Get Movie By ID (`GET /api/movie/{id}`)

#### Description

Retrieve a movie by its ID.

#### Path Parameters

| Name | Type | Required |
| ---- | ---- | -------- |
| id   | Long | Yes      |

#### Response - 200 OK

```json
{
    "code": 200,
    "message": "Movie retrieved successfully",
    "result": {
        "movieId": 1,
        "actor": "Robert Downey Jr., Chris Evans, Scarlett Johansson",
        "content": "Sau sự kiện Infinity War, các siêu anh hùng còn sống sót tìm cách đảo ngược hậu quả do Thanos gây ra.",
        "director": "Anthony Russo, Joe Russo",
        "duration": 181,
        "movieProductionCompany": "Marvel Studios",
        "version": "2D",
        "movieNameEnglish": "Avengers: Endgame",
        "movieNameVn": "Avengers: Hồi Kết",
        "largeImage": "https://example.com/images/avengers-large.jpg",
        "smallImage": "https://example.com/images/avengers-small.jpg",
        "status": true,
        "movieType": [
            "Hành động"
        ],
        "showTimes": [
            {
                "showTimeId": 1,
                "showDate": "2026-11-30",
                "startTime": "08:00:00",
                "endTime": "11:01:00",
                "updateAt": null
            },
            {
                "showTimeId": 2,
                "showDate": "2026-10-30",
                "startTime": "08:00:00",
                "endTime": "11:01:00",
                "updateAt": null
            }
        ],
        "createAt": "2026-06-15T02:51:46.966967"
    }
}
```

#### Response - 404 Not Found

```json
{
  "code": "404",
  "message": "No matching movie found",
  "status": "NOT_FOUND"
}
```

---

### 5.3 Get Movies With Pagination (`GET /api/movie`)

#### Description

Retrieve movies using pagination.

#### Query Parameters

| Name | Type    | Required | Default | Description               |
| ---- | ------- | -------- | ------- | ------------------------- |
| page | Integer | No       | 1       | Current page number       |
| size | Integer | No       | 10      | Number of movies per page |

#### Example Request

```http
GET /api/movie?page=1&size=10
```

#### Response - 200 OK

```json
{
  "code": 200,
  "message": "Movie list retrieved successfully",
  "result": {
    "content": [
      {
        "movieId": 1,
        "actor": "Robert Downey Jr., Chris Evans",
        "content": "After the devastating events...",
        "director": "Anthony Russo, Joe Russo",
        "duration": 181,
        "movieProductionCompany": "Marvel Studios",
        "version": "2D",
        "movieNameEnglish": "Avengers: Endgame",
        "movieNameVn": "Avengers: Hồi Kết",
        "largeImage": "https://example.com/images/avengers-large.jpg",
        "smallImage": "https://example.com/images/avengers-small.jpg",
        "status": true,
        "movieType": [
          "Action"
        ],
        "showTimes": [
          {
            "showTimeId": 1,
            "showDate": "2026-11-30",
            "startTime": "08:00:00",
            "endTime": "11:01:00",
            "updateAt": null
          }
        ],
        "createAt": "2026-06-15T02:51:46.966967"
      }
    ],
    "totalElements": 4,
    "totalPages": 1,
    "size": 10,
    "number": 0,
    "first": true,
    "last": true
  }
}
```

#### Response - 404 Not Found

```json
{
  "code": 404,
  "message": "No movies found"
}
```

### 5.4 Create Cinema Room (`POST /api/movie/room`)

#### Request Body

```json
{
  "roomName": "Premium Room 01",
  "seatQuantity": 120
}
```

#### Response - 200 OK

```json
{
  "code": 200,
  "message": "Cinema room created successfully"
}
```

#### Response - 409 Conflict

```json
{
  "code": 409,
  "message": "Room name already exists"
}
```

---

### 5.5 Create Movie Type (`POST /api/movie/type`)

#### Request Body

```json
{
  "typeName": "Hành động"
}
```

#### Response - 200 OK

```json
{
    "code": 0,
    "result": {
        "typeId": 2,
        "typeName": "Hành động"
    }
}
```

#### Response - 409 Conflict

```json
{
  "code": 409,
  "message": "Movie type name already exists"
}
```


