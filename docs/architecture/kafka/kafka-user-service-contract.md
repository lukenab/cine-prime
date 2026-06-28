# Kafka Contract — auth-service ↔ user-service

Tài liệu này mô tả toàn bộ giao thức messaging giữa `auth-service` (producer) và `user-service` (consumer) cho hai topic xử lý vòng đời người dùng.

---

## 1. Tổng quan các Topic

| Topic | Khi nào fire | Producer | Consumer |
|---|---|---|---|
| `user-register-topic` | Người dùng hoàn tất đăng ký OTP **hoặc** admin tạo tài khoản trực tiếp | auth-service | user-service |
| `user-update-topic` | Admin cập nhật thông tin profile của một tài khoản | auth-service | user-service |

- **Consumer Group:** `user-service-group`
- **Kafka Mode:** KRaft (không dùng Zookeeper), single broker (dev)

---

## 2. Topic: `user-register-topic`

### 2.1 Điều kiện kích hoạt

Topic này được fire từ **hai luồng code riêng biệt** trong auth-service:

**Luồng A — Đăng ký qua OTP** (`AuthenticationService.verifyOtpAndRegister()`):
1. Xác thực OTP từ Redis cache
2. Kiểm tra lại tính duy nhất của phone/CCCD qua Feign gọi sang user-service
3. Tạo Account và flush xuống `auth_db` bằng `saveAndFlush()`
4. Build `UserRegisteredEvent` và gửi lên topic
5. Xóa key OTP khỏi Redis

**Luồng B — Admin tạo trực tiếp** (`AccountService.createAccount()`):
1. Kiểm tra tính duy nhất của username/email trong `auth_db`
2. Tạo Account và flush xuống `auth_db` bằng `saveAndFlush()`
3. Build cùng cấu trúc `UserRegisteredEvent` và gửi lên topic

### 2.2 Schema Event — `UserRegisteredEvent`

```json
{
  "accountId": "b41fac5d-aa57-461d-88f6-28192cfbd64a",
  "fullName": "Nguyen An Binh",
  "phoneNumber": "0812154005",
  "dateOfBirth": [1995, 10, 15],
  "gender": "MALE",
  "address": "123 Main St, City",
  "identityCard": "123456789012"
}
```

| Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| accountId | UUID String | Có | Duy nhất, do auth-service sinh ra |
| fullName | String | Có | Tối đa 50 ký tự |
| phoneNumber | String | Có | `^(0[3\|5\|7\|8\|9])+([0-9]{8})$` |
| dateOfBirth | `[YYYY, MM, DD]` | Không | Jackson serialize `LocalDate` thành mảng số nguyên |
| gender | String | Không | `MALE` \| `FEMALE` \| `OTHER` |
| address | String | Không | Tối đa 255 ký tự |
| identityCard | String | Không | Đúng 12 chữ số, duy nhất |

> **Lưu ý:** Trường `email` **không được đưa vào** event này. Email là thông tin xác thực, thuộc quyền sở hữu của `auth-service` (lưu trong `auth_db`). `user-service` chỉ lưu dữ liệu profile.

### 2.3 Luồng xử lý

