# Movie Service - Postman Test Cases and Sample Data

> **Snapshot:** 2026-07-14
> **Scope:** `server/movie-service`
> **Source of truth used:** current Java controllers, request DTOs, enums, services, and security configuration.
> **Purpose:** manual API verification with Postman against a disposable development database.

## 1. Important notes before testing

### Base URLs

The current runtime configuration uses:

```text
Direct movie-service: http://localhost:8081
Via API Gateway:      http://localhost:8080
```

The older API contract mentions port `8082`, but the current `application.yml` and
`docker-compose.yml` expose movie-service on port `8081`. Use `8081` when testing the
service directly.

### Standard response envelope

Most endpoints return:

```json
{
  "code": 200,
  "message": "Optional message",
  "result": {}
}
```

Do not assume that body `code` always equals the HTTP status. In particular,
`/api/schedules` and `/api/showtimes` currently use body code `1000` for success.

### Authentication

Set the following Postman collection variables:

| Variable | Example | Purpose |
|---|---|---|
| `baseUrl` | `http://localhost:8081` | Direct movie-service URL |
| `adminToken` | JWT access token | Token containing `ROLE_ADMIN` |
| `employeeToken` | JWT access token | Token containing `ROLE_EMPLOYEE` |
| `runId` | Generated in script | Makes test data unique |
| `futureDate` | Generated in script | Today + 3 days |
| `futureDate2` | Generated in script | Today + 4 days |

For protected requests, use:

```http
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

Use this collection-level pre-request script:

```javascript
if (!pm.collectionVariables.get("runId")) {
  pm.collectionVariables.set("runId", Date.now().toString());
}

function datePlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

