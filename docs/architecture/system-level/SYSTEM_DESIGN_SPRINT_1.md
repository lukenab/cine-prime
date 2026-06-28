# Tài liệu Thiết kế Hệ thống — CinePrime

**Dự án:** Hệ thống Quản lý Rạp Chiếu Phim (CinePrime)
**Trạng thái:** Tài liệu sống — cập nhật liên tục theo từng sprint

| Phiên bản | Ngày | Người cập nhật | Nội dung thay đổi |
|---|---|---|---|
| v1.0 | 02/06/2026 | Nguyễn An Bình | Khởi tạo tài liệu — kiến trúc Sprint 1 |
| v2.0 | 25/06/2026 | Nguyễn An Bình | Cập nhật toàn diện: tách auth-service, JWT whitelist, Kafka thực tế, refactor movie-service, thêm các service mới |

---

## 1. Tổng quan và Mục tiêu

**Mục đích & Phạm vi:**
Hệ thống số hóa toàn bộ quy trình vận hành rạp chiếu phim — từ quản lý danh mục phim, lịch chiếu, đặt vé, thanh toán đến quản lý thành viên và khuyến mãi. Tài liệu này mô tả kiến trúc tổng thể của toàn bộ dự án và được cập nhật sau mỗi sprint.

**Đối tượng người dùng:**

| Vai trò | Mô tả |
|---|---|
| **ADMIN** | Toàn quyền — quản lý nhân viên, phim, phòng chiếu, thống kê doanh thu |
| **EMPLOYEE** | Bán vé tại quầy, tra cứu thành viên, quản lý đặt chỗ và khuyến mãi |
| **MEMBER** | Khách hàng đăng ký — đặt vé online, xem lịch sử, tích lũy điểm |
| **USER** | Khách vãng lai — xem danh sách phim, lịch chiếu và khuyến mãi |

**Vấn đề giải quyết:**
Chuyển đổi từ vận hành thủ công sang nền tảng microservices có khả năng mở rộng độc lập từng domain, xử lý đồng thời cao và tách biệt rõ ràng giữa các nghiệp vụ.

---

## 2. Kiến trúc Hệ thống

**Phong cách kiến trúc:** Microservices — mỗi service sở hữu domain riêng, database riêng, triển khai và scale độc lập.

### 2.1 Bản đồ Services

| Service | Công nghệ | Port | Trạng thái | Mô tả |
|---|---|---|---|---|
| **api-gateway** | Spring Cloud Gateway | 8080 | ✅ Hoạt động | Điểm vào duy nhất, định tuyến, CORS |
| **discovery-server** | Eureka Server | 8761 | ✅ Hoạt động | Registry nội bộ cho service discovery |
| **auth-service** | Spring Boot | 8088 | ✅ Hoạt động | Xác thực, JWT whitelist, OTP, RBAC |
| **user-service** | Spring Boot | 8084 | ✅ Hoạt động | Profile người dùng, audit log |
| **movie-service** | Spring Boot | 8081 | ✅ Hoạt động | Phim, lịch chiếu, phòng chiếu, loại phim |
| **booking-service** | Spring Boot | 8082 | 🔧 Đang phát triển | Đặt vé, quản lý vé |
| **notification-service** | Spring Boot | 8087 | 🔧 Đang phát triển | Gửi thông báo email/push |
| **payment-service** | Spring Boot | — | 📋 Kế hoạch | Xử lý thanh toán |
| **promotion-service** | Spring Boot | — | 📋 Kế hoạch | Quản lý khuyến mãi, mã giảm giá |
| **Frontend** | React + Vite + TypeScript | 3000 | ✅ Hoạt động | SPA cho Admin Dashboard và Customer Portal |

**Hạ tầng dùng chung:**

| Thành phần | Công nghệ | Port | Mô tả |
|---|---|---|---|
| Message Broker | Apache Kafka (KRaft) | 9092 | Giao tiếp bất đồng bộ giữa các service |
| Cache / OTP Store | Redis | 6379 | OTP (TTL 5 phút), cooldown OTP (TTL 60 giây) |
| Database | PostgreSQL 16 | 5433 | Một instance, nhiều database riêng biệt theo service |
| Image Storage | Cloudinary | — | Poster và ảnh phim từ movie-service |

