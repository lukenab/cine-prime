# Sprint 3 — Planning

| Field | Value |
|-------|-------|
| Sprint | Sprint 3 — Content Management & Scheduling Layer |
| Duration | July 7, 2026 – July 21, 2026 (2 weeks) |
| Team | HCM26_CPL_JAVA_05_Group1 |

---

## Sprint Goal

> Complete the content management layer — finishing the full movie lifecycle with automated status transitions, building the admin showtime scheduling interface, and enabling cinema room seat configuration — so that the system has a fully operational content pipeline from movie creation to scheduled screenings before the booking layer is stabilized in Sprint 4.

---

## Sprint Description

Sprint 3 shifts focus from the booking transaction layer (deferred to Sprint 4) to the **content and scheduling infrastructure** that drives it. Three areas of work run in parallel:

**Movie Lifecycle.** The movie workflow introduced in Sprint 2 (DRAFT → PENDING_REVIEW → COMING_SOON → NOW_SHOWING) is completed: a release-date-based scheduler auto-transitions COMING_SOON films to NOW_SHOWING overnight, the endDate scheduler auto-ends NOW_SHOWING films, and the admin pending-review workflow gets a dedicated UI for efficient bulk review. The movie management frontend is also stabilized — status tabs, sidebar badge, and role-based action buttons are already in place from Sprint 2.5 work.

**Showtime Management.** Admins need to assign movies to cinema rooms by time slot. This sprint delivers the full showtime CRUD API with overlap prevention and status management (SCHEDULED → ACTIVE → COMPLETED / CANCELLED), paired with an admin UI for creating and managing showtimes. Seat pricing per showtime replaces the hardcoded `85,000 VND` constant.

**Cinema Rooms.** The cinema room seat configuration layer is completed — admins can define the seat grid (rows × columns, seat types) for each room, with the seat map auto-generated. This data feeds directly into the showtime seat availability API that the booking service depends on.

The sprint also carries forward the two highest-priority process actions from the Sprint 2 retrospective: redistribute issues so no single member exceeds 35% of assignments, and conduct a formal sprint demo before close.

---

## Scope

### Backend

| Area | Planned Work | Priority |
|------|--------------|:--------:|
| **Movie Service** | Release-date scheduler — auto-transition `COMING_SOON → NOW_SHOWING` at 00:10 when `releaseDate = today` | High |
| **Movie Service** | EndDate scheduler — auto-transition `NOW_SHOWING → ENDED` at 00:05 when `endDate < today` *(implemented)* | High |
| **Movie Service** | Fix `CinemaRoomRepository` generic type: `JpaRepository<CinemaRoom, Integer>` → `Long` | Low |
| **Showtime Service** | Showtime CRUD API: `POST`, `PUT`, `DELETE /api/showtimes/{id}` with overlap detection | High |
| **Showtime Service** | Showtime read API: `GET /api/showtimes` with filters (movieId, cinemaRoomId, date, status) | High |
| **Showtime Service** | Showtime status transitions: `SCHEDULED → ACTIVE → COMPLETED / CANCELLED` | Medium |
| **Showtime Service** | Seat pricing per showtime — replace hardcoded `85,000 VND` with configurable `basePrice` field | Medium |
| **Cinema Rooms** | Seat configuration API — auto-generate `showtime_seat` rows from room layout (rows × cols, seat type) | High |
| **Cinema Rooms** | Seat type management — STANDARD / VIP / COUPLE pricing tiers per room | Medium |
| **Notification Service** | Kafka consumer: movie status change events (PENDING_REVIEW → APPROVED / REJECTED) → email employee | Medium |

### Frontend

| Area | Planned Work | Priority |
|------|--------------|:--------:|
| **Admin — Movie** | Pending review panel — dedicated modal/drawer for approve/reject with rejection note input | High |
| **Admin — Movie** | Movie status tabs + pending badge *(implemented)* | High |
| **Admin — Showtime** | Showtime management page — list with filters (movie, room, date), create/edit modal | High |
| **Admin — Showtime** | Showtime create wizard — select movie → select room → pick date/time → confirm with overlap check | High |
| **Admin — Cinema Rooms** | Cinema rooms management page — list rooms per cluster, view/edit seat layout | High |
| **Admin — Cinema Rooms** | Seat map visualizer — render seat grid for admin review before activating room | Medium |
| **Customer** | Movie listing improvements — separate NOW_SHOWING and COMING_SOON sections on homepage | Medium |
| **Customer** | Movie detail page — trailer embed, cast list, showtime sessions by cinema | Medium |

### Quality & Process

| Area | Planned Work | Priority |
|------|--------------|:--------:|
| **Testing** | Unit tests for movie status transition rules (valid/invalid transitions) | Medium |
| **Testing** | Integration tests for showtime overlap detection | Medium |
| **Documentation** | Update `API_CONTRACT.md` for showtime and cinema room endpoints | Medium |
| **Process** | Redistribute issues — target ≤ 35% per member | High |
| **Process** | Sprint demo before close — validate content pipeline end-to-end | High |

---

## Success Criteria

- [ ] Movie lifecycle fully automated: release-date scheduler (COMING_SOON → NOW_SHOWING) + endDate scheduler (NOW_SHOWING → ENDED) both running in production
- [ ] Admin can create, edit, and cancel showtimes via UI; overlap prevention enforced
- [ ] Cinema room seat layout configurable by admin; seat grid visible in UI
- [ ] Seat pricing per showtime replaces hardcoded constant
- [ ] Pending review workflow: admin can approve/reject movies with rejection note via dedicated UI
- [ ] No single member carries more than 35% of total issues
- [ ] Sprint demo conducted before close

---

## Technical Debt Carried Over from Sprint 2

| Item | Risk | Action |
|------|------|--------|
| Booking expiry scheduled job not implemented | High | Deferred to Sprint 4 |
| Confirm Booking + Counter Sale APIs not implemented | High | Deferred to Sprint 4 |
| `seat_lock` TTL hardcoded (should be configurable via `application.yml`) | Low | Deferred to Sprint 4 |
| `CinemaRoomRepository` generic type mismatch (`Integer` vs `Long`) | Low | **Fix in Sprint 3** |
| `GET /api/bookings/me` status filtering not supported | Low | Deferred to Sprint 4 |

---

## Items Deferred from Original Sprint 3 Plan

The following items from the original Sprint 3 scope are deferred to Sprint 4 to allow full focus on the content management layer:

| Item | Reason |
|------|--------|
| Confirm Booking API (`PATCH /api/bookings/{id}/confirm`) | Depends on stable showtime + seat pricing (this sprint) |
| Counter Sale API + Employee counter UI | Depends on showtime management completion |
| Booking expiry scheduler | Deferred — booking layer stable enough, not blocking |
| Employee booking search page | Deferred to Sprint 4 |
| Notification consumers for booking events | Deferred — movie status notifications prioritized first |
| Concurrency integration tests for seat conflict | Deferred — booking layer deferred |

---

## Action Items from Sprint 2 Retrospective

| # | Action | Priority | Status |
|---|--------|:--------:|--------|
| 1 | Fix `CinemaRoomRepository` generic type: `Integer` → `Long` | Medium | In Sprint 3 |
| 2 | Redistribute issues — target ≤ 35% per member | High | **Active** |
| 3 | Agree on `ApiResponse<T>` contract before writing new API docs | Medium | Apply immediately |
| 4 | Include test issues in sprint planning (≥ 1 story point each) | Medium | In Sprint 3 |
| 5 | Conduct sprint demo at end of Sprint 3 | Medium | **Scheduled** |
