# Sprint 2 Retrospective

## Sprint Overview

| Field            | Value                                      |
| ---------------- | ------------------------------------------ |
| Sprint           | Sprint 2 — Showtime Management & Ticket Booking |
| Duration         | June 18, 2026 – July 2, 2026 (2 weeks)    |
| Team             | HCM26_CPL_JAVA_05_Group1                   |
| Total Issues     | 38                                          |
| Completed        | 38 (100%)                                  |
| Date Written     | July 2, 2026                               |

---

## 1. Sprint Goal

Deliver end-to-end showtime scheduling and ticket booking capabilities across all service layers:

- Design and implement the booking service database schema and JPA entities.
- Implement the Create Booking, Hold Seats, Seat Conflict, and Cancel Booking APIs in booking-service.
- Implement the Showtime Write and Read APIs in movie-service.
- Build the customer-facing Seat Map & Booking Flow UI.
- Build Admin UIs for Showtime Management and Booking/Ticket Management.
- Complete auth-service refresh token, logout, and admin account creation flows.
- Deliver API contracts and documentation for booking and ticket management.

---

## 2. What We Delivered

### 2.1. Database Layer

| # | Issue | Notes |
|---|-------|-------|
| #48 | Design Schema for booking-service | `booking`, `booking_detail`, `ticket`, `seat_lock` tables |
| #47 | Design Schema for showtime-service | `show_time`, `showtime_seat` tables |
| #85 | Add seed data for movie-service development environment | Dev-ready dataset for local testing |

### 2.2. Backend — Booking Service

| # | Issue | Priority |
|---|-------|----------|
| #52 | Setup JPA Entities & Repositories | High |
| #53 | Implement Create & Hold Seat APIs | High |
| #55 | Implement Seat Conflict Logic with Transaction/Lock | High |
| #54 | Implement Cancel Booking API | Medium |

**Key implementation decisions:**
- Seat locking uses `seat_lock` table with pessimistic locking (`SELECT ... FOR UPDATE`) + unique constraint to prevent double-booking under concurrent load.
- `DUPLICATE_SEATS_IN_REQUEST` guard added before lock acquisition.
- Cancel logic supports both `PENDING` and `CONFIRMED` bookings, with ticket voiding for confirmed ones.
- Seat lock TTL: **10 minutes** (currently hardcoded).

### 2.3. Backend — Movie Service

| # | Issue | Priority |
|---|-------|----------|
| #51 | Update ShowTime DTO & Repository Layer | High |
| #91 | Implement ShowTime Read API (GET /schedules) | High |
| *(write)* | Implement ShowTime Write API (POST/PUT/DELETE /schedules) | High |
| #67 | Refactor: Split MovieService into focused single-responsibility services | High |
| #63 | Add GET list endpoints for movies, cinema rooms, and movie types | High |

**Key implementation decisions:**
- New `ScheduleController` at `/api/schedules` created separately from legacy `/api/showtimes` to avoid breaking booking-service Feign clients.
- `/api/schedules/**` added to API Gateway route predicate.
- Overlap detection uses two JPQL queries: `existsByCinemaRoomAndOverlappingTime` (create) and `existsByCinemaRoomAndOverlappingTimeExcluding` (update, self-exclusion).
- Business rules: show date ≥ today + 3 days, start time 08:00–23:00, end time ≤ 23:00.

### 2.4. Backend — Auth Service

| # | Issue | Priority |
|---|-------|----------|
| #69 | Implement Logout API | High |
| #70 | Implement Refresh Token API | High |
| #56 | Implement Admin Create Account API with Kafka Event | High |
| #80 | Update logout to read JWT token from Authorization header | High |
| #84 | Implement Auth Audit Log tracking | Medium |
| #93 | Move OTP email sending from auth-service to notification-service via Kafka | High |

**Key implementation decisions:**
- Dead `EmailService`, `spring-boot-starter-mail`, Thymeleaf dependency, and `otp-email.html` template removed from auth-service after OTP was moved to Kafka → notification-service.
- Logout now reads token from `Authorization: Bearer` header (not request body).

### 2.5. Backend — User Service

| # | Issue | Priority |
|---|-------|----------|
| #81 | Implement Employee Management API | High |
| #40 | Implement APIs for Role Management with Permission Assignment | High |

### 2.6. Documentation

| # | Issue |
|---|-------|
| #68 | Add API Contract for Booking and Ticket Management (`booking-service-api-design.md`, `booking-service.yaml`) |
| #61 | Update Auth Service API Contract |

### 2.7. Frontend