**Môi trường triển khai:** Containerized bằng Docker và `docker-compose` phục vụ development local.

---

## 3. Đặc tả Chức năng

### 3.1 Xác thực & Quản lý Tài khoản (auth-service) ✅

**Đăng ký 2 bước qua OTP:**
1. `POST /api/auth/register/initiate` — kiểm tra username/email (auth_db) + phone/CCCD (Feign→user-service), sinh OTP, lưu Redis (TTL 5 phút, cooldown 60 giây), gửi email.
2. `POST /api/auth/register/verify` — xác thực OTP, tạo Account, publish `UserRegisteredEvent` lên Kafka, user-service tạo profile bất đồng bộ.

**Đăng nhập & Token:**
- `POST /api/auth/login` — kiểm tra credentials, kiểm tra `account.status = 1`, cập nhật `last_login_at`, trả JWT, lưu vào `auth_token` (whitelist).
- `POST /api/auth/logout` — đánh dấu token là `is_revoked = true`.
- `POST /api/auth/refresh` — token rotation: thu hồi token cũ, cấp token mới.
- `POST /api/auth/introspect` — kiểm tra token có hợp lệ (dùng nội bộ).
- `GET /api/auth/check` — kiểm tra username/email có trùng không (real-time validation form đăng ký).

**Quản lý tài khoản (Admin):**
- `GET/POST /api/accounts`, `GET/PUT /api/accounts/{id}` — CRUD tài khoản.
- `POST/GET/DELETE /api/permissions` — quản lý quyền.
- `POST/GET /api/roles` — quản lý vai trò.

### 3.2 Quản lý Profile (user-service) ✅

- Nhận `UserRegisteredEvent` từ Kafka để tạo profile bất đồng bộ (có 3 idempotency guards).
- Nhận `UserUpdatedEvent` từ Kafka khi admin cập nhật tài khoản.
- `GET /api/users/check-existence` — Feign endpoint cho auth-service kiểm tra phone/CCCD.
- `GET/PUT/DELETE /api/users/{id}`, `GET /api/users` — CRUD profile.

### 3.3 Quản lý Phim (movie-service) ✅

- **Phim:** CRUD danh mục, upload poster lên Cloudinary — `POST/GET /api/movies`.
- **Lịch chiếu:** Tạo lịch với validation giờ chiếu (08:00–23:00), tối thiểu 3 ngày trước, kiểm tra trùng lịch.
- **Phòng chiếu:** CRUD phòng, tự động sinh ghế — `POST/GET /api/cinema-rooms`.
- **Loại phim:** CRUD thể loại — `POST/GET /api/movie-type`.

### 3.4 Đặt vé (booking-service) 🔧

Đang phát triển.

### 3.5 Thông báo (notification-service) 🔧

Đang phát triển. Hiện tại: auth-service tự gửi OTP email trực tiếp qua SMTP.

### 3.6 Thanh toán (payment-service) 📋

Kế hoạch sprint tiếp theo.

### 3.7 Khuyến mãi (promotion-service) 📋

Kế hoạch sprint tiếp theo.

---

## 4. Yêu cầu Phi chức năng

**Hiệu năng:**
- Services giao tiếp qua mạng Docker nội bộ (load-balanced qua Eureka).
- Redis xử lý OTP với TTL tự động, không cần job cleanup.
- `saveAll()` thay vì `save()` trong vòng lặp để giảm round-trip DB.
- Phân trang (`PageRequest`) cho các endpoint trả danh sách lớn.

**Độ tin cậy:**
- Kafka KRaft mode đảm bảo event không mất kể cả khi consumer tạm ngắt kết nối.
- Consumer idempotency: kiểm tra `existsById`, `existsByPhoneNumber`, `existsByIdentityCard` trước mỗi lần save.
- `@Transactional` trên các operation quan trọng đảm bảo tính nguyên tử (tạo phim, tạo tài khoản, xác thực).
- `ErrorHandlingDeserializer` bảo vệ consumer khỏi poison messages.

**Bảo mật:**
- JWT whitelist — token không có trong `auth_token` hoặc `is_revoked = true` đều bị từ chối ngay cả khi signature còn hợp lệ.
- OTP sinh bằng `SecureRandom` (không dùng `java.util.Random`).
- Password hash bằng BCrypt.
- CORS chỉ cho phép `http://localhost:3000`.

