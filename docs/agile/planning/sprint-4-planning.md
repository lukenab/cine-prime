# Sprint 4 — Showtime Correctness & Booking Transaction Layer

## Sprint 4 — Planning

| Field | Value |
|---|---|
| Sprint | Sprint 4 — Showtime Correctness & Booking Transaction Layer |
| Duration | July 21, 2026 – August 4, 2026 (2 weeks) |
| Team | HCM26_CPL_JAVA_05_Group1 |

---

## Sprint Goal

> Close the gap between "browse a showtime" and "hold a confirmed, paid seat" by finishing the booking transaction layer deferred from Sprint 3, while hardening the showtime scheduling rules (buffer time, seat-inventory initialization, availability alignment) that the Sprint 3 retrospective flagged as incomplete — so the system supports one fully reliable, demoable customer booking journey before enrichment work resumes.

---

## Sprint Description

Sprint 3's retrospective (`docs/agile/retrospectives/sprint-3-retrospective.md`) proposed a staged "operational readiness" roadmap rather than treating all remaining work as equal-priority issues. Sprint 4 picks up exactly **Giai đoạn 2** of that roadmap — showtime correctness and seat inventory — plus the booking-layer items explicitly deferred from the original Sprint 3 plan (Confirm Booking, Counter Sale, booking expiry, employee booking search, notification consumers). Three areas of work run in parallel:

**Showtime correctness.** `ShowTimeService` already has bulk generation, overlap detection (`existsByCinemaRoomAndOverlappingTime`) and pricing (`basePrice`), but two gaps remain unclosed: it never validates that the movie is `APPROVED` or that a `MovieAvailability` window exists for the target cluster before allowing a showtime to be scheduled there (found while writing `MOVIE_CREATION_FLOW_TEST_SPEC.md` §23), and seat inventory (`showtime_seat` rows) is not guaranteed to be initialized consistently at creation time (retro item #179).

**Booking transaction layer.** `booking-service` already has seat-hold (`SeatLock`, pessimistic-write locking), create/cancel booking, and a `BookingController` with `POST /api/bookings`, `GET /{id}`, `GET /me`, `PATCH /{id}/cancel`. What's missing is the piece that actually completes a sale: **Confirm Booking**, **Counter Sale** (employee-assisted purchase), and the **booking expiry scheduler** (an unconfirmed hold must eventually release the seat back to inventory — without it, abandoned holds permanently lock seats).

**Operational hygiene carried over from the Sprint 3 retro action items.** Timezone standardization (`Asia/Saigon` → `Asia/Ho_Chi_Minh`, flagged as a release-blocking risk), `SeatLock` TTL moved out of hardcoded constants into `application.yml`, and a full regression pass on a clean database.

---

## Backend

| Area | Planned Work | Priority |
|---|---|---|
| Showtime Service | Validate `movie.status == APPROVED` and an active (`PLANNED`/`OPEN`) `MovieAvailability` for the target cluster before `POST /api/schedules` / `POST /api/schedules/generate` succeeds | High |
| Showtime Service | Seat-inventory initialization — guarantee `showtime_seat` rows are created deterministically alongside `ShowTime` on both single-create and bulk-generate paths (#179) | High |
| Showtime Service | Buffer time between showtimes in the same room (not just exact-overlap detection) (#178) | Medium |
| Showtime Service | Pessimistic locking on `ShowtimeSeat.lockSeats()` — carried over from Sprint 3 issue #145, still open per `sprint-3-issues.md` | High |
| Booking Service | `PATCH /api/bookings/{id}/confirm` — transitions `PENDING → CONFIRMED`, releases the seat hold into a real reservation | High |
| Booking Service | Counter Sale API — employee-assisted booking creation, bypassing the customer-facing hold-then-confirm flow | Medium |
| Booking Service | Booking expiry scheduled job — auto-release `SeatLock` rows past TTL back to `AVAILABLE` | High |
| Booking Service | Move `SeatLock` TTL out of hardcoded constant into `application.yml` (config) | Low |
| Booking Service | `GET /api/bookings/me?status=` — support status filtering (currently returns everything) | Low |
| Cinema Rooms | Seat lifecycle guard — block `MAINTENANCE`/`INACTIVE` transition on a seat with a `RESERVED` row for a future showtime (deferred from Sprint 3 issue #136) | Medium |
| Notification Service | Kafka consumer for booking events (`CONFIRMED`, `CANCELLED`) → email/SMS customer | Medium |
| Platform | Standardize scheduler/DB timezone to `Asia/Ho_Chi_Minh` across services (retro risk #2 — PostgreSQL rejected `Asia/Saigon` in some environments) | High |

## Frontend

| Area | Planned Work | Priority |
|---|---|---|
| Customer | `SeatBookingPage.tsx` — wire real confirm/payment step after seat hold succeeds (currently ends at hold) | High |
| Customer | Booking expiry countdown UI — show remaining hold time, redirect back to seat selection on expiry | Medium |
| Admin | `ManageBookingPage.tsx` — Counter Sale action for employee-assisted purchase | Medium |
| Admin | Employee booking search page (by customer, showtime, or booking code) | Medium |
| Admin | `ManageShowTimePage.tsx` — surface the new APPROVED/Availability precondition as an inline error instead of a generic 400 | Low |

## Quality & Process

| Area | Planned Work | Priority |
|---|---|---|
| Testing | Concurrency test: two customers hold the same seat simultaneously → exactly one succeeds | High |
| Testing | Integration test: booking expiry scheduler releases an expired hold and the seat becomes bookable again | High |
| Testing | Full `movie-service` + `booking-service` regression suite on a clean database (retro action #9) | High |
| Documentation | Extend `MOVIE_CREATION_FLOW_TEST_SPEC.md`-style rigor to a dedicated `SHOWTIME_BOOKING_FLOW_TEST_SPEC.md` | Medium |
| Process | Apply Sprint 3 retro action #4 — tag every issue P0/P1/P2 by risk (data loss, wrong permission, blocks operation), not all High | High |
| Process | One primary in-progress issue per member at a time (retro action #5) | High |
| Process | Sprint demo before close, from a tagged/frozen commit — not a dirty working tree (retro risk #3) | High |

---

## Success Criteria

- [ ] A customer can browse a showtime, hold a seat, confirm the booking, and see it as `CONFIRMED` — full path, no manual DB intervention
- [ ] An unconfirmed seat hold expires automatically and the seat becomes bookable again, without a server restart
- [ ] Showtime creation is rejected with a clear error if the movie isn't `APPROVED` or the cluster has no active release plan
- [ ] `showtime_seat` inventory exists for every showtime immediately after creation (single and bulk paths)
- [ ] Employee can complete a Counter Sale booking end-to-end
- [ ] Two concurrent hold requests for the same seat never both succeed (verified by test, not just code review)
- [ ] Full backend regression suite passes on a clean database, timezone-consistent across environments
- [ ] Sprint demo conducted from a frozen, tagged commit before close

---

## Carried Over from Sprint 3

| Item | Risk | Action |
|---|---|---|
| Confirm Booking + Counter Sale APIs not implemented | High | This sprint (top priority) |
| Booking expiry scheduled job not implemented | High | This sprint (top priority) |
| `ShowtimeSeat.lockSeats()` missing pessimistic locking (issue #145) | High | This sprint |
| Showtime scheduling has no dependency on Movie/Availability status | High | This sprint (new finding, MOV-LC gap) |
| `seat_lock` TTL hardcoded (should be configurable via `application.yml`) | Low | This sprint |
| `GET /api/bookings/me` status filtering not supported | Low | This sprint |
| Timezone mismatch (`Asia/Saigon` rejected by PostgreSQL in some environments) | High | This sprint |
| `movie_image` legacy enum value (`BackDrop`) violating DB check constraint | Medium | Movie-service regression fix, prerequisite for a clean full-suite pass |
| 14 issues still "in progress" at Sprint 3 feature freeze | High | Re-triage first day of Sprint 4 — close, fold into this plan, or explicitly re-scope to Sprint 5 |

---

## Action Items from Sprint 3 Retrospective

| # | Action | Priority | Status |
|---:|---|---|---|
| 1 | Reconcile board state against actual merge history and acceptance criteria | High | Carried into Sprint 4 kickoff |
| 2 | Formally re-scope Sprint 3 commitments after the standards change (with mentor) | High | Scheduled post-demo |
| 3 | Create an "operational readiness" epic, staged by risk (Giai đoạn 1/2/3) | High | **Sprint 4 = Giai đoạn 2 of that epic** |
| 4 | Apply P0/P1/P2 by risk instead of defaulting everything to High | High | Apply immediately |
| 5 | One primary in-progress issue per member | High | Active |
| 6 | Add an impact-assessment template for scope changes mid-sprint | Medium | Sprint 4 |
| 7 | Standardize Definition of Ready | Medium | Sprint 4 planning |
| 8 | Standardize an operations-oriented Definition of Done (code + migration + test + docs + running proof) | Medium | Sprint 4 planning |
| 9 | Run migration tests against a clean database in CI | High | Sprint 4 |
| 10 | Mid-sprint integration checkpoint + 24–48h feature freeze before demo | High | Sprint 4 |
| 11 | Assign a technical owner per business area (Showtime, Booking, Notification) | High | Sprint 4 |
| 12 | Report workload by story points/capacity, no member over 35% | Medium | At Sprint 4 close |