```
LUỒNG A — ĐĂNG KÝ QUA OTP

GIAI ĐOẠN 1 — KHỞI TẠO
Frontend → POST /api/auth/register/initiate → auth-service
  ├─ Validate định dạng email & kiểm tra duy nhất (auth_db)
  ├─ Kiểm tra username duy nhất (auth_db)
  ├─ Kiểm tra phone/CCCD duy nhất qua Feign → user-service
  ├─ Sinh OTP 6 chữ số (SecureRandom)
  ├─ Cache OTP vào Redis (TTL 5 phút, key = email)
  ├─ Cache cooldown vào Redis (TTL 60 giây, key = "cooldown:otp:" + email)
  └─ Gửi email OTP

GIAI ĐOẠN 2 — XÁC THỰC & ĐĂNG KÝ
Frontend → POST /api/auth/register/verify → auth-service
  ├─ Xác thực OTP từ Redis (null → OTP_EXPIRED, sai → INVALID_OTP)
  ├─ Xóa key OTP khỏi Redis
  ├─ Kiểm tra lại email/username duy nhất (guard chống race condition)
  ├─ Kiểm tra lại phone/CCCD qua Feign → user-service (guard chống race condition)
  ├─ Tạo entity Account
  ├─ Hash password (BCrypt)
  ├─ Set status = 1, gán role USER
  ├─ saveAndFlush() → auth_db
  ├─ Build UserRegisteredEvent (không có trường email)
  └─ Gửi lên Kafka → user-register-topic

GIAI ĐOẠN 3 — TẠO PROFILE BẤT ĐỒNG BỘ
Kafka → user-service
  ├─ Deserialize UserRegisteredEvent
  ├─ Kiểm tra idempotency: existsById(accountId)
  │   └─ Nếu đã tồn tại → log WARN "[DATA_INCONSISTENCY]", return (bỏ qua)
  ├─ Data guard: existsByPhoneNumber(phoneNumber)
  │   └─ Nếu đã tồn tại → log ERROR "[DATA_INCONSISTENCY]", return (bỏ qua)
  ├─ Data guard: existsByIdentityCard(identityCard)
  │   └─ Nếu đã tồn tại → log ERROR "[DATA_INCONSISTENCY]", return (bỏ qua)
  ├─ Map event → entity User
  ├─ user.setIsActive(true)
  ├─ user.setCreatedAt(LocalDateTime.now())
  ├─ userRepository.save(user)
  ├─ auditLogService.log("User", accountId, "CREATE", ...)
  └─ Log thành công

---

LUỒNG B — ADMIN TẠO TRỰC TIẾP

Admin → POST /api/accounts → auth-service
  ├─ Kiểm tra username/email duy nhất (auth_db)
  ├─ Hash password (BCrypt)
  ├─ Set status = 1, gán role theo yêu cầu (mặc định: USER)
  ├─ saveAndFlush() → auth_db
  ├─ Build UserRegisteredEvent (không có trường email)
  └─ Gửi lên Kafka → user-register-topic

Kafka → user-service  (xử lý giống Giai đoạn 3 ở trên)
```

### 2.4 Idempotency phía Consumer

`user-service` thực hiện **ba guard check theo thứ tự** trước mỗi lần `save()`:

| Kiểm tra | Method | Khi xảy ra conflict |
|---|---|---|
| Trùng accountId | `existsById(accountId)` | Log WARN, bỏ qua — tái xử lý bình thường |
| Trùng số điện thoại | `existsByPhoneNumber(phoneNumber)` | Log ERROR `[DATA_INCONSISTENCY]`, bỏ qua |
| Trùng số CCCD | `existsByIdentityCard(identityCard)` | Log ERROR `[DATA_INCONSISTENCY]`, bỏ qua |

Tag `[DATA_INCONSISTENCY]` trong log cho thấy `auth_db` có tài khoản nhưng `user_db` đã có profile với phone/CCCD trùng — cần điều tra thủ công.

---

## 3. Topic: `user-update-topic`

### 3.1 Điều kiện kích hoạt

Được fire khi `AccountService.updateAccount()` được gọi (admin cập nhật tài khoản qua `PUT /api/accounts/{accountId}`):
1. Tài khoản được cập nhật trong `auth_db`
2. `UserUpdatedEvent` được build từ các trường profile và gửi lên topic

### 3.2 Schema Event — `UserUpdatedEvent`

```json
{
  "accountId": "b41fac5d-aa57-461d-88f6-28192cfbd64a",
  "fullName": "Nguyen An Binh Updated",
  "phoneNumber": "0912345678",
  "dateOfBirth": [1995, 10, 15],
  "gender": "FEMALE",
  "address": "456 New Street",
  "identityCard": "123456789012"
}
```

| Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| accountId | UUID String | Có | Phải tồn tại trong user_db |
| fullName | String | Không | Tối đa 50 ký tự |
| phoneNumber | String | Không | `^(0[3\|5\|7\|8\|9])+([0-9]{8})$`, phải duy nhất |
| dateOfBirth | `[YYYY, MM, DD]` | Không | — |
| gender | String | Không | `MALE` \| `FEMALE` \| `OTHER` |
| address | String | Không | Tối đa 255 ký tự |
| identityCard | String | Không | Đúng 12 chữ số |

> **Lưu ý:** Mặc dù `UserUpdatedEvent` có trường `email` trong class Java, trường này **không bao giờ được set** trong builder của `AccountService.updateAccount()`. Giá trị luôn là `null` trong message và `user-service` bỏ qua nó. Việc cập nhật email chỉ tồn tại trong `auth_db`.

### 3.3 Luồng xử lý