| # | Issue | Priority |
|---|-------|----------|
| #59 | Customer UI: Showtime Selection Screen | High |
| #60 | Customer UI: Seat Map & Booking Flow | High |
| #57 | Admin UI: Showtime Management (Assign Movie to Room by Timeslot) | High |
| #58 | Admin UI: Create New User Account Form | Medium |
| #74 | Implement Booking & Ticket Management UI For Admin | High |
| #75 | Implement Employee Management UI (CRUD) | Medium |
| #82 | Integrate Employee Management UI with Backend APIs | Medium |
| #79 | Implement Ticket Sale Page (Multi-step Wizard) | — |
| #77 | Implement Reports & Analytics Page | Medium |
| #76 | Implement Promotion Management UI (CRUD) | Medium |
| #78 | Implement Settings Page (Cinema Info, Security Policy…) | Medium |
| #64 | Add Manage Cinema Rooms and Genres pages with GET/POST API integration | High |
| #89 | Add Cinema Cluster Support to Landing Page | — |
| #83 | Implement citizen ID autofill for registration | Medium |
| #36 | Build Edit Movie UI and Integrate PUT API | Medium |
| #37 | Integrate Delete Movie Action and UI Confirmation | Medium |
| #21 | Fetch and Display Movie List on Customer Homepage | Medium |

---

## 4. What Went Well

### 4.1. Cross-layer Delivery
The team successfully delivered features spanning all five layers — Database, Backend, Frontend, Docs, and DevOps config — within a single sprint. The booking flow from seat selection to seat locking is end-to-end functional.

### 4.2. Strong Concurrency Design
The seat conflict logic (pessimistic lock + unique constraint + optimistic locking on `booking_detail.version`) is well-designed. The layered defense prevents double-booking even under concurrent load, catching both the pessimistic lock case and the race condition on first insert.

### 4.3. Clean Service Boundaries
The decision to route showtime schedule management under `/api/schedules` instead of modifying `/api/showtimes` preserved the existing Feign client contract in booking-service, avoiding cross-service breakage.

### 4.4. API Documentation Quality
Both `booking-service-api-design.md` and `booking-service.yaml` were written to a high standard — clear response envelope, error code catalog mapped to actual `BookingErrorCode` enum values, and separate sections for implemented vs. planned endpoints.

### 4.5. Kafka Integration
The OTP email migration to notification-service via Kafka (fire-and-forget) was executed cleanly: dead code removed from auth-service (Java class, Spring Mail/Thymeleaf deps, YAML config, HTML template), and the new Kafka producer in auth-service is decoupled from the consumer in notification-service.

### 4.6. 100% Sprint Completion Rate
All 38 issues delivered — a very high velocity for a sprint covering three backend services and seven frontend pages simultaneously.

---

## 5. What Didn't Go Well

### 5.1. Workload Imbalance
The contribution split is significantly uneven:

| Member | Issues Owned | % |
| ------ | ------------ | --- |
| Nguyễn An Bình | 50 | 62.50% |
| Lê Tấn Lộc | 11 | 13.75% |
| Nguyễn Mạnh Khải | 8 | 10.00% |
| Trần Nhật Duy | 7 | 8.75% |
| Diệp Đăng Khoa | 4 | 5.00% |

One member carrying 62.5% of total issues creates a single point of failure, burnout risk, and reduced knowledge sharing. The remaining four members average 9.375% each.

### 5.2. Response Envelope Inconsistency in Docs
The initial `booking-service-api-design.md` used a `success/data/errors` response format throughout the endpoint examples that did not match the actual `ApiResponse<T>` wrapper (`code/message/result`). This was caught and corrected, but required a full doc rewrite at the end of the sprint — wasting time that could have been avoided if the common module contract had been agreed on before doc writing started.

### 5.3. Pre-existing Repository Type Bug Not Fixed
`CinemaRoomRepository extends JpaRepository<CinemaRoom, Integer>` but the `@Id` is `Long`. This pre-existing type mismatch was mitigated by using `findByCinemaRoomId(Long)` derived query but was not fixed at the root. It is a latent bug that will surface if `findById()` is ever called directly.

### 5.4. No Sprint Review / Demo Conducted
There is no record of a formal sprint review or demo session where implemented features were validated against acceptance criteria by the team or stakeholders. This makes it harder to verify that the delivered frontend UIs are truly integrated with the backend.

---

## 6. Action Items for Sprint 3

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Fix `CinemaRoomRepository` generic type: change `Integer` → `Long` | Backend team | Medium |
| 2 | Redistribute issue assignment more evenly — target no single member exceeding 35% | Scrum Master | High |
| 3 | Agree on common module `ApiResponse<T>` contract before writing any new API docs | Backend Lead / Docs | Medium |
| 4 | Hold sprint planning with proper estimation for test issues (test issues ≥ 1 story point each) | Scrum Master | Medium |
| 5 | Conduct a sprint demo at end of Sprint 3 to validate frontend ↔ backend integration | All | Medium |
| 6 | Implement booking expiry scheduler (PENDING → CANCELLED after lock TTL) | Backend team | High |
| 7 | Implement Employee Search, Confirm Booking, and Counter Sale APIs (planned in booking-service) | Backend team | High |

---

## 7. Technical Debt Carried Over

| Item | Risk | Planned Sprint |
|------|------|----------------|
| Seat price hardcoded at `85,000 VND` — Movie Service seat pricing integration missing | Medium | Sprint 3 |
| `seat_lock` TTL hardcoded in service layer (should be configurable via `application.yml`) | Low | Sprint 3 |
| Booking expiry scheduled job not implemented — PENDING bookings do not expire automatically | High | Sprint 3 |
| `CinemaRoomRepository` generic type mismatch (`Integer` vs `Long`) | Low | Sprint 3 |
| Employee, Confirm, Counter Sale endpoints not yet implemented | High | Sprint 3 |
| `GET /api/bookings/me` does not support status filtering | Low | Backlog |

