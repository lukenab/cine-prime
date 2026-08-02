# API Contract - Promotion Service

> **Source of truth:** Promotion Admin API contract. Any request/response field change must be updated in [`promotion-service.yaml`](./promotion-service.yaml) and agreed with Frontend before implementation changes.

**Version:** v1.0.0  
**Last updated:** August 2, 2026

---

## 1. Integration

- **Gateway base URL:** `http://localhost:8080`
- **OpenAPI:** [`promotion-service.yaml`](./promotion-service.yaml)
- **Authentication:** JWT Bearer token with `ROLE_ADMIN`.
- **Response wrapper:** every response uses `ApiResponse` with `code`, optional `message`, and `result`.

```json
{
  "code": 200,
  "message": null,
  "result": {}
}
```

## 2. API inventory

| Status | Method | Endpoint | Purpose |
| :---: | :--- | :--- | :--- |
| Ready | `POST` | `/api/promotions` | Create a DRAFT promotion with price rule and targets |
| Ready | `GET` | `/api/promotions` | Paginated search; optional `status`, `page`, `size` |
| Ready | `GET` | `/api/promotions/{promotionId}` | Promotion detail |
| Ready | `PUT` | `/api/promotions/{promotionId}` | Update a DRAFT promotion only |
| Ready | `POST` | `/api/promotions/{promotionId}/activate` | DRAFT/PAUSED to ACTIVE |
| Ready | `POST` | `/api/promotions/{promotionId}/pause` | ACTIVE to PAUSED |
| Ready | `POST` | `/api/promotions/{promotionId}/retire` | DRAFT/ACTIVE/PAUSED to ARCHIVED |

## 3. Create and update payload

`POST /api/promotions` returns HTTP `201`. `PUT /api/promotions/{promotionId}` returns HTTP `200`.

```json
{
  "code": "SUMMER26",
  "name": "Summer 2026 - Movie promotion",
  "description": "Giảm 20% cho movie được chọn",
  "validFrom": "2026-08-02T00:00:00Z",
  "validUntil": "2026-08-31T23:59:59Z",
  "globalUsageLimit": 100,
  "perAccountUsageLimit": 1,
  "priceRule": {
    "discountType": "PERCENTAGE",
    "percentage": 20,
    "maxDiscountAmount": 50000,
    "minimumOrderAmount": 100000,
    "currency": "VND"
  },
  "targets": [
    { "targetType": "MOVIE", "movieId": 12 }
  ]
}
```

### Business rules

- Promotion code is trimmed and uppercased; it is case-insensitively unique.
- New promotion always starts as `DRAFT`.
- `validFrom` must be before `validUntil` when both are supplied.
- Usage limits, when supplied, must be greater than zero.
- `PERCENTAGE`: `percentage` is greater than zero and at most 100; `fixedAmount` must be absent.
- `FIXED_AMOUNT`: `fixedAmount` is greater than zero; `percentage` and `maxDiscountAmount` must be absent.
- An empty/absent `targets` list means global promotion.
- `MOVIE` target contains only `movieId`; `SHOWTIME` target contains only `showtimeId`.
- Multiple targets are OR conditions.
- Rule/target edits are permitted only while promotion is `DRAFT`.

## 4. Lifecycle

```text
DRAFT  ──activate──> ACTIVE ──pause──> PAUSED ──activate──> ACTIVE
  │                     │                  │
  └──────retire─────────┴────retire────────┴──retire──> ARCHIVED
```

`ARCHIVED` is terminal. Repeating an invalid action, for example `ACTIVE -> ACTIVE`, returns conflict.

## 5. Error codes

| Code | HTTP | Meaning |
| :--- | :---: | :--- |
| `2601` | 404 | Promotion not found |
| `2602` | 409 | Promotion code already exists |
| `2603` | 400 | Invalid price rule or usage limit |
| `2604` | 400 | Invalid movie/showtime target |
| `2605` | 400 | Invalid validity window |
| `2606` | 409 | Attempt to update a non-DRAFT promotion |
| `2607` | 409 | Invalid lifecycle transition |

## 6. Audit

Every create, DRAFT update, and lifecycle action appends an audit row. The actor account ID is read from the authenticated JWT; clients cannot provide or override it.

## 7. Eligibility and reservation contract

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `POST` | `/api/promotions/quote` | Calculate eligibility and discount; does not consume quota |
| `POST` | `/api/promotions/reservations` | Atomically reserve quota with idempotency key and 15-minute TTL |
| `POST` | `/api/promotions/reservations/{id}/commit` | Commit reservation after booking confirmation |
| `POST` | `/api/promotions/reservations/{id}/release` | Release reservation after payment failure/cancel |

Quote/reserve receives a server-side Booking Service snapshot: `bookingId`, `accountId`, `movieId`, `showtimeId`, `subtotalAmount`, and `currency`. Frontend must not calculate or supply an authoritative amount.

`quote` returns HTTP `200` with `eligible: false` for inapplicable/expired/quota-exhausted promotion. `reserve` returns the existing reservation when its idempotency key, booking and account match. Reservation states are `RESERVED -> COMMITTED` or `RESERVED -> RELEASED/EXPIRED`; committed reservations cannot be released.

| Code | HTTP | Meaning |
| :--- | :---: | :--- |
| `2701` | 409 | Promotion is not applicable at reserve time |
| `2702` | 409 | Global or per-account quota exhausted |
| `2703` | 404 | Reservation not found |
| `2704` | 410 | Reservation expired; quota released |
| `2705` | 409 | Invalid reservation lifecycle state |
| `2706` | 409 | Idempotency key belongs to a different booking/account |
