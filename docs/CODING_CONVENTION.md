# Coding Convention

Tài liệu này mô tả các quy ước code áp dụng cho toàn bộ backend microservices của dự án.  
Mọi thành viên **phải** tuân theo trước khi tạo MR.

---

## 1. Package Structure

Mỗi service theo cấu trúc package chuẩn:

```
{service-name}/
├── config/          # SecurityConfig, ApplicationInitConfig, ...
├── controller/      # REST controllers
├── service/         # Business logic
├── repository/      # JPA Repositories
├── entity/          # JPA Entities
├── dto/
│   ├── request/     # Request DTOs
│   └── response/    # Response DTOs
├── mapper/          # MapStruct interfaces
├── exception/       # Service-specific ErrorCode enum
├── enums/           # Business enums (Status, Type, ...)
├── event/           # Kafka event classes
├── client/          # OpenFeign clients
├── producer/        # Kafka producers
├── scheduler/       # @Scheduled jobs
└── validator/       # Custom validators
```

---

## 2. Naming Convention

| Loại | Convention | Ví dụ |
|---|---|---|
| Class | PascalCase | `AuthenticationService` |
| Method | camelCase | `findByUsername()` |
| Variable | camelCase | `accountRepository` |
| Constant | UPPER_SNAKE_CASE | `DEFAULT_USER_ROLE` |
| Package | lowercase | `authservice.controller` |
| DB column | snake_case | `password_hash`, `created_at` |
| DB table | snake_case | `account`, `seat_lock` |
| Enum value | UPPER_SNAKE_CASE | `ACTIVE`, `PENDING`, `CONFIRMED` |

---

## 3. Lombok

Dùng Lombok để giảm boilerplate. Không viết getter/setter/constructor thủ công.

**Entity:**
```java
@Entity
@Table(name = "account")
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@Builder
public class Account { }
```

**Request/Response DTO:**
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class AuthenticationRequest { }
```

**Service / Controller:**
```java
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationService { }
```

> `@FieldDefaults(makeFinal = true)` + `@RequiredArgsConstructor` = constructor injection tự động, không cần `@Autowired`.

---

## 4. Controller

```java
@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BookingController {

    BookingService bookingService;

    @PostMapping
    ApiResponse<BookingResponse> createBooking(@RequestBody @Valid CreateBookingRequest request) {
        return ApiResponse.<BookingResponse>builder()
                .result(bookingService.createBooking(request))
                .build();
    }
}
```

**Quy tắc:**
- Method không cần modifier `public` (package-private là đủ trong cùng package)
- Luôn trả về `ApiResponse<T>`, không trả raw object
- Dùng `@Valid` khi cần validate request body
- URL path: kebab-case, số nhiều cho resource (`/api/bookings`, không phải `/api/booking`)

---

## 5. API Response Wrapper

Mọi response đều dùng `ApiResponse<T>` từ module `common`:

```java
// Trả về data
ApiResponse.<BookingResponse>builder()
        .result(bookingService.create(request))
        .build();

// Trả về message không có data
ApiResponse.<Void>builder()
        .message("Logged out successfully")
        .build();
