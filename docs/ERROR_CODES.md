# Error Codes Reference

**Dự án:** CinePrime  
**Cập nhật lần cuối:** 2026

Tất cả response lỗi trả về theo format:

```json
{
  "code": 1013,
  "message": "OTP is invalid!"
}
```

`code = 1000` là thành công (không có lỗi).

---

## Quy tắc đánh số

| Dải | Loại |
|---|---|
| `1000` | Thành công |
| `1001 – 1009` | Lỗi toàn hệ thống (GlobalErrorCode) |
| `1010 – 1099` | Lỗi auth-service (AuthErrorCode) |
| `1100 – 1199` | Lỗi user-service *(dự kiến)* |
| `1200 – 1299` | Lỗi booking-service *(dự kiến)* |
| `2001+` | Lỗi validation có tham số động |

---

## 1. Global — Toàn hệ thống

> Nguồn: `common/exception/GlobalErrorCode.java`  
> Handler: `GlobalExceptionHandler.java` trong module `common`

| Code | Enum | HTTP Status | Message | Khi nào xảy ra |
|---|---|---|---|---|
| `1003` | `UNCATEGORIZED_EXCEPTION` | 500 Internal Server Error | An unexpected error occurred. Please try again later. | Mọi exception không được handle cụ thể — fallback cuối cùng |
| `1005` | `INVALID_KEY` | 400 Bad Request | Invalid request field! | `@Valid` fail trên DTO nhưng message không map được sang enum cụ thể |
| `1006` | `DATA_INTEGRITY_VIOLATION` | 409 Conflict | Data already exists or conflicts with an existing record. | DB unique constraint bị vi phạm (race condition vượt qua service-level check) |
| `1008` | `UNAUTHENTICATED` | 401 Unauthorized | Unauthenticated! | Không có token / token không hợp lệ / token hết hạn |
| `1009` | `UNAUTHORIZED` | 403 Forbidden | You do not have permission! | Có token hợp lệ nhưng không đủ quyền truy cập endpoint |
| `2001` | `INVALID_AGE` | 400 Bad Request | Your age must be at least {min} years old! | `@DobConstraint` fail — ngày sinh không đủ tuổi tối thiểu |

---

## 2. Auth Service

> Nguồn: `auth-service/exception/AuthErrorCode.java`

### 2.1 Đăng ký (Registration)

| Code | Enum | HTTP Status | Message | Khi nào xảy ra |
|---|---|---|---|---|
| `1010` | `USERNAME_EXISTED` | 400 Bad Request | Username already exists! | Username đã có trong `auth_db.account` |
| `1011` | `EMAIL_EXISTED` | 400 Bad Request | Email already exists! | Email đã có trong `auth_db.account` |
| `1013` | `INVALID_OTP` | 400 Bad Request | OTP is invalid! | OTP nhập vào không khớp với OTP trong Redis |
| `1015` | `OTP_EXPIRED` | 400 Bad Request | OTP has expired! | Redis key OTP đã hết TTL (5 phút) |
| `1016` | `RESEND_OTP_TOO_FAST` | 429 Too Many Requests | Please wait before requesting another OTP! | Gửi lại OTP trong vòng 60 giây kể từ lần trước |
| `1019` | `EMAIL_SEND_FAILED` | 500 Internal Server Error | Failed to send OTP email. Please try again. | Kafka không gửi được event OTP hoặc notification-service lỗi |

### 2.2 Đăng nhập (Login)

| Code | Enum | HTTP Status | Message | Khi nào xảy ra |
|---|---|---|---|---|
| `1008` | `UNAUTHENTICATED` *(global)* | 401 Unauthorized | Unauthenticated! | Sai username hoặc sai password |
| `1020` | `ACCOUNT_INACTIVE` | 403 Forbidden | Your account has been deactivated. Please contact support. | Account có `status = INACTIVE` |
| `1021` | `ACCOUNT_LOCKED` | 403 Forbidden | Your account has been temporarily locked due to too many failed login attempts. Please try again later. | Brute-force: `failed_login_attempts >= 5`, `locked_until` còn hiệu lực |

### 2.3 Token / Session

| Code | Enum | HTTP Status | Message | Khi nào xảy ra | Hành động frontend |
|---|---|---|---|---|---|
| `1022` | `TOKEN_EXPIRED` | 401 Unauthorized | Your session has expired. Please log in again. | JWT `exp` đã qua — dùng refresh token | Gọi `/auth/refresh`, nếu fail → redirect login |
| `1023` | `TOKEN_INVALID` | 401 Unauthorized | Invalid token. Please log in again. | JWT sai chữ ký hoặc malformed | Xóa token, redirect login |
| `1024` | `TOKEN_REVOKED` | 401 Unauthorized | This session has been logged out. Please log in again. | Token đã bị revoke (`is_revoked = true`) — logout từ thiết bị khác | Xóa token, redirect login |

