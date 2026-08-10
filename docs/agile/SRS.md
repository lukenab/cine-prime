# Software Requirements Specification (SRS) — CinePrime

**Project:** CinePrime — Movie Theater Management System
**Team:** HCM26_CPL_JAVA_05 — Group 1 (FPT Software OJT Program)
**Version:** 1.2 (baseline) · **Last Updated:** 2026-07-04
**Status:** Living document — update at the start of each sprint's planning.

> This SRS is the single source of truth for *what* the system must do. Implementation
> detail (schemas, endpoints) lives in [`../api-specs/`](../api-specs/) and
> [`../architecture/`](../architecture/). When a requirement changes, update this file
> **first**, then the affected contract.

---

## 1. Introduction

### 1.1 Purpose
Define the functional and non-functional requirements for CinePrime, a microservices-based
platform that lets customers browse movies and book cinema tickets online, and lets cinema
staff manage movies, showtimes, accounts, bookings, and revenue.

### 1.2 Scope
CinePrime consists of a React SPA frontend and a Spring Boot microservices backend behind an
API Gateway, with service discovery (Eureka), PostgreSQL (DB-per-service), Redis (OTP/session/
seat-lock caching), and Kafka (async events). See [`../../README.md`](../../README.md) for the
full tech stack and service/port map.

### 1.3 Definitions, Acronyms
| Term | Meaning |
|------|---------|
| RBAC | Role-Based Access Control |
| OTP | One-Time Password (6-digit, emailed, 5-min TTL) |
| DLT | Dead Letter Topic (Kafka) |
| Seat lock | Temporary hold on a seat during checkout (10-min TTL) |
| Member | Registered customer who can book tickets (role `MEMBER`) |
| Guest | Not-logged-in / browse-only user (role `USER`) |

### 1.4 References
- API contracts: [`../api-specs/`](../api-specs/)
- Kafka contract: [`../architecture/kafka/kafka-user-service-contract.md`](../architecture/kafka/kafka-user-service-contract.md)
- Database design and ERDs: [`../DB_DESIGN.md`](../DB_DESIGN.md)

---

## 2. Overall Description

### 2.1 User Roles (RBAC)
Roles and permissions are seeded in `auth-service/src/main/resources/data.sql`.

| Role | Description | Can book tickets? |
|------|-------------|:---:|
| `ADMIN` | Full CRUD on all modules — accounts, movies, showtimes, rooms, employees, statistics | ✅ |
| `EMPLOYEE` | Counter staff — ticket selling/booking, member search, manage movies & promotions | ✅ (counter) |
| `MEMBER` | Registered customer — book tickets, manage account, booking history, loyalty points | ✅ |
| `USER` | Guest / not-member — view movies, showtimes, promotions, prices only | ❌ |

> **Business rule:** Public self-registration (`/register/verify`) assigns the **`MEMBER`** role —
> a registered customer can book immediately. `USER` is reserved for guest/browse-only accounts.

### 2.2 Assumptions & Dependencies
- Every service owns its own database (no shared schema).
- Inter-service sync calls use OpenFeign; async events use Kafka.
- Email delivery (OTP, notifications) is handled by `notification-service` via Kafka.
- Seat pricing integration with movie-service is **planned** (currently hardcoded — see §5).

---

## 3. Functional Requirements

Each requirement has a stable ID (`FR-<area>-<n>`). Acceptance criteria for a requirement live
on its GitLab issue / user story; this table is the index.

### 3.1 Authentication & Accounts (`auth-service`)
| ID | Requirement | Priority | Status |
|----|-------------|:---:|:---:|
| FR-AUTH-1 | Pre-check username/email availability before registration | Must | ✅ Done |
| FR-AUTH-2 | 2-step OTP registration (initiate → verify), new users get `MEMBER` | Must | ✅ Done |
| FR-AUTH-3 | Resend OTP with rate-limit (60s cooldown) | Must | ✅ Done |
| FR-AUTH-4 | Login returns JWT; reject inactive accounts | Must | ✅ Done |
| FR-AUTH-5 | Logout revokes token (whitelist model) | Must | ✅ Done |
| FR-AUTH-6 | Refresh token (rotation: revoke old, issue new) | Must | ✅ Done |
| FR-AUTH-7 | Introspect token validity | Should | ✅ Done |
| FR-AUTH-8 | Admin CRUD on accounts | Must | ✅ Done |
| FR-AUTH-9 | RBAC management — permissions & roles CRUD | Must | ✅ Done |
| FR-AUTH-10 | Auth audit logging | Should | ✅ Done |

