# 🎬 API Contract - CinePrime Movie Service

> **Source of Truth:** This is the single, official document defining the data structures, endpoints, and business error codes for the Movie Service within the CinePrime Cinema Management System. Any modifications to Request/Response schemas must be discussed, updated, and agreed upon here before any actual code implementation begins.

**Version:** v1.0.0  
**OpenAPI Spec:** 3.0.0  
**Last Updated:** June 15, 2026  

---

## 1. Quick Links (Essential Resources)

For parallel development and automated testing, the engineering team should utilize the following standardized resources:

* **OpenAPI Specification (Source File):** `docs/api-specs/movie-service.yaml`
* **Swagger UI (Local Environment):** Run the Spring Boot project and navigate to `http://localhost:8080/docs/index.html`
* **Postman Collection:** `docs/postman/CinePrime_Movie_Collection.json` *(Download and import into Postman for rapid API testing)*

---

## 2. Team Collaboration Workflow

### For the Frontend Team (Web / Mobile)
1. **Independent Development:** Do not wait for the Backend implementation. Directly use the data samples (`examples`) defined in this contract via Postman Mock Server or by hardcoding mock states in your React/Next.js components.
2. **Mandatory Error Handling:** It is required to handle all HTTP Status Codes (`400`, `404`, `409`) along with the specific business error codes listed below to render intuitive UI/UX alerts for the end-user (e.g., room conflict warnings, schedule overlaps).

### For the Backend Team (Spring Boot / Microservices)
1. **API-First Approach:** Strictly adhere to the API-First model. The Request Body and Response JSON structures must match 100% with the schemas defined in this contract.
2. **Change Control:** Under no circumstances should fields be added, renamed, deleted, or data types altered without first updating this Markdown Contract and notifying the Frontend team.

---

## 3. Current API Inventory

All endpoints listed below belong to the **Movie Controller** tag (Managing movies, showtimes, cinema rooms, and movie genres).

| Status | Method | Endpoint | Use Case / Business Description | Assignee |
| :---: | :--- | :--- | :--- | :--- |
| **In Prog** | `POST` | `/api/movie/create` | Create a new movie along with its assigned showtimes. | Nguyễn An Bình |
| **Ready** | `GET` | `/api/movie/find/{id}` | Retrieve details of a specific movie by its ID. | Nguyễn An Bình |
| **Ready** | `GET` | `/api/movie/find-all` | Fetch a list of all movies (including genres and showtimes). | Nguyễn An Bình |
| **In Prog** | `POST` | `/api/movie/create-room` | Initialize a new cinema room in the theater system. | Trần Minh Tâm |
| **In Prog** | `POST` | `/api/movie/create-type` | Add a new movie genre/type (e.g., Action, Sci-Fi). | Trần Minh Tâm |

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
  "code": "200",
  "message": "Movie created successfully",
  "status": "OK"
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

### 5.2 Get Movie By ID (`GET /api/movie/find/{id}`)

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

### 5.3 Get All Movies (`GET /api/movie/find-all`)

#### Description

Retrieve all movies.

#### Response - 200 OK

```json
{
  "code": "200",
  "message": "Movie list retrieved successfully",
  "status": "OK",
  "data": [
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
      "movieConnects": [
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
  ]
}
```

#### Response - 404 Not Found

```json
{
  "code": "404",
  "message": "No movies found",
  "status": "NOT_FOUND"
}
```

---

### 5.4 Create Cinema Room (`POST /api/movie/create-room`)

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
  "code": "200",
  "message": "Cinema room created successfully",
  "status": "OK"
}
```

#### Response - 409 Conflict

```json
{
  "code": "409",
  "message": "Room name already exists",
  "status": "CONFLICT"
}
```

---

### 5.5 Create Movie Type (`POST /api/movie/create-type`)

#### Request Body

```json
{
  "typeName": "Action"
}
```

#### Response - 200 OK

```json
{
  "code": "200",
  "message": "Movie type created successfully",
  "status": "OK"
}
```

#### Response - 409 Conflict

```json
{
  "code": "409",
  "message": "Movie type name already exists",
  "status": "CONFLICT"
}
```

---