```
Admin → PUT /api/accounts/{accountId} → auth-service
  ├─ Tìm Account theo accountId (throw ACCOUNT_NOT_FOUND nếu không có)
  ├─ Cập nhật các trường của account (email, password, roles) trong auth_db
  ├─ Re-hash password nếu có password mới
  ├─ accountRepository.save(account)
  ├─ Build UserUpdatedEvent (chỉ các trường profile, bỏ qua email)
  └─ Gửi lên Kafka → user-update-topic

Kafka → user-service
  ├─ Deserialize UserUpdatedEvent
  ├─ Kiểm tra existsById(accountId)
  │   └─ Nếu KHÔNG tồn tại → log WARN, return (profile chưa được tạo)
  ├─ Build UserUpdateRequest từ các trường của event
  ├─ Validate tính duy nhất của phone nếu số điện thoại thay đổi (throw PHONE_EXISTED nếu trùng)
  ├─ userMapper.updateUser(request, user)
  ├─ user.setUpdatedAt(LocalDateTime.now())
  ├─ userRepository.save(user)
  ├─ auditLogService.log("User", accountId, "UPDATE", ...)
  └─ Log thành công
```

---

## 4. Cấu hình Kafka

### 4.1 Producer — auth-service (`application.yml`)

```yaml
spring:
  kafka:
    bootstrap-servers: ${SPRING_KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      properties:
        "[spring.json.add.type.headers]": true
        "[spring.json.type.mapping]": "userRegistered:authservice.event.UserRegisteredEvent,userUpdated:authservice.event.UserUpdatedEvent"
```

### 4.2 Consumer — user-service (`application.yml`)

```yaml
spring:
  kafka:
    bootstrap-servers: ${SPRING_KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    consumer:
      group-id: user-service-group
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
      properties:
        "[spring.deserializer.value.delegate.class]": org.springframework.kafka.support.serializer.JsonDeserializer
        "[spring.json.trusted.packages]": "*"
        "[spring.json.use.type.headers]": true
        "[spring.json.type.mapping]": "userRegistered:userservice.event.UserRegisteredEvent,userUpdated:userservice.event.UserUpdatedEvent"
```

> **Tại sao dùng `ErrorHandlingDeserializer`?**
> Nó bọc `JsonDeserializer` lại để khi message không có type header (ví dụ message cũ được produce trước khi bật type header), consumer nhận `null` thay vì bị crash. Listener xử lý `null` bằng cách return sớm, cho phép offset tiến qua message lỗi.

> **Tại sao dùng alias type mapping thay vì tên class đầy đủ?**
> Hai service dùng package khác nhau (`authservice.event.*` vs `userservice.event.*`). Alias ngắn (`userRegistered`, `userUpdated`) được mỗi service resolve độc lập theo mapping của mình, tránh `ClassNotFoundException` ở phía consumer.

### 4.3 Message Header

Mỗi Kafka message do auth-service produce đều mang header:

| Header | Giá trị (register topic) | Giá trị (update topic) |
|---|---|---|
| `__TypeId__` | `userRegistered` | `userUpdated` |

---

## 5. Phân chia trách nhiệm Validation

| Quy tắc | auth-service | user-service | Ghi chú |
|---|---|---|---|
| Định dạng email | ✅ | ❌ | Validate tại REST layer |
| Email duy nhất (đăng ký) | ✅ | ❌ | Kiểm tra trước khi tạo account; email không gửi trong event |
| Username duy nhất | ✅ | ❌ | Kiểm tra trước khi tạo account |
| Định dạng phone (đăng ký) | ✅ | ❌ | Validate tại REST endpoint |
| Phone duy nhất (đăng ký) | ✅ (Feign→user-service) | ✅ (data guard) | Primary: Feign pre-check; Guard: consumer kiểm tra trước save |
| Phone duy nhất (cập nhật) | ❌ | ✅ | user-service kiểm tra trước `updateUser` |
| CCCD — đúng 12 chữ số | ✅ | ❌ | Validate tại REST endpoint |
| CCCD duy nhất (đăng ký) | ✅ (Feign→user-service) | ✅ (data guard) | Primary: Feign pre-check; Guard: consumer kiểm tra trước save |
| OTP hợp lệ | ✅ | ❌ | Redis TTL 5 phút, cooldown 60 giây |
| Idempotency — trùng accountId (đăng ký) | ❌ | ✅ | `existsById(accountId)` trước khi save |
| Profile tồn tại (cập nhật) | ❌ | ✅ | `existsById(accountId)` trước khi update |