```

Cấu trúc JSON trả về:
```json
{
  "code": 1000,
  "message": "Success",
  "result": { }
}
```

> `result` và `message` có `@JsonInclude(NON_NULL)` — nếu null thì không xuất hiện trong response.

---

## 6. Entity

```java
@Entity
@Table(name = "booking")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "booking_id", updatable = false, nullable = false, length = 36)
    String bookingId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    BookingStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", insertable = false)
    LocalDateTime updatedAt;
}
```

**Quy tắc:**
- Luôn khai báo `@Column(name = "...")` rõ ràng, không dựa vào tên field
- Dùng `@CreationTimestamp` / `@UpdateTimestamp` từ Hibernate, không set thủ công
- Dùng `LocalDateTime` cho timestamp
- Enum lưu dạng STRING (`@Enumerated(EnumType.STRING)`)
- Primary key UUID: `@GeneratedValue(strategy = GenerationType.UUID)`

---

## 7. DTO

- **Request**: `{Action}{Resource}Request` → `CreateBookingRequest`, `AdminCreateAccountRequest`
- **Response**: `{Resource}Response` → `BookingResponse`, `AccountResponse`
- Đặt trong package tương ứng: `dto/request/`, `dto/response/`
- Không dùng Entity trực tiếp làm response

---

## 8. Service

```java
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BookingService {

    BookingRepository bookingRepository;

    private static final String SOME_CONSTANT = "value";

    @Transactional
    public BookingResponse createBooking(CreateBookingRequest request) {
        // business logic
    }
}
```

**Quy tắc:**
- Đặt `@Transactional` trên method có write operation, không đặt trên class
- Dùng `log.info()` / `log.warn()` / `log.error()` thay vì `System.out.println()`
- Constants `private static final` đặt trên cùng trong class, sau field injection

---

## 9. Repository

```java
@Repository
public interface AccountRepository extends JpaRepository<Account, String> {
    Optional<Account> findByUsername(String username);
    boolean existsByEmail(String email);
}
```

**Quy tắc:**
- Extend `JpaRepository<Entity, IdType>`
- Dùng derived query methods (`findByX`, `existsByX`) cho query đơn giản
- Dùng `Optional<T>` cho các method có thể không tìm thấy
- Chỉ dùng `@Query` khi query phức tạp không diễn đạt được bằng method name

---

## 10. Error Handling

Mỗi service có enum `{Service}ErrorCode` riêng, implement `BaseErrorCode`:

```java
@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public enum BookingErrorCode implements BaseErrorCode {
    BOOKING_NOT_FOUND(2001, "Booking not found", HttpStatus.NOT_FOUND),
    SEAT_ALREADY_LOCKED(2002, "Seat is already booked", HttpStatus.CONFLICT);

    int code;
    String message;
    HttpStatusCode statusCode;
}
```

Throw exception trong service:
```java
throw new AppException(BookingErrorCode.BOOKING_NOT_FOUND);
```

**Quy tắc phân bổ error code:**

| Service | Range |
|---|---|
| common (global) | 1000–1009 |
| auth-service | 1010–1099 |
| booking-service | 2001–2099 |
| movie-service | 3001–3099 |
| user-service | 4001–4099 |
| notification-service | 5001–5099 |

---

## 11. Mapper (MapStruct)

```java
@Mapper(
        componentModel = "spring",
        unmappedTargetPolicy = ReportingPolicy.IGNORE,
        nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
public interface BookingMapper {
    Booking toBooking(CreateBookingRequest request);
    BookingResponse toBookingResponse(Booking booking);
    List<BookingResponse> toBookingResponseList(List<Booking> bookings);

    @Mapping(target = "status", ignore = true)
    void updateBooking(UpdateBookingRequest request, @MappingTarget Booking booking);
}
```

**Quy tắc:**
- Luôn dùng `unmappedTargetPolicy = ReportingPolicy.IGNORE` để tránh compile error khi field không map
- Method update dùng `@MappingTarget`, không tạo object mới
- Không convert thủ công trong Service nếu đã có Mapper

---

## 12. Enum

```java
public enum BookingStatus {
    PENDING,
    CONFIRMED,
    CANCELLED
}
```

- Giá trị UPPER_SNAKE_CASE
- Không thêm annotation nếu enum đơn giản
- Nếu enum cần metadata (message, HTTP status) → implement `BaseErrorCode` hoặc tạo interface riêng

---

## 13. Kafka Event

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserRegisteredEvent {
    String accountId;
    String email;
    String username;
}
```

- Đặt trong package `event/`
- Naming: `{Action}{Entity}Event` → `UserRegisteredEvent`, `OtpRequestedEvent`
- Luôn có `@NoArgsConstructor` để deserialize được

---

## 14. OpenFeign Client

```java
@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/api/users/{id}/exists")
    ApiResponse<UserExistenceResponse> checkUserExists(@PathVariable String id);
}
```

- Đặt trong package `client/`
- Dùng `name` khớp với `spring.application.name` của service đích (để Eureka resolve)
- Không hardcode URL

---

## 15. Những thứ KHÔNG làm

```java
// ❌ Không dùng @Autowired field injection
@Autowired
private BookingRepository bookingRepository;

// ✅ Dùng constructor injection qua @RequiredArgsConstructor
@RequiredArgsConstructor
public class BookingService {
    final BookingRepository bookingRepository;
}

// ❌ Không trả raw object từ controller
@GetMapping("/{id}")
Booking getBooking(@PathVariable String id) { ... }

// ✅ Luôn wrap bằng ApiResponse
ApiResponse<BookingResponse> getBooking(@PathVariable String id) { ... }

// ❌ Không dùng System.out.println
System.out.println("Creating booking...");

// ✅ Dùng @Slf4j + log
log.info("Creating booking for accountId={}", accountId);

// ❌ Không throw Exception generic
throw new RuntimeException("Not found");

// ✅ Dùng AppException với ErrorCode
throw new AppException(BookingErrorCode.BOOKING_NOT_FOUND);
```
