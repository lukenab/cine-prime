# Issue pack — Auto Generate Showtime

> Các block bên dưới đã theo đúng cấu trúc của `docs/issues/ISSUE_TEMPLATE.md`. Khi tạo issue trên GitLab, copy nguyên một block và gắn đúng labels ghi trong block.

## Phạm vi deadline (Thứ Ba, 21/07/2026)

- Giữ Auto Showtime bên trong `movie-service`, không tạo service độc lập.
- Hệ thống tự tính, tạo và lưu trực tiếp `ShowTime` vào DB; admin không chọn từng room/khung giờ.
- Demand của mỗi cụm dùng `demand profile` cấu hình/seed cho deadline; ví dụ Q9/HCM là `HIGH`, cụm tỉnh là `LOW`. Engine không hardcode tên rạp/cụm trong Java mà đọc score từ DB/config.
- Chỉ xử lý rule-based demand score và hard constraints. Tích hợp dữ liệu khách hàng/booking/doanh thu thực tế, học tự động từ dữ liệu lịch sử và re-plan động là backlog.
- Không xoá bulk generate thủ công hiện có trong deadline; cần tách rõ đây là luồng manual/legacy.

## Thứ tự thực hiện đề xuất

| Thứ tự | Issue | Estimate | Phụ thuộc |
|---|---|---:|---|
| 1 | AS-01 | L | Không |
| 2 | AS-02 | XL | AS-01, issue format/base price có sẵn |

---

# AS-01

## Title

`[Database] Add room format capability and scheduling demand profiles`

## Labels

`Layer::Database`, `Type::Feature`, `Priority::High`, `In Progress`

## Summary / Objective

Tạo dữ liệu nền để Auto Showtime biết một phòng chiếu có thể chiếu format nào và đọc demand profile của từng cụm rạp. Đây là cơ sở để không xếp phim 3D/IMAX vào phòng không hỗ trợ, đồng thời cụm có demand cao như Q9 được cấp nhiều suất hơn cụm có demand thấp.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- Có migration tạo quan hệ nhiều-nhiều `cinema_room_format` giữa `CinemaRoom` và `MovieFormat`.
- Một phòng chỉ được xem là eligible khi `CinemaRoom.status = ACTIVE`, cụm rạp hoạt động và phòng có format tương thích với movie.
- Có `demand profile` theo cinema cluster, tối thiểu gồm `demand_tier` (`HIGH`/`NORMAL`/`LOW`), `demand_score`, `min_daily_shows` và `max_daily_shows_per_movie`.
- Có config policy riêng cho `peak_demand_weight`, các trọng số tính score và quota; không hardcode tên hoặc ID của Q9/cụm rạp trong allocation engine.
- Có seed cho ít nhất một cụm Q9/HCM demand cao và một cụm tỉnh demand thấp; dữ liệu này là giả lập cho deadline.
- Entity/repository cần thiết được bổ sung và migration chạy được trên database khởi tạo mới.
- Không dùng `RoomType` thay cho format capability; `RoomType` chỉ là phân loại phòng, không đủ để kết luận phim hỗ trợ 2D/3D/IMAX.

## Technical Notes / Constraints

- Tận dụng `movie_format` hiện có từ `Movie.formats`; không tạo format enum/string trùng lặp.
- `ShowTime.format` phải được set từ format đã chọn khi hệ thống persist suất chiếu.
- Thiết kế demand profile có thể mở rộng thêm `unique_customer_count`, `booking_count`, `revenue` trong tương lai, nhưng deadline chưa cần tích hợp nguồn dữ liệu thật.
- Cần kiểm tra schema khởi tạo tại `server/postgres-init/movie_db.sql` và migration convention hiện có trước khi thêm migration.

## Related

- Branch: `feat/showtime-room-format-demand-profile`
- Depends on: Không
- Docs: `docs/AUTO_SHOWTIME_IMPLEMENTATION_PLAN.txt`

---

# AS-02

## Title

