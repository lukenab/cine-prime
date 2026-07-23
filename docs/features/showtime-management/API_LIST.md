# Showtime Management — API List

## 1. Quy ước chung

| Thuộc tính | Giá trị |
|---|---|
| Base URL local | `http://localhost:8080` qua API Gateway |
| Content type | `application/json` |
| Auth | `Authorization: Bearer {{adminAccessToken}}` cho write/admin APIs |
| Response envelope | `{ "code": ..., "message": ..., "result": ... }` |
| Date | `YYYY-MM-DD` |
| Local time legacy | `HH:mm` hoặc `HH:mm:ss` |
| Canonical timestamp | ISO-8601 offset datetime, ví dụ `2026-07-25T23:30:00+07:00` |

## 2. Controllers đã đối chiếu

- `ScheduleController.java`
- `AutoShowtimeGenerationController.java`
- `SchedulePlanController.java`
- `ShowTimeController.java`

## 3. API inventory

### 3.1. Manual Showtime CRUD

| Method | Endpoint | Auth | Request | Response | Mục đích |
|---|---|---|---|---|---|
| GET | `/api/schedules` | Public hiện tại | — | `List<ShowTimeResponse>` | Danh sách Showtime |
| GET | `/api/schedules/{id}` | Public hiện tại | — | `ShowTimeResponse` | Chi tiết Showtime |
| GET | `/api/schedules/movie/{movieId}?date=YYYY-MM-DD` | Public hiện tại | — | `List<ShowTimeResponse>` | Lọc suất theo phim/ngày |
| POST | `/api/schedules` | ADMIN | `CreateShowTimeRequest` | `ShowTimePricingResponse` | Tạo một suất thủ công |
| POST | `/api/schedules/generate-preview` | ADMIN | `BulkShowTimeRequest` | `BulkShowTimePreviewResponse` | Dry-run bulk schedule |
| POST | `/api/schedules/bulk` | ADMIN | `BulkShowTimeRequest` | `BulkShowTimeCreateResponse` | Tạo các candidate hợp lệ |
| PUT | `/api/schedules/{id}` | ADMIN | `UpdateShowTimeRequest` | `ShowTimePricingResponse` | Cập nhật một suất |
| DELETE | `/api/schedules/{id}` | ADMIN | — | `Void` | Xóa suất nếu được phép |

### 3.2. Automatic Generation Run

| Method | Endpoint | Auth | Request | Response | Mục đích |
|---|---|---|---|---|---|
| POST | `/api/schedules/auto-generation-runs` | ADMIN | `AutoShowtimeGenerationRequest` | `AutoShowtimeGenerationAcceptedResponse` | Nhận scope và tạo run idempotent |
| POST | `/api/schedules/auto-generation-runs/{runId}/execute` | SUPER_ADMIN hoặc ADMIN trong dev/demo | — | `AutoShowtimeExecutionResult` | Escape hatch `Process now`; flow bình thường tự dispatch sau commit |
| GET | `/api/schedules/auto-generation-runs/{runId}?page=0&size=20` | ADMIN | — | `AutoShowtimeGenerationRunResponse` | Poll status, counts, plan và kết quả |

### 3.3. Schedule Plan Workflow

| Method | Endpoint | Auth | Request | Response | Transition |
|---|---|---|---|---|---|
| GET | `/api/schedule-plans/{planId}` | ADMIN | — | `SchedulePlanResponse` | Không đổi trạng thái |
| POST | `/api/schedule-plans/{planId}/submit-review` | ADMIN | `SchedulePlanReviewRequest` optional | `SchedulePlanResponse` | `DRAFT_GENERATED/CHANGES_REQUESTED → IN_REVIEW` |
| POST | `/api/schedule-plans/{planId}/request-changes` | ADMIN | `SchedulePlanReviewRequest` optional | `SchedulePlanResponse` | `IN_REVIEW → CHANGES_REQUESTED` |
| POST | `/api/schedule-plans/{planId}/publish` | ADMIN | — | `SchedulePlanResponse` | `IN_REVIEW → PUBLISHED` |

### 3.4. Showtime Seat Availability

| Method | Endpoint | Auth hiện tại | Request | Response | Mục đích |
|---|---|---|---|---|---|
| GET | `/api/showtimes/{id}/seats` | Public hiện tại | — | `List<ShowtimeSeatDto>` | Xem seat availability |
| PUT | `/api/showtimes/{id}/seats/lock` | Chưa khai báo tại controller | `List<Long>` | `Void` | Lock selection |

