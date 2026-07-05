# [Backend] Refactor & Fix: Registration Flow trong auth-service

## Labels

```
Layer::Backend, Type::Bug, Priority::High, In Progress
```

---

## Summary / Objective

Flow đăng ký 2 bước (OTP) trong `AuthenticationService` có nhiều bug nghiêm trọng và vi phạm Single Responsibility Principle. Cần tách `RegistrationService` riêng, đồng thời fix các lỗi: OTP key bị ghi đè bởi cooldown key dẫn đến OTP nhập đúng vẫn báo INVALID, cooldown bypass cho phép spam OTP không giới hạn, và `emailVerifiedAt` không được ghi nhận sau khi verify thành công.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `RegistrationService` được tách ra khỏi `AuthenticationService`, chỉ chứa logic đăng ký
- [ ] `POST /api/auth/register/initiate` — kiểm tra cooldown trước khi hash password; OTP được lưu vào key riêng `otp:register:{email}`
- [ ] `POST /api/auth/register/verify` — OTP đúng thì pass; `emailVerifiedAt` được set sau khi tạo account
- [ ] `POST /api/auth/register/resend-otp` — kiểm tra cooldown đúng, không thể resend trong vòng 60 giây
- [ ] Không thể spam `/initiate` liên tục (cooldown enforced)
- [ ] Ba Redis key tách biệt: `otp:register:`, `cooldown:otp:`, `pending:register:`
- [ ] Error code `REGISTRATION_NOT_INITIATED` trả về khi resend OTP nhưng chưa initiate
- [ ] Code compiles, không có lỗi

---

## Technical Notes / Constraints

### Bug 1 — OTP key bị ghi đè bởi cooldown key (Critical)

`dispatchOtp` lưu OTP vào `cooldown:otp:{email}`, sau đó `initiateRegistration` ghi đè chính key đó bằng `"locked"`. Khi verify, `resolvePendingRegistration` đọc được `"locked"` thay vì OTP thật → luôn trả về `INVALID_OTP`.

**Fix:** Tách key riêng cho OTP: `otp:register:{email}` (TTL = otpTtlMinutes).

```
Redis keys sau khi fix:
  otp:register:{email}    — giá trị OTP, TTL = 5 phút
  cooldown:otp:{email}    — "locked", TTL = 60 giây
  pending:register:{email} — JSON của RegisterRequest, TTL = 5 phút
```

### Bug 2 — Cooldown bypass

Trong `initiateRegistration`, cooldown check nằm SAU `BCrypt.encode(password)` → nếu cooldown chưa set, hệ thống vẫn hash password rồi mới check. Quan trọng hơn: cooldown không được check trước khi dispatch OTP, dẫn đến spam không giới hạn.

**Fix:** Check cooldown key trước mọi xử lý.

### Bug 3 — `emailVerifiedAt` không được set

`provisionAccount` set `AccountStatus.ACTIVE` nhưng không gọi `account.setEmailVerifiedAt(LocalDateTime.now())`. Account được đánh dấu active nhưng email_verified_at = NULL.

**Fix:** Thêm `account.setEmailVerifiedAt(LocalDateTime.now())` trong `provisionAccount`.

### Architectural note

`RegistrationService` sử dụng `@Transactional(dontRollbackOn = AppException.class)` cho audit log để đảm bảo log lỗi được persist ngay cả khi main transaction rollback.

---

## Related

- Branch: `fix/#XX-auth-registration-flow`
- Depends on: auth-service module
- Docs: `docs/ERROR_CODES.md`, `docs/CODING_CONVENTION.md`