**Khả năng mở rộng:**
- Mỗi service có thể scale ngang độc lập qua Eureka load balancing.
- Thêm service mới không ảnh hưởng service hiện có.
- Kafka consumer group dễ dàng thêm consumer mới cùng topic.

---

## 5. Thiết kế Dữ liệu

Áp dụng **Polyglot Persistence** — mỗi service có database riêng trong cùng một PostgreSQL instance (port 5433).

### 5.1 auth_db (auth-service)

**Bảng `account`:**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| account_id | VARCHAR(36) | PK, UUID | ID tài khoản |
| username | VARCHAR(50) | NOT NULL, UNIQUE | Tên đăng nhập |
| email | VARCHAR(100) | NOT NULL, UNIQUE | Email (credential — không đồng bộ sang user-service) |
| password_hash | VARCHAR(255) | NOT NULL | BCrypt hash |
| status | INTEGER | DEFAULT 1 | 1 = active, khác = bị vô hiệu hoá |
| last_login_at | TIMESTAMP | nullable | Lần đăng nhập gần nhất |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Ngày tạo |
| updated_at | TIMESTAMP | nullable | Ngày cập nhật |

**Bảng `auth_token` (JWT whitelist):**

| Cột | Kiểu | Mô tả |
|---|---|---|
| jwt_id | VARCHAR | PK — JWT ID (jti claim) |
| account_id | VARCHAR(36) | FK → account |
| is_revoked | BOOLEAN | false = active, true = đã thu hồi |
| revoked_at | TIMESTAMP | Thời điểm thu hồi |

**Các bảng hỗ trợ:** `roles`, `permission`, `account_role`, `role_permissions`.

### 5.2 user_db (user-service)

**Bảng `users`:**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| account_id | VARCHAR(36) | PK | Đồng bộ với `auth_db.account.account_id` |
| full_name | VARCHAR(100) | NOT NULL | Họ tên |
| phone_number | VARCHAR(15) | UNIQUE | Số điện thoại |
| date_of_birth | DATE | nullable | Ngày sinh |
| gender | VARCHAR(20) | nullable | MALE / FEMALE / OTHER |
| address | VARCHAR(255) | nullable | Địa chỉ |
| identity_card | VARCHAR(20) | UNIQUE | Số CCCD |
| avatar_url | VARCHAR(255) | nullable | URL ảnh đại diện |
| is_active | BOOLEAN | NOT NULL | Soft delete flag |
| created_at | TIMESTAMP | — | Tự động |
| updated_at | TIMESTAMP | — | Tự động |

### 5.3 movie_db (movie-service)

Gồm: `movie`, `show_time`, `cinema_room`, `seat`, `movie_type`, `movie_action_log`.

### 5.4 booking_db (booking-service)

🔧 Đang thiết kế.

---

## 6. API Gateway & Định tuyến

API Gateway tại port **8080**:

| Route Path | Service | Port | Mô tả |
|---|---|---|---|
| `/api/auth/**` | auth-service | 8088 | Đăng ký, đăng nhập, token |
| `/api/accounts/**` | auth-service | 8088 | Quản lý tài khoản |
| `/api/permissions/**` | auth-service | 8088 | Quản lý quyền |
| `/api/roles/**` | auth-service | 8088 | Quản lý vai trò |
| `/api/users/**` | user-service | 8084 | Profile người dùng |
| `/api/movies/**` | movie-service | 8081 | Danh mục phim |
| `/api/cinema-rooms/**` | movie-service | 8081 | Phòng chiếu |
| `/api/movie-type/**` | movie-service | 8081 | Loại phim |
| `/api/bookings/**` | booking-service | 8082 | Đặt vé |
| `/api/tickets/**` | booking-service | 8082 | Quản lý vé |

---

## 7. Bảo mật & Kiểm soát Truy cập

**Xác thực:** Stateless JWT (HS512). `valid-duration`: 1800s, `refreshable-duration`: 36000s.

**Mô hình whitelist:** Token hợp lệ khi đồng thời thỏa mãn 3 điều kiện: (1) signature đúng, (2) chưa hết hạn, (3) tồn tại trong `auth_token` với `is_revoked = false`.

**Endpoint không cần xác thực (permitAll):**

