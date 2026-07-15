# Bulk Showtime Generation — Test Guide

Không chạy test trên database dùng chung và không cần drop `movie_db`. Dùng test profile hoặc PostgreSQL/container dành riêng cho test.

## Dữ liệu ngày

Luôn tính ngày động tại thời điểm test:

- `fromDate = today + 3 days`
- `toDate = today + 10 days`

Không dùng ngày cố định đã nằm trong quá khứ.

## 1. Preview

```http
POST /api/schedules/generate-preview
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

```json
{
  "movieId": 1,
  "cinemaRoomIds": [1, 2],
  "fromDate": "<today+3>",
  "toDate": "<today+10>",
  "startTimes": ["09:00", "14:00", "19:00"],
  "basePrice": 120000,
  "languageCode": "vi",
  "subtitleCode": "en"
}
```

Expected:

- HTTP `200 OK` vì preview là dry-run và không tạo resource.
- Response có `validCount`, `conflictCount`, `valid`, `conflicts`.
- Không có bản ghi mới trong `show_time`.
- Mọi `showDate` trong response nằm giữa `fromDate` và `toDate`.

## 2. Bulk create

```http
POST /api/schedules/bulk
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

Dùng cùng request body của preview.

Expected:

- HTTP `201 Created`.
- Chỉ candidate hợp lệ được lưu.
- Response có `createdCount`, `skippedCount`, `created`, `skipped`.
- Showtime `CANCELLED` không chặn slot mới.

## 3. Validation

Xác nhận request bị từ chối khi:

- `fromDate < today + 3`: code `2008`.
- `fromDate > toDate`: code `2008`.
- Khoảng ngày lớn hơn 31 ngày.
- Tổng combination `rooms × inclusive dates × start times` lớn hơn 5.000.
- Có hơn 20 room hoặc hơn 20 start time.
- List chứa phần tử `null`, room ID không dương hoặc `basePrice` không khớp `DECIMAL(10,2)`.
- Phim bắt đầu gần giờ đóng cửa và kết thúc sau `23:00` hoặc sang ngày hôm sau.

## 4. Concurrency

Gửi đồng thời hai request bulk có cùng room/date/start time.

Expected:

- Room được khóa theo thứ tự ID ổn định.
- Request đến sau recheck conflict sau khi nhận lock.
- Không tạo hai showtime trùng nhau.
- Database exclusion constraint vẫn là lớp bảo vệ cuối cùng.
