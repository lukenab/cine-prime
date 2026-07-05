# MR: Fix & Refactor Registration Flow — auth-service

## Overview / Objective

Tách logic đăng ký 2 bước (OTP) từ `AuthenticationService` ra `RegistrationService` riêng, đồng thời fix 3 bug nghiêm trọng: OTP key bị cooldown key ghi đè (OTP đúng vẫn báo INVALID), cooldown bypass cho phép spam OTP, và `emailVerifiedAt` không được ghi nhận sau verify thành công.

Related Issue: Closes #XX

---

## Changes Introduced

**Controllers / Routes:**
- `RegistrationController` — controller riêng cho registration flow, expose 3 endpoint: `/initiate`, `/verify`, `/resend-otp`
- Tách khỏi `AuthController` để đảm bảo SRP

**Services / Logic:**
- `RegistrationService` (mới) — toàn bộ logic đăng ký 2 bước được tách ra từ `AuthenticationService`
- `initiateRegistration`: check cooldown TRƯỚC khi hash password; lưu OTP vào `otp:register:{email}` (tách khỏi cooldown key)
- `completeRegistration`: set `emailVerifiedAt = LocalDateTime.now()` sau khi tạo account thành công
- `resendOtp`: check cooldown → set cooldown → kiểm tra pending data → dispatch OTP mới
- `dispatchOtp`: lưu OTP vào `otp:register:{email}`, không dùng `cooldown:otp:{email}`
- `resolvePendingRegistration`: đọc OTP từ `otp:register:{email}` (đúng key)
- `AuthenticationService` — đã slim, chỉ còn login/refresh/logout/introspect

**DTOs / Mappers / Components:**
- `RegisterRequest`, `VerifyOtpRequest`, `ResendOtpRequest` — giữ nguyên, không thay đổi

**Database / JPA / Migration:**
- `Account.emailVerifiedAt` — field đã có sẵn, nay được populate đúng sau OTP verify

**Exception Handling / Error Codes:**
- `REGISTRATION_NOT_INITIATED (1025)` — thêm mới, trả về khi resend OTP nhưng chưa có pending registration trong Redis

---

## Key Architectural Decisions

**Tại sao tách 3 Redis key riêng biệt?**

Trước đây `OTP_COOLDOWN_KEY_PREFIX` (`cooldown:otp:`) dùng chung cho cả OTP value lẫn cooldown lock. `dispatchOtp` set OTP vào key đó, sau đó `initiateRegistration` ghi đè bằng `"locked"` → bug nghiêm trọng. Sau khi tách:

| Key | Mục đích | TTL |
|---|---|---|
| `otp:register:{email}` | Giá trị OTP | 5 phút |
| `cooldown:otp:{email}` | Rate-limit resend | 60 giây |
| `pending:register:{email}` | RegisterRequest (JSON) | 5 phút |

**Tại sao check cooldown trước BCrypt?**

BCrypt cost 10 mất ~300–500ms. Nếu check cooldown sau hash thì attacker vẫn tốn được tài nguyên CPU mỗi lần spam. Check trước giúp reject ngay lập tức với chi phí O(1) Redis lookup.

---

## How to Test

1. Khởi động auth-service, Redis, Kafka, notification-service
2. **Test happy path:**
   - `POST /api/auth/register/initiate` với `{username, email, password}` → 200 OK
   - Kiểm tra Redis: `redis-cli GET otp:register:{email}` → 6 chữ số
   - Kiểm tra Redis: `redis-cli GET cooldown:otp:{email}` → `"locked"`
   - `POST /api/auth/register/verify` với OTP đúng → 201, account tạo thành công
   - Kiểm tra DB: `email_verified_at` không NULL
3. **Test OTP sai:**
   - Nhập OTP sai → 400 `INVALID_OTP`
4. **Test cooldown:**
   - Gọi `/initiate` lần 2 trong vòng 60s → 429 `RESEND_OTP_TOO_FAST`
5. **Test OTP hết hạn:**
   - Đợi 5 phút hoặc xóa key Redis, gọi `/verify` → 400 `OTP_EXPIRED`
6. **Test resend chưa initiate:**
   - Gọi `/resend-otp` với email chưa initiate → 400 `REGISTRATION_NOT_INITIATED`

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Exception handling uses correct error codes
- [x] Endpoints tested via Postman / API client
- [ ] API contract / Postman collection updated

---

## Reviewer Notes

- Chú ý 3 Redis key riêng biệt — đây là core fix của MR này, verify kỹ `dispatchOtp` và `resolvePendingRegistration` đọc/ghi đúng key `otp:register:` chứ không phải `cooldown:otp:`
- `emailVerifiedAt` trong `provisionAccount` — kiểm tra DB sau khi register thành công, field này phải không NULL
- Cooldown check trong `initiateRegistration` phải nằm TRƯỚC `passwordEncoder.encode()`
