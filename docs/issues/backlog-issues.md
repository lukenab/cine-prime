# Issues — Backlog (Ngoài scope Sprint 3)
> Tổng: **3 issues** | Backend: 2 · Database: 1  
> Issue numbers: #146 – #148  
> Milestone: Sprint 4+ / Backlog

---

## Issue #146

**Title:** `[Backend] Add createdBy / updatedBy audit fields to CinemaCluster`

**Labels:** `Layer::Backend`, `Type::Chore`, `Priority::Low`

**Milestone:** Backlog

---

## Summary / Objective

`CinemaCluster` entity hiện có `createdAt` / `updatedAt` (timestamp) nhưng thiếu `createdBy` / `updatedBy` (actor). Không có audit trail về người tạo/sửa cluster, gây khó khăn khi debug hoặc trace lại thay đổi trong môi trường multi-admin. Các entity khác như `Movie`, `ShowTime` đã có đầy đủ cả 4 fields.

---

## Estimate

- [ ] **S (< 2h)** / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `CinemaCluster` entity có field `createdBy VARCHAR(100)` và `updatedBy VARCHAR(100)`
- [ ] DB migration: `ALTER TABLE cinema_cluster ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) NULL; ALTER TABLE cinema_cluster ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) NULL;`
- [ ] `movie_db.sql` (init script) cập nhật schema
- [ ] `CinemaClusterService.createCluster()` set `createdBy` từ header `X-User-Name` (pattern giống `CinemaRoomController`)
- [ ] `CinemaClusterService.updateCluster()` set `updatedBy` từ header `X-User-Name`
- [ ] `CinemaClusterResponse` DTO trả về `createdBy`, `updatedBy`

---

## Technical Notes / Constraints

- Pattern đang dùng trong project: nhận `@RequestHeader(value = "X-User-Name", defaultValue = "unknown") String updatedBy` tại controller rồi pass xuống service.
- `@PrePersist` và `@PreUpdate` chỉ set timestamp — KHÔNG set `createdBy/updatedBy` (vì cần user context). Set trong service layer.
- Existing records sau migration sẽ có `NULL` cho 2 columns này — acceptable.

---

## Related

- Branch: `chore/cinema-cluster-audit-fields`
- Depends on: `CinemaCluster.java`, `CinemaClusterService.java`, `movie_db.sql`
- Closes: #146
- Reference: `ShowTime.java` (đã có `createdBy/updatedBy`), `CinemaRoomController.java` (pattern X-User-Name)

---
---

## Issue #147

**Title:** `[Backend] Implement Rating & Review system for movies`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 4+

---

## Summary / Objective

Hệ thống hiện không có cơ chế để customer đánh giá phim sau khi xem. Thiếu `Rating`/`Review` là gap lớn về UX — customer không có cách feedback và admin không có insight về chất lượng nội dung. Cần thiết kế schema mới, REST API, và business rules (1 review per user per movie, chỉ review sau khi đã mua vé).

---

## Estimate

- [ ] S (< 2h) / M (2–4h) / L (4–8h) / **XL (> 1 day)**

---

## Acceptance Criteria (Definition of Done)

**Database:**
- [ ] Bảng `movie_review`: `review_id`, `movie_id`, `account_id`, `rating` (1–5), `comment` (TEXT, nullable), `status` (`PUBLISHED`/`HIDDEN`), `created_at`, `updated_at`
- [ ] Unique constraint `(movie_id, account_id)` — mỗi user chỉ review mỗi phim 1 lần
- [ ] Bảng `movie` có cột `average_rating DECIMAL(3,2)` và `review_count INT DEFAULT 0` (denormalized để query nhanh)

**Backend API:**
- [ ] `POST /api/reviews` — customer submit review (yêu cầu đã có booking CONFIRMED cho movie đó)
- [ ] `PUT /api/reviews/{id}` — customer sửa review của chính mình
- [ ] `DELETE /api/reviews/{id}` — customer xóa review / admin xóa bất kỳ
- [ ] `GET /api/movies/{id}/reviews?page=0&size=10` — list reviews của phim (public)
- [ ] `PATCH /api/reviews/{id}/status` — admin ẩn review vi phạm (`HIDDEN`)
- [ ] Sau mỗi create/update/delete review → cập nhật `movie.average_rating` và `movie.review_count`

**Business rules:**
- [ ] Chỉ customer có booking `CONFIRMED` cho movie mới được review
- [ ] `rating` phải trong khoảng 1–5 (integer hoặc 0.5 increments)
- [ ] Customer không thể review phim chưa chiếu (`COMING_SOON`)

---

## API Specifications (if applicable)

### API 1 — Submit Review

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/reviews` |
| Auth Required | Yes (CUSTOMER) |

**Request Body:**
```json
{
  "movieId": 12,
  "rating": 4,
  "comment": "Phim hay, visual đẹp nhưng kịch bản hơi yếu."
}
```

**Response 201 Created:**
```json
{
  "code": 1000,
  "result": {
    "reviewId": "uuid-...",
    "movieId": 12,
    "accountId": "uuid-...",
    "rating": 4,
    "comment": "Phim hay, visual đẹp nhưng kịch bản hơi yếu.",
    "status": "PUBLISHED",
    "createdAt": "2026-07-20T15:30:00"
  }
}
```

**Response (Error — chưa mua vé):**
```json
{ "code": 4041, "message": "You must have a confirmed booking to review this movie" }
```

### API 2 — Get Movie Reviews

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/{id}/reviews` |
| Auth Required | No |

**Response 200 OK:**
```json
{
  "code": 1000,
  "result": {
    "averageRating": 4.2,
    "reviewCount": 38,
    "reviews": [
      {
        "reviewId": "uuid-...",
        "rating": 4,
        "comment": "Phim hay...",
        "createdAt": "2026-07-20T15:30:00"
      }
    ]
  }
}
```

