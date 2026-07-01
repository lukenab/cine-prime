# [Backend] Move OTP email sending from auth-service to notification-service via Kafka

**Labels:** `Layer::Backend` `Type::Chore` `Priority::Medium`  
**Branch:** `chore/move-otp-email-to-notification-service`

---

## Summary / Objective

`auth-service` hiện gửi OTP email **đồng bộ** trực tiếp trong HTTP request thread qua `EmailService` (JavaMailSender + SMTP), khiến response `POST /register/initiate` bị block 300–800ms mỗi lần gọi SMTP. Việc này vi phạm Single Responsibility — `auth-service` không nên quản lý SMTP config, mail template hay Thymeleaf rendering. Tách việc gửi email sang `notification-service` bằng Kafka fire-and-forget event để giải phóng HTTP thread và đưa toàn bộ notification responsibility về một nơi.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `auth-service` không còn `EmailService.java`, `spring-boot-starter-mail`, `spring-boot-starter-thymeleaf`, cấu hình `spring.mail.*`, hay template `otp-email.html`
- [ ] `auth-service` publish `OtpRequestedEvent` lên Kafka topic `send-otp-email-topic` sau khi lưu pending data vào Redis
- [ ] `notification-service` consume event từ topic và gửi OTP email thành công đến địa chỉ trong event
- [ ] HTTP response `POST /register/initiate` trả về trong < 100ms (không bị block bởi SMTP)
- [ ] Lỗi SMTP trong `notification-service` được log nhưng **không** ảnh hưởng HTTP response của `auth-service`
- [ ] OTP email template (`otp-email.html`) được quản lý hoàn toàn bởi `notification-service`

---

## Technical Notes / Constraints

**Kafka topic:** `send-otp-email-topic`

**Event payload (`OtpRequestedEvent`):**
```json
{
  "email": "user@example.com",
  "otp": "482910",
  "expiryMinutes": 5
}
```

**Fire-and-forget — không dùng `sendAndWait`:** Producer gọi `kafkaTemplate.send(...).whenComplete(...)` để log lỗi nhưng không block. Nếu Kafka down, lỗi chỉ được log ở producer side — HTTP request vẫn trả về thành công (graceful degradation).

**Type mapping cần cập nhật ở cả 2 service:**
- `auth-service` producer: `otpRequested:authservice.event.OtpRequestedEvent`
- `notification-service` consumer: `otpRequested:notificationservice.event.OtpRequestedEvent`

**Resend OTP** cũng dùng `generateAndSendOtp()` — cả hai code path (`initiateRegistration` và `resendOtp`) đều được migrate cùng lúc, không cần thay đổi thêm.

---

## Related

- Branch: `chore/move-otp-email-to-notification-service`
- Depends on: `notification-service` đã được setup và kết nối Kafka
- Docs: `docs/ISSUE_TEMPLATE.md`, `docs/MR_REVIEW_PROCESS.md`
