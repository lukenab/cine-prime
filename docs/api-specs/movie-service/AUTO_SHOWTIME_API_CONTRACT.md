# Auto Showtime Generation API Contract

> **Service owner:** Movie Service
> **Feature:** Demand-based automatic showtime generation
> **Status:** Implemented
> **Last updated:** 20/07/2026
> **OpenAPI:** [`auto-showtime.yaml`](./auto-showtime.yaml)

---

## 1. Mục đích và phạm vi

Auto Showtime tạo các suất chiếu tự động cho một phạm vi gồm **ngày**, **movie** và
**cinema cluster**. Hệ thống sử dụng allocation policy trong database để xếp hạng và
chọn candidate; không hard-code cluster, room hay trọng số trong Java.

Feature này thuộc Movie Service và sở hữu các dữ liệu sau:

```text
showtime_generation_run
showtime_generation_run_movie
showtime_generation_run_cluster
showtime_generation_skip
show_time (các cột source, generation_run_id, generation_reason)
```

Feature này không lấy demand thực tế từ booking/revenue ở deadline hiện tại. Điểm
movie, demand profile cluster và allocation policy là dữ liệu cấu hình/seed có thể
thay đổi trong database.

---

## 2. Base URL, authentication và response chuẩn

| Môi trường | Base URL |
|---|---|
| Qua API Gateway | `http://localhost:8080` |
| Movie Service trực tiếp | `http://localhost:8081` |

Tất cả endpoint trong tài liệu này yêu cầu JWT có role `ADMIN`:

```http
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

Response dùng envelope chung:

```json
{
  "code": 200,
  "message": "optional message",
  "result": {}
}
```

---

## 3. API summary

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/schedules/auto-generation-runs` | Validate scope và tạo/lấy lại generation run idempotent |
| `POST` | `/api/schedules/auto-generation-runs/{generationRunId}/execute` | Chạy một run `ACCEPTED` ngay lập tức; chủ yếu cho vận hành/QA |
| `GET` | `/api/schedules/auto-generation-runs/{generationRunId}?page=0&size=20` | Poll trạng thái, summary, kết quả theo movie và các showtime đã persist |

---

## 4. Submit generation run

### `POST /api/schedules/auto-generation-runs`

Request body:

```json
{
  "startDate": "2026-07-25",
  "endDate": "2026-07-25",
  "cinemaClusterIds": [7],
  "movieIds": [2, 4]
}
```

| Field | Type | Required | Rule |
|---|---|---:|---|
| `startDate` | `date` | Yes | Không sau `endDate`; phải nằm trong planning horizon của policy |
| `endDate` | `date` | Yes | Phải nằm trong planning horizon của policy |
| `cinemaClusterIds` | `array<long>` | Yes | Không rỗng; mọi ID phải tồn tại |
| `movieIds` | `array<long>` | Yes | Không rỗng; mọi ID phải tồn tại và có status `APPROVED` |

Kết quả thành công:

```json
{
  "code": 202,
  "message": "Auto showtime generation run accepted",
  "result": {
    "generationRunId": 15,
    "status": "ACCEPTED",
    "startDate": "2026-07-25",
    "endDate": "2026-07-25"
  }
}
```

`202 Accepted` chỉ xác nhận run đã được ghi nhận. ShowTime chưa chắc đã được persist
ở response này; scheduler hoặc endpoint `execute` mới thực hiện allocation.

### 4.1 Idempotency

Key được tạo từ:

```text
policyCode + startDate + endDate + sorted(movieIds) + sorted(cinemaClusterIds)
```

Vì vậy, gửi lại cùng phạm vi — kể cả đảo thứ tự ID — không tạo thêm run hay showtime.
API trả lại `generationRunId` đã tồn tại. Muốn kiểm tra validation cho dữ liệu mới,
phải dùng phạm vi chưa từng submit.

---

## 5. Preflight validation