> Security gap: mutation lock seat cần authenticated booking context, ownership, TTL và idempotency; không nên được hiểu là public API an toàn chỉ vì controller chưa có `@PreAuthorize`.

## 4. Request/response mẫu

### 4.1. Tạo Showtime thủ công

```http
POST /api/schedules
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
```

```json
{
  "movieId": 12,
  "cinemaRoomId": 95,
  "showDate": "2026-07-25",
  "startTime": "19:30",
  "languageCode": "vi",
  "subtitleCode": "en",
  "basePrice": 95000
}
```

Kỳ vọng: HTTP `201`, trạng thái `SCHEDULED`; backend tự tính giờ kết thúc.

### 4.2. Preview bulk thủ công

```http
POST /api/schedules/generate-preview
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
```

```json
{
  "movieId": 12,
  "cinemaRoomIds": [95, 96],
  "fromDate": "2026-07-25",
  "toDate": "2026-07-27",
  "startTimes": ["09:00", "13:30", "19:30"],
  "basePrice": 95000,
  "languageCode": "vi",
  "subtitleCode": "en"
}
```

Kỳ vọng: response tách `valid` và `conflicts`; API không ghi dữ liệu.

### 4.3. Submit auto-generation run

```http
POST /api/schedules/auto-generation-runs
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
```

```json
{
  "startDate": "2026-07-25",
  "endDate": "2026-07-27",
  "cinemaClusterIds": [1, 2],
  "movieIds": [12, 18, 21]
}
```

Response mẫu:

```json
{
  "code": 202,
  "message": "Auto showtime generation run accepted",
  "result": {
    "generationRunId": 41,
    "status": "ACCEPTED",
    "startDate": "2026-07-25",
    "endDate": "2026-07-27"
  }
}
```

Nếu một phim được chọn không có candidate eligible, backend trả lỗi preflight kèm dữ liệu tương tự:

```json
{
  "code": 2100,
  "message": "Every selected movie must have at least one eligible showtime candidate.",
  "result": {
    "ineligibleMovies": [
      { "movieId": 21, "originalTitle": "Example Movie" }
    ]
  }
}
```

### 4.4. Process now — recovery escape hatch

Không gọi endpoint này trong flow thông thường. Run mới đã được dispatch tự động sau commit.
Production yêu cầu `ROLE_SUPER_ADMIN`. Với development/demo, bật Spring profile `dev|demo|local`
hoặc `AUTO_SHOWTIME_MANUAL_EXECUTION_ENABLED=true`.

```http
POST /api/schedules/auto-generation-runs/41/execute
Authorization: Bearer {{superAdminAccessToken}}
```

Response mẫu:

```json
{
  "code": 200,
  "message": "Auto showtime generation run processed",
  "result": {
    "generationRunId": 41,
    "status": "COMPLETED",
    "candidateCount": 840,
    "createdCount": 36,
    "skippedCount": 804
  }
}
```

### 4.5. Poll run

```http
GET /api/schedules/auto-generation-runs/41?page=0&size=20
Authorization: Bearer {{adminAccessToken}}
```

Các field cần kiểm tra:

```json
{
  "generationRunId": 41,
  "status": "COMPLETED",
  "schedulePlanId": 17,
  "schedulePlanStatus": "DRAFT_GENERATED",
  "summary": {
    "candidateCount": 840,
    "createdCount": 36,
    "skippedCount": 804,
    "successfulPartitionCount": 6,
    "failedPartitionCount": 0
  },
  "movieResults": [],
  "showtimes": {
    "items": [],
    "page": 0,
    "size": 20,
    "totalElements": 0,
    "totalPages": 0
  }
}
```

`showtimes.items` có thể rỗng trước publish vì generation mới tạo draft slots.

### 4.6. Lấy Schedule Plan

```http
GET /api/schedule-plans/17
Authorization: Bearer {{adminAccessToken}}
```