`[Backend] Implement automatic demand-based showtime generation`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`, `In Progress`

## Summary / Objective

Xây dựng end-to-end Auto Showtime trong `movie-service`: thuật toán tự phân bổ movie vào room/format/khung giờ theo demand của cụm, sau đó scheduler/job tự lưu `ShowTime` trực tiếp. Admin chỉ trigger/kiểm tra kết quả; không chọn từng room hoặc suất chiếu. Luồng phải an toàn khi retry hoặc nhiều instance cùng chạy.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- Có scheduled job hoặc application use case được cấu hình rõ ràng để generate theo horizon D+3..D+9.
- Có `AutoShowtimeGenerationService` tách rule tính toán khỏi controller/scheduler, tạo candidate theo tổ hợp `movie × eligible room × compatible format × time slot`.
- Chỉ nhận movie hợp lệ để lập lịch: status phù hợp, có duration và có ít nhất một format; room phải active và hỗ trợ format movie.
- Hard constraints chạy trước score: format compatibility, operating hours, duration, cleanup buffer và no overlap với lịch đã có/candidate khác.
- Tính số suất mục tiêu theo movie popularity, demand score cấu hình của cluster và policy config: Q9/HCM demand cao có nhiều suất hơn cụm demand thấp; phim hot nhiều suất hơn nhưng phim thường vẫn có minimum coverage khi đủ tài nguyên.
- Phân bổ format premium trước (IMAX/3D nếu movie hỗ trợ và có phòng phù hợp), sau đó mới xét 2D/standard; ưu tiên peak hours theo config.
- Mỗi candidate hợp lệ được persist thành `ShowTime` với `status = SCHEDULED`, `format`, `totalSeats`, `basePrice` và `createdBy = AUTO_SCHEDULER` (hoặc audit marker tương đương).
- Job dùng timezone `Asia/Ho_Chi_Minh` một cách tường minh khi tính ngày/giờ.
- Chạy cùng input lần hai không tạo duplicate; run retry sau lỗi cũng không tạo duplicate.
- Có cơ chế chống race condition: lock room khi cần và xử lý đúng database overlap/exclusion constraint nếu có conflict đồng thời.
- Khi một candidate conflict, job bỏ qua/recompute candidate đó và tiếp tục các candidate khác; không rollback toàn bộ batch không cần thiết.
- Có log/audit tối thiểu: thời điểm chạy, phạm vi xử lý, số candidate, số tạo thành công, số bỏ qua và lý do.
- Có API xem kết quả của generation run, bao gồm các showtime đã persist và lý do skip; danh sách showtime được phân trang.
- Có integration/concurrency test chứng minh retry hoặc hai run đồng thời không tạo duplicate/overlap.
- Có unit/integration test case 10 room, 1 phim hot + 3 phim thường, Q9/HCM demand cao và cụm tỉnh demand thấp; kiểm tra format, demand, minimum coverage, cleanup buffer và overlap.
- Cập nhật `docs/api-specs/movie-service/API_CONTRACT.md` và kịch bản Postman: trigger run, lấy `generationRunId`, gọi GET result và kiểm tra các slot đã persist.
- Không làm hỏng API manual create/bulk create hiện có.

## How to Test

1. Seed hai cinema cluster: Q9/HCM có `demand_score = 1.00`, cụm tỉnh có `demand_score = 0.35`; chuẩn bị 10 room `ACTIVE` với capability 2D/3D.
2. Chuẩn bị 1 phim hot hỗ trợ 2D/3D và 3 phim thường hỗ trợ 2D trong cùng horizon; thêm một vài showtime hiện có để tạo conflict.
3. Gọi `POST /api/schedules/auto-generation-runs` với các `movieIds` và `cinemaClusterIds`; không truyền room, format hoặc giờ chiếu.
4. Lấy `generationRunId`, gọi `GET /api/schedules/auto-generation-runs/{generationRunId}` đến khi trạng thái `COMPLETED`.
5. Kiểm tra Q9/HCM có nhiều suất hơn cụm tỉnh; phim hot có nhiều suất hơn, phim thường có minimum coverage; format đúng room, không overlap và các suất đã được lưu DB.

## API Specifications (if applicable)

### API 1 — Trigger an auto showtime generation run

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/schedules/auto-generation-runs` |
| Description | Admin kích hoạt một run generate cho phạm vi movie/cinema cluster. Request chỉ được phép giới hạn phạm vi xử lý; không nhận room, format hay start time do admin chọn. Các showtime hợp lệ được scheduler/engine tự persist. |
| Auth Required | Yes — ADMIN |

