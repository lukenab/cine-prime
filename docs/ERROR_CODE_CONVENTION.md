# Error Code Convention

Quy ước mã lỗi cho toàn bộ backend (các service dùng chung `ApiResponse` + `BaseErrorCode` trong module `common`).

---

## 1. Response envelope

Mọi API trả về `ApiResponse<T>`:

```json
{
  "code": 1000,
  "message": "…",
  "result": { }
}
```

| Field | Ý nghĩa |
|-------|---------|
| `code` | **Mã nghiệp vụ** — định danh chính xác kết quả/lỗi trong domain. `1000` = thành công. |
| `message` | Chuỗi cho **con người** (hiển thị nhanh / log). Không dùng để rẽ nhánh logic. |
| `result` | Dữ liệu trả về (khi thành công). |

`GlobalExceptionHandler` trả:
```java
return ResponseEntity.status(errorCode.getStatusCode()).body(apiResponse);
```
→ **vừa** set HTTP status (từ `errorCode.getStatusCode()`) **vừa** kèm `code` + `message` trong body.

---

## 2. HTTP status vs business `code` — tại sao cần cả hai?

Hai thứ ở **hai tầng khác nhau**:

| | HTTP status (400/409/401…) | Business `code` (1010, 1011…) |
|---|---|---|
| Tầng | Giao vận (protocol) | Nghiệp vụ (application) |
| Dành cho | Hạ tầng: browser, proxy, gateway, cache, monitoring, retry | Client app: rẽ nhánh logic, i18n |
| Độ chi tiết | Thô (nhiều lỗi → 1 status) | Chính xác từng lỗi |
| Ví dụ | `Username existed`, `Email existed`, `Invalid OTP` **đều** = HTTP 400 | 1010 / 1011 / 1013 — phân biệt rõ |

- **HTTP status** để hạ tầng và client tổng quát biết thành/bại ở mức protocol (2xx/4xx/5xx). Quá thô để biết *lỗi gì*.
- **`code`** để client xử lý chính xác: `1010` → tô đỏ ô username; `1011` → tô đỏ ô email; map sang thông báo đa ngôn ngữ mà không phải so khớp chuỗi.
- **`message`** chỉ để hiển thị/log — **không** dùng để `if/else` (text có thể đổi/dịch).

> Ẩn dụ: HTTP status = trạng thái giao hàng ("thành công/thất bại") cho bên vận chuyển; `code` = lý do cụ thể ("sai địa chỉ / khách vắng") cho app xử lý.

**Không bỏ bớt cái nào:** chỉ HTTP status → không đủ chi tiết; chỉ `code` (luôn 200) → hạ tầng không phân biệt được thành/bại.

---

## 3. Phân dải mã `code` theo phạm vi (banding)

Mỗi phạm vi giữ một dải riêng để **không đụng nhau** và nhìn mã biết thuộc miền nào.

| Dải | Phạm vi | Nơi định nghĩa |
|-----|---------|----------------|
| `1000` | Success | `ApiResponse` default |
| `1000–1009` | **Global / cross-cutting** (uncategorized, invalid key, unauthenticated, unauthorized) | `common/GlobalErrorCode` |
| `1010–10xx` | **auth-service** (đăng ký, OTP, role, token) | `auth-service/AuthErrorCode` |
| `2xxx` | **Service nghiệp vụ** (movie, booking…) | `*/…ErrorCode` từng service |
| `5xxx` | **Lỗi hạ tầng/server** (internal error, upload fail…) | mỗi service |

> ⚠️ Lỗi global nên nằm gọn trong `1000–1009`. Hiện `GlobalErrorCode.INVALID_AGE(2001)` đang lấn dải `2xxx` của service nghiệp vụ — **nợ kỹ thuật cần dọn**.

---

## 4. Quy tắc đánh số trong một service

1. **Bắt đầu sau khối global** — auth-service bắt đầu từ `1010` (ngay sau `1000–1009`).
2. **Tuần tự theo NHÓM nghiệp vụ** — các lỗi liên quan nằm cạnh nhau:
   - `1010` Username, `1011` Email → nhóm "unique field trong `auth_db.accounts`".
   - `1013–1016` → nhóm OTP lifecycle (invalid / expired / resend-too-fast).
   - `1017` Phone, `1018` Identity → nhóm field validate cross-service qua Feign.
3. **Khớp thứ tự kiểm tra khi hợp lý** — `username(1010)` trước `email(1011)` vì `validateUniqueFields` check username trước.
4. **Chỉ thêm, không tái sử dụng số cũ** — mã đã publish là hợp đồng với client; đừng đổi ý nghĩa của một số đã dùng.
5. Con số chỉ là **định danh** — miễn thỏa: (a) duy nhất, (b) đúng dải, (c) nhóm hợp lý.

---

## 5. Bảng mã auth-service (tham chiếu — khớp `AuthErrorCode.java`)

| Code | Enum | HTTP | Message |
|------|------|------|---------|
| 1010 | `USERNAME_EXISTED` | 400 | Username already exists! |
| 1011 | `EMAIL_EXISTED` | 400 | Email already exists! |
| 1012 | `ROLE_NOT_FOUND` | 500 | An internal error occurred. Please contact support. |
| 1013 | `INVALID_OTP` | 400 | OTP is invalid! |
| 1014 | `ACCOUNT_NOT_FOUND` | 404 | Account not found! |
| 1015 | `OTP_EXPIRED` | 400 | OTP has expired! |
| 1016 | `RESEND_OTP_TOO_FAST` | 429 | Please wait before requesting another OTP! |
| 1017 | `PHONE_EXISTED` | 400 | Phone number already exists in the system! |
| 1018 | `IDENTITY_CARD_EXISTED` | 400 | Identity card (CCCD) already exists in the system! |

---

## 6. Khi thêm mã lỗi mới — checklist

- [ ] Đúng dải của service (auth `10xx`, nghiệp vụ `2xxx`, hạ tầng `5xxx`).
- [ ] Số duy nhất, chưa dùng.
- [ ] Đặt cạnh nhóm nghiệp vụ liên quan.
- [ ] Chọn `HttpStatus` đúng ngữ nghĩa (409 CONFLICT cho trùng dữ liệu, 400 BAD_REQUEST cho input sai, 401/403 cho auth…).
- [ ] Không đổi ý nghĩa mã đã publish.
