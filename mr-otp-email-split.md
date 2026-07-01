# MR: chore/move-otp-email-to-notification-service

## Overview / Objective

Tách việc gửi OTP email ra khỏi `auth-service`, chuyển sang `notification-service` thông qua Kafka fire-and-forget event. Trước đây `auth-service` gọi SMTP đồng bộ trên HTTP thread, khiến response `POST /register/initiate` bị block 300–800ms. Sau khi thay đổi, HTTP thread chỉ publish event rồi trả về ngay — SMTP chạy bất đồng bộ hoàn toàn ở `notification-service`.

Related Issue: Closes #[issue-number]

---

## Changes Introduced

**Services / Logic:**
- `authservice/service/AuthenticationService.java` — xóa field `EmailService emailService`; `generateAndSendOtp()` nay gọi `userEventProducer.sendOtpRequestedEvent()` thay vì `emailService.sendOtpEmail()`
- `authservice/service/EmailService.java` — **deleted**, không còn dùng trong auth-service
- `notificationservice/service/EmailService.java` — **new**, `JavaMailSender` + Thymeleaf template rendering, xử lý toàn bộ SMTP logic
- `notificationservice/consumer/OtpEmailConsumer.java` — **new**, `@KafkaListener` trên topic `send-otp-email-topic`, delegate sang `EmailService`

**DTOs / Mappers / Components:**
- `authservice/event/OtpRequestedEvent.java` — **new**, payload `{ email, otp, expiryMinutes }`
- `notificationservice/event/OtpRequestedEvent.java` — **new**, mirror event để Kafka deserialize phía consumer
- `authservice/producer/UserEventProducer.java` — thêm `sendOtpRequestedEvent()` fire-and-forget

**Database / JPA / Migration:**
- Không có thay đổi schema

**Infra / Config:**
- `auth-service/pom.xml` — xóa `spring-boot-starter-mail`, `spring-boot-starter-thymeleaf`
- `auth-service/application.yml` — xóa block `spring.mail.*`
- `auth-service/resources/templates/email/otp-email.html` — **deleted**
- `notification-service/pom.xml` — thêm `spring-boot-starter-mail`, `spring-boot-starter-thymeleaf`
- `notification-service/application.yml` — thêm `spring.mail.*`, Kafka consumer config, type mapping
- `notification-service/resources/templates/email/otp-email.html` — **new** (moved từ auth-service)

---

## Key Architectural Decisions

- **Fire-and-forget thay vì `sendAndWait`:** Registration flow không cần confirm email đã deliver ở HTTP layer — user thấy kết quả qua việc nhận được email. Nếu Kafka publish fail, lỗi chỉ được log ở producer, user có thể dùng `resend-otp`. Dùng `whenComplete()` để log outcome mà không block thread.

- **Kafka type mapping thay vì `__TypeId__` header:** Cả hai service cấu hình `spring.json.type.mapping` với alias `otpRequested`, tránh coupling class name giữa các service. Producer và consumer có thể refactor package độc lập.

---

## How to Test

1. Start Kafka, `auth-service`, `notification-service`
2. Gọi `POST /api/auth/register/initiate` với email hợp lệ — response phải trả về trong < 200ms
3. Kiểm tra log `auth-service`: phải có `Published OtpRequestedEvent to send-otp-email-topic for email: ...`
4. Kiểm tra log `notification-service`: phải có `Received OtpRequestedEvent for email: ...` và `OTP email sent to: ...`
5. Kiểm tra inbox — email OTP đến trong vài giây
6. Tắt `notification-service`, gọi lại `POST /register/initiate` — response vẫn phải trả về `200` (Kafka publish không block)
7. Gọi `POST /api/auth/resend-otp` — flow tương tự, email đến thành công

---

## Checklist

**General**
- [ ] Code compiles, no errors
- [ ] No debug / console.log code left
- [ ] Follows project coding conventions

**Backend (if applicable)**
- [ ] No N+1 query issues (check Hibernate console output)
- [ ] Exception handling uses correct error codes
- [ ] Endpoints tested via Postman / API client
- [ ] API contract / Postman collection updated

---

## Reviewer Notes

- Chú ý `generateAndSendOtp()` được gọi từ **cả hai** code path: `initiateRegistration()` và `resendOtp()` — cần verify cả hai flow đều publish Kafka event thay vì gọi SMTP.
- Type mapping phải khớp giữa 2 service: alias `otpRequested` ở producer map sang `authservice.event.OtpRequestedEvent`; ở consumer map sang `notificationservice.event.OtpRequestedEvent`.
- `notification-service/application.yml` chứa mail password hardcode — nên dùng env variable `${MAIL_PASSWORD}` trong môi trường production.
