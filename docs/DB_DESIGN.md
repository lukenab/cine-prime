# Database Design Document

**Dự án:** CinePrime  
**Phiên bản:** 1.0  
**Năm:** 2026

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [auth_db](#2-auth_db)
   - [account](#21-bảng-account)
   - [roles](#22-bảng-roles)
   - [permission](#23-bảng-permission)
   - [account_role & role_permissions](#24-bảng-account_role--role_permissions)
   - [auth_token](#25-bảng-auth_token)
   - [auth_audit_log](#26-bảng-auth_audit_log)
   - [password_reset](#27-bảng-password_reset)
3. [user_db](#3-user_db)
   - [users](#31-bảng-users)
   - [member](#32-bảng-member)
   - [employee](#33-bảng-employee)
   - [audit_logs](#34-bảng-audit_logs)
4. [Quyết định thiết kế quan trọng](#4-quyết-định-thiết-kế-quan-trọng)
5. [Các flow chính liên quan đến DB](#5-các-flow-chính-liên-quan-đến-db)

---

## 1. Tổng quan kiến trúc

CinePrime sử dụng **2 database độc lập** theo nguyên tắc *Database per Service* của microservices:

| Database | Service | Mục đích |
|---|---|---|
| `auth_db` | auth-service | Xác thực: tài khoản, phân quyền, JWT, audit log, password reset |
| `user_db` | user-service | Hồ sơ: thông tin cá nhân, thành viên tích điểm, nhân viên |

> **Quan trọng:** Hai database **không kết nối trực tiếp qua FK**. Đồng bộ dữ liệu qua **Kafka events** (Transactional Outbox Pattern).

### 1.1 Quan hệ giữa các bảng — auth_db

```
permission  <──(N:M)──  roles          (bảng trung gian: role_permissions)
roles       <──(N:M)──  account        (bảng trung gian: account_role)
account     ──(1:N)──►  auth_token
account     ──(1:N)──►  auth_audit_log
account     ──(1:N)──►  password_reset
```

### 1.2 Quan hệ giữa các bảng — user_db

```
users  ──(1:1)──►  member    (1 user là 1 thành viên)
users  ──(1:1)──►  employee  (1 user là 1 nhân viên)
```

---

## 2. auth_db

### 2.1 Bảng `account`

**Entity:** `Account.java`  
**Mục đích:** Bảng trung tâm của auth-service. Lưu thông tin đăng nhập, trạng thái tài khoản và bảo vệ brute-force.

> Không lưu thông tin cá nhân (tên, SĐT...) — phần đó thuộc `user_db.users`.

| Field | Type | Nullable | Constraint | Mô tả / Lý do thiết kế |
|---|---|---|---|---|
| `account_id` | `VARCHAR(36)` | NOT NULL | PK | UUID tự sinh. `updatable = false` — không bao giờ thay đổi sau khi tạo |
| `username` | `VARCHAR(50)` | NOT NULL | UNIQUE | Tên đăng nhập. Check unique trước khi INSERT |
| `email` | `VARCHAR(100)` | NOT NULL | UNIQUE | Email. Sync sang `user_db` qua Kafka sau khi đăng ký |
| `password_hash` | `VARCHAR(255)` | NOT NULL | | BCrypt hash. Tuyệt đối không lưu plain text |
| `status` | `VARCHAR(30)` | NOT NULL | DEFAULT `'PENDING'` | `PENDING` \| `ACTIVE` \| `INACTIVE`. PENDING cho đến khi verify OTP |
| `failed_login_attempts` | `INT` | NOT NULL | DEFAULT `0` | Số lần sai liên tiếp. Reset về 0 khi login thành công |
| `locked_until` | `TIMESTAMP` | NULL | | Khóa tài khoản đến thời điểm này. `NULL` = không khóa |
| `email_verified_at` | `TIMESTAMP` | NULL | | Thời điểm verify OTP thành công. `NULL` = chưa verify |
| `last_login_at` | `TIMESTAMP` | NULL | | Thời điểm login gần nhất |
| `created_at` | `TIMESTAMP` | NOT NULL | DEFAULT `NOW()` | `@CreationTimestamp`. `updatable = false` |
| `updated_at` | `TIMESTAMP` | NULL | | `@UpdateTimestamp` |

**Lưu ý thiết kế:**
- `VARCHAR(30)` cho `status` để dự phòng thêm giá trị dài hơn (vd: `PENDING_EMAIL_VERIFICATION`).
- `failed_login_attempts` + `locked_until`: sau **5 lần sai liên tiếp**, khóa **15 phút**.
- `@Builder.Default` bắt buộc cho `status = PENDING` và `failedLoginAttempts = 0` khi dùng Lombok `@Builder`.

---

### 2.2 Bảng `roles`

**Entity:** `Role.java`  
**Mục đích:** Định nghĩa các vai trò trong hệ thống.

| Field | Type | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `role_name` | `VARCHAR(50)` | NOT NULL | PK | Tên role: `USER` \| `EMPLOYEE` \| `ADMIN` |
| `description` | `VARCHAR(255)` | NULL | | Mô tả ngắn về vai trò |

> Dùng **String PK** thay vì numeric ID để join table dễ đọc hơn khi query trực tiếp DB.

---

### 2.3 Bảng `permission`

**Entity:** `Permission.java`  
**Mục đích:** Danh sách quyền chi tiết. Gắn với role qua bảng `role_permissions`.

| Field | Type | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `name` | `VARCHAR(100)` | NOT NULL | PK | Tên quyền: `READ_MOVIE` \| `MANAGE_BOOKING` \| `MANAGE_SHOWTIME` \| ... |
| `description` | `VARCHAR(255)` | NULL | | Mô tả quyền |

---

### 2.4 Bảng `account_role` & `role_permissions`

**Mục đích:** Bảng trung gian thực hiện quan hệ nhiều-nhiều.

**account_role:**

| Field | Type | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `account_id` | `VARCHAR(36)` | NOT NULL | PK, FK → `account` | `ON DELETE CASCADE` |
| `role_name` | `VARCHAR(50)` | NOT NULL | PK, FK → `roles` | `ON DELETE CASCADE` |

**role_permissions:**

| Field | Type | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `role_name` | `VARCHAR(50)` | NOT NULL | PK, FK → `roles` | `ON DELETE CASCADE` |
| `permission_name` | `VARCHAR(100)` | NOT NULL | PK, FK → `permission` | `ON DELETE CASCADE` |

---

### 2.5 Bảng `auth_token`

**Entity:** `AuthToken.java`  
**Mục đích:** Blacklist JWT để hỗ trợ logout. Giải quyết vấn đề JWT stateless: token bị thu hồi vẫn có chữ ký hợp lệ đến khi hết hạn.

> Chỉ lưu `jwt_id` (jti claim), **KHÔNG lưu full token string** — an toàn hơn khi DB bị leak.

| Field | Type | Nullable | Constraint | Mô tả / Lý do thiết kế |
|---|---|---|---|---|
| `token_id` | `BIGSERIAL` | NOT NULL | PK | Auto-increment Long. Không expose ra ngoài. BIGSERIAL nhanh hơn UUID cho append-only table |
| `account_id` | `VARCHAR(36)` | NOT NULL | FK → `account` | `FetchType.LAZY` — tránh load account mỗi lần check token |
| `jwt_id` | `VARCHAR(100)` | NOT NULL | UNIQUE | `jti` claim trong JWT payload. Dùng để blacklist khi logout |
| `token_type` | `VARCHAR(20)` | NOT NULL | DEFAULT `'BEARER'` | Loại token |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | | `OffsetDateTime` — timezone-aware vì đây là mốc thời gian tuyệt đối |
| `issued_at` | `TIMESTAMPTZ` | NOT NULL | | `OffsetDateTime` — thời điểm cấp token |
| `revoked_at` | `TIMESTAMPTZ` | NULL | | Thời điểm logout. `NULL` = vẫn còn hiệu lực |
| `is_revoked` | `BOOLEAN` | NOT NULL | DEFAULT `false` | Flag blacklist. Redis check trước O(1), DB là fallback |
| `created_ip` | `INET` | NULL | | IP tạo token. Cần `@ColumnTransformer(write = "?::inet")` |
| `user_agent` | `VARCHAR(255)` | NULL | | Browser/device info. Phát hiện anomaly login |
| `created_at` | `TIMESTAMP` | NOT NULL | | `@CreationTimestamp`. `updatable = false` |

**Validate flow:**
```
Request → check Redis "blacklist:{jti}" O(1)
        → nếu miss: check DB is_revoked
        → 99% request hợp lệ không hit DB
```

> **Cleanup job** chạy hàng đêm: `DELETE FROM auth_token WHERE expires_at < NOW()`

---

### 2.6 Bảng `auth_audit_log`

**Entity:** `AuthAuditLog.java`  
**Mục đích:** Nhật ký bảo mật bất biến. Ghi lại mọi sự kiện xác thực. **Không bao giờ UPDATE/DELETE** trong flow bình thường.

| Field | Type | Nullable | Constraint | Mô tả / Lý do thiết kế |
|---|---|---|---|---|
| `audit_id` | `VARCHAR(36)` | NOT NULL | PK | UUID — dùng UUID (không phải BIGSERIAL) vì log có thể sync sang hệ thống khác |
| `actor_account_id` | `VARCHAR(36)` | NULL | | Người thực hiện. `NULL` = anonymous (chưa login) |
| `target_account_id` | `VARCHAR(36)` | NULL | | Người bị tác động. Khác `actor` khi admin thao tác lên user khác |
| `action` | `VARCHAR(100)` | NOT NULL | | `LOGIN` \| `LOGOUT` \| `REGISTER` \| `OTP_SENT` \| `ACCOUNT_LOCKED` \| ... |
| `status` | `VARCHAR(20)` | NOT NULL | | `SUCCESS` \| `FAILED` |
| `message` | `TEXT` | NULL | | Mô tả cho con người đọc khi điều tra |
| `ip_address` | `VARCHAR(45)` | NULL | | `VARCHAR(45)` chứa được IPv6 (tối đa 39 ký tự). Không dùng `inet` vì chỉ cần lưu để đọc |
| `user_agent` | `TEXT` | NULL | | `TEXT` vì độ dài không đoán trước |
| `metadata` | `TEXT` | NULL | | JSON string chứa dữ liệu thêm tùy loại event |
| `created_at` | `TIMESTAMP` | NOT NULL | | `updatable = false`. Immutable sau khi ghi |

**Lưu ý thiết kế:**
- **Không dùng FK** tới `account` — log phải tồn tại độc lập ngay cả khi account bị xóa.
- `action` và `status` là `String` (không phải Java enum) để thêm giá trị mới mà không cần DB migration.

---

### 2.7 Bảng `password_reset`

**Entity:** `PasswordReset.java`  
**Mục đích:** Lưu yêu cầu đặt lại mật khẩu. Mỗi record là 1 secret token gửi qua email, có thời hạn sử dụng.

| Field | Type | Nullable | Constraint | Mô tả / Lý do thiết kế |
|---|---|---|---|---|
| `reset_id` | `BIGSERIAL` | NOT NULL | PK | Auto-increment. Không expose ra ngoài |
| `account_id` | `VARCHAR(36)` | NOT NULL | FK → `account` | `ON DELETE CASCADE` |
| `token` | `VARCHAR(255)` | NOT NULL | UNIQUE | Secret 64-char hex (`SecureRandom`). Gửi trong link email |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | | `OffsetDateTime`. Thường hết hạn sau **15 phút** |
| `used_at` | `TIMESTAMPTZ` | NULL | | Thời điểm dùng. `NULL` = chưa dùng |
| `is_used` | `BOOLEAN` | NOT NULL | DEFAULT `false` | `@Builder.Default` tránh null. Sau khi dùng: UPDATE `is_used=true`, `used_at=NOW()` |
| `created_ip` | `INET` | NULL | | `@ColumnTransformer(write = "?::inet")` — bắt buộc khi PostgreSQL cast VARCHAR→inet |
| `created_at` | `TIMESTAMP` | NOT NULL | | `@CreationTimestamp`. `updatable = false` |

**Lưu ý thiết kế:**
- Không xóa ngay sau khi dùng — giữ audit trail để xử lý tranh chấp.
- **Cleanup job** sau 7 ngày: `DELETE FROM password_reset WHERE created_at < NOW() - INTERVAL '7 days'`

---

## 3. user_db

### 3.1 Bảng `users`

**Entity:** `User.java`  
**Mục đích:** Hồ sơ người dùng. PK là `account_id` — cùng giá trị với `auth_db.account.account_id`, **không có DB FK** vì cross-database.

> `full_name` cho phép NULL vì profile được tạo từ Kafka event ngay sau đăng ký (lúc đó chưa có thông tin cá nhân).  
> Bắt buộc nhập `full_name` + `phone_number` trước khi được phép đặt vé (enforced ở application layer).

| Field | Type | Nullable | Constraint | Mô tả / Lý do thiết kế |
|---|---|---|---|---|
| `account_id` | `VARCHAR(36)` | NOT NULL | PK | Không `@GeneratedValue` — set thủ công từ Kafka event |
| `full_name` | `VARCHAR(100)` | NULL | | NULL khi mới tạo skeleton. Bắt buộc trước khi đặt vé |
| `email` | `VARCHAR(100)` | NULL | | Duplicate từ `auth_db`. Tránh cross-service call. Sync qua Kafka |
| `phone_number` | `VARCHAR(15)` | NULL | UNIQUE | UNIQUE ở DB level. Nhân viên tra cứu tại quầy |
| `date_of_birth` | `DATE` | NULL | | Ngày sinh. Kiểu `DATE` không cần thời gian |
| `gender` | `VARCHAR(20)` | NULL | | `MALE` \| `FEMALE` \| `OTHER` |
| `address` | `VARCHAR(255)` | NULL | | Địa chỉ |
| `identity_card` | `VARCHAR(20)` | NULL | UNIQUE | CCCD/CMND. UNIQUE ở DB level. Để redeem điểm và xác minh tại quầy |
| `avatar_url` | `VARCHAR(255)` | NULL | | URL ảnh đại diện |
| `is_active` | `BOOLEAN` | NOT NULL | DEFAULT `true` | Soft delete — không xóa vật lý |
| `created_at` | `TIMESTAMP` | NOT NULL | | `@CreationTimestamp`. `updatable = false` |
| `updated_at` | `TIMESTAMP` | NULL | | `@UpdateTimestamp` |

> Email duplicate giữa 2 DB là chấp nhận được trong microservices — eventual consistency qua Kafka.

---

### 3.2 Bảng `member`

**Entity:** `Member.java`  
**Mục đích:** Thông tin thành viên tích điểm. Quan hệ 1:1 với `users`. Tạo tự động khi user hoàn tất profile.

| Field | Type | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `member_id` | `VARCHAR(36)` | NOT NULL | PK | UUID tự sinh |
| `account_id` | `VARCHAR(36)` | NOT NULL | FK → `users`, UNIQUE | UNIQUE — đảm bảo 1 user chỉ có 1 member record |
| `loyalty_points` | `INT` | NOT NULL | DEFAULT `0` | Điểm tích lũy hiện tại |
| `membership_level` | `VARCHAR(20)` | NOT NULL | DEFAULT `'BRONZE'` | `BRONZE` \| `SILVER` \| `GOLD` \| `PLATINUM`. Tính từ `total_spent` |
| `total_spent` | `DECIMAL(12,2)` | NOT NULL | DEFAULT `0` | Tổng tiền đã chi. Cập nhật sau mỗi giao dịch |
| `created_at` | `TIMESTAMP` | NOT NULL | | `@CreationTimestamp` |
| `updated_at` | `TIMESTAMP` | NULL | | `@UpdateTimestamp` |

> `membership_level` nên là `@Enumerated(EnumType.STRING)` trong Java: `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`.

---

### 3.3 Bảng `employee`

**Entity:** `Employee.java`  
**Mục đích:** Thông tin nhân viên rạp. Quan hệ 1:1 với `users`. Chỉ tồn tại khi account có role `EMPLOYEE`.

| Field | Type | Nullable | Constraint | Mô tả / Lý do thiết kế |
|---|---|---|---|---|
| `employee_id` | `VARCHAR(36)` | NOT NULL | PK | UUID. Set khi Admin tạo nhân viên |
| `employee_code` | `VARCHAR(20)` | NOT NULL | UNIQUE | Mã nhân viên nội bộ: `EMP001`, `EMP002`... |
| `account_id` | `VARCHAR(36)` | NOT NULL | FK → `users`, UNIQUE | UNIQUE — 1 user chỉ là 1 nhân viên |
| `cinema_id` | `VARCHAR(36)` | NULL | | Rạp phụ trách. FK logic sang movie-service (không có DB FK) |
| `position` | `VARCHAR(50)` | NULL | | `STAFF` \| `SUPERVISOR` \| `MANAGER` |
| `department` | `VARCHAR(30)` | NULL | | `BOX_OFFICE` \| `CONCESSION` \| `FLOOR` \| `PROJECTION` \| `MANAGEMENT` |
| `employment_type` | `VARCHAR(30)` | NULL | | `FULL_TIME` \| `PART_TIME` \| `PROBATION` \| `INTERN` \| `CONTRACT` |
| `hire_date` | `DATE` | NULL | | Ngày vào làm |
| `status` | `VARCHAR(20)` | NOT NULL | DEFAULT `'ACTIVE'` | `ACTIVE` \| `DISABLED`. Soft delete |
| `created_at` | `TIMESTAMP` | NOT NULL | | `@CreationTimestamp` |
| `updated_at` | `TIMESTAMP` | NULL | | `@UpdateTimestamp` |

**Lưu ý thiết kế:**
- `cinema_id` là cross-service reference — kết nối bằng application logic, không phải DB FK.
- Soft delete: set `status = DISABLED` thay vì xóa vật lý để giữ lịch sử.

---

### 3.4 Bảng `audit_logs`

**Entity:** `AuditLog.java`  
**Mục đích:** Lịch sử thay đổi dữ liệu trong user-service. Track ai thay đổi gì, lúc nào.

| Field | Type | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `VARCHAR(36)` | NOT NULL | PK | UUID tự sinh |
| `entity_name` | `VARCHAR(255)` | NULL | | Tên bảng bị thay đổi: `users` \| `member` \| `employee` |
| `entity_id` | `VARCHAR(255)` | NULL | | ID của record bị thay đổi |
| `action` | `VARCHAR(255)` | NULL | | `CREATE` \| `UPDATE` \| `DELETE` |
| `old_value` | `TEXT` | NULL | | Giá trị cũ (JSON string). NULL khi CREATE |
| `new_value` | `TEXT` | NULL | | Giá trị mới (JSON string). NULL khi DELETE |
| `perform_by` | `VARCHAR(255)` | NULL | | `account_id` người thực hiện |
| `perform_at` | `TIMESTAMP` | NULL | | Thời điểm thực hiện |

---

## 4. Quyết định thiết kế quan trọng

### `FetchType.LAZY` cho tất cả quan hệ (`@ManyToOne`, `@ManyToMany`)

Tránh N+1 query. Roles/permissions chỉ được load khi code gọi getter. `FetchType.EAGER` tự động JOIN mỗi lần load entity dù không cần — rất chậm khi account có nhiều roles.

### Chỉ lưu `jwt_id`, KHÔNG lưu full JWT token

Full token string dài 500–1000 ký tự và vô dụng nếu không có secret key. Nếu DB bị leak, kẻ tấn công không thể dùng `jwt_id` để xác thực — chỉ auth-service mới có thể verify.

### `OffsetDateTime` cho `expires_at`, `issued_at`, `revoked_at`, `used_at`

Đây là các mốc thời gian tuyệt đối cần timezone-aware. `LocalDateTime` có thể sai khi server đổi timezone (UTC → UTC+7). `OffsetDateTime` lưu thông tin offset nên so sánh chính xác dù server ở đâu.

### `EnumType.STRING` thay vì `EnumType.ORDINAL`

`ORDINAL` lưu số thứ tự (0, 1, 2): thêm giá trị vào giữa enum làm toàn bộ data cũ bị sai nghĩa. `STRING` lưu tên `"PENDING"`, `"ACTIVE"` — an toàn khi refactor enum.

### `@Builder.Default` cho field có giá trị mặc định

Lombok `@Builder` không sử dụng giá trị mặc định khai báo ở field (`= AccountStatus.PENDING`). Không có `@Builder.Default`, `status` sẽ là `null` khi dùng `Account.builder().build()`. Lỗi này rất khó debug vì không có compile error.

### Không dùng FK cross-database

`auth_db` và `user_db` là 2 PostgreSQL instance riêng biệt, không thể có DB FK. Đồng bộ qua Kafka events: đăng ký thành công → Kafka → user-service tạo `users` record. Nếu Kafka fail: **Transactional Outbox Pattern** đảm bảo eventually consistent.

### UUID cho `account_id`/`audit_id`; BIGSERIAL cho `token_id`/`reset_id`

UUID cho PK expose ra ngoài hoặc cần phân tán. BIGSERIAL cho bảng append-only nội bộ: insert nhanh hơn, index B-tree gọn hơn.

### `@ColumnTransformer(write = "?::inet")` cho `created_ip`

PostgreSQL không tự động cast `VARCHAR` sang `inet` khi INSERT. Không có annotation này, Hibernate gửi `"192.168.1.1"` (String) và PostgreSQL báo lỗi type mismatch.

---

## 5. Các flow chính liên quan đến DB

### 5.1 Đăng ký (Registration)

```
1. POST /api/auth/register { username, email, password }
2. Check UNIQUE: username, email trong auth_db (cùng 1 DB → 1 query, an toàn)
3. BCrypt hash password
4. INSERT account (status=PENDING, failed_login_attempts=0)
5. Tạo OTP, lưu vào Redis với TTL 5 phút (KHÔNG lưu DB)
6. Gửi email OTP
7. Kafka event "account.created" → user-service INSERT users (skeleton, full_name=NULL)
8. POST /api/auth/verify-otp { email, otp }
   → Redis check → UPDATE account SET status=ACTIVE, email_verified_at=NOW()
```

### 5.2 Đăng nhập (Login)

```
1. POST /api/auth/login { username, password }
2. SELECT account WHERE username = ?
3. Check status = ACTIVE
4. Check locked_until: nếu != null và > NOW() → throw ACCOUNT_LOCKED
5. BCrypt.matches(password, passwordHash)
   → nếu sai: tăng failed_login_attempts
              nếu >= 5: SET locked_until = NOW() + 15min
6. Generate JWT: jti = UUID.randomUUID(), exp = NOW() + 24h
7. INSERT auth_token (jwt_id, issued_at, expires_at, created_ip, user_agent)
8. UPDATE account SET last_login_at = NOW(), failed_login_attempts = 0
```

### 5.3 Đăng xuất (Logout)

```
1. POST /api/auth/logout (Authorization: Bearer <token>)
2. Extract jti từ JWT payload
3. SET Redis "blacklist:{jti}" EX <seconds_remaining>
4. UPDATE auth_token SET is_revoked=true, revoked_at=NOW() WHERE jwt_id=?
```

### 5.4 Xác thực request (Token Validation)

```
1. API Gateway nhận request có Bearer token
2. Verify JWT signature + check exp
3. Check Redis "blacklist:{jti}" → nếu có: 401 Unauthorized
4. Nếu Redis miss: check DB auth_token.is_revoked → nếu true: 401
5. Pass account_id + roles qua header sang downstream service
```

---

*CinePrime — Database Design Document v1.0*