---

## Technical Notes / Constraints

- Service có thể nằm trong `movie-service` (đã có Movie entity) hoặc tách thành `review-service` riêng. Recommend: để trong `movie-service` trước cho đơn giản.
- Check "đã mua vé" yêu cầu cross-service call sang `booking-service` qua OpenFeign: `GET /api/bookings/check?movieId={id}&accountId={id}` → cần implement endpoint này ở booking-service trước.
- `average_rating` update: dùng trigger DB hoặc update trong service (`@Transactional`). Recommend service-layer để tránh coupling.
- Anonymize reviewer: hiển thị first name + masked last name (e.g. "Nguyễn A.") thay vì full name.
- Moderation: admin có thể HIDDEN review mà không cần xóa — review vẫn tồn tại trong DB nhưng không hiển thị trên frontend.

---

## Related

- Branch: `feat/movie-review-system`
- Depends on: `booking-service` (cần endpoint check confirmed booking), `movie-service` (Movie entity)
- Blocks: [Frontend] Customer — Movie detail page rating widget
- Closes: #147

---
---

## Issue #148

**Title:** `[Backend] Implement Promotion apply for specific Movie / Showtime`

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

**Milestone:** Sprint 4+

---

## Summary / Objective

`promotion-service` hiện tại gần như chưa implement — chỉ có `PromotionServiceApplication.java`. Promotions hiện chỉ có thể áp dụng theo mã code toàn hệ thống (không link được với movie cụ thể, showtime cụ thể, hoặc ngày giờ cụ thể). Cần thiết kế schema cho promotion-service và cơ chế apply promotion khi customer checkout booking.

---

## Estimate

- [ ] S (< 2h) / M (2–4h) / L (4–8h) / **XL (> 1 day)**

---

## Acceptance Criteria (Definition of Done)

**Database (promotion-service):**
- [ ] Bảng `promotion`: `promotion_id`, `code` (unique), `name`, `description`, `discount_type` (`PERCENT`/`FIXED_AMOUNT`), `discount_value`, `min_order_value`, `max_discount_amount`, `start_date`, `end_date`, `max_uses`, `current_uses`, `status` (`ACTIVE`/`INACTIVE`/`EXPIRED`)
- [ ] Bảng `promotion_target` (optional, cho targeted promotions): `promotion_id`, `target_type` (`MOVIE`/`SHOWTIME`/`ROOM_TYPE`), `target_id` — nếu null = áp dụng toàn hệ thống

**Backend API (promotion-service):**
- [ ] `POST /api/promotions` — admin tạo promotion (ADMIN only)
- [ ] `GET /api/promotions` — list promotions với filter (admin)
- [ ] `PUT /api/promotions/{id}` — admin cập nhật promotion
- [ ] `POST /api/promotions/validate` — validate promotion code trước khi checkout (public)
- [ ] `POST /api/promotions/{id}/apply` — internal API cho booking-service gọi khi confirm booking

**Integration với booking-service:**
- [ ] `booking-service` gọi `promotion-service` qua OpenFeign khi customer submit booking với promotion code
- [ ] Sau apply thành công → `promotion.current_uses` tăng lên 1 (atomic)
- [ ] Nếu promotion hết `max_uses` → trả lỗi `PROMOTION_EXHAUSTED`

---

## API Specifications (if applicable)

### API 1 — Validate Promotion Code

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/promotions/validate` |
| Auth Required | Yes (CUSTOMER) |

**Request Body:**
```json
{
  "code": "SUMMER2026",
  "movieId": 12,
  "orderValue": 180000
}
```

**Response 200 OK:**
```json
{
  "code": 1000,
  "result": {
    "valid": true,
    "promotionId": "uuid-...",
    "discountType": "PERCENT",
    "discountValue": 20,
    "discountAmount": 36000,
    "finalAmount": 144000,
    "message": "Giảm 20% — tối đa 50,000 VND"
  }
}
```

**Response (Error — hết lượt):**
```json
{ "code": 4051, "message": "Promotion has reached its usage limit" }
```

### API 2 — Create Promotion (Admin)

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/promotions` |
| Auth Required | Yes (ADMIN) |

**Request Body:**
```json
{
  "code": "SUMMER2026",
  "name": "Summer Festival 20% Off",
  "discountType": "PERCENT",
  "discountValue": 20,
  "minOrderValue": 100000,
  "maxDiscountAmount": 50000,
  "startDate": "2026-07-01",
  "endDate": "2026-08-31",
  "maxUses": 500,
  "targetMovieIds": [12, 15, 18]
}
```

---

## Technical Notes / Constraints

- `promotion-service` cần được setup hoàn chỉnh trước: JPA entities, repositories, Feign client config, API Gateway route (`/api/promotions/**`).
- `targetMovieIds` là optional — nếu không truyền thì promotion áp dụng toàn hệ thống.
- Race condition khi nhiều user dùng cùng code: dùng `UPDATE promotion SET current_uses = current_uses + 1 WHERE promotion_id = ? AND current_uses < max_uses` (atomic SQL update, không phải read-then-write).
- Nếu `max_uses = null` → không giới hạn số lượt dùng.
- `booking-service` cần Feign client gọi `promotion-service`. Feign interface: `PromotionClient.apply(promotionId, bookingId)`.
- Expiry check: `end_date < today` → promotion EXPIRED (có thể dùng scheduler tương tự `MovieScheduler`).

---

## Related

- Branch: `feat/promotion-service-setup`
- Depends on: `promotion-service` (cần setup từ đầu), `booking-service` (Feign integration), API Gateway config
- Blocks: [Frontend] Customer — Promotion code input at checkout
- Closes: #148
