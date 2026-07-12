# MR Description — [Backend] Add input validation for Cinema Cluster API

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feat/cinema-cluster-input-validation` → target: `develop`

---

## Overview / Objective

Thêm input validation đầy đủ cho Cinema Cluster API trong `movie-service`:
- Custom `@ValidProvince` annotation để whitelist 20 tỉnh/thành hợp lệ (khớp với frontend dropdown)
- Bean Validation constraints trên `CinemaClusterRequest` cho tất cả các field
- Error code mới `INVALID_CLUSTER_STATUS(2025)` khi query param `?status=` nhận giá trị sai

Related Issue: Closes #[cinema-cluster-validation-issue]

---

## Changes Introduced

**New Files:**
- `movieservice/validator/ValidProvince.java` — custom constraint annotation
- `movieservice/validator/ProvinceValidator.java` — whitelist 20 tỉnh/thành, implements `ConstraintValidator<ValidProvince, String>`

**Modified Files:**
- `movieservice/dto/request/CinemaClusterRequest.java` — thêm constraints:
  - `clusterName`: `@NotBlank` + `@Size(min=2, max=100)`
  - `province`: `@NotBlank` + `@ValidProvince`
  - `address`: `@NotBlank` + `@Size(min=10, max=255)`
  - `phoneNumber`: `@Pattern` regex 10 chữ số, prefix `03x/05x/07x/08x/09x`
- `movieservice/controller/CinemaClusterController.java` — trim whitespace trên clusterName/province/address trước khi save; bắt `IllegalArgumentException` khi `?status=` sai → throw `INVALID_CLUSTER_STATUS`
- `movieservice/exception/MovieErrorCode.java` — thêm `INVALID_CLUSTER_STATUS(2025)`

---

## Key Decisions

- **Province whitelist** — dùng `Set.of(...)` với 20 tỉnh/thành khớp chính xác với mảng `PROVINCES` trong `ManageCinemaClusterPage.tsx`. Nếu frontend thêm tỉnh mới thì cần cập nhật cả 2 nơi.

- **Validation error routing** — project dùng `GlobalExceptionHandler` xử lý `MethodArgumentNotValidException`: thử parse message thành `GlobalErrorCode`, nếu không được thì trả message string trực tiếp. Cách này cho phép dùng message tự do trong annotation (`@ValidProvince`, `@Pattern`) mà không cần thêm enum mới.

- **Trim trước khi save** — tránh user nhập khoảng trắng thừa vào DB. Chỉ trim ở controller sau khi validation pass (validator đã trim trước khi check whitelist).

- **`@Pattern` thay vì custom validator cho phone** — regex đủ đơn giản, không cần thêm class riêng.

---

## Validation Rules

| Field | Constraint | Error Message |
|---|---|---|
| `clusterName` | NotBlank, Size(2-100) | "Cluster name must be between 2 and 100 characters" |
| `province` | NotBlank, ValidProvince | "Invalid province. Must be one of the allowed provinces in Vietnam." |
| `address` | NotBlank, Size(min=10) | "Address must be at least 10 characters" |
| `phoneNumber` | Pattern regex (optional) | "Invalid Vietnam phone number. Must be 10 digits starting with 03x, 05x, 07x, 08x, or 09x" |
| `?status=` query param | Enum check | "Invalid status. Accepted values: ACTIVE, INACTIVE" (HTTP 400) |

**Allowed provinces (20):**
Ha Noi, TP. Ho Chi Minh, Da Nang, Can Tho, Hai Phong, Bien Hoa, Nha Trang, Hue, Vung Tau, Quy Nhon, Binh Duong, Long An, Dong Nai, Ba Ria - Vung Tau, Thanh Hoa, Nghe An, Binh Dinh, Khanh Hoa, Lam Dong, Khac

---

## How to Test

**Setup:** Rebuild movie-service sau khi apply branch:
```
docker-compose up -d --build movie-service
```

**Test province validation:**
```json
POST /api/cinema-clusters
{
  "clusterName": "Test",
  "province": "Sài Gòn",
  "address": "123 đường ABC phường XYZ",
  "phoneNumber": "0901234567"
}
```
→ `400 Bad Request` — "Invalid province. Must be one of the allowed provinces in Vietnam."

**Test size validation:**
```json
POST /api/cinema-clusters
{
  "clusterName": "A",
  "province": "Hà Nội",
  "address": "ngắn",
  "phoneNumber": "0901234567"
}
```
→ `400 Bad Request` — "Cluster name must be between 2 and 100 characters"

**Test phone validation:**
```json
POST /api/cinema-clusters
{
  "clusterName": "CinePrime Test",
  "province": "Hà Nội",
  "address": "123 Nguyễn Trãi, Hà Đông",
  "phoneNumber": "0123456789"
}
```
→ `400 Bad Request` — "Invalid Vietnam phone number..."

**Test valid phone (optional field):**
```json
POST /api/cinema-clusters
{
  "clusterName": "CinePrime Test",
  "province": "Hà Nội",
  "address": "123 Nguyễn Trãi, Hà Đông",
  "phoneNumber": null
}
```
→ `201 Created` — `phoneNumber` là optional, null hợp lệ

**Test status query param:**
```
GET /api/cinema-clusters?status=INVALID
```
→ `400 Bad Request` — "Invalid status. Accepted values: ACTIVE, INACTIVE"

```
GET /api/cinema-clusters?status=ACTIVE
```
→ `200 OK` — danh sách cluster status ACTIVE

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] Không còn debug code
- [x] Follows project conventions (`AppException`, `ApiResponse`, Jakarta Validation)

**Validation**
- [x] `ValidProvince` annotation + `ProvinceValidator` theo pattern của `DobValidator` trong auth-service
- [x] Province whitelist khớp với `PROVINCES` array trên frontend
- [x] Phone number regex chỉ chấp nhận số Viet Nam 10 chữ số hợp lệ
- [x] `phoneNumber` là optional (null-safe — `@Pattern` bỏ qua null)
- [x] `?status=` invalid → 400 với message rõ ràng thay vì 500

**Error Codes**
- [x] `INVALID_CLUSTER_STATUS(2025)` thêm vào `MovieErrorCode`

---

## Reviewer Notes

- `@Pattern` với `nullable` — Jakarta `@Pattern` mặc định bỏ qua null value, nên `phoneNumber` là truly optional. Nếu có số điện thoại thì phải đúng format.
- Nếu frontend mở rộng danh sách tỉnh/thành, cần update `ALLOWED_PROVINCES` trong `ProvinceValidator.java` đồng thời.
- Validation message không map qua `GlobalErrorCode` enum mà trả thẳng string — đây là behavior hiện có của `GlobalExceptionHandler` trong project (fallback path).
