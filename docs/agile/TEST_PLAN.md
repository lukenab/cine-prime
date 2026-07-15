# Test Plan — CinePrime

**Team:** HCM26_CPL_JAVA_05 — Group 1 · **Last Updated:** 2026-07-04
**Status:** Initial plan. Sprint 2 retro flagged the absence of test coverage and sprint demos as
the top quality gap — this plan is the response.

---

## 1. Objectives
- Verify each service behaves per its API contract in [`../api-specs/`](../api-specs/).
- Prevent regressions in critical flows: registration/login, showtime scheduling, and **seat booking under concurrency**.
- Establish a repeatable verification routine so every sprint ends with a working, demoable increment.

## 2. Scope
**In scope:** auth, movie/showtime, booking, user services (backend); customer & admin frontend flows.
**Out of scope (until their services graduate from WIP):** payment, promotion, notification — smoke-test only.

## 3. Test Levels & Ownership

| Level | Tooling | Owner | When |
|-------|---------|-------|------|
| Unit | JUnit 5 + Mockito (backend), Vitest (frontend) | Author of the change | Every MR |
| Integration | Spring Boot Test + Testcontainers (PostgreSQL/Redis/Kafka) | Backend author | Every MR touching persistence/messaging |
| Concurrency | JUnit parallel execution / custom harness | Booking team | Any change to seat-lock logic |
| API / Contract | Postman collection per service | Author | Every backend MR (evidence attached) |
| Manual / E2E | Browser + Postman, scripted steps | Assignee + Reviewer | Before Sprint Review |

## 4. Priority Test Scenarios

### 4.1 Authentication
| ID | Scenario | Expected |
|----|----------|----------|
| T-AUTH-1 | Register with valid data → verify OTP | Account created with role `MEMBER`; `UserRegisteredEvent` published |
| T-AUTH-2 | Register with duplicate username/email/phone/CCCD | 400 with code 1010/1011/1017/1018 |
| T-AUTH-3 | Verify with wrong / expired OTP | 400 code 1013 / 1015 |
| T-AUTH-4 | Resend OTP twice within 60s | 429 code 1016 |
| T-AUTH-5 | Login inactive account | 403 code 1020 |
| T-AUTH-6 | Use token after logout / refresh | 401 code 1008 (revoked) |

### 4.2 Showtime Scheduling
| ID | Scenario | Expected |
|----|----------|----------|
| T-MOV-1 | Create schedule overlapping an existing one in the same room | Rejected (overlap detection) |
| T-MOV-2 | Create schedule with date < today+3 or time outside 08:00–23:00 | Rejected (business rule) |

### 4.3 Booking (critical)
| ID | Scenario | Expected |
|----|----------|----------|
| T-BOOK-1 | Guest (`USER`) attempts to hold seats | 403 code 2010 (member-only) |
| T-BOOK-2 | Member holds available seats | 201, seats locked for 10 min |
| T-BOOK-3 | **Two members hold the same seat concurrently** | Exactly one succeeds; other gets 2006/2011 |
| T-BOOK-4 | Duplicate seat IDs in one request | 400 code 2009 |
| T-BOOK-5 | Cancel PENDING vs CONFIRMED booking | State-appropriate result; tickets voided for CONFIRMED |
| T-BOOK-6 | PENDING booking past lock TTL | Auto-cancelled (once expiry job exists — FR-BOOK-6) |

## 5. Test Data
- Only `admin`/`admin` is seeded automatically (`ApplicationInitConfig`, via `ADMIN_USERNAME`/`ADMIN_PASSWORD`). EMPLOYEE/MEMBER test accounts must be created through the app.
- Dev dataset for movie-service seeded (retro issue #85).
- Concurrency tests must run against Testcontainers, **not** the shared dev DB.

## 6. Entry / Exit Criteria
- **Entry:** feature meets [`DEFINITION_OF_READY.md`](DEFINITION_OF_READY.md); test env (docker-compose infra) is up.
- **Exit:** all priority scenarios for the sprint's stories pass; no open High-severity defects; feature demoed at Sprint Review.

## 7. Defect Handling
- Log defects as GitLab issues with `Type::Bug` + `Priority::*`.
- Severity: **High** blocks the sprint; **Medium/Low** may be carried over with a note in the retro's Technical Debt table.

## 8. Reporting
- Test evidence (Postman/UI screenshots) attached to each MR per the DoD.
- A short pass/fail summary of §4 scenarios is presented at each Sprint Review.

## Related
[`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) · [`SRS.md`](SRS.md) · [`../MR_REVIEW_PROCESS.md`](../MR_REVIEW_PROCESS.md)