---

## 6. Xử lý lỗi

### Producer (auth-service)

| Tình huống | Hành động |
|---|---|
| OTP sai / hết hạn | Throw `INVALID_OTP` / `OTP_EXPIRED`, KHÔNG gửi Kafka message |
| Lưu account thất bại | Transaction rollback, KHÔNG gửi Kafka message |
| Feign gọi user-service thất bại (kiểm tra phone/CCCD) | Log WARN, bỏ qua bước check — tiếp tục luồng OTP |
| Gửi Kafka thất bại | Log error (fire-and-forget — không block HTTP response) |

### Consumer (user-service)

| Tình huống | Hành động |
|---|---|
| Message không có type header (message cũ) | `ErrorHandlingDeserializer` trả `null` → `if (event == null) return` |
| accountId đã tồn tại trong user_db (đăng ký) | Log WARN, bỏ qua (idempotency bình thường) |
| Số điện thoại đã tồn tại (đăng ký) | Log ERROR `[DATA_INCONSISTENCY]`, bỏ qua — cần điều tra thủ công |
| Số CCCD đã tồn tại (đăng ký) | Log ERROR `[DATA_INCONSISTENCY]`, bỏ qua — cần điều tra thủ công |
| accountId không tìm thấy trong user_db (cập nhật) | Log WARN, bỏ qua (profile chưa được tạo) |
| Số điện thoại đã tồn tại (cập nhật) | Throw `PHONE_EXISTED`, exception được log lại |
| Exception không xác định | Log error, throw `RuntimeException` để trigger Kafka retry |

---

## 7. Kafka CLI — Lệnh debug

Chạy từ bên trong Kafka container:

```bash
docker exec -it kafka bash

# Liệt kê tất cả topic
kafka-topics.sh --list --bootstrap-server localhost:9092

# Xem cấu hình topic
kafka-topics.sh --describe --topic user-register-topic --bootstrap-server localhost:9092
kafka-topics.sh --describe --topic user-update-topic --bootstrap-server localhost:9092

# Đọc toàn bộ message từ đầu
kafka-console-consumer.sh --topic user-register-topic --bootstrap-server localhost:9092 --from-beginning
kafka-console-consumer.sh --topic user-update-topic --bootstrap-server localhost:9092 --from-beginning

# Kiểm tra độ trễ của consumer group
kafka-consumer-groups.sh --describe --group user-service-group --bootstrap-server localhost:9092

# Bỏ qua message lỗi bằng cách reset offset về cuối
kafka-consumer-groups.sh --group user-service-group --topic user-update-topic \
  --reset-offsets --to-latest --execute --bootstrap-server localhost:9092
```

---

## 8. Xử lý sự cố

| Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|
| Lỗi consumer: `No type information in headers` | Message cũ trong topic được produce khi chưa bật `__TypeId__` header | `ErrorHandlingDeserializer` xử lý — message bị bỏ qua và offset tiến lên |
| `ClassCastException` ở consumer | `spring.json.use.type.headers: false` khiến mọi message đều bị deserialize về cùng một kiểu mặc định | Bật `use.type.headers: true` và cấu hình `type.mapping` |
| Cập nhật tài khoản không phản ánh xuống user_db | Consumer đang bỏ qua event một cách thầm lặng | Kiểm tra consumer group lag; xem log user-service tìm lỗi deserialization |
| Profile người dùng bị trùng lặp | Thiếu kiểm tra idempotency | `existsById(accountId)` phải được gọi trước mỗi `save()` |
| Log `[DATA_INCONSISTENCY]` xuất hiện trong user-service | `auth_db` có tài khoản có phone/CCCD trùng với profile đã có trong `user_db` | Cần điều tra thủ công — xóa auth account không hoàn chỉnh hoặc resolve profile xung đột |
| Consumer lag liên tục tăng | Consumer chậm hoặc liên tục throw exception | Kiểm tra log user-service tìm `RuntimeException` |
| Admin tạo tài khoản nhưng không có profile | Path B không gọi Feign check — phone/CCCD có thể xung đột | Kiểm tra log consumer user-service; tạo profile bị bỏ qua thầm lặng khi data guard kích hoạt |

---

*Tài liệu này là contract chính thức giữa auth-service và user-service. Mọi thay đổi về cấu trúc message hoặc cấu hình Kafka phải được cập nhật tại đây và thông báo cho toàn bộ team.*