```json
{
  "code": 200,
  "result": {
    "schedulePlanId": 17,
    "generationRunId": 41,
    "status": "DRAFT_GENERATED",
    "blockerCount": 0,
    "validationSummary": "",
    "slots": [
      {
        "schedulePlanSlotId": 501,
        "movieId": 12,
        "movieTitle": "Interstellar",
        "clusterId": 1,
        "clusterName": "CinePrime Hoàn Kiếm",
        "cinemaRoomId": 95,
        "cinemaRoomName": "Room 1",
        "screeningVersionId": 32,
        "formatCode": "2D",
        "audioLanguageCode": "en",
        "subtitleLanguageCode": "vi",
        "businessDate": "2026-07-25",
        "startAt": "2026-07-25T23:30:00+07:00",
        "endAt": "2026-07-26T02:34:00+07:00",
        "basePrice": 95000,
        "totalSeats": 114,
        "generationReason": "MINIMUM_DAILY_COVERAGE",
        "scoreBreakdown": {
          "allocationScore": 0.7812,
          "daypart": "LATE_NIGHT",
          "movieDemandScore": 0.8,
          "clusterDemandScore": 0.7,
          "timeDemandScore": 0.6,
          "formatDemandScore": 1.0,
          "capacityFitScore": 0.9123,
          "expectedAttendance": 91,
          "roomCapacity": 114
        },
        "publishedShowtimeId": null
      }
    ]
  }
}
```

`scoreBreakdown` giải thích quyết định phân phòng tại thời điểm generation. Các giá trị này
được lưu cùng draft slot để màn hình review không phải tính lại từ policy hiện tại.

### 4.7. Submit for review

```http
POST /api/schedule-plans/17/submit-review
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
```

```json
{
  "note": "Đã kiểm tra coverage, phiên bản chiếu và khung giờ vận hành."
}
```

Kỳ vọng: `status = IN_REVIEW`.

### 4.8. Request changes

```http
POST /api/schedule-plans/17/request-changes
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
```

```json
{
  "note": "Giảm một suất tối ở Room 1 và cân bằng coverage cho phim B."
}
```

Kỳ vọng: `status = CHANGES_REQUESTED`.

### 4.9. Publish

```http
POST /api/schedule-plans/17/publish
Authorization: Bearer {{adminAccessToken}}
```

Kỳ vọng:

- Chỉ publish khi plan `IN_REVIEW`.
- `blockerCount = 0`.
- Eligibility vẫn còn hợp lệ.
- `status = PUBLISHED`.
- Mỗi slot có `publishedShowtimeId`.
- Poll run hoặc `GET /api/schedules` thấy Showtime đã materialize.

## 5. Thứ tự test Postman đề xuất

1. Login Admin và lưu `adminAccessToken`.
2. Kiểm tra movie ở trạng thái `APPROVED`.
3. Kiểm tra cluster, room và active layout.
4. Kiểm tra availability, classification approval, license và screening version.
5. Submit auto-generation run.
6. Lưu `generationRunId` từ response.
7. Execute ngay hoặc poll đến terminal status.
8. Lưu `schedulePlanId`.
9. GET plan và kiểm tra blocker/slot/cross-midnight.
10. Submit review.
11. Có thể request changes để test state transition, sau đó submit lại.
12. Publish.
13. GET plan để xác nhận `publishedShowtimeId`.
14. GET schedules để xác nhận Showtime thật.
15. Submit lại đúng scope để xác nhận idempotency.

## 6. HTTP/error expectations

| Tình huống | HTTP/behavior kỳ vọng |
|---|---|
| Request validation lỗi | `400 Bad Request` |
| Không có quyền ADMIN | `403 Forbidden` |
| Run submit hợp lệ | `202 Accepted` |
| Execute/Get/Plan transition hợp lệ | `200 OK` |
| Tạo manual Showtime | `201 Created` |
| Resource không tồn tại | Domain error tương ứng |
| Invalid plan transition | Stable domain error, không đổi trạng thái |
| Eligibility thay đổi | Chặn submit/publish |
| Plan có blocker | Chặn publish |

## 7. API gaps cần lưu ý

- Manual create/update contract chưa nhận trực tiếp `screeningVersionId` và canonical `startAt/endAt`.
- Chưa có endpoint list/filter Schedule Plan theo cluster/date/status; UI phụ thuộc run hiện tại.
- Chưa có endpoint edit từng Schedule Plan Slot; thay đổi cấu trúc lịch cần generate plan mới.
- Chưa expose API quản trị policy/snapshot trong flow này.
- Seat lock endpoint cần bổ sung authorization contract rõ ràng.
- Public schedule endpoints cần lọc theo sale/publication eligibility thay vì trả toàn bộ dữ liệu nội bộ.