### 2.4 Tài khoản (Account)

| Code | Enum | HTTP Status | Message | Khi nào xảy ra |
|---|---|---|---|---|
| `1014` | `ACCOUNT_NOT_FOUND` | 404 Not Found | Account not found! | Tìm account theo ID hoặc username không có kết quả |
| `1012` | `ROLE_NOT_FOUND` | 500 Internal Server Error | An internal error occurred. Please contact support. | Role `USER` không có trong bảng `roles` — dữ liệu seed bị thiếu |

### 2.5 Profile Completion (User Service — dùng khi đăng ký 2 bước)

| Code | Enum | HTTP Status | Message | Khi nào xảy ra |
|---|---|---|---|---|
| `1017` | `PHONE_EXISTED` | 400 Bad Request | Phone number already exists in the system! | `phone_number` đã có trong `user_db.users` |
| `1018` | `IDENTITY_CARD_EXISTED` | 400 Bad Request | Identity card (CCCD) already exists in the system! | `identity_card` đã có trong `user_db.users` |

---

## 3. Validation Errors (400 Bad Request)

Các lỗi này trả về `code = 1005` (INVALID_KEY) với `message` là nội dung lỗi validation trực tiếp từ annotation.

| Trường | Annotation | Message trả về |
|---|---|---|
| `username` | `@NotBlank` | Username cannot be blank! |
| `username` | `@Size(min=5, max=50)` | Username must be between 5 and 50 characters! |
| `password` | `@NotBlank` | Password cannot be blank! |
| `password` | `@Size(min=8)` | Password must be at least 8 characters! |
| `email` | `@NotBlank` | Email cannot be blank! |
| `email` | `@Email` | Invalid email format (e.g., example@gmail.com)! |
| `phoneNumber` | `@Pattern` | Invalid phone number format! |
| `identityCard` | `@Pattern` | Identity card must contain exactly 12 digits! |
| `dateOfBirth` | `@DobConstraint(min=18)` | `2001` — Your age must be at least 18 years old! |

---

## 4. Hướng dẫn cho Frontend

**Xử lý error response:**

```javascript
// Ví dụ xử lý trong React/Vue
const ERROR_MESSAGES_VI = {
  1003: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.',
  1005: 'Dữ liệu nhập không hợp lệ.',
  1006: 'Dữ liệu đã tồn tại trong hệ thống.',
  1008: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.',
  1009: 'Bạn không có quyền thực hiện thao tác này.',
  1010: 'Tên đăng nhập đã được sử dụng.',
  1011: 'Email đã được đăng ký.',
  1013: 'Mã OTP không chính xác.',
  1014: 'Không tìm thấy tài khoản.',
  1015: 'Mã OTP đã hết hạn, vui lòng yêu cầu mã mới.',
  1016: 'Vui lòng chờ trước khi yêu cầu mã OTP mới.',
  1017: 'Số điện thoại đã được sử dụng.',
  1018: 'Số CCCD đã được đăng ký.',
  1019: 'Không thể gửi email, vui lòng thử lại.',
  1020: 'Tài khoản đã bị vô hiệu hóa, vui lòng liên hệ hỗ trợ.',
  1021: 'Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.',
  1022: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
  1023: 'Token không hợp lệ, vui lòng đăng nhập lại.',
  1024: 'Phiên này đã đăng xuất, vui lòng đăng nhập lại.',
  2001: 'Bạn chưa đủ tuổi để đăng ký.',
};

function getErrorMessage(code, fallbackMessage) {
  return ERROR_MESSAGES_VI[code] ?? fallbackMessage ?? 'Đã có lỗi xảy ra.';
}
```

**HTTP Status → hành động:**

| HTTP Status | Hành động |
|---|---|
| `400` | Hiển thị lỗi bên dưới field tương ứng |
| `401` | Redirect về trang login, xóa token |
| `403` | Hiển thị thông báo "Không có quyền" |
| `404` | Hiển thị trang not found |
| `409` | Thông báo trùng dữ liệu |
| `429` | Disable nút, hiển thị countdown |
| `500` | Toast thông báo lỗi hệ thống |

---

## 5. Thêm error code mới

1. Thêm vào enum tương ứng (`GlobalErrorCode` hoặc service-specific enum như `AuthErrorCode`)
2. Dùng đúng dải số theo quy tắc đánh số ở trên
3. Cập nhật file này
4. Thông báo cho frontend team

---

*CinePrime — Error Codes Reference*