| Endpoint | Lý do |
|---|---|
| `POST /api/auth/login` | Điểm vào đăng nhập |
| `POST /api/auth/register/**` | Luồng đăng ký |
| `POST /api/auth/resend-otp` | Gửi lại OTP |
| `POST /api/auth/introspect` | Gateway dùng để validate token |
| `POST /api/auth/refresh` | Không cần auth header, dùng token trong body |
| `GET /api/auth/check` | Real-time check form đăng ký |
| `GET /api/users/check-existence` | Feign internal call từ auth-service |

---

## 8. Giao tiếp giữa các Service

### 8.1 Kafka (Bất đồng bộ)

| Topic | Producer | Consumer | Trigger |
|---|---|---|---|
| `user-register-topic` | auth-service | user-service | Tạo tài khoản mới (OTP hoặc admin direct) |
| `user-update-topic` | auth-service | user-service | Admin cập nhật thông tin tài khoản |

Chi tiết: [kafka-user-service-contract.md](../kafka/kafka-user-service-contract.md)

### 8.2 Feign Client (Đồng bộ)

| Caller | Callee | Endpoint | Mục đích |
|---|---|---|---|
| auth-service | user-service | `GET /api/users/check-existence` | Kiểm tra phone/CCCD trùng trước đăng ký |

Nếu user-service không khả dụng → log WARN, bỏ qua check, không block luồng đăng ký.

---

## 9. Chiến lược Kiểm thử

**Kiểm thử API:** Postman — payload JSON, HTTP status codes, error codes chuẩn hóa.

**Kiểm thử tích hợp:** Luồng đăng ký đầu-cuối (REST → Kafka → profile), kiểm tra consumer group lag.

**Xử lý lỗi:** Mọi response đều wrap trong `ApiResponse { code, message, result }`. Frontend parse `code` để hiển thị thông báo đúng.

---

## 10. Triển khai & DevOps

**Quản lý mã nguồn:** GitLab, Feature Branch Workflow (`feature/#<id>-<name>`).

**Bảo vệ nhánh:** Không push trực tiếp vào `develop` và `main`. Mọi thay đổi qua Merge Request, phải được review và approve.

**Khởi động local:**
```bash
# Khởi động toàn bộ infrastructure (Kafka, Redis, PostgreSQL)
docker compose up -d

# Thứ tự khởi động services
# 1. discovery-server  :8761
# 2. auth-service      :8088
# 3. user-service      :8084
# 4. movie-service     :8081
# 5. api-gateway       :8080
# 6. Frontend          npm run dev  →  :3000
```

**JPA DDL config hiện tại:**

| Service | ddl-auto |
|---|---|
| auth-service | update |
| user-service | update |
| movie-service | create |
| booking-service | create |

---

## 11. Roadmap

| Tính năng | Sprint | Trạng thái |
|---|---|---|
| auth-service — OTP đăng ký, JWT whitelist, RBAC | Sprint 1 | ✅ Hoàn thành |
| user-service — profile, Kafka consumer, audit log | Sprint 1 | ✅ Hoàn thành |
| movie-service — phim, lịch chiếu, phòng chiếu | Sprint 1 | ✅ Hoàn thành |
| booking-service — đặt vé, chọn ghế | Sprint 2 | 🔧 Đang phát triển |
| notification-service — email đặt vé, nhắc lịch | Sprint 2 | 🔧 Đang phát triển |
| payment-service — tích hợp cổng thanh toán | Sprint 3 | 📋 Kế hoạch |
| promotion-service — mã giảm giá, khuyến mãi | Sprint 3 | 📋 Kế hoạch |

---

## 12. Tài liệu tham khảo

- **API Contract (auth-service):** [`docs/api-specs/auth-service/API_CONTRACT.md`](../../api-specs/auth-service/API_CONTRACT.md)
- **OpenAPI Spec:** [`docs/api-specs/auth-service/auth-service.yaml`](../../api-specs/auth-service/auth-service.yaml)
- **Kafka Contract:** [`docs/architecture/kafka/kafka-user-service-contract.md`](../kafka/kafka-user-service-contract.md)
- **Infrastructure:** `docker-compose.yml` tại thư mục gốc.
- **Database ERD:** GitLab issue `#16` và project wiki.
- **Quy ước commit & branch:** `CONTRIBUTING.md`.