### 3.2 Movies, Showtimes & Rooms (`movie-service`)
| ID | Requirement | Priority | Status |
|----|-------------|:---:|:---:|
| FR-MOV-1 | CRUD movies (with poster upload via Cloudinary) | Must | ✅ Done |
| FR-MOV-2 | Movie genres / types management | Must | ✅ Done |
| FR-MOV-3 | Cinema room management (auto-generate seats) | Must | ✅ Done |
| FR-MOV-4 | Showtime/schedule CRUD with overlap detection | Must | ✅ Done |
| FR-MOV-5 | Seat pricing owned by movie-service (replace hardcoded price) | Must | ⏳ Planned (Sprint 3) |

### 3.3 Booking & Ticketing (`booking-service`)
| ID | Requirement | Priority | Status |
|----|-------------|:---:|:---:|
| FR-BOOK-1 | Member creates booking + holds seats (10-min lock) | Must | ✅ Done |
| FR-BOOK-2 | Prevent double-booking under concurrency (lock + unique constraint) | Must | ✅ Done |
| FR-BOOK-3 | Cancel booking (PENDING/CONFIRMED, with ticket voiding) | Must | ✅ Done |
| FR-BOOK-4 | Confirm booking (PENDING → CONFIRMED, issue tickets) | Must | ⏳ Planned (Sprint 3) |
| FR-BOOK-5 | Counter sale (immediate CONFIRMED, no PENDING) | Must | ⏳ Planned (Sprint 3) |
| FR-BOOK-6 | Auto-expire PENDING bookings past lock TTL (scheduled job) | Must | ⏳ Planned (Sprint 3) |
| FR-BOOK-7 | Employee booking search (keyword/status/date) | Should | ⏳ Planned (Sprint 3) |

### 3.4 User Profiles (`user-service`)
| ID | Requirement | Priority | Status |
|----|-------------|:---:|:---:|
| FR-USER-1 | Consume `user-register-topic` → create profile async | Must | ✅ Done |
| FR-USER-2 | CRUD user profiles (paginated), soft-delete | Must | ✅ Done |
| FR-USER-3 | Phone/identity-card uniqueness check for auth-service | Must | ✅ Done |
| FR-USER-4 | Employee management | Must | ✅ Done |

### 3.5 Payment / Promotion / Notification (WIP services)
| ID | Requirement | Priority | Status |
|----|-------------|:---:|:---:|
| FR-PAY-1 | Payment processing for confirmed bookings | Must | ⏳ Planned |
| FR-PROMO-1 | Promotions & voucher management | Should | ⏳ Planned |
| FR-NOTI-1 | Send OTP & booking emails via Kafka consumers | Must | 🟡 Partial (OTP done) |

> **TODO (team):** Expand each Planned/Partial row into a full user story with acceptance
> criteria on the GitLab board before the sprint it is scheduled for.

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Security | All protected endpoints require `Authorization: Bearer <JWT>`; passwords BCrypt-hashed; tokens whitelisted & revocable |
| NFR-2 | Security | Input validation on all write endpoints (Jakarta Validation); standardized error codes per [`../ERROR_CODE_CONVENTION.md`](../ERROR_CODE_CONVENTION.md) |
| NFR-3 | Reliability | Seat booking must never double-sell under concurrent load |
| NFR-4 | Performance | Login ≤ 3s; OTP send ≤ 5s; CRUD ≤ 2s (see contract timeout tables) |
| NFR-5 | Consistency | Every API response uses the shared `ApiResponse<T>` envelope (`code`/`message`/`result`) |
| NFR-6 | Maintainability | Code follows [`../CODING_CONVENTION.md`](../CODING_CONVENTION.md); DB-per-service isolation |
| NFR-7 | Observability | Auth & booking actions produce audit logs |
| NFR-8 | Portability | Local infra runs via `docker-compose` (PostgreSQL, Redis, Kafka) |

---

## 5. Known Constraints & Technical Debt
Tracked in the latest retrospective ([`retrospectives/sprint-2-retrospective.md`](retrospectives/sprint-2-retrospective.md)):
- Seat price hardcoded at 85,000 VND — pending movie-service pricing integration.
- Seat-lock TTL hardcoded (10 min) — should be config-driven.
- Booking expiry scheduler not yet implemented.
- `CinemaRoomRepository` generic type mismatch (`Integer` vs `Long`).

---

## 6. Change Log
| Version | Date | Change |
|---------|------|--------|
| 1.2 | 2026-07-04 | First consolidated SRS committed to repo (was previously referenced but undocumented) |