---

## 8. Sprint Metrics

| Metric | Value |
|--------|-------|
| Sprint duration | 14 days |
| Total issues planned | 38 |
| Issues completed | 38 |
| Completion rate | 100% |
| Issues by layer — Backend | ~18 |
| Issues by layer — Frontend | ~17 |
| Issues by layer — Database | 3 |
| Issues by layer — Docs | 2 |
| High priority issues completed | ~25 / 26 |
| New error codes added | 12 (`BookingErrorCode` 2001–2012) |
| New API endpoints delivered | ~15 (schedules + booking + auth) |
| Kafka topics introduced | 1 (OTP email) |

---

## 9. Team Shoutouts

- **Nguyễn An Bình** — Carried the sprint. Delivered the full booking service stack, showtime API, auth refactoring, Kafka migration, and all documentation. Exceptional output.
- **Lê Tấn Lộc** — Solid frontend delivery across multiple admin UI pages.
- **Nguyễn Mạnh Khải** — Contributed backend and database schema work.
- **Trần Nhật Duy** — Delivered frontend features consistently.
- **Diệp Đăng Khoa** — Contributed to frontend delivery.

---

## 10. Sprint 3 — Goals & Scope

Sprint 3 picks up where Sprint 2 left off. The goals below are derived from outstanding technical debt, planned-but-not-yet-implemented endpoints, and open quality/ops items.

### 10.1. Core Goal

> Complete the end-to-end ticket lifecycle — from booking confirmation to ticket issuance and counter sales — and stabilize the platform with test coverage, expiry automation, and payment integration groundwork.

### 10.2. Backend Deliverables

| Area | Planned Work | Priority |
|------|-------------|----------|
| **Booking Service** | Implement Confirm Booking API (`PATCH /api/bookings/{id}/confirm`) — transition PENDING → CONFIRMED, issue tickets | High |
| **Booking Service** | Implement Counter Sale API (`POST /api/bookings/counter-sale`) — CONFIRMED immediately, no PENDING step | High |
| **Booking Service** | Implement booking expiry scheduled job — auto-cancel PENDING bookings past `expires_at` | High |
| **Booking Service** | Implement Employee Search API (`GET /api/bookings/search`) with keyword, status, and date filters | Medium |
| **Booking Service** | Implement `GET /api/tickets/{ticketId}` — full ticket detail with QR code | Medium |
| **Booking Service** | Add concurrency unit/integration tests for seat conflict logic | High |
| **Booking Service** | Make seat lock TTL configurable via `application.yml` (currently hardcoded 10 min) | Low |
| **Movie Service** | Integrate Movie Service seat pricing — replace hardcoded `85,000 VND` per seat | Medium |
| **Movie Service** | Fix `CinemaRoomRepository` generic type (`Integer` → `Long`) | Low |
| **Notification Service** | Implement Kafka consumers for booking lifecycle events (created, confirmed, cancelled) | Medium |

### 10.3. Frontend Deliverables

| Area | Planned Work | Priority |
|------|-------------|----------|
| **Customer** | Booking confirmation screen — show `lockedUntil` countdown, seat summary | High |
| **Customer** | Ticket history page (`GET /api/bookings/me` + ticket detail) | High |
| **Employee** | Counter sale workflow UI (multi-step: select showtime → seat map → confirm) | High |
| **Employee** | Booking search & management page (`GET /api/bookings/search`) | Medium |
| **Admin** | Booking confirmation action on Admin Booking Management UI | Medium |

### 10.4. Quality & Ops

| Area | Planned Work | Priority |
|------|-------------|----------|
| **Testing** | Concurrency integration tests for seat locking under parallel requests | High |
| **Testing** | Unit tests for booking service business rules (cancel rules, expiry logic) | Medium |
| **Documentation** | Update `booking-service-api-design.md` and YAML as new endpoints are implemented | Medium |
| **DevOps** | Configure `booking.cancel.mins-before-showtime` and seat lock TTL in `application.yml` per environment | Low |

### 10.5. Sprint 3 Success Criteria

- [ ] Confirm Booking + Counter Sale APIs implemented and integrated with Frontend.
- [ ] Booking expiry job running and tested.
- [ ] Concurrency tests for seat conflict logic passing.
- [ ] Employee booking search page functional end-to-end.
- [ ] Workload distributed more evenly — no single member above 35%.
- [ ] Sprint demo conducted before close.

---

## 11. Overall Assessment

Sprint 2 was an ambitious sprint that successfully delivered the core booking and showtime management flows end-to-end. A 100% completion rate across 38 issues — spanning three backend services, seven frontend pages, two database schemas, and full documentation — is an exceptional result for a two-week sprint.

The primary concern going into Sprint 3 is workload distribution. The team should rebalance assignments aggressively to reduce key-person dependency and improve collective ownership of the codebase.

> **Sprint 2 verdict: ✅ Success — 100% delivered, all sprint goals met.**