Trước khi persist run mới, service tạo candidate trong bộ nhớ bằng chính
`AutoShowtimeCandidateFactory`. **Mọi movie được chọn** phải có tối thiểu một
candidate hợp lệ trong ít nhất một cluster/ngày của request.

Một candidate chỉ hợp lệ khi đồng thời thỏa:

1. Movie có status `APPROVED`.
2. Có `MovieAvailability` `OPEN` hoặc `PLANNED` bao phủ ngày chiếu.
3. Cluster có giờ hoạt động hợp lệ cho ngày đó và không đóng cửa.
4. Cinema room thuộc cluster và có status `ACTIVE`.
5. Room có `cinema_room_format.enabled = true` tương thích với format trong
   `Movie.formats`.
6. Slot kết thúc trong giờ hoạt động, bao gồm cleanup buffer; deadline hiện tại
   không hỗ trợ suất qua ngày hôm sau.

Nếu request chọn nhiều movie mà chỉ một số movie có candidate, toàn bộ request bị
từ chối. Điều này tránh trường hợp admin nghĩ batch chạy cho bốn movie nhưng thực tế
chỉ sinh suất cho một movie.

Ví dụ lỗi `2100`:

```json
{
  "code": 2100,
  "message": "Every selected movie must have at least one eligible showtime candidate.",
  "result": {
    "ineligibleMovies": [
      {
        "movieId": 1,
        "originalTitle": "AUTO_SHOWTIME_TEST_2D"
      }
    ]
  }
}
```

`ineligibleMovies` giúp admin biết chính xác movie nào phải được bổ sung
availability, operating hour, active room hoặc room-format capability trước khi
submit lại.

---

## 6. Execute generation run

### `POST /api/schedules/auto-generation-runs/{generationRunId}/execute`

Endpoint này chạy run ngay cho QA/vận hành. Scheduler có thể gọi cùng service method
cho các run `ACCEPTED` mà không lặp business logic.

```json
{
  "code": 200,
  "message": "Auto showtime generation run executed",
  "result": {
    "generationRunId": 15,
    "status": "COMPLETED",
    "candidateCount": 534,
    "createdCount": 18,
    "skippedCount": 516
  }
}
```

Nếu run không còn `ACCEPTED` (đã `RUNNING`, `COMPLETED` hoặc `FAILED`), executor
trả summary hiện có thay vì tạo showtime lần hai. Pessimistic lock đảm bảo chỉ một
worker có thể claim một run tại cùng thời điểm.

### 6.1 Allocation flow

```text
ACCEPTED
  -> RUNNING
  -> build raw candidates
  -> score candidates from policy + demand configuration
  -> select by quota, room share and conflict rules
  -> persist selected showtimes
  -> aggregate skipped candidates
  -> COMPLETED
```

Candidate bị skip bởi quota hoặc conflict là kết quả allocation bình thường, không
làm run thành lỗi. Khi executor đã xử lý hết candidate, status cuối là `COMPLETED`.
`FAILED` chỉ dành cho lỗi thực thi không thể hoàn tất.

---

## 7. Get generation result

### `GET /api/schedules/auto-generation-runs/{generationRunId}`

Query parameters:

| Parameter | Default | Rule | Mô tả |
|---|---:|---|---|
| `page` | `0` | Giá trị âm tự chuyển thành `0` | Trang showtime cần đọc |
| `size` | `20` | Clamp trong khoảng `1..100` | Số showtime mỗi trang |

Ví dụ response:

```json
{
  "code": 200,
  "result": {
    "generationRunId": 15,
    "status": "COMPLETED",
    "startDate": "2026-07-25",
    "endDate": "2026-07-25",
    "summary": {
      "candidateCount": 534,
      "createdCount": 18,
      "skippedCount": 516
    },
    "movieResults": [
      {
        "movieId": 2,
        "movieTitle": "AUTO_Q9_REGULAR_C_2D",
        "demandTier": "NORMAL",
        "candidateCount": 160,
        "createdCount": 7,
        "skippedCount": 153
      }
    ],
    "showtimes": {
      "items": [
        {
          "showtimeId": 101,
          "movieId": 2,
          "movieTitle": "AUTO_Q9_REGULAR_C_2D",
          "cinemaClusterId": 7,
          "cinemaRoomId": 3,
          "cinemaRoomName": "Room 03",
          "formatId": 1,
          "formatName": "2D",
          "showDate": "2026-07-25",
          "startTime": "08:00:00",
          "endTime": "10:05:00",
          "status": "SCHEDULED",
          "generationReason": "DEMAND_QUOTA_ALLOCATION"
        }
      ],
      "page": 0,
      "size": 100,
      "totalElements": 18,
      "totalPages": 1
    },
    "startedAt": "2026-07-20T17:10:00",
    "completedAt": "2026-07-20T17:10:03",
    "failureDetail": null
  }
}
```

- `showtimes.items` chỉ chứa ShowTime đã persist trong bảng `show_time` của đúng run.
- `movieResults[].candidateCount = createdCount + skippedCount` theo từng movie.
- `summary.candidateCount = summary.createdCount + summary.skippedCount` khi run đã
  hoàn tất bình thường.

---

## 8. Skip audit aggregation

Không có bảng candidate chi tiết. Candidate không được chọn/persist được audit tại
`showtime_generation_skip`.

Để tránh 3.000 candidate cùng lý do thành 3.000 row, service gộp theo:

```text
generation_run_id + movie_id + cluster_id + reason
```

Ví dụ:

| generation_run_id | movie_id | cluster_id | reason | occurrence_count |
|---:|---:|---:|---|---:|
| 15 | 4 | 7 | `CLEANUP_BUFFER_CONFLICT` | 205 |

`occurrence_count` là số candidate thật đã bị bỏ qua. Service dùng tổng field này
khi tính `skippedCount`, nên việc gộp row không làm mất số liệu allocation.

Các skip reason có thể gặp gồm `CLEANUP_BUFFER_CONFLICT`,
`EXISTING_SHOWTIME_CONFLICT`, `DATABASE_OVERLAP_CONFLICT`,
`MAXIMUM_ROOM_SHARE_REACHED`, `MAX_DAILY_SHOWS_PER_MOVIE_REACHED` và
`NO_AVAILABLE_TIME_SLOT`.

---

## 9. Error contract

| HTTP | Code | Khi nào xảy ra |
|---:|---:|---|
| 400 | `2095` | Date range nằm ngoài planning horizon hoặc `startDate > endDate` |
| 400 | `2100` | Có ít nhất một movie trong request không có candidate hợp lệ; xem `result.ineligibleMovies` |
| 404 | `2002` | Movie ID không tồn tại |
| 404 | cluster error code hiện hành | Cinema cluster ID không tồn tại |
| 404 | `2094` | Không có allocation policy `DEFAULT` đang active |
| 404 | `2096` | `generationRunId` không tồn tại |
| 409 | `2097` | Có movie chưa `APPROVED` |
| 401/403 | security error code hiện hành | Thiếu JWT hoặc JWT không có role `ADMIN` |

---

## 10. Database trace cho QA

Sau khi execute, thay `:runId` bằng ID thực tế:

```sql
SELECT generation_run_id, status, candidate_count, created_count, skipped_count,
       started_at, completed_at, failure_detail
FROM showtime_generation_run
WHERE generation_run_id = :runId;

SELECT showtime_id, movie_id, cinema_room_id, format_id, show_date, start_time,
       end_time, source, generation_reason
FROM show_time
WHERE generation_run_id = :runId
ORDER BY show_date, start_time;

SELECT movie_id, cluster_id, reason, occurrence_count
FROM showtime_generation_skip
WHERE generation_run_id = :runId
ORDER BY movie_id, reason;
```
