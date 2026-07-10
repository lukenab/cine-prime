# MR Description — [Database] Add geocoding fields to cinema_cluster table

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feat/cinema-cluster-geocoding-fields` → target: `develop`

---

## Overview / Objective

Thêm 2 cột `latitude` và `longitude` vào bảng `cinema_cluster` để hỗ trợ hiển thị bản đồ
và tính khoảng cách "rạp gần nhất" sau này. Đồng thời cập nhật entity/DTO backend để
`GET /api/cinema-clusters` trả về tọa độ trong response và `POST/PUT` cho phép truyền tọa độ.

Related Issue: Closes #[cinema-cluster-geocoding-issue]

---

## Changes Introduced

**Database:**
- `V4__add_geocoding_to_cinema_cluster.sql` — thêm `latitude DECIMAL(10,7)`, `longitude DECIMAL(10,7)` (nullable); seed tọa độ cho 6 cluster hiện có

**Backend:**
- `CinemaCluster.java` — thêm `BigDecimal latitude`, `BigDecimal longitude`
- `CinemaClusterRequest.java` — thêm `latitude`/`longitude` với validation range: lat [-90, 90], lng [-180, 180]
- `CinemaClusterResponse.java` — thêm `BigDecimal latitude`, `BigDecimal longitude`

**Docs:**
- `dbdiagram_cineprime.dbml` — cập nhật bảng `cinema_cluster` thêm 2 cột mới

> Mapper không cần sửa — tên field khớp, MapStruct tự map (`ReportingPolicy.IGNORE`).

---

## Key Decisions

- **Nullable** — cluster cũ không bắt buộc có tọa độ ngay. Admin có thể cập nhật sau qua `PUT`.
- **`DECIMAL(10,7)`** — độ chính xác ~1cm, chuẩn cho ứng dụng bản đồ.
- **`BigDecimal` thay vì `Double`** — tránh floating-point precision loss khi serialize JSON.
- **`@DecimalMin`/`@DecimalMax` thay vì custom validator** — đủ đơn giản, không cần thêm class. Annotation bỏ qua null nên field vẫn optional.

---

## Seed Coordinates

| Cluster | Latitude | Longitude |
|---|---|---|
| CinePrime Quận 1 | 10.7769660 | 106.7009650 |
| CinePrime Thủ Đức | 10.8500000 | 106.7716670 |
| CinePrime Hoàn Kiếm | 21.0285110 | 105.8341600 |
| CinePrime Cầu Giấy | 21.0363890 | 105.7822220 |
| CinePrime Hải Châu | 16.0680000 | 108.2120000 |
| CinePrime Ninh Kiều | 10.0333330 | 105.7833330 |

---

## How to Test

**Setup:**
```powershell
docker cp docs\database\movie-service\V4__add_geocoding_to_cinema_cluster.sql postgres:/tmp/V4__add_geocoding_to_cinema_cluster.sql
docker exec -it postgres psql -U postgres -d movie_db -f /tmp/V4__add_geocoding_to_cinema_cluster.sql
docker-compose up -d --build movie-service
```

**GET — kiểm tra tọa độ seed:**
```
GET /api/cinema-clusters/1
→ 200: "latitude": 10.7769660, "longitude": 106.7009650
```

**POST — tạo cluster có tọa độ:**
```json
POST /api/cinema-clusters
{
  "clusterName": "CinePrime Bình Thạnh",
  "province": "TP. Hồ Chí Minh",
  "address": "246 Điện Biên Phủ, Bình Thạnh",
  "phoneNumber": "0289123456",
  "latitude": 10.8030,
  "longitude": 106.7120,
  "status": "ACTIVE"
}
→ 201: response có latitude + longitude
```

**POST — latitude vượt range:**
```json
{ "clusterName": "Test", "province": "Hà Nội", "address": "123 Đường ABC, Hoàn Kiếm", "latitude": 200.0, "longitude": 0.0 }
→ 400: "Latitude must be between -90 and 90"
```

**POST — không có tọa độ (optional):**
```json
{ "clusterName": "CinePrime Thanh Hóa", "province": "Thanh Hóa", "address": "12 Lê Lợi, TP. Thanh Hóa" }
→ 201: "latitude": null, "longitude": null
```

**PUT — cập nhật tọa độ cluster cũ:**
```json
PUT /api/cinema-clusters/6
{ "clusterName": "CinePrime Ninh Kiều", "province": "Cần Thơ", "address": "15 Hai Bà Trưng, Ninh Kiều", "latitude": 10.033333, "longitude": 105.783333 }
→ 200: tọa độ cập nhật
```

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] Follows project conventions
- [x] Migration idempotent (`ADD COLUMN IF NOT EXISTS`)

**Database**
- [x] `DECIMAL(10,7)` đủ độ chính xác ~1cm
- [x] Nullable — không break cluster hiện có
- [x] Seed tọa độ cho 6 cluster (lấy từ Google Maps)
- [x] dbdiagram cập nhật

**Backend**
- [x] `latitude`/`longitude` optional trong request (null-safe validation)
- [x] Range validation: lat [-90, 90], lng [-180, 180]
- [x] Response trả về tọa độ đầy đủ
- [x] Mapper tự xử lý — không cần thay đổi `MovieMapper`

---

## Reviewer Notes

- Tọa độ seed lấy từ Google Maps cho các địa chỉ mẫu — đủ chính xác cho dev/staging.
- Issue tiếp theo (Issue 3) sẽ tích hợp Google Maps Places Autocomplete trên frontend để tự điền tọa độ khi admin chọn địa chỉ.
- `BigDecimal` serialize thành JSON number string đúng — không mất precision như `double`.