pm.collectionVariables.set("futureDate", datePlusDays(3));
pm.collectionVariables.set("futureDate2", datePlusDays(4));
```

### Common Postman assertions

Successful JSON response:

```javascript
pm.test("HTTP status is successful", function () {
  pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

pm.test("Response uses ApiResponse envelope", function () {
  const json = pm.response.json();
  pm.expect(json).to.have.property("result");
});
```

Save a newly created resource ID, adjusting the property name as needed:

```javascript
const json = pm.response.json();
pm.collectionVariables.set("movieId", json.result.movieId);
```

Expected application error:

```javascript
pm.test("Expected error status", function () {
  pm.expect(pm.response.code).to.be.oneOf([400, 403, 404, 409]);
});
```

## 2. Recommended execution order

Run folders in this order because later requests reuse IDs from earlier responses:

1. Public/read and security smoke tests.
2. Reference data: age rating, format, company, person, genre.
3. Movie CRUD and lifecycle.
4. Cinema Cluster workflow.
5. Cinema Room and generated seats.
6. Schedule/showtime and showtime seats.
7. Images and TMDB integration.
8. Cleanup.

For a database initialized with `server/postgres-init/movie_db.sql` and
`server/movie-service/src/main/resources/data.sql`, these IDs normally exist:

```text
genreId=1                  Action
ageRatingId=1              P
companyId=1                Warner Bros. Pictures
formatId=1                 2D
personId=1                 Denis Villeneuve
movieId=1                  Dune: Part Two
```

Always call the relevant GET endpoint first and update variables if the database is not
using the seed data.

---

## 3. Authentication and public visibility

| ID | Request | Token | Expected current result |
|---|---|---|---|
| AUTH-01 | `GET /api/movies/public` | None | 200 |
| AUTH-02 | `GET /api/genres` | None | 200 |
| AUTH-03 | `GET /api/cinema-clusters` | None | 200; only ACTIVE clusters |
| AUTH-04 | `GET /api/cinema-rooms` | None | 200 |
| AUTH-05 | `POST /api/movies` | None | 401 |
| AUTH-06 | `POST /api/movies` | EMPLOYEE | Allowed |
| AUTH-07 | `POST /api/movies/{id}/approve` | EMPLOYEE | 403 |
| AUTH-08 | `POST /api/schedules` | EMPLOYEE | 403 |
| AUTH-09 | `GET /api/movies/all` | None | 401/403 due to method security |
| AUTH-10 | Protected endpoint with malformed/expired token | Invalid token | 401 |

Security observations from current implementation:

- Person create/update/delete, movie-image mutation, seat update, and showtime-seat lock
  require authentication through the global security rule but do not currently restrict a
  specific role at method level.
- `GET /api/cinema-clusters/{id}` currently returns a cluster by ID without filtering its
  status. Test `AUTH-11`: a public caller can request a known DRAFT cluster ID. If it returns
  the DRAFT cluster, record this as a visibility defect.

---

## 4. Reference data

### 4.1 Age ratings

#### REF-AR-01 - Get all

```http
GET {{baseUrl}}/api/age-ratings
```

Expected: 200 and ratings such as `P`, `K`, `T13`, `T16`, `T18`, `C` on a seeded DB.

#### REF-AR-02 - Create

```http
POST {{baseUrl}}/api/age-ratings
Authorization: Bearer {{adminToken}}
```

```json
{
  "ratingCode": "X{{runId}}",
  "minAge": 18,
  "description": "Postman disposable age rating"
}
```

Expected: 201. Save `result.ratingId` as `testAgeRatingId`.

#### REF-AR-03 - Validation

Test each invalid body independently:

```json
{ "ratingCode": "", "minAge": 18, "description": "Valid description" }
```

```json
{ "ratingCode": "LONG-CODE", "minAge": 18, "description": "Valid description" }
```

```json
{ "ratingCode": "X", "minAge": 22, "description": "Valid description" }
```

Expected: 400.

#### REF-AR-04 - Update and delete

```http
PUT {{baseUrl}}/api/age-ratings/{{testAgeRatingId}}
DELETE {{baseUrl}}/api/age-ratings/{{testAgeRatingId}}
```

Update body:

```json
{
  "ratingCode": "X",
  "minAge": 18,
  "description": "Updated disposable rating"
}
```

Expected: update 200, delete 200. Only delete an unused test rating.

### 4.2 Genres

#### REF-GE-01 - Read

```http
GET {{baseUrl}}/api/genres
GET {{baseUrl}}/api/genres/1
```

Expected: 200.

#### REF-GE-02 - Create

```http
POST {{baseUrl}}/api/genres
Authorization: Bearer {{adminToken}}
```

```json
{
  "genreName": "Postman Genre {{runId}}"
}
```

Expected: 201. The current controller has no update/delete genre endpoint, so run this only
on a disposable database.

Invalid cases: blank name, one-character name, name over 100 characters. Expected: 400.

### 4.3 Screening formats

#### REF-FM-01 - Read

```http
GET {{baseUrl}}/api/screening-formats
GET {{baseUrl}}/api/screening-formats/1
```

#### REF-FM-02 - Create

```json
{
  "formatCode": "TEST{{runId}}",
  "formatName": "Postman Test Format",
  "description": "Disposable format for API testing",
  "surcharge": 15000
}
```

Expected: 201. Save `result.formatId` as `testFormatId`.

Validation cases:

| Case | Change | Expected |
|---|---|---|
| REF-FM-03 | Blank `formatCode` | 400 |
| REF-FM-04 | Blank `formatName` | 400 |
| REF-FM-05 | Negative `surcharge` | 400 |
| REF-FM-06 | Missing `surcharge` | 400 |

Update and delete:

```http
PUT {{baseUrl}}/api/screening-formats/{{testFormatId}}
DELETE {{baseUrl}}/api/screening-formats/{{testFormatId}}
```

Only delete a format that is not referenced by a movie.

### 4.4 Production companies

#### REF-CO-01 - Create

```http
POST {{baseUrl}}/api/companies
Authorization: Bearer {{adminToken}}
```

```json
{
  "name": "CinePrime Postman Studio {{runId}}",
  "country": "Vietnam",
  "logoUrl": "https://example.com/studio-logo.png",
  "websiteUrl": "https://example.com"
}
```

Expected: 201. Save `result.companyId` as `testCompanyId`.

Additional cases:

| ID | Request | Expected |
|---|---|---|
| REF-CO-02 | `GET /api/companies?q=Postman` | Created company returned |
| REF-CO-03 | `GET /api/companies/{testCompanyId}` | 200 |
| REF-CO-04 | Create with blank `name` | 400 |
| REF-CO-05 | Update company | 200 |
| REF-CO-06 | Delete unused company | 200 |
| REF-CO-07 | Get missing ID | 404, application code 2017 |

### 4.5 Persons

#### REF-PE-01 - Create director

```http
POST {{baseUrl}}/api/persons
Authorization: Bearer {{employeeToken}}
```

```json
{
  "fullName": "Postman Director {{runId}}",
  "nationality": "Vietnamese",
  "birthDate": "1985-06-15",
  "photoUrl": "https://example.com/director.jpg",
  "biography": "Disposable person used by movie-service Postman tests",
  "tmdbId": null
}
```

Expected: 201. Save `result.personId` as `testPersonId`.

Additional cases:

| ID | Request | Expected |
|---|---|---|
| REF-PE-02 | `GET /api/persons?q=Postman` | Created person returned |
| REF-PE-03 | `GET /api/persons/search?q=Postman` | Created person returned |
| REF-PE-04 | `GET /api/persons/{testPersonId}` | 200 |
| REF-PE-05 | Blank/one-character `fullName` | 400 |
| REF-PE-06 | Update biography/nationality | 200 |
| REF-PE-07 | Delete unused person | 200 |

The database currently accepts cast role values:

```text
ACTOR, DIRECTOR, WRITER, PRODUCER, COMPOSER
```

---

## 5. Movie CRUD and lifecycle

Chi tiết riêng cho luồng tạo Movie, gồm dữ liệu chuẩn bị, payload đầy đủ, Postman
assertions, validation, transaction rollback và approval flow:

- [Luồng tạo Movie - dữ liệu và test case chi tiết](movie-creation-postman-detailed.md)

Before running this section, set valid `genreId`, `formatId`, `ageRatingId`, `companyId`,
and `personId` variables from reference GET responses.

### 5.1 Create a complete movie

#### MOV-01 - Happy path

```http
POST {{baseUrl}}/api/movies
Authorization: Bearer {{employeeToken}}
```

```json
{
  "originalTitle": "CinePrime Postman Movie {{runId}}",
  "originalLanguage": "en",
  "durationMinutes": 120,
  "releaseDate": "2026-08-01",
  "endDate": "2026-09-15",
  "country": "USA",
  "ageRatingId": {{ageRatingId}},
  "companyId": {{companyId}},
  "genreIds": [{{genreId}}],
  "formatIds": [{{formatId}}],
  "posterUrl": "https://example.com/poster.jpg",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "trailerUrl": "https://www.youtube.com/watch?v=test",
  "synopsis": "A disposable movie created for Postman testing.",
  "translations": [
    {
      "languageCode": "vi",
      "title": "Phim Postman {{runId}}",
      "synopsis": "Dữ liệu thử nghiệm cho movie-service."
    }
  ],
  "cast": [
    {
      "personId": {{personId}},
      "roleType": "DIRECTOR",
      "characterName": null,
      "billingOrder": 1
    }
  ]
}
```

Expected: 200, `result.status = DRAFT`. Save `result.movieId` as `movieId`.

```javascript
const json = pm.response.json();
pm.collectionVariables.set("movieId", json.result.movieId);
```

### 5.2 Create validation and reference failures

| ID | Data change | Expected |
|---|---|---|
| MOV-02 | Blank `originalTitle` | 400 |
| MOV-03 | `originalLanguage="eng"` | 400; must be exactly 2 chars |
| MOV-04 | `durationMinutes=0` | 400 |
| MOV-05 | `genreIds=[]` | 400 |
| MOV-06 | `formatIds=[]` | 400 |
| MOV-07 | Nonexistent `genreId` | 404, code 2010 |
| MOV-08 | Nonexistent `formatId` | 404, code 2018 |
| MOV-09 | Nonexistent `ageRatingId` | 404, code 2016 |
| MOV-10 | Nonexistent `companyId` | 404, code 2017 |
| MOV-11 | Nonexistent cast `personId` | 404, code 2019 |
| MOV-12 | Invalid cast `roleType` | Database constraint failure; should be normalized to a 400 defect |
| MOV-13 | Create same `originalTitle` ignoring case | 409, code 2014 |
| MOV-14 | `endDate` before `releaseDate` | Verify current behavior; no DTO validation is visible, log a defect if accepted |

### 5.3 Read and filter

| ID | Request | Expected |
|---|---|---|
| MOV-15 | `GET /api/movies/{movieId}` | 200 with all translations |
| MOV-16 | `GET /api/movies/{movieId}?lang=vi` | Only Vietnamese translation returned |
| MOV-17 | `GET /api/movies?page=1&size=10` | Paged response |
| MOV-18 | `GET /api/movies?page=1&size=10&status=DRAFT` | Only DRAFT rows |
| MOV-19 | `GET /api/movies?page=1&size=10&genreId={genreId}` | Filtered page |
| MOV-20 | `GET /api/movies?page=1&size=10&date=2026-08-01` | Date-filtered page |
| MOV-21 | `GET /api/movies/public` | Only public statuses expected |
| MOV-22 | `GET /api/movies/99999999` | 404, code 2002 |

### 5.4 Partial update

#### MOV-23

```http
PUT {{baseUrl}}/api/movies/{{movieId}}
Authorization: Bearer {{employeeToken}}
```

```json
{
  "durationMinutes": 125,
  "synopsis": "Updated by Postman",
  "genreIds": [{{genreId}}],
  "formatIds": [{{formatId}}]
}
```

Expected: 200 and unchanged fields preserved.

Negative updates: nonexistent genre/format/person IDs, invalid language length, and
`durationMinutes=0` should return 4xx.

### 5.5 Happy lifecycle

Execute sequentially with the same `movieId`:

| ID | Request | Transition | Token | Expected |
|---|---|---|---|---|
| MOV-24 | `POST /api/movies/{movieId}/submit` | DRAFT -> PENDING_REVIEW | EMPLOYEE | 200 |
| MOV-25 | Repeat submit | Invalid | EMPLOYEE | 400, code 2020 |
| MOV-26 | `POST /api/movies/{movieId}/approve` | PENDING_REVIEW -> COMING_SOON | ADMIN | 200 |
| MOV-27 | `POST /api/movies/{movieId}/release` | COMING_SOON -> NOW_SHOWING | ADMIN | 200 |
| MOV-28 | `POST /api/movies/{movieId}/suspend` | NOW_SHOWING -> SUSPENDED | ADMIN | 200 |
| MOV-29 | `POST /api/movies/{movieId}/reinstate` | SUSPENDED -> NOW_SHOWING | ADMIN | 200 |
| MOV-30 | `POST /api/movies/{movieId}/end` | NOW_SHOWING -> ENDED | ADMIN | 200 |
| MOV-31 | Release ENDED movie | Invalid | ADMIN | 400, code 2020 |

Suspend body:

```json
{
  "reason": "Temporary content review for Postman test"
}
```

Blank reason should return 400.

### 5.6 Rejection/rework branch

Create a second movie using a different title and save it as `rejectedMovieId`.

```text
POST /api/movies/{rejectedMovieId}/submit
POST /api/movies/{rejectedMovieId}/reject
POST /api/movies/{rejectedMovieId}/rework
```

Reject body:

```json
{
  "note": "Poster and Vietnamese synopsis must be revised"
}
```

Expected statuses: `PENDING_REVIEW -> REJECTED -> DRAFT`. Blank rejection note should
return 400.

### 5.7 Soft delete

| ID | Case | Expected |
|---|---|---|
| MOV-32 | DELETE movie without future showtime | 200; status becomes ENDED |
| MOV-33 | DELETE movie with a future showtime | 409, code 2011 |
| MOV-34 | DELETE nonexistent movie | 404, code 2002 |
| MOV-35 | EMPLOYEE calls DELETE | 403 |

---

## 6. Cinema Cluster workflow

Accepted province values are controlled by `@ValidProvince`. Use a value already present
in the application list, such as `TP. Hồ Chí Minh`, `Hà Nội`, or `Đà Nẵng`.

### 6.1 Admin-created active cluster

#### CLU-01

```http
POST {{baseUrl}}/api/cinema-clusters
Authorization: Bearer {{adminToken}}
```

```json
{
  "clusterName": "CinePrime Postman Admin {{runId}}",
  "province": "TP. Hồ Chí Minh",
  "address": "123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
  "latitude": 10.7731,
  "longitude": 106.7030
}
```

Expected: 201, status ACTIVE, hotline assigned by backend. Save `clusterId`.

### 6.2 Employee approval workflow

Create with EMPLOYEE token and a different name:

```json
{
  "clusterName": "CinePrime Postman Employee {{runId}}",
  "province": "Hà Nội",
  "address": "100 Tràng Tiền, Hoàn Kiếm, Hà Nội",
  "latitude": 21.0245,
  "longitude": 105.8572
}
```

Save as `employeeClusterId`.

| ID | Request | Expected |
|---|---|---|
| CLU-02 | Employee creates cluster | 201, DRAFT |
| CLU-03 | Public GET list | DRAFT cluster hidden |
| CLU-04 | Employee `POST /{id}/submit` | PENDING_REVIEW |
| CLU-05 | Employee edits PENDING_REVIEW cluster | 400, code 2026 |
| CLU-06 | Employee approves | 403 |
| CLU-07 | Admin `POST /{id}/approve` | ACTIVE |
| CLU-08 | Public GET list | Newly ACTIVE cluster visible |
| CLU-09 | `GET /{id}/audit-log` with ADMIN | 200 with CREATE/SUBMIT/APPROVE actions |
| CLU-10 | Audit log with EMPLOYEE/public | 403/401 |

### 6.3 Rejection branch

Create another employee cluster and save `rejectedClusterId`:

```text
POST /api/cinema-clusters/{rejectedClusterId}/submit
POST /api/cinema-clusters/{rejectedClusterId}/reject
```

Reject body:

```json
{
  "note": "Address evidence is incomplete"
}
```

Expected: after reject, status returns to DRAFT with rejection note. Employee can update and
resubmit it.

### 6.4 Validation and transitions

| ID | Input/action | Expected |
|---|---|---|
| CLU-11 | Blank/one-character cluster name | 400 |
| CLU-12 | Duplicate name ignoring case | 409, code 2027 |
| CLU-13 | Invalid province | 400 |
| CLU-14 | Address shorter than 10 chars | 400 |
| CLU-15 | Latitude outside -90..90 | 400 |
| CLU-16 | Longitude outside -180..180 | 400 |
| CLU-17 | `GET ?status=UNKNOWN` | 400, code 2025 |
| CLU-18 | Public `GET ?status=DRAFT` | Current controller coerces to ACTIVE |
| CLU-19 | Repeat submit/approve/reject from wrong status | 400, code 2026 |
| CLU-20 | Admin PUT ACTIVE -> INACTIVE | 200 |
| CLU-21 | Admin PUT INACTIVE -> ACTIVE | 200 |
| CLU-22 | PUT directly to DRAFT/PENDING_REVIEW | 400, code 2026 |
| CLU-23 | Delete empty cluster as ADMIN | 200 |
| CLU-24 | Delete cluster containing a room | 409, code 2024 |
| CLU-25 | Delete as EMPLOYEE | 403 |

Admin status toggle body must still provide all required fields:

```json
{
  "clusterName": "CinePrime Postman Admin {{runId}}",
  "province": "TP. Hồ Chí Minh",
  "address": "123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
  "latitude": 10.7731,
  "longitude": 106.7030,
  "status": "INACTIVE"
}
```

---

## 7. Cinema Room, seat generation, and maintenance

A room can only be created inside an ACTIVE cluster.

⚠️ **`totalSeatCapacity` is no longer a request field.** `CinemaRoomRequest` now takes
`numberOfRows` + `seatsPerRow` instead — the server computes and persists
`totalSeatCapacity = numberOfRows × seatsPerRow` itself (`CinemaRoomService.createCinemaRoom`).
`RoomType` only supplies `maxSeats` (the ceiling) and a suggested default layout for the
frontend form; it no longer forces a fixed seats-per-row or seat-zone ratio for a given type.
The request must explicitly allocate every physical row using `standardRowCount`,
`vipRowCount`, and `coupleRowCount`.

### 7.1 Create room samples

#### ROOM-01 - Standard 50-person room

```http
POST {{baseUrl}}/api/cinema-rooms
Authorization: Bearer {{employeeToken}}
```

```json
{
  "cinemaRoomName": "Room 1",
  "roomType": "STANDARD",
  "numberOfRows": 5,
  "seatsPerRow": 10,
  "standardRowCount": 3,
  "vipRowCount": 1,
  "coupleRowCount": 1,
  "defaultPrice": 85000,
  "clusterId": {{clusterId}}
}
```

Expected: 200, ACTIVE, `result.totalSeatCapacity` = 50 (computed, not echoed from request). Save `result.cinemaRoomId` as `roomId`.

#### ROOM-02 - Large room

```json
{
  "cinemaRoomName": "Room 2",
  "roomType": "LARGE",
  "numberOfRows": 12,
  "seatsPerRow": 10,
  "standardRowCount": 7,
  "vipRowCount": 4,
  "coupleRowCount": 1,
  "defaultPrice": 100000,
  "clusterId": {{clusterId}}
}
```

#### ROOM-03 - IMAX room

```json
{
  "cinemaRoomName": "IMAX 1",
  "roomType": "IMAX",
  "numberOfRows": 20,
  "seatsPerRow": 15,
  "standardRowCount": 14,
  "vipRowCount": 6,
  "coupleRowCount": 0,
  "defaultPrice": 150000,
  "clusterId": {{clusterId}}
}
```

Current RoomType rules (`seatsPerRow` and all zone counts are admin-adjustable per room):

| Type | Max capacity | Default places per row | Default zone suggestion |
|---|---:|---:|---|
| STANDARD | 100 | 10 | Approximately 60% Standard / 30% VIP / 10% Couple |
| LARGE | 200 | 10 | Approximately 60% Standard / 30% VIP / 10% Couple |
| IMAX | 300 | 15 | Approximately 70% Standard / 30% VIP / 0% Couple because width 15 is odd |

The percentages above are UI suggestions, not business rules. The persisted source of truth
is the exact row counts sent for that room.

### 7.2 Room validation

| ID | Data/action | Expected |
|---|---|---|
| ROOM-04 | Blank/one-character room name | 400 |
| ROOM-05 | Missing room type | 400 |
| ROOM-06 | `numberOfRows × seatsPerRow` below 10 (e.g. `numberOfRows=2, seatsPerRow=3`) | 400, code 2031 (`SEAT_QUANTITY_TOO_SMALL`) |
| ROOM-06b | `numberOfRows` or `seatsPerRow` = 0 or negative | 400 (`@Min(1)` on each field) |
| ROOM-07 | STANDARD, `numberOfRows × seatsPerRow` > 100 | 400, code 2013 |
| ROOM-08 | LARGE, `numberOfRows × seatsPerRow` > 200 | 400, code 2013 |
| ROOM-09 | IMAX, `numberOfRows × seatsPerRow` > 300 | 400, code 2013 |
| ROOM-10 | Price = 0 or negative | 400 |
| ROOM-11 | Missing/nonexistent cluster | 400/404, code 2023 when nonexistent |
| ROOM-12 | Cluster is DRAFT/PENDING_REVIEW/INACTIVE | 400, code 2029 |
| ROOM-13 | Duplicate room name in same cluster | 409, code 2004 |
| ROOM-14 | Same room name in another ACTIVE cluster | Allowed |
| ROOM-15 | `GET /api/cinema-rooms?clusterId={clusterId}` | Only rooms in cluster |
| ROOM-16 | `numberOfRows` > 50 (checked before saving the room, in `CinemaRoomService`, not just inside seat generation) | 400, code 2030 (`SEAT_ROW_LIMIT_EXCEEDED`) |
| ROOM-17 | `standardRowCount + vipRowCount + coupleRowCount != numberOfRows` | 400, code 2032 (`SEAT_ROW_ALLOCATION_INVALID`) |
| ROOM-18 | All rows are Couple (`standardRowCount + vipRowCount = 0`) | 400, code 2032; at least one single-seat row is required for Accessible seats |
| ROOM-19 | `coupleRowCount > 0` while `seatsPerRow` is odd | 400, code 2033 (`COUPLE_ROW_REQUIRES_EVEN_SEATS`) |
| ROOM-20 | Same `roomType` with two different valid row allocations | Both allowed; generated maps follow each request rather than RoomType ratios |

### 7.3 Generated seat verification

```http
GET {{baseUrl}}/api/seats/room/{{roomId}}
GET {{baseUrl}}/api/cinema-rooms/{{roomId}}/seats
```

For STANDARD `numberOfRows=5, seatsPerRow=10` (capacity 50), expected current layout:

```text
5 physical rows: A-E
A, B, C: STANDARD
D: VIP plus ACCESSIBLE positions
E: 5 COUPLE seat records; each couple unit has colSpan=2
```

The number of Seat records may be less than room capacity because one couple record occupies
two physical places and represents two-person capacity.

| ID | Verification | Expected |
|---|---|---|
| SEAT-01 | STANDARD `numberOfRows=1, seatsPerRow=10` (capacity 10) | One row, no Couple row |
| SEAT-02 | Any type with `coupleRowCount=0` | No COUPLE row is generated |
| SEAT-03 | IMAX with even `seatsPerRow` and `coupleRowCount > 0` | COUPLE rows are allowed; RoomType no longer decides the zone mix |
| SEAT-04 | VIP price | `defaultPrice * 1.25` |
| SEAT-05 | COUPLE price | `defaultPrice * 1.8` per couple unit in current model |
| SEAT-06 | ACCESSIBLE price | `defaultPrice * 1.0` |
| SEAT-07 | STANDARD/LARGE aisle positions | For full 10-place row, aisle after columns 3 and 7 |
| SEAT-08 | IMAX aisle positions | For full 15-place row, aisle after columns 4 and 11 |
| SEAT-09 | Accessible count | `max(2, round(capacity * 1%))` |

Save one returned `seatId` as `seatId`, then update it:

```http
PUT {{baseUrl}}/api/seats/{{seatId}}
Authorization: Bearer {{adminToken}}
```

```json
{
  "seatType": "COUPLE",
  "price": 190000
}
```

Expected: 200. Invalid seat type, missing price, zero/negative price, and missing seat ID
should return 4xx. Note that current API does not validate whether changing a single seat to
`COUPLE` creates a physically consistent colSpan layout; record as a defect if needed.

### 7.4 Maintenance and room status

Report maintenance:

```http
POST {{baseUrl}}/api/cinema-rooms/{{roomId}}/maintenance
Authorization: Bearer {{employeeToken}}
X-User-Name: postman.employee
```

```json
{
  "reason": "Projector cooling fan failure",
  "severity": "HIGH",
  "startedAt": "2026-07-14T09:30:00"
}
```

Expected: 200 and room status becomes `TEMPORARILY_UNAVAILABLE`.

Validation cases: blank reason, missing severity, invalid severity. Expected: 400.

Resolve maintenance:

```http
POST {{baseUrl}}/api/cinema-rooms/maintenance/{{maintenanceId}}/resolve?resolutionNote=Fan%20replaced
Authorization: Bearer {{employeeToken}}
X-User-Name: postman.employee
```

**Current black-box test gap:** the report endpoint returns `Void` and there is no GET
maintenance endpoint, so Postman cannot obtain `maintenanceId` from the API response. Resolve
can only be tested if the ID is read from the database or the API is changed to return the
created maintenance record/ID.

Manual status change:

```http
PATCH {{baseUrl}}/api/cinema-rooms/{{roomId}}/status?status=CLOSED
Authorization: Bearer {{adminToken}}
X-User-Name: postman.admin
```

Accepted current values:

```text
ACTIVE, MAINTENANCE, TEMPORARILY_UNAVAILABLE, CLOSED
```

### 7.5 Delete room

| ID | Case | Expected |
|---|---|---|
| ROOM-17 | Delete room that has never had a showtime | 200; room and seats hard-deleted |
| ROOM-18 | Delete room with any showtime, including historical/cancelled | 409, code 2028 |
| ROOM-19 | Delete nonexistent room | 404, code 2003 |
| ROOM-20 | Public delete | 401 |

---

## 8. Schedule/showtime and showtime seats

Use an existing movie with a valid duration and an ACTIVE room. The current service requires
showDate to be at least today + 3 days and requires the complete movie interval to be within
08:00-23:00.

### 8.1 Create schedule

#### SCH-01

```http
POST {{baseUrl}}/api/schedules
Authorization: Bearer {{adminToken}}
```

```json
{
  "movieId": {{scheduleMovieId}},
  "cinemaRoomId": {{roomId}},
  "showDate": "{{futureDate}}",
  "startTime": "10:00:00",
  "languageCode": "vi",
  "subtitleCode": "en",
  "basePrice": 110000
}
```

Expected current result: HTTP 201, body code 1000, status SCHEDULED. Save
`result.showTimeId` as `showtimeId`.

```javascript
const json = pm.response.json();
pm.collectionVariables.set("showtimeId", json.result.showTimeId);
```

### 8.2 Schedule validation and overlap

| ID | Data/action | Expected current result |
|---|---|---|
| SCH-02 | Missing movie ID | 400 |
| SCH-03 | Nonexistent movie ID | 404, code 2002 |
| SCH-04 | Missing/nonexistent room ID | 400/404, code 2003 |
| SCH-05 | Date before today + 3 days | 400, code 2008 |
| SCH-06 | Start before 08:00 | 400, code 2006 |
| SCH-07 | Movie end time after 23:00 | 400, code 2006 |
| SCH-08 | Same room/date with overlapping time | 409, code 2009 |
| SCH-09 | Same room/date immediately after first movie ends | Allowed |
| SCH-10 | Same time in a different room | Allowed |
| SCH-11 | Create as EMPLOYEE | 403 |

To test overlap, repeat SCH-01 with start `10:30:00` for a 120-minute movie.

### 8.3 Read and update

| ID | Request | Expected |
|---|---|---|
| SCH-12 | `GET /api/schedules` | 200 |
| SCH-13 | `GET /api/schedules/{showtimeId}` | 200 |
| SCH-14 | `GET /api/schedules/movie/{movieId}` | 200 |
| SCH-15 | `GET /api/schedules/movie/{movieId}?date={futureDate}` | Date-filtered list |
| SCH-16 | Get nonexistent schedule | 404, code 2015 |

Partial update:

```http
PUT {{baseUrl}}/api/schedules/{{showtimeId}}
Authorization: Bearer {{adminToken}}
```

```json
{
  "showDate": "{{futureDate2}}",
  "startTime": "14:00:00"
}
```

Expected: 200. Repeat with an overlapping room/date/time and expect 409.

### 8.4 Showtime seat lazy initialization

```http
GET {{baseUrl}}/api/showtimes/{{showtimeId}}/seats
```

Expected current behavior:

- First call lazily copies room seats into `showtime_seat`.
- Each row includes `seatId`, `row`, `number`, `type`, `colSpan`, `aisleAfter`, `status`,
  and `price`.
- Initial status is `AVAILABLE`.
- The price currently comes from `Seat.price`.

Save two returned showtime-seat IDs as `showtimeSeatId1` and `showtimeSeatId2`.

```javascript
const seats = pm.response.json().result;
pm.collectionVariables.set("showtimeSeatId1", seats[0].seatId);
pm.collectionVariables.set("showtimeSeatId2", seats[1].seatId);
```

Lock seats:

```http
PUT {{baseUrl}}/api/showtimes/{{showtimeId}}/seats/lock
Authorization: Bearer {{employeeToken}}
```

```json
[
  {{showtimeSeatId1}},
  {{showtimeSeatId2}}
]
```

Expected: 200. A subsequent GET maps RESERVED to `LOCKED`; the lock expires after 15 minutes.
Trying to lock the same unexpired seats again currently raises a generic runtime error and
should be normalized to a domain 409 response.

### 8.5 Current implementation gaps to verify explicitly

These are diagnostic cases. Record the observed result rather than treating acceptance as a
correct business outcome.

| ID | Diagnostic case | Current code observation | Desired business result |
|---|---|---|---|
| GAP-SCH-01 | Create schedule for DRAFT/REJECTED/ENDED movie | No movie-status guard visible | Reject |
| GAP-SCH-02 | Create schedule in CLOSED/maintenance room | No room-status guard visible | Reject |
| GAP-SCH-03 | Send `basePrice` in create request | Field is not applied in `createStandalone`; showtime seats use room-seat price | Apply showtime price policy |
| GAP-SCH-04 | Lock seat ID belonging to another showtime while using this showtime URL | `lockSeats` loads IDs without checking URL showtime ownership | Reject |
| GAP-SCH-05 | GET seats for missing showtime | Service currently throws MOVIE_NOT_FOUND | Return SHOWTIME_NOT_FOUND |
| GAP-SCH-06 | Delete a future showtime | Blocked by ACTIVE_SHOWTIMES_EXIST; no cancel command exists | Provide explicit cancel flow |
| GAP-SCH-07 | Schedule response success body code | Uses 1000 instead of HTTP-like 200/201 convention | Standardize envelope |

### 8.6 Delete schedule

```http
DELETE {{baseUrl}}/api/schedules/{{showtimeId}}
Authorization: Bearer {{adminToken}}
```

Expected current behavior:

- Future showtime: 409, code 2011.
- Missing showtime: 404, code 2015.
- Only a non-future showtime can be hard-deleted through the current API.

Because create requires a future date, a newly created Postman schedule cannot be cleaned up
through the API immediately. Use a disposable DB/reset strategy until a cancel endpoint exists.

---

## 9. Movie images and TMDB

### 9.1 Upload a file to Cloudinary

```http
POST {{baseUrl}}/api/movies/images
Authorization: Bearer {{employeeToken}}
Content-Type: multipart/form-data
```

Postman Body -> form-data:

| Key | Type | Value |
|---|---|---|
| `file` | File | A JPG, PNG, or WebP file up to 5 MB |

| ID | Case | Expected |
|---|---|---|
| IMG-01 | Valid JPG/PNG/WebP <= 5 MB | 200 with uploaded URL |
| IMG-02 | Missing/empty file | 400, code 5002 |
| IMG-03 | PDF/TXT file | 400, code 5002 |
| IMG-04 | Image > 5 MB | 400, code 5002 |
| IMG-05 | Cloudinary unavailable/invalid credentials | 500, code 5001 |

This test performs an external write to configured Cloudinary storage.

### 9.2 Attach image metadata to a movie

```http
POST {{baseUrl}}/api/movies/{{movieId}}/images
Authorization: Bearer {{employeeToken}}
```

```json
{
  "imageUrl": "https://example.com/movie-still.jpg",
  "imageType": "STILL",
  "displayOrder": 1,
  "caption": "Postman test still"
}
```

Expected: HTTP 201. Save `result.imageId` as `imageId`.

Additional cases:

| ID | Request | Expected |
|---|---|---|
| IMG-06 | GET `/api/movies/{movieId}/images` | Sorted list |
| IMG-07 | Blank image URL | 400 |
| IMG-08 | Missing image type | Defaults to STILL |
| IMG-09 | Delete image using correct movie ID | 200 |
| IMG-10 | Delete image through a different movie ID | 400 |
| IMG-11 | Missing movie/image ID | 404 |

The DTO currently accepts image type as free text even though the documented values are
`POSTER`, `BACKDROP`, `STILL`, and `PROMOTIONAL`. Send an unknown value to verify whether the
database rejects it; normalize this to DTO enum validation if it returns 500.

### 9.3 TMDB integration

```http
GET {{baseUrl}}/api/movies/tmdb/search?q=Dune
GET {{baseUrl}}/api/movies/tmdb/693134/details
POST {{baseUrl}}/api/movies/tmdb/import
Authorization: Bearer {{adminToken}}
```

Import body:

```json
{
  "tmdbId": 693134
}
```

| ID | Case | Expected |
|---|---|---|
| TMDB-01 | Search valid keyword | 200 |
| TMDB-02 | Details valid TMDB ID | 200 |
| TMDB-03 | Import valid, not-yet-imported ID | 200; movie DRAFT |
| TMDB-04 | Import same ID twice | 409, code 2021 |
| TMDB-05 | Missing tmdbId | 400 |
| TMDB-06 | Invalid/unreachable TMDB | 502, code 2022 |
| TMDB-07 | Browse/details/import as EMPLOYEE | 200 |
| TMDB-08 | Call as public/unauthenticated user | 401 |
| TMDB-09 | Sync genres as EMPLOYEE | 403 |

These cases require outbound network access and a valid TMDB API key.

---

## 10. Cleanup order

Run cleanup only against resources created by this test run:

1. Delete unattached movie images.
2. Soft-delete test movies that have no future schedules.
3. Delete rooms that have never had a schedule.
4. Delete now-empty clusters.
5. Delete unused person/company/format/age-rating records.

Known cleanup limitations:

- A future showtime cannot currently be deleted or cancelled immediately.
- A room that has ever had a showtime cannot be hard-deleted.
- Movie DELETE is a soft transition to ENDED.
- Genre has no delete endpoint.
- Maintenance report does not return its ID.

For repeatable full regression runs, use a dedicated disposable database or restore a known
database snapshot before each run.

---

## 11. Exit criteria for a movie-service test run

A run is considered complete when:

- All public reads and protected authorization cases are verified.
- Movie create/update/read and both lifecycle branches pass.
- Cluster admin-create and employee approval/rejection branches pass.
- Room generation is verified for STANDARD and IMAX at minimum.
- Same-cluster room-name duplication is blocked and cross-cluster duplication is allowed.
- Showtime date/time/overlap rules are verified.
- Showtime seats initialize and lock as documented.
- All `GAP-*` cases have an observed result and, if reproducible, a linked issue.
- Verification depth is recorded as API runtime testing, not merely compilation.