**Request Body:**
```json
{
  "startDate": "2026-07-20",
  "endDate": "2026-07-26",
  "cinemaClusterIds": [1, 2],
  "movieIds": [25, 26, 27]
}
```

**Response 202 Accepted:**
```json
{
  "generationRunId": 42,
  "status": "ACCEPTED",
  "startDate": "2026-07-20",
  "endDate": "2026-07-26"
}
```

**Response (Error):**
```json
{
  "code": "INVALID_GENERATION_RANGE",
  "message": "The requested date range is outside the configured scheduling horizon."
}
```

### API 2 — Get auto showtime generation result

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/schedules/auto-generation-runs/{generationRunId}` |
| Description | Trả trạng thái run, summary và các showtime mà run đã tạo thành công. Endpoint dùng để admin/QA xem slot thực tế sau khi engine đã tự tính và persist; không cho sửa/chọn slot tại đây. |
| Auth Required | Yes — ADMIN |

**Response 200 OK:**
```json
{
  "generationRunId": 42,
  "status": "COMPLETED",
  "startDate": "2026-07-20",
  "endDate": "2026-07-26",
  "summary": {
    "candidateCount": 48,
    "createdCount": 36,
    "skippedCount": 12
  },
  "movieResults": [
    {
      "movieId": 25,
      "movieTitle": "Hot Movie",
      "demandTier": "HIGH",
      "candidateCount": 20,
      "createdCount": 18,
      "skippedCount": 2
    },
    {
      "movieId": 26,
      "movieTitle": "Regular Movie A",
      "demandTier": "NORMAL",
      "candidateCount": 14,
      "createdCount": 10,
      "skippedCount": 4
    },
    {
      "movieId": 27,
      "movieTitle": "Regular Movie B",
      "demandTier": "LOW",
      "candidateCount": 14,
      "createdCount": 8,
      "skippedCount": 6
    }
  ],
  "showtimes": {
    "items": [
      {
        "showtimeId": 910,
        "movieId": 25,
        "movieTitle": "Hot Movie",
        "cinemaClusterId": 1,
        "cinemaRoomId": 8,
        "cinemaRoomName": "Room 08",
        "formatId": 2,
        "formatName": "3D",
        "showDate": "2026-07-20",
        "startTime": "19:30:00",
        "endTime": "21:45:00",
        "status": "SCHEDULED",
        "generationReason": "HIGH_DEMAND_PEAK_SLOT"
      },
      {
        "showtimeId": 911,
        "movieId": 25,
        "movieTitle": "Hot Movie",
        "cinemaClusterId": 1,
        "cinemaRoomId": 3,
        "cinemaRoomName": "Room 03",
        "formatId": 1,
        "formatName": "2D",
        "showDate": "2026-07-20",
        "startTime": "13:00:00",
        "endTime": "15:15:00",
        "status": "SCHEDULED",
        "generationReason": "HIGH_DEMAND_DAYTIME_SLOT"
      },
      {
        "showtimeId": 912,
        "movieId": 25,
        "movieTitle": "Hot Movie",
        "cinemaClusterId": 1,
        "cinemaRoomId": 5,
        "cinemaRoomName": "Room 05",
        "formatId": 1,
        "formatName": "2D",
        "showDate": "2026-07-20",
        "startTime": "16:15:00",
        "endTime": "18:30:00",
        "status": "SCHEDULED",
        "generationReason": "HIGH_DEMAND_AFTERNOON_SLOT"
      },
      {
        "showtimeId": 913,
        "movieId": 26,
        "movieTitle": "Regular Movie A",
        "cinemaClusterId": 1,
        "cinemaRoomId": 2,
        "cinemaRoomName": "Room 02",
        "formatId": 1,
        "formatName": "2D",
        "showDate": "2026-07-20",
        "startTime": "18:00:00",
        "endTime": "19:50:00",
        "status": "SCHEDULED",
        "generationReason": "MINIMUM_DAILY_COVERAGE"
      },
      {
        "showtimeId": 914,
        "movieId": 27,
        "movieTitle": "Regular Movie B",
        "cinemaClusterId": 2,
        "cinemaRoomId": 12,
        "cinemaRoomName": "Room 12",
        "formatId": 1,
        "formatName": "2D",
        "showDate": "2026-07-20",
        "startTime": "10:00:00",
        "endTime": "11:50:00",
        "status": "SCHEDULED",
        "generationReason": "LOW_DEMAND_OFF_PEAK_SLOT"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 36,
    "totalPages": 2
  },
  "skipped": [
    {
      "movieId": 27,
      "cinemaClusterId": 2,
      "reason": "NO_AVAILABLE_TIME_SLOT"
    }
  ]
}
```

**Response (Error):**
```json
{
  "code": "GENERATION_RUN_NOT_FOUND",
  "message": "Auto showtime generation run 42 was not found."
}
```

## Technical Notes / Constraints

- `MovieServiceApplication` đã bật scheduling; bổ sung job vào cùng `movie-service`.
- Input của thuật toán: horizon ngày, cinema cluster, room (status/capacity/format), movie (duration/format/popularity), operating hours, showtime đã có và demand profile. Output nội bộ là `ShowtimeCandidate`, sau đó persist thành `ShowTime`.
- Lọc hard constraints → chấm điểm/ranking → phân bổ quota → persist; không lưu toàn bộ tổ hợp candidate.
- Score khởi điểm có thể cấu hình: movie popularity 45%, cluster demand score 25%, time slot 20%, room capacity 10%. Deadline dùng `demand_score` seed/config; sau này có thể thay bằng metrics thực tế.
- Horizon đề xuất: D+3 đến D+9; giờ mở cửa 08:00–23:00; cleanup buffer 15 phút. Các số phải nằm trong config, không hard-code rải rác.
- Có thể tái sử dụng query kiểm tra conflict và room lock hiện có trong `ShowTimeRepository`/`ShowTimeService`, nhưng không tái sử dụng logic manual bulk generate làm engine auto; `BulkShowTimeRequest` vẫn là manual/legacy.
- Tái sử dụng contract từ issue đang mở `[Backend] Persist and enforce showtime format and base price`; Auto Showtime không tạo một cách persist/validate `formatId` hay `basePrice` riêng.
- Không dựa duy nhất vào kiểm tra overlap ở application layer; database là lớp bảo vệ cuối cùng.
- Không auto sửa/xoá showtime đã có booking trong scope deadline. Chỉ tạo các suất còn thiếu trong horizon.
- Cân nhắc `showtime_generation_run` hoặc audit table nếu log ứng dụng không đủ cho demo/truy vết.
- Không trả toàn bộ showtime trong response `POST 202`; dùng `GET` theo `generationRunId` để tránh timeout/payload quá lớn và phân biệt rõ run đang chạy với run đã hoàn tất.

## Related

- Branch: `feat/auto-showtime-generation`
- Depends on: AS-01, `[Backend] Persist and enforce showtime format and base price` (điền số issue khi tạo GitLab)
- Docs: `docs/AUTO_SHOWTIME_IMPLEMENTATION_PLAN.txt`

---

## Backlog sau deadline (không đưa vào scope hiện tại)

1. Thay demand profile seed bằng dữ liệu demand thực tế từ booking/search/occupancy/revenue theo movie–cluster–time slot.
2. Re-plan an toàn cho các showtime chưa bán vé khi demand thay đổi.
3. Bổ sung dashboard/audit chi tiết cho từng generation run.
4. Điều chỉnh dynamic pricing độc lập với bài toán phân bổ showtime.
